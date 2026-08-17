import type Phaser from 'phaser';

/** Assets de audio propios de Pipes, con claves separadas de los demás juegos. */
export const PIPES_AUDIO = {
	introMusic: {
		cacheKey: 'pipes:music:intro',
		url: 'https://pub-40dcb8cd66b94e2ab050da55f65f9d2a.r2.dev/audio/music/abstraction/2026-q1/Week 3 - Waiting Room Ennui.ogg?v=7413703b6258fcbb',
	},
	gameMusic: {
		cacheKey: 'pipes:music:game',
		url: 'https://pub-40dcb8cd66b94e2ab050da55f65f9d2a.r2.dev/audio/music/abstraction/2026-q1/Week 2 - Ruined Lands HOPE.ogg?v=c9c9970d75fb6110',
	},
	confirm: {
		cacheKey: 'pipes:sfx:confirm',
		url: 'https://pub-40dcb8cd66b94e2ab050da55f65f9d2a.r2.dev/audio/sfx/kenney/interface-sounds/Audio/confirmation_001.ogg?v=063564703b6094d7',
	},
	place: {
		cacheKey: 'pipes:sfx:place',
		url: 'https://pub-40dcb8cd66b94e2ab050da55f65f9d2a.r2.dev/audio/sfx/kenney/interface-sounds/Audio/drop_002.ogg?v=4ac4d1cef7e93696',
	},
	replace: {
		cacheKey: 'pipes:sfx:replace',
		url: 'https://pub-40dcb8cd66b94e2ab050da55f65f9d2a.r2.dev/audio/sfx/kenney/interface-sounds/Audio/switch_001.ogg?v=3b74efad87f1e69d',
	},
	blocked: {
		cacheKey: 'pipes:sfx:blocked',
		url: 'https://pub-40dcb8cd66b94e2ab050da55f65f9d2a.r2.dev/audio/sfx/kenney/interface-sounds/Audio/error_002.ogg?v=76810ec365f41078',
	},
	flowStart: {
		cacheKey: 'pipes:sfx:flow-start',
		url: 'https://pub-40dcb8cd66b94e2ab050da55f65f9d2a.r2.dev/audio/sfx/kenney/interface-sounds/Audio/maximize_006.ogg?v=f050b3bb77cb0b90',
	},
	spill: {
		cacheKey: 'pipes:sfx:spill',
		url: 'https://pub-40dcb8cd66b94e2ab050da55f65f9d2a.r2.dev/audio/sfx/kenney/interface-sounds/Audio/error_003.ogg?v=885b28175c7b5111',
	},
} as const;

type PipesAudioAsset = (typeof PIPES_AUDIO)[keyof typeof PIPES_AUDIO];

/** Carga sólo los assets que todavía no estén en la caché de Phaser. */
export function loadPipesAudio(scene: Phaser.Scene, ...assets: PipesAudioAsset[]) {
	for (const asset of assets) {
		if (!scene.cache.audio.exists(asset.cacheKey)) {
			scene.load.audio(asset.cacheKey, asset.url);
		}
	}
}
