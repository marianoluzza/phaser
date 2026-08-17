import { PIPE_TYPES, type PipeType } from './constants/pipeTypes';
import {
	bagTotal,
	clampField,
	cloneTuning,
	DEFAULT_TUNING,
	MAX_BAG_COUNT,
	normalizeTuning,
	TUNING_FIELDS,
	type PipesTuning,
	type TuningNumberKey,
} from './constants/tuning';

const ACTIVE_STORAGE_KEY = 'pipes.tuning';
const PROFILES_STORAGE_KEY = 'pipes.tuning.profiles';

/** Perfiles disponibles para guardar balances distintos y comparar. */
export const PROFILE_SLOTS = 4;

/**
 * Configuración activa de Pipes y sus perfiles guardados.
 *
 * Es un único objeto compartido, igual que `i18n` o `audioManager`: las escenas
 * leen de acá al arrancar en vez de recibir la configuración por parámetro. Los
 * cambios se persisten apenas ocurren, así probar un balance y recargar la
 * página no pierde nada.
 *
 * Los perfiles son ranuras fijas y no nombres libres: alcanza para comparar
 * variantes mientras se ajusta el juego y evita pedir texto dentro del canvas.
 */
class PipesTuningStore {
	private tuning: PipesTuning = this.readActive();
	private profiles: (PipesTuning | null)[] = this.readProfiles();

	get current(): PipesTuning {
		return this.tuning;
	}

	/** Cambia un número, respetando los límites declarados por su campo. */
	setValue(key: TuningNumberKey, value: number) {
		const field = TUNING_FIELDS.find((candidate) => candidate.key === key);
		if (!field) return;

		this.tuning[key] = clampField(field, value);
		this.persistActive();
	}

	/**
	 * Cambia cuántas veces entra una pieza en la bolsa.
	 * La última pieza no se puede sacar: una bolsa vacía no reparte nada.
	 */
	setBagCount(type: PipeType, value: number) {
		const next = Math.min(MAX_BAG_COUNT, Math.max(0, Math.round(value)));
		const previous = this.tuning.bag[type];

		this.tuning.bag[type] = next;
		if (bagTotal(this.tuning.bag) === 0) {
			this.tuning.bag[type] = previous;
			return;
		}

		this.persistActive();
	}

	resetToDefaults() {
		this.tuning = cloneTuning(DEFAULT_TUNING);
		this.persistActive();
	}

	/** ¿La configuración activa es exactamente la de fábrica? */
	get isDefault(): boolean {
		const sameNumbers = TUNING_FIELDS.every(
			(field) => this.tuning[field.key] === DEFAULT_TUNING[field.key]
		);
		const sameBag = PIPE_TYPES.every((type) => this.tuning.bag[type] === DEFAULT_TUNING.bag[type]);

		return sameNumbers && sameBag;
	}

	profileAt(slot: number): PipesTuning | null {
		return this.profiles[slot] ?? null;
	}

	saveProfile(slot: number) {
		if (slot < 0 || slot >= PROFILE_SLOTS) return;

		this.profiles[slot] = cloneTuning(this.tuning);
		this.persistProfiles();
	}

	/** Devuelve `false` si la ranura está vacía, para poder avisarlo. */
	loadProfile(slot: number): boolean {
		const profile = this.profiles[slot];
		if (!profile) return false;

		this.tuning = cloneTuning(profile);
		this.persistActive();
		return true;
	}

	clearProfile(slot: number) {
		if (slot < 0 || slot >= PROFILE_SLOTS) return;

		this.profiles[slot] = null;
		this.persistProfiles();
	}

	private readActive(): PipesTuning {
		return normalizeTuning(this.readJson(ACTIVE_STORAGE_KEY));
	}

	private readProfiles(): (PipesTuning | null)[] {
		const stored = this.readJson(PROFILES_STORAGE_KEY);
		const list = Array.isArray(stored) ? stored : [];

		return Array.from({ length: PROFILE_SLOTS }, (_, slot) =>
			list[slot] ? normalizeTuning(list[slot]) : null
		);
	}

	private readJson(key: string): unknown {
		try {
			const stored = globalThis.localStorage?.getItem(key);
			return stored ? JSON.parse(stored) : null;
		} catch {
			// Almacenamiento bloqueado o JSON roto: se juega con los valores por defecto.
			return null;
		}
	}

	private persistActive() {
		this.writeJson(ACTIVE_STORAGE_KEY, this.tuning);
	}

	private persistProfiles() {
		this.writeJson(PROFILES_STORAGE_KEY, this.profiles);
	}

	private writeJson(key: string, value: unknown) {
		try {
			globalThis.localStorage?.setItem(key, JSON.stringify(value));
		} catch {
			// El juego sigue funcionando si el navegador bloquea el almacenamiento.
		}
	}
}

/** Instancia compartida por las escenas de Pipes. */
export const pipesTuning = new PipesTuningStore();
