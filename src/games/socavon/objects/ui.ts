import type Phaser from 'phaser';
import { i18n, type TranslationKey } from '../../../core/i18n/i18n';

export const COLORS = {
	ink: 0x120c0e,
	panel: 0x21130f,
	border: 0x74391d,
	gold: '#f2bd36',
	paper: '#eed5aa',
	muted: '#a58872',
	danger: '#ff5a3c',
} as const;

export const TITLE_FONT = 'Arial Black, Arial, sans-serif';
export const BODY_FONT = 'Courier New, monospace';

/** Un texto traducido con sus `{huecos}` completados. */
export function phrase(key: TranslationKey, values: Record<string, string | number>) {
	return Object.entries(values).reduce<string>(
		(text, [name, value]) => text.replace(`{${name}}`, String(value)),
		i18n.t(key)
	);
}

export function addLabel(scene: Phaser.Scene, x: number, y: number, text: string, size: number, color: string = COLORS.paper) {
	return scene.add.text(x, y, text, { fontFamily: BODY_FONT, fontSize: `${size}px`, fontStyle: 'bold', color });
}

export function addButton(scene: Phaser.Scene, x: number, y: number, width: number, label: string, onClick: () => void) {
	const box = scene.add.rectangle(x, y, width, 38, COLORS.panel)
		.setStrokeStyle(2, COLORS.border)
		.setInteractive({ useHandCursor: true });
	box.on('pointerover', () => box.setFillStyle(0x3a2017));
	box.on('pointerout', () => box.setFillStyle(COLORS.panel));
	box.on('pointerdown', onClick);
	addLabel(scene, x, y, label, 15).setOrigin(0.5);
	return box;
}
