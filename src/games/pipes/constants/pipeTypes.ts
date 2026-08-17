/**
 * Vocabulario de piezas de cañería.
 *
 * Una pieza se define únicamente por los bordes de la celda que conecta. Con
 * eso alcanza tanto para dibujarla como para, más adelante, recorrer el
 * trayecto del agua: la pieza no necesita saber nada del tablero ni de Phaser.
 */
export type Direction = 'north' | 'east' | 'south' | 'west';

/** Las cuatro direcciones, para recorrerlas o sortear una. */
export const DIRECTIONS: readonly Direction[] = ['north', 'east', 'south', 'west'];

export type PipeType =
	| 'horizontal'
	| 'vertical'
	| 'curveNorthEast'
	| 'curveEastSouth'
	| 'curveSouthWest'
	| 'curveWestNorth'
	| 'cross';

/** Las piezas en orden de presentación; la configuración las recorre así. */
export const PIPE_TYPES: readonly PipeType[] = [
	'horizontal',
	'vertical',
	'curveNorthEast',
	'curveEastSouth',
	'curveSouthWest',
	'curveWestNorth',
	'cross',
];

/** Bordes que abre cada pieza. Es la única definición de su forma. */
export const PIPE_CONNECTIONS: Record<PipeType, readonly Direction[]> = {
	horizontal: ['east', 'west'],
	vertical: ['north', 'south'],
	curveNorthEast: ['north', 'east'],
	curveEastSouth: ['east', 'south'],
	curveSouthWest: ['south', 'west'],
	curveWestNorth: ['west', 'north'],
	cross: ['north', 'east', 'south', 'west'],
};

/** Borde opuesto: la salida de una celda es la entrada de la vecina. */
export const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
	north: 'south',
	south: 'north',
	east: 'west',
	west: 'east',
};

/** Desplazamiento en la grilla al moverse hacia cada dirección. */
export const DIRECTION_OFFSETS: Record<Direction, { column: number; row: number }> = {
	north: { column: 0, row: -1 },
	south: { column: 0, row: 1 },
	east: { column: 1, row: 0 },
	west: { column: -1, row: 0 },
};

/**
 * Por dónde sale el agua que entró por un borde.
 *
 * El cruce es la excepción: sus cuatro conexiones no forman un recorrido único,
 * así que el agua lo atraviesa derecho y el otro eje queda seco. En el resto de
 * las piezas la salida es, simplemente, la conexión que no es la entrada.
 *
 * Devuelve `null` cuando la pieza no abre ese borde, que es el caso de derrame.
 */
export function exitDirection(type: PipeType, entry: Direction): Direction | null {
	const connections = PIPE_CONNECTIONS[type];
	if (!connections.includes(entry)) return null;

	if (type === 'cross') return OPPOSITE_DIRECTION[entry];

	return connections.find((direction) => direction !== entry) ?? null;
}

/**
 * ¿La pieza hace doblar el agua?
 *
 * Se deduce de las conexiones: una curva abre dos bordes que no son opuestos.
 * Las rectas y el cruce dejan seguir derecho. La cola usa esto para no dejar al
 * jugador sin forma de girar.
 */
export function turnsFlow(type: PipeType): boolean {
	const connections = PIPE_CONNECTIONS[type];
	return connections.length === 2 && OPPOSITE_DIRECTION[connections[0]] !== connections[1];
}

/** Cuántas veces entra cada pieza en la bolsa. */
export type PipeWeights = Record<PipeType, number>;

/**
 * Reparto por defecto de la bolsa.
 *
 * Rectas y curvas aparecen seguido porque son las que arman el recorrido. El
 * cruce es una pieza de excepción, así que entra una sola vez. Es sólo el punto
 * de partida: la pantalla de configuración puede cambiar estos números.
 */
export const DEFAULT_PIPE_WEIGHTS: PipeWeights = {
	horizontal: 5,
	vertical: 5,
	curveNorthEast: 4,
	curveEastSouth: 4,
	curveSouthWest: 4,
	curveWestNorth: 4,
	cross: 1,
};

/**
 * Contenido completo de la bolsa: cada pieza repetida según su peso.
 *
 * Es el equivalente del "7-bag" de Tetris. En vez de sortear cada pieza de
 * cero, se mezcla esta bolsa y se reparte hasta vaciarla, así en cada vuelta
 * salen todas las piezas y no hay sequías de curvas.
 */
export function buildBag(weights: PipeWeights): PipeType[] {
	return PIPE_TYPES.flatMap((type) =>
		Array.from({ length: Math.max(0, Math.floor(weights[type])) }, () => type)
	);
}
