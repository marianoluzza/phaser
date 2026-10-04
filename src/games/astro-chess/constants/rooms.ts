import type { TranslationKey } from '../../../core/i18n/i18n';

/** Salas de la nave en el MVP. */
export type RoomId = 'bridge' | 'shields' | 'weapons' | 'engines' | 'medbay';

/**
 * Color de casilla de la sala.
 *
 * Es la regla del alfil traída a la nave: cada sala está pintada de un color y
 * el alfil sólo rinde en las que coinciden con el suyo. Hoy es sólo información
 * en pantalla; la restricción entra con los rasgos.
 */
export type SquareColor = 'light' | 'dark';

export type RoomProfile = {
	id: RoomId;
	nameKey: TranslationKey;
	/** Qué produce la sala: escudo, daño, evasión… */
	effectKey: TranslationKey;
	squareColor: SquareColor;
	/** Puestos disponibles. Siempre suman más que la tripulación inicial. */
	slots: number;
	/**
	 * Cuánto rinde un puesto por cada punto de aptitud de quien lo ocupa.
	 *
	 * Escudos y armería valen doble porque son las dos salas que deciden un
	 * combate; puente, motores y enfermería inclinan la balanza sin ganarlo.
	 */
	perSlot: number;
	/** Rectángulo de la sala dentro del plano de la nave. */
	plan: { x: number; y: number; width: number; height: number };
};

/**
 * El plano no es una grilla: es una nave.
 *
 * Los motores van en la cola y el puente en la proa, porque la posición tiene
 * que decir algo antes de leer el cartel. Las coordenadas son las del canvas de
 * 800 × 600 y las comparte todo el que dibuje la nave.
 */
export const ROOMS: Record<RoomId, RoomProfile> = {
	engines: {
		id: 'engines',
		nameKey: 'astro.room.engines',
		effectKey: 'astro.room.engines.effect',
		squareColor: 'dark',
		slots: 1,
		perSlot: 1,
		plan: { x: 62, y: 223, width: 118, height: 120 },
	},
	shields: {
		id: 'shields',
		nameKey: 'astro.room.shields',
		effectKey: 'astro.room.shields.effect',
		squareColor: 'dark',
		slots: 2,
		perSlot: 2,
		plan: { x: 196, y: 152, width: 132, height: 120 },
	},
	medbay: {
		id: 'medbay',
		nameKey: 'astro.room.medbay',
		effectKey: 'astro.room.medbay.effect',
		squareColor: 'light',
		slots: 1,
		perSlot: 1,
		plan: { x: 196, y: 292, width: 132, height: 120 },
	},
	weapons: {
		id: 'weapons',
		nameKey: 'astro.room.weapons',
		effectKey: 'astro.room.weapons.effect',
		squareColor: 'light',
		slots: 2,
		perSlot: 2,
		plan: { x: 344, y: 152, width: 132, height: 120 },
	},
	bridge: {
		id: 'bridge',
		nameKey: 'astro.room.bridge',
		effectKey: 'astro.room.bridge.effect',
		squareColor: 'light',
		slots: 1,
		perSlot: 1,
		plan: { x: 490, y: 235, width: 100, height: 110 },
	},
};

/** Orden de proa a popa, que es como se lee el plano. */
export const ROOM_IDS: RoomId[] = ['bridge', 'weapons', 'shields', 'medbay', 'engines'];

/** Siete puestos para cinco tripulantes: nunca alcanza para cubrir todo. */
export const TOTAL_SLOTS = ROOM_IDS.reduce((total, id) => total + ROOMS[id].slots, 0);

/** Contorno del casco, en las mismas coordenadas que las salas. */
export const HULL_OUTLINE: Array<[number, number]> = [
	[42, 138],
	[500, 138],
	[668, 283],
	[500, 428],
	[42, 428],
	[78, 283],
];
