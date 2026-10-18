import Phaser from 'phaser';
import type { Focusable } from './focusNavigator';

/**
 * Botón de las acciones del Truco. Puede tener foco, como las cartas, y
 * muestra en una esquina la tecla que lo activa. Opcionalmente se llena de
 * izquierda a derecha, como el de la mano siguiente.
 */
export type ActionButtonConfig = {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	label: string;
	enabled: boolean;
	onClick: () => void;
	/** El puntero encima le da el foco. */
	onHover: () => void;
	hotkey?: string;
};

const RADIUS = 5;
const LABEL_PADDING = 8;
const FOCUS_SCALE = 1.05;

const STYLES = {
	enabled: { fill: 0x50361b, edge: 0xf2b84b, text: '#fff4d6' },
	focused: { fill: 0x7a5626, edge: 0xffe3a0, text: '#ffffff' },
	disabled: { fill: 0x2b2115, edge: 0x5f4a2c, text: '#806b4e' },
};

export class ActionButton {
	readonly focusable: Focusable;
	readonly hotkey?: string;
	private readonly scene: Phaser.Scene;
	private readonly config: ActionButtonConfig;
	private readonly container: Phaser.GameObjects.Container;
	private readonly background: Phaser.GameObjects.Graphics;
	private readonly progressFill: Phaser.GameObjects.Graphics;
	private readonly label: Phaser.GameObjects.Text;
	private focused = false;

	constructor(scene: Phaser.Scene, config: ActionButtonConfig) {
		this.scene = scene;
		this.config = config;
		this.hotkey = config.hotkey?.toLowerCase();
		const { x, y, width, height, label, enabled, hotkey } = config;
		this.background = scene.add.graphics();
		this.progressFill = scene.add.graphics();
		this.label = scene.add.text(0, 0, label, { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '13px' }).setOrigin(0.5);
		for (let size = 12; this.label.width > width - LABEL_PADDING * 2 && size >= 9; size--) this.label.setFontSize(size);
		const children: Phaser.GameObjects.GameObject[] = [this.background, this.progressFill, this.label];
		if (hotkey) children.push(...this.createHotkeyBadge(hotkey));
		this.container = scene.add.container(x, y, children).setSize(width, height);
		if (enabled) {
			this.container.setInteractive({ useHandCursor: true })
				.on('pointerdown', config.onClick)
				.on('pointerover', config.onHover);
		}
		this.draw();
		this.focusable = {
			id: config.id,
			x,
			y,
			enabled,
			setFocused: (focused, instant) => this.setFocused(focused, instant),
			activate: () => {
				if (enabled) config.onClick();
			},
		};
	}

	/** Llena el botón de izquierda a derecha; `fraction` va de 0 a 1. */
	setProgress(fraction: number) {
		const { width, height } = this.config;
		this.progressFill.clear();
		this.progressFill.fillStyle(0xf2b84b, 0.28);
		this.progressFill.fillRoundedRect(-width / 2 + 3, -height / 2 + 3, Math.max(0, (width - 6) * fraction), height - 6, RADIUS - 2);
	}

	destroy() {
		this.scene.tweens.killTweensOf(this.container);
		this.container.destroy();
	}

	private setFocused(focused: boolean, instant: boolean) {
		this.focused = focused;
		this.draw();
		const scale = focused ? FOCUS_SCALE : 1;
		this.scene.tweens.killTweensOf(this.container);
		if (instant) this.container.setScale(scale);
		else this.scene.tweens.add({ targets: this.container, scale, duration: 90, ease: 'Quad.easeOut' });
	}

	private draw() {
		const { width, height, enabled } = this.config;
		const style = !enabled ? STYLES.disabled : this.focused ? STYLES.focused : STYLES.enabled;
		const g = this.background;
		g.clear();
		if (this.focused) {
			// Un halo por fuera, para que el foco se vea aun de reojo.
			g.lineStyle(4, STYLES.enabled.edge, 0.35);
			g.strokeRoundedRect(-width / 2 - 3, -height / 2 - 3, width + 6, height + 6, RADIUS + 3);
		}
		g.fillStyle(style.fill, 1);
		g.fillRoundedRect(-width / 2, -height / 2, width, height, RADIUS);
		g.lineStyle(2, style.edge, 1);
		g.strokeRoundedRect(-width / 2, -height / 2, width, height, RADIUS);
		this.label.setColor(style.text);
	}

	/** La tecla, como una tecla chiquita montada sobre la esquina superior derecha. */
	private createHotkeyBadge(hotkey: string) {
		const { width, height, enabled } = this.config;
		const size = 13;
		const cx = width / 2 - 3;
		const cy = -height / 2 + 3;
		const badge = this.scene.add.graphics();
		badge.fillStyle(0x17120d, 1);
		badge.fillRoundedRect(cx - size / 2, cy - size / 2, size, size, 3);
		badge.lineStyle(1, enabled ? STYLES.enabled.edge : STYLES.disabled.edge, 1);
		badge.strokeRoundedRect(cx - size / 2, cy - size / 2, size, size, 3);
		const letter = this.scene.add.text(cx, cy, hotkey.toUpperCase(), {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: '8px',
			color: enabled ? '#f2b84b' : '#5f4a2c',
		}).setOrigin(0.5);
		return [badge, letter];
	}
}
