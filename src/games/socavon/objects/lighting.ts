import Phaser from 'phaser';
import type { Mine } from '../state/Mine';
import { centerX, feetY, LIGHTER_HAND, LIGHTER_HEIGHT } from './geometry';

const AMBIENT = 0.36;
/** Cortes de luz: en escalones, como la sombra toon de los sprites. */
const BANDS = 5;

type Light = { x: number; y: number; radius: number; power: number };

/**
 * La luz se aplica como tinte sobre cada pieza, no como una máscara: el pixel
 * art queda nítido y cada tile entero cae en el mismo escalón.
 */
export function collectLights(mine: Mine) {
	const lights: Light[] = [];
	for (const lamp of mine.lamps) {
		if (lamp.lit) lights.push({ x: centerX(lamp.x), y: feetY(lamp.y) - 56, radius: 180, power: 1 });
	}
	const { player } = mine;
	lights.push(player.headlamp && !player.hidden
		? { x: centerX(player.x) + player.facing * 44, y: feetY(player.y) - 56, radius: 220, power: 0.95 }
		: { x: centerX(player.x), y: feetY(player.y) - 48, radius: 90, power: 0.3 });
	for (const guard of mine.guards) {
		// El encendedor alumbra poco: al sereno y la celda de al lado.
		lights.push({ x: centerX(guard.x) + guard.facing * LIGHTER_HAND, y: feetY(guard.y) - LIGHTER_HEIGHT, radius: 80, power: 0.55 });
	}
	return lights;
}

/** Brillo entre `floor` y 1 en un punto. */
export function brightnessAt(lights: Light[], x: number, y: number, floor = AMBIENT) {
	let strongest = 0;
	for (const light of lights) {
		const dx = x - light.x;
		// La roca entre galerías deja pasar poco: en vertical se apaga antes.
		const dy = (y - light.y) * 1.8;
		const reach = 1 - Math.sqrt(dx * dx + dy * dy) / light.radius;
		if (reach > 0) strongest = Math.max(strongest, Math.min(1, reach * 1.7) * light.power);
	}
	return floor + (1 - floor) * (Math.ceil(strongest * BANDS) / BANDS);
}

/** Tinte cálido; `alarm` (de 0 a 1) lo corre al rojo. */
export function tintFor(brightness: number, alarm = 0) {
	return Phaser.Display.Color.GetColor(
		Math.min(255, 255 * (brightness + alarm * 0.25)),
		255 * brightness * (1 - alarm * 0.25),
		255 * brightness * (0.94 - alarm * 0.3)
	);
}
