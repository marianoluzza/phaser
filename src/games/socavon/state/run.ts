import { START_LIVES } from '../constants/tuning';

const HIGH_SCORE_KEY = 'socavon.highScore';

/** Lo que pasa de una mina a la siguiente. */
export type Run = {
	score: number;
	lives: number;
	/** Número de mina dentro de la partida, desde 1. */
	depth: number;
	seed: number;
	/** Con campaña, las primeras minas son las hechas a mano. */
	campaign: boolean;
};

export function newRun(seed = 10000, campaign = true): Run {
	return { score: 0, lives: START_LIVES, depth: 1, seed, campaign };
}

/** Récord del dispositivo. Si el navegador bloquea el almacenamiento, vale 0. */
export function readHighScore() {
	try {
		const stored = Number(globalThis.localStorage?.getItem(HIGH_SCORE_KEY));
		return Number.isFinite(stored) && stored > 0 ? stored : 0;
	} catch {
		return 0;
	}
}

/** Guarda el puntaje si supera al récord y avisa si lo hizo. */
export function submitHighScore(score: number) {
	if (score <= readHighScore()) return false;
	try {
		globalThis.localStorage?.setItem(HIGH_SCORE_KEY, String(score));
	} catch {
		// El récord es un extra: la partida sigue aunque no se pueda guardar.
	}
	return true;
}
