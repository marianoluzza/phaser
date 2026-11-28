import Phaser from 'phaser';
import { i18n } from '../../../core/i18n/i18n';
import { Controls } from '../../../core/input/controls';
import { CORE_SCENES } from '../../../core/sceneKeys';
import { TRUCO_CONTROLS } from '../input';
import { TRUCO_SCENES } from '../sceneKeys';

type TrucoResult = { playerScore?: number; aiScore?: number };

/** Resultado de la partida al llegar a 30 puntos. */
export class TrucoGameOverScene extends Phaser.Scene {
	private result: TrucoResult = {};
	private controls!: Controls;

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
		this.controls = new Controls(this, {}, TRUCO_CONTROLS);
	}

	update() {
		if (this.controls.justDown('confirm')) this.scene.start(TRUCO_SCENES.GAME);
		else if (this.controls.justDown('back')) this.scene.start(CORE_SCENES.LAUNCHER);
	}
}
