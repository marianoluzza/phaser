import { getEnvidoAcceptedPoints, TRUCO_TARGET_SCORE } from '../rules';
import { estimateTrucoOdds, sortByPower, strongest, tieWith, weakest, weakestThatBeats } from './handStrength';
import type { AiTableView, TrucoAiProfile } from './types';

const TRUCO_BLUFF_CHANCE = 0.08;
const ENVIDO_BLUFF_CHANCE = 0.08;

/** Los empates de envido favorecen a la mano: vale como un tanto más. */
function effectiveEnvido({ envidoPoints, isMano }: AiTableView) {
	return envidoPoints + (isMano ? 1 : 0);
}

/**
 * Perfil difícil: el que se sienta en el bar desde antes de que abrieras.
 * Juega las bazas según cómo viene la mano, mira el puntaje antes de cantar o
 * aceptar, sube el truco cuando la tiene y de vez en cuando miente.
 */
export const viejoAi: TrucoAiProfile = {
	id: 'viejo',
	nameKey: 'truco.ai.viejo.name',
	descriptionKey: 'truco.ai.viejo.description',
	decideCard: ({ hand, opponentCard, playedTricks }) => {
		if (hand.length === 0) return null;
		const previous = playedTricks.at(-1)?.winner;

		if (opponentCard) {
			const winning = weakestThatBeats(hand, opponentCard);
			if (winning) return winning;
			// Tras una parda, empatar de nuevo lleva la mano a la tercera.
			if (previous === null) return tieWith(hand, opponentCard) ?? weakest(hand);
			return weakest(hand);
		}

		if (playedTricks.length === 0) return sortByPower(hand)[1] ?? strongest(hand);
		// Con una parda la baza siguiente define: no hay nada que guardar.
		if (previous === null) return strongest(hand);
		// Ganada la primera, la baja obliga al rival a gastar; si la pierde, la
		// tercera la define su mejor carta y una parda también lo favorece.
		if (playedTricks[0].winner === 'ai') return weakest(hand);
		return strongest(hand);
	},
	decideCallTruco: (context) => {
		const odds = estimateTrucoOdds(context);
		if (odds >= 0.65) return true;
		return odds < 0.35 && context.random() < TRUCO_BLUFF_CHANCE;
	},
	decideTruco: (context) => {
		const odds = estimateTrucoOdds(context);
		const { value, score } = context;
		if (value < 4 && odds >= 0.75) return 'raise';
		// Si el "no quiero" le da la partida al rival, no hay nada que perder.
		if (score.opponent + value - 1 >= TRUCO_TARGET_SCORE) return 'accept';
		// Aceptar rinde más que rechazar cuando las chances superan 1 / (2 × apuesta).
		return odds > 1 / (2 * value) + 0.1 ? 'accept' : 'reject';
	},
	decideEnvido: (context) => {
		const points = effectiveEnvido(context);
		const { chain, raises, score, random } = context;
		const behind = score.opponent - score.own;
		if (points >= 32 && behind > 0 && raises.includes('faltaEnvido')) return 'faltaEnvido';
		if (points >= 31 && raises.includes('realEnvido')) return 'realEnvido';
		if (points >= 30 && raises.includes('envido')) return 'envido';
		// La Falta perdida le da la partida al rival: sólo se arriesga si ya la
		// está perdiendo por mucho o tiene el tanto casi seguro.
		if (chain.includes('faltaEnvido')) return points >= 31 || (behind >= 10 && points >= 28) ? 'accept' : 'reject';

		const stake = getEnvidoAcceptedPoints(chain, 0);
		// Mentir sólo sale barato al principio: si no le creen, pierde poco.
		if (stake <= 2 && points < 24 && raises.includes('realEnvido') && random() < ENVIDO_BLUFF_CHANCE) return 'realEnvido';
		const needed = stake <= 2 ? 26 : stake <= 3 ? 27 : stake <= 5 ? 28 : 29;
		return points >= needed ? 'accept' : 'reject';
	},
	decideCallEnvido: (context) => {
		const points = effectiveEnvido(context);
		const { score, random } = context;
		if (points >= 32 && score.own < score.opponent) return 'faltaEnvido';
		if (points >= 30) return 'realEnvido';
		if (points >= 27) return 'envido';
		return random() < ENVIDO_BLUFF_CHANCE ? 'envido' : null;
	},
};
