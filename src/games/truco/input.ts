import type { ControlsOptions } from '../../core/input/controls';

/**
 * El Truco elige carta con A, S y D (y canta con letras): WASD no son
 * direcciones en ninguna de sus pantallas. Se mueve con las flechas o el mando.
 */
export const TRUCO_CONTROLS: ControlsOptions = { withoutKeys: ['W', 'A', 'S', 'D'] };
