/**
 * Un solo foco para todo lo que el jugador puede tocar: cartas y botones.
 *
 * El mouse y el teclado mueven el mismo foco. Las flechas saltan al elemento
 * habilitado más cercano en esa dirección, sin importar si es una carta o un
 * botón; como los cantos quedan a la izquierda de la mano, `←` desde la
 * primera carta entra a los botones sin ningún caso especial. Si a los
 * costados no hay nada, `←` y `→` dan la vuelta y entran por el lado opuesto.
 *
 * Sin foco, las flechas parten de un punto de origen que define la escena.
 * Así funciona la "posición imaginaria" al tener que responder un canto.
 */
export type Direction = 'left' | 'right' | 'up' | 'down';

export type Focusable = {
	id: string;
	x: number;
	y: number;
	enabled: boolean;
	setFocused(focused: boolean, instant: boolean): void;
	activate(): void;
};

type Point = { x: number; y: number };

const AXES: Record<Direction, { axis: 'x' | 'y'; sign: 1 | -1 }> = {
	left: { axis: 'x', sign: -1 },
	right: { axis: 'x', sign: 1 },
	up: { axis: 'y', sign: -1 },
	down: { axis: 'y', sign: 1 },
};

/** Dos elementos con menos diferencia que esto están en la misma fila o columna. */
const ALIGNED = 12;

export class FocusNavigator {
	private readonly groups = new Map<string, Focusable[]>();
	private focusedId: string | null = null;
	private readonly fallback: () => string | null;
	private readonly origin: () => Point;

	/**
	 * `fallback` elige el foco cuando no hay ninguno válido (o `null` para
	 * dejarlo vacío); `origin` es desde dónde se mueve cuando está vacío.
	 */
	constructor(fallback: () => string | null, origin: () => Point) {
		this.fallback = fallback;
		this.origin = origin;
	}

	/**
	 * Reemplaza los elementos de un grupo, que la escena vuelve a crear en cada
	 * dibujo. Si el foco sigue existiendo, se aplica sin animación a su nuevo
	 * objeto; si desapareció o se deshabilitó, se elige otro con `fallback`.
	 */
	setGroup(name: string, items: Focusable[]) {
		this.groups.set(name, items);
		const current = this.find(this.focusedId);
		if (current) {
			if (items.includes(current)) current.setFocused(true, true);
			return;
		}
		this.focusedId = null;
		const next = this.find(this.fallback());
		if (!next) return;
		this.focusedId = next.id;
		next.setFocused(true, true);
	}

	focus(id: string | null) {
		if (id === this.focusedId) return;
		const next = this.find(id);
		if (id !== null && !next) return;
		this.find(this.focusedId)?.setFocused(false, false);
		this.focusedId = next?.id ?? null;
		next?.setFocused(true, false);
	}

	move(direction: Direction) {
		const current = this.find(this.focusedId);
		const from = current ?? this.origin();
		const candidates = this.enabledItems().filter((item) => item !== current);
		const target = this.nearest(from, candidates, direction) ?? this.wrap(from, candidates, direction);
		if (target) this.focus(target.id);
	}

	/** Activa el elemento con foco; devuelve si había alguno. */
	activate() {
		const current = this.find(this.focusedId);
		current?.activate();
		return Boolean(current);
	}

	private enabledItems() {
		return [...this.groups.values()].flat().filter((item) => item.enabled);
	}

	private find(id: string | null) {
		return id === null ? undefined : this.enabledItems().find((item) => item.id === id);
	}

	/**
	 * Prefiere lo que está de frente (dentro de un cono); si no hay nada, acepta
	 * cualquier cosa de ese lado. Pesa el doble el desvío que el avance.
	 */
	private nearest(from: Point, candidates: Focusable[], direction: Direction) {
		const { axis, sign } = AXES[direction];
		const cross = axis === 'x' ? 'y' : 'x';
		const ahead = candidates
			.map((item) => ({ item, forward: (item[axis] - from[axis]) * sign, side: Math.abs(item[cross] - from[cross]) }))
			.filter(({ forward }) => forward > 1);
		const inCone = ahead.filter(({ forward, side }) => side <= forward * 2);
		const pool = inCone.length > 0 ? inCone : ahead;
		pool.sort((a, b) => a.forward + a.side * 2 - (b.forward + b.side * 2));
		return pool[0]?.item;
	}

	/** Sólo en horizontal: entra por el extremo opuesto, a la altura más parecida. */
	private wrap(from: Point, candidates: Focusable[], direction: Direction) {
		if (direction === 'up' || direction === 'down' || candidates.length === 0) return undefined;
		const edge = direction === 'right'
			? Math.min(...candidates.map((item) => item.x))
			: Math.max(...candidates.map((item) => item.x));
		return candidates
			.filter((item) => Math.abs(item.x - edge) < ALIGNED)
			.sort((a, b) => Math.abs(a.y - from.y) - Math.abs(b.y - from.y))[0];
	}
}
