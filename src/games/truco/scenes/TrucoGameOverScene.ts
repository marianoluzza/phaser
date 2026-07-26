import Phaser from 'phaser';
import { i18n } from '../../../core/i18n/i18n';
import { CORE_SCENES } from '../../../core/sceneKeys';
import { TRUCO_SCENES } from '../sceneKeys';

type TrucoResult = { playerScore?: number; aiScore?: number };

/** Resultado de la partida al llegar a 15 puntos. */
export class TrucoGameOverScene extends Phaser.Scene {
	private result: TrucoResult = {};
	private enterKey!: Phaser.Input.Keyboard.Key;
	private escapeKey!: Phaser.Input.Keyboard.Key;

	constructor() {
		super(TRUCO_SCENES.GAME_OVER);
	}

	init(data: TrucoResult) {
		this.result = data;
	}

	create() {
		this.cameras.main.setBackgroundColor('#17120d');
		const playerWon = (this.result.playerScore ?? 0) > (this.result.aiScore ?? 0);
		this.add.text(400, 125, i18n.t('truco.gameOver.title'), { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '48px', color: '#fff4d6', letterSpacing: 4 }).setOrigin(0.5);
		this.add.text(400, 205, playerWon ? i18n.t('truco.gameOver.youWon') : i18n.t('truco.gameOver.aiWon'), { fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#f2b84b' }).setOrigin(0.5);
		this.add.text(400, 290, `${i18n.t('truco.game.you')}: ${this.result.playerScore ?? 0}\n${i18n.t('truco.game.ai')}: ${this.result.aiScore ?? 0}`, { fontFamily: 'Courier New, monospace', fontSize: '22px', color: '#f4e7c5', align: 'center', lineSpacing: 18 }).setOrigin(0.5);
		this.add.text(400, 460, i18n.t('truco.gameOver.actions'), { fontFamily: 'Courier New, monospace', fontSize: '15px', color: '#fff4d6' }).setOrigin(0.5);
		const keyboard = this.input.keyboard!;
		this.enterKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
		this.escapeKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
	}

	update() {
		if (Phaser.Input.Keyboard.JustDown(this.enterKey)) this.scene.start(TRUCO_SCENES.GAME);
		if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) this.scene.start(CORE_SCENES.LAUNCHER);
	}
}
