import Phaser from 'phaser';
import { HULL_OUTLINE, ROOMS, type RoomId, type RoomProfile } from '../constants/rooms';

/** Lado del cuadrado de un puesto, sin escalar. */
export const SLOT_SIZE = 42;

/**
 * Dónde y de qué tamaño se dibuja el plano.
 *
 * Las coordenadas de `rooms.ts` son las de la pantalla de puestos, que es donde
 * la nave se ve entera. El combate necesita la misma nave más chica y corrida a
 * un costado, así que el plano se declara una vez y cada pantalla lo ubica.
 */
export type PlanTransform = { x: number; y: number; scale: number };

export const FULL_PLAN: PlanTransform = { x: 0, y: 0, scale: 1 };

/**
 * Colores de las casillas del plano: el damero del tablero, hecho nave.
 *
 * La diferencia tiene que leerse sin buscarla, porque el alfil depende de ella.
 * Con dos azules parecidos el damero era decoración; además de separar más los
 * fondos, cada sala lleva una casilla de muestra en la esquina.
 */
const SQUARE_FILL = { light: 0x2b3372, dark: 0x111632 } as const;
const SQUARE_CHIP = { light: 0xe8ecff, dark: 0x05070f } as const;
const ROOM_BORDER = 0x4a4488;

export function planX(transform: PlanTransform, x: number): number {
	return transform.x + x * transform.scale;
}

export function planY(transform: PlanTransform, y: number): number {
	return transform.y + y * transform.scale;
}

export function drawHull(graphics: Phaser.GameObjects.Graphics, transform: PlanTransform) {
	const outline = HULL_OUTLINE.map(
		([x, y]) => new Phaser.Math.Vector2(planX(transform, x), planY(transform, y))
	);

	graphics.fillStyle(0x0b1029, 1);
	graphics.fillPoints(outline, true);
	graphics.lineStyle(2, 0x5b53a6, 0.9);
	graphics.strokePoints(outline, true);
}

export function drawRoomShell(
	graphics: Phaser.GameObjects.Graphics,
	profile: RoomProfile,
	transform: PlanTransform
) {
	const { x, y, width, height } = profile.plan;

	graphics.fillStyle(SQUARE_FILL[profile.squareColor], 1);
	graphics.fillRect(
		planX(transform, x),
		planY(transform, y),
		width * transform.scale,
		height * transform.scale
	);
	graphics.lineStyle(1, ROOM_BORDER, 0.85);
	graphics.strokeRect(
		planX(transform, x),
		planY(transform, y),
		width * transform.scale,
		height * transform.scale
	);

	const chip = 10 * transform.scale;
	const chipX = planX(transform, x + width - 9) - chip;
	const chipY = planY(transform, y + 9);
	graphics.fillStyle(SQUARE_CHIP[profile.squareColor], 1);
	graphics.fillRect(chipX, chipY, chip, chip);
	graphics.lineStyle(1, 0x8f86c8, 0.9);
	graphics.strokeRect(chipX, chipY, chip, chip);
}

/** Rectángulo de una sala en pantalla: para resaltarla y para saber si el puntero está encima. */
export function roomRect(room: RoomId, transform: PlanTransform): Phaser.Geom.Rectangle {
	const { x, y, width, height } = ROOMS[room].plan;

	return new Phaser.Geom.Rectangle(
		planX(transform, x),
		planY(transform, y),
		width * transform.scale,
		height * transform.scale
	);
}

/** Centro de un puesto: lo usan tanto el dibujo como las zonas de click. */
export function slotCenter(
	room: RoomId,
	slot: number,
	transform: PlanTransform
): { x: number; y: number } {
	const { plan, slots } = ROOMS[room];
	const spacing = SLOT_SIZE + 10;
	const first = plan.x + plan.width / 2 - ((slots - 1) * spacing) / 2;

	return {
		x: planX(transform, first + slot * spacing),
		y: planY(transform, plan.y + plan.height - SLOT_SIZE / 2 - 12),
	};
}

/**
 * Recuadro de un puesto.
 *
 * `tint` es el color con el que se marca: sirve para anticipar qué haría ahí la
 * pieza que el jugador tiene en la mano.
 */
export function drawSlotBox(
	graphics: Phaser.GameObjects.Graphics,
	x: number,
	y: number,
	size: number,
	options: { occupied: boolean; tint?: number }
) {
	const half = size / 2;
	const tint = options.tint ?? ROOM_BORDER;

	graphics.fillStyle(options.occupied ? 0x0a0f26 : 0x090c1e, options.occupied ? 1 : 0.75);
	graphics.fillRect(x - half, y - half, size, size);
	graphics.lineStyle(options.tint ? 2 : 1, tint, options.tint ? 0.95 : 0.5);
	graphics.strokeRect(x - half, y - half, size, size);
}
