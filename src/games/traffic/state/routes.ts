import {
	ARM_IDS,
	TURNS,
	type ArmId,
	type CityLayout,
	type CrossingLayout,
	type ExitLayout,
	type Turn,
} from '../constants/layouts';
import { CAR_LENGTH, LANE_WIDTH, SPAWN_MARGIN, STOP_LINE_GAP } from '../constants/tuning';

/**
 * Trayectorias de los coches, generadas a partir del mapa.
 *
 * Una ruta es recta de entrada → tramo dentro del cruce → recta de salida.
 * Dentro del cruce, seguir derecho es otra recta y doblar es un cuarto de
 * circunferencia: cerrado a la derecha, abierto a la izquierda. El coche sólo
 * guarda cuánto avanzó; posición y rumbo salen de `poseAt`.
 *
 * Se circula por la derecha. El eje y apunta hacia abajo, como en la pantalla.
 */

export type Vec = { x: number; y: number };
export type Pose = { x: number; y: number; angle: number };

/** Hacia dónde se extiende cada brazo desde el centro del cruce. */
export const ARM_VECTORS: Record<ArmId, Vec> = {
	N: { x: 0, y: -1 },
	E: { x: 1, y: 0 },
	S: { x: 0, y: 1 },
	W: { x: -1, y: 0 },
};

/** La derecha de quien avanza en esa dirección. */
export function rightOf(heading: Vec): Vec {
	return { x: -heading.y, y: heading.x };
}

function armFromVector(vector: Vec): ArmId {
	return ARM_IDS.find((arm) => ARM_VECTORS[arm].x === vector.x && ARM_VECTORS[arm].y === vector.y)!;
}

/** Brazo por el que sale quien entra desde `from` y hace ese movimiento. */
export function exitArmFor(from: ArmId, turn: Turn): ArmId {
	const heading = scale(ARM_VECTORS[from], -1);
	const right = rightOf(heading);
	if (turn === 'straight') {
		return armFromVector(heading);
	}
	return armFromVector(turn === 'right' ? right : scale(right, -1));
}

/**
 * Medio ancho del cruce en cada eje. Las calles verticales (N y S) fijan el
 * ancho; las horizontales (E y O), el alto.
 */
export function crossingBox(crossing: CrossingLayout) {
	const lanes = (arm: ArmId) => Math.max(crossing.arms[arm].inLanes.length, crossing.arms[arm].outLanes);
	return {
		halfX: LANE_WIDTH * Math.max(lanes('N'), lanes('S')),
		halfY: LANE_WIDTH * Math.max(lanes('E'), lanes('W')),
	};
}

/** Distancia del centro del cruce al borde por donde entra o sale ese brazo. */
export function armEdge(crossing: CrossingLayout, arm: ArmId) {
	const box = crossingBox(crossing);
	return ARM_VECTORS[arm].x === 0 ? box.halfY : box.halfX;
}

/** Distancia del centro del cruce hasta un poco más allá del borde de la pantalla. */
export function armReach(layout: CityLayout, crossing: CrossingLayout, arm: ArmId) {
	const reach = { N: crossing.y, S: layout.height - crossing.y, W: crossing.x, E: layout.width - crossing.x }[arm];
	return reach + SPAWN_MARGIN;
}

/** Punto sobre el eje de un carril: `along` desde el centro del cruce, `lateral` hacia la derecha de `heading`. */
export function lanePoint(crossing: CrossingLayout, arm: ArmId, along: number, heading: Vec, lateral: number): Vec {
	const out = ARM_VECTORS[arm];
	const right = rightOf(heading);
	return {
		x: crossing.x + out.x * along + right.x * lateral,
		y: crossing.y + out.y * along + right.y * lateral,
	};
}

/** Distancia del eje del carril `index` a la línea que divide los sentidos. */
export function laneOffset(index: number) {
	return (index + 0.5) * LANE_WIDTH;
}

type LineSegment = { kind: 'line'; from: Vec; to: Vec; length: number; angle: number };
type ArcSegment = { kind: 'arc'; center: Vec; radius: number; start: number; sweep: number; length: number };
export type Segment = LineSegment | ArcSegment;

export type Route = {
	/** `cruce:entrada>salida:carril`, por ejemplo `centro:N>E:0`. */
	id: string;
	crossingId: string;
	entryArm: ArmId;
	exitArm: ArmId;
	turn: Turn;
	/** Semáforo que obedece: uno por acceso de cada cruce. */
	lightId: string;
	entryLaneId: string;
	exitLaneId: string;
	exit: ExitLayout;
	segments: Segment[];
	length: number;
	/** Distancia recorrida al entrar al cruce y al salir de él. */
	boxStart: number;
	boxEnd: number;
	/** Distancia recorrida por el centro de un coche detenido justo antes de la línea. */
	stopAt: number;
};

/** Identificador del semáforo de un acceso. Con varios cruces, cada uno tiene los suyos. */
export function lightIdFor(crossingId: string, arm: ArmId) {
	return `${crossingId}:${arm}`;
}

export function buildRoutes(layout: CityLayout): Route[] {
	const routes: Route[] = [];
	for (const crossing of layout.crossings) {
		for (const entryArm of ARM_IDS) {
			crossing.arms[entryArm].inLanes.forEach((lane, laneIndex) => {
				for (const turn of TURNS) {
					if (lane.turns.includes(turn)) {
						routes.push(buildRoute(layout, crossing, entryArm, laneIndex, turn));
					}
				}
			});
		}
	}
	return routes;
}

function buildRoute(layout: CityLayout, crossing: CrossingLayout, entryArm: ArmId, laneIndex: number, turn: Turn): Route {
	const exitArm = exitArmFor(entryArm, turn);
	const exitLane = Math.min(laneIndex, crossing.arms[exitArm].outLanes - 1);
	const inHeading = scale(ARM_VECTORS[entryArm], -1);
	const outHeading = ARM_VECTORS[exitArm];

	const start = lanePoint(crossing, entryArm, armReach(layout, crossing, entryArm), inHeading, laneOffset(laneIndex));
	const boxIn = lanePoint(crossing, entryArm, armEdge(crossing, entryArm), inHeading, laneOffset(laneIndex));
	const boxOut = lanePoint(crossing, exitArm, armEdge(crossing, exitArm), outHeading, laneOffset(exitLane));
	const end = lanePoint(crossing, exitArm, armReach(layout, crossing, exitArm), outHeading, laneOffset(exitLane));

	const approach = line(start, boxIn);
	const inside = turn === 'straight' ? line(boxIn, boxOut) : arc(boxIn, boxOut, inHeading);
	const leave = line(boxOut, end);
	const segments = [approach, inside, leave];

	return {
		id: `${crossing.id}:${entryArm}>${exitArm}:${laneIndex}`,
		crossingId: crossing.id,
		entryArm,
		exitArm,
		turn,
		lightId: lightIdFor(crossing.id, entryArm),
		entryLaneId: `${crossing.id}:${entryArm}:in${laneIndex}`,
		exitLaneId: `${crossing.id}:${exitArm}:out${exitLane}`,
		exit: crossing.arms[exitArm].exit,
		segments,
		length: segments.reduce((total, segment) => total + segment.length, 0),
		boxStart: approach.length,
		boxEnd: approach.length + inside.length,
		stopAt: approach.length - STOP_LINE_GAP - CAR_LENGTH / 2,
	};
}

function line(from: Vec, to: Vec): LineSegment {
	return {
		kind: 'line',
		from,
		to,
		length: Math.hypot(to.x - from.x, to.y - from.y),
		angle: Math.atan2(to.y - from.y, to.x - from.x),
	};
}

/**
 * Cuarto de circunferencia entre dos bordes del cruce. El centro es la
 * esquina donde se cortan la recta de entrada y la de salida prolongadas.
 */
function arc(from: Vec, to: Vec, heading: Vec): ArcSegment {
	const center = heading.x === 0 ? { x: to.x, y: from.y } : { x: from.x, y: to.y };
	const start = Math.atan2(from.y - center.y, from.x - center.x);
	const finish = Math.atan2(to.y - center.y, to.x - center.x);
	let sweep = finish - start;
	if (sweep > Math.PI) sweep -= Math.PI * 2;
	if (sweep < -Math.PI) sweep += Math.PI * 2;
	const radius = Math.hypot(from.x - center.x, from.y - center.y);
	return { kind: 'arc', center, radius, start, sweep, length: Math.abs(sweep) * radius };
}

/** Posición y rumbo (en radianes, 0 hacia la derecha) a `distance` del comienzo. */
export function poseAt(route: Route, distance: number): Pose {
	let remaining = Math.max(0, distance);
	for (const segment of route.segments) {
		if (remaining <= segment.length || segment === route.segments.at(-1)) {
			const t = segment.length === 0 ? 0 : remaining / segment.length;
			if (segment.kind === 'line') {
				return {
					x: segment.from.x + (segment.to.x - segment.from.x) * t,
					y: segment.from.y + (segment.to.y - segment.from.y) * t,
					angle: segment.angle,
				};
			}
			const angle = segment.start + segment.sweep * t;
			return {
				x: segment.center.x + Math.cos(angle) * segment.radius,
				y: segment.center.y + Math.sin(angle) * segment.radius,
				angle: angle + Math.sign(segment.sweep) * (Math.PI / 2),
			};
		}
		remaining -= segment.length;
	}
	return { x: 0, y: 0, angle: 0 };
}

function scale(vector: Vec, factor: number): Vec {
	return { x: vector.x * factor || 0, y: vector.y * factor || 0 };
}
