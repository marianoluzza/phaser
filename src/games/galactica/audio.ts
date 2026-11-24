import type Phaser from 'phaser';

const R2 = 'https://pub-40dcb8cd66b94e2ab050da55f65f9d2a.r2.dev/audio';
const UI = `${R2}/sfx/kenney/interface-sounds/Audio`;
const SCIFI = `${R2}/sfx/kenney/sci-fi-sounds/Audio`;
const DIGITAL = `${R2}/sfx/kenney/digital-audio/Audio`;

/**
 * Assets de audio propios de Galáctica.
 *
 * El combate suena con Sci-Fi Sounds (láseres, impactos, explosiones y el
 * escudo) y los avisos y premios con Digital Audio, más cercano a un arcade de
 * los ochenta. Los menús comparten los efectos de interfaz del resto del
 * arcade. El disparo propio tiene que ser cortísimo: suena cada 90 ms.
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
	shoot: { cacheKey: 'galactica:sfx:shoot', url: `${SCIFI}/laserSmall_000.ogg?v=72b589eadd417812` },
	hit: { cacheKey: 'galactica:sfx:hit', url: `${SCIFI}/impactMetal_004.ogg?v=0032710d1fc88c21` },
	explosion: { cacheKey: 'galactica:sfx:explosion', url: `${SCIFI}/explosionCrunch_000.ogg?v=4b597d658d0ae101` },
	bigExplosion: { cacheKey: 'galactica:sfx:big-explosion', url: `${SCIFI}/explosionCrunch_004.ogg?v=9c3a1c73cadf0de5` },
	blast: { cacheKey: 'galactica:sfx:blast', url: `${SCIFI}/lowFrequency_explosion_000.ogg?v=3cb48d86dab63140` },
	playerHit: { cacheKey: 'galactica:sfx:player-hit', url: `${DIGITAL}/phaserDown1.ogg?v=d2d046cd0247045f` },
	shield: { cacheKey: 'galactica:sfx:shield', url: `${SCIFI}/forceField_000.ogg?v=c2916f2a062c8ddd` },
	podOpen: { cacheKey: 'galactica:sfx:pod-open', url: `${SCIFI}/doorOpen_000.ogg?v=5b7e07eccd4413ad` },
	pickup: { cacheKey: 'galactica:sfx:pickup', url: `${DIGITAL}/powerUp2.ogg?v=83786b43d828a399` },
	evolve: { cacheKey: 'galactica:sfx:evolve', url: `${DIGITAL}/powerUp1.ogg?v=8c361b624b560c0b` },
	unlock: { cacheKey: 'galactica:sfx:unlock', url: `${DIGITAL}/powerUp3.ogg?v=59e7591f7a068882` },
	strike: { cacheKey: 'galactica:sfx:strike', url: `${DIGITAL}/zap1.ogg?v=4e4bf11c671a4be0` },
	stormBlock: { cacheKey: 'galactica:sfx:storm-block', url: `${DIGITAL}/zapThreeToneUp.ogg?v=52da0ff5e219179d` },
	warning: { cacheKey: 'galactica:sfx:warning', url: `${DIGITAL}/lowThreeTone.ogg?v=b4b3bc7420e71bfb` },
	zoneClear: { cacheKey: 'galactica:sfx:zone-clear', url: `${DIGITAL}/threeTone1.ogg?v=bdf21eb12e65507f` },
	gameOver: { cacheKey: 'galactica:sfx:game-over', url: `${DIGITAL}/zapThreeToneDown.ogg?v=272e60bc62a1685f` },
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
