import Phaser from 'phaser';
import { PIXEL } from '../constants/tuning';

export type SpriteView = {
	id: number;
	atlas: string;
	frame: string;
	x: number;
	y: number;
	angle?: number;
	alpha?: number;
	/** Pinta la nave entera de un color: el destello de un impacto. */
	tint?: number;
	scale?: number;
	flipX?: boolean;
};

/**
 * Mantiene una imagen de Phaser por cada entidad del estado.
 *
 * La batalla no sabe nada de Phaser: cada paso la escena le pasa la lista de
 * lo que hay que ver, y esta capa crea las imágenes que faltan, mueve las que
 * siguen y destruye las de entidades que ya no están.
 */
export class SpriteLayer {
	private readonly images = new Map<number, Phaser.GameObjects.Image>();
	private readonly seen = new Set<number>();

	private readonly scene: Phaser.Scene;
	private readonly offset: { x: number; y: number };
	private readonly depth: number;

	constructor(scene: Phaser.Scene, offset: { x: number; y: number }, depth: number) {
		this.scene = scene;
		this.offset = offset;
		this.depth = depth;
	}

	sync(views: SpriteView[]) {
		this.seen.clear();
		for (const view of views) {
			this.seen.add(view.id);
			let image = this.images.get(view.id);
			if (!image) {
				image = this.scene.add.image(0, 0, view.atlas, view.frame).setDepth(this.depth);
				this.images.set(view.id, image);
			} else if (image.frame.name !== view.frame) {
				image.setFrame(view.frame);
			}
			image
				.setPosition(this.offset.x + view.x, this.offset.y + view.y)
				.setRotation(view.angle ?? 0)
				.setAlpha(view.alpha ?? 1)
				.setScale(view.scale ?? PIXEL)
				.setFlipX(view.flipX ?? false);
			if (view.tint === undefined) {
				image.clearTint();
			} else {
				image.setTint(view.tint).setTintMode(Phaser.TintModes.FILL);
			}
		}
		for (const [id, image] of this.images) {
			if (!this.seen.has(id)) {
				image.destroy();
				this.images.delete(id);
			}
		}
	}
}
