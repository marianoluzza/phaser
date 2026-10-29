/**
 * Números de la partida. El campo mide lo mismo en unidades que en píxeles del
 * diseño de 800×600, así que una nave de 16 px escalada ×3 ocupa 48 unidades.
 */
export const FIELD_W = 576;
export const FIELD_H = 576;

/** Escala de los sprites de pxl. Entera, para que cada píxel siga siendo un cuadrado. */
export const PIXEL = 3;

/** La simulación avanza a pasos fijos, igual que en Tanques. */
export const STEP = 1 / 60;

export const PLAYER_Y = FIELD_H - 44;
export const PLAYER_MARGIN = 26;
export const PLAYER_RADIUS = 11;
export const PLAYER_BULLET_SPEED = 640;

export const ENEMY_RADIUS = 17;
export const SHARD_RADIUS = 11;
export const BOSS_RADIUS = 40;
export const POD_RADIUS = 20;
export const ROCK_RADIUS = 20;
export const PICKUP_RADIUS = 24;
export const BULLET_RADIUS = 4;

/** La formación: ocho columnas, hasta cinco filas. */
export const FORMATION = {
	cols: 8,
	colGap: 52,
	rowGap: 42,
	top: 64,
	sway: 34,
	swaySpeed: 0.55,
	breath: 0.11,
	breathSpeed: 1.1,
} as const;

export const ENTRY_SPEED = 300;
export const RETURN_SPEED = 230;
export const SWOOP_SPEED = 250;
export const DIVE_SPEED = 400;
/** Lo que tarda un kamikaze plantado en explotar, y el radio de la explosión. */
export const PLANT_FUSE = 2.2;
export const PLANT_RADIUS = 78;
export const PLANT_Y = PLAYER_Y - 38;

/** Daño en puntos de vida (la vida va de 0 a 100) antes del blindaje de la nave. */
export const DAMAGE = {
	bolt: 8,
	helix: 7,
	fan: 6,
	blast: 26,
	ram: 30,
	comet: 12,
	rock: 18,
} as const;
export type DamageSource = keyof typeof DAMAGE | 'empty';

export const INVULNERABLE_AFTER_HIT = 0.8;

/**
 * La energía es el reloj de la zona: llena dura `energySeconds` de la zona.
 * Vacía, empieza a drenar la vida a este ritmo por segundo.
 */
export const EMPTY_ENERGY_LIFE_DRAIN = 2.5;

export const PICKUP_FALL_SPEED = 85;
export const PICKUP_LIFE = 25;
export const PICKUP_ENERGY = 30;
export const POWER_UP_SECONDS = { shield: 8, double: 12, speed: 10 } as const;

/** Núcleos acumulados para llegar a cada etapa: mk1 de entrada, mk2 con 3, mk3 con 8. */
export const EVOLUTION_CORES = [0, 3, 8] as const;

/** Vida que se recupera al pasar de zona. */
export const ZONE_HEAL = 20;
export const ZONE_CLEAR_ENERGY_BONUS = 10;
export const ZONE_CLEAR_LIFE_BONUS = 5;

export const WAVE_INTERLUDE = 2.2;
export const BOSS_INTRO = 2.6;
