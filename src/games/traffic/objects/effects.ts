import Phaser from 'phaser';

/** Efectos de los golpes y el ícono de vida del marcador, todos vectoriales. */

/** Estallido de un choque. `progress` va de 0 a 1. */
export function drawCrash(g: Phaser.GameObjects.Graphics, x: number, y: number, progress: number, seed: number) {
	const fade = 1 - progress;
	const grow = 0.45 + progress * 0.9;

	g.fillStyle(0x2a2d35, 0.55 * fade);
	g.fillCircle(x, y, 30 * grow);

	g.fillStyle(0xff7a2f, 0.9 * fade);
	g.fillPoints(star(x, y, 26 * grow, 11 * grow, 9, seed), true);
	g.fillStyle(0xffd23f, fade);
	g.fillPoints(star(x, y, 15 * grow, 6 * grow, 7, seed + 1), true);
	g.fillStyle(0xffffff, 0.8 * fade);
	g.fillCircle(x, y, 5 * (1 - progress * 0.8));

	// Esquirlas que salen despedidas.
	g.fillStyle(0xd8dbe3, fade);
	for (let index = 0; index < 6; index += 1) {
		const angle = seed * 1.7 + index * ((Math.PI * 2) / 6);
		const distance = 12 + progress * 34;
		g.fillRect(x + Math.cos(angle) * distance - 2, y + Math.sin(angle) * distance - 2, 4, 4);
	}
}

/** Marca de enojo del coche que se cansó de esperar: cuatro trazos rojos que laten. */
export function drawAnger(g: Phaser.GameObjects.Graphics, x: number, y: number, progress: number) {
	const size = 9 + Math.sin(progress * Math.PI * 4) * 1.5;
	const alpha = progress < 0.75 ? 1 : (1 - progress) / 0.25;
	g.lineStyle(3.5, 0xff3b3b, alpha);
	for (let quarter = 0; quarter < 4; quarter += 1) {
		const angle = quarter * (Math.PI / 2) + Math.PI / 4;
		const cx = x + Math.cos(angle) * size;
		const cy = y + Math.sin(angle) * size;
		// Un ángulo recto que apunta hacia el centro.
		const a = angle + Math.PI * 0.75;
		const b = angle - Math.PI * 0.75;
		g.beginPath();
		g.moveTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6);
		g.lineTo(cx, cy);
		g.lineTo(cx + Math.cos(b) * 6, cy + Math.sin(b) * 6);
		g.strokePath();
	}
}

/** Corazón de vida: dos círculos y un triángulo. */
export function drawHeart(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number, color: number, alpha = 1) {
	const r = size * 0.28;
	g.fillStyle(color, alpha);
	g.fillCircle(x - r, y - r * 0.4, r);
	g.fillCircle(x + r, y - r * 0.4, r);
	g.fillTriangle(x - r * 2, y - r * 0.15, x + r * 2, y - r * 0.15, x, y + size * 0.5);
}

function star(x: number, y: number, outer: number, inner: number, spikes: number, seed: number) {
	const result = [];
	for (let index = 0; index < spikes * 2; index += 1) {
		const angle = seed + (index * Math.PI) / spikes;
		const jag = index % 2 === 0 ? 1 - ((index * 37 + seed * 13) % 5) * 0.06 : 1;
		const radius = (index % 2 === 0 ? outer : inner) * jag;
		result.push(new Phaser.Math.Vector2(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius));
	}
	return result;
}
