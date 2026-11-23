import Phaser from 'phaser';
import { VISION } from '../constants/tuning';
import type { Span } from '../state/vision';
import { TILE } from './geometry';

/**
 * Cuándo se vio por última vez cada tile de la mina. Una galería ocupa sus
 * dos tiles de aire y las dos losas, la del techo y la del piso: la losa entre
 * dos galerías se ve desde cualquiera de las dos.
 */
export class Sight {
	private readonly columns: number;
	private readonly rows: number;
	private readonly seen: Float64Array;
	private now = 0;

	constructor(width: number, height: number) {
		this.columns = width;
		this.rows = height * 3 + 1;
		this.seen = new Float64Array(this.columns * this.rows).fill(-Infinity);
	}

	update(spans: Span[], now: number) {
		this.now = now;
		for (const { y, from, to } of spans) {
			for (let row = y * 3; row <= y * 3 + 3; row += 1) {
				for (let x = from; x <= to; x += 1) this.seen[row * this.columns + x] = now;
			}
		}
	}

	/** 0 si se ve en vivo; si no, los segundos desde que se vio, o `Infinity` si nunca. */
	ageAt(x: number, y: number) {
		const column = Phaser.Math.Clamp(Math.floor(x / TILE), 0, this.columns - 1);
		const row = Phaser.Math.Clamp(Math.floor(y / TILE), 0, this.rows - 1);
		return this.now - this.seen[row * this.columns + column];
	}
}

/**
 * El recuerdo: frío, como una radiografía, y se apaga a negro. El tinte
 * multiplica; sobre la paleta cálida de la mina, un azul así iguala los
 * canales y deja grises fríos sin necesidad de un filtro por pieza.
 */
export function memoryTint(age: number) {
	if (age >= VISION.memory) return 0;
	const left = 1 - age / VISION.memory;
	return Phaser.Display.Color.GetColor(118 * left, 158 * left, 228 * left);
}

/** Multiplica dos colores, como el tinte de Phaser: para lo que se dibuja con Graphics. */
export function multiply(color: number, tint: number) {
	const channel = (shift: number) => Math.round((((color >> shift) & 255) * ((tint >> shift) & 255)) / 255);
	return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}
