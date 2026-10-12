/**
 * Generador pseudoaleatorio con semilla (mulberry32): el mismo número da
 * siempre la misma secuencia, así que un mapa aleatorio se puede repetir.
 */
export function seededRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Semilla de cinco cifras: corta para leerla en pantalla y anotarla. */
export function randomSeed(random: () => number = Math.random) {
	return 10000 + Math.floor(random() * 90000);
}
