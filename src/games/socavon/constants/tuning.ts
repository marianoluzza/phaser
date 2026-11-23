/**
 * Números del juego. Las distancias horizontales están en celdas y las
 * verticales en galerías; las velocidades, por segundo.
 */
export const START_LIVES = 3;

export const PLAYER = {
	walk: 4.4,
	/** Más lento que un sereno corriendo: para escapar hay que soltar la bolsa. */
	withBag: 3,
	withPick: 4,
	withBarrow: 3.4,
	hang: 2.6,
	climb: 1.3,
	climbLoaded: 1.05,
	fall: 2.6,
	/** Medio cuerpo, para chocar contra la roca y frenar ante un pozo. */
	radius: 0.3,
	landStun: 0.35,
	deathTime: 1.4,
	invincible: 2,
};

export const REACH = {
	take: 0.7,
	exit: 0.8,
	barrow: 0.9,
	vault: 1,
	bell: 1,
	pocket: 1.2,
	wall: 1.25,
	lamp: 1,
	contact: 0.55,
	/** Diferencia de altura que todavía cuenta como la misma galería. */
	sameFloor: 0.34,
};

export const GUARD = {
	patrol: 1.6,
	investigate: 2.4,
	chase: 3.4,
	climb: 0.85,
	alarmBoost: 1.25,
	sightLit: 8,
	sightDark: 2.2,
	/** Lo que tarda en reaccionar desde que ve algo. */
	notice: 0.4,
	/** Cuánto insiste hacia un ruido o hacia donde vio al minero. */
	persist: 14,
	searchTime: 2.4,
	stun: 4,
	relightAfter: 10,
	/** Cuánto insiste bajo alguien a quien no puede llegar. */
	stare: 1.5,
	/** Después de desistir, cuánto tarda en volver a fijarse. */
	ignore: 5,
	/** Recién levantado, la vagoneta no lo vuelve a tirar: se va del riel. */
	shaken: 4,
};

/** Radio en la misma galería; a la de arriba y la de abajo llega atenuado. */
export const NOISE = {
	pick: 11,
	barrow: 7,
	land: 6,
	throughFloor: 0.55,
	barrowEvery: 0.5,
};

export const LAMP_RADIUS = 2.5;
export const ALARM_TIME = 20;
/** Tocada a mano, para distraer: más corta que la de la bóveda. */
export const BELL_RING = 8;
export const PICK_HITS = 3;
export const PICK_COOLDOWN = 0.35;
export const BARROW_CAPACITY = 3;

export const CART = {
	speed: 6,
	wait: 2.2,
	/** Tiembla antes de salir: es el aviso para correrse del riel. */
	warning: 0.8,
	hit: 0.65,
	/** Diferencia de altura a la que atropella, igual para todos. */
	sameFloor: 0.2,
	/** Cayéndole encima se entra con una celda de margen. */
	catch: 1,
	/** Desde dónde se sube con la vagoneta detenida. */
	board: 0.9,
	/** Cuánto se corre al bajar: un poco más de lo que atropella. */
	alight: 0.7,
	/** Si no hay adónde correrse al bajar, cuánto espera para arrancar. */
	alightWait: 0.8,
};

/** El agarre del techo, sobre los rieles. */
export const GRIP = {
	/** Cubre la espera más larga entre dos pasadas y sobra más de un segundo. */
	time: 6,
	/** Segundos de brazos que vuelven por cada segundo de descanso. */
	recover: 2,
	/** Desde acá tiembla: está por caerse. */
	warning: 1.5,
	drop: 0.18,
	slipStun: 0.35,
};

export const SCORE = {
	bag: 100,
	key: 50,
	vault: 250,
	clear: 500,
	timeBonus: 300,
	timeBonusDrain: 2,
	unseen: 250,
};
