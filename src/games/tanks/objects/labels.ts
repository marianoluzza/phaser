import type { TranslationKey } from '../../../core/i18n/i18n';
import type { EnemyKind } from '../constants/tuning';
import type { PowerUpKind } from '../state/Battle';

/** Claves de texto de cada bonus, compartidas por el título y la partida. */
export const POWER_UP_LABELS: Record<PowerUpKind, { name: TranslationKey; hint: TranslationKey }> = {
	star: { name: 'tanks.powerUp.star', hint: 'tanks.powerUp.star.hint' },
	grenade: { name: 'tanks.powerUp.grenade', hint: 'tanks.powerUp.grenade.hint' },
	helmet: { name: 'tanks.powerUp.helmet', hint: 'tanks.powerUp.helmet.hint' },
	shovel: { name: 'tanks.powerUp.shovel', hint: 'tanks.powerUp.shovel.hint' },
	clock: { name: 'tanks.powerUp.clock', hint: 'tanks.powerUp.clock.hint' },
	tank: { name: 'tanks.powerUp.tank', hint: 'tanks.powerUp.tank.hint' },
};

export const ENEMY_LABELS: Record<EnemyKind, TranslationKey> = {
	basic: 'tanks.enemy.basic',
	fast: 'tanks.enemy.fast',
	power: 'tanks.enemy.power',
	armor: 'tanks.enemy.armor',
};
