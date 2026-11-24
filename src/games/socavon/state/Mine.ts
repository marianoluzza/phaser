import {
	ALARM_TIME, BARROW_CAPACITY, BELL_RING, CART, GRIP, GUARD, NOISE, PICK_COOLDOWN, PICK_HITS, PLAYER, REACH, SCORE,
} from '../constants/tuning';
import { canSee, investigateAt, isWitness, playerLit, updateGuard } from './guardBrain';
import { footing, railRange, type Level, type Node } from './level';
import { hashText, seededRandom } from './rng';
import type { Run } from './run';

export type MineInput = {
	x: number;
	y: number;
	/** Los tres botones llegan una sola vez por pulsación. */
	use: boolean;
	lamp: boolean;
	headlamp: boolean;
};

export type Hands = null | 'bag' | 'pick' | 'barrow';
export type Item = { kind: 'bag' | 'pick'; x: number; y: number };
/** `facing`: para dónde quedó la rueda la última vez que se la soltó. */
export type Barrow = { x: number; y: number; load: number; facing: number };
export type Cart = { x: number; y: number; from: number; to: number; direction: number; waitFor: number };
export type GuardMode = 'patrol' | 'investigate' | 'search' | 'chase' | 'stunned';

export type Guard = {
	home: Node;
	x: number;
	y: number;
	facing: number;
	hasKey: boolean;
	mode: GuardMode;
	/** Pausa de la patrulla. */
	waitFor: number;
	timer: number;
	noticed: number;
	/** Cuánto lleva mirando a alguien al que no puede llegar. */
	staring: number;
	/** Desistió: por un rato no se fija. */
	ignoreFor: number;
	/** Se está levantando de un atropello. */
	shakenFor: number;
	/** Lo perseguía y lo vio subir a la vagoneta. Vale mientras lo siga persiguiendo. */
	sawBoard: boolean;
	route: Node[];
	goal: Node | null;
	moving: boolean;
};

export type MineEvent =
	| { type: 'noise'; x: number; y: number; radius: number }
	| { type: 'score'; x: number; y: number; points: number }
	| {
		type:
			| 'take' | 'drop' | 'deliver' | 'load' | 'key' | 'vault' | 'silence' | 'hit' | 'wallBroken'
			| 'lamp' | 'relight' | 'hide' | 'land' | 'locked' | 'spotted' | 'stunned' | 'cartStart'
			| 'grip' | 'slip' | 'board' | 'alight' | 'ring'
			| 'lifeLost' | 'respawn' | 'cleared' | 'over';
		x: number;
		y: number;
	};

type Player = {
	x: number;
	y: number;
	facing: number;
	/** `hang` cruza un pozo; `grip` espera sobre un riel y `drop` es soltarse de ahí. */
	state: 'walk' | 'climb' | 'hang' | 'fall' | 'grip' | 'drop' | 'ride';
	/** Extremo hacia el que sube o baja. */
	climbTo: number | null;
	ladderTop: number;
	fallTo: number;
	dropFor: number;
	/** Segundos de agarre que le quedan. */
	stamina: number;
	cart: Cart | null;
	hands: Hands;
	barrow: Barrow | null;
	/** Bolsas en la carretilla que empuja. */
	load: number;
	keys: number;
	hidden: boolean;
	headlamp: boolean;
	moving: boolean;
	stun: number;
	cooldown: number;
	invincible: number;
};

/**
 * Lo que haría el botón de acción en este momento. La pantalla lo muestra y
 * `act` lo ejecuta: así la ayuda nunca dice una cosa y el botón hace otra.
 */
export type Action =
	| { kind: 'pocket'; guard: Guard }
	| { kind: 'vault'; vault: { x: number; y: number; open: boolean } }
	| { kind: 'silence' }
	| { kind: 'ring'; bell: Node }
	| { kind: 'deliver' }
	| { kind: 'load'; barrow: Barrow }
	| { kind: 'hit'; wall: { x: number; y: number; hits: number } }
	| { kind: 'take'; item: Item }
	| { kind: 'push'; barrow: Barrow }
	| { kind: 'release' }
	| { kind: 'drop' }
	| { kind: 'board'; cart: Cart }
	| { kind: 'alight'; cart: Cart }
	| { kind: 'locked' };

/** Estado completo de una mina. No conoce a Phaser. */
export class Mine {
	readonly level: Level;
	readonly player: Player;
	readonly guards: Guard[];
	readonly items: Item[];
	readonly barrows: Barrow[];
	readonly walls: { x: number; y: number; hits: number }[];
	readonly vaults: { x: number; y: number; open: boolean }[];
	readonly lamps: { x: number; y: number; lit: boolean; offSince: number }[];
	readonly bells: Node[];
	readonly exits: Node[];
	readonly carts: Cart[];
	readonly total: number;
	readonly random: () => number;

	status: 'playing' | 'dying' | 'cleared' | 'over' = 'playing';
	delivered = 0;
	score: number;
	lives: number;
	alarm = 0;
	time = 0;
	/** Si algún sereno lo llegó a ver: anula el premio al sigilo. */
	seen = false;

	private readonly threats: boolean;
	private events: MineEvent[] = [];
	private deathTimer = 0;
	private barrowNoise = 0;

	/** `threats: false` deja quietos a serenos y vagonetas: lo usa el piloto. */
	constructor(level: Level, run: Pick<Run, 'score' | 'lives'>, options: { threats?: boolean } = {}) {
		this.level = level;
		this.threats = options.threats ?? true;
		this.score = run.score;
		this.lives = run.lives;
		this.random = seededRandom(hashText(level.rows.join('\n')));

		this.items = [
			...level.find('$').map((node): Item => ({ kind: 'bag', ...node })),
			...level.find('T').map((node): Item => ({ kind: 'pick', ...node })),
		];
		this.barrows = level.find('W').map((node) => ({ ...node, load: 0, facing: 1 }));
		this.walls = level.find('%').map((node) => ({ ...node, hits: 0 }));
		this.vaults = level.find('V').map((node) => ({ ...node, open: false }));
		this.lamps = level.find('l').map((node) => ({ ...node, lit: true, offSince: 0 }));
		this.bells = level.find('B');
		this.exits = level.find('E');
		this.carts = level.find('C').map((node) => {
			const [from, to] = railRange(level, node);
			return { ...node, from, to, direction: node.x - from > to - node.x ? -1 : 1, waitFor: CART.wait };
		});
		this.guards = [...level.find('K'), ...level.find('G')].map((home): Guard => ({
			home,
			x: home.x,
			y: home.y,
			facing: this.random() < 0.5 ? -1 : 1,
			hasKey: level.at(home.x, home.y) === 'K',
			mode: 'patrol',
			waitFor: 0,
			timer: 0,
			noticed: 0,
			staring: 0,
			ignoreFor: 0,
			shakenFor: 0,
			sawBoard: false,
			route: [],
			goal: null,
			moving: false,
		}));
		this.total = level.find('$').length + this.vaults.length * 2;

		this.player = {
			x: level.start.x,
			y: level.start.y,
			facing: 1,
			state: 'walk',
			climbTo: null,
			ladderTop: 0,
			fallTo: 0,
			dropFor: 0,
			stamina: GRIP.time,
			cart: null,
			hands: null,
			barrow: null,
			load: 0,
			keys: 0,
			hidden: false,
			headlamp: true,
			moving: false,
			stun: 0,
			cooldown: 0,
			invincible: 0,
		};
	}

	/** Avanza el tiempo y devuelve lo que pasó, para sonidos y efectos. */
	step(dt: number, input: MineInput): MineEvent[] {
		this.events = [];
		if (this.status === 'dying') {
			this.deathTimer -= dt;
			if (this.deathTimer <= 0) this.afterDeath();
		} else if (this.status === 'playing') {
			this.time += dt;
			this.alarm = Math.max(0, this.alarm - dt);
			const { player } = this;
			player.invincible = Math.max(0, player.invincible - dt);
			player.cooldown = Math.max(0, player.cooldown - dt);

			if (input.headlamp) {
				player.headlamp = !player.headlamp;
				this.emit({ type: 'lamp', x: player.x, y: player.y });
			}
			if (input.lamp) this.toggleLamp();
			if (input.use) this.act();
			this.movePlayer(dt, input);

			if (this.threats && this.status === 'playing') {
				for (const guard of this.guards) updateGuard(this, guard, dt);
				this.moveCarts(dt);
				this.checkCatch();
			}
		}
		return this.events;
	}

	emit(event: MineEvent) {
		this.events.push(event);
	}

	readonly isOpen = (x: number, y: number) => (
		this.walls.some((wall) => wall.x === x && wall.y === y && wall.hits >= PICK_HITS)
	);

	isSolid(x: number, y: number) {
		const symbol = this.level.at(x, y);
		return symbol === '#' || (symbol === '%' && !this.isOpen(x, y));
	}

	/** Si hay línea de vista entre dos puntos de una galería. */
	clearBetween(a: number, b: number, y: number) {
		for (let x = Math.round(Math.min(a, b)); x <= Math.round(Math.max(a, b)); x += 1) {
			if (this.isSolid(x, y)) return false;
		}
		return true;
	}

	action(): Action | null {
		const { player } = this;
		const { cart } = player;
		if (player.state === 'ride') return cart && cart.waitFor > 0 ? { kind: 'alight', cart } : null;
		if (player.state !== 'walk' || player.hidden || player.stun > 0) return null;
		const near = (thing: Node, reach: number) => thing.y === player.y && Math.abs(thing.x - player.x) <= reach;

		if (player.hands !== 'barrow') {
			const guard = this.guards.find((other) => (
				other.hasKey && other.mode !== 'chase' && near(other, REACH.pocket)
				&& (other.mode === 'stunned' || (player.x - other.x) * other.facing <= 0)
				&& this.clearBetween(other.x, player.x, player.y)
			));
			if (guard) return { kind: 'pocket', guard };
		}
		const closedVault = this.vaults.find((vault) => !vault.open && near(vault, REACH.vault));
		if (closedVault && player.keys > 0) return { kind: 'vault', vault: closedVault };
		if (this.alarm > 0 && this.bells.some((bell) => near(bell, REACH.bell))) return { kind: 'silence' };

		const loaded = player.hands === 'bag' || (player.hands === 'barrow' && player.load > 0);
		if (loaded && this.exits.some((exit) => near(exit, REACH.exit))) return { kind: 'deliver' };
		// Subir le gana a soltar, pero no a lo que quedó tirado ahí: no se podría recuperar.
		const stopped = this.carts.find((other) => other.waitFor > 0 && near(other, CART.board));
		const board: Action | null = stopped ? { kind: 'board', cart: stopped } : null;
		if (player.hands === 'bag') {
			const barrow = this.barrows.find((other) => other.load < BARROW_CAPACITY && near(other, REACH.barrow));
			return barrow ? { kind: 'load', barrow } : board ?? { kind: 'drop' };
		}
		if (player.hands === 'barrow') return { kind: 'release' };
		if (player.hands === 'pick') {
			const wall = this.walls.find((other) => other.hits < PICK_HITS && near(other, REACH.wall));
			return wall ? { kind: 'hit', wall } : board ?? { kind: 'drop' };
		}

		let best: Action | null = null;
		let bestDistance = Infinity;
		const inReach = this.items.filter((item) => near(item, REACH.take));
		// Una bolsa le gana al pico: si no, el pico tirado encima la taparía.
		const bags = inReach.filter((item) => item.kind === 'bag');
		for (const item of bags.length ? bags : inReach) {
			const distance = Math.abs(item.x - player.x);
			if (distance < bestDistance) {
				best = { kind: 'take', item };
				bestDistance = distance;
			}
		}
		for (const barrow of this.barrows) {
			const distance = Math.abs(barrow.x - player.x);
			if (near(barrow, REACH.barrow) && distance < bestDistance) {
				best = { kind: 'push', barrow };
				bestDistance = distance;
			}
		}
		// Tocar la campana va al final: lo tirado al lado se levanta primero.
		const bell = this.bells.find((other) => near(other, REACH.bell));
		const ring: Action | null = bell ? { kind: 'ring', bell } : null;
		return best ?? board ?? ring ?? (closedVault ? { kind: 'locked' } : null);
	}

	private act() {
		const action = this.action();
		if (!action) return;
		const { player } = this;
		const { x, y } = player;

		switch (action.kind) {
			case 'pocket':
				action.guard.hasKey = false;
				player.keys += 1;
				this.emit({ type: 'key', x, y });
				this.addScore(SCORE.key);
				break;
			case 'vault':
				this.openVault(action.vault);
				break;
			case 'silence':
				this.alarm = 0;
				this.emit({ type: 'silence', x, y });
				break;
			case 'ring':
				this.soundAlarm(action.bell, BELL_RING);
				this.emit({ type: 'ring', x, y });
				break;
			case 'deliver':
				this.deliver();
				break;
			case 'load':
				action.barrow.load += 1;
				player.hands = null;
				this.emit({ type: 'load', x, y });
				break;
			case 'hit':
				this.hitWall(action.wall);
				break;
			case 'take':
				this.items.splice(this.items.indexOf(action.item), 1);
				player.hands = action.item.kind;
				this.emit({ type: 'take', x, y });
				break;
			case 'push':
				player.hands = 'barrow';
				player.barrow = action.barrow;
				player.load = action.barrow.load;
				action.barrow.x = x;
				this.emit({ type: 'take', x, y });
				break;
			case 'release': {
				const { barrow } = player;
				this.letGo();
				// Queda donde se la veía, delante, si ahí hay piso.
				const ahead = x + player.facing * 0.7;
				if (barrow) barrow.facing = player.facing;
				if (barrow && footing(this.level, this.isOpen)(Math.round(ahead), y)) barrow.x = ahead;
				this.emit({ type: 'drop', x, y });
				break;
			}
			case 'drop':
				this.letGo();
				this.emit({ type: 'drop', x, y });
				break;
			case 'board':
				this.board(action.cart);
				break;
			case 'alight':
				this.alight(action.cart);
				break;
			case 'locked':
				this.emit({ type: 'locked', x, y });
				break;
		}
	}

	private board(cart: Cart) {
		const { player } = this;
		// Se decide con lo que veían justo antes de que se agachara adentro.
		for (const guard of this.guards) guard.sawBoard = guard.mode === 'chase' && canSee(this, guard);
		Object.assign(player, { state: 'ride', cart, x: cart.x, y: cart.y, facing: cart.direction, stun: 0, moving: false });
		this.emit({ type: 'board', x: cart.x, y: cart.y });
	}

	/** Baja hacia afuera del riel: ahí no lo pisa al arrancar. */
	private alight(cart: Cart) {
		const { player } = this;
		const side = cart.x <= cart.from ? -1 : 1;
		const x = cart.x + side * CART.alight;
		const clear = footing(this.level, this.isOpen)(Math.round(x + side * PLAYER.radius), cart.y);
		if (!clear) cart.waitFor = Math.max(cart.waitFor, CART.alightWait);
		Object.assign(player, { state: 'walk', cart: null, x: clear ? x : cart.x, facing: side });
		this.emit({ type: 'alight', x: player.x, y: cart.y });
	}

	private openVault(vault: { x: number; y: number; open: boolean }) {
		vault.open = true;
		this.player.keys -= 1;
		// Las dos dentro de la celda de la puerta: al lado puede haber roca o un pozo.
		for (const side of [-0.4, 0.4]) {
			this.items.push({ kind: 'bag', x: vault.x + side, y: vault.y });
		}
		this.soundAlarm(vault, ALARM_TIME);
		this.emit({ type: 'vault', x: vault.x, y: vault.y });
		this.addScore(SCORE.vault);
	}

	/** Suena la campana: los que no persiguen ni están aturdidos van a mirar ahí. */
	private soundAlarm(where: Node, seconds: number) {
		this.alarm = seconds;
		for (const guard of this.guards) {
			if (guard.mode !== 'stunned' && guard.mode !== 'chase') investigateAt(this, guard, { x: where.x, y: where.y });
		}
	}

	private deliver() {
		const { player } = this;
		const count = player.hands === 'bag' ? 1 : player.load;
		if (player.hands === 'bag') player.hands = null;
		if (player.barrow) player.barrow.load = 0;
		player.load = 0;
		this.delivered += count;
		this.emit({ type: 'deliver', x: player.x, y: player.y });
		this.addScore(count * SCORE.bag);

		if (this.delivered < this.total) return;
		this.status = 'cleared';
		this.alarm = 0;
		const timeBonus = Math.max(0, Math.round(SCORE.timeBonus - this.time * SCORE.timeBonusDrain));
		this.addScore(SCORE.clear + timeBonus + (this.seen ? 0 : SCORE.unseen));
		this.emit({ type: 'cleared', x: player.x, y: player.y });
	}

	private hitWall(wall: { x: number; y: number; hits: number }) {
		const { player } = this;
		if (player.cooldown > 0) return;
		player.cooldown = PICK_COOLDOWN;
		player.facing = Math.sign(wall.x - player.x) || player.facing;
		wall.hits += 1;
		this.emit({ type: wall.hits >= PICK_HITS ? 'wallBroken' : 'hit', x: wall.x, y: wall.y });
		this.makeNoise(wall.x, wall.y, NOISE.pick);
	}

	private letGo() {
		const { player } = this;
		if (player.hands === 'bag' || player.hands === 'pick') {
			this.items.push({ kind: player.hands, x: player.x, y: Math.round(player.y) });
		}
		player.hands = null;
		player.barrow = null;
		player.load = 0;
	}

	private toggleLamp() {
		const { player } = this;
		if (player.state !== 'walk' || player.hidden) return;
		const lamp = this.lamps.find((other) => other.y === player.y && Math.abs(other.x - player.x) <= REACH.lamp);
		if (!lamp) return;
		lamp.lit = !lamp.lit;
		lamp.offSince = this.time;
		this.emit({ type: 'lamp', x: lamp.x, y: lamp.y });
	}

	private addScore(points: number) {
		this.score += points;
		this.emit({ type: 'score', x: this.player.x, y: this.player.y, points });
	}

	private makeNoise(x: number, y: number, radius: number) {
		this.emit({ type: 'noise', x, y, radius });
		if (!this.threats) return;
		for (const guard of this.guards) {
			if (guard.mode === 'chase' || guard.mode === 'stunned') continue;
			const floors = Math.abs(Math.round(guard.y) - y);
			if (floors > 1) continue;
			const reach = floors ? radius * NOISE.throughFloor : radius;
			if (Math.abs(guard.x - x) <= reach) investigateAt(this, guard, { x: Math.round(x), y });
		}
	}

	private movePlayer(dt: number, input: MineInput) {
		const { player } = this;
		player.moving = false;
		if (player.state === 'grip') {
			this.holdGrip(dt, input.y);
			return;
		}
		if (player.state === 'hang') {
			// Las argollas gastan la misma barra que el agarre.
			player.stamina = Math.max(0, player.stamina - dt);
			if (player.stamina === 0) {
				this.slipFromHandle();
				return;
			}
		} else {
			player.stamina = Math.min(GRIP.time, player.stamina + GRIP.recover * dt);
		}
		if (player.state === 'ride') return;
		if (player.state === 'drop') {
			player.dropFor -= dt;
			if (player.dropFor > 0) return;
			player.state = 'walk';
			this.emit({ type: 'land', x: player.x, y: player.y });
			return;
		}
		if (player.stun > 0) {
			player.stun -= dt;
			return;
		}
		if (player.state === 'fall') {
			this.fall(dt);
			return;
		}
		if (player.state === 'climb') {
			this.climb(dt, input.y);
			return;
		}
		if (player.hidden) {
			if (input.x === 0 && input.y <= 0) return;
			player.hidden = false;
		}

		if (player.state === 'hang' && input.y > 0 && this.dropBelow()) return;
		if (player.state === 'walk' && input.y !== 0) {
			if (input.y < 0 && this.tryGrip()) return;
			// Con ← o → apretado la escalera no lo atrapa: así se baja en un piso del medio.
			const leaving = input.x !== 0 && !this.isSolid(Math.round(player.x) + Math.sign(input.x), player.y);
			if (!leaving && player.hands !== 'barrow' && this.startClimb(input.y)) {
				this.climb(dt, input.y);
				return;
			}
			if (input.y < 0 && this.tryHide()) return;
		}
		if (input.x !== 0) this.walk(dt, Math.sign(input.x));
	}

	/** Se suelta de una argolla hacia la galería de abajo, si la hay. */
	private dropBelow() {
		const { player, level } = this;
		const x = Math.round(player.x);
		if (player.y + 1 >= level.height || '#%h'.includes(level.at(x, player.y + 1))) return false;
		player.state = 'fall';
		player.x = x;
		player.fallTo = player.y + 1;
		return true;
	}

	/** Sin brazos sobre un pozo: cae abajo, y si abajo no hay galería, al fondo. */
	private slipFromHandle() {
		const { player } = this;
		this.emit({ type: 'slip', x: player.x, y: player.y });
		if (!this.dropBelow()) this.loseLife();
	}

	private tryGrip() {
		const { player } = this;
		const x = Math.round(player.x);
		if (player.hands || this.level.at(x, player.y) !== 'A') return false;
		// Sólo descansado: si no, a saltitos se viviría en el techo.
		if (player.stamina < GRIP.time) return false;
		player.state = 'grip';
		player.x = x;
		this.emit({ type: 'grip', x, y: player.y });
		return true;
	}

	private holdGrip(dt: number, direction: number) {
		const { player } = this;
		player.stamina = Math.max(0, player.stamina - dt);
		const tired = player.stamina === 0;
		if (!tired && direction <= 0) return;
		player.state = 'drop';
		player.dropFor = GRIP.drop;
		if (!tired) return;
		player.stun = GRIP.slipStun;
		this.emit({ type: 'slip', x: player.x, y: player.y });
	}

	private startClimb(direction: number) {
		const { player, level } = this;
		const top = direction > 0 ? player.y : player.y - 1;
		for (const x of [Math.round(player.x), Math.floor(player.x), Math.ceil(player.x)]) {
			if (Math.abs(x - player.x) > 0.6 || level.at(x, top) !== 'H') continue;
			player.x = x;
			player.state = 'climb';
			player.ladderTop = top;
			player.climbTo = direction > 0 ? top + 1 : top;
			return true;
		}
		return false;
	}

	private climb(dt: number, direction: number) {
		const { player } = this;
		if (direction === 0) return;
		const speed = (player.hands ? PLAYER.climbLoaded : PLAYER.climb) * this.groping();
		const top = player.ladderTop;
		player.y = Math.min(top + 1, Math.max(top, player.y + Math.sign(direction) * speed * dt));
		player.climbTo = direction > 0 ? top + 1 : top;
		player.moving = true;
		if (player.y === player.climbTo) {
			player.state = 'walk';
			player.climbTo = null;
		}
	}

	/** A oscuras se va a tientas, más lento. */
	private groping() {
		return playerLit(this) ? 1 : PLAYER.groping;
	}

	private tryHide() {
		const { player } = this;
		if (player.hands === 'barrow' || this.level.at(Math.round(player.x), player.y) !== 'n') return false;
		// No vale meterse en el nicho en la cara de quien te persigue.
		const watched = this.guards.some((guard) => (
			guard.mode === 'chase' && guard.y === player.y && Math.abs(guard.x - player.x) < 1.5
		));
		if (watched) return false;
		player.hidden = true;
		player.x = Math.round(player.x);
		this.emit({ type: 'hide', x: player.x, y: player.y });
		return true;
	}

	private walk(dt: number, direction: number) {
		const { player, level } = this;
		const y = player.y;
		player.facing = direction;
		let speed = PLAYER.walk;
		if (player.state === 'hang') speed = PLAYER.hang;
		else if (player.hands === 'bag') speed = PLAYER.withBag;
		else if (player.hands === 'pick') speed = PLAYER.withPick;
		else if (player.hands === 'barrow') speed = PLAYER.withBarrow;
		// Colgado no: ningún pozo deja de cruzarse con media barra.
		if (player.state !== 'hang') speed *= this.groping();

		let x = player.x + direction * speed * dt;
		const ahead = Math.round(x + direction * PLAYER.radius);
		if (this.isSolid(ahead, y) || (player.hands && level.at(ahead, y) === 'h')) {
			const edge = ahead - direction * (0.5 + PLAYER.radius);
			x = direction > 0 ? Math.max(player.x, Math.min(x, edge)) : Math.min(player.x, Math.max(x, edge));
		}
		if (x === player.x) return;
		player.x = x;
		player.moving = true;
		player.state = level.at(Math.round(x), y) === 'h' ? 'hang' : 'walk';

		const { barrow } = player;
		if (!barrow) return;
		barrow.x = x;
		const bag = this.items.find((item) => item.kind === 'bag' && item.y === y && Math.abs(item.x - x) < 0.5);
		if (bag && barrow.load < BARROW_CAPACITY) {
			this.items.splice(this.items.indexOf(bag), 1);
			barrow.load += 1;
			player.load = barrow.load;
			this.emit({ type: 'load', x, y });
		}
		this.barrowNoise -= dt;
		if (this.barrowNoise <= 0) {
			this.barrowNoise = NOISE.barrowEvery;
			this.makeNoise(x, y, NOISE.barrow);
		}
	}

	private fall(dt: number) {
		const { player } = this;
		player.y = Math.min(player.fallTo, player.y + PLAYER.fall * dt);
		if (player.y < player.fallTo) return;
		player.state = 'walk';
		player.stun = PLAYER.landStun;
		this.emit({ type: 'land', x: player.x, y: player.y });
		this.makeNoise(player.x, player.y, NOISE.land);
	}

	private moveCarts(dt: number) {
		const { player } = this;
		for (const cart of this.carts) {
			if (cart.waitFor > 0) {
				if (this.fallsInto(cart)) this.board(cart);
				cart.waitFor -= dt;
				if (cart.waitFor <= 0) this.emit({ type: 'cartStart', x: cart.x, y: cart.y });
				continue;
			}
			cart.x += cart.direction * CART.speed * dt;
			const end = cart.direction > 0 ? cart.to : cart.from;
			if ((cart.x - end) * cart.direction >= 0) {
				cart.x = end;
				cart.direction *= -1;
				cart.waitFor = CART.wait;
			}
			if (player.cart === cart) {
				player.x = cart.x;
				player.facing = cart.direction;
			}

			for (const guard of this.guards) {
				if (guard.mode === 'stunned' || guard.shakenFor > 0) continue;
				if (Math.abs(guard.y - cart.y) >= CART.sameFloor || Math.abs(guard.x - cart.x) > CART.hit) continue;
				// Si estaba al pie de una escalera, queda tirado en el riel.
				guard.y = cart.y;
				guard.mode = 'stunned';
				guard.timer = GUARD.stun;
				guard.route = [];
				guard.goal = null;
				guard.moving = false;
				this.emit({ type: 'stunned', x: guard.x, y: guard.y });
			}
			if (this.fallsInto(cart)) this.board(cart);
			if (player.hidden || player.invincible > 0) continue;
			if (player.state === 'hang' || player.state === 'grip' || player.state === 'ride') continue;
			if (Math.abs(player.y - cart.y) < CART.sameFloor && Math.abs(player.x - cart.x) <= CART.hit) this.loseLife();
		}
	}

	private fallsInto(cart: Cart) {
		const { player } = this;
		if (player.state !== 'fall' && player.state !== 'drop') return false;
		return Math.abs(player.y - cart.y) < CART.sameFloor && Math.abs(player.x - cart.x) <= CART.catch;
	}

	private checkCatch() {
		const { player } = this;
		if (player.hidden || player.invincible > 0 || player.state === 'hang') return;
		const riding = player.state === 'ride';
		if (riding && player.cart && player.cart.waitFor <= 0) return;
		for (const guard of this.guards) {
			if (guard.mode === 'stunned' || (riding && !isWitness(guard))) continue;
			const dx = player.x - guard.x;
			if (Math.abs(dx) >= REACH.contact || Math.abs(player.y - guard.y) > REACH.sameFloor) continue;
			// Por la espalda se le puede respirar en la nuca; en la escalera, no.
			// Del agarre lo baja venga de donde venga.
			const grabs = player.state === 'grip' || guard.mode === 'chase';
			if (grabs || dx * guard.facing > 0 || !Number.isInteger(guard.y)) {
				this.seen = true;
				this.loseLife();
				return;
			}
		}
	}

	private loseLife() {
		if (this.status !== 'playing') return;
		this.letGo();
		const { player } = this;
		if (player.state === 'grip' || player.state === 'drop' || player.state === 'ride') player.state = 'walk';
		player.cart = null;
		this.lives -= 1;
		this.status = 'dying';
		this.deathTimer = PLAYER.deathTime;
		this.emit({ type: 'lifeLost', x: this.player.x, y: this.player.y });
	}

	private afterDeath() {
		const { player, level } = this;
		if (this.lives <= 0) {
			this.status = 'over';
			this.emit({ type: 'over', x: player.x, y: player.y });
			return;
		}
		this.status = 'playing';
		this.alarm = 0;
		Object.assign(player, {
			x: level.start.x,
			y: level.start.y,
			state: 'walk',
			climbTo: null,
			hidden: false,
			headlamp: true,
			stun: 0,
			stamina: GRIP.time,
			invincible: PLAYER.invincible,
		});
		for (const guard of this.guards) {
			Object.assign(guard, {
				x: guard.home.x,
				y: guard.home.y,
				mode: 'patrol',
				waitFor: 1,
				noticed: 0,
				staring: 0,
				ignoreFor: 0,
				shakenFor: 0,
				sawBoard: false,
				route: [],
				goal: null,
			});
		}
		this.emit({ type: 'respawn', x: player.x, y: player.y });
	}
}
