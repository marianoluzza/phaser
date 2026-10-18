import { calculateEnvido, CARDS_PER_HAND, compareCards, createDeck, resolveHandWinner } from '../rules';
import type { Card, TrickWinner } from '../rules';
import type { AiTableView, EnvidoClue } from './types';

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

/** Si un tanto posible del rival coincide con lo que dijo al declarar. */
function fitsEnvidoClue(clue: EnvidoClue, rivalEnvido: number) {
	return clue.kind === 'declared' ? rivalEnvido === clue.points : rivalEnvido <= clue.atMost;
}

/**
 * Probabilidad aproximada de que la IA gane la mano.
 * Recorre todas las cartas que el jugador podría tener entre las que la IA no
 * vio —unas 7800 manos como mucho— y resuelve el resto de la mano enfrentando
 * las cartas en orden de fuerza. No es juego perfecto: alcanza para distinguir
 * una mano buena de una mala y para saber cuánto pesa una baza ya ganada.
 *
 * Si el jugador declaró su tanto, las manos que coinciden con lo que dijo
 * cuentan aparte. `clueTrust` es cuánto se le cree: 1 descarta las demás, 0
 * ignora la pista y en el medio se mezclan las dos estimaciones.
 */
export function estimateTrucoOdds(view: AiTableView, clueTrust = 0) {
	const mano = view.isMano ? 'ai' : 'player';
	const playedWinners = view.playedTricks.map(({ winner }) => winner);
	const decided = resolveHandWinner(playedWinners, mano);
	if (decided) return decided === 'ai' ? 1 : 0;

	const rivalShown = [...view.playedTricks.map(({ player }) => player), ...(view.opponentCard ? [view.opponentCard] : [])];
	const seen = new Set([
		...view.hand,
		...view.playedTricks.map(({ ai }) => ai),
		...(view.ownCard ? [view.ownCard] : []),
		...rivalShown,
	].map(({ id }) => id));
	const unseen = createDeck().filter(({ id }) => !seen.has(id));
	const unknownCount = CARDS_PER_HAND - rivalShown.length;
	const clue = clueTrust > 0 ? view.opponentEnvido : null;

	let hands = 0;
	let wins = 0;
	let fittingHands = 0;
	let fittingWins = 0;
	forEachCombination(unseen, unknownCount, (rivalCards) => {
		const won = playOut(view, rivalCards, playedWinners, mano);
		hands += 1;
		if (won) wins += 1;
		if (clue && fitsEnvidoClue(clue, calculateEnvido([...rivalShown, ...rivalCards]))) {
			fittingHands += 1;
			if (won) fittingWins += 1;
		}
	});

	const odds = wins / hands;
	// Una pista que ninguna mano cumple es una mentira que las cartas ya delataron.
	if (fittingHands === 0) return odds;
	return clueTrust * (fittingWins / fittingHands) + (1 - clueTrust) * odds;
}

/** Juega lo que queda de la mano contra unas cartas supuestas del rival. */
function playOut(view: AiTableView, rivalHand: readonly Card[], playedWinners: readonly TrickWinner[], mano: 'ai' | 'player') {
	const ownCards = [...view.hand];
	const rivalCards = [...rivalHand];
	const tricks = [...playedWinners];

	if (view.ownCard || view.opponentCard) {
		const ai = view.ownCard ?? respond(ownCards, view.opponentCard!);
		const player = view.opponentCard ?? respond(rivalCards, view.ownCard!);
		tricks.push(trickWinner(ai, player));
	}

	const ownSorted = sortByPower(ownCards);
	const rivalSorted = sortByPower(rivalCards);
	ownSorted.forEach((card, index) => tricks.push(trickWinner(card, rivalSorted[index])));
	return resolveHandWinner(tricks, mano) === 'ai';
}

/** Visita cada subconjunto de `count` cartas de `pool`, sin repetir ni importar el orden. */
function forEachCombination(pool: readonly Card[], count: number, visit: (cards: Card[]) => void, start = 0, picked: Card[] = []) {
	if (picked.length === count) {
		visit(picked);
		return;
	}
	for (let index = start; index <= pool.length - (count - picked.length); index += 1) {
		picked.push(pool[index]);
		forEachCombination(pool, count, visit, index + 1, picked);
		picked.pop();
	}
}

/**
 * Si gana el envido diciendo su tanto real. Siendo mano habla primero y gana
 * los empates; si no, tiene que superar lo que ya dijo el jugador.
 */
export function winsEnvido({ envidoPoints, isMano }: AiTableView, rivalPoints: number | null) {
	if (rivalPoints === null) return true;
	return isMano ? envidoPoints >= rivalPoints : envidoPoints > rivalPoints;
}
