import type { Family } from './families';
import type { PassageId } from './passages';

export type EventKind = 'pod' | 'asteroids' | 'comets';

/** Trayectorias de entrada. Cada una tiene su espejo para el otro costado. */
export type EntryPath = 'loop' | 'swirl' | 'side' | 'top';

export type WaveDef = {
	/**
	 * La formación, fila por fila desde arriba. Cada carácter es una columna:
	 * `.` vacía, `1` soldado, `2` élite, `3` comandante.
	 */
	formation: string[];
	/** Una trayectoria por fila; la mitad izquierda entra por la izquierda y la otra por la derecha. */
	entries: EntryPath[];
};

export type ZoneDef = {
	family: Family;
	waves: WaveDef[];
	/** El tramo entre la segunda oleada y la tercera. */
	passage: PassageId;
	/** Segundos que dura la energía llena. */
	energySeconds: number;
	/** Segundos entre ataques con la formación completa; baja a medida que se vacía. */
	attackEvery: number;
	maxAttackers: number;
	/** Segundos entre disparos desde la formación. */
	stationFireEvery: number;
	events: Array<[EventKind, number]>;
	/** Segundos entre eventos, mínimo y máximo. */
	eventEvery: [number, number];
	/** Colores del fondo: espacio, nebulosa y estrellas. */
	sky: { space: number; nebula: number; stars: number };
};

export const ZONES: ZoneDef[] = [
	{
		family: 'terran',
		passage: 'crossing',
		waves: [
			{ formation: ['..2222..', '.111111.', '.111111.'], entries: ['top', 'loop', 'side'] },
			{ formation: ['...33...', '.222222.', '11111111', '11111111'], entries: ['top', 'swirl', 'loop', 'side'] },
			{ formation: ['..3..3..', '22222222', '11111111', '.111111.'], entries: ['top', 'loop', 'swirl', 'side'] },
		],
		energySeconds: 120,
		attackEvery: 1.45,
		maxAttackers: 3,
		stationFireEvery: 5,
		events: [['pod', 3], ['asteroids', 2]],
		eventEvery: [14, 22],
		sky: { space: 0x080b18, nebula: 0x14305a, stars: 0xd9e2ff },
	},
	{
		family: 'insect',
		passage: 'convoy',
		waves: [
			{ formation: ['..2222..', '11111111', '11111111'], entries: ['swirl', 'loop', 'side'] },
			{ formation: ['..3..3..', '.222222.', '11111111', '11111111'], entries: ['top', 'swirl', 'loop', 'side'] },
			{ formation: ['.3.33.3.', '22222222', '11111111', '11111111', '.111111.'], entries: ['top', 'loop', 'swirl', 'side', 'loop'] },
		],
		energySeconds: 125,
		attackEvery: 1.05,
		maxAttackers: 4,
		stationFireEvery: 5,
		events: [['pod', 3], ['comets', 2]],
		eventEvery: [12, 20],
		sky: { space: 0x0e0816, nebula: 0x4a1a52, stars: 0xf6d8ff },
	},
	{
		family: 'crystal',
		passage: 'storm',
		waves: [
			{ formation: ['..2222..', '.111111.', '.111111.'], entries: ['top', 'swirl', 'loop'] },
			{ formation: ['...33...', '.222222.', '11111111', '.111111.'], entries: ['top', 'loop', 'swirl', 'side'] },
			{ formation: ['..3333..', '.222222.', '11111111', '11111111'], entries: ['top', 'swirl', 'loop', 'side'] },
		],
		energySeconds: 130,
		attackEvery: 1.2,
		maxAttackers: 4,
		stationFireEvery: 4.2,
		events: [['asteroids', 3], ['pod', 2], ['comets', 1]],
		eventEvery: [11, 18],
		sky: { space: 0x061018, nebula: 0x0f4a5c, stars: 0xc4fbff },
	},
	{
		family: 'mythic',
		passage: 'combined',
		waves: [
			{ formation: ['..2222..', '.111111.', '11111111'], entries: ['top', 'loop', 'swirl'] },
			{ formation: ['..3..3..', '.222222.', '11111111', '11111111'], entries: ['top', 'swirl', 'loop', 'side'] },
			{ formation: ['.3.33.3.', '22222222', '.222222.', '11111111'], entries: ['top', 'loop', 'swirl', 'side'] },
		],
		energySeconds: 135,
		attackEvery: 0.9,
		maxAttackers: 5,
		stationFireEvery: 3.6,
		events: [['comets', 3], ['pod', 2], ['asteroids', 2]],
		eventEvery: [10, 16],
		sky: { space: 0x140608, nebula: 0x5a1a1e, stars: 0xffe0c8 },
	},
];

/**
 * Puntos de control de cada entrada, en fracciones del campo (x 0..1, y 0..1),
 * para la mitad que llega por la izquierda. La derecha usa el espejo. El
 * último tramo, hasta el casillero, lo agrega la formación.
 */
export const ENTRY_POINTS: Record<EntryPath, Array<[number, number]>> = {
	// Baja por el costado, hace un rizo grande abajo y sube a la formación.
	loop: [[-0.08, 0.35], [0.25, 0.55], [0.45, 0.78], [0.62, 0.62], [0.5, 0.45], [0.3, 0.42]],
	// Entra por arriba, cruza en S y se acomoda.
	swirl: [[0.15, -0.08], [0.35, 0.3], [0.7, 0.5], [0.8, 0.3], [0.55, 0.22]],
	// Cruza de costado a media altura y sube.
	side: [[-0.08, 0.6], [0.35, 0.62], [0.65, 0.55], [0.6, 0.38]],
	// Cae casi recto desde arriba.
	top: [[0.3, -0.08], [0.32, 0.12], [0.4, 0.2]],
};
