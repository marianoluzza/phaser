import { GRIP, PLAYER } from '../constants/tuning';

/**
 * Una mina es una lista de renglones, uno por galería, y cada carácter una
 * celda. Las minas a mano y el generador escriben lo mismo, así que comparten
 * el validador, el estado y el dibujo.
 *
 *   #  roca                      .  piso
 *   H  escalera a la de abajo    h  pozo con manija en el techo
 *   %  muro rompible             n  nicho para esconderse
 *   E  parada del montacargas (la primera es la entrada)
 *   $  bolsa      T  pico        W  carretilla
 *   V  bóveda     B  campana     l  lámpara
 *   G  sereno     K  sereno con llave
 *   C  vagoneta   =  riel      A  riel con agarre en el techo
 */
export type Node = { x: number; y: number };

export type Level = {
	rows: string[];
	width: number;
	height: number;
	start: Node;
	/** Todas las celdas con un símbolo, de arriba a abajo. */
	find(symbol: string): Node[];
	at(x: number, y: number): string;
};

const SYMBOLS = '#.Hh%nE$TWVBlGKC=A';
/** Lo que no corta un riel: el resto es un tope. */
const ON_RAIL = '=CGKnlA';
/** Pegados a una parada se pisarían con subir y bajar, que también es Espacio. */
const OBJECTIVES = '$TVWBKE%';

export function parseLevel(rows: readonly string[]): Level {
	const found = new Map<string, Node[]>();
	rows.forEach((row, y) => [...row].forEach((symbol, x) => {
		found.set(symbol, [...(found.get(symbol) ?? []), { x, y }]);
	}));
	const find = (symbol: string) => found.get(symbol) ?? [];
	return {
		rows: [...rows],
		width: rows[0]?.length ?? 0,
		height: rows.length,
		start: find('E')[0] ?? { x: 1, y: 0 },
		find,
		at: (x, y) => rows[y]?.[x] ?? '#',
	};
}

/** Desde una vagoneta, hasta dónde llega su riel. */
export function railRange(level: Level, cart: Node): [number, number] {
	let from = cart.x;
	let to = cart.x;
	while (ON_RAIL.includes(level.at(from - 1, cart.y))) from -= 1;
	while (ON_RAIL.includes(level.at(to + 1, cart.y))) to += 1;
	return [from, to];
}

export type Passable = (x: number, y: number) => boolean;

/** Para quien camina sin colgarse. `open` dice si un muro ya se rompió. */
export function footing(level: Level, open: (x: number, y: number) => boolean = () => false): Passable {
	return (x, y) => {
		const symbol = level.at(x, y);
		return symbol !== '#' && symbol !== 'h' && (symbol !== '%' || open(x, y));
	};
}

const id = (level: Level, node: Node) => node.y * level.width + node.x;

function neighbours(level: Level, { x, y }: Node, passable: Passable) {
	const next = [{ x: x - 1, y }, { x: x + 1, y }];
	if (level.at(x, y) === 'H') next.push({ x, y: y + 1 });
	if (level.at(x, y - 1) === 'H') next.push({ x, y: y - 1 });
	return next.filter((node) => passable(node.x, node.y));
}

/** Todas las celdas conectadas con `from`. */
export function reachable(level: Level, from: Node, passable: Passable) {
	const seen = new Set([id(level, from)]);
	const cells = [from];
	for (const cell of cells) {
		for (const next of neighbours(level, cell, passable)) {
			if (seen.has(id(level, next))) continue;
			seen.add(id(level, next));
			cells.push(next);
		}
	}
	return { cells, has: (node: Node) => seen.has(id(level, node)) };
}

/** Camino más corto, con el origen incluido. `null` si no hay. */
export function findPath(level: Level, from: Node, isGoal: (node: Node) => boolean, passable: Passable) {
	const previous = new Map<number, Node | null>([[id(level, from), null]]);
	const queue = [from];
	for (const cell of queue) {
		if (isGoal(cell)) {
			const path: Node[] = [];
			for (let step: Node | null = cell; step; step = previous.get(id(level, step)) ?? null) path.push(step);
			return path.reverse();
		}
		for (const next of neighbours(level, cell, passable)) {
			if (previous.has(id(level, next))) continue;
			previous.set(id(level, next), cell);
			queue.push(next);
		}
	}
	return null;
}

/** Un riel, por sus dos paradas. */
export type Rail = { y: number; from: number; to: number };

/** Si al bajar se puede llegar a la entrada con el testigo tapando todo el riel. */
export function stopsHaveWayOut(level: Level, { y, from, to }: Rail) {
	const floor = footing(level);
	const pass: Passable = (a, b) => !(b === y && a >= from && a <= to) && floor(a, b);
	return [from, to].every((x) => reachable(level, { x, y }, pass).has(level.start));
}

export function stopsAreClear(level: Level, { y, from, to }: Rail) {
	return [from, to].every((x) => [x - 1, x, x + 1].every((near) => !OBJECTIVES.includes(level.at(near, y))));
}

/** De un pozo o una escalera de la galería de arriba no se cuelga un agarre. */
export function hasCeiling(level: Level, { x, y }: Node) {
	return !'hH'.includes(level.at(x, y - 1));
}

/** Lo que tapa un sereno parado: su celda y una a cada lado. */
const GUARD_BLOCK = 1;

/**
 * Las celdas con camino redundante: desde la entrada se sigue llegando aunque
 * un sereno se plante en cualquier otro lugar. Como los caminos son de ida y
 * vuelta, también vale para salir con el botín.
 *
 * `unaided` es sin romper muros. `withPick` los cuenta abiertos, salvo que
 * ese mismo sereno corte el camino al pico.
 *
 * Trabaja sobre índices y no con `reachable`: son unas 170 inundaciones por
 * mina y el generador lo corre en cada intento.
 */
export function redundantCells(level: Level) {
	const { width, height, start } = level;
	const size = width * height;
	const symbols = level.rows.join('');
	const picks = level.find('T').map((node) => id(level, node));
	const origin = id(level, start);
	const unaided = new Uint8Array(size).fill(1);
	const withPick = new Uint8Array(size).fill(1);

	const links = Array.from({ length: size }, (_, cell) => {
		const x = cell % width;
		const next: number[] = [];
		if (x > 0) next.push(cell - 1);
		if (x < width - 1) next.push(cell + 1);
		if (symbols[cell] === 'H' && cell + width < size) next.push(cell + width);
		if (cell >= width && symbols[cell - width] === 'H') next.push(cell - width);
		return next.filter((other) => symbols[other] !== '#' && symbols[other] !== 'h');
	});

	const queue = new Int32Array(size);
	const flood = (from: number, to: number, throughWalls: boolean) => {
		const seen = new Uint8Array(size);
		seen[origin] = 1;
		queue[0] = origin;
		for (let head = 0, tail = 1; head < tail; head += 1) {
			for (const next of links[queue[head]]) {
				if (seen[next] || (next >= from && next <= to)) continue;
				if (!throughWalls && symbols[next] === '%') continue;
				seen[next] = 1;
				queue[tail] = next;
				tail += 1;
			}
		}
		return seen;
	};

	for (let post = 0; post < size; post += 1) {
		if ('#h%'.includes(symbols[post])) continue;
		const x = post % width;
		const from = post - Math.min(x, GUARD_BLOCK);
		const to = post + Math.min(width - 1 - x, GUARD_BLOCK);
		if (origin >= from && origin <= to) continue;

		const walking = flood(from, to, false);
		const digging = picks.some((pick) => walking[pick]) ? flood(from, to, true) : walking;
		for (let cell = 0; cell < size; cell += 1) {
			if (cell >= from && cell <= to) continue;
			if (!walking[cell]) unaided[cell] = 0;
			if (!digging[cell]) withPick[cell] = 0;
		}
	}

	return {
		unaided: (node: Node) => unaided[id(level, node)] === 1,
		withPick: (node: Node) => withPick[id(level, node)] === 1,
	};
}

/**
 * Por qué una mina no se puede jugar; vacío si está bien.
 *
 * Una bolsa no pasa por las manijas, así que todo lo necesario tiene que
 * alcanzarse caminando. El pico también se lleva en las manos: se tiene que
 * llegar a él sin romper muros. Y donde cae quien se suelta de una manija
 * tiene que haber salida sin pico, o la partida queda trabada.
 *
 * Y nada puede quedar al final de un camino único: ver `redundantCells`.
 *
 * La vagoneta es un escape: su riel tiene agarre y sus paradas, salida y
 * Espacio libre.
 */
export function checkLevel(level: Level): string[] {
	const problems: string[] = [];
	if (level.rows.some((row) => row.length !== level.width)) return ['los renglones no miden lo mismo'];
	for (const symbol of new Set(level.rows.join(''))) {
		if (!SYMBOLS.includes(symbol)) problems.push(`símbolo desconocido: ${symbol}`);
	}
	if (level.find('E').length === 0) return [...problems, 'no hay montacargas'];

	const unaided = reachable(level, level.start, footing(level));
	const hasPick = level.find('T').some(unaided.has);
	const withPick = hasPick ? reachable(level, level.start, footing(level, () => true)) : unaided;
	const where = ({ x, y }: Node) => `(${x},${y})`;

	for (const symbol of 'E$VBW') {
		for (const node of level.find(symbol)) {
			if (!withPick.has(node)) problems.push(`${symbol} inalcanzable en ${where(node)}`);
		}
	}
	for (const symbol of 'KT') {
		for (const node of level.find(symbol)) {
			if (!unaided.has(node)) problems.push(`${symbol} detrás de un muro en ${where(node)}`);
		}
	}
	if (level.find('V').length > level.find('K').length) problems.push('faltan llaves');
	if (level.find('$').length + level.find('V').length === 0) problems.push('no hay botín');

	for (const ladder of level.find('H')) {
		const below = level.at(ladder.x, ladder.y + 1);
		// En un nicho, arriba es esconderse: no puede ser también subir.
		if ('#%hn'.includes(below)) problems.push(`escalera sin pie en ${where(ladder)}`);
	}
	// Con la barra a la mitad, cualquier pozo se cruza de una punta a la otra.
	level.rows.forEach((row, y) => {
		for (const pit of row.match(/h+/g) ?? []) {
			if ((pit.length + 1) / PLAYER.hang > GRIP.time / 2) problems.push(`pozo demasiado largo en la galería ${y}`);
		}
	});
	for (const pit of level.find('h')) {
		const landing = { x: pit.x, y: pit.y + 1 };
		if (!'#%h'.includes(level.at(landing.x, landing.y)) && !unaided.has(landing)) {
			problems.push(`pozo a un lugar sin salida en ${where(pit)}`);
		}
	}
	const redundant = redundantCells(level);
	for (const symbol of 'E$VBWKT') {
		const safe = 'KT'.includes(symbol) ? redundant.unaided : redundant.withPick;
		for (const node of level.find(symbol)) {
			if (!safe(node)) problems.push(`${symbol} con camino único en ${where(node)}`);
		}
	}
	const rails = level.find('C').map((cart) => {
		const [from, to] = railRange(level, cart);
		return { x: cart.x, y: cart.y, from, to };
	});
	const grips = level.find('A');
	for (const rail of rails) {
		const { y, from, to } = rail;
		if (to - from < 2) problems.push(`riel demasiado corto en ${where(rail)}`);
		if (!grips.some((grip) => grip.y === y && grip.x > from && grip.x < to)) {
			problems.push(`riel sin agarre en ${where(rail)}`);
		}
		if (!stopsAreClear(level, rail)) problems.push(`objetivo pegado a una parada en ${where(rail)}`);
		if (!stopsHaveWayOut(level, rail)) problems.push(`parada sin salida en ${where(rail)}`);
	}
	for (const grip of grips) {
		if (!hasCeiling(level, grip)) problems.push(`agarre sin techo en ${where(grip)}`);
		if (!rails.some((rail) => rail.y === grip.y && grip.x > rail.from && grip.x < rail.to)) {
			problems.push(`agarre fuera de un riel en ${where(grip)}`);
		}
	}
	return problems;
}
