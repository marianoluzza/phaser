/**
 * Números de Semáforos. Todo se mide en píxeles de la escena (800×600) y en
 * segundos. Son valores de partida: se ajustan jugando, no por precisión.
 */

export const VIEW_WIDTH = 800;
export const VIEW_HEIGHT = 600;

/** Ancho de un carril. Una calle de doble mano mide dos. */
export const LANE_WIDTH = 44;
export const CAR_LENGTH = 36;
export const CAR_WIDTH = 20;

/** De la línea de parada al borde del cruce: ahí va la senda peatonal. */
export const STOP_LINE_GAP = 22;
/** Los coches aparecen y desaparecen un poco fuera de la pantalla. */
export const SPAWN_MARGIN = CAR_LENGTH;

/** Hueco mínimo entre el paragolpes de un coche y el del que tiene adelante. */
export const MIN_GAP = 10;
/**
 * Hay choque cuando se superponen las carrocerías, achicadas con este factor
 * para que un roce no cuente. Medir sólo la distancia entre centros dejaba que
 * dos coches que se cruzan en ángulo recto se atravesaran a la vista.
 */
export const CRASH_SHRINK = 0.85;

/**
 * Un coche frena por otro que tiene adelante, dentro de su carril y con un
 * rumbo parecido. Los que cruzan perpendiculares o de frente no se ven: chocan.
 */
export const FOLLOW_LATERAL = LANE_WIDTH * 0.6;
export const FOLLOW_MAX_ANGLE = (50 * Math.PI) / 180;

export const SPEED_MIN = 115;
export const SPEED_MAX = 150;
export const ACCELERATION = 220;
/**
 * Frenado de confort. Si al ponerse en rojo el coche ya no puede detenerse
 * antes de la línea con este frenado, sigue de largo: nunca queda clavado a
 * mitad del cruce.
 */
export const DECELERATION = 300;
/** Por debajo de esta velocidad un coche cuenta como detenido y se impacienta. */
export const STOPPED_SPEED = 6;

export const START_LIVES = 3;
/** Lo que paga un coche que nunca esperó; baja en proporción a la paciencia perdida. */
export const MAX_POINTS = 10;

export const PATIENCE_MIN = 9;
export const PATIENCE_MAX = 14;
/** Segundos de paciencia que se pierden por segundo detenido. */
export const PATIENCE_DRAIN = 1;
/** Segundos que se recuperan por segundo en marcha, hasta el valor inicial. */
export const PATIENCE_RECOVERY = 0.35;
/** Umbrales de color de la barra: verde, amarillo y rojo. */
export const PATIENCE_WARN = 0.6;
export const PATIENCE_DANGER = 0.3;

export const SPAWN_FIRST_DELAY = 0.8;
export const SPAWN_START_INTERVAL = 1.4;
/** El techo de la dificultad: nunca aparecen coches más seguido que esto. */
export const SPAWN_MIN_INTERVAL = 0.7;
/** Segundos que tarda el intervalo en ir del inicial al mínimo. */
export const SPAWN_RAMP_SECONDS = 150;
/** Variación al azar de cada intervalo, en más o en menos. */
export const SPAWN_JITTER = 0.15;

/** Proporción de coches que siguen derecho o doblan. */
export const TURN_WEIGHTS = { straight: 0.5, left: 0.25, right: 0.25 } as const;

/** Tiempo que la partida queda congelada mostrando el último golpe antes de la planilla. */
export const END_DELAY = 1.6;
