import { LEVELS } from '../constants/levels';
import { generateLevel } from './generator';
import type { Run } from './run';

/**
 * Qué mina toca. La campaña empieza con las hechas a mano y sigue con
 * generadas; la veta sin fin es toda generada. La dificultad es la profundidad.
 */
export function minePlan(run: Run): { id: (typeof LEVELS)[number]['id'] | null; rows: readonly string[] } {
	const handmade = run.campaign ? LEVELS[run.depth - 1] : undefined;
	if (handmade) return handmade;
	return { id: null, rows: generateLevel(run.seed, run.depth) };
}
