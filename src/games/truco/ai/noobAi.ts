import type { EnvidoCall } from '../rules';
import type { TrucoAiProfile } from './types';

const ENVIDO_CALLS: readonly EnvidoCall[] = ['envido', 'realEnvido', 'faltaEnvido'];

/**
 * Perfil inicial: no evalua la fuerza de las cartas ni anticipa al rival.
 * Elige una carta legal al azar y canta o acepta tirando una moneda.
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
	decideCallTruco: ({ random }) => random() < 0.25,
	decideTruco: ({ random }) => random() < 0.5 ? 'accept' : 'reject',
	decideEnvido: ({ raises, random }) => {
		const roll = random();
		if (roll < 0.15 && raises.length > 0) return raises[Math.min(raises.length - 1, Math.floor(random() * raises.length))];
		return roll < 0.6 ? 'accept' : 'reject';
	},
	decideCallEnvido: ({ random }) => {
		if (random() >= 0.1) return null;
		return ENVIDO_CALLS[Math.min(ENVIDO_CALLS.length - 1, Math.floor(random() * ENVIDO_CALLS.length))];
	},
};
