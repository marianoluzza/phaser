import { VISION } from '../constants/tuning';
import type { Mine } from './Mine';

/** Un tramo de una galería que el minero ve en vivo, en celdas. */
export type Span = { y: number; from: number; to: number };

/**
 * Lo que el minero ve en vivo: su galería y, mientras trepa, cae o cuelga de
 * un pozo, la otra punta alrededor de él. En el medio del recorrido, las dos
 * galerías enteras. La roca y los muros cortan la vista como al sereno: se ve
 * el muro, no lo de atrás. Lo demás es recuerdo o negro, y eso lo resuelve la
 * vista.
 */
export function liveSpans(mine: Pick<Mine, 'player' | 'level' | 'isSolid'>): Span[] {
	const { player, level } = mine;
	const last = level.width - 1;
	const x = Math.round(player.x);
	const reach = (y: number, radius: number): Span[] => {
		if (y < 0 || y >= level.height || mine.isSolid(x, y)) return [];
		let from = x;
		let to = x;
		while (from > 0 && x - from < radius && !mine.isSolid(from, y)) from -= 1;
		while (to < last && to - x < radius && !mine.isSolid(to, y)) to += 1;
		return [{ y, from, to }];
	};
	const whole = (y: number) => reach(y, Infinity);
	const around = (y: number) => reach(y, VISION.window);

	const above = Math.floor(player.y);
	const part = player.y - above;
	if (part === 0) {
		// Recién arrancó: todavía no se movió, pero ya mira hacia donde va.
		let target: number | null = null;
		if (player.state === 'climb') target = player.climbTo;
		else if (player.state === 'fall') target = player.fallTo;
		else if (player.state === 'hang') target = player.y + 1;
		return target === null || target === player.y ? whole(player.y) : [...whole(player.y), ...around(target)];
	}
	if (part < VISION.middle) return [...whole(above), ...around(above + 1)];
	if (part > 1 - VISION.middle) return [...around(above), ...whole(above + 1)];
	return [...whole(above), ...whole(above + 1)];
}
