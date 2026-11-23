import type Phaser from 'phaser';

const R2 = 'https://pub-40dcb8cd66b94e2ab050da55f65f9d2a.r2.dev/audio';
const UI = `${R2}/sfx/kenney/interface-sounds/Audio`;
const SCIFI = `${R2}/sfx/kenney/sci-fi-sounds/Audio`;
const DIGITAL = `${R2}/sfx/kenney/digital-audio/Audio`;

/**
 * Assets de audio propios de Socavón, todos de la biblioteca del arcade: el
 * pico y la vagoneta con los metales de Sci-Fi Sounds, los avisos con Digital
 * Audio.
 */
export const SOCAVON_AUDIO = {
	titleMusic: {
		cacheKey: 'socavon:music:title',
		url: `${R2}/music/retro/Retro-Instrumental.ogg?v=83004861bc32b230`,
	},
	gameMusic: {
		cacheKey: 'socavon:music:game',
		url: `${R2}/music/retro/Retro-Electronic.ogg?v=5c4763c916e8662b`,
	},
	confirm: { cacheKey: 'socavon:sfx:confirm', url: `${UI}/confirmation_001.ogg?v=063564703b6094d7` },
	select: { cacheKey: 'socavon:sfx:select', url: `${UI}/select_002.ogg?v=4cc6ac5341b9b2c8` },
	take: { cacheKey: 'socavon:sfx:take', url: `${UI}/drop_002.ogg?v=4ac4d1cef7e93696` },
	drop: { cacheKey: 'socavon:sfx:drop', url: `${UI}/drop_003.ogg?v=43d086d50f90493a` },
	hide: { cacheKey: 'socavon:sfx:hide', url: `${UI}/drop_004.ogg?v=10738707f9300f9b` },
	locked: { cacheKey: 'socavon:sfx:locked', url: `${UI}/error_002.ogg?v=76810ec365f41078` },
	lamp: { cacheKey: 'socavon:sfx:lamp', url: `${UI}/glass_001.ogg?v=183eebee20eb0a53` },
	/** Un golpecito seco que, más grave, pasa por un paso en la roca. */
	step: { cacheKey: 'socavon:sfx:step', url: `${UI}/tick_004.ogg?v=0253d5f7d8d2afbb` },
	hit: { cacheKey: 'socavon:sfx:hit', url: `${SCIFI}/impactMetal_001.ogg?v=4a2b76f20052819c` },
	wallBroken: { cacheKey: 'socavon:sfx:wall-broken', url: `${SCIFI}/explosionCrunch_000.ogg?v=4b597d658d0ae101` },
	cartStart: { cacheKey: 'socavon:sfx:cart-start', url: `${SCIFI}/impactMetal_003.ogg?v=ef29c3943ee70161` },
	vault: { cacheKey: 'socavon:sfx:vault', url: `${SCIFI}/doorOpen_001.ogg?v=8c204ca94eb722d3` },
	deliver: { cacheKey: 'socavon:sfx:deliver', url: `${DIGITAL}/powerUp2.ogg?v=83786b43d828a399` },
	key: { cacheKey: 'socavon:sfx:key', url: `${DIGITAL}/powerUp7.ogg?v=9048d651b51f5280` },
	bell: { cacheKey: 'socavon:sfx:bell', url: `${DIGITAL}/lowThreeTone.ogg?v=b4b3bc7420e71bfb` },
	spotted: { cacheKey: 'socavon:sfx:spotted', url: `${DIGITAL}/zapThreeToneUp.ogg?v=52da0ff5e219179d` },
	caught: { cacheKey: 'socavon:sfx:caught', url: `${DIGITAL}/zapThreeToneDown.ogg?v=272e60bc62a1685f` },
	cleared: { cacheKey: 'socavon:sfx:cleared', url: `${DIGITAL}/threeTone1.ogg?v=bdf21eb12e65507f` },
	pauseToggle: {
		cacheKey: 'socavon:sfx:pause-toggle',
		url: `${R2}/sfx/kenney/ui-audio/Audio/switch1.ogg?v=efdd1d1e2904fb2d`,
	},
} as const;

export type SocavonAudioAsset = (typeof SOCAVON_AUDIO)[keyof typeof SOCAVON_AUDIO];

/** Carga sólo los assets que todavía no existan en la caché de Phaser. */
export function loadSocavonAudio(scene: Phaser.Scene, ...assets: SocavonAudioAsset[]) {
	for (const asset of assets) {
		if (!scene.cache.audio.exists(asset.cacheKey)) {
			scene.load.audio(asset.cacheKey, asset.url);
		}
	}
}
