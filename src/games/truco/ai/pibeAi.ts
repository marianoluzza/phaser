import { getEnvidoAcceptedPoints } from '../rules';
import { estimateTrucoOdds, sortByPower, strongest, weakest, weakestThatBeats } from './handStrength';
import type { TrucoAiProfile } from './types';

/**
 * Perfil intermedio: conoce el valor de las cartas y juega derecho.
 * Gana cada baza con la carta más barata posible, canta y acepta sólo con
 * buenas manos y nunca miente.
 */
export const pibeAi: TrucoAiProfile = {
	id: 'pibe',
	nameKey: 'truco.ai.pibe.name',
	descriptionKey: 'truco.ai.pibe.description',
	decideCard: ({ hand, opponentCard, playedTricks }) => {
		if (hand.length === 0) return null;
		if (opponentCard) return weakestThatBeats(hand, opponentCard) ?? weakest(hand);
		// De mano tantea con la del medio y después juega la mejor.
		if (playedTricks.length === 0 && hand.length === 3) return sortByPower(hand)[1];
		return strongest(hand);
	},
	decideCallTruco: (context) => estimateTrucoOdds(context) >= 0.7,
	decideTruco: (context) => estimateTrucoOdds(context) >= 0.4 ? 'accept' : 'reject',
	decideEnvido: ({ chain, raises, envidoPoints }) => {
		if (envidoPoints >= 31 && raises.includes('realEnvido')) return 'realEnvido';
		if (envidoPoints >= 30 && raises.includes('envido')) return 'envido';
		if (chain.includes('faltaEnvido')) return envidoPoints >= 31 ? 'accept' : 'reject';
		// Cuanto más hay en juego, más tanto pide para querer.
		const stake = getEnvidoAcceptedPoints(chain, 0);
		const needed = stake <= 2 ? 27 : stake <= 3 ? 28 : stake <= 5 ? 29 : 30;
		return envidoPoints >= needed ? 'accept' : 'reject';
	},
	decideCallEnvido: ({ envidoPoints }) => {
		if (envidoPoints >= 31) return 'realEnvido';
		if (envidoPoints >= 28) return 'envido';
		return null;
	},
};
