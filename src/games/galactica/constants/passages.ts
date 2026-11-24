/**
 * Los tramos: lo que pasa entre la segunda oleada y la tercera, sin formación.
 * Cada uno es una partitura: en qué segundo sale cada cosa.
 */
export type PassageId = 'crossing' | 'convoy' | 'storm' | 'combined';
export const PASSAGE_IDS: PassageId[] = ['crossing', 'convoy', 'storm', 'combined'];

/** El índice de la oleada que viene después del tramo. */
export const PASSAGE_BEFORE_WAVE = 2;
export const PASSAGE_SECONDS = 25;

/** `follows`: es la segunda de un par y su hueco queda al alcance del de la primera. */
export type PassageCue =
	| { at: number; kind: 'row'; follows?: boolean }
	| { at: number; kind: 'wall'; follows?: boolean }
	| { at: number; kind: 'freighter' }
	| { at: number; kind: 'bandsX' }
	| { at: number; kind: 'bandsY'; max: 1 | 2 };

export type PassageDef = {
	cues: PassageCue[];
	/** Carga de escudo que asegura al empezar: sin ella no se podría jugar a bloquear. */
	shield: boolean;
};

/*
 * Una fila tarda 2,4 s en entrar a la franja de la nave y 1,7 en salir; un
 * muro, 1 y 2,9. Los horarios dejan tiempo para ir de un hueco al otro con la
 * nave más lenta: si se tocan, `npm run test:galactica` busca la salida en
 * cientos de semillas.
 */
export const PASSAGES: Record<PassageId, PassageDef> = {
	crossing: {
		shield: false,
		cues: [
			{ at: 0.3, kind: 'row' },
			{ at: 1.4, kind: 'row', follows: true },
			{ at: 4.4, kind: 'wall' },
			{ at: 5.9, kind: 'wall', follows: true },
			{ at: 8, kind: 'row' },
			{ at: 9, kind: 'row', follows: true },
			{ at: 11.6, kind: 'wall' },
			{ at: 13, kind: 'wall', follows: true },
			{ at: 15, kind: 'row' },
			{ at: 16, kind: 'row', follows: true },
			{ at: 18.3, kind: 'wall' },
			{ at: 19.7, kind: 'wall', follows: true },
		],
	},
	convoy: {
		shield: false,
		cues: [
			{ at: 0.5, kind: 'freighter' },
			{ at: 7, kind: 'freighter' },
			{ at: 13.5, kind: 'freighter' },
		],
	},
	storm: {
		shield: true,
		cues: [
			{ at: 1.5, kind: 'bandsX' },
			{ at: 3.8, kind: 'bandsY', max: 1 },
			{ at: 6.1, kind: 'bandsX' },
			{ at: 8.4, kind: 'bandsX' },
			{ at: 10.7, kind: 'bandsY', max: 2 },
			{ at: 13, kind: 'bandsX' },
			{ at: 15.3, kind: 'bandsY', max: 2 },
			{ at: 17.6, kind: 'bandsX' },
			{ at: 19.9, kind: 'bandsY', max: 2 },
			{ at: 22.2, kind: 'bandsX' },
		],
	},
	combined: {
		shield: true,
		cues: [
			{ at: 0.3, kind: 'row' },
			{ at: 0.5, kind: 'freighter' },
			{ at: 4.2, kind: 'bandsX' },
			{ at: 5.5, kind: 'wall' },
			{ at: 7, kind: 'freighter' },
			{ at: 8.5, kind: 'row' },
			{ at: 9, kind: 'bandsY', max: 1 },
			{ at: 12.5, kind: 'bandsX' },
			{ at: 13.5, kind: 'freighter' },
			{ at: 13.5, kind: 'wall' },
			{ at: 17, kind: 'row' },
			{ at: 17.3, kind: 'bandsY', max: 1 },
			{ at: 21.2, kind: 'bandsX' },
		],
	},
};

/**
 * Rocas con un hueco. `clear` es la distancia del centro del hueco a la roca
 * más cercana: con los radios de la roca y la nave quedan 35 px para cada lado.
 * `gap` es dónde puede quedar ese centro y `shift`, cuánto se corre respecto del
 * anterior: en los muros alcanza para que ninguna altura sirva para dos seguidos.
 */
export const FIELD_ROCKS = {
	clear: 62,
	spacing: 44,
	hp: 6,
	points: 10,
	row: { speed: 180, startY: -174, from: -10, to: 586, gap: [80, 496], shift: [70, 150] },
	/** Sale de afuera de la pantalla: se lo ve marcado en el borde un segundo antes. */
	wall: { speed: 212, startOff: 220, from: 262, to: 590, gap: [330, 490], shift: [75, 140] },
} as const;

export const FREIGHTER = {
	speed: 85,
	y: 150,
	startOff: 130,
	halfWidth: 46,
	halfHeight: 21,
	/** Media bodega: lo único que se rompe. El resto del casco frena los disparos. */
	hatch: 15,
	hp: 5,
	points: 400,
	/** Lo que carga la cápsula que suelta, menos que una común: son tres seguidas. */
	energy: 15,
	escortRank: 2,
	/** Dos a los costados y una debajo de la bodega: para llegar a ella primero hay que voltearla. */
	escorts: [{ dx: -78, dy: 28 }, { dx: 78, dy: 28 }, { dx: 0, dy: 50 }],
	/** Segundos entre disparos de sus escoltas, mínimo y máximo. */
	fireEvery: [1, 1.6],
} as const;

export const STORM = {
	warning: 1.3,
	active: 0.3,
	/** Columnas: caen una sí y una no, así al costado siempre hay una libre. */
	columns: 6,
	/** Bordes de las tres franjas horizontales, que cubren todo lo que recorre la nave. */
	rows: [270, 370, 470, 576],
	/** Energía por cada descarga bloqueada. */
	gain: 4,
} as const;
