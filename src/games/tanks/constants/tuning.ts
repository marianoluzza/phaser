/**
 * Números que definen cómo se siente Tanques.
 *
 * Las distancias están en unidades lógicas del campo, no en píxeles: un tanque
 * mide 16 unidades y el campo completo 208. La escena decide después a cuántos
 * píxeles equivale cada unidad.
 *
 * El terreno se guarda en celdas de 4 unidades, el tamaño de un ladrillo. Es
 * la resolución del original y la que le da su ritmo: cada tiro se come una
 * sola hilada, así que una pared de media baldosa aguanta dos impactos.
 */

export const CELL = 4;
export const GRID = 52;
export const FIELD = CELL * GRID;
/** Media baldosa: la grilla de los puntos de aparición y de los giros. */
export const HALF_TILE = 8;
export const TANK_SIZE = 16;
export const BULLET_SIZE = 4;

export type EnemyKind = 'basic' | 'fast' | 'power' | 'armor';
export const ENEMY_KINDS: EnemyKind[] = ['basic', 'fast', 'power', 'armor'];

/** Velocidades en unidades por segundo. */
export const PLAYER_SPEED = 46;
export const BULLET_SPEED_SLOW = 150;
export const BULLET_SPEED_FAST = 250;

export const ENEMY_STATS: Record<EnemyKind, { speed: number; bulletSpeed: number; hp: number; points: number }> = {
	basic: { speed: 28, bulletSpeed: BULLET_SPEED_SLOW, hp: 1, points: 100 },
	fast: { speed: 58, bulletSpeed: BULLET_SPEED_SLOW, hp: 1, points: 200 },
	power: { speed: 34, bulletSpeed: BULLET_SPEED_FAST, hp: 1, points: 300 },
	armor: { speed: 30, bulletSpeed: BULLET_SPEED_SLOW, hp: 4, points: 400 },
};

/** Cada estrella mejora el cañón del jugador; morir lo devuelve al nivel 0. */
export const PLAYER_LEVELS = [
	{ bulletSpeed: BULLET_SPEED_SLOW, maxBullets: 1, breaksSteel: false },
	{ bulletSpeed: BULLET_SPEED_FAST, maxBullets: 1, breaksSteel: false },
	{ bulletSpeed: BULLET_SPEED_FAST, maxBullets: 2, breaksSteel: false },
	{ bulletSpeed: BULLET_SPEED_FAST, maxBullets: 2, breaksSteel: true },
] as const;

/** Pausa mínima entre dos disparos del jugador cuando puede tener dos balas. */
export const PLAYER_FIRE_COOLDOWN = 0.12;

export const ENEMIES_PER_STAGE = 20;
export const MAX_ENEMIES_ON_FIELD = 4;
/** Los enemigos que salen en estos turnos titilan y sueltan un bonus al recibir un tiro. */
export const BONUS_SPAWNS = [4, 11, 18];

/** Segundos entre apariciones de enemigos; baja con cada etapa hasta el mínimo. */
export function spawnInterval(stage: number) {
	return Math.max(1.1, 2.6 - (stage - 1) * 0.1);
}

/** Probabilidad por segundo de que un enemigo con el cañón libre dispare. */
export function enemyFireRate(stage: number) {
	return Math.min(1.8, 0.5 + (stage - 1) * 0.09);
}

/**
 * Cómo eligen rumbo los enemigos. La atracción por la base arranca en
 * `baseBias` y crece una unidad cada `baseBiasRamp` segundos hasta el tope.
 * Contra una pared disparan `blockedFireBoost` veces más: así abren camino.
 */
export const ENEMY_AI = {
	baseBias: 0.05,
	baseBiasRamp: 240,
	maxBaseBias: 0.45,
	playerBias: 0.2,
	blockedFireBoost: 2,
};

/** Duraciones en segundos. */
export const SPAWN_ANIMATION = 0.7;
export const SPAWN_SHIELD = 3;
export const HELMET_SHIELD = 10;
export const CLOCK_FREEZE = 10;
export const SHOVEL_DURATION = 18;
/** Últimos segundos de la pala: el acero titila antes de volver a ser ladrillo. */
export const SHOVEL_WARNING = 3;
export const POWER_UP_LIFETIME = 20;
export const PLAYER_RESPAWN_DELAY = 1.2;

export const START_LIVES = 2;
export const POWER_UP_POINTS = 500;
export const EXTRA_LIFE_EVERY = 20000;
