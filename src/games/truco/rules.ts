export const TRUCO_TARGET_SCORE = 15;
export const CARDS_PER_HAND = 3;

export type Suit = 'espadas' | 'bastos' | 'oros' | 'copas';

export type Card = {
	id: string;
	value: number;
	suit: Suit;
	power: number;
};

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

/** La IA responde con la carta más fuerte disponible, aunque no pueda ganar. */
export function chooseAiResponse(hand: Card[]) {
	return [...hand].sort((first, second) => second.power - first.power)[0];
}
