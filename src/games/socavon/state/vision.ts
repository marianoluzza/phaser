import { LAMP_RADIUS, VISION } from '../constants/tuning';
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

type Seer = Pick<Mine, 'player' | 'level' | 'isSolid' | 'lamps' | 'guards'>;

/**
 * Lo que se ve de verdad: lo que está a la vista y además iluminado. Sin luz,
 * aunque nada lo tape, es recuerdo o negro, también en la propia galería.
 */
export function seenSpans(mine: Seer): Span[] {
	const lights = lightSpans(mine);
	const seen: Span[] = [];
	for (const view of liveSpans(mine)) {
		for (const light of lights) {
			if (light.y !== view.y) continue;
			const from = Math.max(view.from, light.from);
			const to = Math.min(view.to, light.to);
			if (from <= to) seen.push({ y: view.y, from, to });
		}
	}
	return merge(seen);
}

/** Lo iluminado: el halo y la linterna del minero, las lámparas prendidas y los encendedores. */
export function lightSpans(mine: Seer): Span[] {
	const { player } = mine;
	const x = Math.round(player.x);
	const lights: Span[] = [];
	const around = (y: number, cells: number, center = x) => lights.push({ y, from: center - cells, to: center + cells });

	// El cuerpo puede estar entre dos galerías, en la escalera.
	const body = [...new Set([Math.floor(player.y), Math.ceil(player.y)])];
	for (const y of body) around(y, VISION.halo);
	if (player.headlamp && !player.hidden) {
		if (Number.isInteger(player.y)) {
			// Parado en una galería, alumbra hacia adelante.
			const { facing } = player;
			lights.push({ y: player.y, from: Math.min(x, x + facing * VISION.headlamp), to: Math.max(x, x + facing * VISION.headlamp) });
		}
		// En la escalera, al caer o colgado, alumbra la otra punta.
		for (const { y } of liveSpans(mine)) if (y !== player.y) around(y, VISION.window);
	}
	for (const lamp of mine.lamps) if (lamp.lit) around(lamp.y, Math.floor(LAMP_RADIUS), lamp.x);
	for (const guard of mine.guards) around(Math.round(guard.y), VISION.lighter, Math.round(guard.x));
	return lights;
}

/** Une los tramos que se tocan, galería por galería. */
function merge(spans: Span[]) {
	const sorted = [...spans].sort((a, b) => a.y - b.y || a.from - b.from);
	const merged: Span[] = [];
	for (const span of sorted) {
		const last = merged[merged.length - 1];
		if (last && last.y === span.y && span.from <= last.to + 1) last.to = Math.max(last.to, span.to);
		else merged.push({ ...span });
	}
	return merged;
}
