import type { TranslationKey } from '../../../core/i18n/i18n';
import type { RoomId } from './rooms';

/**
 * Lo que el enemigo anuncia que va a hacer en la ronda.
 *
 * La intención es siempre visible. Ocultarla haría el juego más difícil, no más
 * interesante: sin saber qué viene, repartir la tripulación sería adivinar.
 */
export type EnemyIntent = 'fire' | 'charge' | 'shield' | 'board';

export const ENEMY_INTENTS: EnemyIntent[] = ['fire', 'charge', 'shield', 'board'];

export type EnemyProfile = {
	id: string;
	nameKey: TranslationKey;
	hull: number;
	/** Daño de su disparo, antes de escudos y de evasión. */
	damage: number;
	shieldCapacity: number;
	shieldRegen: number;
	/** Probabilidad de esquivar el disparo del jugador, de 0 a 1. */
	evasion: number;
	/** Se compara contra el rendimiento del puente para saber quién dispara primero. */
	initiative: number;
};

/**
 * El corsario: el enemigo con el que se aprende a jugar.
 *
 * Pega seguido y poco, así que castiga descuidar los escudos sin liquidar una
 * partida por un error suelto.
 */
export const RAIDER: EnemyProfile = {
	id: 'raider',
	nameKey: 'astro.enemy.raider',
	hull: 18,
	damage: 7,
	shieldCapacity: 4,
	shieldRegen: 1,
	evasion: 0.1,
	initiative: 2,
};

/**
 * Lo que el enemigo anuncia: qué va a hacer y contra qué sala.
 *
 * El objetivo es la mitad que hace que la ronda se juegue. Sin él, mover
 * tripulación al ver la intención no servía para nada: sacar gente de la
 * armería para reforzar escudos alargaba el combate y terminaba costando más
 * de lo que ahorraba. Con objetivo declarado, la respuesta es evacuar esa sala
 * —y perder lo que produce durante una ronda— o aguantar el golpe.
 */
export type EnemyPlan = { intent: EnemyIntent; target: RoomId | null };

/**
 * Sólo el abordaje anuncia sala, y sólo el abordaje hiere.
 *
 * La primera versión hacía que cada disparo que pasara el escudo hiriera
 * también a la sala apuntada. Sonaba bien y arruinaba el juego: cada herida
 * bajaba el escudo, lo que dejaba pasar el disparo siguiente, que hería otra
 * vez. La partida se decidía en la ronda dos y evacuar salas todo el tiempo
 * destruía la nave más rápido que el enemigo.
 *
 * Ahora cada intención tiene su propia respuesta: al disparo se le opone
 * escudo, a la carga se le opone más escudo por una ronda, y al abordaje se le
 * opone vaciar la sala.
 */

/**
 * Qué hace el corsario esta ronda.
 *
 * Reacciona a la nave del jugador en vez de sortear a ciegas: si la armería
 * está vacía se toma la ronda para cargar, y si le bajaron el escudo lo
 * levanta. Apunta a la sala que más le está rindiendo al jugador, con algo de
 * azar para que no sea del todo previsible.
 */
export function choosePlan(
	state: {
		shield: number;
		charged: boolean;
		playerDamage: number;
		occupiedRooms: Array<{ room: RoomId; output: number }>;
	},
	roll: (probability: number) => boolean,
	pick: <T>(items: readonly T[]) => T
): EnemyPlan {
	const intent = chooseIntent(state, roll);
	if (intent !== 'board') return { intent, target: null };

	return { intent, target: chooseTarget(state.occupiedRooms, roll, pick) };
}

function chooseIntent(
	state: { shield: number; charged: boolean; playerDamage: number },
	roll: (probability: number) => boolean
): EnemyIntent {
	if (state.charged) return 'fire';

	if (state.shield === 0 && state.playerDamage > 0 && roll(0.5)) return 'shield';

	// Sin armería enfrente puede tomarse el lujo de cargar el próximo disparo.
	if (state.playerDamage === 0 && roll(0.7)) return 'charge';

	if (roll(0.3)) return 'board';

	return roll(0.3) ? 'charge' : 'fire';
}

/** Apunta a la sala más productiva, pero no siempre: si no, sería un guion. */
function chooseTarget(
	occupied: Array<{ room: RoomId; output: number }>,
	roll: (probability: number) => boolean,
	pick: <T>(items: readonly T[]) => T
): RoomId | null {
	if (!occupied.length) return null;

	if (roll(0.65)) {
		return occupied.reduce((best, candidate) => (candidate.output > best.output ? candidate : best))
			.room;
	}

	return pick(occupied).room;
}
