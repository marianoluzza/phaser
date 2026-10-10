import { compareCards, createDeck, resolveHandWinner } from '../rules';
import type { Card, TrickWinner } from '../rules';
import type { AiTableView } from './types';

const ODDS_SAMPLES = 200;

export function sortByPower(cards: readonly Card[]) {
	return [...cards].sort((first, second) => second.power - first.power);
}

export function strongest(cards: readonly Card[]) {
	return sortByPower(cards)[0] ?? null;
}

export function weakest(cards: readonly Card[]) {
	return sortByPower(cards).at(-1) ?? null;
}

/** La carta más barata que todavía gana; así se guardan las fuertes. */
export function weakestThatBeats(cards: readonly Card[], rival: Card) {
	return sortByPower(cards).filter((card) => card.power > rival.power).at(-1) ?? null;
}

export function tieWith(cards: readonly Card[], rival: Card) {
	return cards.find((card) => card.power === rival.power) ?? null;
}

/** Respuesta razonable para ambos bandos: ganar barato o descartar la peor. */
function respond(cards: Card[], rival: Card) {
	const card = weakestThatBeats(cards, rival) ?? weakest(cards)!;
	cards.splice(cards.indexOf(card), 1);
	return card;
}

function trickWinner(ai: Card, player: Card): TrickWinner {
	const comparison = compareCards(ai, player);
	return comparison === 0 ? null : comparison > 0 ? 'ai' : 'player';
}

/**
 * Probabilidad aproximada de que la IA gane la mano.
 * Sortea muchas veces las cartas que el jugador podría tener entre las que la
 * IA no vio y resuelve el resto de la mano enfrentando las cartas en orden de
 * fuerza. No es juego perfecto: alcanza para distinguir una mano buena de una
 * mala y para saber cuánto pesa una baza ya ganada.
 */
export function estimateTrucoOdds(view: AiTableView) {
	const mano = view.isMano ? 'ai' : 'player';
	const playedWinners = view.playedTricks.map(({ winner }) => winner);
	const decided = resolveHandWinner(playedWinners, mano);
	if (decided) return decided === 'ai' ? 1 : 0;

	const seen = new Set([
		...view.hand,
		...view.playedTricks.flatMap(({ ai, player }) => [ai, player]),
		...(view.ownCard ? [view.ownCard] : []),
		...(view.opponentCard ? [view.opponentCard] : []),
	].map(({ id }) => id));
	const unseen = createDeck().filter(({ id }) => !seen.has(id));
	const remainingTricks = 3 - view.playedTricks.length;
	const unknownCount = remainingTricks - (view.opponentCard ? 1 : 0);

	let wins = 0;
	for (let sample = 0; sample < ODDS_SAMPLES; sample += 1) {
		const rivalCards = drawSample(unseen, unknownCount, view.random);
		const ownCards = [...view.hand];
		const tricks = [...playedWinners];

		if (view.ownCard || view.opponentCard) {
			const ai = view.ownCard ?? respond(ownCards, view.opponentCard!);
			const player = view.opponentCard ?? respond(rivalCards, view.ownCard!);
			tricks.push(trickWinner(ai, player));
		}

		const ownSorted = sortByPower(ownCards);
		const rivalSorted = sortByPower(rivalCards);
		ownSorted.forEach((card, index) => tricks.push(trickWinner(card, rivalSorted[index])));
		if (resolveHandWinner(tricks, mano) === 'ai') wins += 1;
	}
	return wins / ODDS_SAMPLES;
}

/** Fisher-Yates parcial: sólo mezcla las posiciones que se van a usar. */
function drawSample(pool: readonly Card[], count: number, random: () => number) {
	const cards = [...pool];
	for (let index = 0; index < count; index += 1) {
		const swapIndex = index + Math.floor(random() * (cards.length - index));
		[cards[index], cards[swapIndex]] = [cards[swapIndex], cards[index]];
	}
	return cards.slice(0, count);
}
