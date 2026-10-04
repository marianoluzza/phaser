import { ROOMS, type RoomId } from '../constants/rooms';
import { effectiveAptitude, type Crew, type CrewMember } from './Crew';

/** Un puesto concreto: la sala y cuál de sus puestos. */
export type SlotRef = { room: RoomId; slot: number };

/**
 * Quién estaba en cada puesto, como dato plano.
 *
 * Es lo que viaja entre escenas para que reintentar un combate arranque con el
 * mismo reparto: corregir una decisión es mucho más rápido que rehacerla.
 */
export type ShipLayout = Array<{ ref: SlotRef; memberId: string }>;

/**
 * Estado de la nave: casco y quién ocupa cada puesto.
 *
 * No importa Phaser ni sabe cómo se dibuja el plano. Guarda ids de tripulantes,
 * no objetos: así la tripulación puede cambiar (heridas, promociones) sin que
 * la nave tenga que enterarse.
 */
export class Ship {
	hull: number;
	readonly maxHull: number;

	/** Clave de puesto → id del tripulante que lo ocupa. */
	private readonly assignments = new Map<string, string>();

	constructor(maxHull = 20) {
		this.maxHull = maxHull;
		this.hull = maxHull;
	}

	/** Copia independiente: el pronóstico juega la ronda sobre ella. */
	clone(): Ship {
		const copy = new Ship(this.maxHull);
		copy.hull = this.hull;
		for (const [slotKey, memberId] of this.assignments) copy.assignments.set(slotKey, memberId);
		return copy;
	}

	layout(): ShipLayout {
		return [...this.assignments].map(([slotKey, memberId]) => ({ ref: parseKey(slotKey), memberId }));
	}

	restore(layout: ShipLayout) {
		for (const { ref, memberId } of layout) this.assign(ref, memberId);
	}

	/**
	 * Manda un tripulante a un puesto.
	 *
	 * Nadie puede estar en dos lugares a la vez, así que primero se lo saca de
	 * donde estuviera. Si el puesto ya estaba ocupado, el anterior queda sin
	 * asignar: reemplazar es una decisión válida, no un error.
	 */
	assign(ref: SlotRef, memberId: string) {
		const previous = this.slotOf(memberId);
		if (previous) this.assignments.delete(key(previous));

		this.assignments.set(key(ref), memberId);
	}

	/** Saca a quien ocupe el puesto y lo devuelve, si había alguien. */
	clear(ref: SlotRef): string | null {
		const memberId = this.assignments.get(key(ref)) ?? null;
		this.assignments.delete(key(ref));
		return memberId;
	}

	memberIdAt(ref: SlotRef): string | null {
		return this.assignments.get(key(ref)) ?? null;
	}

	slotOf(memberId: string): SlotRef | null {
		for (const [slotKey, assigned] of this.assignments) {
			if (assigned === memberId) return parseKey(slotKey);
		}

		return null;
	}

	/** Quiénes están trabajando en una sala. */
	occupants(room: RoomId, crew: Crew): CrewMember[] {
		const members: CrewMember[] = [];

		for (let slot = 0; slot < ROOMS[room].slots; slot += 1) {
			const memberId = this.memberIdAt({ room, slot });
			const member = memberId ? crew.byId(memberId) : undefined;
			if (member) members.push(member);
		}

		return members;
	}

	/** Salas con gente adentro y cuánto rinden: es lo que el enemigo mira. */
	occupiedRooms(crew: Crew): Array<{ room: RoomId; output: number }> {
		return (Object.keys(ROOMS) as RoomId[])
			.filter((room) => this.occupants(room, crew).length > 0)
			.map((room) => ({ room, output: this.output(room, crew) }));
	}

	/** Tripulantes en condiciones de trabajar que todavía no tienen puesto. */
	unassigned(crew: Crew): CrewMember[] {
		return crew.available().filter((member) => !this.slotOf(member.id));
	}

	/** Saca del plano a quien haya quedado fuera de combate. */
	dropIncapacitated(crew: Crew) {
		for (const member of crew.all()) {
			const slot = this.slotOf(member.id);
			if (slot && !crew.available().includes(member)) this.clear(slot);
		}
	}

	/**
	 * Cuánto produce una sala con la gente que tiene adentro.
	 *
	 * El aporte de cada puesto es la aptitud de quien lo ocupa por el valor del
	 * puesto: una sala llena de gente que no sabe hacer ese trabajo produce
	 * exactamente lo mismo que una sala vacía.
	 *
	 * `instead` responde "¿y si pusiera a éste en ese puesto?" sin mover a
	 * nadie: es lo que la pantalla anticipa mientras el jugador tiene una pieza
	 * en la mano.
	 */
	output(room: RoomId, crew: Crew, instead?: { slot: number; memberId: string }): number {
		const profile = ROOMS[room];
		let total = 0;

		for (let slot = 0; slot < profile.slots; slot += 1) {
			const memberId = instead?.slot === slot ? instead.memberId : this.memberIdAt({ room, slot });
			const member = memberId ? crew.byId(memberId) : undefined;
			if (member) total += effectiveAptitude(member, room) * profile.perSlot;
		}

		return total;
	}
}

function key(ref: SlotRef): string {
	return `${ref.room}:${ref.slot}`;
}

function parseKey(slotKey: string): SlotRef {
	const [room, slot] = slotKey.split(':');
	return { room: room as RoomId, slot: Number(slot) };
}
