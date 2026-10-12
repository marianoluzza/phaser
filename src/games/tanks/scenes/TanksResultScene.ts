import Phaser from 'phaser';
import { audioManager } from '../../../core/audio/AudioManager';
import { i18n } from '../../../core/i18n/i18n';
import { CORE_SCENES } from '../../../core/sceneKeys';
import { loadTanksAudio, TANKS_AUDIO } from '../audio';
import { ENEMY_KINDS, ENEMY_STATS, START_LIVES, type EnemyKind } from '../constants/tuning';
import { drawTank } from '../objects/battleRenderer';
import { ENEMY_LABELS } from '../objects/labels';
import type { CampaignState } from '../state/Battle';
import { readHighScore, submitHighScore } from '../state/highScore';
import { TANKS_SCENES } from '../sceneKeys';

/** Lo que la partida le entrega a esta pantalla al decidirse la etapa. */
export type TanksResult = {
	outcome: 'won' | 'lost';
	reason: 'base' | 'lives';
	/** Estado al terminar la etapa: de acá sale la siguiente. */
	campaign: CampaignState;
	kills: Record<EnemyKind, number>;
};

const ROW_DELAY = 260;

/** Planilla de bajas entre etapas, al estilo del original. */
export class TanksResultScene extends Phaser.Scene {
	private result!: TanksResult;
	private enterKey!: Phaser.Input.Keyboard.Key;
	private menuKey!: Phaser.Input.Keyboard.Key;
	private escapeKey!: Phaser.Input.Keyboard.Key;

	constructor() {
		super(TANKS_SCENES.RESULT);
	}

	init(data: TanksResult) {
		this.result = data;
	}

	preload() {
		loadTanksAudio(this, TANKS_AUDIO.confirm, TANKS_AUDIO.select, TANKS_AUDIO.stageClear, TANKS_AUDIO.gameOver);
	}

	create() {
		const won = this.result.outcome === 'won';
		const previousRecord = readHighScore();
		const newRecord = submitHighScore(this.result.campaign.score);

		this.cameras.main.setBackgroundColor('#080d1a');
		this.drawBackground(won);
		this.drawHeader(won);
		this.drawTally();
		this.drawScore(newRecord ? this.result.campaign.score : previousRecord, newRecord);
		this.createButtons(won);
		audioManager.playSfx(this, won ? TANKS_AUDIO.stageClear.cacheKey : TANKS_AUDIO.gameOver.cacheKey);

		const keyboard = this.input.keyboard!;
		this.enterKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
		this.menuKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
		this.escapeKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
	}

	update() {
		if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
			this.continueCampaign();
			return;
		}
		if (Phaser.Input.Keyboard.JustDown(this.menuKey)) {
			this.goTo(TANKS_SCENES.TITLE);
			return;
		}
		if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
			this.goTo(CORE_SCENES.LAUNCHER);
		}
	}

	private drawBackground(won: boolean) {
		const graphics = this.add.graphics();
		graphics.fillStyle(won ? 0x12263a : 0x30172b, 0.75);
		graphics.fillCircle(400, 280, 290);
		graphics.lineStyle(1, won ? 0x29416f : 0x71364e, 0.22);
		for (let x = 0; x <= 800; x += 40) {
			graphics.lineBetween(x, 0, x, 600);
		}
		for (let y = 0; y <= 600; y += 40) {
			graphics.lineBetween(0, y, 800, y);
		}
	}

	private drawHeader(won: boolean) {
		const title = won
			? i18n.t('tanks.result.cleared')
			: i18n.t(this.result.reason === 'base' ? 'tanks.result.baseLost' : 'tanks.result.livesLost');
		this.add.text(400, 62, title, {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: '46px',
			color: won ? '#f2c14e' : '#ff647c',
			letterSpacing: 4,
		}).setOrigin(0.5);

		this.add.text(400, 112, i18n.t(won ? 'tanks.result.clearedHint' : 'tanks.result.lostHint'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '14px',
			color: '#9eacd0',
		}).setOrigin(0.5);

		const seed = this.result.campaign.seed === undefined ? '' : `   #${this.result.campaign.seed}`;
		this.add.text(400, 146, `${i18n.t('tanks.result.stage')}  ${this.result.campaign.stage}${seed}`, {
			fontFamily: 'Courier New, monospace',
			fontSize: '18px',
			color: '#f5f7ff',
			fontStyle: 'bold',
		}).setOrigin(0.5);
	}

	/** Una fila por tipo de enemigo; aparecen de a una, como en el original. */
	private drawTally() {
		this.add.rectangle(400, 268, 460, 196, 0x11131f, 0.92).setStrokeStyle(2, 0x29416f);

		const graphics = this.add.graphics();
		let totalKills = 0;
		ENEMY_KINDS.forEach((kind, index) => {
			const y = 194 + index * 38;
			const kills = this.result.kills[kind];
			const points = ENEMY_STATS[kind].points;
			totalKills += kills;

			const row = [
				this.add.text(250, y, i18n.t(ENEMY_LABELS[kind]), this.rowStyle('#9eacd0')).setOrigin(0, 0.5),
				this.add.text(450, y, `${kills}  ×  ${points}`, this.rowStyle('#f5f7ff')).setOrigin(1, 0.5),
				this.add.text(610, y, String(kills * points), this.rowStyle('#f2c14e')).setOrigin(1, 0.5),
			];
			row.forEach((text) => text.setAlpha(0));

			this.time.delayedCall(ROW_DELAY * (index + 1), () => {
				row.forEach((text) => text.setAlpha(1));
				drawTank(graphics, { x: 196, y: y - 14, scale: 1.75 }, {
					kind, x: 0, y: 0, dir: 'up', hp: ENEMY_STATS[kind].hp, bonus: false, travelled: 0,
				}, 0);
				audioManager.playSfx(this, TANKS_AUDIO.select.cacheKey);
			});
		});

		graphics.lineStyle(1, 0x40577f, 1);
		graphics.lineBetween(190, 342, 610, 342);
		const total = this.add.text(250, 356, `${i18n.t('tanks.result.total')}   ${totalKills}`, this.rowStyle('#f5f7ff'))
			.setOrigin(0, 0.5)
			.setAlpha(0);
		this.time.delayedCall(ROW_DELAY * (ENEMY_KINDS.length + 1), () => total.setAlpha(1));
	}

	private drawScore(highScore: number, newRecord: boolean) {
		this.add.text(250, 402, i18n.t('tanks.result.score'), this.rowStyle('#7384aa')).setOrigin(0, 0.5);
		this.add.text(610, 402, String(this.result.campaign.score), { ...this.rowStyle('#f5f7ff'), fontSize: '22px' })
			.setOrigin(1, 0.5);
		this.add.text(250, 430, i18n.t('tanks.result.highScore'), this.rowStyle('#7384aa')).setOrigin(0, 0.5);
		this.add.text(610, 430, String(highScore), this.rowStyle('#9eacd0')).setOrigin(1, 0.5);

		if (newRecord) {
			const label = this.add.text(430, 430, i18n.t('tanks.result.newRecord'), {
				fontFamily: 'Arial Black, Arial, sans-serif',
				fontSize: '13px',
				color: '#9be15d',
				letterSpacing: 3,
			}).setOrigin(0.5);
			this.tweens.add({ targets: label, alpha: 0.25, duration: 420, yoyo: true, repeat: -1 });
		}
	}

	private createButtons(won: boolean) {
		this.createButton(400, 478, 320, 44, i18n.t(won ? 'tanks.result.next' : 'tanks.result.retry'), true, () => {
			this.continueCampaign();
		});
		this.createButton(305, 536, 230, 38, i18n.t('tanks.result.backToTitle'), false, () => this.goTo(TANKS_SCENES.TITLE));
		this.createButton(495, 536, 230, 38, i18n.t('tanks.result.backToArcade'), false, () => this.goTo(CORE_SCENES.LAUNCHER));
	}

	private createButton(x: number, y: number, width: number, height: number, label: string, primary: boolean, onClick: () => void) {
		const button = this.add.rectangle(x, y, width, height, primary ? 0x18365b : 0x111a31)
			.setStrokeStyle(primary ? 2 : 1, primary ? 0xf2c14e : 0x40577f)
			.setInteractive({ useHandCursor: true });
		this.add.text(x, y, label, {
			fontFamily: 'Courier New, monospace',
			fontSize: primary ? '16px' : '12px',
			color: primary ? '#ffffff' : '#9eacd0',
		}).setOrigin(0.5);
		button.on('pointerdown', onClick);
	}

	private rowStyle(color: string): Phaser.Types.GameObjects.Text.TextStyle {
		return { fontFamily: 'Courier New, monospace', fontSize: '17px', color, fontStyle: 'bold' };
	}

	/** Ganar sigue con la etapa siguiente; perder reintenta la misma desde cero. */
	private continueCampaign() {
		const { campaign } = this.result;
		const next: CampaignState = this.result.outcome === 'won'
			? { ...campaign, stage: campaign.stage + 1 }
			: { stage: campaign.stage, score: 0, lives: START_LIVES, playerLevel: 0, seed: campaign.seed };
		audioManager.playSfx(this, TANKS_AUDIO.confirm.cacheKey);
		this.scene.start(TANKS_SCENES.GAME, next);
	}

	private goTo(sceneKey: string) {
		audioManager.playSfx(this, TANKS_AUDIO.confirm.cacheKey);
		this.scene.start(sceneKey);
	}
}
