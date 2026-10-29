import type Phaser from 'phaser';

const R2 = 'https://pub-40dcb8cd66b94e2ab050da55f65f9d2a.r2.dev/audio';
const UI = `${R2}/sfx/kenney/interface-sounds/Audio`;

/**
 * Assets de audio propios de Galáctica.
 *
 * Como en Tanques, la biblioteca no tiene láseres ni explosiones: se eligieron
 * efectos de interfaz cortos que cumplen ese papel debajo de la música.
 */
export const GALACTICA_AUDIO = {
	titleMusic: {
		cacheKey: 'galactica:music:title',
		url: `${R2}/music/abstraction/2026-q1/Week%2011%20-%20Lost%20in%20Space.ogg?v=e0870db1d80c2134`,
	},
	gameMusic: {
		cacheKey: 'galactica:music:game',
		url: `${R2}/music/retro/Retro-Synthwave.ogg?v=af6f92c5c6f7adee`,
	},
	bossMusic: {
		cacheKey: 'galactica:music:boss',
		url: `${R2}/music/abstraction/2026-q1/Week%204%20-%20Cloak%20of%20Darkness%20STAGE%203.ogg?v=d807a6c88f396414`,
	},
	confirm: { cacheKey: 'galactica:sfx:confirm', url: `${UI}/confirmation_001.ogg?v=063564703b6094d7` },
	select: { cacheKey: 'galactica:sfx:select', url: `${UI}/select_002.ogg?v=4cc6ac5341b9b2c8` },
	shoot: { cacheKey: 'galactica:sfx:shoot', url: `${UI}/tick_002.ogg?v=869442f54214be90` },
	hit: { cacheKey: 'galactica:sfx:hit', url: `${UI}/click_003.ogg?v=2fa929138bc3a0f4` },
	explosion: { cacheKey: 'galactica:sfx:explosion', url: `${UI}/glitch_002.ogg?v=1da06a2e63ce131f` },
	bigExplosion: { cacheKey: 'galactica:sfx:big-explosion', url: `${UI}/glitch_004.ogg?v=d0f4db4d12f88592` },
	blast: { cacheKey: 'galactica:sfx:blast', url: `${UI}/drop_002.ogg?v=4ac4d1cef7e93696` },
	playerHit: { cacheKey: 'galactica:sfx:player-hit', url: `${UI}/error_006.ogg?v=a97513d7fd2b12b1` },
	shield: { cacheKey: 'galactica:sfx:shield', url: `${UI}/glass_002.ogg?v=08e972c73e53c91d` },
	pickup: { cacheKey: 'galactica:sfx:pickup', url: `${UI}/maximize_003.ogg?v=df16f25d45189f5d` },
	evolve: { cacheKey: 'galactica:sfx:evolve', url: `${UI}/confirmation_003.ogg?v=3091bf0be0497f82` },
	unlock: { cacheKey: 'galactica:sfx:unlock', url: `${UI}/maximize_006.ogg?v=f050b3bb77cb0b90` },
	warning: { cacheKey: 'galactica:sfx:warning', url: `${UI}/question_002.ogg?v=46056f10c70dda86` },
	zoneClear: { cacheKey: 'galactica:sfx:zone-clear', url: `${UI}/confirmation_004.ogg?v=568967a3d9f8a8f6` },
	gameOver: { cacheKey: 'galactica:sfx:game-over', url: `${UI}/error_003.ogg?v=885b28175c7b5111` },
	pauseToggle: {
		cacheKey: 'galactica:sfx:pause-toggle',
		url: `${R2}/sfx/kenney/ui-audio/Audio/switch1.ogg?v=efdd1d1e2904fb2d`,
	},
} as const;

type GalacticaAudioAsset = (typeof GALACTICA_AUDIO)[keyof typeof GALACTICA_AUDIO];

/** Carga sólo los assets que todavía no existan en la caché de Phaser. */
export function loadGalacticaAudio(scene: Phaser.Scene, ...assets: GalacticaAudioAsset[]) {
	for (const asset of assets) {
		if (!scene.cache.audio.exists(asset.cacheKey)) {
			scene.load.audio(asset.cacheKey, asset.url);
		}
	}
}
