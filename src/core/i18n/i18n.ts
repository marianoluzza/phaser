import {
	SUPPORTED_LOCALES,
	TRANSLATIONS,
	type Locale,
	type TranslationKey,
} from './translations';

const LOCALE_STORAGE_KEY = 'arcade.locale';
const FALLBACK_LOCALE: Locale = 'es';

/**
 * Servicio mínimo de internacionalización del arcade.
 *
 * Mantiene un idioma único para todas las escenas, resuelve la preferencia
 * inicial y oculta los posibles errores de acceso a localStorage.
 */
class I18n {
	private locale: Locale = this.resolveInitialLocale();

	getLocale(): Locale {
		return this.locale;
	}

	t(key: TranslationKey): string {
		return TRANSLATIONS[this.locale][key];
	}

	/** Cambia el idioma, lo persiste y avisa si la pantalla debe redibujarse. */
	setLocale(locale: Locale): boolean {
		if (locale === this.locale) {
			return false;
		}

		this.locale = locale;

		try {
			globalThis.localStorage?.setItem(LOCALE_STORAGE_KEY, locale);
		} catch {
			// El juego sigue funcionando si el navegador bloquea el almacenamiento.
		}

		return true;
	}

	private resolveInitialLocale(): Locale {
		const storedLocale = this.readStoredLocale();
		if (storedLocale) {
			return storedLocale;
		}

		// navigator.languages respeta el orden configurado por el usuario.
		const browserLocales = typeof navigator === 'undefined'
			? []
			: [...(navigator.languages ?? []), navigator.language];

		for (const browserLocale of browserLocales) {
			const normalizedLocale = browserLocale.toLowerCase().split('-')[0];
			if (this.isSupportedLocale(normalizedLocale)) {
				return normalizedLocale;
			}
		}

		return FALLBACK_LOCALE;
	}

	private readStoredLocale(): Locale | null {
		try {
			const storedLocale = globalThis.localStorage?.getItem(LOCALE_STORAGE_KEY);
			return storedLocale && this.isSupportedLocale(storedLocale)
				? storedLocale
				: null;
		} catch {
			return null;
		}
	}

	private isSupportedLocale(locale: string): locale is Locale {
		return SUPPORTED_LOCALES.some((supportedLocale) => supportedLocale === locale);
	}
}

/** Instancia compartida por el launcher y todos los juegos. */
export const i18n = new I18n();
export type { Locale, TranslationKey } from './translations';
