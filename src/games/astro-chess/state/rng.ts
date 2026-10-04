/**
 * Azar con semilla.
 *
 * Un roguelite necesita poder repetir una partida: sin semilla, un problema de
 * balance que aparece en la ronda seis no se puede volver a mirar. La semilla
 * viaja con la partida y `Math.random()` no se usa en ninguna regla.
 *
 * El algoritmo es mulberry32: treinta y dos bits de estado, suficiente para
 * tiradas de combate y corto de leer.
 */
export class Rng {
	readonly seed: number;
	private state: number;

	constructor(seed: number = Date.now()) {
		this.seed = seed;
		this.state = seed >>> 0;
	}

	/**
	 * Azar que nunca sale: ninguna tirada con probabilidad se cumple.
	 *
	 * Lo usa el pronóstico de la ronda, que muestra qué pasa si nada se
	 * esquiva. La evasión se informa aparte, como probabilidad.
	 */
	static certain(): Rng {
		const rng = new Rng(0);
		rng.next = () => 0.999999;
		return rng;
	}

	/** Número entre 0 (incluido) y 1 (excluido). */
	next(): number {
		this.state = (this.state + 0x6d2b79f5) >>> 0;
		let value = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
		value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	}

	/** `probability` va de 0 a 1. */
	chance(probability: number): boolean {
		return this.next() < probability;
	}

	int(maxExclusive: number): number {
		return Math.floor(this.next() * maxExclusive);
	}

	pick<T>(items: readonly T[]): T {
		return items[this.int(items.length)];
	}
}
