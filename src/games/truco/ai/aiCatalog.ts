import { noobAi } from './noobAi';
import type { TrucoAiProfile } from './types';

/** Perfiles instalados. Agregar uno no exige modificar las escenas. */
export const TRUCO_AI_PROFILES: readonly TrucoAiProfile[] = [noobAi];

export const DEFAULT_TRUCO_AI_PROFILE = noobAi;
