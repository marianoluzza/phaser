import type Phaser from 'phaser';
import { ARM_IDS, type ArmId, type CityLayout, type CrossingLayout, type ExitLayout } from '../constants/layouts';
import { LANE_WIDTH, SPAWN_MARGIN, STOP_LINE_GAP } from '../constants/tuning';
import { ARM_VECTORS, armEdge, armReach, crossingBox, lanePoint, laneOffset, type Vec } from '../state/routes';

/**
 * El escenario fijo: veredas, edificios, calzada, marcas viales y salidas.
 * Se dibuja una vez con `Graphics` vectoriales, que se rasterizan a la
 * resolución real del canvas y se ven nítidos con cualquier zoom.
 *
 * La ciudad va en tonos neutros para que resalten los coches y los semáforos.
 */
export const CITY_COLORS = {
	sidewalk: 0x7b8291,
	curb: 0x5a606d,
	asphalt: 0x343944,
	marking: 0xe8ebf2,
	roofs: [0x4a5163, 0x5a504c, 0x46545a, 0x585766, 0x4f4a5c, 0x52594f],
	roofDetail: 0x8a90a0,
	tree: 0x4c6b48,
	treeLight: 0x5f8259,
};

const SIDEWALK = 14;

type Rect = { x: number; y: number; width: number; height: number };

export function drawCity(g: Phaser.GameObjects.Graphics, layout: CityLayout) {
	g.clear();
	g.fillStyle(CITY_COLORS.sidewalk, 1);
	g.fillRect(0, 0, layout.width, layout.height);

	for (const crossing of layout.crossings) {
		const random = seeded(crossing.x * 31 + crossing.y);
		for (const block of blocksAround(layout, crossing)) {
			drawBlock(g, block, random);
		}
		drawRoads(g, layout, crossing);
		for (const arm of ARM_IDS) {
			drawArmMarkings(g, layout, crossing, arm);
		}
	}
}

/** Las cuatro manzanas que dejan las calles alrededor de un cruce. */
function blocksAround(layout: CityLayout, crossing: CrossingLayout): Rect[] {
	const { halfX, halfY } = crossingBox(crossing);
	const left = crossing.x - halfX;
	const right = crossing.x + halfX;
	const top = crossing.y - halfY;
	const bottom = crossing.y + halfY;
	return [
		{ x: 0, y: 0, width: left, height: top },
		{ x: right, y: 0, width: layout.width - right, height: top },
		{ x: 0, y: bottom, width: left, height: layout.height - bottom },
		{ x: right, y: bottom, width: layout.width - right, height: layout.height - bottom },
	];
}

/** Una manzana: el cordón, edificios vistos desde arriba y algún árbol en la vereda. */
function drawBlock(g: Phaser.GameObjects.Graphics, block: Rect, random: () => number) {
	const inner = {
		x: block.x + SIDEWALK,
		y: block.y + SIDEWALK,
		width: block.width - SIDEWALK * 2,
		height: block.height - SIDEWALK * 2,
	};
	g.lineStyle(2, CITY_COLORS.curb, 1);
	g.strokeRect(block.x + 1, block.y + 1, block.width - 2, block.height - 2);

	// Se parte la manzana en edificios a lo largo de su lado más largo.
	const horizontal = inner.width >= inner.height;
	const total = horizontal ? inner.width : inner.height;
	const count = Math.max(2, Math.round(total / 110));
	const gap = 6;
	const weights = Array.from({ length: count }, () => 0.7 + random() * 0.6);
	const sum = weights.reduce((a, b) => a + b, 0);
	let offset = 0;
	weights.forEach((weight, index) => {
		const size = ((total - gap * (count - 1)) * weight) / sum;
		const building = horizontal
			? { x: inner.x + offset, y: inner.y, width: size, height: inner.height }
			: { x: inner.x, y: inner.y + offset, width: inner.width, height: size };
		drawBuilding(g, building, CITY_COLORS.roofs[Math.floor(random() * CITY_COLORS.roofs.length)], random);
		offset += size + gap;
		if (index < count - 1) {
			drawTree(g, horizontal ? inner.x + offset - gap / 2 : block.x + SIDEWALK / 2, horizontal ? block.y + SIDEWALK / 2 : inner.y + offset - gap / 2);
		}
	});
}

function drawBuilding(g: Phaser.GameObjects.Graphics, rect: Rect, color: number, random: () => number) {
	g.fillStyle(0x000000, 0.25);
	g.fillRect(rect.x + 3, rect.y + 3, rect.width, rect.height);
	g.fillStyle(color, 1);
	g.fillRect(rect.x, rect.y, rect.width, rect.height);
	// El parapeto: un borde más claro y la azotea un poco más oscura.
	g.lineStyle(3, lighten(color, 0.18), 1);
	g.strokeRect(rect.x + 1.5, rect.y + 1.5, rect.width - 3, rect.height - 3);

	g.fillStyle(CITY_COLORS.roofDetail, 0.75);
	const units = 1 + Math.floor(random() * 3);
	for (let index = 0; index < units; index += 1) {
		const width = 12 + random() * 14;
		const height = 9 + random() * 8;
		const x = rect.x + 8 + random() * Math.max(0, rect.width - width - 16);
		const y = rect.y + 8 + random() * Math.max(0, rect.height - height - 16);
		g.fillRect(x, y, width, height);
	}
	if (random() < 0.5 && rect.width > 50 && rect.height > 50) {
		// Un tanque de agua.
		g.fillStyle(lighten(color, 0.3), 1);
		g.fillCircle(rect.x + rect.width - 20, rect.y + rect.height - 20, 8);
	}
}

function drawTree(g: Phaser.GameObjects.Graphics, x: number, y: number) {
	g.fillStyle(CITY_COLORS.tree, 1);
	g.fillCircle(x, y, 10);
	g.fillStyle(CITY_COLORS.treeLight, 1);
	g.fillCircle(x - 2.5, y - 2.5, 5.5);
}

function drawRoads(g: Phaser.GameObjects.Graphics, layout: CityLayout, crossing: CrossingLayout) {
	const { halfX, halfY } = crossingBox(crossing);
	g.fillStyle(CITY_COLORS.asphalt, 1);
	g.fillRect(crossing.x - halfX, 0, halfX * 2, layout.height);
	g.fillRect(0, crossing.y - halfY, layout.width, halfY * 2);
}

/** Línea divisoria, senda peatonal y línea de parada de un brazo. */
function drawArmMarkings(g: Phaser.GameObjects.Graphics, layout: CityLayout, crossing: CrossingLayout, arm: ArmId) {
	const out = ARM_VECTORS[arm];
	const edge = armEdge(crossing, arm);
	const reach = armReach(layout, crossing, arm) - SPAWN_MARGIN;
	const armLayout = crossing.arms[arm];
	const inHeading = { x: -out.x, y: -out.y };
	const at = (along: number, lateral: number) => lanePoint(crossing, arm, along, inHeading, lateral);

	// Divisoria: continua cerca del cruce, discontinua más lejos.
	const solidUntil = edge + STOP_LINE_GAP + 60;
	g.fillStyle(CITY_COLORS.marking, 0.85);
	fillBand(g, at(edge + STOP_LINE_GAP, -1), at(solidUntil, 1));
	for (let along = solidUntil + 12; along < reach; along += 28) {
		fillBand(g, at(along, -1), at(Math.min(reach, along + 14), 1));
	}

	// Senda peatonal: franjas paralelas a la marcha a lo ancho de la calle.
	const width = LANE_WIDTH * (armLayout.inLanes.length + armLayout.outLanes);
	const fromLateral = -LANE_WIDTH * armLayout.outLanes;
	g.fillStyle(CITY_COLORS.marking, 0.8);
	for (let lateral = fromLateral + 4; lateral + 6 <= fromLateral + width - 2; lateral += 12) {
		fillBand(g, at(edge + 3, lateral), at(edge + STOP_LINE_GAP - 3, lateral + 6));
	}

	// Línea de parada, sólo sobre los carriles que llegan.
	if (armLayout.inLanes.length > 0) {
		g.fillStyle(CITY_COLORS.marking, 1);
		fillBand(g, at(edge + STOP_LINE_GAP, 0), at(edge + STOP_LINE_GAP + 4, LANE_WIDTH * armLayout.inLanes.length));
	}
}

/** Rectángulo alineado a los ejes entre dos esquinas cualesquiera. */
export function fillBand(g: Phaser.GameObjects.Graphics, a: Vec, b: Vec) {
	g.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export type ExitSign = {
	exit: ExitLayout;
	/** Centro del cartel, sobre la vereda junto al carril de salida. */
	x: number;
	y: number;
	/** Hacia dónde se va por esa salida. */
	direction: Vec;
	/** Punto del carril de salida junto al borde de la pantalla. */
	lane: Vec;
};

/** Un cartel por salida, cerca del borde, del lado derecho de quien se va. */
export function exitSigns(layout: CityLayout): ExitSign[] {
	const signs: ExitSign[] = [];
	for (const crossing of layout.crossings) {
		for (const arm of ARM_IDS) {
			const armLayout = crossing.arms[arm];
			if (armLayout.outLanes === 0) {
				continue;
			}
			const out = ARM_VECTORS[arm];
			const along = armReach(layout, crossing, arm) - SPAWN_MARGIN - 28;
			const sideways = laneOffset(armLayout.outLanes - 1) + LANE_WIDTH / 2 + 18;
			signs.push({
				exit: armLayout.exit,
				...lanePoint(crossing, arm, along, out, sideways),
				direction: out,
				lane: lanePoint(crossing, arm, along + 10, out, laneOffset(0)),
			});
		}
	}
	return signs;
}

/** Chevrones del color de la salida sobre el carril y el cartel con su letra (la letra la pone la escena). */
export function drawExitSigns(g: Phaser.GameObjects.Graphics, signs: ExitSign[]) {
	for (const sign of signs) {
		const { x: dx, y: dy } = sign.direction;
		const side = { x: -dy, y: dx };
		g.lineStyle(4, sign.exit.color, 0.9);
		for (const step of [0, 12]) {
			const tip = { x: sign.lane.x + dx * (step + 6), y: sign.lane.y + dy * (step + 6) };
			g.beginPath();
			g.moveTo(tip.x - dx * 8 + side.x * 9, tip.y - dy * 8 + side.y * 9);
			g.lineTo(tip.x, tip.y);
			g.lineTo(tip.x - dx * 8 - side.x * 9, tip.y - dy * 8 - side.y * 9);
			g.strokePath();
		}

		g.fillStyle(0x000000, 0.35);
		g.fillRoundedRect(sign.x - 13, sign.y - 11, 28, 28, 6);
		g.fillStyle(sign.exit.color, 1);
		g.fillRoundedRect(sign.x - 14, sign.y - 14, 28, 28, 6);
		g.lineStyle(2, 0x0b0f18, 0.6);
		g.strokeRoundedRect(sign.x - 14, sign.y - 14, 28, 28, 6);
	}
}

/** Color de texto legible sobre un fondo: oscuro sobre claros, blanco sobre oscuros. */
export function inkFor(color: number) {
	const r = (color >> 16) & 0xff;
	const g = (color >> 8) & 0xff;
	const b = color & 0xff;
	return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#0b0f18' : '#ffffff';
}

export function lighten(color: number, amount: number) {
	const channel = (shift: number) => {
		const value = (color >> shift) & 0xff;
		return Math.round(value + (255 - value) * amount);
	};
	return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

export function darken(color: number, amount: number) {
	const channel = (shift: number) => Math.round(((color >> shift) & 0xff) * (1 - amount));
	return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

/** Azar con semilla: la ciudad se dibuja igual en el título, en la partida y en el final. */
function seeded(seed: number) {
	let state = seed >>> 0;
	return () => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
		return state / 4294967296;
	};
}
