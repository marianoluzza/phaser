import Phaser from 'phaser';
import { PIECES, type PieceType } from '../constants/pieces';

/**
 * Dibujo compartido de las piezas de la tripulación.
 *
 * Cada pieza es una silueta geométrica que entra en un cuadrado de `size`
 * centrado en `(x, y)`. Al no usar imágenes, la misma función sirve para el
 * plano de la nave, la ficha del launcher y cualquier lista, en cualquier
 * tamaño y sin assets que cargar.
 */
export function drawPiece(
	graphics: Phaser.GameObjects.Graphics,
	x: number,
	y: number,
	size: number,
	type: PieceType,
	alpha = 1
) {
	const { shape, color } = PIECES[type];
	const bottom = y + size / 2;
	const top = y - size / 2;
	const baseTop = bottom - size * 0.12;

	graphics.fillStyle(color, alpha);

	// Todas las piezas se apoyan en la misma base: es lo que las hace leer como
	// una familia y no como seis figuras sueltas.
	graphics.fillRect(x - size * 0.34, baseTop, size * 0.68, bottom - baseTop);

	if (shape === 'crown') {
		fillPolygon(graphics, [
			[x, top],
			[x + size * 0.36, baseTop],
			[x - size * 0.36, baseTop],
		]);
		// La barra tiene que sobresalir del triángulo: si quedara adentro,
		// dibujada del mismo color, sería invisible.
		graphics.fillRect(x - size * 0.28, top + size * 0.34, size * 0.56, size * 0.09);
		return;
	}

	if (shape === 'diamond') {
		const middle = (top + baseTop) / 2;
		fillPolygon(graphics, [
			[x, top],
			[x + size * 0.33, middle],
			[x, baseTop],
			[x - size * 0.33, middle],
		]);
		return;
	}

	if (shape === 'tower') {
		const merlonBottom = top + size * 0.2;
		graphics.fillRect(x - size * 0.3, merlonBottom, size * 0.6, baseTop - merlonBottom);
		// Tres almenas: la torre se reconoce por su borde, no por su cuerpo.
		for (const offset of [-0.3, -0.09, 0.12]) {
			graphics.fillRect(x + size * offset, top, size * 0.18, merlonBottom - top);
		}
		return;
	}

	if (shape === 'ogive') {
		// La mitra va separada del cuerpo. El corte es lo que distingue al alfil
		// del rey a simple vista: los dos son siluetas que terminan en punta.
		fillPolygon(graphics, [
			[x, top],
			[x + size * 0.1, top + size * 0.15],
			[x - size * 0.1, top + size * 0.15],
		]);
		fillPolygon(graphics, [
			[x, top + size * 0.23],
			[x + size * 0.19, top + size * 0.45],
			[x + size * 0.28, baseTop],
			[x - size * 0.28, baseTop],
			[x - size * 0.19, top + size * 0.45],
		]);
		return;
	}

	if (shape === 'wedge') {
		// Perfil angular mirando a la derecha: el caballo es la única pieza que
		// apunta hacia algún lado, porque es la única que sale de la nave.
		fillPolygon(graphics, [
			[x - size * 0.26, baseTop],
			[x - size * 0.26, y - size * 0.06],
			[x - size * 0.04, top],
			[x + size * 0.3, top + size * 0.24],
			[x + size * 0.12, y + size * 0.12],
			[x + size * 0.28, baseTop],
		]);
		return;
	}

	graphics.fillCircle(x, y - size * 0.04, size * 0.23);
}

function fillPolygon(graphics: Phaser.GameObjects.Graphics, points: Array<[number, number]>) {
	graphics.fillPoints(
		points.map(([x, y]) => new Phaser.Math.Vector2(x, y)),
		true
	);
}
