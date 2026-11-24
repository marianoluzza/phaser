import Phaser from 'phaser';
import { PIXEL } from './geometry';

/**
 * El atlas que arma `npm run art:socavon` con los specs de
 * `arte/spritekiln`. Un solo pedido para todo el juego.
 */
export const MINE_ATLAS = 'socavon:mine';

type Clip = {
	frames: string[];
	durations: number[];
	loop: boolean;
	origin: [number, number];
	/** Por cuadro, en píxeles del sprite desde el pie; `null` donde no está. */
	sockets?: Record<string, ([number, number] | null)[]>;
};

export function loadSocavonArt(scene: Phaser.Scene) {
	if (!scene.textures.exists(MINE_ATLAS)) {
		scene.load.atlas(MINE_ATLAS, '/assets/socavon/mine.png', '/assets/socavon/mine.json');
	}
}

/** Sin filtro NEAREST el zoom de la cámara interpola el pixel art. */
export function sharpenSocavonArt(scene: Phaser.Scene) {
	if (scene.textures.exists(MINE_ATLAS)) {
		scene.textures.get(MINE_ATLAS).setFilter(Phaser.Textures.FilterMode.NEAREST);
	}
}

function getClip(scene: Phaser.Scene, name: string) {
	// El parser de Phaser guarda en customData todo lo del JSON que no son cuadros.
	const { meta } = scene.textures.get(MINE_ATLAS).customData as { meta: { clips: Record<string, Clip> } };
	return meta.clips[name];
}

/**
 * Pone en la imagen el cuadro que le toca a `time` (segundos). El origen es el
 * pie del sprite, así que todos se ubican por dónde pisan.
 */
export function showClip(image: Phaser.GameObjects.Image, name: string, time = 0) {
	const clip = getClip(image.scene, name);
	const index = frameAt(clip, time);
	if (image.frame.name !== clip.frames[index]) image.setFrame(clip.frames[index]);
	// El origen se mide sobre el cuadro sin recortar: cambia con cada hoja.
	image.setOrigin(clip.origin[0], clip.origin[1]);
	return image;
}

function frameAt(clip: Clip, time: number) {
	const total = clip.durations.reduce((sum, duration) => sum + duration, 0);
	let left = clip.loop ? (time * 1000) % total : Math.min(time * 1000, total - 1);
	let index = 0;
	while (index < clip.durations.length - 1 && left >= clip.durations[index]) {
		left -= clip.durations[index];
		index += 1;
	}
	return index;
}

/**
 * Dónde está un socket del spec (la llama del encendedor) en el cuadro que
 * muestra la imagen, en coordenadas de la escena; `null` si en ese cuadro no
 * está. Sigue el espejado y la escala de la imagen.
 */
export function clipSocket(image: Phaser.GameObjects.Image, name: string, time: number, socket: string) {
	const clip = getClip(image.scene, name);
	const point = clip.sockets?.[socket]?.[frameAt(clip, time)];
	if (!point) return null;
	return {
		x: image.x + point[0] * image.scaleX * (image.flipX ? -1 : 1),
		y: image.y + point[1] * image.scaleY,
	};
}

export function addClip(scene: Phaser.Scene, x: number, y: number, name: string, scale = PIXEL) {
	const image = scene.add.image(x, y, MINE_ATLAS, getClip(scene, name).frames[0]).setScale(scale);
	return showClip(image, name);
}
