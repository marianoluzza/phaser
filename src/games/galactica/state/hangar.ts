import { SHIP_IDS, SHIPS, type ShipId } from '../constants/ships';

const HANGAR_KEY = 'galactica.hangar';
const HIGH_SCORE_KEY = 'galactica.highScore';

/**
 * Lo que queda entre partidas: las naves conseguidas y el récord.
 * Si el navegador bloquea el almacenamiento, sólo está la nave inicial.
 */
export function readHangar(): Set<ShipId> {
	const ships = new Set<ShipId>(SHIP_IDS.filter((id) => SHIPS[id].unlockZone === 0));
	try {
		const stored = JSON.parse(globalThis.localStorage?.getItem(HANGAR_KEY) ?? '[]');
		if (Array.isArray(stored)) {
			for (const id of stored) {
				if (SHIP_IDS.includes(id)) {
					ships.add(id);
				}
			}
		}
	} catch {
		// Un valor roto o inaccesible equivale a un hangar nuevo.
	}
	return ships;
}

/** Vencer al jefe de una zona desbloquea las naves que la piden. Devuelve las nuevas. */
export function unlockAfterZone(zone: number): ShipId[] {
	const hangar = readHangar();
	const fresh = SHIP_IDS.filter((id) => SHIPS[id].unlockZone > 0 && SHIPS[id].unlockZone <= zone && !hangar.has(id));
	if (fresh.length === 0) {
		return [];
	}
	fresh.forEach((id) => hangar.add(id));
	try {
		globalThis.localStorage?.setItem(HANGAR_KEY, JSON.stringify([...hangar]));
	} catch {
		// El desbloqueo vale para esta sesión aunque no se pueda guardar.
	}
	return fresh;
}

export function readHighScore() {
	try {
		const stored = Number(globalThis.localStorage?.getItem(HIGH_SCORE_KEY));
		return Number.isFinite(stored) && stored > 0 ? stored : 0;
	} catch {
		return 0;
	}
}

/** Guarda el puntaje si supera al récord y avisa si lo hizo. */
export function submitHighScore(score: number) {
	if (score <= readHighScore()) {
		return false;
	}
	try {
		globalThis.localStorage?.setItem(HIGH_SCORE_KEY, String(score));
	} catch {
		// El récord es un extra.
	}
	return true;
}
