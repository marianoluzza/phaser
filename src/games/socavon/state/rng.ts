/**
 * Generador pseudoaleatorio con semilla (mulberry32): el mismo número da
 * siempre la misma mina, así que una semilla se puede anotar y compartir.
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

export function randomSeed(random: () => number = Math.random) {
	return 10000 + Math.floor(random() * 90000);
}

export function hashText(text: string) {
	let hash = 2166136261;
	for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
	return hash >>> 0;
}
