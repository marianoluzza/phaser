import { i18n, type TranslationKey } from '../../../core/i18n/i18n';
import { ROOMS } from '../constants/rooms';
import type { LogEntry } from '../state/Combat';

/** Completa los `{nombre}` de una traducción con sus valores. */
export function fill(key: TranslationKey, values: Record<string, string | number> = {}): string {
	let text = i18n.t(key);
	for (const [name, value] of Object.entries(values)) {
		text = text.split(`{${name}}`).join(String(value));
	}

	return text;
}

/**
 * Arma la línea de bitácora con su traducción.
 *
 * El combate guarda claves y números; el idioma lo pone la pantalla, que es
 * la única que sabe cuál está activo.
 */
export function formatEntry(entry: LogEntry, key: TranslationKey = entry.key): string {
	return fill(key, {
		...entry.values,
		...(entry.piece ? { piece: i18n.t(entry.piece) } : {}),
		...(entry.room ? { room: i18n.t(ROOMS[entry.room].nameKey) } : {}),
	});
}
