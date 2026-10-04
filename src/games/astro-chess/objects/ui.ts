import type Phaser from 'phaser';

export const FONTS = {
	display: 'Arial Black, Arial, sans-serif',
	sans: 'Arial, sans-serif',
	mono: 'Courier New, monospace',
} as const;

const BUTTON_STYLES = {
	primary: { fill: 0x231a4d, hover: 0x33266e, stroke: 0xc66cff, strokeWidth: 2, text: '#ffffff' },
	secondary: { fill: 0x141130, hover: 0x221d4d, stroke: 0x4a4488, strokeWidth: 1, text: '#bfb6ff' },
} as const;

export type Button = {
	background: Phaser.GameObjects.Rectangle;
	label: Phaser.GameObjects.Text;
};

/**
 * Botón de las pantallas de Astro Chess.
 *
 * Cada acción también tiene su tecla, que va escrita en la etiqueta: el botón
 * es para el mouse, no la única forma de llegar.
 */
export function addButton(
	scene: Phaser.Scene,
	x: number,
	y: number,
	width: number,
	height: number,
	text: string,
	onClick: () => void,
	variant: keyof typeof BUTTON_STYLES = 'primary'
): Button {
	const style = BUTTON_STYLES[variant];
	const background = scene.add
		.rectangle(x, y, width, height, style.fill)
		.setStrokeStyle(style.strokeWidth, style.stroke)
		.setInteractive({ useHandCursor: true });
	const label = scene.add
		.text(x, y, text, {
			fontFamily: FONTS.mono,
			fontSize: height >= 36 ? '14px' : '12px',
			color: style.text,
		})
		.setOrigin(0.5);

	background.on('pointerover', () => background.setFillStyle(style.hover));
	background.on('pointerout', () => background.setFillStyle(style.fill));
	background.on('pointerdown', onClick);

	return { background, label };
}

/** Texto que aparece sobre algo, sube y se desvanece: daño, esquivas, curas. */
export function floatText(scene: Phaser.Scene, x: number, y: number, text: string, color: string) {
	const label = scene.add
		.text(x, y, text, {
			fontFamily: FONTS.display,
			fontSize: '16px',
			color,
			stroke: '#050914',
			strokeThickness: 4,
		})
		.setOrigin(0.5)
		.setDepth(20);

	scene.tweens.add({
		targets: label,
		y: y - 30,
		alpha: { from: 1, to: 0 },
		duration: 1000,
		ease: 'Cubic.easeOut',
		onComplete: () => label.destroy(),
	});
}
