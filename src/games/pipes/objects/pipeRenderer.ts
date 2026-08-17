import type Phaser from 'phaser';
import {
	exitDirection,
	PIPE_CONNECTIONS,
	type Direction,
	type PipeType,
} from '../constants/pipeTypes';

/** Colores compartidos por el tablero, la cola y la portada del juego. */
export const PIPE_COLORS = {
	casing: 0x2a3f63,
	interior: 0x5ee48a,
	crossInterior: 0xffca4b,
	water: 0x46d9ff,
	source: 0xff9f43,
} as const;

type DrawOptions = {
	/** Permite dibujar la vista previa translúcida bajo el cursor. */
	alpha?: number;
};

/**
 * Dibuja una pieza centrada en un punto.
 *
 * La forma se deduce de sus conexiones: cada borde abierto es un brazo que sale
 * del centro. Por eso agregar una pieza nueva sólo requiere declarar sus
 * direcciones en `PIPE_CONNECTIONS`, sin escribir un dibujo aparte.
 */
export function drawPipe(
	graphics: Phaser.GameObjects.Graphics,
	centerX: number,
	centerY: number,
	size: number,
	type: PipeType,
	options: DrawOptions = {}
) {
	const alpha = options.alpha ?? 1;
	const half = size / 2;
	const interior = Math.max(4, Math.round(size * 0.3));
	const casing = interior + Math.max(4, Math.round(size * 0.14));
	const connections = PIPE_CONNECTIONS[type];
	const interiorColor = type === 'cross' ? PIPE_COLORS.crossInterior : PIPE_COLORS.interior;

	// Primero la carcasa completa y después el interior: así las uniones del
	// centro quedan limpias sin calcular esquinas.
	drawArms(graphics, centerX, centerY, half, connections, casing, PIPE_COLORS.casing, alpha);
	drawArms(graphics, centerX, centerY, half, connections, interior, interiorColor, alpha);
}

/**
 * Dibuja el agua dentro de una pieza.
 *
 * El llenado tiene dos mitades: de 0 a 0.5 avanza desde el borde de entrada
 * hasta el centro, y de 0.5 a 1 sigue desde el centro hasta el borde de salida.
 * Una celda ya recorrida es, simplemente, `progress = 1`.
 */
export function drawPipeFill(
	graphics: Phaser.GameObjects.Graphics,
	centerX: number,
	centerY: number,
	size: number,
	type: PipeType,
	entry: Direction,
	progress: number
) {
	const exit = exitDirection(type, entry);
	if (!exit) return;

	const half = size / 2;
	const thickness = Math.max(4, Math.round(size * 0.3));
	const entryLength = Math.min(progress * 2, 1) * half;
	const exitLength = Math.max(progress * 2 - 1, 0) * half;

	graphics.fillStyle(PIPE_COLORS.water, 1);
	fillFromBorder(graphics, centerX, centerY, half, thickness, entry, entryLength);
	fillFromCenter(graphics, centerX, centerY, thickness, exit, exitLength);
}

/** Brazo que crece desde el borde de la celda hacia el centro. */
function fillFromBorder(
	graphics: Phaser.GameObjects.Graphics,
	centerX: number,
	centerY: number,
	half: number,
	thickness: number,
	direction: Direction,
	length: number
) {
	const offset = thickness / 2;

	switch (direction) {
		case 'north':
			graphics.fillRect(centerX - offset, centerY - half, thickness, length);
			break;
		case 'south':
			graphics.fillRect(centerX - offset, centerY + half - length, thickness, length);
			break;
		case 'west':
			graphics.fillRect(centerX - half, centerY - offset, length, thickness);
			break;
		case 'east':
			graphics.fillRect(centerX + half - length, centerY - offset, length, thickness);
			break;
	}
}

/** Brazo que crece desde el centro de la celda hacia el borde. */
function fillFromCenter(
	graphics: Phaser.GameObjects.Graphics,
	centerX: number,
	centerY: number,
	thickness: number,
	direction: Direction,
	length: number
) {
	const offset = thickness / 2;

	switch (direction) {
		case 'north':
			graphics.fillRect(centerX - offset, centerY - length, thickness, length);
			break;
		case 'south':
			graphics.fillRect(centerX - offset, centerY, thickness, length);
			break;
		case 'west':
			graphics.fillRect(centerX - length, centerY - offset, length, thickness);
			break;
		case 'east':
			graphics.fillRect(centerX, centerY - offset, length, thickness);
			break;
	}
}

/** Celda de origen: un bloque macizo con la boca por donde sale el agua. */
export function drawSource(
	graphics: Phaser.GameObjects.Graphics,
	centerX: number,
	centerY: number,
	size: number,
	direction: Direction
) {
	const body = Math.round(size * 0.56);
	const thickness = Math.max(4, Math.round(size * 0.3));

	graphics.fillStyle(PIPE_COLORS.casing, 1);
	graphics.fillRect(centerX - body / 2, centerY - body / 2, body, body);
	graphics.fillStyle(PIPE_COLORS.source, 1);
	graphics.fillRect(centerX - body / 2 + 4, centerY - body / 2 + 4, body - 8, body - 8);

	graphics.fillStyle(PIPE_COLORS.casing, 1);
	fillFromCenter(graphics, centerX, centerY, thickness + 6, direction, size / 2);
	graphics.fillStyle(PIPE_COLORS.source, 1);
	fillFromCenter(graphics, centerX, centerY, thickness, direction, size / 2);
}

function drawArms(
	graphics: Phaser.GameObjects.Graphics,
	centerX: number,
	centerY: number,
	half: number,
	connections: readonly Direction[],
	thickness: number,
	color: number,
	alpha: number
) {
	graphics.fillStyle(color, alpha);
	const offset = thickness / 2;

	for (const direction of connections) {
		switch (direction) {
			case 'north':
				graphics.fillRect(centerX - offset, centerY - half, thickness, half);
				break;
			case 'south':
				graphics.fillRect(centerX - offset, centerY, thickness, half);
				break;
			case 'west':
				graphics.fillRect(centerX - half, centerY - offset, half, thickness);
				break;
			case 'east':
				graphics.fillRect(centerX, centerY - offset, half, thickness);
				break;
		}
	}

	// El cuadrado central une los brazos cuando la pieza es una curva.
	graphics.fillRect(centerX - offset, centerY - offset, thickness, thickness);
}
