/** Los primeros 15 tantos son las malas; desde ahí se juega en las buenas. */
export const TRUCO_GOOD_SCORE = 15;
export const TRUCO_TARGET_SCORE = TRUCO_GOOD_SCORE * 2;
export const CARDS_PER_HAND = 3;

export type Suit = 'espadas' | 'bastos' | 'oros' | 'copas';

export type Card = {
	id: string;
	value: number;
	suit: Suit;
	power: number;
};

export type TrickWinner = 'player' | 'ai' | null;
export type EnvidoCall = 'envido' | 'realEnvido' | 'faltaEnvido';

/**
 * Escala de poder simplificada del Truco argentino.
 * El número visible no coincide siempre con la fuerza de la carta.
 */
const POWER_BY_CARD: Record<string, number> = {
	'1-espadas': 14,
	'1-bastos': 13,
	'7-espadas': 12,
	'7-oros': 11,
};

function getPower(value: number, suit: Suit) {
	const specialPower = POWER_BY_CARD[`${value}-${suit}`];
	if (specialPower !== undefined) {
		return specialPower;
	}

	if (value === 3) return 10;
	if (value === 2) return 9;
	if (value === 1) return 8;
	if (value === 12) return 7;
	if (value === 11) return 6;
	if (value === 10) return 5;
	if (value === 7) return 4;
	if (value === 6) return 3;
	if (value === 5) return 2;
	return 1;
}

export function createDeck(): Card[] {
	const suits: Suit[] = ['espadas', 'bastos', 'oros', 'copas'];
	const values = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

	return suits.flatMap((suit) => values.map((value) => ({
		id: `${value}-${suit}`,
		value,
		suit,
		power: getPower(value, suit),
	})));
}

export function shuffleDeck(cards: Card[]) {
	const shuffled = [...cards];
	for (let index = shuffled.length - 1; index > 0; index -= 1) {
		const swapIndex = Math.floor(Math.random() * (index + 1));
		[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
	}
	return shuffled;
}

export function compareCards(first: Card, second: Card) {
	return Math.sign(first.power - second.power) as -1 | 0 | 1;
}

/** Calcula el tanto: las figuras valen cero y la mejor pareja de palo suma 20. */
export function calculateEnvido(hand: readonly Card[]) {
	const valueOf = (card: Card) => card.value <= 7 ? card.value : 0;
	const cardsBySuit = new Map<Suit, Card[]>();
	for (const card of hand) {
		const cards = cardsBySuit.get(card.suit) ?? [];
		cards.push(card);
		cardsBySuit.set(card.suit, cards);
	}

	let bestPair = 0;
	for (const cards of cardsBySuit.values()) {
		if (cards.length < 2) continue;
		const pairValue = cards
			.map(valueOf)
			.sort((first, second) => second - first)
			.slice(0, 2)
			.reduce((total, value) => total + value, 20);
		bestPair = Math.max(bestPair, pairValue);
	}

	return bestPair || Math.max(0, ...hand.map(valueOf));
}

/**
 * Resuelve una mano de Truco a medida que se juegan sus bazas.
 * Una parda no pertenece a nadie: si ocurre en la primera, la siguiente baza
 * ganada decide; si ocurre en la segunda, prevalece quien ganó la primera.
 * Tres pardas favorecen a quien es mano.
 */
export function resolveHandWinner(tricks: readonly TrickWinner[], mano: Exclude<TrickWinner, null>): Exclude<TrickWinner, null> | null {
	const [first, second, third] = tricks;

	if (first === undefined) return null;

	if (first === null) {
		if (second === undefined) return null;
		if (second !== null) return second;
		if (third === undefined) return null;
		return third ?? mano;
	}

	if (second === undefined) return null;
	if (second === first || second === null) return first;
	if (third === undefined) return null;
	return third ?? first;
}
