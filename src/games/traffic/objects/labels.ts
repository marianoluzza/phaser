import type Phaser from 'phaser';
import { i18n, type TranslationKey } from '../../../core/i18n/i18n';
import type { ArmId } from '../constants/layouts';
import { inkFor, type ExitSign } from './cityRenderer';
import type { LightAnchor } from './lightRenderer';

/** Letra de cada semáforo: N, E, S, O en español; N, E, S, W en inglés. */
export const ARM_LABELS: Record<ArmId, TranslationKey> = {
	N: 'traffic.arm.N',
	E: 'traffic.arm.E',
	S: 'traffic.arm.S',
	W: 'traffic.arm.W',
};

/** Escribe la letra de dirección sobre la etiqueta de cada semáforo. */
export function createLightLabels(scene: Phaser.Scene, anchors: LightAnchor[]) {
	return anchors.map((anchor) =>
		scene.add.text(anchor.x, anchor.tagY, i18n.t(ARM_LABELS[anchor.arm]), {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: '14px',
			color: '#f5f7ff',
		}).setOrigin(0.5)
	);
}

/** Escribe la letra de cada salida sobre su cartel. */
export function createSignLetters(scene: Phaser.Scene, signs: ExitSign[]) {
	return signs.map((sign) =>
		scene.add.text(sign.x, sign.y, sign.exit.letter, {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: '16px',
			color: inkFor(sign.exit.color),
		}).setOrigin(0.5)
	);
}

/** Minutos y segundos, como en el marcador. */
export function formatTime(seconds: number) {
	const whole = Math.floor(seconds);
	return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
