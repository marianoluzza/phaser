import Phaser from 'phaser';
import { audioManager } from '../../../core/audio/AudioManager';
import { i18n } from '../../../core/i18n/i18n';
import { CORE_SCENES } from '../../../core/sceneKeys';
import { loadTetrisAudio, TETRIS_AUDIO } from '../audio';
import { TETRIS_SCENES } from '../sceneKeys';

/** Pantalla de inicio propia de Tetris. */
export class TetrisTitleScene extends Phaser.Scene {
	private enterKey!: Phaser.Input.Keyboard.Key;
	private escapeKey!: Phaser.Input.Keyboard.Key;

	constructor() {
		super(TETRIS_SCENES.TITLE);
	}

	preload() {
		loadTetrisAudio(this, TETRIS_AUDIO.introMusic, TETRIS_AUDIO.confirm);
	}

	create() {
		this.cameras.main.setBackgroundColor('#080d1a');
		this.drawBackground();
		this.drawLogo();
		this.drawInstructions();
		this.createButtons();
		audioManager.playMusic(this, TETRIS_AUDIO.introMusic.cacheKey);

		// La música pertenece a esta pantalla: al salir no debe seguir en el arcade.
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audioManager.stopMusic());

		const keyboard = this.input.keyboard!;
		this.enterKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
		this.escapeKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
	}

	update() {
		if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
			this.startGame();
			return;
		}

		if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
			this.goToLauncher();
		}
	}

	private drawBackground() {
		const graphics = this.add.graphics();
		graphics.fillStyle(0x101b36, 1);
		graphics.fillCircle(690, 40, 270);
		graphics.fillStyle(0x17234a, 0.55);
		graphics.fillCircle(90, 570, 220);

		graphics.lineStyle(1, 0x29416f, 0.18);
		for (let x = 0; x <= 800; x += 40) {
			graphics.lineBetween(x, 0, x, 600);
		}
		for (let y = 0; y <= 600; y += 40) {
			graphics.lineBetween(0, y, 800, y);
		}
	}

	private drawLogo() {
		this.add.text(400, 92, 'TETRIS', {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: '72px',
			color: '#f5f7ff',
			letterSpacing: 10,
		}).setOrigin(0.5);

		this.add.text(400, 145, i18n.t('tetris.title.tagline'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '13px',
			color: '#7384aa',
			letterSpacing: 3,
		}).setOrigin(0.5);

		// Las piezas decorativas son Game Objects agrupados en un Container.
		const decoration = this.add.container(400, 218);
		const colors = [0x46d9ff, 0xffca4b, 0xc66cff, 0x5ee48a];
		const blocks: Array<[number, number, number]> = [
			[-116, 0, 0], [-88, 0, 0], [-60, 0, 0], [-32, 0, 0],
			[18, -14, 1], [46, -14, 1], [18, 14, 1], [46, 14, 1],
			[88, 14, 2], [116, 14, 2], [144, 14, 2], [116, -14, 2],
		];

		for (const [x, y, colorIndex] of blocks) {
			decoration.add(
				this.add.rectangle(x, y, 24, 24, colors[colorIndex])
					.setStrokeStyle(1, 0xffffff, 0.25)
			);
		}

		// Un tween modifica propiedades durante el tiempo sin hacerlo manualmente en update.
		this.tweens.add({
			targets: decoration,
			y: 226,
			duration: 1200,
			yoyo: true,
			repeat: -1,
			ease: 'Sine.inOut',
		});
	}

	private drawInstructions() {
		this.add.text(400, 290, i18n.t('tetris.title.howToPlay'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '13px',
			color: '#7384aa',
			letterSpacing: 3,
		}).setOrigin(0.5);

		this.add.text(400, 325, i18n.t('tetris.title.controls'), {
			fontFamily: 'Courier New, monospace',
			fontSize: '16px',
			color: '#d9e2ff',
			align: 'center',
			lineSpacing: 10,
		}).setOrigin(0.5);
	}

	private createButtons() {
		const playButton = this.add.rectangle(400, 430, 270, 56, 0x18365b)
			.setStrokeStyle(2, 0x46d9ff)
			.setInteractive({ useHandCursor: true });
		this.add.text(400, 430, i18n.t('tetris.title.play'), {
			fontFamily: 'Courier New, monospace',
			fontSize: '18px',
			color: '#ffffff',
		}).setOrigin(0.5);
		playButton.on('pointerdown', () => this.startGame());

		const backButton = this.add.rectangle(400, 505, 270, 42, 0x111a31)
			.setStrokeStyle(1, 0x40577f)
			.setInteractive({ useHandCursor: true });
		this.add.text(400, 505, i18n.t('tetris.title.backToArcade'), {
			fontFamily: 'Courier New, monospace',
			fontSize: '13px',
			color: '#9eacd0',
		}).setOrigin(0.5);
		backButton.on('pointerdown', () => this.goToLauncher());
	}

	private startGame() {
		audioManager.playSfx(this, TETRIS_AUDIO.confirm.cacheKey);
		this.scene.start(TETRIS_SCENES.GAME);
	}

	private goToLauncher() {
		audioManager.playSfx(this, TETRIS_AUDIO.confirm.cacheKey);
		this.scene.start(CORE_SCENES.LAUNCHER);
	}
}
