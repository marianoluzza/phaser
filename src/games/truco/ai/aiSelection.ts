import { DEFAULT_TRUCO_AI_PROFILE, TRUCO_AI_PROFILES } from './aiCatalog';
import type { TrucoAiProfile } from './types';

const STORAGE_KEY = 'truco.aiProfile';

export const RANDOM_TRUCO_AI = 'random';

/** El id de un perfil o `random`, que sortea uno al empezar cada partida. */
export type TrucoAiChoice = string;

/** Opciones del selector: los perfiles en orden de dificultad y al final el sorteo. */
export const TRUCO_AI_CHOICES: readonly TrucoAiChoice[] = [...TRUCO_AI_PROFILES.map(({ id }) => id), RANDOM_TRUCO_AI];

/** Respaldo en memoria por si el navegador bloquea el almacenamiento. */
let sessionChoice: TrucoAiChoice | null = null;

export function getTrucoAiChoice(): TrucoAiChoice {
	if (sessionChoice) return sessionChoice;
	try {
		const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
		if (stored && TRUCO_AI_CHOICES.includes(stored)) return stored;
	} catch {
		// Almacenamiento bloqueado: se juega contra el perfil por defecto.
	}
	return DEFAULT_TRUCO_AI_PROFILE.id;
}

export function setTrucoAiChoice(choice: TrucoAiChoice) {
	sessionChoice = choice;
	try {
		globalThis.localStorage?.setItem(STORAGE_KEY, choice);
	} catch {
		// La elección vale para esta sesión aunque el navegador no la guarde.
	}
}

/**
 * Resuelve la elección en el perfil que va a jugar. Con el sorteo la partida
 * no debe delatar al rival, por eso se marca como oculto.
 */
export function resolveTrucoAi(choice: TrucoAiChoice, random: () => number): { profile: TrucoAiProfile; hidden: boolean } {
	if (choice === RANDOM_TRUCO_AI) {
		const index = Math.min(TRUCO_AI_PROFILES.length - 1, Math.floor(random() * TRUCO_AI_PROFILES.length));
		return { profile: TRUCO_AI_PROFILES[index], hidden: true };
	}
	const profile = TRUCO_AI_PROFILES.find(({ id }) => id === choice) ?? DEFAULT_TRUCO_AI_PROFILE;
	return { profile, hidden: false };
}
