import type Phaser from 'phaser';

const R2 = 'https://pub-40dcb8cd66b94e2ab050da55f65f9d2a.r2.dev/audio';

/**
 * Assets de audio propios de Tanques.
 *
 * La biblioteca no tiene disparos ni explosiones reales: se eligieron efectos
 * de interfaz cortos y secos que, mezclados con la música, cumplen ese papel.
 */
export const TANKS_AUDIO = {
	introMusic: {
		cacheKey: 'tanks:music:intro',
		url: `${R2}/music/abstraction/2026-q1/Week%206%20-%20Never%20Miss%20TAKE%20AIM.ogg?v=525a6106c6dfd6d1`,
	},
	gameMusic: {
		cacheKey: 'tanks:music:game',
		url: `${R2}/music/abstraction/2026-q1/Week%206%20-%20Never%20Miss%20FIRE.ogg?v=028797c6d4053c84`,
	},
	confirm: {
		cacheKey: 'tanks:sfx:confirm',
		url: `${R2}/sfx/kenney/interface-sounds/Audio/confirmation_001.ogg?v=063564703b6094d7`,
	},
	select: {
		cacheKey: 'tanks:sfx:select',
		url: `${R2}/sfx/kenney/interface-sounds/Audio/select_002.ogg?v=4cc6ac5341b9b2c8`,
	},
	shoot: {
		cacheKey: 'tanks:sfx:shoot',
		url: `${R2}/sfx/kenney/interface-sounds/Audio/click_002.ogg?v=adcd1f4adc35f1b4`,
	},
	brick: {
		cacheKey: 'tanks:sfx:brick',
		url: `${R2}/sfx/kenney/interface-sounds/Audio/drop_001.ogg?v=692ee3a6f1821402`,
	},
	steel: {
		cacheKey: 'tanks:sfx:steel',
		url: `${R2}/sfx/kenney/interface-sounds/Audio/tick_004.ogg?v=0253d5f7d8d2afbb`,
	},
	explosion: {
		cacheKey: 'tanks:sfx:explosion',
		url: `${R2}/sfx/kenney/interface-sounds/Audio/glitch_002.ogg?v=1da06a2e63ce131f`,
	},
	playerDown: {
		cacheKey: 'tanks:sfx:player-down',
		url: `${R2}/sfx/kenney/interface-sounds/Audio/error_006.ogg?v=a97513d7fd2b12b1`,
	},
	baseDown: {
		cacheKey: 'tanks:sfx:base-down',
		url: `${R2}/sfx/kenney/interface-sounds/Audio/glitch_004.ogg?v=d0f4db4d12f88592`,
	},
	powerUpAppear: {
		cacheKey: 'tanks:sfx:power-up-appear',
		url: `${R2}/sfx/kenney/interface-sounds/Audio/question_001.ogg?v=abb8f9e4eb207149`,
	},
	powerUpTaken: {
		cacheKey: 'tanks:sfx:power-up-taken',
		url: `${R2}/sfx/kenney/interface-sounds/Audio/maximize_003.ogg?v=df16f25d45189f5d`,
	},
	extraLife: {
		cacheKey: 'tanks:sfx:extra-life',
		url: `${R2}/sfx/kenney/interface-sounds/Audio/confirmation_003.ogg?v=3091bf0be0497f82`,
	},
	stageClear: {
		cacheKey: 'tanks:sfx:stage-clear',
		url: `${R2}/sfx/kenney/interface-sounds/Audio/confirmation_004.ogg?v=568967a3d9f8a8f6`,
	},
	gameOver: {
		cacheKey: 'tanks:sfx:game-over',
		url: `${R2}/sfx/kenney/interface-sounds/Audio/error_003.ogg?v=885b28175c7b5111`,
	},
	pauseToggle: {
		cacheKey: 'tanks:sfx:pause-toggle',
		url: `${R2}/sfx/kenney/ui-audio/Audio/switch1.ogg?v=efdd1d1e2904fb2d`,
	},
} as const;

type TanksAudioAsset = (typeof TANKS_AUDIO)[keyof typeof TANKS_AUDIO];

/** Carga sólo los assets que todavía no existan en la caché de Phaser. */
export function loadTanksAudio(scene: Phaser.Scene, ...assets: TanksAudioAsset[]) {
	for (const asset of assets) {
		if (!scene.cache.audio.exists(asset.cacheKey)) {
			scene.load.audio(asset.cacheKey, asset.url);
		}
	}
}
