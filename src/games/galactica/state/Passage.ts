import {
	FIELD_ROCKS,
	FREIGHTER,
	PASSAGE_SECONDS,
	PASSAGES,
	STORM,
	type PassageCue,
	type PassageId,
} from '../constants/passages';
import { FIELD_W, PLAYER_RADIUS, ROCK_RADIUS } from '../constants/tuning';
import type { Point } from './paths';

export type RockLine = { points: Point[]; vx: number; vy: number; gap: number };
export type Band = { axis: 'x' | 'y'; from: number; to: number };

/** Lo que tiene que alejarse una roca para dejar de tocar a la nave. */
const CLEARED = PLAYER_RADIUS + ROCK_RADIUS;

/**
 * El director de un tramo: sabe qué sale en cada momento y con qué forma, sin
 * dejar sin salida a la nave. Crear las cosas, moverlas y chocarlas es de
 * `Battle`, como con las oleadas y los eventos.
 */
export class Passage {
	readonly id: PassageId;
	time = 0;
	/** De qué lado sale lo que cruza: 1 va hacia la derecha. */
	readonly convoySide: 1 | -1;

	private next = 0;
	private wallSide: 1 | -1;
	private rowGap: number | null = null;
	private wallGap: number | null = null;
	private readonly random: () => number;

	constructor(id: PassageId, random: () => number) {
		this.id = id;
		this.random = random;
		this.convoySide = random() < 0.5 ? 1 : -1;
		this.wallSide = random() < 0.5 ? 1 : -1;
	}

	get scheduleDone() {
		return this.time >= PASSAGE_SECONDS && this.next >= PASSAGES[this.id].cues.length;
	}

	/** Lo que tiene que salir en este paso. */
	advance(dt: number): PassageCue[] {
		this.time += dt;
		const { cues } = PASSAGES[this.id];
		const due: PassageCue[] = [];
		while (this.next < cues.length && cues[this.next].at <= this.time) {
			due.push(cues[this.next]);
			this.next += 1;
		}
		return due;
	}

	/** Una fila que baja, con el hueco en algún x. */
	row(follows: boolean): RockLine {
		const { speed, startY, from, to, gap: range, shift } = FIELD_ROCKS.row;
		this.rowGap = follows && this.rowGap !== null ? this.shifted(this.rowGap, range, shift) : this.between(range);
		return {
			points: around(this.rowGap, from, to).map((x) => ({ x, y: startY })),
			vx: 0,
			vy: speed,
			gap: this.rowGap,
		};
	}

	/** Un muro que cruza de costado, con el hueco a una altura: hay que avanzar o retroceder. */
	wall(follows: boolean): RockLine {
		const { speed, startOff, from, to, gap: range, shift } = FIELD_ROCKS.wall;
		// El hueco se corre siempre, también entre pares: ninguna altura sirve dos veces seguidas.
		this.wallGap = this.wallGap === null ? this.between(range) : this.shifted(this.wallGap, range, shift);
		if (!follows) {
			this.wallSide = this.wallSide === 1 ? -1 : 1;
		}
		const x = this.wallSide === 1 ? -startOff : FIELD_W + startOff;
		return {
			points: around(this.wallGap, from, to).map((y) => ({ x, y })),
			vx: this.wallSide * speed,
			vy: 0,
			gap: this.wallGap,
		};
	}

	/** Columnas alternadas, con la de la nave entre las que caen. */
	bandsX(playerX: number): Band[] {
		const width = FIELD_W / STORM.columns;
		const hit = Math.min(STORM.columns - 1, Math.floor(playerX / width));
		const bands: Band[] = [];
		for (let column = hit % 2; column < STORM.columns; column += 2) {
			bands.push({ axis: 'x', from: column * width, to: (column + 1) * width });
		}
		return bands;
	}

	/** Una o dos de las tres franjas horizontales, con la de la nave entre las que caen. */
	bandsY(playerY: number, max: 1 | 2): Band[] {
		const { rows } = STORM;
		const hit = playerY < rows[1] ? 0 : playerY < rows[2] ? 1 : 2;
		const chosen = [hit];
		if (max === 2 && this.random() < 0.5) {
			chosen.push((hit + (this.random() < 0.5 ? 1 : 2)) % 3);
		}
		return chosen.map((row) => ({ axis: 'y', from: rows[row], to: rows[row + 1] }));
	}

	private between([min, max]: readonly [number, number]) {
		return min + this.random() * (max - min);
	}

	/** Se corre hacia el lado con lugar, entre lo mínimo y lo máximo. */
	private shifted(previous: number, range: readonly [number, number], [least, most]: readonly [number, number]) {
		const [min, max] = range;
		const direction = previous < (min + max) / 2 ? 1 : -1;
		const room = direction === 1 ? max - previous : previous - min;
		return previous + direction * this.between([least, Math.min(most, room)]);
	}
}

/** El hueco que sigue para la nave: lo siguen los pilotos del simulador y de la Galactopedia. */
export function nextGap(rocks: Array<Point & { vx: number; vy: number; gap?: number }>, player: Point) {
	let next: { axis: 'x' | 'y'; at: number; seconds: number } | null = null;
	for (const rock of rocks) {
		if (rock.gap === undefined) {
			continue;
		}
		const speed = rock.vy || rock.vx;
		const ahead = rock.vy ? player.y - rock.y : player.x - rock.x;
		// Hasta que termina de pasarla no hay que soltar el hueco.
		const seconds = (ahead + Math.sign(speed) * CLEARED) / speed;
		if (seconds > 0 && (!next || seconds < next.seconds)) {
			next = { axis: rock.vy ? 'x' : 'y', at: rock.gap, seconds };
		}
	}
	return next;
}

/** Adónde hay que estar para pegarle a la bodega: el disparo tarda y el carguero sigue andando. */
export function hatchLead(freighter: Point & { vx: number }, player: Point, bulletSpeed: number) {
	return freighter.x + freighter.vx * ((player.y - 20 - freighter.y - FREIGHTER.halfHeight) / bulletSpeed);
}

/** Posiciones de las rocas a los dos lados de un hueco, entre `from` y `to`. */
function around(gap: number, from: number, to: number) {
	const positions: number[] = [];
	for (let at = gap - FIELD_ROCKS.clear; at >= from; at -= FIELD_ROCKS.spacing) {
		positions.push(at);
	}
	for (let at = gap + FIELD_ROCKS.clear; at <= to; at += FIELD_ROCKS.spacing) {
		positions.push(at);
	}
	return positions;
}
