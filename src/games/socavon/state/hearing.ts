import { HEARING, NOISE } from '../constants/tuning';
import type { Mine, MineEvent } from './Mine';

/**
 * Lo que el minero oye: el espejo de cómo lo oye el sereno (`Mine.makeNoise`).
 * Entero en su galería, atenuado en la de arriba y la de abajo, y a través de
 * muros y roca: el oído no depende de lo que se ve.
 */
export type Heard = {
	kind: 'walk' | 'run' | 'cart' | 'bell';
	x: number;
	y: number;
	/** De 1, encima, a casi 0 en el borde del alcance. */
	loudness: number;
	/** De -1, a la izquierda, a 1, a la derecha. */
	pan: number;
	/** Quién suena, para que la vista lleve el compás de cada uno. */
	source: object;
};

type Listener = Pick<Mine, 'player'>;

/** Distancia en celdas a la que el paneo llega al costado. */
const PAN_SPREAD = 6;

/** Cuánto se oye un sonido de alcance `radius` en (x, y). 0 es que no llega. */
export function loudnessAt(mine: Listener, x: number, y: number, radius: number) {
	const { player } = mine;
	const floors = Math.abs(y - player.y);
	if (floors >= 1.5) return 0;
	const sameFloor = floors < 0.5;
	const reach = sameFloor ? radius : radius * NOISE.throughFloor;
	const distance = Math.abs(x - player.x);
	if (distance > reach) return 0;
	return (1 - distance / (reach + 1)) * (sameFloor ? 1 : NOISE.throughFloor);
}

export function heard(mine: Pick<Mine, 'player' | 'guards' | 'carts' | 'bells' | 'alarm'>): Heard[] {
	const sounds: Heard[] = [];
	const add = (kind: Heard['kind'], x: number, y: number, radius: number, source: object) => {
		const loudness = loudnessAt(mine, x, y, radius);
		if (loudness <= 0) return;
		const pan = Math.max(-1, Math.min(1, (x - mine.player.x) / PAN_SPREAD));
		sounds.push({ kind, x, y, loudness, pan, source });
	};
	for (const guard of mine.guards) {
		if (!guard.moving || guard.mode === 'stunned') continue;
		const running = guard.mode === 'chase' || guard.mode === 'investigate';
		add(running ? 'run' : 'walk', guard.x, guard.y, running ? HEARING.run : HEARING.walk, guard);
	}
	for (const cart of mine.carts) {
		if (cart.waitFor <= 0) add('cart', cart.x, cart.y, HEARING.cart, cart);
	}
	if (mine.alarm > 0) for (const bell of mine.bells) add('bell', bell.x, bell.y, HEARING.bell, bell);
	return sounds;
}

/** Los sonidos de los demás llegan según el oído; los del minero y los avisos, siempre. */
const OTHERS: Partial<Record<MineEvent['type'], number>> = {
	cartStart: HEARING.cart,
	stunned: HEARING.cart,
	relight: HEARING.relight,
};

export function eventLoudness(mine: Listener, event: MineEvent) {
	const radius = OTHERS[event.type];
	return radius === undefined ? 1 : loudnessAt(mine, event.x, event.y, radius);
}
