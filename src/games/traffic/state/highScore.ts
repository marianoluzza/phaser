const HIGH_SCORE_KEY = 'traffic.highScore';

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
	if (score <= readHighScore()) {
		return false;
	}
	try {
		globalThis.localStorage?.setItem(HIGH_SCORE_KEY, String(score));
	} catch {
		// El récord es un extra: la partida sigue aunque no se pueda guardar.
	}
	return true;
}
