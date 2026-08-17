import type { TranslationKey } from '../../../core/i18n/i18n';
import { DEFAULT_PIPE_WEIGHTS, PIPE_TYPES, type PipeType, type PipeWeights } from './pipeTypes';

/**
 * Todos los números que definen cómo se juega Pipes.
 *
 * Están juntos y planos a propósito: la pantalla de configuración necesita
 * recorrerlos, mostrarlos y guardarlos sin conocer a qué sistema pertenece cada
 * uno. Las reglas leen de acá en vez de tener constantes propias, así probar un
 * balance distinto no requiere tocar código.
 */
export type PipesTuning = {
	/** Milisegundos para construir antes de que arranque el agua, en el nivel 1. */
	countdownBase: number;
	/** Cuánto baja ese tiempo por nivel. */
	countdownStep: number;
	/** Piso de la cuenta regresiva. */
	countdownMin: number;

	/** Milisegundos que tarda el agua en llenar un tramo, en el nivel 1. */
	waterBase: number;
	/** Porcentaje que queda de ese tiempo al pasar de nivel: 85 es × 0,85. */
	waterStepPercent: number;
	/** Piso del tiempo por tramo. */
	waterMin: number;
	/** Cuánto más rápido corre el agua con la tecla F. */
	fastForwardFactor: number;

	/** Tramos necesarios para superar el nivel 1. */
	goalBase: number;
	/** Cuánto sube la meta por nivel. */
	goalStep: number;
	/** Techo de la meta. */
	goalMax: number;

	/** Puntos que suma cada tramo recorrido. */
	pointsPerSegment: number;
	/** Puntos que descuenta pisar una pieza seca ya colocada. */
	replacePenalty: number;
	/** Puntos que descuenta cada pieza que el agua nunca usó. */
	loosePenalty: number;

	/** Puntos extra por cada cruce atravesado por segunda vez. */
	crossDoubleBonus: number;
	/** Cuántos cruces dobles hacen falta para el bonus extra. Cero lo desactiva. */
	crossBonusThreshold: number;
	/** Puntos de ese bonus extra. */
	crossBonusPoints: number;

	/** Cuántas veces entra cada pieza en la bolsa. */
	bag: PipeWeights;
};

/** Claves numéricas: todo lo que la configuración muestra como una fila con − y +. */
export type TuningNumberKey = Exclude<keyof PipesTuning, 'bag'>;

/** Cómo se escribe un valor en pantalla; sólo cambia el sufijo. */
export type TuningFormat = 'ms' | 'percent' | 'times' | 'plain';

export type TuningField = {
	key: TuningNumberKey;
	labelKey: TranslationKey;
	min: number;
	max: number;
	/** Cuánto cambia el valor con un click; con Shift se multiplica por diez. */
	step: number;
	format: TuningFormat;
};

export type TuningGroup = {
	titleKey: TranslationKey;
	fields: readonly TuningField[];
};

export const DEFAULT_TUNING: PipesTuning = {
	countdownBase: 12000,
	countdownStep: 1000,
	countdownMin: 6000,

	waterBase: 2400,
	waterStepPercent: 85,
	waterMin: 900,
	fastForwardFactor: 4,

	goalBase: 10,
	goalStep: 3,
	goalMax: 120,

	pointsPerSegment: 10,
	replacePenalty: 5,
	loosePenalty: 5,

	crossDoubleBonus: 25,
	crossBonusThreshold: 3,
	crossBonusPoints: 100,

	bag: { ...DEFAULT_PIPE_WEIGHTS },
};

/**
 * Descripción de cada campo para la pantalla de configuración.
 *
 * Los grupos son la única fuente de la lista: agregar un parámetro es agregarlo
 * acá, no dibujar una fila más.
 */
export const TUNING_GROUPS: readonly TuningGroup[] = [
	{
		titleKey: 'pipes.config.group.countdown',
		fields: [
			{ key: 'countdownBase', labelKey: 'pipes.config.countdownBase', min: 1000, max: 60000, step: 500, format: 'ms' },
			{ key: 'countdownStep', labelKey: 'pipes.config.countdownStep', min: 0, max: 10000, step: 250, format: 'ms' },
			{ key: 'countdownMin', labelKey: 'pipes.config.countdownMin', min: 500, max: 60000, step: 500, format: 'ms' },
		],
	},
	{
		titleKey: 'pipes.config.group.water',
		fields: [
			{ key: 'waterBase', labelKey: 'pipes.config.waterBase', min: 100, max: 10000, step: 100, format: 'ms' },
			{ key: 'waterStepPercent', labelKey: 'pipes.config.waterStepPercent', min: 50, max: 100, step: 1, format: 'percent' },
			{ key: 'waterMin', labelKey: 'pipes.config.waterMin', min: 100, max: 10000, step: 50, format: 'ms' },
			{ key: 'fastForwardFactor', labelKey: 'pipes.config.fastForwardFactor', min: 2, max: 20, step: 1, format: 'times' },
		],
	},
	{
		titleKey: 'pipes.config.group.goal',
		fields: [
			{ key: 'goalBase', labelKey: 'pipes.config.goalBase', min: 1, max: 200, step: 1, format: 'plain' },
			{ key: 'goalStep', labelKey: 'pipes.config.goalStep', min: 0, max: 50, step: 1, format: 'plain' },
			{ key: 'goalMax', labelKey: 'pipes.config.goalMax', min: 1, max: 500, step: 5, format: 'plain' },
		],
	},
	{
		titleKey: 'pipes.config.group.points',
		fields: [
			{ key: 'pointsPerSegment', labelKey: 'pipes.config.pointsPerSegment', min: 0, max: 1000, step: 5, format: 'plain' },
			{ key: 'replacePenalty', labelKey: 'pipes.config.replacePenalty', min: 0, max: 1000, step: 5, format: 'plain' },
			{ key: 'loosePenalty', labelKey: 'pipes.config.loosePenalty', min: 0, max: 1000, step: 5, format: 'plain' },
		],
	},
	{
		titleKey: 'pipes.config.group.cross',
		fields: [
			{ key: 'crossDoubleBonus', labelKey: 'pipes.config.crossDoubleBonus', min: 0, max: 2000, step: 5, format: 'plain' },
			{ key: 'crossBonusThreshold', labelKey: 'pipes.config.crossBonusThreshold', min: 0, max: 50, step: 1, format: 'plain' },
			{ key: 'crossBonusPoints', labelKey: 'pipes.config.crossBonusPoints', min: 0, max: 10000, step: 25, format: 'plain' },
		],
	},
];

/** Los campos sueltos, sin sus grupos; sirve para validar lo que se lee guardado. */
export const TUNING_FIELDS: readonly TuningField[] = TUNING_GROUPS.flatMap((group) => [
	...group.fields,
]);

/** Tope por pieza en la bolsa: más que esto no cambia nada y rompe el dibujo. */
export const MAX_BAG_COUNT = 30;

/** Nombre visible de cada pieza en el submenú de la bolsa. */
export const PIECE_LABEL_KEYS: Record<PipeType, TranslationKey> = {
	horizontal: 'pipes.config.piece.horizontal',
	vertical: 'pipes.config.piece.vertical',
	curveNorthEast: 'pipes.config.piece.curveNorthEast',
	curveEastSouth: 'pipes.config.piece.curveEastSouth',
	curveSouthWest: 'pipes.config.piece.curveSouthWest',
	curveWestNorth: 'pipes.config.piece.curveWestNorth',
	cross: 'pipes.config.piece.cross',
};

export function formatTuningValue(value: number, format: TuningFormat): string {
	if (format === 'ms') return `${value} ms`;
	if (format === 'percent') return `${value} %`;
	if (format === 'times') return `× ${value}`;
	return String(value);
}

/** Total de piezas de una vuelta completa de la bolsa. */
export function bagTotal(bag: PipeWeights): number {
	return PIPE_TYPES.reduce((total, type) => total + bag[type], 0);
}

export function clampField(field: TuningField, value: number): number {
	if (!Number.isFinite(value)) return DEFAULT_TUNING[field.key];
	return Math.min(field.max, Math.max(field.min, Math.round(value)));
}

/**
 * Deja un objeto cualquiera convertido en una configuración válida.
 *
 * Lo que viene de `localStorage` puede ser de una versión anterior, estar
 * incompleto o directamente ser basura. En vez de confiar, se parte de los
 * valores por defecto y se acepta sólo lo que cae dentro de los límites de cada
 * campo. Una bolsa vacía dejaría a la cola sin piezas que repartir, así que se
 * descarta entera.
 */
export function normalizeTuning(raw: unknown): PipesTuning {
	const source = (raw ?? {}) as Partial<Record<keyof PipesTuning, unknown>>;
	const tuning: PipesTuning = { ...DEFAULT_TUNING, bag: { ...DEFAULT_TUNING.bag } };

	for (const field of TUNING_FIELDS) {
		const value = source[field.key];
		if (typeof value === 'number') tuning[field.key] = clampField(field, value);
	}

	const rawBag = (source.bag ?? {}) as Partial<Record<PipeType, unknown>>;
	const bag = { ...DEFAULT_TUNING.bag };
	for (const type of PIPE_TYPES) {
		const value = rawBag[type];
		if (typeof value !== 'number' || !Number.isFinite(value)) continue;
		bag[type] = Math.min(MAX_BAG_COUNT, Math.max(0, Math.round(value)));
	}
	if (bagTotal(bag) > 0) tuning.bag = bag;

	return tuning;
}

export function cloneTuning(tuning: PipesTuning): PipesTuning {
	return { ...tuning, bag: { ...tuning.bag } };
}
