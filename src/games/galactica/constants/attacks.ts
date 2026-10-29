/**
 * Catálogo de ataques. Son datos: cada familia y rango arma su repertorio
 * combinando un patrón de disparo con una maniobra.
 */

/** Cómo sale una salva enemiga. */
export type ShotKind = 'single' | 'double' | 'helix' | 'fan3' | 'fan5' | 'split';

/**
 * Cómo deja la formación una nave para atacar.
 * - swoop: rizo hacia un costado, baja hacia el jugador disparando y vuelve
 *   a su casillero entrando por arriba.
 * - dive: kamikaze en picada; avisa, se tira recto y sigue de largo.
 * - diveReturn: igual, pero vuelve a la formación.
 * - planted: kamikaze plantado; se ubica en la línea del jugador, parpadea y
 *   explota en área. Se lo puede derribar antes, pero hay que estar cerca.
 */
export type Maneuver = 'swoop' | 'dive' | 'diveReturn' | 'planted';

export type ShotSpec = {
	/** Ángulos en grados respecto de la puntería; 0 es hacia el jugador. */
	angles: number[];
	/** Desplazamiento lateral de cada disparo al salir. */
	offsets?: number[];
	speed: number;
	/** Si apunta al jugador (con un límite) o baja recto. */
	aimed: boolean;
	style: 'bolt' | 'helix' | 'split' | 'fan';
};

export const SHOTS: Record<ShotKind, ShotSpec> = {
	single: { angles: [0], speed: 230, aimed: true, style: 'bolt' },
	double: { angles: [0, 0], offsets: [-7, 7], speed: 250, aimed: false, style: 'bolt' },
	// Dos disparos que comparten la línea central y se enroscan uno alrededor del otro.
	helix: { angles: [0, 0], speed: 190, aimed: true, style: 'helix' },
	fan3: { angles: [-16, 0, 16], speed: 210, aimed: true, style: 'fan' },
	fan5: { angles: [-30, -15, 0, 15, 30], speed: 200, aimed: false, style: 'fan' },
	// Baja recto y a mitad de camino se parte en dos que se desvían a los costados.
	split: { angles: [0], speed: 200, aimed: false, style: 'split' },
};

/** Ángulo máximo con el que un disparo "apuntado" puede corregir hacia el jugador. */
export const MAX_AIM_DEGREES = 26;
export const HELIX_AMPLITUDE = 14;
export const HELIX_FREQUENCY = 7;
export const SPLIT_AFTER = 0.55;
export const SPLIT_ANGLE = 28;
