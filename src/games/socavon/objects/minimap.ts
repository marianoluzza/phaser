import type Phaser from 'phaser';
import type { Level } from '../state/level';

const MARKS: Record<string, number> = {
	$: 0xf2bd36, V: 0xffe98a, K: 0xff5a3c, G: 0xff5a3c, E: 0x85599a, T: 0xaaa3ab, C: 0xaaa3ab, W: 0xc47c42, l: 0xa85512,
};

/** Plano de una mina para la pantalla de título. */
export function drawMinimap(
	graphics: Phaser.GameObjects.Graphics,
	level: Level,
	area: { x: number; y: number; width: number; height: number }
) {
	const cell = area.width / level.width;
	const gallery = Math.min(area.height / level.height, cell * 3.4);
	const top = area.y + (area.height - gallery * level.height) / 2;

	graphics.clear().fillStyle(0x432a22, 1).fillRect(area.x, top, area.width, gallery * level.height + 3);
	for (let y = 0; y < level.height; y += 1) {
		for (let x = 0; x < level.width; x += 1) {
			const symbol = level.at(x, y);
			if (symbol === '#') continue;
			const left = area.x + x * cell;
			const roof = top + y * gallery + 3;
			const air = gallery - 5;
			graphics.fillStyle(0x120c0c, 1).fillRect(left, roof, cell + 0.5, air);

			if (symbol === '%') graphics.fillStyle(0x857069, 1).fillRect(left, roof, cell, air);
			else if (symbol === 'h' || symbol === 'A') graphics.fillStyle(0xaaa3ab, 1).fillRect(left + 1, roof, cell - 2, 3);
			else if (symbol in MARKS) {
				graphics.fillStyle(MARKS[symbol], 1).fillRect(left + 1.5, roof + air - 9, cell - 3, 8);
			}
		}
	}
	// Las escaleras al final: cruzan la losa de la galería de abajo.
	graphics.fillStyle(0x9c562a, 1);
	for (const { x, y } of level.find('H')) {
		graphics.fillRect(area.x + (x + 0.3) * cell, top + (y + 1) * gallery - 4, cell * 0.4, gallery);
	}
}
