import { CELL, ENEMIES_PER_STAGE, FIELD, GRID, type EnemyKind } from './tuning';

/**
 * Mapas de las etapas.
 *
 * Cada mapa es una grilla de 13×13 bloques y cada bloque ocupa 4×4 celdas del
 * terreno, como en el Battle City original. Los caracteres de medio bloque
 * permiten paredes finas sin tener que dibujar la grilla completa de 52×52.
 *
 *   .  vacío            #  ladrillo         @  acero
 *   ~  agua             %  bosque
 *   [  ladrillo sólo en la mitad izquierda   ]  sólo en la derecha
 *   ^  ladrillo sólo en la mitad de arriba   _  sólo en la de abajo
 *
 * El cargador ignora lo que haya en los puntos de aparición y en la fortaleza:
 * esos bloques siempre quedan libres para que ningún mapa pueda trabar la
 * partida.
 */
export type LevelDefinition = {
	map: string[];
	/** Cantidad de enemigos de cada tipo: básico, rápido, potente y blindado. */
	lineup: Record<EnemyKind, number>;
};

export const LEVELS: LevelDefinition[] = [
	{
		map: [
			'.............',
			'.#.#.#.#.#.#.',
			'.#.#.#.#.#.#.',
			'.#.#.#@#.#.#.',
			'.#.#.....#.#.',
			'.....#.#.....',
			'@.##.....##.@',
			'.....#.#.....',
			'.#.#.###.#.#.',
			'.#.#.#.#.#.#.',
			'.#.#.....#.#.',
			'.#.#.....#.#.',
			'.............',
		],
		lineup: { basic: 18, fast: 2, power: 0, armor: 0 },
	},
	{
		map: [
			'....%%%......',
			'.##.%%%..##..',
			'.##..#..%..#.',
			'....###.%%...',
			'%%%...#.%%%#.',
			'%#%.......%..',
			'%#%.@.@.@.%.#',
			'%%%.......%%%',
			'..#.%%#%%.#..',
			'.##.%...%.##.',
			'....%.#.%....',
			'%%.#.....#.%%',
			'%%.........%%',
		],
		lineup: { basic: 14, fast: 4, power: 0, armor: 2 },
	},
	{
		map: [
			'.............',
			'.#.#.@.@.#.#.',
			'.#.#.#.#.#.#.',
			'.............',
			'~~.~~~.~~~.~~',
			'~~.~~~.~~~.~~',
			'.#.........#.',
			'.#.@#####@.#.',
			'.....]..[....',
			'#.#.#.#.#.#.#',
			'#.#.#...#.#.#',
			'...#.....#...',
			'.............',
		],
		lineup: { basic: 12, fast: 4, power: 2, armor: 2 },
	},
	{
		map: [
			'...@.....@...',
			'.#.@.###.@.#.',
			'.#...#.#...#.',
			'.#@@.....@@#.',
			'......%......',
			'@@.#.%%%.#.@@',
			'...#.%@%.#...',
			'.###.%%%.###.',
			'......%......',
			'.@.##_._##.@.',
			'.@.#.....#.@.',
			'...#.....#...',
			'.............',
		],
		lineup: { basic: 8, fast: 6, power: 2, armor: 4 },
	},
	{
		map: [
			'..#.......#..',
			'..#.###.#.#..',
			'#.#.#...#.#.#',
			'..#.#.#####..',
			'.##.#.....#.#',
			'....###.#.#..',
			'~~.#..#.#...~',
			'...#.##.###..',
			'.#.#.....#.#.',
			'.#...#.#...#.',
			'.####.^.####.',
			'.............',
			'.............',
		],
		lineup: { basic: 6, fast: 6, power: 4, armor: 4 },
	},
	{
		map: [
			'.............',
			'.@@.@@.@@.@@.',
			'.............',
			'#.@.#####.@.#',
			'#.@.......@.#',
			'..@.~~~~~.@..',
			'.....%@%.....',
			'@@.#.%%%.#.@@',
			'...#.....#...',
			'.~~#.@.@.#~~.',
			'.~~.......~~.',
			'..#.......#..',
			'..#.......#..',
		],
		lineup: { basic: 4, fast: 6, power: 4, armor: 6 },
	},
];

/** Pasadas las etapas diseñadas, los mapas son generados y vienen con esta formación. */
const VETERAN_LINEUP: Record<EnemyKind, number> = { basic: 2, fast: 6, power: 6, armor: 6 };

export function lineupForStage(stage: number): Record<EnemyKind, number> {
	return stage <= LEVELS.length ? LEVELS[stage - 1].lineup : VETERAN_LINEUP;
}

/** Bloques (columna, fila) que el cargador deja siempre libres. */
export const RESERVED_BLOCKS: Array<[number, number]> = [
	[0, 0], [6, 0], [12, 0], // aparición de enemigos
	[4, 12], [8, 12], // aparición del jugador y un hueco simétrico
	[5, 11], [6, 11], [7, 11], [5, 12], [6, 12], [7, 12], // fortaleza
];

/** Lado de un bloque del mapa, en unidades: una baldosa del original. */
export const BLOCK = 16;
export const BLOCKS = FIELD / BLOCK;
export const CELLS_PER_BLOCK = BLOCK / CELL;

/** La base (el águila) ocupa el bloque central de la última fila. */
export const BASE_CELL = { col: 6 * CELLS_PER_BLOCK, row: 12 * CELLS_PER_BLOCK };

/**
 * Ladrillos que rodean la base y que la pala convierte en acero: una pared de
 * media baldosa de espesor arriba y a los costados.
 */
export const FORTRESS_CELLS: Array<[number, number]> = [];
for (let row = BASE_CELL.row - 2; row < GRID; row += 1) {
	for (let col = BASE_CELL.col - 2; col < BASE_CELL.col + CELLS_PER_BLOCK + 2; col += 1) {
		const insideBase = row >= BASE_CELL.row
			&& col >= BASE_CELL.col && col < BASE_CELL.col + CELLS_PER_BLOCK;
		if (!insideBase) {
			FORTRESS_CELLS.push([col, row]);
		}
	}
}

export const PLAYER_SPAWN = { x: 4 * BLOCK, y: 12 * BLOCK };
export const ENEMY_SPAWNS = [
	{ x: 6 * BLOCK, y: 0 },
	{ x: 12 * BLOCK, y: 0 },
	{ x: 0, y: 0 },
];

// Un mapa mal tipeado rompería la partida sin avisar: mejor fallar al cargar.
LEVELS.forEach((level, index) => {
	const total = Object.values(level.lineup).reduce((sum, count) => sum + count, 0);
	if (level.map.length !== BLOCKS || level.map.some((row) => row.length !== BLOCKS)) {
		throw new Error(`Tanques: el mapa ${index + 1} no mide 13×13`);
	}
	if (total !== ENEMIES_PER_STAGE) {
		throw new Error(`Tanques: la etapa ${index + 1} tiene ${total} enemigos`);
	}
});
