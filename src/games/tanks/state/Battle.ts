import {
	BASE_CELL,
	CELLS_PER_BLOCK,
	ENEMY_SPAWNS,
	FORTRESS_CELLS,
	LEVELS,
	lineupForStage,
	PLAYER_SPAWN,
	RESERVED_BLOCKS,
} from '../constants/levels';
import {
	BONUS_SPAWNS,
	BULLET_SIZE,
	CELL,
	CLOCK_FREEZE,
	ENEMY_KINDS,
	ENEMY_STATS,
	ENEMY_AI,
	enemyFireRate,
	EXTRA_LIFE_EVERY,
	FIELD,
	GRID,
	HALF_TILE,
	HELMET_SHIELD,
	MAX_ENEMIES_ON_FIELD,
	PLAYER_FIRE_COOLDOWN,
	PLAYER_LEVELS,
	PLAYER_RESPAWN_DELAY,
	PLAYER_SPEED,
	POWER_UP_LIFETIME,
	POWER_UP_POINTS,
	SHOVEL_DURATION,
	SPAWN_ANIMATION,
	SPAWN_SHIELD,
	spawnInterval,
	TANK_SIZE,
	type EnemyKind,
} from '../constants/tuning';
import { generateMap } from './mapGenerator';
import { randomSeed } from './rng';

/**
 * Simulación completa de una etapa de Tanques.
 *
 * No conoce Phaser: recibe la entrada del jugador, avanza con `step(dt)` y deja
 * en `events` lo que pasó para que la escena lo convierta en sonido y efectos.
 * Así la escena puede redibujarse, pausarse o reiniciarse sin tocar las reglas.
 */

export type Direction = 'up' | 'right' | 'down' | 'left';
export const DIRECTIONS: Direction[] = ['up', 'right', 'down', 'left'];

const VECTORS: Record<Direction, { x: number; y: number }> = {
	up: { x: 0, y: -1 },
	right: { x: 1, y: 0 },
	down: { x: 0, y: 1 },
	left: { x: -1, y: 0 },
};

export const TERRAIN = {
	EMPTY: 0,
	BRICK: 1,
	STEEL: 2,
	WATER: 3,
	TREES: 4,
	BASE: 5,
} as const;
export type Terrain = (typeof TERRAIN)[keyof typeof TERRAIN];

export type TankKind = 'player' | EnemyKind;
export type PowerUpKind = 'star' | 'grenade' | 'helmet' | 'shovel' | 'clock' | 'tank';
export const POWER_UP_KINDS: PowerUpKind[] = ['star', 'grenade', 'helmet', 'shovel', 'clock', 'tank'];

export type Tank = {
	id: number;
	kind: TankKind;
	/** Esquina superior izquierda, en unidades del campo. */
	x: number;
	y: number;
	dir: Direction;
	moving: boolean;
	hp: number;
	/** Lleva un bonus: titila y lo suelta al recibir el primer tiro. */
	bonus: boolean;
	shield: number;
	/** Mientras sea positivo el tanque se está materializando y no participa. */
	spawning: number;
	/** Distancia recorrida; anima las orugas. */
	travelled: number;
	fireCooldown: number;
	aiTimer: number;
	blockedFor: number;
};

export type Bullet = {
	id: number;
	tankId: number;
	fromPlayer: boolean;
	/** Centro de la bala. */
	x: number;
	y: number;
	dir: Direction;
	speed: number;
	breaksSteel: boolean;
	alive: boolean;
};

export type PowerUp = { kind: PowerUpKind; x: number; y: number; timer: number };

export type BattleEvent =
	| { type: 'shot'; fromPlayer: boolean }
	| { type: 'impact'; x: number; y: number; target: 'brick' | 'steel' | 'wall' | 'tank' | 'bullet' | 'shield' }
	| { type: 'armorHit'; x: number; y: number }
	| { type: 'tankDestroyed'; kind: TankKind; x: number; y: number; points: number }
	| { type: 'powerUpSpawned' }
	| { type: 'powerUpTaken'; kind: PowerUpKind; x: number; y: number; points: number }
	| { type: 'baseDestroyed'; x: number; y: number }
	| { type: 'extraLife' };

export type BattleOutcome = 'playing' | 'won' | 'lost';

/** Lo que pasa de una etapa a la siguiente. */
export type CampaignState = {
	stage: number;
	score: number;
	lives: number;
	playerLevel: number;
	/** Sólo en partidas aleatorias: de acá sale el mapa de cada etapa. */
	seed?: number;
};

export type PlayerInput = { dir: Direction | null; fire: boolean };

type Rect = { x: number; y: number; w: number; h: number };

const EPSILON = 0.001;

function overlaps(a: Rect, b: Rect) {
	return a.x < b.x + b.w - EPSILON && b.x < a.x + a.w - EPSILON
		&& a.y < b.y + b.h - EPSILON && b.y < a.y + a.h - EPSILON;
}

function tankRect(tank: Tank, x = tank.x, y = tank.y): Rect {
	return { x, y, w: TANK_SIZE, h: TANK_SIZE };
}

function bulletRect(bullet: Bullet): Rect {
	const half = BULLET_SIZE / 2;
	return { x: bullet.x - half, y: bullet.y - half, w: BULLET_SIZE, h: BULLET_SIZE };
}

function isVertical(dir: Direction) {
	return dir === 'up' || dir === 'down';
}

export class Battle {
	readonly stage: number;
	readonly seed: number | undefined;
	readonly terrain = new Uint8Array(GRID * GRID);
	/** Aumenta cada vez que cambia el terreno; el renderer redibuja sólo entonces. */
	terrainVersion = 0;
	readonly tanks: Tank[] = [];
	readonly bullets: Bullet[] = [];
	powerUp: PowerUp | null = null;
	events: BattleEvent[] = [];

	outcome: BattleOutcome = 'playing';
	/** Segundos transcurridos desde que se decidió la etapa. */
	endTimer = 0;
	baseDestroyed = false;

	score: number;
	lives: number;
	playerLevel: number;
	readonly kills: Record<EnemyKind, number> = { basic: 0, fast: 0, power: 0, armor: 0 };

	/** Enemigos que todavía no salieron, en orden de aparición. */
	readonly enemyQueue: EnemyKind[];
	freezeTimer = 0;
	shovelTimer = 0;
	time = 0;

	private input: PlayerInput = { dir: null, fire: false };
	private spawnTimer = 0.4;
	private spawnPointIndex = 0;
	private spawnedEnemies = 0;
	private respawnTimer = 0;
	private nextId = 1;
	private nextLifeScore: number;

	/** Inyectable para que la vista previa y las pruebas sean reproducibles. */
	private readonly random: () => number;

	constructor(campaign: CampaignState, random: () => number = Math.random) {
		this.random = random;
		this.stage = campaign.stage;
		// Pasadas las etapas diseñadas, la campaña sigue con mapas generados. La
		// semilla nace acá y viaja en `campaign()`: reintentar repite el mismo mapa.
		this.seed = campaign.seed ?? (this.stage > LEVELS.length ? randomSeed(random) : undefined);
		this.score = campaign.score;
		this.lives = campaign.lives;
		this.playerLevel = campaign.playerLevel;
		this.nextLifeScore = (Math.floor(this.score / EXTRA_LIFE_EVERY) + 1) * EXTRA_LIFE_EVERY;

		this.loadMap(this.seed === undefined ? LEVELS[this.stage - 1].map : generateMap(this.seed, this.stage));
		const lineup = lineupForStage(this.stage);
		this.enemyQueue = this.shuffle(ENEMY_KINDS.flatMap((kind) => Array<EnemyKind>(lineup[kind]).fill(kind)));
		this.spawnPlayer();
	}

	get player() {
		return this.tanks.find((tank) => tank.kind === 'player');
	}

	get enemies() {
		return this.tanks.filter((tank) => tank.kind !== 'player');
	}

	/** Enemigos que faltan destruir: los del campo y los que esperan su turno. */
	get enemiesLeft() {
		return this.enemyQueue.length + this.enemies.length;
	}

	terrainAt(col: number, row: number): Terrain {
		return this.terrain[row * GRID + col] as Terrain;
	}

	campaign(): CampaignState {
		return { stage: this.stage, score: this.score, lives: this.lives, playerLevel: this.playerLevel, seed: this.seed };
	}

	setInput(input: PlayerInput) {
		this.input = { dir: input.dir, fire: this.input.fire || input.fire };
	}

	step(dt: number) {
		this.time += dt;
		if (this.outcome !== 'playing') {
			this.endTimer += dt;
		}

		this.freezeTimer = Math.max(0, this.freezeTimer - dt);
		if (this.shovelTimer > 0) {
			this.shovelTimer -= dt;
			if (this.shovelTimer <= 0) {
				this.shovelTimer = 0;
				this.setFortress(TERRAIN.BRICK);
			}
		}

		this.updateSpawns(dt);
		this.updatePlayer(dt);
		this.updateEnemies(dt);
		this.updateBullets(dt);
		this.updatePowerUp(dt);
		this.checkOutcome();
	}

	// ---------------------------------------------------------------- terreno

	private loadMap(map: string[]) {
		const codes: Record<string, Terrain> = {
			'#': TERRAIN.BRICK, '@': TERRAIN.STEEL, '~': TERRAIN.WATER, '%': TERRAIN.TREES,
			'[': TERRAIN.BRICK, ']': TERRAIN.BRICK, '^': TERRAIN.BRICK, '_': TERRAIN.BRICK,
		};
		const reserved = new Set(RESERVED_BLOCKS.map(([col, row]) => `${col},${row}`));

		map.forEach((line, blockRow) => {
			[...line].forEach((char, blockCol) => {
				const terrain = codes[char];
				if (!terrain || reserved.has(`${blockCol},${blockRow}`)) {
					return;
				}
				const half = CELLS_PER_BLOCK / 2;
				for (let dy = 0; dy < CELLS_PER_BLOCK; dy += 1) {
					for (let dx = 0; dx < CELLS_PER_BLOCK; dx += 1) {
						const skipped = (char === '[' && dx >= half) || (char === ']' && dx < half)
							|| (char === '^' && dy >= half) || (char === '_' && dy < half);
						if (!skipped) {
							this.setCell(blockCol * CELLS_PER_BLOCK + dx, blockRow * CELLS_PER_BLOCK + dy, terrain);
						}
					}
				}
			});
		});

		for (let dy = 0; dy < CELLS_PER_BLOCK; dy += 1) {
			for (let dx = 0; dx < CELLS_PER_BLOCK; dx += 1) {
				this.setCell(BASE_CELL.col + dx, BASE_CELL.row + dy, TERRAIN.BASE);
			}
		}
		this.setFortress(TERRAIN.BRICK);
	}

	private setCell(col: number, row: number, terrain: Terrain) {
		this.terrain[row * GRID + col] = terrain;
		this.terrainVersion += 1;
	}

	private setFortress(terrain: Terrain) {
		for (const [col, row] of FORTRESS_CELLS) {
			this.setCell(col, row, terrain);
		}
	}

	/** Celdas que toca un rectángulo, recortadas al campo. */
	private cellsIn(rect: Rect) {
		const cells: Array<[number, number]> = [];
		const minCol = Math.max(0, Math.floor(rect.x / CELL));
		const maxCol = Math.min(GRID - 1, Math.floor((rect.x + rect.w - EPSILON) / CELL));
		const minRow = Math.max(0, Math.floor(rect.y / CELL));
		const maxRow = Math.min(GRID - 1, Math.floor((rect.y + rect.h - EPSILON) / CELL));
		for (let row = minRow; row <= maxRow; row += 1) {
			for (let col = minCol; col <= maxCol; col += 1) {
				cells.push([col, row]);
			}
		}
		return cells;
	}

	private blocksTanks(terrain: Terrain) {
		return terrain === TERRAIN.BRICK || terrain === TERRAIN.STEEL
			|| terrain === TERRAIN.WATER || terrain === TERRAIN.BASE;
	}

	private hitsTerrain(rect: Rect) {
		return this.cellsIn(rect).some(([col, row]) => this.blocksTanks(this.terrainAt(col, row)));
	}

	// -------------------------------------------------------------- aparición

	private spawnPlayer() {
		this.tanks.push(this.createTank('player', PLAYER_SPAWN.x, PLAYER_SPAWN.y, 'up'));
	}

	private createTank(kind: TankKind, x: number, y: number, dir: Direction): Tank {
		return {
			id: this.nextId++,
			kind,
			x,
			y,
			dir,
			moving: false,
			hp: kind === 'player' ? 1 : ENEMY_STATS[kind].hp,
			bonus: false,
			shield: 0,
			spawning: SPAWN_ANIMATION,
			travelled: 0,
			fireCooldown: 0,
			aiTimer: 0.5 + this.random(),
			blockedFor: 0,
		};
	}

	private updateSpawns(dt: number) {
		for (const tank of this.tanks) {
			if (tank.spawning > 0) {
				tank.spawning -= dt;
				if (tank.spawning <= 0) {
					tank.spawning = 0;
					if (tank.kind === 'player') {
						tank.shield = SPAWN_SHIELD;
					}
				}
			}
		}

		if (!this.player && this.lives > 0 && this.outcome === 'playing') {
			this.respawnTimer -= dt;
			if (this.respawnTimer <= 0) {
				this.lives -= 1;
				this.spawnPlayer();
			}
		}

		if (this.outcome !== 'playing' || this.enemyQueue.length === 0
			|| this.enemies.length >= MAX_ENEMIES_ON_FIELD) {
			return;
		}

		this.spawnTimer -= dt;
		if (this.spawnTimer > 0) {
			return;
		}

		// Si el punto que toca está ocupado se prueba el siguiente; si están todos
		// ocupados se reintenta en el próximo paso sin perder el turno.
		for (let attempt = 0; attempt < ENEMY_SPAWNS.length; attempt += 1) {
			const point = ENEMY_SPAWNS[this.spawnPointIndex];
			this.spawnPointIndex = (this.spawnPointIndex + 1) % ENEMY_SPAWNS.length;
			const rect = { x: point.x, y: point.y, w: TANK_SIZE, h: TANK_SIZE };
			if (this.tanks.some((tank) => overlaps(rect, tankRect(tank)))) {
				continue;
			}

			const kind = this.enemyQueue.shift()!;
			const tank = this.createTank(kind, point.x, point.y, 'down');
			this.spawnedEnemies += 1;
			if (BONUS_SPAWNS.includes(this.spawnedEnemies)) {
				// Como en el original, un nuevo portador hace desaparecer el bonus anterior.
				tank.bonus = true;
				this.powerUp = null;
			}
			this.tanks.push(tank);
			this.spawnTimer = spawnInterval(this.stage);
			return;
		}
	}

	// ------------------------------------------------------------- movimiento

	/** Mueve un tanque y devuelve `true` si algo lo frenó. */
	private moveTank(tank: Tank, dir: Direction, speed: number, dt: number) {
		if (dir !== tank.dir) {
			this.turn(tank, dir);
		}

		const vector = VECTORS[dir];
		let remaining = speed * dt;
		while (remaining > EPSILON) {
			const step = Math.min(1, remaining);
			const nx = tank.x + vector.x * step;
			const ny = tank.y + vector.y * step;
			if (this.isBlocked(tank, nx, ny)) {
				// Se acerca de a poco para quedar pegado al obstáculo sin superponerse.
				for (let fine = step / 4; fine > 0.05; fine /= 2) {
					const fx = tank.x + vector.x * fine;
					const fy = tank.y + vector.y * fine;
					if (!this.isBlocked(tank, fx, fy)) {
						tank.x = fx;
						tank.y = fy;
						tank.travelled += fine;
					}
				}
				return true;
			}
			tank.x = nx;
			tank.y = ny;
			tank.travelled += step;
			remaining -= step;
		}
		return false;
	}

	/**
	 * Al doblar 90° el tanque se alinea a la media celda más cercana. Es lo que
	 * hace jugable el original: sin este ajuste sería casi imposible embocar un
	 * pasillo del ancho exacto del tanque.
	 */
	private turn(tank: Tank, dir: Direction) {
		if (isVertical(dir) !== isVertical(tank.dir)) {
			const x = isVertical(dir) ? Math.round(tank.x / HALF_TILE) * HALF_TILE : tank.x;
			const y = isVertical(dir) ? tank.y : Math.round(tank.y / HALF_TILE) * HALF_TILE;
			if (!this.hitsTerrain(tankRect(tank, x, y))) {
				tank.x = x;
				tank.y = y;
			}
		}
		tank.dir = dir;
	}

	private isBlocked(tank: Tank, x: number, y: number) {
		if (x < 0 || y < 0 || x + TANK_SIZE > FIELD || y + TANK_SIZE > FIELD) {
			return true;
		}
		const next = tankRect(tank, x, y);
		if (this.hitsTerrain(next)) {
			return true;
		}
		// Sólo frena acercarse a otro tanque: si dos quedaron superpuestos al
		// aparecer, cualquiera de los dos puede alejarse.
		const current = tankRect(tank);
		return this.tanks.some((other) => other !== tank
			&& overlaps(next, tankRect(other))
			&& !overlaps(current, tankRect(other)));
	}

	// ---------------------------------------------------------------- jugador

	private updatePlayer(dt: number) {
		const player = this.player;
		const fire = this.input.fire;
		this.input.fire = false;
		if (!player || player.spawning > 0 || this.outcome === 'lost') {
			return;
		}

		player.shield = Math.max(0, player.shield - dt);
		player.fireCooldown = Math.max(0, player.fireCooldown - dt);

		player.moving = this.input.dir !== null;
		if (this.input.dir) {
			this.moveTank(player, this.input.dir, PLAYER_SPEED, dt);
		}

		const stats = PLAYER_LEVELS[this.playerLevel];
		if (fire && player.fireCooldown === 0 && this.bulletsOf(player) < stats.maxBullets) {
			this.fire(player, stats.bulletSpeed, stats.breaksSteel);
			player.fireCooldown = PLAYER_FIRE_COOLDOWN;
		}

		const powerUp = this.powerUp;
		if (powerUp && overlaps(tankRect(player), { x: powerUp.x, y: powerUp.y, w: TANK_SIZE, h: TANK_SIZE })) {
			this.powerUp = null;
			this.applyPowerUp(powerUp, player);
		}
	}

	private applyPowerUp(powerUp: PowerUp, player: Tank) {
		switch (powerUp.kind) {
			case 'star':
				this.playerLevel = Math.min(PLAYER_LEVELS.length - 1, this.playerLevel + 1);
				break;
			case 'grenade':
				// La granada no da puntos: premia sacarse de encima la presión, no farmear.
				for (const enemy of this.enemies) {
					this.removeTank(enemy);
					this.events.push({ type: 'tankDestroyed', kind: enemy.kind, x: enemy.x + 8, y: enemy.y + 8, points: 0 });
				}
				break;
			case 'helmet':
				player.shield = HELMET_SHIELD;
				break;
			case 'shovel':
				this.shovelTimer = SHOVEL_DURATION;
				this.setFortress(TERRAIN.STEEL);
				break;
			case 'clock':
				this.freezeTimer = CLOCK_FREEZE;
				break;
			case 'tank':
				this.lives += 1;
				this.events.push({ type: 'extraLife' });
				break;
		}
		this.addScore(POWER_UP_POINTS);
		this.events.push({
			type: 'powerUpTaken',
			kind: powerUp.kind,
			x: powerUp.x + 8,
			y: powerUp.y + 8,
			points: POWER_UP_POINTS,
		});
	}

	// -------------------------------------------------------------- enemigos

	private updateEnemies(dt: number) {
		if (this.freezeTimer > 0) {
			for (const enemy of this.enemies) {
				enemy.moving = false;
			}
			return;
		}

		const fireRate = enemyFireRate(this.stage);
		for (const enemy of this.enemies) {
			if (enemy.spawning > 0) {
				continue;
			}
			const stats = ENEMY_STATS[enemy.kind as EnemyKind];
			enemy.moving = true;
			enemy.aiTimer -= dt;

			const blocked = this.moveTank(enemy, enemy.dir, stats.speed, dt);
			if (blocked) {
				enemy.blockedFor += dt;
				// Contra una pared a veces insiste y la rompe a tiros en vez de doblar.
				if (enemy.blockedFor > 0.35 && this.random() < 0.06) {
					this.chooseDirection(enemy, true);
				}
			} else {
				enemy.blockedFor = 0;
				if (enemy.aiTimer <= 0) {
					this.chooseDirection(enemy, false);
				}
			}

			if (this.bulletsOf(enemy) === 0 && this.random() < fireRate * dt * (blocked ? ENEMY_AI.blockedFireBoost : 1)) {
				this.fire(enemy, stats.bulletSpeed, false);
			}
		}
	}

	/**
	 * La IA del original es casi azar, pero con el correr de la etapa se va
	 * obsesionando con el águila. Acá pasa lo mismo: al principio sólo una de
	 * cada diez decisiones apunta a la base y hacia el minuto y medio ya es la
	 * mitad. Una parte fija persigue al jugador y el resto elige al azar, con
	 * preferencia por bajar.
	 */
	private chooseDirection(enemy: Tank, wasBlocked: boolean) {
		enemy.aiTimer = 1 + this.random() * 3;
		enemy.blockedFor = 0;

		const baseBias = Math.min(ENEMY_AI.maxBaseBias, ENEMY_AI.baseBias + this.time / ENEMY_AI.baseBiasRamp);
		const roll = this.random();
		const player = this.player;
		const target = roll < baseBias
			? { x: BASE_CELL.col * CELL, y: BASE_CELL.row * CELL }
			: roll < baseBias + ENEMY_AI.playerBias && player ? player : null;

		let dir: Direction;
		if (target) {
			const dx = target.x - enemy.x;
			const dy = target.y - enemy.y;
			const horizontal = Math.abs(dx) > Math.abs(dy) ? this.random() < 0.75 : this.random() < 0.25;
			dir = horizontal && Math.abs(dx) > 1
				? (dx > 0 ? 'right' : 'left')
				: (dy > 0 ? 'down' : 'up');
		} else {
			const pick = this.random();
			dir = pick < 0.3 ? 'down' : pick < 0.55 ? 'left' : pick < 0.8 ? 'right' : 'up';
		}

		if (wasBlocked && dir === enemy.dir) {
			const others = DIRECTIONS.filter((option) => option !== enemy.dir);
			dir = others[Math.floor(this.random() * others.length)];
		}
		this.turn(enemy, dir);
	}

	// ----------------------------------------------------------------- balas

	private bulletsOf(tank: Tank) {
		return this.bullets.filter((bullet) => bullet.alive && bullet.tankId === tank.id).length;
	}

	private fire(tank: Tank, speed: number, breaksSteel: boolean) {
		const vector = VECTORS[tank.dir];
		// La bala nace en la boca del cañón, centrada en el tanque.
		this.bullets.push({
			id: this.nextId++,
			tankId: tank.id,
			fromPlayer: tank.kind === 'player',
			x: tank.x + 8 + vector.x * 8,
			y: tank.y + 8 + vector.y * 8,
			dir: tank.dir,
			speed,
			breaksSteel,
			alive: true,
		});
		this.events.push({ type: 'shot', fromPlayer: tank.kind === 'player' });
	}

	private updateBullets(dt: number) {
		for (const bullet of this.bullets) {
			if (!bullet.alive) {
				continue;
			}
			const vector = VECTORS[bullet.dir];
			let remaining = bullet.speed * dt;
			// Pasos de 2 unidades: una bala rápida no atraviesa media celda de ladrillo.
			while (remaining > 0 && bullet.alive) {
				const step = Math.min(2, remaining);
				bullet.x += vector.x * step;
				bullet.y += vector.y * step;
				remaining -= step;
				this.resolveBullet(bullet);
			}
		}

		for (let index = this.bullets.length - 1; index >= 0; index -= 1) {
			if (!this.bullets[index].alive) {
				this.bullets.splice(index, 1);
			}
		}
	}

	private resolveBullet(bullet: Bullet) {
		const rect = bulletRect(bullet);
		if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > FIELD || rect.y + rect.h > FIELD) {
			bullet.alive = false;
			this.events.push({ type: 'impact', x: bullet.x, y: bullet.y, target: 'wall' });
			return;
		}

		if (this.resolveBulletTerrain(bullet, rect)) {
			return;
		}

		for (const other of this.bullets) {
			if (other.alive && other !== bullet && other.fromPlayer !== bullet.fromPlayer
				&& overlaps(rect, bulletRect(other))) {
				bullet.alive = false;
				other.alive = false;
				this.events.push({ type: 'impact', x: bullet.x, y: bullet.y, target: 'bullet' });
				return;
			}
		}

		for (const tank of this.tanks) {
			if (tank.id === bullet.tankId || tank.spawning > 0 || !overlaps(rect, tankRect(tank))) {
				continue;
			}
			bullet.alive = false;
			if (bullet.fromPlayer && tank.kind !== 'player') {
				this.hitEnemy(tank, bullet);
			} else if (!bullet.fromPlayer && tank.kind === 'player') {
				if (tank.shield > 0) {
					this.events.push({ type: 'impact', x: bullet.x, y: bullet.y, target: 'shield' });
				} else {
					this.destroyPlayer(tank);
				}
			}
			// Entre enemigos la bala se pierde sin daño, como en el original.
			return;
		}
	}

	/**
	 * Una bala que toca ladrillo se lleva una hilada del ancho de un tanque,
	 * centrada en su recorrido. Como la hilada es de 4 unidades, una pared de
	 * media baldosa aguanta dos tiros y un tanque alineado la atraviesa de a
	 * poco, como en el original.
	 */
	private resolveBulletTerrain(bullet: Bullet, rect: Rect) {
		const solid = this.cellsIn(rect).filter(([col, row]) => {
			const terrain = this.terrainAt(col, row);
			return terrain === TERRAIN.BRICK || terrain === TERRAIN.STEEL || terrain === TERRAIN.BASE;
		});
		if (solid.length === 0) {
			return false;
		}
		bullet.alive = false;

		if (solid.some(([col, row]) => this.terrainAt(col, row) === TERRAIN.BASE)) {
			this.destroyBase();
			return true;
		}

		// Sólo se rompe la hilada más cercana al tirador.
		const vertical = isVertical(bullet.dir);
		const lines = solid.map(([col, row]) => (vertical ? row : col));
		const line = bullet.dir === 'up' || bullet.dir === 'left' ? Math.max(...lines) : Math.min(...lines);
		const half = TANK_SIZE / 2;
		const strip: Rect = vertical
			? { x: bullet.x - half, y: line * CELL, w: TANK_SIZE, h: CELL }
			: { x: line * CELL, y: bullet.y - half, w: CELL, h: TANK_SIZE };

		let brokeBrick = false;
		let touchedSteel = false;
		for (const [col, row] of this.cellsIn(strip)) {
			const terrain = this.terrainAt(col, row);
			if (terrain === TERRAIN.BRICK) {
				this.setCell(col, row, TERRAIN.EMPTY);
				brokeBrick = true;
			} else if (terrain === TERRAIN.STEEL) {
				touchedSteel = true;
				if (bullet.breaksSteel) {
					this.setCell(col, row, TERRAIN.EMPTY);
				}
			}
		}

		const target = brokeBrick || (touchedSteel && bullet.breaksSteel) ? 'brick' : 'steel';
		this.events.push({ type: 'impact', x: bullet.x, y: bullet.y, target });
		return true;
	}

	private hitEnemy(enemy: Tank, bullet: Bullet) {
		if (enemy.bonus) {
			enemy.bonus = false;
			this.spawnPowerUp();
		}

		enemy.hp -= 1;
		if (enemy.hp > 0) {
			this.events.push({ type: 'armorHit', x: bullet.x, y: bullet.y });
			return;
		}

		const kind = enemy.kind as EnemyKind;
		const points = ENEMY_STATS[kind].points;
		this.kills[kind] += 1;
		this.removeTank(enemy);
		this.addScore(points);
		this.events.push({ type: 'tankDestroyed', kind, x: enemy.x + 8, y: enemy.y + 8, points });
	}

	private destroyPlayer(player: Tank) {
		this.removeTank(player);
		this.playerLevel = 0;
		this.respawnTimer = PLAYER_RESPAWN_DELAY;
		this.events.push({ type: 'tankDestroyed', kind: 'player', x: player.x + 8, y: player.y + 8, points: 0 });
	}

	private destroyBase() {
		if (this.baseDestroyed) {
			return;
		}
		this.baseDestroyed = true;
		this.events.push({
			type: 'baseDestroyed',
			x: BASE_CELL.col * CELL + TANK_SIZE / 2,
			y: BASE_CELL.row * CELL + TANK_SIZE / 2,
		});
	}

	private removeTank(tank: Tank) {
		const index = this.tanks.indexOf(tank);
		if (index >= 0) {
			this.tanks.splice(index, 1);
		}
	}

	private addScore(points: number) {
		this.score += points;
		while (this.score >= this.nextLifeScore) {
			this.nextLifeScore += EXTRA_LIFE_EVERY;
			this.lives += 1;
			this.events.push({ type: 'extraLife' });
		}
	}

	// ----------------------------------------------------------------- bonus

	private spawnPowerUp() {
		const kind = POWER_UP_KINDS[Math.floor(this.random() * POWER_UP_KINDS.length)];
		// Se busca un lugar alcanzable: ni acero, ni agua, ni encima de la base.
		for (let attempt = 0; attempt < 40; attempt += 1) {
			const x = Math.floor(this.random() * (FIELD / HALF_TILE - 1)) * HALF_TILE;
			const y = Math.floor(this.random() * (FIELD / HALF_TILE - 4)) * HALF_TILE;
			const blocked = this.cellsIn({ x, y, w: TANK_SIZE, h: TANK_SIZE }).some(([col, row]) => {
				const terrain = this.terrainAt(col, row);
				return terrain === TERRAIN.STEEL || terrain === TERRAIN.WATER || terrain === TERRAIN.BASE;
			});
			if (!blocked) {
				this.powerUp = { kind, x, y, timer: POWER_UP_LIFETIME };
				this.events.push({ type: 'powerUpSpawned' });
				return;
			}
		}
	}

	private updatePowerUp(dt: number) {
		if (!this.powerUp) {
			return;
		}
		this.powerUp.timer -= dt;
		if (this.powerUp.timer <= 0) {
			this.powerUp = null;
		}
	}

	// -------------------------------------------------------------- resultado

	private checkOutcome() {
		if (this.outcome !== 'playing') {
			return;
		}
		if (this.baseDestroyed || (!this.player && this.lives === 0)) {
			this.outcome = 'lost';
			return;
		}
		if (this.enemyQueue.length === 0 && this.enemies.length === 0) {
			this.outcome = 'won';
		}
	}

	private shuffle<T>(items: T[]) {
		for (let index = items.length - 1; index > 0; index -= 1) {
			const swap = Math.floor(this.random() * (index + 1));
			[items[index], items[swap]] = [items[swap], items[index]];
		}
		return items;
	}
}

