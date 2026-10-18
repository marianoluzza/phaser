import Phaser from 'phaser';
import { CAR_LENGTH, CAR_WIDTH, PATIENCE_DANGER, PATIENCE_WARN } from '../constants/tuning';
import type { Turn } from '../constants/layouts';
import { darken, lighten } from './cityRenderer';

/**
 * Coches vistos desde arriba, dibujados con la trompa hacia +x y el centro en
 * el origen: la escena sólo los ubica y los rota. La carrocería es del color
 * de la salida a la que van.
 */
const HALF_LENGTH = CAR_LENGTH / 2;
const HALF_WIDTH = CAR_WIDTH / 2;

export const CAR_COLORS = {
	glass: 0x1c2533,
	headlight: 0xfff4c2,
	brake: 0xff3b3b,
	brakeOff: 0x7a1f1f,
	blinker: 0xffa21f,
};

export const PATIENCE_COLORS = {
	ok: 0x3ddc84,
	warn: 0xffc93c,
	danger: 0xff4d4d,
	back: 0x0b0f18,
};

export function drawCarBody(g: Phaser.GameObjects.Graphics, color: number) {
	g.clear();
	g.fillStyle(0x000000, 0.3);
	g.fillRoundedRect(-HALF_LENGTH + 2, -HALF_WIDTH + 2, CAR_LENGTH, CAR_WIDTH, 5);
	g.fillStyle(color, 1);
	g.fillRoundedRect(-HALF_LENGTH, -HALF_WIDTH, CAR_LENGTH, CAR_WIDTH, 5);
	g.lineStyle(1, darken(color, 0.35), 1);
	g.strokeRoundedRect(-HALF_LENGTH, -HALF_WIDTH, CAR_LENGTH, CAR_WIDTH, 5);

	// Parabrisas adelante, luneta atrás y el techo en el medio.
	g.fillStyle(CAR_COLORS.glass, 1);
	g.fillPoints(points([[3, -7.5], [10, -6], [10, 6], [3, 7.5]]), true);
	g.fillPoints(points([[-13, -6], [-9, -7], [-9, 7], [-13, 6]]), true);
	g.fillStyle(lighten(color, 0.12), 1);
	g.fillRoundedRect(-8, -7, 10.5, 14, 2);
}

/** Faros, luces de freno y el guiño del lado del próximo giro. */
export function drawCarLights(g: Phaser.GameObjects.Graphics, braking: boolean, turn: Turn | null, blinkOn: boolean) {
	g.clear();
	g.fillStyle(CAR_COLORS.headlight, 0.9);
	g.fillRect(HALF_LENGTH - 2.5, -HALF_WIDTH + 2, 2.5, 4);
	g.fillRect(HALF_LENGTH - 2.5, HALF_WIDTH - 6, 2.5, 4);

	g.fillStyle(braking ? CAR_COLORS.brake : CAR_COLORS.brakeOff, 1);
	g.fillRect(-HALF_LENGTH, -HALF_WIDTH + 2, 2.5, 4.5);
	g.fillRect(-HALF_LENGTH, HALF_WIDTH - 6.5, 2.5, 4.5);
	if (braking) {
		g.fillStyle(CAR_COLORS.brake, 0.3);
		g.fillCircle(-HALF_LENGTH - 1, -HALF_WIDTH + 4, 4.5);
		g.fillCircle(-HALF_LENGTH - 1, HALF_WIDTH - 4, 4.5);
	}

	if (turn && turn !== 'straight' && blinkOn) {
		// Con la trompa hacia +x y el eje y hacia abajo, la derecha del coche es +y.
		const side = turn === 'right' ? 1 : -1;
		const y = side * (HALF_WIDTH - 1.5);
		g.fillStyle(CAR_COLORS.blinker, 0.35);
		g.fillCircle(HALF_LENGTH - 2, y, 6);
		g.fillCircle(-HALF_LENGTH + 2, y, 6);
		g.fillStyle(CAR_COLORS.blinker, 1);
		g.fillCircle(HALF_LENGTH - 2, y, 3);
		g.fillCircle(-HALF_LENGTH + 2, y, 3);
	}
}

export function patienceColor(fraction: number) {
	if (fraction > PATIENCE_WARN) return PATIENCE_COLORS.ok;
	if (fraction > PATIENCE_DANGER) return PATIENCE_COLORS.warn;
	return PATIENCE_COLORS.danger;
}

/** Barra de paciencia sobre el coche, sin rotar. En rojo titila. */
export function drawPatienceBar(g: Phaser.GameObjects.Graphics, x: number, y: number, fraction: number, time: number) {
	const width = 32;
	const left = x - width / 2;
	const top = y - 26;
	if (fraction <= PATIENCE_DANGER && Math.floor(time * 6) % 2 === 0) {
		g.fillStyle(PATIENCE_COLORS.danger, 0.35);
		g.fillRoundedRect(left - 3, top - 3, width + 6, 12, 4);
	}
	g.fillStyle(PATIENCE_COLORS.back, 0.85);
	g.fillRoundedRect(left - 1, top - 1, width + 2, 8, 3);
	g.fillStyle(patienceColor(fraction), 1);
	g.fillRect(left, top, Math.max(1, width * fraction), 6);
}

function points(pairs: Array<[number, number]>) {
	return pairs.map(([x, y]) => new Phaser.Math.Vector2(x, y));
}
