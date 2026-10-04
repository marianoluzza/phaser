/**
 * Números del combate.
 *
 * Están todos juntos y con nombre porque el balance se va a mover mucho: la
 * pantalla de configuración de la fase 6 va a leer de acá, igual que hace Pipes
 * con su `tuning.ts`.
 */
export const COMBAT_TUNING = {
	/** Casco de la nave del jugador. */
	playerHull: 20,

	/**
	 * El escudo del jugador se recarga entero al final de cada ronda.
	 *
	 * Con regeneración parcial, atacar le ganaba a defender en cualquier
	 * combinación de números: acortar el combate evitaba más daño del que
	 * llegaba a absorber un escudo que tardaba tres rondas en llenarse. Con
	 * recarga completa, la capacidad *es* lo que la sala aguanta por ronda, y
	 * poner gente en escudos pasa a valer tanto como ponerla en la armería.
	 *
	 * Es la excepción que hace que el disparo cargado del enemigo importe: lo
	 * único que atraviesa un escudo lleno es un golpe más grande que él.
	 */
	shieldRechargesFully: true,

	/** Porcentaje de evasión por cada punto de rendimiento de motores. */
	evasionPerPoint: 7,

	/** Techo de evasión: los motores nunca vuelven intocable a la nave. */
	maxEvasion: 45,

	/** Heridas que dejan a un tripulante fuera de combate. */
	woundsToDrop: 2,

	/** Daño al casco cuando abordan una nave sin nadie a quien herir. */
	emptyBoardingDamage: 2,

	/** Cuánto multiplica el disparo del enemigo después de cargar. */
	chargeMultiplier: 2,
} as const;
