import Phaser from 'phaser';

const MUSIC_VOLUME_KEY = 'arcade.audio.musicVolume';
const SFX_VOLUME_KEY = 'arcade.audio.sfxVolume';
const DEFAULT_MUSIC_VOLUME = 0.65;
const DEFAULT_SFX_VOLUME = 0.8;
const DUCKED_MUSIC_FACTOR = 0.35;

/**
 * Phaser tipa los sonidos con su clase base, pero las implementaciones WebAudio
 * y HTML5 exponen setVolume. Esta intersección describe esa capacidad común.
 */
type AdjustableSound = Phaser.Sound.BaseSound & {
	setVolume(value: number): unknown;
};

/**
 * Punto común para reproducir música y efectos en todos los juegos.
 *
 * Los juegos siguen siendo responsables de cargar sus archivos. El manager se
 * ocupa de la política compartida: una sola música, volúmenes y persistencia.
 */
class AudioManager {
	private currentMusic: Phaser.Sound.BaseSound | null = null;
	private musicVolume = this.readVolume(MUSIC_VOLUME_KEY, DEFAULT_MUSIC_VOLUME);
	private sfxVolume = this.readVolume(SFX_VOLUME_KEY, DEFAULT_SFX_VOLUME);
	private musicIsDucked = false;

	playMusic(scene: Phaser.Scene, cacheKey: string) {
		this.stopMusic();

		this.currentMusic = scene.sound.add(cacheKey, {
			loop: true,
			volume: this.musicVolume,
		});
		this.musicIsDucked = false;
		this.currentMusic.play();
	}

	playSfx(scene: Phaser.Scene, cacheKey: string) {
		// Un efecto remoto puede fallar al cargar por red o CORS. El sonido es
		// opcional: nunca debe interrumpir una regla, un puntaje o una transición.
		if (!scene.cache.audio.exists(cacheKey)) {
			return;
		}

		scene.sound.play(cacheKey, { volume: this.sfxVolume });
	}

	stopMusic() {
		if (!this.currentMusic) {
			return;
		}

		this.currentMusic.stop();
		this.currentMusic.destroy();
		this.currentMusic = null;
	}

	getMusicVolume() {
		return this.musicVolume;
	}

	getSfxVolume() {
		return this.sfxVolume;
	}

	setMusicVolume(volume: number) {
		this.musicVolume = this.clampVolume(volume);
		this.persistVolume(MUSIC_VOLUME_KEY, this.musicVolume);
		this.applyCurrentMusicVolume();
	}

	/**
	 * Reduce temporalmente la música sin cambiar la preferencia guardada.
	 *
	 * Se usa, por ejemplo, al pausar: mantiene la ambientación pero deja claro
	 * que la partida no está activa. Al reanudar se recupera el volumen elegido.
	 */
	setMusicDucked(ducked: boolean) {
		this.musicIsDucked = ducked;
		this.applyCurrentMusicVolume();
	}

	setSfxVolume(volume: number) {
		this.sfxVolume = this.clampVolume(volume);
		this.persistVolume(SFX_VOLUME_KEY, this.sfxVolume);
	}

	private readVolume(storageKey: string, fallback: number) {
		try {
			const storedValue = globalThis.localStorage?.getItem(storageKey);
			if (storedValue === null || storedValue === undefined) {
				return fallback;
			}

			const parsedValue = Number.parseFloat(storedValue);
			return Number.isFinite(parsedValue) ? this.clampVolume(parsedValue) : fallback;
		} catch {
			return fallback;
		}
	}

	private persistVolume(storageKey: string, volume: number) {
		try {
			globalThis.localStorage?.setItem(storageKey, volume.toString());
		} catch {
			// El audio sigue funcionando aunque el navegador bloquee localStorage.
		}
	}

	private applyCurrentMusicVolume() {
		if (!this.currentMusic) {
			return;
		}

		const effectiveVolume = this.musicIsDucked
			? this.musicVolume * DUCKED_MUSIC_FACTOR
			: this.musicVolume;
		(this.currentMusic as AdjustableSound).setVolume(effectiveVolume);
	}

	private clampVolume(volume: number) {
		return Phaser.Math.Clamp(volume, 0, 1);
	}
}

export const audioManager = new AudioManager();
