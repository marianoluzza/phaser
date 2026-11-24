import type { Maneuver, ShotKind } from './attacks';

export type Family = 'terran' | 'insect' | 'crystal' | 'mythic';
export const FAMILIES: Family[] = ['terran', 'insect', 'crystal', 'mythic'];

/** 1 soldado, 2 élite, 3 comandante. */
export type Rank = 1 | 2 | 3;

export type EnemySpec = {
	hp: number;
	points: number;
	/** Salva que dispara durante un rizo; null si sólo embiste. */
	shot: ShotKind | null;
	/** Cuántas salvas suelta en cada rizo. */
	volleys: number;
	maneuvers: Array<[Maneuver, number]>;
	/** Multiplica la velocidad de las maniobras. */
	speed: number;
	/** Al morir se parte en esquirlas que se tiran en picada. */
	shards?: number;
	/** Probabilidad de soltar una recarga o mejora al morir. */
	drop: number;
};

/** Prefijo del sprite en la hoja: `<frame>_<rango>`. */
export const FAMILY_FRAME: Record<Family, string> = {
	terran: 'terran',
	insect: 'insect',
	crystal: 'crystal',
	mythic: 'dragon',
};

/** Colores de las chispas al explotar, tomados de la paleta de cada familia. */
export const FAMILY_COLORS: Record<Family, number[]> = {
	terran: [0xa6cf62, 0x5e8a3c, 0xffd860, 0xeef3ff],
	insect: [0xe46ad2, 0x93409e, 0xffd860, 0xb4ecf0],
	crystal: [0xc4fbff, 0x52cfe6, 0xb072e6, 0xeef3ff],
	mythic: [0xef5466, 0xff8a3a, 0xffd860, 0x9c2c48],
};

/**
 * El carácter de cada familia:
 * - Terrestres: rizos prolijos con disparos rectos.
 * - Insectos: casi todo picadas; el comandante se planta.
 * - Cristales: blindados; los disparos se parten y la élite se rompe en esquirlas.
 * - Míticas: fuego en helicoide y abanicos, mucha vida.
 */
export const ENEMIES: Record<Family, Record<Rank, EnemySpec>> = {
	terran: {
		1: { hp: 1, points: 50, shot: 'single', volleys: 1, maneuvers: [['swoop', 1]], speed: 1, drop: 0.03 },
		2: { hp: 2, points: 80, shot: 'double', volleys: 1, maneuvers: [['swoop', 1]], speed: 1, drop: 0.08 },
		3: { hp: 3, points: 150, shot: 'fan3', volleys: 2, maneuvers: [['swoop', 3], ['diveReturn', 1]], speed: 0.95, drop: 0.4 },
	},
	insect: {
		1: { hp: 1, points: 50, shot: null, volleys: 0, maneuvers: [['diveReturn', 3], ['swoop', 1]], speed: 1.2, drop: 0.03 },
		2: { hp: 1, points: 90, shot: 'single', volleys: 2, maneuvers: [['swoop', 2], ['dive', 1]], speed: 1.15, drop: 0.08 },
		3: { hp: 2, points: 160, shot: 'single', volleys: 1, maneuvers: [['planted', 3], ['swoop', 1]], speed: 1.1, drop: 0.4 },
	},
	crystal: {
		1: { hp: 2, points: 60, shot: 'split', volleys: 1, maneuvers: [['swoop', 1]], speed: 0.9, drop: 0.03 },
		2: { hp: 2, points: 100, shot: 'fan5', volleys: 1, maneuvers: [['swoop', 1]], speed: 0.9, shards: 2, drop: 0.08 },
		3: { hp: 4, points: 180, shot: 'helix', volleys: 2, maneuvers: [['swoop', 2], ['planted', 1]], speed: 0.85, drop: 0.4 },
	},
	mythic: {
		1: { hp: 2, points: 70, shot: 'helix', volleys: 1, maneuvers: [['swoop', 3], ['diveReturn', 1]], speed: 1.05, drop: 0.045 },
		2: { hp: 3, points: 120, shot: 'double', volleys: 2, maneuvers: [['swoop', 2], ['diveReturn', 1]], speed: 1.05, drop: 0.09 },
		3: { hp: 4, points: 220, shot: 'fan5', volleys: 2, maneuvers: [['swoop', 1], ['planted', 1]], speed: 1, drop: 0.4 },
	},
};

/** Las esquirlas de cristal: chicas, de un golpe, siempre en picada. */
export const SHARD: EnemySpec = {
	hp: 1, points: 20, shot: null, volleys: 0, maneuvers: [['dive', 1]], speed: 1.15, drop: 0,
};

/** Lo que hace un jefe en cada turno de su ciclo. */
export type BossMove = 'fan' | 'helix' | 'spiral' | 'summon' | 'charge';

export type BossDef = {
	frame: string;
	hp: number;
	points: number;
	/** Se repite en orden; con la mitad de la vida, los turnos se acortan. */
	cycle: BossMove[];
	pause: number;
	speed: number;
};

export const BOSSES: Record<Family, BossDef> = {
	terran: { frame: 'boss_terran', hp: 45, points: 2000, cycle: ['fan', 'summon', 'fan', 'helix'], pause: 1.5, speed: 70 },
	insect: { frame: 'boss_insect', hp: 60, points: 3000, cycle: ['summon', 'fan', 'charge', 'summon', 'helix'], pause: 1.3, speed: 95 },
	crystal: { frame: 'boss_crystal', hp: 75, points: 4000, cycle: ['spiral', 'fan', 'summon', 'helix'], pause: 1.4, speed: 60 },
	mythic: { frame: 'boss_dragon', hp: 95, points: 6000, cycle: ['helix', 'spiral', 'charge', 'summon', 'fan'], pause: 1.2, speed: 85 },
};
