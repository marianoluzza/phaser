import { noobAi } from './noobAi';
import { pibeAi } from './pibeAi';
import type { TrucoAiProfile } from './types';
import { viejoAi } from './viejoAi';

/** Perfiles instalados, de menor a mayor dificultad. Agregar uno no exige modificar las escenas. */
export const TRUCO_AI_PROFILES: readonly TrucoAiProfile[] = [noobAi, pibeAi, viejoAi];

export const DEFAULT_TRUCO_AI_PROFILE = noobAi;
