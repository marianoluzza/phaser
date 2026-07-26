import type Phaser from 'phaser';

/**
 * Assets de audio pertenecientes a las pantallas compartidas del arcade.
 *
 * La versión forma parte de la URL para que el navegador descarte la pista
 * anterior si el contenido publicado cambia.
 */
export const CORE_AUDIO = {
	launcherMusic: {
		cacheKey: 'core:music:launcher',
		url: 'https://pub-40dcb8cd66b94e2ab050da55f65f9d2a.r2.dev/audio/music/abstraction/2026-q1/Week 1 - Retro Lounge BASE.ogg?v=24bf93b867454b7b',
	},
} as const;

/** Carga sólo la música del launcher cuando todavía no está en la caché. */
export function loadCoreAudio(scene: Phaser.Scene) {
	const asset = CORE_AUDIO.launcherMusic;
	if (!scene.cache.audio.exists(asset.cacheKey)) {
		scene.load.audio(asset.cacheKey, asset.url);
	}
}
