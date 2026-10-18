import { VIEW_HEIGHT, VIEW_WIDTH } from './tuning';

/**
 * Los mapas son datos: la simulación, las rutas y el dibujo salen de acá.
 *
 * La v1 tiene un solo cruce, pero el formato ya contempla lo que viene: cada
 * acceso tiene una lista de carriles con los movimientos que permite (como
 * las flechas pintadas en el asfalto) y cada salida tiene su color y su letra.
 * Un mapa con más cruces o más carriles es otro valor de este tipo.
 */

/** Brazos de un cruce, por el punto cardinal hacia el que se extienden. */
export const ARM_IDS = ['N', 'E', 'S', 'W'] as const;
export type ArmId = (typeof ARM_IDS)[number];

export const TURNS = ['straight', 'left', 'right'] as const;
export type Turn = (typeof TURNS)[number];

export type LaneLayout = {
	/** Movimientos permitidos desde este carril. */
	turns: readonly Turn[];
};

/** Salida de la ciudad. Los coches que van hacia ella llevan su color y su letra. */
export type ExitLayout = {
	id: string;
	letter: string;
	color: number;
};

export type ArmLayout = {
	/** Carriles que llegan al cruce, del centro de la calle hacia afuera. */
	inLanes: readonly LaneLayout[];
	/** Carriles que salen del cruce. */
	outLanes: number;
	exit: ExitLayout;
	/** Peso relativo de este brazo al sortear por dónde entra el próximo coche. */
	spawnWeight: number;
};

export type CrossingLayout = {
	id: string;
	x: number;
	y: number;
	arms: Record<ArmId, ArmLayout>;
};

export type CityLayout = {
	id: string;
	width: number;
	height: number;
	crossings: readonly CrossingLayout[];
};

const ALL_TURNS: readonly Turn[] = TURNS;

/**
 * Colores de destino: lejos del rojo y del verde de los semáforos y bien
 * distintos entre sí. La letra los distingue para quien no ve los colores.
 */
export const EXIT_COLORS = {
	blue: 0x3d8bff,
	yellow: 0xffc93c,
	magenta: 0xe459d1,
	white: 0xf1f3f8,
} as const;

/** Un cruce de doble mano en el medio de la pantalla. */
export const CENTRO: CityLayout = {
	id: 'centro',
	width: VIEW_WIDTH,
	height: VIEW_HEIGHT,
	crossings: [
		{
			id: 'centro',
			x: VIEW_WIDTH / 2,
			y: VIEW_HEIGHT / 2,
			arms: {
				N: { inLanes: [{ turns: ALL_TURNS }], outLanes: 1, exit: { id: 'A', letter: 'A', color: EXIT_COLORS.blue }, spawnWeight: 1 },
				E: { inLanes: [{ turns: ALL_TURNS }], outLanes: 1, exit: { id: 'B', letter: 'B', color: EXIT_COLORS.yellow }, spawnWeight: 1 },
				S: { inLanes: [{ turns: ALL_TURNS }], outLanes: 1, exit: { id: 'C', letter: 'C', color: EXIT_COLORS.magenta }, spawnWeight: 1 },
				W: { inLanes: [{ turns: ALL_TURNS }], outLanes: 1, exit: { id: 'D', letter: 'D', color: EXIT_COLORS.white }, spawnWeight: 1 },
			},
		},
	],
};
