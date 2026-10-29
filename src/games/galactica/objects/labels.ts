import type Phaser from 'phaser';
import type { TranslationKey } from '../../../core/i18n/i18n';
import type { Maneuver, ShotKind } from '../constants/attacks';
import type { BossMove, Family, Rank } from '../constants/families';
import type { ShipId } from '../constants/ships';
import type { DamageSource } from '../constants/tuning';
import type { EventKind } from '../constants/zones';
import type { PickupKind } from '../state/Battle';

/** Claves de texto compartidas por el título, la partida y el resultado. */
export const SHIP_LABELS: Record<ShipId, {
	name: TranslationKey;
	text: TranslationKey;
	/** La salva de cada etapa, en palabras. */
	stages: [TranslationKey, TranslationKey, TranslationKey];
}> = {
	halcon: {
		name: 'galactica.ship.halcon',
		text: 'galactica.ship.halcon.text',
		stages: ['galactica.ship.halcon.mk1', 'galactica.ship.halcon.mk2', 'galactica.ship.halcon.mk3'],
	},
	aguja: {
		name: 'galactica.ship.aguja',
		text: 'galactica.ship.aguja.text',
		stages: ['galactica.ship.aguja.mk1', 'galactica.ship.aguja.mk2', 'galactica.ship.aguja.mk3'],
	},
	bastion: {
		name: 'galactica.ship.bastion',
		text: 'galactica.ship.bastion.text',
		stages: ['galactica.ship.bastion.mk1', 'galactica.ship.bastion.mk2', 'galactica.ship.bastion.mk3'],
	},
};

export const PICKUP_LABELS: Record<PickupKind, { name: TranslationKey; hint: TranslationKey }> = {
	life: { name: 'galactica.pickup.life', hint: 'galactica.pickup.life.hint' },
	energy: { name: 'galactica.pickup.energy', hint: 'galactica.pickup.energy.hint' },
	core: { name: 'galactica.pickup.core', hint: 'galactica.pickup.core.hint' },
	shield: { name: 'galactica.pickup.shield', hint: 'galactica.pickup.shield.hint' },
	double: { name: 'galactica.pickup.double', hint: 'galactica.pickup.double.hint' },
	speed: { name: 'galactica.pickup.speed', hint: 'galactica.pickup.speed.hint' },
};

export const FAMILY_LABELS: Record<Family, TranslationKey> = {
	terran: 'galactica.family.terran',
	insect: 'galactica.family.insect',
	crystal: 'galactica.family.crystal',
	mythic: 'galactica.family.mythic',
};

export const FAMILY_TEXTS: Record<Family, TranslationKey> = {
	terran: 'galactica.family.terran.text',
	insect: 'galactica.family.insect.text',
	crystal: 'galactica.family.crystal.text',
	mythic: 'galactica.family.mythic.text',
};

export const RANK_LABELS: Record<Rank | 0, TranslationKey> = {
	0: 'galactica.rank.0',
	1: 'galactica.rank.1',
	2: 'galactica.rank.2',
	3: 'galactica.rank.3',
};

export const SHOT_LABELS: Record<ShotKind, { name: TranslationKey; text: TranslationKey }> = {
	single: { name: 'galactica.shot.single', text: 'galactica.shot.single.text' },
	double: { name: 'galactica.shot.double', text: 'galactica.shot.double.text' },
	helix: { name: 'galactica.shot.helix', text: 'galactica.shot.helix.text' },
	fan3: { name: 'galactica.shot.fan3', text: 'galactica.shot.fan3.text' },
	fan5: { name: 'galactica.shot.fan5', text: 'galactica.shot.fan5.text' },
	split: { name: 'galactica.shot.split', text: 'galactica.shot.split.text' },
};

export const MANEUVER_LABELS: Record<Maneuver, { name: TranslationKey; text: TranslationKey }> = {
	swoop: { name: 'galactica.maneuver.swoop', text: 'galactica.maneuver.swoop.text' },
	dive: { name: 'galactica.maneuver.dive', text: 'galactica.maneuver.dive.text' },
	diveReturn: { name: 'galactica.maneuver.diveReturn', text: 'galactica.maneuver.diveReturn.text' },
	planted: { name: 'galactica.maneuver.planted', text: 'galactica.maneuver.planted.text' },
};

export const EVENT_LABELS: Record<EventKind, { name: TranslationKey; text: TranslationKey }> = {
	pod: { name: 'galactica.event.pod', text: 'galactica.event.pod.text' },
	asteroids: { name: 'galactica.event.asteroids', text: 'galactica.event.asteroids.text' },
	comets: { name: 'galactica.event.comets', text: 'galactica.event.comets.text' },
};

export const BOSS_LABELS: Record<Family, { name: TranslationKey; text: TranslationKey }> = {
	terran: { name: 'galactica.boss.terran', text: 'galactica.boss.terran.text' },
	insect: { name: 'galactica.boss.insect', text: 'galactica.boss.insect.text' },
	crystal: { name: 'galactica.boss.crystal', text: 'galactica.boss.crystal.text' },
	mythic: { name: 'galactica.boss.mythic', text: 'galactica.boss.mythic.text' },
};

export const BOSS_MOVE_LABELS: Record<BossMove, TranslationKey> = {
	fan: 'galactica.bossMove.fan',
	helix: 'galactica.bossMove.helix',
	spiral: 'galactica.bossMove.spiral',
	summon: 'galactica.bossMove.summon',
	charge: 'galactica.bossMove.charge',
};

export const DAMAGE_LABELS: Record<DamageSource, TranslationKey> = {
	bolt: 'galactica.damage.bolt',
	helix: 'galactica.damage.helix',
	fan: 'galactica.damage.fan',
	blast: 'galactica.damage.blast',
	ram: 'galactica.damage.ram',
	comet: 'galactica.damage.comet',
	rock: 'galactica.damage.rock',
	empty: 'galactica.damage.empty',
};

/** Color de cada recarga en el HUD y en los carteles, igual al de su cápsula. */
export const PICKUP_COLORS: Record<PickupKind, string> = {
	life: '#ef5466',
	energy: '#ffd860',
	core: '#7fe0ff',
	shield: '#b072e6',
	double: '#ff8a3a',
	speed: '#6fe39a',
};

export const TEXT = {
	label: { fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#7384aa', letterSpacing: 2 },
	value: { fontFamily: 'Courier New, monospace', fontSize: '20px', color: '#f5f7ff', fontStyle: 'bold' },
	small: { fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#9eacd0' },
	mono: { fontFamily: 'Courier New, monospace', fontSize: '13px', color: '#d9e2ff' },
} satisfies Record<string, Phaser.Types.GameObjects.Text.TextStyle>;
