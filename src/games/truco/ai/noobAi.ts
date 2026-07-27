import type { TrucoAiProfile } from './types';

/**
 * Perfil inicial: no evalua la fuerza de las cartas ni anticipa al rival.
 * Solo elige una carta legal al azar.
 */
export const noobAi: TrucoAiProfile = {
	id: 'noob',
	nameKey: 'truco.ai.noob.name',
	descriptionKey: 'truco.ai.noob.description',
	decideCard: ({ hand, random }) => {
		if (hand.length === 0) return null;
		const index = Math.min(hand.length - 1, Math.floor(random() * hand.length));
		return hand[index];
	},
	decideEnvido: ({ random }) => random() < 0.5,
	decideTruco: ({ random }) => random() < 0.5,
};
