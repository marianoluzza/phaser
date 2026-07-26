import Phaser from 'phaser';
import { audioManager } from '../../../core/audio/AudioManager';
import { i18n } from '../../../core/i18n/i18n';
import { CORE_SCENES } from '../../../core/sceneKeys';
import { loadTetrisAudio, TETRIS_AUDIO } from '../audio';
import { TETRIS_SCENES } from '../sceneKeys';

/** Resultado que la escena de partida entrega a la pantalla final. */
export type TetrisResult = {
	score: number;
	lines: number;
	level: number;
};

/** Pantalla final de Tetris, separada de la lógica de la partida. */
export class TetrisGameOverScene extends Phaser.Scene {
	private result: TetrisResult = { score: 0, lines: 0, level: 1 };
	private retryKey!: Phaser.Input.Keyboard.Key;
	private menuKey!: Phaser.Input.Keyboard.Key;
	private escapeKey!: Phaser.Input.Keyboard.Key;

	constructor() {
		super(TETRIS_SCENES.GAME_OVER);
	}

	preload() {
		loadTetrisAudio(this, TETRIS_AUDIO.confirm, TETRIS_AUDIO.gameOver);
	}

	/** `init` recibe los datos enviados mediante `scene.start(key, data)`. */
	init(data: Partial<TetrisResult>) {
		this.result = {
			score: data.score ?? 0,
			lines: data.lines ?? 0,
			level: data.level ?? 1,
		};
	}

	create() {
		this.cameras.main.setBackgroundColor('#080d1a');
		this.drawBackground();
		this.drawResult();
		this.createButtons();
		audioManager.playSfx(this, TETRIS_AUDIO.gameOver.cacheKey);

		const keyboard = this.input.keyboard!;
		this.retryKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
		this.menuKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
		this.escapeKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
	}

	update() {
		if (Phaser.Input.Keyboard.JustDown(this.retryKey)) {
			this.startGame();
			return;
		}

		if (Phaser.Input.Keyboard.JustDown(this.menuKey)) {
			this.goToTitle();
			return;
		}

		if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
			this.goToLauncher();
		}
	}

	private drawBackground() {
		const graphics = this.add.graphics();
		graphics.fillStyle(0x30172b, 0.75);
		graphics.fillCircle(400, 300, 290);
		graphics.lineStyle(1, 0x71364e, 0.22);
		for (let x = 0; x <= 800; x += 40) {
			graphics.lineBetween(x, 0, x, 600);
		}
		for (let y = 0; y <= 600; y += 40) {
			graphics.lineBetween(0, y, 800, y);
		}
	}

	private drawResult() {
		this.add.text(400, 90, i18n.t('tetris.gameOver.title'), {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: '54px',
			color: '#ff647c',
			letterSpacing: 5,
		}).setOrigin(0.5);

		this.add.text(400, 155, i18n.t('tetris.gameOver.result'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '13px',
			color: '#a77a91',
			letterSpacing: 3,
		}).setOrigin(0.5);

		const panel = this.add.rectangle(400, 270, 390, 150, 0x11131f, 0.96)
			.setStrokeStyle(2, 0x71364e);
		panel.setOrigin(0.5);

		const resultLabels = [
			i18n.t('tetris.gameOver.score'),
			i18n.t('tetris.gameOver.lines'),
			i18n.t('tetris.gameOver.level'),
		].join('\n');
		this.add.text(290, 220, resultLabels, {
			fontFamily: 'Courier New, monospace',
			fontSize: '17px',
			color: '#8d91a8',
			lineSpacing: 12,
		});
		this.add.text(510, 220, `${this.result.score}\n${this.result.lines}\n${this.result.level}`, {
			fontFamily: 'Courier New, monospace',
			fontSize: '17px',
			color: '#ffffff',
			align: 'right',
			lineSpacing: 12,
		}).setOrigin(1, 0);
	}

	private createButtons() {
		this.createActionButton(400, 385, i18n.t('tetris.gameOver.retry'), 0x4b2036, 0xff647c, () => {
			this.startGame();
		});
		this.createActionButton(400, 450, i18n.t('tetris.gameOver.backToTitle'), 0x171d30, 0x52658e, () => {
			this.goToTitle();
		});
		this.createActionButton(400, 515, i18n.t('tetris.gameOver.backToArcade'), 0x111522, 0x3d4968, () => {
			this.goToLauncher();
		});
	}

	private startGame() {
		audioManager.playSfx(this, TETRIS_AUDIO.confirm.cacheKey);
		this.scene.start(TETRIS_SCENES.GAME);
	}

	private goToTitle() {
		audioManager.playSfx(this, TETRIS_AUDIO.confirm.cacheKey);
		this.scene.start(TETRIS_SCENES.TITLE);
	}

	private goToLauncher() {
		audioManager.playSfx(this, TETRIS_AUDIO.confirm.cacheKey);
		this.scene.start(CORE_SCENES.LAUNCHER);
	}

	private createActionButton(
		x: number,
		y: number,
		label: string,
		fillColor: number,
		borderColor: number,
		onClick: () => void
	) {
		const button = this.add.rectangle(x, y, 320, 48, fillColor)
			.setStrokeStyle(1, borderColor)
			.setInteractive({ useHandCursor: true });
		this.add.text(x, y, label, {
			fontFamily: 'Courier New, monospace',
			fontSize: '14px',
			color: '#ffffff',
		}).setOrigin(0.5);
		button.on('pointerdown', onClick);
	}
}
