import { BLOCKS, LEVELS, RESERVED_BLOCKS } from '../constants/levels';
import { seededRandom } from './rng';

/**
 * Generador de mapas aleatorios.
 *
 * Produce el mismo formato que los mapas escritos a mano (13 strings de 13
 * caracteres), así que `Battle` los carga sin saber de dónde salieron. Se
 * construye la mitad izquierda con piezas sueltas —columnas, paredes, bloques,
 * paredes finas— y se refleja: la simetría es lo que hace que un mapa al azar
 * parezca diseñado.
 *
 * Un candidato sólo se acepta si los tres puntos de aparición, el jugador y el
 * frente de la base quedan conectados. Ladrillo y bosque cuentan como paso
 * (el ladrillo se rompe a tiros); acero y agua no.
 */

type Shape = { w: number; h: number; materials: string[] };

const CENTER = Math.floor(BLOCKS / 2);
const MAX_ATTEMPTS = 60;

/** Bloques que tienen que quedar unidos: apariciones, jugador y frente de la base. */
const MUST_CONNECT: Array<[number, number]> = [[0, 0], [CENTER, 0], [BLOCKS - 1, 0], [4, BLOCKS - 1], [CENTER, BLOCKS - 3]];

const MIRROR: Record<string, string> = { '[': ']', ']': '[' };

/**
 * Cuánto pesa cada material. El acero crece con la etapa: los primeros mapas
 * se pueden abrir a tiros y los últimos obligan a rodear.
 */
function materialWeights(stage: number): Record<string, number> {
	const steel = Math.min(0.32, 0.08 + (stage - 1) * 0.04);
	const water = stage >= 2 ? 0.16 : 0.06;
	const trees = 0.16;
	return { '#': 1 - steel - water - trees, '@': steel, '~': water, '%': trees };
}

function shapes(random: () => number): Shape[] {
	const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
	const thinHorizontal = random() < 0.5 ? '^' : '_';
	const thinVertical = random() < 0.5 ? '[' : ']';
	return [
		{ w: 1, h: between(2, 4), materials: ['#', '@', '~'] },
		{ w: between(2, 3), h: 1, materials: ['#', '@', '~'] },
		{ w: 2, h: 2, materials: ['#', '@', '%'] },
		{ w: 1, h: 1, materials: ['#', '@', '%'] },
		{ w: between(2, 3), h: between(2, 3), materials: ['%'] },
		{ w: between(2, 4), h: 1, materials: [thinHorizontal] },
		{ w: 1, h: between(2, 3), materials: [thinVertical] },
	];
}

function pickMaterial(random: () => number, options: string[], weights: Record<string, number>) {
	const total = options.reduce((sum, material) => sum + (weights[material] ?? 1), 0);
	let roll = random() * total;
	for (const material of options) {
		roll -= weights[material] ?? 1;
		if (roll <= 0) {
			return material;
		}
	}
	return options[options.length - 1];
}

function buildCandidate(random: () => number, stage: number) {
	const grid = Array.from({ length: BLOCKS }, () => Array<string>(BLOCKS).fill('.'));
	const reserved = new Set(RESERVED_BLOCKS.map(([col, row]) => `${col},${row}`));
	const weights = materialWeights(stage);

	// Entre un tercio y algo menos de la mitad de los bloques ocupados.
	const target = Math.round(BLOCKS * (CENTER + 1) * (0.34 + random() * 0.1));
	let filled = 0;
	for (let tries = 0; filled < target && tries < 400; tries += 1) {
		const options = shapes(random);
		const shape = options[Math.floor(random() * options.length)];
		const material = pickMaterial(random, shape.materials, weights);
		// La pieza no puede pasar de la columna central: lo demás sale del reflejo.
		const x = Math.floor(random() * (CENTER - shape.w + 2));
		const y = Math.floor(random() * (BLOCKS - shape.h + 1));

		let free = true;
		for (let dy = 0; dy < shape.h && free; dy += 1) {
			for (let dx = 0; dx < shape.w && free; dx += 1) {
				free = grid[y + dy][x + dx] === '.' && !reserved.has(`${x + dx},${y + dy}`);
			}
		}
		if (!free) {
			continue;
		}
		for (let dy = 0; dy < shape.h; dy += 1) {
			for (let dx = 0; dx < shape.w; dx += 1) {
				grid[y + dy][x + dx] = material;
			}
		}
		filled += shape.w * shape.h;
	}

	for (const row of grid) {
		for (let col = 0; col < CENTER; col += 1) {
			row[BLOCKS - 1 - col] = MIRROR[row[col]] ?? row[col];
		}
	}
	return grid;
}

function isPlayable(grid: string[][]) {
	const passable = (col: number, row: number) => grid[row][col] !== '@' && grid[row][col] !== '~';
	const [start, ...rest] = MUST_CONNECT;
	const seen = new Set([`${start[0]},${start[1]}`]);
	const queue = [start];
	while (queue.length > 0) {
		const [col, row] = queue.shift()!;
		for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
			const next: [number, number] = [col + dx, row + dy];
			const key = `${next[0]},${next[1]}`;
			if (next[0] < 0 || next[1] < 0 || next[0] >= BLOCKS || next[1] >= BLOCKS
				|| seen.has(key) || !passable(next[0], next[1])) {
				continue;
			}
			seen.add(key);
			queue.push(next);
		}
	}
	return rest.every(([col, row]) => seen.has(`${col},${row}`));
}

/** Mapa de la etapa `stage` de una partida aleatoria con semilla `seed`. */
export function generateMap(seed: number, stage: number): string[] {
	// Cada etapa tiene su propio mapa, pero todos salen de la misma semilla.
	const random = seededRandom(Math.imul(seed, 2654435761) ^ stage);
	for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
		const grid = buildCandidate(random, stage);
		if (isPlayable(grid)) {
			return grid.map((row) => row.join(''));
		}
	}
	// Prácticamente imposible, pero la partida nunca debe quedar sin mapa.
	return LEVELS[(stage - 1) % LEVELS.length].map;
}
