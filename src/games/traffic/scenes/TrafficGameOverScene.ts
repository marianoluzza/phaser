import Phaser from 'phaser';
import { audioManager } from '../../../core/audio/AudioManager';
import { i18n, type TranslationKey } from '../../../core/i18n/i18n';
import { CORE_SCENES } from '../../../core/sceneKeys';
import { loadTrafficAudio, TRAFFIC_AUDIO } from '../audio';
import { CENTRO } from '../constants/layouts';
import { drawCity, drawExitSigns, exitSigns } from '../objects/cityRenderer';
import { formatTime } from '../objects/labels';
import { readHighScore, submitHighScore } from '../state/highScore';
import type { TrafficStats } from '../state/Traffic';
import { TRAFFIC_SCENES } from '../sceneKeys';

/** Lo que la partida le entrega a esta pantalla al quedarse sin vidas. */
export type TrafficResult = {
	score: number;
	time: number;
	stats: TrafficStats;
};

/** Fin de partida: puntaje, cómo se perdieron las vidas y reinicio inmediato. */
export class TrafficGameOverScene extends Phaser.Scene {
	private result!: TrafficResult;
	private enterKey!: Phaser.Input.Keyboard.Key;
	private menuKey!: Phaser.Input.Keyboard.Key;
	private escapeKey!: Phaser.Input.Keyboard.Key;

	constructor() {
		super(TRAFFIC_SCENES.OVER);
	}

	init(data: TrafficResult) {
		this.result = data;
	}

	preload() {
		loadTrafficAudio(this, TRAFFIC_AUDIO.confirm, TRAFFIC_AUDIO.gameOver);
	}

	create() {
		const previousRecord = readHighScore();
		const newRecord = submitHighScore(this.result.score);

		this.cameras.main.setBackgroundColor('#080d1a');
		const city = this.add.graphics();
		drawCity(city, CENTRO);
		drawExitSigns(city, exitSigns(CENTRO));
		this.add.rectangle(0, 0, 800, 600, 0x05070d, 0.72).setOrigin(0);

		this.add.rectangle(400, 300, 420, 470, 0x0b1020, 0.95).setStrokeStyle(2, 0x2c3a5c);
		this.add.text(400, 106, i18n.t('traffic.over.title'), {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: '48px',
			color: '#ff4d4d',
			letterSpacing: 4,
		}).setOrigin(0.5);

		this.add.text(400, 162, i18n.t('traffic.over.score'), this.labelStyle()).setOrigin(0.5);
		this.add.text(400, 196, String(this.result.score), {
			fontFamily: 'Courier New, monospace',
			fontSize: '44px',
			color: '#f5f7ff',
			fontStyle: 'bold',
		}).setOrigin(0.5);

		const { stats } = this.result;
		const rows: Array<[TranslationKey, string]> = [
			['traffic.over.time', formatTime(this.result.time)],
			['traffic.over.cars', String(stats.completed)],
			['traffic.over.crashes', String(stats.crashes)],
			['traffic.over.impatient', String(stats.impatient)],
			['traffic.over.highScore', String(newRecord ? this.result.score : previousRecord)],
		];
		rows.forEach(([key, value], index) => {
			const y = 250 + index * 30;
			this.add.text(250, y, i18n.t(key), this.rowStyle('#9eacd0')).setOrigin(0, 0.5);
			this.add.text(550, y, value, this.rowStyle('#f5f7ff')).setOrigin(1, 0.5);
		});

		if (newRecord) {
			const label = this.add.text(400, 412, i18n.t('traffic.over.newRecord'), {
				fontFamily: 'Arial Black, Arial, sans-serif',
				fontSize: '14px',
				color: '#3ddc84',
				letterSpacing: 3,
			}).setOrigin(0.5);
			this.tweens.add({ targets: label, alpha: 0.25, duration: 420, yoyo: true, repeat: -1 });
		}

		this.createButton(400, 456, 340, 46, i18n.t('traffic.over.retry'), true, () => this.goTo(TRAFFIC_SCENES.GAME));
		this.createButton(312, 510, 166, 34, i18n.t('traffic.over.backToTitle'), false, () => this.goTo(TRAFFIC_SCENES.TITLE));
		this.createButton(488, 510, 166, 34, i18n.t('traffic.over.backToArcade'), false, () => this.goTo(CORE_SCENES.LAUNCHER));

		audioManager.playSfx(this, TRAFFIC_AUDIO.gameOver.cacheKey);

		const keyboard = this.input.keyboard!;
		this.enterKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
		this.menuKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
		this.escapeKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
	}

	update() {
		if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
			this.goTo(TRAFFIC_SCENES.GAME);
			return;
		}
		if (Phaser.Input.Keyboard.JustDown(this.menuKey)) {
			this.goTo(TRAFFIC_SCENES.TITLE);
			return;
		}
		if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
			this.goTo(CORE_SCENES.LAUNCHER);
		}
	}

	private createButton(x: number, y: number, width: number, height: number, label: string, primary: boolean, onClick: () => void) {
		const button = this.add.rectangle(x, y, width, height, primary ? 0x0f2b1f : 0x111a31)
			.setStrokeStyle(primary ? 2 : 1, primary ? 0x3ddc84 : 0x40577f)
			.setInteractive({ useHandCursor: true });
		this.add.text(x, y, label, {
			fontFamily: 'Courier New, monospace',
			fontSize: primary ? '17px' : '12px',
			color: primary ? '#ffffff' : '#9eacd0',
			fontStyle: primary ? 'bold' : 'normal',
		}).setOrigin(0.5);
		button.on('pointerdown', onClick);
	}

	private labelStyle(): Phaser.Types.GameObjects.Text.TextStyle {
		return { fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#7384aa', letterSpacing: 3 };
	}

	private rowStyle(color: string): Phaser.Types.GameObjects.Text.TextStyle {
		return { fontFamily: 'Courier New, monospace', fontSize: '17px', color, fontStyle: 'bold' };
	}

	private goTo(sceneKey: string) {
		audioManager.playSfx(this, TRAFFIC_AUDIO.confirm.cacheKey);
		this.scene.start(sceneKey);
	}
}
