import Phaser from 'phaser';
import type { Card, Suit } from '../rules';

/**
 * Cartas de la baraja española dibujadas con `Graphics`: se rasterizan a la
 * resolución real del canvas, así que se ven nítidas con cualquier zoom y no
 * dependen de cómo cada sistema operativo dibuje un emoji.
 *
 * Todo se dibuja alrededor del centro de la carta. Las medidas de los palos
 * están pensadas para una carta de 68 px de ancho y se escalan con ella.
 */
const DESIGN_WIDTH = 68;
const CORNER_RADIUS = 6;

/** Colores de la "pinta" de cada palo, como en las barajas Fournier. */
const SUIT_COLORS: Record<Suit, number> = {
	oros: 0xb8860b,
	copas: 0xb8322a,
	espadas: 0x2f5fa8,
	bastos: 0x3f7a3a,
};

/**
 * Cortes en el filete superior e inferior: la pinta permite reconocer el palo
 * con la carta casi tapada. Oros es continuo; copas, espadas y bastos se
 * interrumpen una, dos y tres veces.
 */
const SUIT_FRAME_GAPS: Record<Suit, number> = {
	oros: 0,
	copas: 1,
	espadas: 2,
	bastos: 3,
};

const FACE = { fill: 0xf4ead2, edge: 0xb89a6a };
const BACK = { fill: 0x6b2230, pattern: 0x8a3444, frame: 0xe0a064, edge: 0xc47d4b, medallion: 0x43251d, sun: 0xf2b84b };

/** Cómo se resalta una carta: jugable, o el resultado de su baza. */
export type CardHighlight = 'none' | 'playable' | 'won' | 'lost' | 'tie';

const HIGHLIGHT_STYLES: Record<Exclude<CardHighlight, 'none'>, { color: number; width: number }> = {
	playable: { color: 0xf2b84b, width: 2 },
	won: { color: 0x52d273, width: 3 },
	lost: { color: 0xd95858, width: 3 },
	tie: { color: 0xcdb88f, width: 2 },
};

export function createCard(scene: Phaser.Scene, x: number, y: number, card: Card, width: number, height: number, highlight: CardHighlight = 'none') {
	const scale = width / DESIGN_WIDTH;
	const color = SUIT_COLORS[card.suit];
	const g = scene.add.graphics();
	drawShadow(g, width, height);
	drawHighlight(g, width, height, highlight);
	g.fillStyle(FACE.fill, 1);
	g.fillRoundedRect(-width / 2, -height / 2, width, height, CORNER_RADIUS);
	g.lineStyle(1, FACE.edge, 1);
	g.strokeRoundedRect(-width / 2, -height / 2, width, height, CORNER_RADIUS);
	drawFrame(g, width, height, color, SUIT_FRAME_GAPS[card.suit]);
	drawSuit(g, card.suit, 0, 3 * scale, scale);
	// La carta que perdió su baza queda en sombra para que la mesa se lea de un vistazo.
	if (highlight === 'lost') {
		g.fillStyle(0x000000, 0.28);
		g.fillRoundedRect(-width / 2, -height / 2, width, height, CORNER_RADIUS);
	}

	const style = { fontFamily: 'Georgia, serif', fontStyle: 'bold', fontSize: `${Math.round(14 * scale)}px`, color: toCss(color) };
	const top = scene.add.text(-width / 2 + 8 * scale, -height / 2 + 7 * scale, card.value.toString(), style);
	// La esquina opuesta repite el número derecho: cabeza abajo, el 6 se leería 9.
	const bottom = scene.add.text(width / 2 - 8 * scale, height / 2 - 7 * scale, card.value.toString(), style).setOrigin(1, 1);
	return scene.add.container(x, y, [g, top, bottom]).setSize(width, height);
}

export function createCardBack(scene: Phaser.Scene, x: number, y: number, width: number, height: number) {
	const g = scene.add.graphics();
	drawShadow(g, width, height);
	g.fillStyle(BACK.fill, 1);
	g.fillRoundedRect(-width / 2, -height / 2, width, height, CORNER_RADIUS);
	g.lineStyle(2, BACK.edge, 1);
	g.strokeRoundedRect(-width / 2, -height / 2, width, height, CORNER_RADIUS);

	// Rombos en filas alternadas; sólo los que entran enteros dentro del filete.
	const inset = 8;
	const diamondWidth = 8;
	const diamondHeight = 10;
	g.fillStyle(BACK.pattern, 1);
	for (let row = 0; ; row++) {
		const cy = -height / 2 + inset + diamondHeight / 2 + row * (diamondHeight / 2);
		if (cy + diamondHeight / 2 > height / 2 - inset) break;
		const offset = row % 2 === 0 ? 0 : diamondWidth / 2;
		for (let cx = -width / 2 + inset + diamondWidth / 2 + offset; cx + diamondWidth / 2 <= width / 2 - inset; cx += diamondWidth) {
			g.fillPoints([
				new Phaser.Math.Vector2(cx, cy - diamondHeight / 2 + 1),
				new Phaser.Math.Vector2(cx + diamondWidth / 2 - 1, cy),
				new Phaser.Math.Vector2(cx, cy + diamondHeight / 2 - 1),
				new Phaser.Math.Vector2(cx - diamondWidth / 2 + 1, cy),
			], true);
		}
	}
	g.lineStyle(1, BACK.frame, 1);
	g.strokeRoundedRect(-width / 2 + 5, -height / 2 + 5, width - 10, height - 10, 3);

	// Medallón central con un sol, el adorno clásico de los dorsos.
	const medallionWidth = width * 0.42;
	const medallionHeight = height * 0.38;
	g.fillStyle(BACK.medallion, 1);
	g.fillEllipse(0, 0, medallionWidth, medallionHeight);
	g.lineStyle(1, BACK.frame, 1);
	g.strokeEllipse(0, 0, medallionWidth, medallionHeight);
	const sunRadius = width * 0.07;
	g.lineStyle(1.5, BACK.sun, 1);
	for (let ray = 0; ray < 8; ray++) {
		const angle = (ray / 8) * Math.PI * 2;
		g.lineBetween(Math.cos(angle) * sunRadius * 1.4, Math.sin(angle) * sunRadius * 1.4, Math.cos(angle) * sunRadius * 2.1, Math.sin(angle) * sunRadius * 2.1);
	}
	g.fillStyle(BACK.sun, 1);
	g.fillCircle(0, 0, sunRadius);
	return scene.add.container(x, y, [g]).setSize(width, height);
}

function drawShadow(g: Phaser.GameObjects.Graphics, width: number, height: number) {
	g.fillStyle(0x000000, 0.35);
	g.fillRoundedRect(-width / 2 + 2, -height / 2 + 3, width, height, CORNER_RADIUS);
}

/** Un halo por fuera del borde, para no tapar la pinta ni los números. */
function drawHighlight(g: Phaser.GameObjects.Graphics, width: number, height: number, highlight: CardHighlight) {
	if (highlight === 'none') return;
	const { color, width: lineWidth } = HIGHLIGHT_STYLES[highlight];
	const gap = 2 + lineWidth / 2;
	g.lineStyle(lineWidth, color, 1);
	g.strokeRoundedRect(-width / 2 - gap, -height / 2 - gap, width + gap * 2, height + gap * 2, CORNER_RADIUS + gap);
}

function drawFrame(g: Phaser.GameObjects.Graphics, width: number, height: number, color: number, gaps: number) {
	const inset = 4;
	const left = -width / 2 + inset;
	const right = width / 2 - inset;
	const top = -height / 2 + inset;
	const bottom = height / 2 - inset;
	g.lineStyle(1.5, color, 1);
	g.lineBetween(left, top, left, bottom);
	g.lineBetween(right, top, right, bottom);
	for (const y of [top, bottom]) {
		const gapWidth = 4;
		const cuts = Array.from({ length: gaps }, (_, index) => left + ((index + 1) / (gaps + 1)) * (right - left));
		let from = left;
		for (const cut of cuts) {
			g.lineBetween(from, y, cut - gapWidth / 2, y);
			from = cut + gapWidth / 2;
		}
		g.lineBetween(from, y, right, y);
	}
}

/** Dibuja el palo centrado en (x, y); a escala 1 ocupa unos 40 px de alto. */
export function drawSuit(g: Phaser.GameObjects.Graphics, suit: Suit, x: number, y: number, scale: number) {
	const at = (points: [number, number][], rotation = 0) => points.map(([px, py]) => {
		const cos = Math.cos(rotation);
		const sin = Math.sin(rotation);
		return new Phaser.Math.Vector2(x + (px * cos - py * sin) * scale, y + (px * sin + py * cos) * scale);
	});
	const s = (value: number) => value * scale;

	if (suit === 'oros') {
		g.fillStyle(0xe5b13a, 1);
		g.fillCircle(x, y, s(17));
		g.lineStyle(s(2), 0x8f6110, 1);
		g.strokeCircle(x, y, s(17));
		g.lineStyle(s(1.5), 0xa8741a, 1);
		g.strokeCircle(x, y, s(12));
		g.fillStyle(0xc9901f, 1);
		g.fillCircle(x, y, s(5));
		g.fillStyle(0xffffff, 0.35);
		g.fillEllipse(x - s(6), y - s(8), s(7), s(4));
		return;
	}

	if (suit === 'copas') {
		const gold = 0xe0a83c;
		const outline = 0x8a2a1e;
		const bowl = at([...Array.from({ length: 13 }, (_, index): [number, number] => {
			const angle = (index / 12) * Math.PI;
			return [13 * Math.cos(angle), -16 + 15 * Math.sin(angle)];
		})]);
		const base = at([[-11, 16], [11, 16], [5, 9], [-5, 9]]);
		g.fillStyle(gold, 1);
		g.fillRect(x - s(2), y - s(2), s(4), s(12));
		g.fillPoints(base, true);
		g.fillPoints(bowl, true);
		g.fillEllipse(x, y + s(4), s(9), s(4));
		g.lineStyle(s(1.5), outline, 1);
		g.strokePoints(base, true);
		g.strokePoints(bowl, true);
		g.fillStyle(0xf0c25a, 1);
		g.fillEllipse(x, y - s(16), s(26), s(5));
		g.strokeEllipse(x, y - s(16), s(26), s(5));
		g.fillStyle(outline, 1);
		g.fillCircle(x, y - s(8), s(2.5));
		return;
	}

	if (suit === 'espadas') {
		const blue = SUIT_COLORS.espadas;
		const blade = at([[0, -21], [3.5, -15], [3.5, 6], [-3.5, 6], [-3.5, -15]]);
		g.fillStyle(0xd5dde4, 1);
		g.fillPoints(blade, true);
		g.lineStyle(s(1.5), blue, 1);
		g.strokePoints(blade, true);
		g.lineStyle(s(1), 0x9aa8b5, 1);
		g.lineBetween(x, y - s(15), x, y + s(4));
		g.fillStyle(0x8a5a2b, 1);
		g.fillRect(x - s(2), y + s(9), s(4), s(8));
		g.fillStyle(blue, 1);
		g.fillRoundedRect(x - s(11), y + s(6), s(22), s(4), s(2));
		g.fillCircle(x - s(11), y + s(8), s(2.5));
		g.fillCircle(x + s(11), y + s(8), s(2.5));
		g.fillCircle(x, y + s(19), s(3));
		return;
	}

	// Bastos: un garrote de madera apenas inclinado, más grueso arriba.
	const tilt = -0.28;
	const [topCap, bottomCap] = at([[0, -15], [0, 17]], tilt);
	const stick = at([[-6.5, -15], [6.5, -15], [3, 17], [-3, 17]], tilt);
	g.fillStyle(0x9a6a35, 1);
	g.lineStyle(s(1.5), 0x4f3216, 1);
	g.fillCircle(topCap.x, topCap.y, s(6.5));
	g.strokeCircle(topCap.x, topCap.y, s(6.5));
	g.fillCircle(bottomCap.x, bottomCap.y, s(3));
	g.strokeCircle(bottomCap.x, bottomCap.y, s(3));
	g.fillPoints(stick, true);
	g.lineBetween(stick[0].x, stick[0].y, stick[3].x, stick[3].y);
	g.lineBetween(stick[1].x, stick[1].y, stick[2].x, stick[2].y);
	g.fillStyle(0x5e3c1a, 1);
	for (const knot of at([[-3, -6], [2, 2], [-1, 10]], tilt)) g.fillCircle(knot.x, knot.y, s(1.6));
	g.fillStyle(0x4f8a3a, 1);
	g.fillPoints(at([[5, -7], [12, -12], [7, -3]], tilt), true);
}

function toCss(color: number) {
	return `#${color.toString(16).padStart(6, '0')}`;
}
