import { aptitude, type PieceType } from '../constants/pieces';
import type { RoomId } from '../constants/rooms';
import { COMBAT_TUNING } from '../constants/tuning';

/**
 * Un tripulante concreto.
 *
 * El tipo dice qué sabe hacer; el `id` lo distingue de otro igual, porque una
 * nave puede llevar dos peones y hay que poder asignarlos por separado.
 */
export type CrewMember = {
	id: string;
	type: PieceType;
	/** Cada herida resta un punto de aptitud. La segunda lo saca del combate. */
	wounds: number;
};

/**
 * La tripulación de la partida.
 *
 * No sabe nada de la nave ni de Phaser: es la lista de quiénes están a bordo y
 * cómo están. Dónde está cada uno lo decide `Ship`.
 */
export class Crew {
	private readonly members: CrewMember[];

	constructor(types: PieceType[]) {
		// El id incluye el tipo para que los registros de partida se lean solos.
		this.members = types.map((type, index) => ({
			id: `${type}-${index + 1}`,
			type,
			wounds: 0,
		}));
	}

	/**
	 * Tripulación inicial: sin reina.
	 *
	 * La pieza más poderosa no viene de fábrica. Se consigue promocionando un
	 * peón o reclutándola, y ésa es la zanahoria de toda la campaña.
	 */
	static starting(): Crew {
		return new Crew(['king', 'rook', 'bishop', 'knight', 'pawn']);
	}

	/** Copia independiente, con sus heridas: el pronóstico hiere sobre ella. */
	clone(): Crew {
		const copy = new Crew([]);
		copy.members.push(...this.members.map((member) => ({ ...member })));
		return copy;
	}

	all(): readonly CrewMember[] {
		return this.members;
	}

	byId(id: string): CrewMember | undefined {
		return this.members.find((member) => member.id === id);
	}

	get size(): number {
		return this.members.length;
	}

	/** Hiere a un tripulante y avisa si con eso quedó fuera de combate. */
	wound(id: string): boolean {
		const member = this.byId(id);
		if (!member) return false;

		member.wounds += 1;
		return isDown(member);
	}

	/**
	 * Le saca una herida a quien tenga más, esté donde esté: la enfermería
	 * atiende a toda la nave, no sólo a quien está adentro. Devuelve a quién curó.
	 */
	healOne(): CrewMember | null {
		const wounded = this.members
			.filter((member) => member.wounds > 0)
			.sort((a, b) => b.wounds - a.wounds);

		if (!wounded.length) return null;

		wounded[0].wounds -= 1;
		return wounded[0];
	}

	/** Quiénes pueden ocupar un puesto ahora mismo. */
	available(): CrewMember[] {
		return this.members.filter((member) => !isDown(member));
	}
}

/** Un tripulante con demasiadas heridas ya no ocupa puestos. */
export function isDown(member: CrewMember): boolean {
	return member.wounds >= COMBAT_TUNING.woundsToDrop;
}

/**
 * Aptitud real de un tripulante en una sala.
 *
 * La herida no lo saca de la sala: lo deja trabajando peor. Un especialista
 * herido rinde como cualquiera, y alguien que ya no servía para esa sala sigue
 * sin servir.
 */
export function effectiveAptitude(member: CrewMember, room: RoomId): number {
	if (isDown(member)) return 0;

	return Math.max(0, aptitude(member.type, room) - member.wounds);
}
