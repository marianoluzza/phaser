import {
	checkLevel, footing, hasCeiling, parseLevel, reachable, redundantCells, stopsAreClear, stopsHaveWayOut,
	type Node, type Rail,
} from './level';
import { seededRandom } from './rng';

export const GENERATED_WIDTH = 28;
const MAX_ATTEMPTS = 600;

/**
 * Minas por semilla. Arma una candidata y la pasa por el mismo validador que
 * las hechas a mano; si no se puede completar, prueba con la siguiente. Como
 * todo sale del azar con semilla, el mismo número da siempre la misma mina.
 *
 * El orden importa: primero lo que cambia la topología (montacargas, muros,
 * pozos y escaleras), después los rieles, que necesitan tramos largos con
 * techo para el agarre y salida en las dos paradas, y al
 * final lo que se apoya en el piso, sólo donde hay camino redundante: un
 * sereno parado nunca puede cortar el único paso a un objetivo.
 */
export function generateLevel(seed: number, depth: number): string[] {
	const random = seededRandom(seed * 31 + depth);
	for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
		const rows = buildCandidate(random, depth);
		if (rows && checkLevel(parseLevel(rows)).length === 0) return rows;
	}
	throw new Error(`Socavón: la semilla ${seed} no dio una mina válida en la profundidad ${depth}`);
}

function buildCandidate(random: () => number, depth: number): string[] | null {
	const width = GENERATED_WIDTH;
	const height = 4 + Math.min(3, Math.floor((depth - 1) / 2));
	const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
	const choose = <T>(list: T[]) => list[Math.floor(random() * list.length)];

	// Galerías de largo irregular.
	const left = Array.from({ length: height }, () => between(1, 3));
	const right = Array.from({ length: height }, () => width - 1 - between(1, 3));
	const grid: string[][] = Array.from({ length: height }, (_, y) => Array.from(
		{ length: width },
		(__, x) => (x >= left[y] && x <= right[y] ? '.' : '#')
	));
	const isFloor = (x: number, y: number) => grid[y]?.[x] === '.';
	const ladderAbove = (x: number, y: number) => grid[y - 1]?.[x] === 'H';
	const isFree = (x: number, y: number) => isFloor(x, y) && !ladderAbove(x, y);

	// El montacargas para arriba y a mitad de la mina, en la misma vertical.
	const shaft = between(5, width - 6);
	grid[0][shaft] = 'E';
	grid[Math.floor(height / 2)][shaft] = 'E';

	for (let y = 1; y < height; y += 1) {
		const roll = random();
		if (roll > 0.8) continue;
		const size = roll < 0.4 ? 1 : between(2, 3);
		const x = between(left[y] + 4, right[y] - 4 - size);
		if (Math.abs(x - shaft) < 4) continue;
		for (let i = 0; i < size; i += 1) grid[y][x + i] = roll < 0.4 ? '%' : 'h';
	}

	// Tres escaleras por galería: una en cada punta y otra en el medio. Las de
	// las puntas son las que evitan los caminos sin salida.
	for (let y = 0; y < height - 1; y += 1) {
		const from = Math.max(left[y], left[y + 1]);
		const to = Math.min(right[y], right[y + 1]);
		for (const [first, last] of [[from, from + 4], [from + 7, to - 7], [to - 4, to]]) {
			const options: number[] = [];
			for (let x = first; x <= last; x += 1) {
				// Separadas, o un solo sereno taparía dos.
				const crowded = [-2, -1, 0, 1, 2].some((d) => grid[y][x + d] === 'H')
					|| [-1, 0, 1].some((d) => ladderAbove(x + d, y));
				if (!crowded && x !== shaft && isFloor(x, y) && isFloor(x, y + 1)) options.push(x);
			}
			if (!options.length) return null;
			grid[y][choose(options)] = 'H';
		}
	}

	const rails = depth >= 2 ? Math.min(2, Math.ceil(depth / 4)) : 0;
	/** Las paradas y lo que tienen pegado: ahí no va nada más. */
	const stops: Node[] = [];
	let laid = 0;
	for (let y = height - 1; y >= 1 && laid < rails; y -= 1) {
		const runs: [number, number][] = [];
		let start = -1;
		for (let x = 0; x <= width; x += 1) {
			if (isFree(x, y)) {
				if (start < 0) start = x;
			} else {
				if (start >= 0 && x - start >= 6) runs.push([start, x - start]);
				start = -1;
			}
		}
		if (!runs.length) continue;
		const ground = parseLevel(grid.map((row) => row.join('')));
		const wanted = between(6, 9);
		const options: (Rail & { grips: number[] })[] = [];
		for (const [first, free] of runs) {
			const length = Math.min(free, wanted);
			for (let from = first; from + length <= first + free; from += 1) {
				const rail = { y, from, to: from + length - 1 };
				// El agarre, a dos celdas del nicho y nunca en una parada.
				const middle = from + Math.floor(length / 2);
				const grips = [middle - 2, middle + 2].filter((x) => (
					x > rail.from && x < rail.to && hasCeiling(ground, { x, y })
				));
				if (grips.length && stopsAreClear(ground, rail) && stopsHaveWayOut(ground, rail)) {
					options.push({ ...rail, grips });
				}
			}
		}
		if (!options.length) continue;
		const { from, to, grips } = choose(options);
		for (let x = from; x <= to; x += 1) grid[y][x] = '=';
		grid[y][from] = 'C';
		// Un nicho en el medio: dónde meterse cuando viene.
		grid[y][from + Math.floor((to - from + 1) / 2)] = 'n';
		grid[y][choose(grips)] = 'A';
		for (const x of [from - 1, from, from + 1, to - 1, to, to + 1]) stops.push({ x, y });
		laid += 1;
	}

	const level = parseLevel(grid.map((row) => row.join('')));
	const unaided = reachable(level, level.start, footing(level)).cells;
	const withPick = reachable(level, level.start, footing(level, () => true)).cells;

	/** Lo pone en una celda libre y, si puede, sin nada especial pegado. */
	const place = (symbol: string, pool: Node[], accept: (node: Node) => boolean = () => true) => {
		const free = pool.filter((node) => (
			isFree(node.x, node.y) && accept(node) && !stops.some((stop) => stop.x === node.x && stop.y === node.y)
		));
		const airy = free.filter(({ x, y }) => [x - 1, x + 1].every((side) => '.#H=%h'.includes(grid[y][side])));
		const options = airy.length ? airy : free;
		if (!options.length) return null;
		const node = choose(options);
		grid[node.y][node.x] = symbol;
		return node;
	};

	const farFromEntrance = (node: Node) => node.y >= 1 && (node.y > 1 || Math.abs(node.x - shaft) >= 6);
	const safeUnaided = unaided.filter(redundantCells(level).unaided);
	if (level.find('%').length && !place('T', safeUnaided)) return null;
	// Se calcula de nuevo con el pico puesto: de él depende qué muros cuentan.
	const redundant = redundantCells(parseLevel(grid.map((row) => row.join(''))));
	if (!level.find('E').every(redundant.withPick)) return null;
	const safe = withPick.filter(redundant.withPick);

	const vaults = depth >= 6 ? 2 : 1;
	for (let i = 0; i < vaults; i += 1) {
		const vault = place('V', safe, (node) => node.y >= height - 1 - i);
		if (!vault || !place('K', safeUnaided, farFromEntrance)) return null;
		if (!place('B', safe, (node) => node.y === vault.y && node.x !== vault.x)) return null;
	}

	const guards = Math.min(3, Math.floor(depth / 2));
	for (let i = 0; i < guards; i += 1) {
		if (!place('G', unaided, farFromEntrance)) return null;
	}

	const bags = Math.min(8, 3 + depth);
	for (let i = 0; i < bags; i += 1) {
		if (!place('$', safe, (node) => node.y === i % height) && !place('$', safe)) return null;
	}

	place('W', safeUnaided, (node) => node.y === Math.floor(height / 2) || node.y === 0);
	for (let y = 0; y < height; y += 1) {
		const middle = (left[y] + right[y]) / 2;
		place('l', withPick, (node) => node.y === y && node.x < middle);
		place('l', withPick, (node) => node.y === y && node.x >= middle);
		if (y > 0) place('n', withPick, (node) => node.y === y);
	}

	return grid.map((row) => row.join(''));
}
