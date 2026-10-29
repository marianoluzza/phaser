import Phaser from 'phaser';
import { PIXEL } from '../constants/tuning';

/**
 * Las hojas de sprites que arma `npm run art` a partir de `art/galactica`.
 * Un pedido por hoja, no uno por nave.
 */
export const SHIPS_ATLAS = 'galactica:ships';
export const BOSSES_ATLAS = 'galactica:bosses';

const SHEETS = [
	[SHIPS_ATLAS, 'ships'],
	[BOSSES_ATLAS, 'bosses'],
] as const;

export function loadGalacticaArt(scene: Phaser.Scene) {
	for (const [key, name] of SHEETS) {
		if (!scene.textures.exists(key)) {
			scene.load.atlas(key, `/assets/galactica/${name}.png`, `/assets/galactica/${name}.json`);
		}
	}
}

/**
 * El arcade no usa `pixelArt: true` y la cámara hace zoom (ver
 * `core/renderScale.ts`): sin filtro NEAREST, cada píxel se interpolaría con
 * sus vecinos y las naves saldrían borrosas.
 */
export function sharpenGalacticaArt(scene: Phaser.Scene) {
	for (const [key] of SHEETS) {
		if (scene.textures.exists(key)) {
			scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
		}
	}
}

/** Una imagen de la hoja de naves, ya escalada. */
export function addShip(scene: Phaser.Scene, x: number, y: number, frame: string, scale = PIXEL) {
	return scene.add.image(x, y, SHIPS_ATLAS, frame).setScale(scale);
}
