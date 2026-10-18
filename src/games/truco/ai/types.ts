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
 * Lo que el jugador dejó ver de su tanto al declarar el envido de esta mano.
 * Un número que perdió puede ser mentira para despistar; uno que ganó o un
 * "son buenas" se suponen ciertos.
 */
export type EnvidoClue =
	| { kind: 'declared'; points: number; won: boolean }
	/** Dijo "son buenas" ante el tanto de la IA: no lo supera. */
	| { kind: 'conceded'; atMost: number };

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
	/** Lo que el jugador reveló de su tanto; `null` si no declaró en esta mano. */
	opponentEnvido: EnvidoClue | null;
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

export type AiEnvidoDeclarationContext = AiTableView & {
	/** Tanto que ya dijo el jugador siendo mano; `null` si la IA es mano y habla primero. */
	rivalPoints: number | null;
};

/** Lo que se dice al declarar el tanto: un número, cierto o no, o "son buenas". */
export type EnvidoDeclaration = number | 'concede';

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
	/**
	 * Qué dice cuando le toca declarar el envido querido. La mano habla
	 * primero y tiene que decir un número: siendo mano, "son buenas" se toma
	 * como su tanto real.
	 */
	decideDeclareEnvido: (context: AiEnvidoDeclarationContext) => EnvidoDeclaration;
};
