import type Phaser from 'phaser';

/** Efectos propios del Truco, con claves separadas de los demás juegos. */
export const TRUCO_AUDIO = {
	cardPlay: {
		cacheKey: 'truco:sfx:card-play',
		url: 'https://pub-40dcb8cd66b94e2ab050da55f65f9d2a.r2.dev/audio/sfx/kenney/ui-audio/Audio/switch1.ogg?v=efdd1d1e2904fb2d',
	},
	handResult: {
		cacheKey: 'truco:sfx:hand-result',
		url: 'https://pub-40dcb8cd66b94e2ab050da55f65f9d2a.r2.dev/audio/sfx/kenney/interface-sounds/Audio/confirmation_004.ogg?v=568967a3d9f8a8f6',
	},
} as const;

export function loadTrucoAudio(scene: Phaser.Scene) {
	for (const asset of Object.values(TRUCO_AUDIO)) {
		if (!scene.cache.audio.exists(asset.cacheKey)) scene.load.audio(asset.cacheKey, asset.url);
	}
}
