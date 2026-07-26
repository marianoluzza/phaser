import Phaser from 'phaser';
import { i18n } from '../../../core/i18n/i18n';
import { CORE_SCENES } from '../../../core/sceneKeys';
import { TRUCO_SCENES } from '../sceneKeys';

/** Pantalla de inicio del Truco v1. */
export class TrucoTitleScene extends Phaser.Scene {
	private enterKey!: Phaser.Input.Keyboard.Key;
	private escapeKey!: Phaser.Input.Keyboard.Key;

	constructor() {
		super(TRUCO_SCENES.TITLE);
	}

	create() {
		this.cameras.main.setBackgroundColor('#17120d');
		this.add.text(400, 105, i18n.t('truco.title.title'), {
			fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '64px', color: '#fff4d6', letterSpacing: 8,
		}).setOrigin(0.5);
		this.add.text(400, 175, i18n.t('truco.title.subtitle'), {
			fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#d5b979', letterSpacing: 3,
		}).setOrigin(0.5);
		this.add.text(400, 280, i18n.t('truco.title.rules'), {
			fontFamily: 'Courier New, monospace', fontSize: '16px', color: '#f4e7c5', align: 'center', lineSpacing: 12,
		}).setOrigin(0.5);
		this.createButton(400, 435, i18n.t('truco.title.play'), () => this.scene.start(TRUCO_SCENES.GAME));
		this.createButton(400, 510, i18n.t('truco.title.backToArcade'), () => this.scene.start(CORE_SCENES.LAUNCHER));

		const keyboard = this.input.keyboard!;
		this.enterKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
		this.escapeKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
	}

	update() {
		if (Phaser.Input.Keyboard.JustDown(this.enterKey)) this.scene.start(TRUCO_SCENES.GAME);
		if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) this.scene.start(CORE_SCENES.LAUNCHER);
	}

	private createButton(x: number, y: number, label: string, action: () => void) {
		const button = this.add.rectangle(x, y, 300, 50, 0x3a2815).setStrokeStyle(1, 0xf2b84b).setInteractive({ useHandCursor: true });
		this.add.text(x, y, label, { fontFamily: 'Courier New, monospace', fontSize: '15px', color: '#fff4d6' }).setOrigin(0.5);
		button.on('pointerdown', action);
	}
}
