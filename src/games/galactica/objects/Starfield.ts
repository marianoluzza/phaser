import type Phaser from 'phaser';
import { seededRandom } from '../state/rng';

type Star = { x: number; y: number; layer: number };

/** Velocidad, tamaño y brillo de cada capa: las lejanas son chicas, tenues y lentas. */
const LAYERS = [
	{ speed: 14, size: 1, alpha: 0.35 },
	{ speed: 34, size: 2, alpha: 0.6 },
	{ speed: 80, size: 2, alpha: 0.95 },
];

/**
 * Fondo de estrellas en tres capas que bajan a distinta velocidad: la nave
 * parece avanzar aunque nunca se mueva hacia arriba. Una nebulosa del color
 * de la zona queda quieta detrás.
 */
export class Starfield {
	private readonly stars: Star[] = [];
	private readonly nebula: Phaser.GameObjects.Graphics;
	private readonly graphics: Phaser.GameObjects.Graphics;
	private readonly area: { x: number; y: number; w: number; h: number };
	private readonly sky: { space: number; nebula: number; stars: number };

	constructor(
		scene: Phaser.Scene,
		area: { x: number; y: number; w: number; h: number },
		sky: { space: number; nebula: number; stars: number },
		count = 120,
	) {
		this.area = area;
		this.sky = sky;
		const random = seededRandom(7);
		for (let index = 0; index < count; index += 1) {
			this.stars.push({ x: random() * area.w, y: random() * area.h, layer: index % 3 });
		}

		this.nebula = scene.add.graphics();
		this.nebula.fillStyle(sky.space, 1);
		this.nebula.fillRect(area.x, area.y, area.w, area.h);
		for (let index = 0; index < 5; index += 1) {
			const cx = area.x + random() * area.w;
			const cy = area.y + random() * area.h;
			for (let ring = 4; ring >= 1; ring -= 1) {
				this.nebula.fillStyle(sky.nebula, 0.07);
				this.nebula.fillCircle(cx, cy, 30 + ring * 28 + random() * 20);
			}
		}
		this.graphics = scene.add.graphics();
	}

	draw(time: number) {
		const { x, y, h } = this.area;
		const g = this.graphics;
		g.clear();
		for (const star of this.stars) {
			const layer = LAYERS[star.layer];
			const sy = (star.y + time * layer.speed) % h;
			g.fillStyle(this.sky.stars, layer.alpha);
			g.fillRect(x + star.x, y + sy, layer.size, layer.size * (star.layer === 2 ? 2 : 1));
		}
	}

	destroy() {
		this.nebula.destroy();
		this.graphics.destroy();
	}

	setDepth(depth: number) {
		this.nebula.setDepth(depth);
		this.graphics.setDepth(depth);
		return this;
	}
}
