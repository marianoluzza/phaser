import type { PipesTuning } from './tuning';

/**
 * Progresión de dificultad.
 *
 * Cada nivel define tres cosas: cuántos tramos hay que recorrer para pasar,
 * cuánto tarda el agua en llenar un tramo y cuánto tiempo hay para construir
 * antes de que arranque. El nivel 1 es deliberadamente lento: el juego se
 * entiende mirándolo, y recién después empieza a apretar.
 *
 * Los números salen de la configuración, no de constantes fijas: la curva de
 * dificultad es justamente lo que hay que poder probar sin recompilar.
 */
export type LevelSetup = {
	level: number;
	/** Tramos mínimos para pasar de nivel. */
	goal: number;
	/** Milisegundos que tarda el agua en llenar un tramo. */
	msPerSegment: number;
	/** Tiempo para construir antes de que el agua arranque. */
	countdown: number;
};

export const FIRST_LEVEL = 1;

/** Parámetros de un nivel. El nivel crece sin techo; los valores se acotan. */
export function levelSetup(level: number, tuning: PipesTuning): LevelSetup {
	const index = Math.max(level, FIRST_LEVEL) - FIRST_LEVEL;

	return {
		level,
		goal: Math.min(tuning.goalMax, tuning.goalBase + index * tuning.goalStep),
		msPerSegment: Math.max(
			tuning.waterMin,
			Math.round(tuning.waterBase * (tuning.waterStepPercent / 100) ** index)
		),
		countdown: Math.max(tuning.countdownMin, tuning.countdownBase - index * tuning.countdownStep),
	};
}
