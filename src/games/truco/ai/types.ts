import type { TranslationKey } from '../../../core/i18n/translations';
import type { Card, EnvidoCall, TrickWinner } from '../rules';

export type TrucoBet = 2 | 3 | 4;

/** Una baza ya resuelta, vista desde la mesa. */
export type AiPlayedTrick = {
	ai: Card;
	player: Card;
	winner: TrickWinner;
};

/**
 * Lo que la IA puede ver de la mesa: su mano, lo jugado y el puntaje.
 * Todo es de solo lectura: el perfil propone y la partida aplica la jugada.
 * Nunca incluye las cartas ocultas del jugador.
 */
export type AiTableView = {
	hand: readonly Card[];
	/** Carta propia en la baza actual, si ya la jugó y el jugador canta. */
	ownCard: Card | null;
	/** Carta del jugador en la baza actual, si ya la jugó. */
	opponentCard: Card | null;
	playedTricks: readonly AiPlayedTrick[];
	isMano: boolean;
	trucoValue: 1 | TrucoBet;
	/** Tanto de las tres cartas repartidas; la mano se achica al jugar. */
	envidoPoints: number;
	score: { own: number; opponent: number };
	random: () => number;
};

export type AiTrucoDecisionContext = AiTableView & { value: TrucoBet };
export type AiEnvidoDecisionContext = AiTableView & {
	/** Último canto, el que hay que responder. */
	call: EnvidoCall;
	/** Todos los cantos de la mano, en orden; el valor en juego sale de acá. */
	chain: readonly EnvidoCall[];
	/** Cantos válidos para subir; vacío después de una Falta. */
	raises: readonly EnvidoCall[];
};

/** Respuesta a un canto de truco: subir implica aceptar y cantar el siguiente. */
export type TrucoResponse = 'accept' | 'reject' | 'raise';

/** Respuesta a un envido: querer, no querer o subir con uno de `raises`. */
export type EnvidoResponse = 'accept' | 'reject' | EnvidoCall;

/** Contrato compartido por los perfiles de IA de Truco. */
export type TrucoAiProfile = {
	id: string;
	nameKey: TranslationKey;
	descriptionKey: TranslationKey;
	decideCard: (view: AiTableView) => Card | null;
	/** Si canta el truco disponible antes de jugar su carta. */
	decideCallTruco: (context: AiTrucoDecisionContext) => boolean;
	/** Respuesta a un canto del jugador; `raise` sólo se respeta si `value < 4`. */
	decideTruco: (context: AiTrucoDecisionContext) => TrucoResponse;
	/** Una subida que no esté en `raises` se toma como "quiero". */
	decideEnvido: (context: AiEnvidoDecisionContext) => EnvidoResponse;
	/** Canto de envido antes de su primera carta, o `null` para no cantar. */
	decideCallEnvido: (view: AiTableView) => EnvidoCall | null;
};
