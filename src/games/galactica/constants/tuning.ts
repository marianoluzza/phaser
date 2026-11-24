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

/** La línea de salida, que es también lo más atrás que llega la nave. */
export const PLAYER_Y = FIELD_H - 44;
/** Lo más adelante: la mitad de la pantalla, por debajo de la última fila de la formación. */
export const PLAYER_MIN_Y = FIELD_H / 2;
export const PLAYER_MARGIN = 26;
export const PLAYER_RADIUS = 11;
export const PLAYER_BULLET_SPEED = 640;

export const ENEMY_RADIUS = 17;
export const SHARD_RADIUS = 11;
export const BOSS_RADIUS = 40;
export const POD_RADIUS = 20;
export const ROCK_RADIUS = 20;
/**
 * Media nave (24) más media cápsula (18): se toma apenas se tocan los dibujos.
 * Con 24 había que meterla casi entera y una que pasaba pegada se perdía.
 */
export const PICKUP_RADIUS = 42;
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
/** A qué altura sobre la nave se planta. */
export const PLANT_GAP = 38;

/** El destello que avisa un disparo desde la formación. */
export const STATION_AIM = 0.4;
/** Con la nave más cerca que esto no tiran desde la formación: no habría cómo esquivar. */
export const STATION_CLEARANCE = 80;

/** Daño en puntos de vida (la vida va de 0 a 100) antes del blindaje de la nave. */
export const DAMAGE = {
	bolt: 8,
	helix: 7,
	fan: 6,
	blast: 26,
	ram: 30,
	comet: 12,
	rock: 18,
	storm: 16,
} as const;
export type DamageSource = keyof typeof DAMAGE | 'empty';

export const INVULNERABLE_AFTER_HIT = 0.8;

/**
 * La energía es el reloj de la zona: llena dura `energySeconds` de la zona.
 * Disparar y cubrirse la apuran (`ENERGY_SURCHARGE`).
 * Vacía, empieza a drenar la vida a este ritmo por segundo.
 * En los tramos no corre ni drena: duran fijo, no se los puede apurar.
 */
export const EMPTY_ENERGY_LIFE_DRAIN = 2.5;

/**
 * Cuánto se suma al consumo normal, como fracción de él, mientras el cañón
 * recarga y mientras el escudo está prendido. El cañón cobra por tiempo y no
 * por bala para que las tres naves paguen lo mismo con cualquier cadencia.
 * Con 0.5 en el cañón, apuntar empataba con no soltar el gatillo: derriba más
 * lento y la zona dura más (`npm run sim:galactica`).
 */
export const ENERGY_SURCHARGE = { fire: 0.75, shield: 0.5 } as const;

/** Segundos de escudo: lo que suma cada cápsula y lo máximo que se guarda. */
export const SHIELD_CHARGE = 8;
export const SHIELD_CAPACITY = 24;

export const PICKUP_FALL_SPEED = 85;
export const PICKUP_LIFE = 25;
export const PICKUP_ENERGY = 30;
export const POWER_UP_SECONDS = { double: 12, speed: 10 } as const;

/** Núcleos acumulados para llegar a cada etapa: mk1 de entrada, mk2 con 3, mk3 con 8. */
export const EVOLUTION_CORES = [0, 3, 8] as const;

/** Vida que se recupera al pasar de zona. */
export const ZONE_HEAL = 20;
export const ZONE_CLEAR_ENERGY_BONUS = 10;
export const ZONE_CLEAR_LIFE_BONUS = 5;

export const WAVE_INTERLUDE = 2.2;
export const BOSS_INTRO = 2.6;
