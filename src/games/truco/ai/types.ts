import type { TranslationKey } from '../../../core/i18n/translations';
import type { Card, EnvidoCall } from '../rules';

/**
 * Datos que la partida entrega a un perfil para elegir una carta.
 * La mano es de solo lectura: el perfil propone y la partida aplica la jugada.
 */
export type AiDecisionContext = {
	hand: readonly Card[];
	random: () => number;
};

export type AiEnvidoDecisionContext = {
	call: EnvidoCall;
	random: () => number;
};

export type AiTrucoDecisionContext = {
	value: 2 | 3 | 4;
	random: () => number;
};

/** Contrato compartido por los perfiles de IA de Truco. */
export type TrucoAiProfile = {
	id: string;
	nameKey: TranslationKey;
	descriptionKey: TranslationKey;
	decideCard: (context: AiDecisionContext) => Card | null;
	decideEnvido: (context: AiEnvidoDecisionContext) => boolean;
	decideTruco: (context: AiTrucoDecisionContext) => boolean;
};
