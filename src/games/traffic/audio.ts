import type Phaser from 'phaser';

const R2 = 'https://pub-40dcb8cd66b94e2ab050da55f65f9d2a.r2.dev/audio';

/**
 * Assets de audio propios de Semáforos.
 *
 * La biblioteca no tiene bocinas ni motores: se eligieron efectos de interfaz
 * cortos que, sobre la música, cumplen ese papel. El juego se entiende igual
 * sin sonido.
 */
export const TRAFFIC_AUDIO = {
	titleMusic: {
		cacheKey: 'traffic:music:title',
		url: `${R2}/music/abstraction/2026-q2/Week%2018%20-%20Distant%20Skyline%20SIDEWALK%20STRUT.ogg?v=2075e159cc37b140`,
	},
	gameMusic: {
		cacheKey: 'traffic:music:game',
		url: `${R2}/music/abstraction/2026-q2/Week%2018%20-%20Distant%20Skyline%20CITY%20LIGHTS.ogg?v=2bdcebdc8d127dcc`,
	},
	confirm: {
		cacheKey: 'traffic:sfx:confirm',
		url: `${R2}/sfx/kenney/interface-sounds/Audio/confirmation_001.ogg?v=063564703b6094d7`,
	},
	toggle: {
		cacheKey: 'traffic:sfx:toggle',
		url: `${R2}/sfx/kenney/interface-sounds/Audio/toggle_002.ogg?v=1f564f5520cfa076`,
	},
	completed: {
		cacheKey: 'traffic:sfx:completed',
		url: `${R2}/sfx/kenney/interface-sounds/Audio/pluck_001.ogg?v=be97ec4893a02d6e`,
	},
	crash: {
		cacheKey: 'traffic:sfx:crash',
		url: `${R2}/sfx/kenney/interface-sounds/Audio/glitch_003.ogg?v=d55e0c64aee9f1ab`,
	},
	impatient: {
		cacheKey: 'traffic:sfx:impatient',
		url: `${R2}/sfx/kenney/interface-sounds/Audio/error_004.ogg?v=0b574cea597d9650`,
	},
	gameOver: {
		cacheKey: 'traffic:sfx:game-over',
		url: `${R2}/sfx/kenney/interface-sounds/Audio/error_008.ogg?v=eba17ecb2a426bfd`,
	},
} as const;

type TrafficAudioAsset = (typeof TRAFFIC_AUDIO)[keyof typeof TRAFFIC_AUDIO];

/** Carga sólo los assets que todavía no existan en la caché de Phaser. */
export function loadTrafficAudio(scene: Phaser.Scene, ...assets: TrafficAudioAsset[]) {
	for (const asset of assets) {
		if (!scene.cache.audio.exists(asset.cacheKey)) {
			scene.load.audio(asset.cacheKey, asset.url);
		}
	}
}
