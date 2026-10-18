import { CENTRO, TURNS, type CityLayout, type ExitLayout, type Turn } from '../constants/layouts';
import {
	ACCELERATION,
	CAR_LENGTH,
	CAR_WIDTH,
	CRASH_SHRINK,
	DECELERATION,
	FOLLOW_LATERAL,
	FOLLOW_MAX_ANGLE,
	MAX_POINTS,
	MIN_GAP,
	PATIENCE_DRAIN,
	PATIENCE_MAX,
	PATIENCE_MIN,
	PATIENCE_RECOVERY,
	SPAWN_FIRST_DELAY,
	SPAWN_JITTER,
	SPAWN_MIN_INTERVAL,
	SPAWN_RAMP_SECONDS,
	SPAWN_START_INTERVAL,
	SPEED_MAX,
	SPEED_MIN,
	START_LIVES,
	STOPPED_SPEED,
	TURN_WEIGHTS,
} from '../constants/tuning';
import { buildRoutes, lightIdFor, poseAt, type Route } from './routes';

export type LightState = 'red' | 'green';

export type Car = {
	id: number;
	route: Route;
	exit: ExitLayout;
	/** Distancia recorrida sobre su ruta. */
	s: number;
	speed: number;
	maxSpeed: number;
	patience: number;
	maxPatience: number;
	/** Ya pasó la línea de parada o no llega a frenar: ignora el semáforo. */
	committed: boolean;
	/** Paciencia que le quedaba al comprometerse: de eso sale su puntaje. */
	scoreFraction: number;
	braking: boolean;
	x: number;
	y: number;
	angle: number;
};

export type TrafficEvent =
	| { type: 'spawned'; car: Car }
	| { type: 'toggled'; lightId: string; state: LightState }
	| { type: 'completed'; car: Car; points: number }
	| { type: 'crash'; cars: [Car, Car]; x: number; y: number }
	| { type: 'impatient'; car: Car }
	| { type: 'gameOver' };

/** Las métricas que pide el GDD para evaluar el balance. */
export type TrafficStats = {
	completed: number;
	crashes: number;
	impatient: number;
	/** Máximo de coches detenidos a la vez. */
	maxStopped: number;
	/** Segundos que pasó en rojo cada semáforo. */
	redTime: Record<string, number>;
};

/**
 * Simulación completa de una partida. No importa Phaser: la escena le pasa
 * los clicks con `toggle`, la avanza con `step(dt)` y convierte `events` en
 * dibujo y sonido. El simulador de balance la usa tal cual.
 */
export class Traffic {
	readonly layout: CityLayout;
	readonly routes: Route[];
	readonly lightIds: string[];
	lights: Record<string, LightState> = {};
	cars: Car[] = [];
	events: TrafficEvent[] = [];

	score = 0;
	lives = START_LIVES;
	time = 0;
	outcome: 'playing' | 'over' = 'playing';
	/** Segundos desde que terminó la partida. */
	endTimer = 0;
	stats: TrafficStats;

	private readonly random: () => number;
	private readonly routesByLane = new Map<string, Map<Turn, Route>>();
	private readonly lanesByLight = new Map<string, string[]>();
	private readonly entries: Array<{ lightId: string; weight: number }> = [];
	private spawnTimer = SPAWN_FIRST_DELAY;
	private nextId = 1;

	constructor(layout: CityLayout = CENTRO, random: () => number = Math.random) {
		this.layout = layout;
		this.random = random;
		this.routes = buildRoutes(layout);

		for (const route of this.routes) {
			if (!this.routesByLane.has(route.entryLaneId)) {
				this.routesByLane.set(route.entryLaneId, new Map());
				const lanes = this.lanesByLight.get(route.lightId) ?? [];
				lanes.push(route.entryLaneId);
				this.lanesByLight.set(route.lightId, lanes);
			}
			this.routesByLane.get(route.entryLaneId)!.set(route.turn, route);
		}

		// Todos los semáforos arrancan en rojo, como pide el GDD.
		for (const crossing of layout.crossings) {
			for (const [arm, armLayout] of Object.entries(crossing.arms)) {
				if (armLayout.inLanes.length === 0) {
					continue;
				}
				const lightId = lightIdFor(crossing.id, arm as keyof typeof crossing.arms);
				this.lights[lightId] = 'red';
				this.entries.push({ lightId, weight: armLayout.spawnWeight });
			}
		}
		this.lightIds = Object.keys(this.lights);
		this.stats = {
			completed: 0,
			crashes: 0,
			impatient: 0,
			maxStopped: 0,
			redTime: Object.fromEntries(this.lightIds.map((id) => [id, 0])),
		};
	}

	toggle(lightId: string) {
		if (this.outcome !== 'playing' || !(lightId in this.lights)) {
			return;
		}
		this.setLight(lightId, this.lights[lightId] === 'red' ? 'green' : 'red');
	}

	setLight(lightId: string, state: LightState) {
		if (this.lights[lightId] === state) {
			return;
		}
		this.lights[lightId] = state;
		this.events.push({ type: 'toggled', lightId, state });

		if (state === 'red') {
			// Línea de no retorno: el que ya no llega a frenar antes de la línea
			// sigue de largo. Cortar el verde nunca deja un coche a mitad del cruce.
			for (const car of this.cars) {
				const distance = car.route.stopAt - car.s;
				if (car.route.lightId === lightId && !car.committed && (car.speed * car.speed) / (2 * DECELERATION) > distance + 0.5) {
					this.commit(car);
				}
			}
		}
	}

	/** Intervalo entre coches en este momento de la partida, sin la variación al azar. */
	spawnInterval() {
		const progress = Math.min(1, this.time / SPAWN_RAMP_SECONDS);
		return SPAWN_START_INTERVAL + (SPAWN_MIN_INTERVAL - SPAWN_START_INTERVAL) * progress;
	}

	stoppedCount() {
		return this.cars.filter((car) => !car.committed && car.speed < STOPPED_SPEED).length;
	}

	/** Coches detenidos antes de un semáforo: la cola que el jugador tiene que despejar. */
	queueLength(lightId: string) {
		return this.cars.filter((car) => car.route.lightId === lightId && !car.committed && car.speed < STOPPED_SPEED).length;
	}

	step(dt: number) {
		if (this.outcome === 'over') {
			this.endTimer += dt;
			return;
		}

		this.time += dt;
		for (const lightId of this.lightIds) {
			if (this.lights[lightId] === 'red') {
				this.stats.redTime[lightId] += dt;
			}
		}

		this.updateSpawning(dt);
		this.updateCars(dt);
		this.detectCrashes();
		this.stats.maxStopped = Math.max(this.stats.maxStopped, this.stoppedCount());

		if (this.lives <= 0) {
			this.lives = 0;
			this.outcome = 'over';
			this.events.push({ type: 'gameOver' });
		}
	}

	// --------------------------------------------------------------- aparición

	private updateSpawning(dt: number) {
		this.spawnTimer -= dt;
		if (this.spawnTimer > 0) {
			return;
		}
		// Si todas las entradas están tapadas se vuelve a probar en el próximo paso.
		if (this.spawn()) {
			const jitter = 1 + (this.random() * 2 - 1) * SPAWN_JITTER;
			this.spawnTimer = this.spawnInterval() * jitter;
		}
	}

	/** Sortea entrada y destino. Una entrada con la cola hasta el borde no recibe coches. */
	private spawn() {
		const candidates = [...this.entries];
		while (candidates.length > 0) {
			const entry = this.pickWeighted(candidates, (candidate) => candidate.weight);
			candidates.splice(candidates.indexOf(entry), 1);

			const route = this.pickRoute(entry.lightId);
			if (route) {
				this.addCar(route);
				return true;
			}
		}
		return false;
	}

	private pickRoute(lightId: string) {
		const freeLanes = (this.lanesByLight.get(lightId) ?? []).filter((laneId) => this.isLaneFree(laneId));
		if (freeLanes.length === 0) {
			return null;
		}
		// Primero el movimiento, después un carril que lo permita.
		const turns = TURNS.filter((turn) => freeLanes.some((laneId) => this.routesByLane.get(laneId)!.has(turn)));
		const turn = this.pickWeighted(turns, (candidate) => TURN_WEIGHTS[candidate]);
		const lanes = freeLanes.filter((laneId) => this.routesByLane.get(laneId)!.has(turn));
		const laneId = lanes[Math.floor(this.random() * lanes.length)];
		return this.routesByLane.get(laneId)!.get(turn)!;
	}

	private isLaneFree(laneId: string) {
		return !this.cars.some((car) => car.route.entryLaneId === laneId && car.s < CAR_LENGTH + MIN_GAP);
	}

	private addCar(route: Route) {
		const maxPatience = PATIENCE_MIN + this.random() * (PATIENCE_MAX - PATIENCE_MIN);
		const maxSpeed = SPEED_MIN + this.random() * (SPEED_MAX - SPEED_MIN);
		const pose = poseAt(route, 0);
		const car: Car = {
			id: this.nextId++,
			route,
			exit: route.exit,
			s: 0,
			speed: maxSpeed,
			maxSpeed,
			patience: maxPatience,
			maxPatience,
			committed: false,
			scoreFraction: 1,
			braking: false,
			...pose,
		};
		this.cars.push(car);
		this.events.push({ type: 'spawned', car });
		return car;
	}

	private pickWeighted<T>(items: readonly T[], weight: (item: T) => number): T {
		const total = items.reduce((sum, item) => sum + weight(item), 0);
		let roll = this.random() * total;
		for (const item of items) {
			roll -= weight(item);
			if (roll < 0) {
				return item;
			}
		}
		return items[items.length - 1];
	}

	// --------------------------------------------------------------- marcha

	private updateCars(dt: number) {
		// Primero se deciden todas las velocidades y después se mueve: así el
		// orden de la lista no le da ventaja a ningún coche.
		const speeds = this.cars.map((car) => this.targetSpeed(car, dt));
		const finished: Car[] = [];
		const impatient: Car[] = [];

		this.cars.forEach((car, index) => {
			const speed = speeds[index];
			car.braking = speed < car.speed - 0.5 || speed < STOPPED_SPEED;
			car.speed = speed;
			car.s += speed * dt;
			Object.assign(car, poseAt(car.route, car.s));

			// El margen evita que un coche detenido justo en la línea cuente como que la cruzó.
			if (!car.committed && car.s > car.route.stopAt + 0.5) {
				this.commit(car);
			}
			if (car.s >= car.route.length) {
				finished.push(car);
				return;
			}
			if (car.committed) {
				return;
			}
			if (car.speed < STOPPED_SPEED) {
				car.patience -= PATIENCE_DRAIN * dt;
				if (car.patience <= 0) {
					car.patience = 0;
					impatient.push(car);
				}
			} else {
				car.patience = Math.min(car.maxPatience, car.patience + PATIENCE_RECOVERY * dt);
			}
		});

		for (const car of finished) {
			this.removeCar(car);
			const points = Math.max(1, Math.ceil(MAX_POINTS * car.scoreFraction));
			this.score += points;
			this.stats.completed += 1;
			this.events.push({ type: 'completed', car, points });
		}
		for (const car of impatient) {
			this.removeCar(car);
			this.lives -= 1;
			this.stats.impatient += 1;
			this.events.push({ type: 'impatient', car });
		}
	}

	private commit(car: Car) {
		car.committed = true;
		car.scoreFraction = car.patience / car.maxPatience;
	}

	private targetSpeed(car: Car, dt: number) {
		let target = Math.min(car.maxSpeed, car.speed + ACCELERATION * dt);

		// Frenar a tiempo para detenerse justo en el límite, sin pasarse en el último paso.
		const limit = (distance: number) => Math.min(Math.sqrt(2 * DECELERATION * distance), distance / dt);

		if (!car.committed && this.lights[car.route.lightId] === 'red') {
			target = Math.min(target, limit(Math.max(0, car.route.stopAt - car.s)));
		}
		const gap = this.gapAhead(car);
		if (gap < Infinity) {
			target = Math.min(target, limit(Math.max(0, gap - MIN_GAP)));
		}
		return Math.max(0, target);
	}

	/**
	 * Espacio libre hasta el coche de adelante. En un mismo carril se mide sobre
	 * la ruta; dentro del cruce, por un cono frontal con rumbo parecido, que es
	 * lo que hace frenar a dos coches que desembocan en la misma salida.
	 */
	private gapAhead(car: Car) {
		const route = car.route;
		const cos = Math.cos(car.angle);
		const sin = Math.sin(car.angle);
		let nearest = Infinity;

		for (const other of this.cars) {
			if (other === car) {
				continue;
			}
			let ahead: number | null = null;
			if (other.route === route) {
				ahead = other.s - car.s;
			} else if (other.route.entryLaneId === route.entryLaneId && car.s < route.boxStart && other.s < other.route.boxStart) {
				ahead = other.s - car.s;
			} else if (other.route.exitLaneId === route.exitLaneId && car.s >= route.boxEnd && other.s >= other.route.boxEnd) {
				ahead = (route.length - car.s) - (other.route.length - other.s);
			} else {
				const dx = other.x - car.x;
				const dy = other.y - car.y;
				const along = dx * cos + dy * sin;
				const lateral = Math.abs(-dx * sin + dy * cos);
				const turn = Math.abs(Math.atan2(Math.sin(other.angle - car.angle), Math.cos(other.angle - car.angle)));
				if (along > 0 && lateral < FOLLOW_LATERAL && turn < FOLLOW_MAX_ANGLE) {
					ahead = along;
				}
			}
			if (ahead !== null && ahead > 0) {
				nearest = Math.min(nearest, ahead - CAR_LENGTH);
			}
		}
		return nearest;
	}

	// --------------------------------------------------------------- choques

	private detectCrashes() {
		const crashed = new Set<Car>();
		for (let i = 0; i < this.cars.length; i += 1) {
			const a = this.cars[i];
			if (crashed.has(a)) {
				continue;
			}
			for (let j = i + 1; j < this.cars.length; j += 1) {
				const b = this.cars[j];
				if (crashed.has(b) || !overlaps(a, b)) {
					continue;
				}
				crashed.add(a).add(b);
				this.lives -= 1;
				this.stats.crashes += 1;
				this.events.push({ type: 'crash', cars: [a, b], x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
				break;
			}
		}
		for (const car of crashed) {
			this.removeCar(car);
		}
	}

	private removeCar(car: Car) {
		const index = this.cars.indexOf(car);
		if (index >= 0) {
			this.cars.splice(index, 1);
		}
	}
}

/** Prueba de ejes separados entre las dos carrocerías, que son rectángulos girados. */
function overlaps(a: Car, b: Car) {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	if (dx * dx + dy * dy >= CAR_LENGTH * CAR_LENGTH) {
		return false;
	}
	const halfLength = (CAR_LENGTH / 2) * CRASH_SHRINK;
	const halfWidth = (CAR_WIDTH / 2) * CRASH_SHRINK;
	for (const angle of [a.angle, a.angle + Math.PI / 2, b.angle, b.angle + Math.PI / 2]) {
		const ax = Math.cos(angle);
		const ay = Math.sin(angle);
		const radius = (car: Car) =>
			halfLength * Math.abs(Math.cos(car.angle) * ax + Math.sin(car.angle) * ay) +
			halfWidth * Math.abs(-Math.sin(car.angle) * ax + Math.cos(car.angle) * ay);
		if (Math.abs(dx * ax + dy * ay) > radius(a) + radius(b)) {
			return false;
		}
	}
	return true;
}
