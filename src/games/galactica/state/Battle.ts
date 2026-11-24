import {
	HELIX_AMPLITUDE,
	HELIX_FREQUENCY,
	MAX_AIM_DEGREES,
	SHOTS,
	SPLIT_AFTER,
	SPLIT_ANGLE,
	type Maneuver,
	type ShotKind,
} from '../constants/attacks';
import { BOSSES, ENEMIES, SHARD, type BossDef, type BossMove, type EnemySpec, type Family, type Rank } from '../constants/families';
import {
	FIELD_ROCKS,
	FREIGHTER,
	PASSAGE_BEFORE_WAVE,
	PASSAGES,
	STORM,
	type PassageCue,
	type PassageId,
} from '../constants/passages';
import { SHIPS, type ShipDef, type ShipId } from '../constants/ships';
import {
	BOSS_INTRO,
	BOSS_RADIUS,
	BULLET_RADIUS,
	DAMAGE,
	DIVE_SPEED,
	EMPTY_ENERGY_LIFE_DRAIN,
	ENEMY_RADIUS,
	ENERGY_SURCHARGE,
	ENTRY_SPEED,
	EVOLUTION_CORES,
	FIELD_H,
	FIELD_W,
	INVULNERABLE_AFTER_HIT,
	PICKUP_ENERGY,
	PICKUP_FALL_SPEED,
	PICKUP_LIFE,
	PICKUP_RADIUS,
	PLANT_FUSE,
	PLANT_GAP,
	PLANT_RADIUS,
	PLAYER_MARGIN,
	PLAYER_MIN_Y,
	PLAYER_RADIUS,
	PLAYER_Y,
	POD_RADIUS,
	POWER_UP_SECONDS,
	RETURN_SPEED,
	ROCK_RADIUS,
	SHARD_RADIUS,
	SHIELD_CAPACITY,
	SHIELD_CHARGE,
	STATION_AIM,
	STATION_CLEARANCE,
	SWOOP_SPEED,
	WAVE_INTERLUDE,
	ZONE_CLEAR_ENERGY_BONUS,
	ZONE_CLEAR_LIFE_BONUS,
	ZONE_HEAL,
	type DamageSource,
} from '../constants/tuning';
import { ENTRY_POINTS, ZONES, type EventKind, type ZoneDef } from '../constants/zones';
import { Formation } from './Formation';
import { Passage, type Band, type RockLine } from './Passage';
import { Path, type Point } from './paths';

/** Lo que pasa de una zona a la siguiente. */
export type RunState = {
	zone: number;
	shipId: ShipId;
	score: number;
	hp: number;
	cores: number;
	/** Segundos que le quedan a cada mejora, y de carga al escudo: siguen en la próxima zona. */
	powerUps: Record<PowerUpKind, number>;
};

export type PowerUpKind = 'shield' | 'double' | 'speed';

export function newRun(shipId: ShipId): RunState {
	return { zone: 1, shipId, score: 0, hp: 100, cores: 0, powerUps: { shield: 0, double: 0, speed: 0 } };
}

export type PickupKind = 'life' | 'energy' | 'core' | 'shield' | 'double' | 'speed';
export const PICKUP_KINDS: PickupKind[] = ['life', 'energy', 'core', 'shield', 'double', 'speed'];

/** Qué suelta cada fuente. Los comandantes premian la evolución; los pods, sobrevivir. */
const DROP_TABLES: Record<'enemy' | 'pod' | 'rock', Array<[PickupKind, number]>> = {
	enemy: [['core', 5], ['life', 2], ['energy', 2], ['double', 1], ['shield', 2], ['speed', 1]],
	pod: [['life', 3], ['energy', 3], ['core', 3], ['shield', 2], ['double', 1], ['speed', 1]],
	rock: [['energy', 2], ['life', 1]],
};

export type EnemyState =
	| 'waiting'
	| 'entering'
	| 'joining'
	| 'formation'
	| 'telegraph'
	| 'swoop'
	| 'dive'
	| 'planting'
	| 'planted'
	| 'returning'
	/** Acompaña a un carguero. */
	| 'escort'
	/** Siguió de largo: se borra al terminar el paso. */
	| 'gone';

export type Enemy = {
	id: number;
	family: Family;
	/** 0 para las esquirlas de cristal. */
	rank: Rank | 0;
	spec: EnemySpec;
	hp: number;
	x: number;
	y: number;
	/** Rumbo en radianes; 0 es mirando hacia abajo, como se dibujan. */
	angle: number;
	/** Casillero en la formación; los que no tienen (esquirlas, escoltas) se van al terminar su picada. */
	slot: { col: number; row: number } | null;
	state: EnemyState;
	timer: number;
	path: Path | null;
	distance: number;
	maneuver: Maneuver | null;
	/** Fracciones del rizo en las que dispara; se van consumiendo. */
	volleyMarks: number[];
	vx: number;
	vy: number;
	flash: number;
	/** Segundos para que dispare desde su casillero; 0 si no está apuntando. */
	aim: number;
	wave: number;
	/** El carguero al que escolta y su lugar al lado de él. */
	leader?: number;
	offset?: { dx: number; dy: number };
};

export type BossState = 'entering' | 'fighting' | 'charging' | 'rising';

export type Boss = {
	id: number;
	family: Family;
	def: BossDef;
	hp: number;
	maxHp: number;
	x: number;
	y: number;
	vx: number;
	state: BossState;
	moveIndex: number;
	timer: number;
	/** Una ráfaga en curso: cuántos disparos le quedan y cada cuánto. */
	burst: { move: BossMove; left: number; every: number; timer: number } | null;
	spiralAngle: number;
	chargeX: number;
	telegraph: number;
	flash: number;
};

export type BulletStyle = 'bolt' | 'helix' | 'split' | 'fan';

export type Bullet = {
	id: number;
	x: number;
	y: number;
	vx: number;
	vy: number;
	style: BulletStyle;
	damage: number;
	age: number;
	/** El helicoide se mueve alrededor de un centro que viaja en línea recta. */
	cx: number;
	cy: number;
	phase: number;
};

export type Shot = { id: number; x: number; y: number; vx: number; vy: number; pierce: boolean; hits: number[] };

export type Pod = { id: number; x: number; y: number; vx: number; hp: number; flash: number };
export type Rock = {
	id: number;
	x: number;
	y: number;
	vx: number;
	vy: number;
	hp: number;
	spin: number;
	angle: number;
	frame: 1 | 2;
	flash: number;
	/** En las de un tramo, el centro del hueco de su fila (en x) o de su muro (en y). */
	gap?: number;
};
export type Freighter = { id: number; x: number; y: number; vx: number; hp: number; flash: number; fireTimer: number };
/** Una franja de la tormenta: `timer` baja hasta 0 mientras avisa y sigue en negativo mientras cae. */
export type Strike = Band & { id: number; timer: number; resolved: boolean };
export type Comet = { x: number; y: number; vx: number; vy: number };
export type CometWarning = { x: number; vx: number; timer: number; delay: number };
export type Pickup = {
	id: number;
	x: number;
	y: number;
	kind: PickupKind;
	age: number;
	/** Cuánto carga, si no es lo de siempre. */
	amount?: number;
};

export type Player = {
	x: number;
	y: number;
	vx: number;
	cooldown: number;
	invulnerable: number;
	/** Carga guardada, en segundos; sólo se gasta con el escudo prendido. */
	shield: number;
	shielding: boolean;
	double: number;
	speed: number;
};

export type Phase = 'interlude' | 'wave' | 'passage' | 'bossIntro' | 'boss' | 'clear';

export type BattleEvent =
	| { type: 'playerShot' }
	| { type: 'enemyShot'; x: number; y: number }
	| { type: 'hit'; x: number; y: number }
	| { type: 'kill'; x: number; y: number; family: Family | 'rock' | 'pod' | 'freighter'; points: number; big: boolean }
	| { type: 'playerHit'; source: DamageSource; damage: number }
	| { type: 'shieldUp' }
	| { type: 'shieldBlock'; x: number; y: number }
	| { type: 'pickup'; kind: PickupKind; x: number; y: number }
	| { type: 'evolve'; stage: number }
	| { type: 'warning'; kind: 'comets' | 'planted' | 'charge' | 'pod' | 'asteroids'; x: number }
	| { type: 'blast'; x: number; y: number; radius: number }
	| { type: 'waveStart'; wave: number }
	| { type: 'passageStart'; id: PassageId }
	| { type: 'deflect'; x: number; y: number }
	| { type: 'strike' }
	| { type: 'stormBlock'; x: number; y: number; amount: number }
	| { type: 'bossSpawn' }
	| { type: 'bossDown'; x: number; y: number; points: number }
	| { type: 'energyEmpty' }
	| { type: 'podOpened'; x: number; y: number; ships: boolean }
	| { type: 'zoneClear'; bonus: number }
	| { type: 'playerDown'; x: number; y: number };

export type BattleStats = {
	time: number;
	kills: number;
	damage: Record<DamageSource, number>;
	pickups: Record<PickupKind, number>;
	podsOpened: number;
	bossTime: number;
};

/** `move` y `moveY` van de -1 a 1; `moveY` negativo es hacia adelante. */
export type Input = { move: number; moveY: number; fire: boolean; shield: boolean };

const DEG = Math.PI / 180;
const CLEAR_DELAY = 2.6;

/**
 * Una zona entera: oleadas, eventos y jefe. No conoce Phaser, así que el
 * simulador puede jugar cientos de zonas sin navegador.
 *
 * La escena le pasa la entrada con `setInput`, la hace avanzar con `step` a
 * pasos fijos y dibuja lo que encuentra en sus listas. Lo que hay que sonar o
 * festejar queda en `events`, que la escena vacía después de leerlo.
 */
export class Battle {
	readonly zone: ZoneDef;
	readonly zoneNumber: number;
	readonly ship: ShipDef;
	readonly formation = new Formation();

	score: number;
	hp: number;
	energy = 100;
	cores: number;
	stage: number;

	player: Player;
	enemies: Enemy[] = [];
	boss: Boss | null = null;
	bullets: Bullet[] = [];
	shots: Shot[] = [];
	pods: Pod[] = [];
	rocks: Rock[] = [];
	comets: Comet[] = [];
	cometWarnings: CometWarning[] = [];
	pickups: Pickup[] = [];
	freighters: Freighter[] = [];
	strikes: Strike[] = [];
	/** El tramo en curso. */
	passage: Passage | null = null;
	/** El que todavía falta jugar en esta zona. */
	pendingPassage: PassageId | null;

	phase: Phase = 'interlude';
	phaseTimer = 1.2;
	wave = -1;
	outcome: 'playing' | 'won' | 'lost' = 'playing';
	endTimer = 0;
	time = 0;
	events: BattleEvent[] = [];
	stats: BattleStats;

	/** La Galactopedia los apaga: en sus ejemplos sólo pasa lo que se está mostrando. */
	randomEvents = true;

	private input: Input = { move: 0, moveY: 0, fire: false, shield: false };
	private nextId = 1;
	private attackTimer = 0;
	private stationTimer = 0;
	private waveSize = 0;
	private eventTimer: number;
	private energyWarned = false;
	private sandboxed = false;

	private readonly random: () => number;

	constructor(run: RunState, random: () => number = Math.random) {
		this.random = random;
		this.zoneNumber = Math.min(run.zone, ZONES.length);
		this.zone = ZONES[this.zoneNumber - 1];
		this.ship = SHIPS[run.shipId];
		this.score = run.score;
		this.hp = run.hp;
		this.cores = run.cores;
		this.stage = stageForCores(run.cores);
		this.player = { x: FIELD_W / 2, y: PLAYER_Y, vx: 0, cooldown: 0, invulnerable: 0, shielding: false, ...run.powerUps };
		this.eventTimer = this.range(this.zone.eventEvery);
		this.pendingPassage = this.zone.passage;
		this.stats = {
			time: 0,
			kills: 0,
			damage: { bolt: 0, helix: 0, fan: 0, blast: 0, ram: 0, comet: 0, rock: 0, storm: 0, empty: 0 },
			pickups: { life: 0, energy: 0, core: 0, shield: 0, double: 0, speed: 0 },
			podsOpened: 0,
			bossTime: 0,
		};
	}

	setInput(input: Input) {
		this.input = input;
	}

	/**
	 * Una zona quieta, sin oleadas ni eventos al azar: el banco de pruebas de la
	 * Galactopedia. Lo que pase, lo provoca quien la usa.
	 */
	sandbox() {
		this.phase = 'bossIntro';
		this.phaseTimer = Infinity;
		this.randomEvents = false;
		this.sandboxed = true;
		return this;
	}

	/** Una nave ya acomodada en su casillero. */
	placeEnemy(family: Family, rank: Rank | 0, col: number, row: number): Enemy {
		const spec = rank === 0 ? SHARD : ENEMIES[family][rank];
		const slot = this.formation.slot(col, row);
		const enemy: Enemy = {
			id: this.nextId++,
			family,
			rank,
			spec,
			hp: spec.hp,
			x: slot.x,
			y: slot.y,
			angle: 0,
			slot: { col, row },
			state: 'formation',
			timer: 0,
			path: null,
			distance: 0,
			maneuver: null,
			volleyMarks: [],
			vx: 0,
			vy: 0,
			flash: 0,
			aim: 0,
			wave: this.wave,
		};
		this.enemies.push(enemy);
		return enemy;
	}

	/** Lo que se lleva a la zona siguiente: puntaje, núcleos y algo de vida. */
	nextRun(): RunState {
		return {
			zone: this.zoneNumber + 1,
			shipId: this.ship.id,
			score: this.score,
			hp: Math.min(100, Math.ceil(this.hp) + ZONE_HEAL),
			cores: this.cores,
			powerUps: { shield: this.player.shield, double: this.player.double, speed: this.player.speed },
		};
	}

	get isLastZone() {
		return this.zoneNumber >= ZONES.length;
	}

	get waveCount() {
		return this.zone.waves.length;
	}

	step(dt: number) {
		this.time += dt;
		if (this.outcome !== 'playing') {
			this.endTimer += dt;
		} else {
			this.stats.time += dt;
			if (this.boss) {
				this.stats.bossTime += dt;
			}
		}

		this.formation.step(dt);
		if (this.outcome === 'playing') {
			this.updatePlayer(dt);
			this.updateEnergy(dt);
		}
		this.updatePhase(dt);
		this.updateEnemies(dt);
		this.updateBoss(dt);
		this.updateBullets(dt);
		this.updateShots(dt);
		this.updateHazards(dt);
		this.updatePickups(dt);
		if (this.outcome === 'playing') {
			this.collide();
		}
	}

	// ----------------------------------------------------------------- jugador

	private updatePlayer(dt: number) {
		const player = this.player;
		const speed = this.ship.speed * (player.speed > 0 ? 1.35 : 1);
		const { move, moveY } = this.input;
		// En diagonal no va más rápido que derecho.
		const pace = speed / Math.max(1, Math.hypot(move, moveY));
		player.vx = move * pace;
		player.x = Math.max(PLAYER_MARGIN, Math.min(FIELD_W - PLAYER_MARGIN, player.x + player.vx * dt));
		player.y = Math.max(PLAYER_MIN_Y, Math.min(PLAYER_Y, player.y + moveY * pace * dt));

		player.cooldown -= dt;
		player.invulnerable = Math.max(0, player.invulnerable - dt);
		const wasShielding = player.shielding;
		player.shielding = this.input.shield && player.shield > 0 && this.energy > 0;
		if (player.shielding) {
			player.shield = Math.max(0, player.shield - dt);
			if (!wasShielding) {
				this.events.push({ type: 'shieldUp' });
			}
		}
		player.double = Math.max(0, player.double - dt);
		player.speed = Math.max(0, player.speed - dt);

		if (this.input.fire && player.cooldown <= 0 && this.phase !== 'clear') {
			this.firePlayer();
			player.cooldown = this.ship.cooldown * (player.speed > 0 ? 0.72 : 1);
		}
	}

	private firePlayer() {
		const muzzles = this.ship.stages[this.stage];
		const offsets = this.player.double > 0 ? [-5, 5] : [0];
		for (const muzzle of muzzles) {
			for (const extra of offsets) {
				const angle = (muzzle.angle ?? 0) * DEG;
				this.shots.push({
					id: this.nextId++,
					x: this.player.x + muzzle.dx + extra,
					y: this.player.y - 20,
					vx: Math.sin(angle) * this.ship.bulletSpeed,
					vy: -Math.cos(angle) * this.ship.bulletSpeed,
					pierce: muzzle.pierce ?? false,
					hits: [],
				});
			}
		}
		this.events.push({ type: 'playerShot' });
	}

	private updateEnergy(dt: number) {
		if (this.phase === 'clear') {
			return;
		}
		// El tramo no le saca tiempo a las oleadas: el reloj para de la segunda a la tercera.
		const timed = this.phase !== 'passage' && !(this.phase === 'interlude' && this.wave + 1 === PASSAGE_BEFORE_WAVE);
		let rate = timed ? 1 : 0;
		if (this.player.cooldown > 0) {
			rate += ENERGY_SURCHARGE.fire;
		}
		if (this.player.shielding) {
			rate += ENERGY_SURCHARGE.shield;
		}
		this.energy = Math.max(0, this.energy - (100 / this.zone.energySeconds) * rate * dt);
		if (this.energy > 0) {
			this.energyWarned = false;
			return;
		}
		if (!timed) {
			return;
		}
		if (!this.energyWarned) {
			this.energyWarned = true;
			this.events.push({ type: 'energyEmpty' });
		}
		this.damagePlayer('empty', EMPTY_ENERGY_LIFE_DRAIN * dt);
	}

	/** Todo daño pasa por acá: escudo, invulnerabilidad, blindaje y estadísticas. */
	damagePlayer(source: DamageSource, amount: number) {
		if (this.outcome !== 'playing') {
			return;
		}
		if (source !== 'empty') {
			if (this.player.invulnerable > 0) {
				return;
			}
			if (this.player.shielding) {
				this.events.push({ type: 'shieldBlock', x: this.player.x, y: this.player.y });
				return;
			}
		}
		const damage = source === 'empty' ? amount : amount * this.ship.armor;
		this.hp = Math.max(0, this.hp - damage);
		this.stats.damage[source] += damage;
		if (source !== 'empty') {
			this.player.invulnerable = INVULNERABLE_AFTER_HIT;
			this.events.push({ type: 'playerHit', source, damage });
		}
		if (this.hp <= 0) {
			this.outcome = 'lost';
			this.events.push({ type: 'playerDown', x: this.player.x, y: this.player.y });
		}
	}

	// ------------------------------------------------------------------ fases

	private updatePhase(dt: number) {
		if (this.outcome === 'lost') {
			return;
		}
		switch (this.phase) {
			case 'interlude':
				this.phaseTimer -= dt;
				if (this.phaseTimer <= 0) {
					if (this.pendingPassage && this.wave + 1 === PASSAGE_BEFORE_WAVE) {
						if (this.makeRoomForPassage()) {
							this.startPassage(this.pendingPassage);
						}
					} else if (this.wave + 1 < this.zone.waves.length) {
						this.startWave(this.wave + 1);
					} else {
						this.startBoss();
					}
				}
				break;
			case 'wave':
				this.directAttacks(dt);
				this.directStationFire(dt);
				this.directEvents(dt);
				if (!this.enemies.some((enemy) => enemy.slot && enemy.wave === this.wave)) {
					this.phase = 'interlude';
					this.phaseTimer = WAVE_INTERLUDE;
				}
				break;
			case 'passage':
				this.directPassage(dt);
				break;
			case 'bossIntro':
				this.phaseTimer -= dt;
				if (this.phaseTimer <= 0) {
					this.phase = 'boss';
				}
				break;
			case 'boss':
				this.directEvents(dt);
				break;
			case 'clear':
				this.phaseTimer -= dt;
				// La zona se cierra cuando la nave juntó lo que soltó el jefe.
				if (this.phaseTimer <= 0 && this.pickups.length === 0 && this.outcome === 'playing') {
					const bonus = Math.round(this.energy) * ZONE_CLEAR_ENERGY_BONUS + Math.round(this.hp) * ZONE_CLEAR_LIFE_BONUS;
					this.score += bonus;
					this.outcome = 'won';
					this.events.push({ type: 'zoneClear', bonus });
				}
				break;
		}
	}

	private startWave(index: number) {
		this.wave = index;
		this.phase = 'wave';
		this.formation.reset();
		const def = this.zone.waves[index];
		let count = 0;

		def.formation.forEach((line, row) => {
			const entry = ENTRY_POINTS[def.entries[row] ?? 'top'];
			// Cada fila entra después de la anterior; sus dos mitades, a la vez.
			const rowDelay = row * 1.5;
			const halves: Array<{ cols: number[]; mirror: boolean }> = [
				{ cols: [], mirror: false },
				{ cols: [], mirror: true },
			];
			[...line].forEach((char, col) => {
				if (char >= '1' && char <= '3') {
					halves[col < line.length / 2 ? 0 : 1].cols.push(col);
				}
			});

			for (const half of halves) {
				// La nave que va más adentro sale primero, así la fila llega en orden.
				const ordered = half.mirror ? half.cols : [...half.cols].reverse();
				ordered.forEach((col, order) => {
					const rank = Number(line[col]) as Rank;
					const controls = entry.map(([fx, fy]) => ({ x: (half.mirror ? 1 - fx : fx) * FIELD_W, y: fy * FIELD_H }));
					controls.push(this.formation.baseSlot(col, row));
					const spec = ENEMIES[this.zone.family][rank];
					this.enemies.push({
						id: this.nextId++,
						family: this.zone.family,
						rank,
						spec,
						hp: spec.hp,
						x: controls[0].x,
						y: controls[0].y,
						angle: 0,
						slot: { col, row },
						state: 'waiting',
						timer: rowDelay + order * 0.17,
						path: new Path(controls),
						distance: 0,
						maneuver: null,
						volleyMarks: [],
						vx: 0,
						vy: 0,
						flash: 0,
						aim: 0,
						wave: index,
					});
					count += 1;
				});
			}
		});

		this.waveSize = count;
		this.attackTimer = 1.5;
		this.stationTimer = this.zone.stationFireEvery / 2;
		this.events.push({ type: 'waveStart', wave: index + 1 });
	}

	// ----------------------------------------------------------------- tramos

	/**
	 * Lo de la oleada anterior podría tapar un hueco: lo que todavía no asomó no
	 * llega a salir y lo que está en pantalla se espera.
	 */
	private makeRoomForPassage() {
		this.cometWarnings = [];
		this.rocks = this.rocks.filter((rock) => rock.y >= -ROCK_RADIUS);
		return this.rocks.length === 0 && this.comets.length === 0;
	}

	/** Público para la Galactopedia, las capturas y los tests, que lo muestran a pedido. */
	startPassage(id: PassageId) {
		this.pendingPassage = null;
		this.passage = new Passage(id, this.random);
		this.phase = 'passage';
		if (PASSAGES[id].shield) {
			this.addShield(Math.max(0, SHIELD_CHARGE - this.player.shield));
		}
		this.events.push({ type: 'passageStart', id });
	}

	private directPassage(dt: number) {
		const passage = this.passage!;
		for (const cue of passage.advance(dt)) {
			this.spawnCue(passage, cue);
		}
		for (const freighter of this.freighters) {
			freighter.fireTimer -= dt;
			if (freighter.fireTimer > 0) {
				continue;
			}
			// Sólo la que se ve entera y se va a seguir viendo cuando termine el aviso.
			const margin = ENEMY_RADIUS + FREIGHTER.speed * STATION_AIM;
			const gunners = this.enemies.filter((enemy) => enemy.state === 'escort' && enemy.leader === freighter.id
				&& enemy.x >= margin && enemy.x <= FIELD_W - margin
				&& enemy.spec.shot && enemy.aim === 0 && this.canFireFromStation(enemy));
			if (gunners.length) {
				gunners[Math.floor(this.random() * gunners.length)].aim = STATION_AIM;
				freighter.fireTimer = this.range(FREIGHTER.fireEvery);
			}
		}

		const busy = this.freighters.length > 0 || this.strikes.length > 0 || this.rocks.some((rock) => rock.gap !== undefined);
		if (!passage.scheduleDone || busy) {
			return;
		}
		this.passage = null;
		this.phase = this.sandboxed ? 'bossIntro' : 'interlude';
		this.phaseTimer = this.sandboxed ? Infinity : WAVE_INTERLUDE;
	}

	private spawnCue(passage: Passage, cue: PassageCue) {
		switch (cue.kind) {
			case 'row':
				this.spawnRockLine(passage.row(cue.follows ?? false));
				break;
			case 'wall':
				this.spawnRockLine(passage.wall(cue.follows ?? false));
				break;
			case 'freighter':
				this.spawnFreighter(passage.convoySide);
				break;
			case 'bandsX':
				this.spawnStrikes(passage.bandsX(this.player.x));
				break;
			case 'bandsY':
				this.spawnStrikes(passage.bandsY(this.player.y, cue.max));
				break;
		}
	}

	private spawnRockLine({ points, vx, vy, gap }: RockLine) {
		for (const { x, y } of points) {
			this.rocks.push({
				id: this.nextId++,
				x,
				y,
				vx,
				vy,
				gap,
				hp: FIELD_ROCKS.hp,
				spin: (this.random() - 0.5) * 3,
				angle: this.random() * Math.PI * 2,
				frame: this.random() < 0.5 ? 1 : 2,
				flash: 0,
			});
		}
	}

	private spawnFreighter(side: 1 | -1) {
		const freighter: Freighter = {
			id: this.nextId++,
			x: side === 1 ? -FREIGHTER.startOff : FIELD_W + FREIGHTER.startOff,
			y: FREIGHTER.y,
			vx: side * FREIGHTER.speed,
			hp: FREIGHTER.hp,
			flash: 0,
			fireTimer: this.range(FREIGHTER.fireEvery),
		};
		this.freighters.push(freighter);
		const { family } = this.zone;
		const rank = FREIGHTER.escortRank;
		const spec = ENEMIES[family][rank];
		for (const offset of FREIGHTER.escorts) {
			this.enemies.push({
				id: this.nextId++,
				family,
				rank,
				spec,
				hp: spec.hp,
				x: freighter.x + offset.dx,
				y: freighter.y + offset.dy,
				angle: 0,
				slot: null,
				state: 'escort',
				timer: 0,
				path: null,
				distance: 0,
				maneuver: null,
				volleyMarks: [],
				vx: 0,
				vy: 0,
				flash: 0,
				aim: 0,
				wave: this.wave,
				leader: freighter.id,
				offset,
			});
		}
	}

	private spawnStrikes(bands: Band[]) {
		for (const band of bands) {
			this.strikes.push({ ...band, id: this.nextId++, timer: STORM.warning, resolved: false });
		}
	}

	private breakFreighter(freighter: Freighter) {
		this.score += FREIGHTER.points;
		this.stats.kills += 1;
		this.events.push({ type: 'kill', x: freighter.x, y: freighter.y, family: 'freighter', points: FREIGHTER.points, big: true });
		this.pickups.push({ id: this.nextId++, x: freighter.x, y: freighter.y, kind: 'energy', age: 0, amount: FREIGHTER.energy });
		for (const enemy of this.enemies) {
			if (enemy.state === 'escort' && enemy.leader === freighter.id) {
				this.startManeuver(enemy, 'dive');
			}
		}
	}

	/** Elige quién deja la formación. Cuantas menos naves quedan, más seguido. */
	private directAttacks(dt: number) {
		const inFormation = this.enemies.filter((enemy) => enemy.state === 'formation');
		const stillEntering = this.enemies.some((enemy) => enemy.state === 'waiting' || enemy.state === 'entering');
		if (!stillEntering && !this.formation.settled) {
			this.formation.settled = true;
		}
		if (stillEntering || inFormation.length === 0) {
			return;
		}

		this.attackTimer -= dt;
		if (this.attackTimer > 0) {
			return;
		}
		const attackers = this.enemies.filter((enemy) => enemy.slot && enemy.state !== 'formation' && enemy.state !== 'joining').length;
		const remaining = this.enemies.filter((enemy) => enemy.slot && enemy.wave === this.wave).length;
		const fullness = remaining / Math.max(1, this.waveSize);
		this.attackTimer = this.zone.attackEvery * (0.45 + 0.55 * fullness) * (0.7 + this.random() * 0.6);
		// Con pocas naves en pantalla, se permite uno más atacando: el final de la oleada no puede ser un trámite.
		if (attackers >= this.zone.maxAttackers + (fullness < 0.3 ? 1 : 0)) {
			return;
		}

		const enemy = inFormation[Math.floor(this.random() * inFormation.length)];
		this.startManeuver(enemy, this.weighted(enemy.spec.maneuvers));
	}

	/** Cada tanto, una nave estacionada destella y dispara desde su casillero. */
	private directStationFire(dt: number) {
		if (!this.formation.settled) {
			return;
		}
		this.stationTimer -= dt;
		if (this.stationTimer > 0) {
			return;
		}
		const gunners = this.enemies.filter((enemy) =>
			enemy.state === 'formation' && enemy.spec.shot && enemy.aim === 0 && this.canFireFromStation(enemy));
		if (gunners.length === 0) {
			return;
		}
		gunners[Math.floor(this.random() * gunners.length)].aim = STATION_AIM;
		this.stationTimer = this.zone.stationFireEvery * (0.7 + this.random() * 0.6);
	}

	private canFireFromStation(enemy: Enemy) {
		return this.player.y - (enemy.y + 14) >= STATION_CLEARANCE;
	}

	/** Público para la Galactopedia y las capturas, que muestran cada maniobra a pedido. */
	startManeuver(enemy: Enemy, maneuver: Maneuver) {
		enemy.maneuver = maneuver;
		enemy.aim = 0;
		if (maneuver === 'swoop') {
			const side = enemy.x < FIELD_W / 2 ? -1 : 1;
			const target = this.player.x;
			const middleY = Math.min(FIELD_H * 0.52, (enemy.y + this.player.y) / 2);
			const passY = Math.max(middleY + 30, this.player.y - 71);
			// Cuanto más adelante está la nave, antes llega el rizo y antes tiene que disparar.
			const advance = (PLAYER_Y - this.player.y) / (PLAYER_Y - PLAYER_MIN_Y);
			const hurry = 1 - 0.4 * advance;
			const clampX = (x: number) => Math.max(20, Math.min(FIELD_W - 20, x));
			const controls: Point[] = [
				{ x: enemy.x, y: enemy.y },
				{ x: clampX(enemy.x + side * 46), y: enemy.y - 34 },
				{ x: clampX(enemy.x + side * 74), y: enemy.y + 26 },
				{ x: clampX((enemy.x + target) / 2), y: middleY },
				{ x: clampX(target), y: passY },
				{ x: clampX(target - side * 70), y: FIELD_H + 60 },
			];
			enemy.path = new Path(controls);
			enemy.distance = 0;
			enemy.state = 'swoop';
			const marks = enemy.spec.volleys >= 2 ? [0.42, 0.62] : enemy.spec.volleys === 1 ? [0.5] : [];
			enemy.volleyMarks = marks.map((mark) => mark * hurry);
			return;
		}
		enemy.state = 'telegraph';
		enemy.timer = maneuver === 'planted' ? 0.35 : 0.45;
	}

	startBoss() {
		const def = BOSSES[this.zone.family];
		const hp = def.hp;
		this.boss = {
			id: this.nextId++,
			family: this.zone.family,
			def,
			hp,
			maxHp: hp,
			x: FIELD_W / 2,
			y: -70,
			vx: def.speed,
			state: 'entering',
			moveIndex: 0,
			timer: 1.2,
			burst: null,
			spiralAngle: 0,
			chargeX: 0,
			telegraph: 0,
			flash: 0,
		};
		this.phase = 'bossIntro';
		this.phaseTimer = BOSS_INTRO;
		this.events.push({ type: 'bossSpawn' });
	}

	// ---------------------------------------------------------------- enemigos

	private updateEnemies(dt: number) {
		for (const enemy of this.enemies) {
			enemy.flash = Math.max(0, enemy.flash - dt);
			this.updateEnemy(enemy, dt);
		}
		this.enemies = this.enemies.filter((enemy) => enemy.hp > 0 && enemy.y < FIELD_H + 120 && enemy.state !== 'gone');
	}

	private updateEnemy(enemy: Enemy, dt: number) {
		const speedFactor = enemy.spec.speed;
		switch (enemy.state) {
			case 'waiting':
				enemy.timer -= dt;
				if (enemy.timer <= 0) {
					enemy.state = 'entering';
				}
				break;
			case 'entering':
				this.followPath(enemy, ENTRY_SPEED * dt);
				if (enemy.distance >= enemy.path!.length) {
					enemy.state = 'joining';
				}
				break;
			case 'joining':
			case 'returning': {
				const slot = this.formation.slot(enemy.slot!.col, enemy.slot!.row);
				const speed = (enemy.state === 'joining' ? ENTRY_SPEED : RETURN_SPEED) * dt;
				const dx = slot.x - enemy.x;
				const dy = slot.y - enemy.y;
				const distance = Math.hypot(dx, dy);
				if (distance <= speed + 0.5) {
					enemy.x = slot.x;
					enemy.y = slot.y;
					enemy.state = 'formation';
					enemy.maneuver = null;
				} else {
					enemy.x += (dx / distance) * speed;
					enemy.y += (dy / distance) * speed;
					enemy.angle = turnToward(enemy.angle, Math.atan2(dy, dx) - Math.PI / 2, dt * 8);
				}
				break;
			}
			case 'formation': {
				const slot = this.formation.slot(enemy.slot!.col, enemy.slot!.row);
				enemy.x = slot.x;
				enemy.y = slot.y;
				enemy.angle = turnToward(enemy.angle, 0, dt * 8);
				this.updateAim(enemy, dt);
				break;
			}
			case 'escort': {
				const leader = this.freighters.find((freighter) => freighter.id === enemy.leader);
				if (!leader) {
					enemy.state = 'gone';
					break;
				}
				enemy.x = leader.x + enemy.offset!.dx;
				enemy.y = leader.y + enemy.offset!.dy;
				this.updateAim(enemy, dt);
				break;
			}
			case 'telegraph':
				// Un temblor corto avisa que va a tirarse.
				enemy.timer -= dt;
				enemy.angle = Math.sin(this.time * 40) * 0.25;
				if (enemy.timer <= 0) {
					if (enemy.maneuver === 'planted') {
						enemy.state = 'planting';
						enemy.vx = Math.max(40, Math.min(FIELD_W - 40, this.player.x));
						enemy.vy = this.player.y - PLANT_GAP;
					} else {
						const tx = this.player.x - enemy.x;
						// Apunta al borde de abajo, como siempre; con la nave adelantada, acorta en proporción
						// para pasarle igual de cerca. Nunca deja de bajar: si no, no saldría de la pantalla.
						const reach = enemy.y < this.player.y ? (this.player.y - enemy.y) / (PLAYER_Y - enemy.y) : 1;
						const ty = Math.max((FIELD_H + 60 - enemy.y) * reach, Math.abs(tx) * 0.5, 120);
						const length = Math.hypot(tx, ty);
						enemy.vx = (tx / length) * DIVE_SPEED * speedFactor;
						enemy.vy = (ty / length) * DIVE_SPEED * speedFactor;
						enemy.state = 'dive';
					}
				}
				break;
			case 'dive':
				enemy.x += enemy.vx * dt;
				enemy.y += enemy.vy * dt;
				enemy.angle = Math.atan2(enemy.vy, enemy.vx) - Math.PI / 2;
				if (enemy.y > FIELD_H + 40) {
					this.leaveBottom(enemy);
				}
				break;
			case 'swoop': {
				const path = enemy.path!;
				this.followPath(enemy, SWOOP_SPEED * speedFactor * dt);
				const progress = enemy.distance / path.length;
				while (enemy.volleyMarks.length && progress >= enemy.volleyMarks[0]) {
					enemy.volleyMarks.shift();
					if (enemy.spec.shot && enemy.y < this.player.y - 60) {
						this.fireEnemy(enemy.spec.shot, enemy.x, enemy.y + 14);
					}
				}
				if (enemy.distance >= path.length) {
					this.leaveBottom(enemy);
				}
				break;
			}
			case 'planting': {
				// En `vx` y `vy` quedó el lugar elegido al despegar: encima de donde estaba el jugador.
				const tx = enemy.vx;
				const ty = enemy.vy;
				const dx = tx - enemy.x;
				const dy = ty - enemy.y;
				const distance = Math.hypot(dx, dy);
				const speed = 300 * speedFactor * dt;
				enemy.angle = turnToward(enemy.angle, Math.atan2(dy, dx) - Math.PI / 2, dt * 10);
				if (distance <= speed) {
					enemy.x = tx;
					enemy.y = ty;
					enemy.state = 'planted';
					enemy.timer = PLANT_FUSE;
					enemy.angle = 0;
					this.events.push({ type: 'warning', kind: 'planted', x: enemy.x });
				} else {
					enemy.x += (dx / distance) * speed;
					enemy.y += (dy / distance) * speed;
				}
				break;
			}
			case 'planted':
				enemy.timer -= dt;
				if (enemy.timer <= 0) {
					this.explode(enemy.x, enemy.y, PLANT_RADIUS);
					enemy.hp = 0;
				}
				break;
		}
	}

	/** El destello que avisa y, al terminar, el disparo. */
	private updateAim(enemy: Enemy, dt: number) {
		if (enemy.aim <= 0) {
			return;
		}
		enemy.aim = Math.max(0, enemy.aim - dt);
		// Se vuelve a mirar la distancia: la nave pudo acercarse durante el aviso.
		if (enemy.aim === 0 && this.outcome === 'playing' && enemy.spec.shot && this.canFireFromStation(enemy)) {
			this.fireEnemy(enemy.spec.shot, enemy.x, enemy.y + 14);
		}
	}

	private followPath(enemy: Enemy, advance: number) {
		enemy.distance += advance;
		const point = enemy.path!.at(enemy.distance);
		enemy.x = point.x;
		enemy.y = point.y;
		enemy.angle = point.heading - Math.PI / 2;
	}

	/** Al salir por abajo, vuelve por arriba a su casillero o se va para siempre. */
	private leaveBottom(enemy: Enemy) {
		if (enemy.slot && enemy.maneuver !== 'dive') {
			const slot = this.formation.slot(enemy.slot.col, enemy.slot.row);
			enemy.x = slot.x;
			enemy.y = -30;
			enemy.angle = 0;
			enemy.state = 'returning';
			return;
		}
		enemy.state = 'gone';
	}

	private explode(x: number, y: number, radius: number) {
		this.events.push({ type: 'blast', x, y, radius });
		if (Math.hypot(this.player.x - x, this.player.y - y) < radius + PLAYER_RADIUS) {
			this.damagePlayer('blast', DAMAGE.blast);
		}
	}

	/** Una salva: el patrón decide cuántos disparos, hacia dónde y de qué estilo. */
	fireEnemy(kind: ShotKind, x: number, y: number, speedScale = 1) {
		const spec = SHOTS[kind];
		let base = 90 * DEG;
		if (spec.aimed) {
			const aim = Math.atan2(this.player.y - y, this.player.x - x);
			const limit = MAX_AIM_DEGREES * DEG;
			base = 90 * DEG + Math.max(-limit, Math.min(limit, aim - 90 * DEG));
		}
		const damage = spec.style === 'helix' ? DAMAGE.helix : spec.style === 'fan' ? DAMAGE.fan : DAMAGE.bolt;

		spec.angles.forEach((angle, index) => {
			const direction = base + angle * DEG;
			const offset = spec.offsets?.[index] ?? 0;
			const speed = spec.speed * speedScale;
			this.bullets.push({
				id: this.nextId++,
				x: x + offset,
				y,
				vx: Math.cos(direction) * speed,
				vy: Math.sin(direction) * speed,
				style: spec.style,
				damage,
				age: 0,
				cx: x + offset,
				cy: y,
				// Los dos del helicoide salen en contrafase: uno a cada lado del centro.
				phase: spec.style === 'helix' ? index * Math.PI : 0,
			});
		});
		this.events.push({ type: 'enemyShot', x, y });
	}

	/** Escoltas sin casillero: se tiran en picada y no vuelven. */
	private spawnDivers(family: Family, rank: Rank | 0, count: number, x: number, y: number) {
		const spec = rank === 0 ? SHARD : ENEMIES[family][rank];
		for (let index = 0; index < count; index += 1) {
			const offset = (index - (count - 1) / 2) * 30;
			this.enemies.push({
				id: this.nextId++,
				family,
				rank,
				spec,
				hp: spec.hp,
				x: Math.max(20, Math.min(FIELD_W - 20, x + offset)),
				y,
				angle: 0,
				slot: null,
				state: 'telegraph',
				timer: 0.35 + index * 0.18,
				path: null,
				distance: 0,
				maneuver: 'dive',
				volleyMarks: [],
				vx: 0,
				vy: 0,
				flash: 0,
				aim: 0,
				wave: this.wave,
			});
		}
	}

	// -------------------------------------------------------------------- jefe

	private updateBoss(dt: number) {
		const boss = this.boss;
		if (!boss) {
			return;
		}
		boss.flash = Math.max(0, boss.flash - dt);
		const enraged = boss.hp < boss.maxHp / 2;
		const home = 112;

		switch (boss.state) {
			case 'entering':
				boss.y += 60 * dt;
				if (boss.y >= home) {
					boss.y = home;
					boss.state = 'fighting';
				}
				return;
			case 'fighting':
				boss.x += boss.vx * (enraged ? 1.35 : 1) * dt;
				if (boss.x < 90 || boss.x > FIELD_W - 90) {
					boss.x = Math.max(90, Math.min(FIELD_W - 90, boss.x));
					boss.vx = -boss.vx;
				}
				boss.y = home + Math.sin(this.time * 1.3) * 10;
				break;
			case 'charging':
				if (boss.telegraph > 0) {
					boss.telegraph -= dt;
					boss.x += Math.sin(this.time * 50) * 1.5;
					return;
				}
				boss.x += Math.sign(boss.chargeX - boss.x) * Math.min(Math.abs(boss.chargeX - boss.x), 240 * dt);
				boss.y += 330 * dt;
				if (boss.y >= PLAYER_Y - 30) {
					boss.state = 'rising';
				}
				return;
			case 'rising':
				boss.y -= 200 * dt;
				if (boss.y <= home) {
					boss.y = home;
					boss.state = 'fighting';
				}
				return;
		}

		if (this.outcome !== 'playing' || this.phase !== 'boss') {
			return;
		}

		if (boss.burst) {
			boss.burst.timer -= dt;
			while (boss.burst && boss.burst.timer <= 0) {
				this.bossBurstShot(boss, boss.burst.move);
				boss.burst.left -= 1;
				boss.burst.timer += boss.burst.every;
				if (boss.burst.left <= 0) {
					boss.burst = null;
				}
			}
			return;
		}

		boss.timer -= dt;
		if (boss.timer > 0) {
			return;
		}
		const move = boss.def.cycle[boss.moveIndex % boss.def.cycle.length];
		boss.moveIndex += 1;
		boss.timer = boss.def.pause * (enraged ? 0.65 : 1);
		this.startBossMove(boss, move, enraged);
	}

	private startBossMove(boss: Boss, move: BossMove, enraged: boolean) {
		switch (move) {
			case 'fan':
				boss.burst = { move, left: enraged ? 3 : 2, every: 0.32, timer: 0 };
				break;
			case 'helix':
				boss.burst = { move, left: enraged ? 4 : 3, every: 0.34, timer: 0 };
				break;
			case 'spiral':
				boss.burst = { move, left: enraged ? 26 : 18, every: 0.07, timer: 0 };
				break;
			case 'summon': {
				const rank: Rank = enraged ? 2 : 1;
				this.spawnDivers(boss.family, rank, enraged ? 4 : 3, boss.x, boss.y + 52);
				break;
			}
			case 'charge':
				boss.state = 'charging';
				boss.telegraph = 0.7;
				boss.chargeX = this.player.x;
				this.events.push({ type: 'warning', kind: 'charge', x: this.player.x });
				break;
		}
	}

	private bossBurstShot(boss: Boss, move: BossMove) {
		const muzzleY = boss.y + 36;
		if (move === 'fan') {
			const aim = Math.atan2(this.player.y - muzzleY, this.player.x - boss.x);
			for (let index = -3; index <= 3; index += 1) {
				this.pushBullet(boss.x, muzzleY, aim + index * 12 * DEG, 200, 'fan', DAMAGE.fan);
			}
			this.events.push({ type: 'enemyShot', x: boss.x, y: muzzleY });
		} else if (move === 'helix') {
			this.fireEnemy('helix', boss.x - 22, muzzleY, 1.1);
			this.fireEnemy('helix', boss.x + 22, muzzleY, 1.1);
		} else if (move === 'spiral') {
			boss.spiralAngle += 23 * DEG;
			for (const offset of [0, Math.PI]) {
				this.pushBullet(boss.x, boss.y, boss.spiralAngle + offset, 170, 'bolt', DAMAGE.bolt);
			}
		}
	}

	private pushBullet(x: number, y: number, direction: number, speed: number, style: BulletStyle, damage: number) {
		this.bullets.push({
			id: this.nextId++,
			x,
			y,
			vx: Math.cos(direction) * speed,
			vy: Math.sin(direction) * speed,
			style,
			damage,
			age: 0,
			cx: x,
			cy: y,
			phase: 0,
		});
	}

	// ----------------------------------------------------------------- disparos

	private updateBullets(dt: number) {
		const spawned: Bullet[] = [];
		for (const bullet of this.bullets) {
			bullet.age += dt;
			bullet.cx += bullet.vx * dt;
			bullet.cy += bullet.vy * dt;
			if (bullet.style === 'helix') {
				// Se corre de un lado al otro del centro, sobre la perpendicular al avance.
				const length = Math.hypot(bullet.vx, bullet.vy) || 1;
				const swing = Math.sin(bullet.age * HELIX_FREQUENCY + bullet.phase) * HELIX_AMPLITUDE * Math.min(1, bullet.age * 4);
				bullet.x = bullet.cx + (-bullet.vy / length) * swing;
				bullet.y = bullet.cy + (bullet.vx / length) * swing;
			} else {
				bullet.x = bullet.cx;
				bullet.y = bullet.cy;
			}
			if (bullet.style === 'split' && bullet.age >= SPLIT_AFTER) {
				const heading = Math.atan2(bullet.vy, bullet.vx);
				const speed = Math.hypot(bullet.vx, bullet.vy) * 1.1;
				for (const side of [-1, 1]) {
					spawned.push({
						...bullet,
						id: this.nextId++,
						vx: Math.cos(heading + side * SPLIT_ANGLE * DEG) * speed,
						vy: Math.sin(heading + side * SPLIT_ANGLE * DEG) * speed,
						style: 'fan',
						damage: DAMAGE.fan,
						age: 0,
					});
				}
				bullet.age = -Infinity;
			}
		}
		this.bullets = [...this.bullets, ...spawned].filter((bullet) =>
			bullet.age !== -Infinity && bullet.x > -30 && bullet.x < FIELD_W + 30 && bullet.y > -40 && bullet.y < FIELD_H + 30);
	}

	private updateShots(dt: number) {
		for (const shot of this.shots) {
			shot.x += shot.vx * dt;
			shot.y += shot.vy * dt;
		}
		this.shots = this.shots.filter((shot) => shot.y > -20 && shot.x > -20 && shot.x < FIELD_W + 20);
	}

	// ----------------------------------------------------------------- eventos

	private directEvents(dt: number) {
		if (!this.randomEvents) {
			return;
		}
		this.eventTimer -= dt;
		if (this.eventTimer > 0) {
			return;
		}
		this.eventTimer = this.range(this.zone.eventEvery);
		this.startEvent(this.weighted(this.zone.events));
	}

	/** Público para que las capturas puedan provocar un evento sin esperarlo. */
	startEvent(kind: EventKind) {
		if (kind === 'pod') {
			const fromLeft = this.random() < 0.5;
			this.pods.push({
				id: this.nextId++,
				x: fromLeft ? -30 : FIELD_W + 30,
				// Por encima de lo más adelante que llega la nave: al abrirse no le cae encima.
				y: 170 + this.random() * 85,
				vx: (fromLeft ? 1 : -1) * (60 + this.random() * 25),
				hp: 4,
				flash: 0,
			});
			this.events.push({ type: 'warning', kind: 'pod', x: fromLeft ? 0 : FIELD_W });
		} else if (kind === 'asteroids') {
			const count = 3 + Math.floor(this.random() * 3);
			for (let index = 0; index < count; index += 1) {
				this.rocks.push({
					id: this.nextId++,
					x: 40 + this.random() * (FIELD_W - 80),
					y: -30 - index * 70 - this.random() * 40,
					vx: (this.random() - 0.5) * 60,
					vy: 70 + this.random() * 50,
					hp: 3,
					spin: (this.random() - 0.5) * 3,
					angle: this.random() * Math.PI * 2,
					frame: this.random() < 0.5 ? 1 : 2,
					flash: 0,
				});
			}
			this.events.push({ type: 'warning', kind: 'asteroids', x: FIELD_W / 2 });
		} else {
			// La lluvia se anuncia: marcas arriba en la línea por donde va a pasar cada cometa.
			const direction = this.random() < 0.5 ? -1 : 1;
			const count = 7;
			for (let index = 0; index < count; index += 1) {
				this.cometWarnings.push({
					x: 40 + this.random() * (FIELD_W - 80),
					vx: direction * (110 + this.random() * 40),
					timer: 1.2,
					delay: index * 0.16,
				});
			}
			this.events.push({ type: 'warning', kind: 'comets', x: FIELD_W / 2 });
		}
	}

	private updateHazards(dt: number) {
		for (const pod of this.pods) {
			pod.x += pod.vx * dt;
			pod.flash = Math.max(0, pod.flash - dt);
		}
		this.pods = this.pods.filter((pod) => pod.hp > 0 && pod.x > -60 && pod.x < FIELD_W + 60);

		for (const rock of this.rocks) {
			rock.x += rock.vx * dt;
			rock.y += rock.vy * dt;
			rock.angle += rock.spin * dt;
			rock.flash = Math.max(0, rock.flash - dt);
		}
		this.rocks = this.rocks.filter((rock) => rock.hp > 0 && rock.y < FIELD_H + 40
			// Los muros se van por el costado, del lado hacia el que viajan.
			&& (rock.gap === undefined || rock.vx === 0 || (rock.vx > 0 ? rock.x < FIELD_W + 40 : rock.x > -40)));

		for (const freighter of this.freighters) {
			freighter.x += freighter.vx * dt;
			freighter.flash = Math.max(0, freighter.flash - dt);
		}
		this.freighters = this.freighters.filter((freighter) => freighter.hp > 0
			&& (freighter.vx > 0 ? freighter.x < FIELD_W + FREIGHTER.startOff : freighter.x > -FREIGHTER.startOff));

		let striking = false;
		for (const strike of this.strikes) {
			striking ||= strike.timer > 0 && strike.timer <= dt;
			strike.timer -= dt;
		}
		if (striking) {
			this.events.push({ type: 'strike' });
		}
		this.strikes = this.strikes.filter((strike) => strike.timer > -STORM.active);

		for (const warning of this.cometWarnings) {
			warning.timer -= dt;
			if (warning.timer + warning.delay <= 0) {
				// El cometa sale de arriba en la línea marcada, con una pendiente fija.
				this.comets.push({ x: warning.x, y: -20, vx: warning.vx, vy: 440 });
				warning.timer = -Infinity;
			}
		}
		this.cometWarnings = this.cometWarnings.filter((warning) => warning.timer !== -Infinity);

		for (const comet of this.comets) {
			comet.x += comet.vx * dt;
			comet.y += comet.vy * dt;
		}
		this.comets = this.comets.filter((comet) => comet.y < FIELD_H + 40);
	}

	private updatePickups(dt: number) {
		for (const pickup of this.pickups) {
			pickup.age += dt;
			if (this.phase === 'clear' && this.outcome === 'playing') {
				// Vencido el jefe, lo que queda en pantalla vuela hacia la nave: el premio
				// no puede depender de alcanzarlo antes de que termine la zona.
				const dx = this.player.x - pickup.x;
				const dy = this.player.y - pickup.y;
				const distance = Math.hypot(dx, dy) || 1;
				const speed = Math.min(520, 120 + pickup.age * 260) * dt;
				pickup.x += (dx / distance) * Math.min(speed, distance);
				pickup.y += (dy / distance) * Math.min(speed, distance);
				continue;
			}
			pickup.y += PICKUP_FALL_SPEED * dt;
		}
		this.pickups = this.pickups.filter((pickup) => pickup.y < FIELD_H + 20);
	}

	private drop(table: keyof typeof DROP_TABLES, x: number, y: number) {
		this.pickups.push({ id: this.nextId++, x, y, kind: this.weighted(DROP_TABLES[table]), age: 0 });
	}

	private collect(pickup: Pickup) {
		this.stats.pickups[pickup.kind] += 1;
		this.events.push({ type: 'pickup', kind: pickup.kind, x: pickup.x, y: pickup.y });
		switch (pickup.kind) {
			case 'life':
				this.hp = Math.min(100, this.hp + PICKUP_LIFE);
				break;
			case 'energy':
				this.gainEnergy(pickup.amount ?? PICKUP_ENERGY);
				break;
			case 'core': {
				this.cores += 1;
				const stage = stageForCores(this.cores);
				if (stage > this.stage) {
					this.stage = stage;
					this.events.push({ type: 'evolve', stage });
				}
				break;
			}
			case 'shield':
				this.addShield(SHIELD_CHARGE);
				break;
			default:
				this.player[pickup.kind] = POWER_UP_SECONDS[pickup.kind];
		}
	}

	private gainEnergy(amount: number) {
		this.energy = Math.min(100, this.energy + amount);
	}

	private addShield(seconds: number) {
		this.player.shield = Math.min(SHIELD_CAPACITY, this.player.shield + seconds);
	}

	// ---------------------------------------------------------------- choques

	private collide() {
		const player = this.player;

		for (const shot of this.shots) {
			if (shot.y < -10) {
				continue;
			}
			this.hitWithShot(shot);
		}
		this.shots = this.shots.filter((shot) => shot.y > -10);

		// Las rocas tapan los disparos de los dos lados.
		for (const bullet of this.bullets) {
			if (this.rocks.some((rock) => near(rock, bullet, ROCK_RADIUS))) {
				bullet.y = Infinity;
			}
		}

		for (const bullet of this.bullets) {
			if (near(player, bullet, PLAYER_RADIUS + BULLET_RADIUS)) {
				this.damagePlayer(bullet.style === 'helix' ? 'helix' : bullet.style === 'fan' ? 'fan' : 'bolt', bullet.damage);
				bullet.y = Infinity;
			}
		}
		this.bullets = this.bullets.filter((bullet) => bullet.y !== Infinity);

		for (const enemy of this.enemies) {
			if (enemy.state === 'waiting' || enemy.hp <= 0) {
				continue;
			}
			if (near(player, enemy, PLAYER_RADIUS + radiusOf(enemy))) {
				this.damagePlayer('ram', DAMAGE.ram);
				this.killEnemy(enemy, false);
			}
		}

		const boss = this.boss;
		if (boss && boss.state !== 'entering' && near(player, boss, PLAYER_RADIUS + BOSS_RADIUS - 6)) {
			this.damagePlayer('ram', DAMAGE.ram);
		}

		for (const rock of this.rocks) {
			if (near(player, rock, PLAYER_RADIUS + ROCK_RADIUS - 4)) {
				this.damagePlayer('rock', DAMAGE.rock);
				rock.hp = 0;
				this.events.push({ type: 'kill', x: rock.x, y: rock.y, family: 'rock', points: 0, big: false });
			}
		}

		for (const comet of this.comets) {
			if (near(player, comet, PLAYER_RADIUS + 7)) {
				this.damagePlayer('comet', DAMAGE.comet);
			}
		}

		for (const strike of this.strikes) {
			const at = strike.axis === 'x' ? player.x : player.y;
			if (strike.resolved || strike.timer > 0 || at <= strike.from - PLAYER_RADIUS || at >= strike.to + PLAYER_RADIUS) {
				continue;
			}
			// El bloqueo se mira antes que el parpadeo: cubrirse paga aunque venga de recibir un golpe.
			if (player.shielding) {
				strike.resolved = true;
				this.gainEnergy(STORM.gain);
				this.events.push({ type: 'stormBlock', x: player.x, y: player.y, amount: STORM.gain });
			} else if (player.invulnerable <= 0) {
				strike.resolved = true;
				this.damagePlayer('storm', DAMAGE.storm);
			}
		}

		for (const pickup of this.pickups) {
			if (near(player, pickup, PICKUP_RADIUS)) {
				this.collect(pickup);
				pickup.y = Infinity;
			}
		}
		this.pickups = this.pickups.filter((pickup) => pickup.y !== Infinity);
	}

	private hitWithShot(shot: Shot) {
		const spent = () => {
			if (!shot.pierce) {
				shot.y = -100;
			}
		};

		for (const rock of this.rocks) {
			if (near(rock, shot, ROCK_RADIUS)) {
				rock.hp -= 1;
				rock.flash = 0.08;
				shot.y = -100;
				if (rock.hp <= 0) {
					const inField = rock.gap !== undefined;
					const points = inField ? FIELD_ROCKS.points : 30;
					this.score += points;
					this.events.push({ type: 'kill', x: rock.x, y: rock.y, family: 'rock', points, big: false });
					// Las de un tramo no sueltan nada: son cientos, y romperlas ya abre camino.
					if (!inField && this.random() < 0.2) {
						this.drop('rock', rock.x, rock.y);
					}
				} else {
					this.events.push({ type: 'hit', x: shot.x, y: shot.y });
				}
				return;
			}
		}

		for (const freighter of this.freighters) {
			const dx = shot.x - freighter.x;
			if (freighter.hp <= 0 || Math.abs(dx) > FREIGHTER.halfWidth || Math.abs(shot.y - freighter.y) > FREIGHTER.halfHeight) {
				continue;
			}
			if (Math.abs(dx) <= FREIGHTER.hatch) {
				freighter.hp -= 1;
				freighter.flash = 0.08;
				if (freighter.hp <= 0) {
					this.breakFreighter(freighter);
					this.freighters = this.freighters.filter((other) => other !== freighter);
				} else {
					this.events.push({ type: 'hit', x: shot.x, y: shot.y });
				}
			} else {
				this.events.push({ type: 'deflect', x: shot.x, y: shot.y });
			}
			// El casco frena también a los que atraviesan.
			shot.y = -100;
			return;
		}

		for (const enemy of this.enemies) {
			if (enemy.state === 'waiting' || enemy.hp <= 0 || shot.hits.includes(enemy.id)) {
				continue;
			}
			if (near(enemy, shot, radiusOf(enemy))) {
				shot.hits.push(enemy.id);
				enemy.hp -= 1;
				enemy.flash = 0.08;
				if (enemy.hp <= 0) {
					this.killEnemy(enemy, true);
				} else {
					this.events.push({ type: 'hit', x: shot.x, y: shot.y });
				}
				spent();
				if (!shot.pierce) {
					return;
				}
			}
		}

		const boss = this.boss;
		if (boss && boss.state !== 'entering' && !shot.hits.includes(boss.id) && hitsBoss(boss, shot)) {
			shot.hits.push(boss.id);
			boss.hp -= 1;
			boss.flash = 0.06;
			this.events.push({ type: 'hit', x: shot.x, y: shot.y });
			spent();
			if (boss.hp <= 0) {
				this.killBoss(boss);
			}
			if (!shot.pierce) {
				return;
			}
		}

		for (const pod of this.pods) {
			if (pod.hp > 0 && near(pod, shot, POD_RADIUS)) {
				pod.hp -= 1;
				pod.flash = 0.08;
				shot.y = -100;
				if (pod.hp <= 0) {
					this.openPod(pod);
				} else {
					this.events.push({ type: 'hit', x: shot.x, y: shot.y });
				}
				return;
			}
		}
	}

	private killEnemy(enemy: Enemy, byShot: boolean) {
		enemy.hp = 0;
		// Derribarla fuera de la formación vale el doble: es la que está atacando.
		const attacking = enemy.state !== 'formation' && enemy.state !== 'waiting';
		const points = byShot ? enemy.spec.points * (attacking ? 2 : 1) : enemy.spec.points;
		this.score += points;
		this.stats.kills += 1;
		this.events.push({ type: 'kill', x: enemy.x, y: enemy.y, family: enemy.family, points, big: enemy.rank === 3 });
		if (enemy.spec.shards) {
			this.spawnDivers(enemy.family, 0, enemy.spec.shards, enemy.x, enemy.y);
		}
		if (this.random() < enemy.spec.drop) {
			this.drop('enemy', enemy.x, enemy.y);
		}
	}

	killBoss(boss: Boss) {
		this.score += boss.def.points;
		this.stats.kills += 1;
		this.events.push({ type: 'bossDown', x: boss.x, y: boss.y, points: boss.def.points });
		this.boss = null;
		this.bullets = [];
		// Premios que se llevan a la zona siguiente: la vida se arrastra y el núcleo también.
		// Energía no, porque al entrar a otra zona se llena igual.
		this.pickups.push({ id: this.nextId++, x: boss.x - 30, y: boss.y, kind: 'life', age: 0 });
		this.pickups.push({ id: this.nextId++, x: boss.x + 30, y: boss.y, kind: 'core', age: 0 });
		this.phase = 'clear';
		this.phaseTimer = CLEAR_DELAY;
	}

	private openPod(pod: Pod) {
		this.stats.podsOpened += 1;
		this.score += 100;
		// Un pod es una apuesta: o trae una recarga, o naves que se tiran encima.
		const ships = this.random() < 0.45;
		this.events.push({ type: 'podOpened', x: pod.x, y: pod.y, ships });
		this.events.push({ type: 'kill', x: pod.x, y: pod.y, family: 'pod', points: 100, big: true });
		if (ships) {
			this.spawnDivers(this.zone.family, 1, 3, pod.x, pod.y);
		} else {
			this.drop('pod', pod.x, pod.y);
		}
	}

	// ---------------------------------------------------------------- ayudas

	private weighted<T>(options: Array<[T, number]>): T {
		const total = options.reduce((sum, [, weight]) => sum + weight, 0);
		let roll = this.random() * total;
		for (const [option, weight] of options) {
			roll -= weight;
			if (roll < 0) {
				return option;
			}
		}
		return options[options.length - 1][0];
	}

	private range([min, max]: readonly [number, number]) {
		return min + this.random() * (max - min);
	}
}

export function stageForCores(cores: number) {
	let stage = 0;
	EVOLUTION_CORES.forEach((needed, index) => {
		if (cores >= needed) {
			stage = index;
		}
	});
	return stage;
}

function near(a: { x: number; y: number }, b: { x: number; y: number }, distance: number) {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	return dx * dx + dy * dy < distance * distance;
}

/** El jefe es ancho: se le pega en una caja del ancho del sprite, no en un círculo. */
function hitsBoss(boss: Boss, point: { x: number; y: number }) {
	return Math.abs(point.x - boss.x) < BOSS_RADIUS + 6 && Math.abs(point.y - boss.y) < BOSS_RADIUS - 4;
}

function radiusOf(enemy: Enemy) {
	return enemy.rank === 0 ? SHARD_RADIUS : ENEMY_RADIUS;
}

/** Gira de a poco hacia un ángulo, por el camino más corto. */
function turnToward(current: number, target: number, maxStep: number) {
	let delta = target - current;
	while (delta > Math.PI) delta -= Math.PI * 2;
	while (delta < -Math.PI) delta += Math.PI * 2;
	return current + Math.max(-maxStep, Math.min(maxStep, delta));
}
