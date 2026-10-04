import type Phaser from 'phaser';

/** Assets de audio propios de Astro Chess, con claves separadas de los demás juegos. */
export const ASTRO_AUDIO = {
	introMusic: {
		cacheKey: 'astro:music:intro',
		url: 'https://pub-40dcb8cd66b94e2ab050da55f65f9d2a.r2.dev/audio/music/abstraction/2026-q1/Week 11 - Lost in Space.ogg?v=e0870db1d80c2134',
	},
	select: {
		cacheKey: 'astro:sfx:select',
		url: 'https://pub-40dcb8cd66b94e2ab050da55f65f9d2a.r2.dev/audio/sfx/kenney/interface-sounds/Audio/switch_001.ogg?v=3b74efad87f1e69d',
	},
	confirm: {
		cacheKey: 'astro:sfx:confirm',
		url: 'https://pub-40dcb8cd66b94e2ab050da55f65f9d2a.r2.dev/audio/sfx/kenney/interface-sounds/Audio/confirmation_001.ogg?v=063564703b6094d7',
	},
	/** Una pieza que no se puede mover tiene que sonar distinto a una que sí. */
	blocked: {
		cacheKey: 'astro:sfx:blocked',
		url: 'https://pub-40dcb8cd66b94e2ab050da55f65f9d2a.r2.dev/audio/sfx/kenney/interface-sounds/Audio/error_004.ogg?v=0b574cea597d9650',
	},
	fire: {
		cacheKey: 'astro:sfx:fire',
		url: 'https://pub-40dcb8cd66b94e2ab050da55f65f9d2a.r2.dev/audio/sfx/kenney/interface-sounds/Audio/maximize_004.ogg?v=59c7a24b204be24d',
	},
	hit: {
		cacheKey: 'astro:sfx:hit',
		url: 'https://pub-40dcb8cd66b94e2ab050da55f65f9d2a.r2.dev/audio/sfx/kenney/interface-sounds/Audio/glitch_002.ogg?v=1da06a2e63ce131f',
	},
} as const;

type AstroAudioAsset = (typeof ASTRO_AUDIO)[keyof typeof ASTRO_AUDIO];

/** Carga sólo los assets que todavía no estén en la caché de Phaser. */
export function loadAstroAudio(scene: Phaser.Scene, ...assets: AstroAudioAsset[]) {
	for (const asset of assets) {
		if (!scene.cache.audio.exists(asset.cacheKey)) {
			scene.load.audio(asset.cacheKey, asset.url);
		}
	}
}
