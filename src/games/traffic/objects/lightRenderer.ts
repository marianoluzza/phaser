import type Phaser from 'phaser';
import { ARM_IDS, type ArmId, type CityLayout, type CrossingLayout } from '../constants/layouts';
import { LANE_WIDTH, SPAWN_MARGIN, STOP_LINE_GAP } from '../constants/tuning';
import { ARM_VECTORS, armEdge, armReach, lanePoint, lightIdFor, rightOf } from '../state/routes';
import type { LightState } from '../state/Traffic';
import { fillBand } from './cityRenderer';

/**
 * Semáforos: una caja oscura grande con la luz roja arriba y la verde abajo.
 * Cada uno va en la esquina a la derecha del carril que controla, y la línea
 * de parada de ese carril se pinta del mismo color: el estado se lee tanto
 * mirando el semáforo como mirando la calle.
 */
export const LIGHT_COLORS = {
	red: 0xff4d4d,
	green: 0x3ddc84,
	redOff: 0x3a1717,
	greenOff: 0x123a24,
	housing: 0x14171f,
	frame: 0x2c313d,
	hover: 0xf5f7ff,
};

export const HOUSING_WIDTH = 30;
export const HOUSING_HEIGHT = 64;
const LAMP_RADIUS = 10;

export type LightAnchor = {
	lightId: string;
	arm: ArmId;
	crossing: CrossingLayout;
	/** Centro de la caja. */
	x: number;
	y: number;
	/** La etiqueta con la letra va del lado opuesto a la calle horizontal. */
	tagY: number;
	/** Zona clicable: la caja y su etiqueta, con margen. */
	hitArea: { x: number; y: number; width: number; height: number };
};

export function lightAnchors(layout: CityLayout): LightAnchor[] {
	const anchors: LightAnchor[] = [];
	for (const crossing of layout.crossings) {
		for (const arm of ARM_IDS) {
			const lanes = crossing.arms[arm].inLanes.length;
			if (lanes === 0) {
				continue;
			}
			const heading = { x: -ARM_VECTORS[arm].x, y: -ARM_VECTORS[arm].y };
			const right = rightOf(heading);
			// Medias medidas de la caja sobre el eje de la marcha y a lo ancho.
			const alongHalf = heading.x === 0 ? HOUSING_HEIGHT / 2 : HOUSING_WIDTH / 2;
			const lateralHalf = heading.x === 0 ? HOUSING_WIDTH / 2 : HOUSING_HEIGHT / 2;
			const stop = lanePoint(crossing, arm, armEdge(crossing, arm) + STOP_LINE_GAP, heading, 0);
			const sideways = LANE_WIDTH * lanes + 10 + lateralHalf;
			const back = 8 + alongHalf;
			const x = stop.x + right.x * sideways - heading.x * back;
			const y = stop.y + right.y * sideways - heading.y * back;
			const above = y < crossing.y;
			const tagY = above ? y - HOUSING_HEIGHT / 2 - 15 : y + HOUSING_HEIGHT / 2 + 15;
			const top = Math.min(y - HOUSING_HEIGHT / 2, tagY - 12) - 6;
			const bottom = Math.max(y + HOUSING_HEIGHT / 2, tagY + 12) + 6;
			anchors.push({
				lightId: lightIdFor(crossing.id, arm),
				arm,
				crossing,
				x,
				y,
				tagY,
				hitArea: { x: x - 34, y: top, width: 68, height: bottom - top },
			});
		}
	}
	return anchors;
}

export function drawLight(g: Phaser.GameObjects.Graphics, anchor: LightAnchor, state: LightState, hovered: boolean) {
	const { x, y } = anchor;
	const left = x - HOUSING_WIDTH / 2;
	const top = y - HOUSING_HEIGHT / 2;

	g.fillStyle(0x000000, 0.35);
	g.fillRoundedRect(left + 3, top + 4, HOUSING_WIDTH, HOUSING_HEIGHT, 7);
	g.fillStyle(LIGHT_COLORS.housing, 1);
	g.fillRoundedRect(left, top, HOUSING_WIDTH, HOUSING_HEIGHT, 7);
	g.lineStyle(hovered ? 3 : 2, hovered ? LIGHT_COLORS.hover : LIGHT_COLORS.frame, 1);
	g.strokeRoundedRect(left, top, HOUSING_WIDTH, HOUSING_HEIGHT, 7);

	const redY = top + 17;
	const greenY = top + HOUSING_HEIGHT - 17;
	drawLamp(g, x, redY, state === 'red' ? LIGHT_COLORS.red : LIGHT_COLORS.redOff, state === 'red');
	drawLamp(g, x, greenY, state === 'green' ? LIGHT_COLORS.green : LIGHT_COLORS.greenOff, state === 'green');

	// Etiqueta de la dirección; la letra la escribe la escena.
	g.fillStyle(LIGHT_COLORS.housing, 1);
	g.fillRoundedRect(x - 13, anchor.tagY - 11, 26, 22, 5);
	g.lineStyle(1, hovered ? LIGHT_COLORS.hover : LIGHT_COLORS.frame, 1);
	g.strokeRoundedRect(x - 13, anchor.tagY - 11, 26, 22, 5);
}

function drawLamp(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, lit: boolean) {
	if (lit) {
		g.fillStyle(color, 0.22);
		g.fillCircle(x, y, LAMP_RADIUS + 7);
	}
	g.fillStyle(color, 1);
	g.fillCircle(x, y, LAMP_RADIUS);
	if (lit) {
		g.fillStyle(0xffffff, 0.55);
		g.fillCircle(x - 3, y - 3, 3);
	}
}

/** La línea de parada del acceso, del color del semáforo. */
export function drawStopLine(g: Phaser.GameObjects.Graphics, anchor: LightAnchor, state: LightState) {
	const { crossing, arm } = anchor;
	const heading = { x: -ARM_VECTORS[arm].x, y: -ARM_VECTORS[arm].y };
	const along = armEdge(crossing, arm) + STOP_LINE_GAP;
	const width = LANE_WIDTH * crossing.arms[arm].inLanes.length;
	g.fillStyle(state === 'red' ? LIGHT_COLORS.red : LIGHT_COLORS.green, 1);
	fillBand(g, lanePoint(crossing, arm, along - 1, heading, 0), lanePoint(crossing, arm, along + 5, heading, width));
}

/** Resalta los carriles que controla el semáforo bajo el puntero. */
export function drawApproachHighlight(g: Phaser.GameObjects.Graphics, layout: CityLayout, anchor: LightAnchor) {
	const { crossing, arm } = anchor;
	const heading = { x: -ARM_VECTORS[arm].x, y: -ARM_VECTORS[arm].y };
	const from = armEdge(crossing, arm) + STOP_LINE_GAP + 5;
	const to = armReach(layout, crossing, arm) - SPAWN_MARGIN;
	const width = LANE_WIDTH * crossing.arms[arm].inLanes.length;
	g.fillStyle(LIGHT_COLORS.hover, 0.14);
	fillBand(g, lanePoint(crossing, arm, from, heading, 0), lanePoint(crossing, arm, to, heading, width));
}
