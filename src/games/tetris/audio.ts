import type Phaser from 'phaser';

/**
 * Assets de audio que pertenecen exclusivamente a Tetris.
 *
 * Las URLs apuntan a R2 y llevan una versión basada en el contenido. Si algún
 * archivo cambia, su URL también cambia y el navegador no reutiliza el anterior.
 */
export const TETRIS_AUDIO = {
	introMusic: {
		cacheKey: 'tetris:music:intro',
		url: 'https://pub-40dcb8cd66b94e2ab050da55f65f9d2a.r2.dev/audio/music/abstraction/2026-q2/Week%2021%20-%20Freefall%20GLIDE.ogg?v=d2ee7e1a0aa29958',
	},
	gameMusic: {
		cacheKey: 'tetris:music:game',
		url: 'https://pub-40dcb8cd66b94e2ab050da55f65f9d2a.r2.dev/audio/music/abstraction/2026-q2/Week%2021%20-%20Freefall%20WHAT%20A%20VIEW.ogg?v=4cd1c6c3a57b0cc4',
	},
	confirm: {
		cacheKey: 'tetris:sfx:confirm',
		url: 'https://pub-40dcb8cd66b94e2ab050da55f65f9d2a.r2.dev/audio/sfx/kenney/interface-sounds/Audio/confirmation_001.ogg?v=063564703b6094d7',
	},
	lineClear: {
		cacheKey: 'tetris:sfx:line-clear',
		url: 'https://pub-40dcb8cd66b94e2ab050da55f65f9d2a.r2.dev/audio/sfx/kenney/interface-sounds/Audio/minimize_006.ogg?v=39d7c47855b9642f',
	},
	multiLineClear: {
		cacheKey: 'tetris:sfx:multi-line-clear',
		url: 'https://pub-40dcb8cd66b94e2ab050da55f65f9d2a.r2.dev/audio/sfx/kenney/interface-sounds/Audio/maximize_006.ogg?v=f050b3bb77cb0b90',
	},
	levelUp: {
		cacheKey: 'tetris:sfx:level-up',
		url: 'https://pub-40dcb8cd66b94e2ab050da55f65f9d2a.r2.dev/audio/sfx/kenney/interface-sounds/Audio/drop_004.ogg?v=10738707f9300f9b',
	},
	pauseToggle: {
		cacheKey: 'tetris:sfx:pause-toggle',
		url: 'https://pub-40dcb8cd66b94e2ab050da55f65f9d2a.r2.dev/audio/sfx/kenney/ui-audio/Audio/switch1.ogg?v=efdd1d1e2904fb2d',
	},
	gameOver: {
		cacheKey: 'tetris:sfx:game-over',
		url: 'https://pub-40dcb8cd66b94e2ab050da55f65f9d2a.r2.dev/audio/sfx/kenney/interface-sounds/Audio/error_003.ogg?v=885b28175c7b5111',
	},
} as const;

type TetrisAudioAsset = (typeof TETRIS_AUDIO)[keyof typeof TETRIS_AUDIO];

/** Carga sólo los assets que todavía no existan en la caché de Phaser. */
export function loadTetrisAudio(scene: Phaser.Scene, ...assets: TetrisAudioAsset[]) {
	for (const asset of assets) {
		if (!scene.cache.audio.exists(asset.cacheKey)) {
			scene.load.audio(asset.cacheKey, asset.url);
		}
	}
}
