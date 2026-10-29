/**
 * El hangar: las naves que puede pilotear el jugador.
 *
 * Cada una tiene tres etapas. La etapa cambia el armamento y el sprite
 * (`<id>_1`, `<id>_2`, `<id>_3` en la hoja `ships`); la velocidad, el
 * blindaje y la cadencia son de la nave.
 */
export type ShipId = 'halcon' | 'aguja' | 'bastion';
export const SHIP_IDS: ShipId[] = ['halcon', 'aguja', 'bastion'];

/** Un disparo de la salva: desplazamiento desde el centro y ángulo en grados (0 = recto). */
export type Muzzle = { dx: number; angle?: number; pierce?: boolean };

export type ShipDef = {
	id: ShipId;
	speed: number;
	/** Multiplica el daño recibido: menos es más resistente. */
	armor: number;
	cooldown: number;
	bulletSpeed: number;
	color: number;
	/** Una salva por etapa: índice 0 es mk1. */
	stages: [Muzzle[], Muzzle[], Muzzle[]];
	/** Zona cuyo jefe hay que vencer para desbloquearla; 0 = disponible desde el principio. */
	unlockZone: number;
};

export const SHIPS: Record<ShipId, ShipDef> = {
	halcon: {
		id: 'halcon',
		speed: 250,
		armor: 1,
		cooldown: 0.22,
		bulletSpeed: 640,
		color: 0xffe28a,
		stages: [
			[{ dx: 0 }],
			[{ dx: -14 }, { dx: 14 }],
			[{ dx: 0 }, { dx: -16, angle: -7 }, { dx: 16, angle: 7 }],
		],
		unlockZone: 0,
	},
	aguja: {
		id: 'aguja',
		speed: 320,
		armor: 1.25,
		cooldown: 0.17,
		bulletSpeed: 780,
		color: 0x8dffb8,
		stages: [
			[{ dx: 0 }],
			[{ dx: 0, pierce: true }],
			[{ dx: -9, pierce: true }, { dx: 9, pierce: true }],
		],
		unlockZone: 1,
	},
	bastion: {
		id: 'bastion',
		speed: 200,
		armor: 0.72,
		cooldown: 0.36,
		bulletSpeed: 560,
		color: 0xffb05a,
		stages: [
			[{ dx: -12 }, { dx: 12 }],
			[{ dx: 0 }, { dx: -14, angle: -10 }, { dx: 14, angle: 10 }],
			[{ dx: 0 }, { dx: -10, angle: -8 }, { dx: 10, angle: 8 }, { dx: -18, angle: -18 }, { dx: 18, angle: 18 }],
		],
		unlockZone: 3,
	},
};

export function shipFrame(id: ShipId, stage: number) {
	return `${id}_${stage + 1}`;
}
