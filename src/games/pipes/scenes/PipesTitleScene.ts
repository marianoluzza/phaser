import Phaser from 'phaser';
import { audioManager } from '../../../core/audio/AudioManager';
import { i18n } from '../../../core/i18n/i18n';
import { Controls } from '../../../core/input/controls';
import { CORE_SCENES } from '../../../core/sceneKeys';
import { loadPipesAudio, PIPES_AUDIO } from '../audio';
import type { PipeType } from '../constants/pipeTypes';
import { drawPipe } from '../objects/pipeRenderer';
import { PIPES_SCENES } from '../sceneKeys';

/** Pantalla de inicio propia de Pipes. */
export class PipesTitleScene extends Phaser.Scene {
	private controls!: Controls<'config'>;

	constructor() {
		super(PIPES_SCENES.TITLE);
	}

	preload() {
		loadPipesAudio(this, PIPES_AUDIO.introMusic, PIPES_AUDIO.confirm);
	}

	create() {
		this.cameras.main.setBackgroundColor('#080d1a');
		this.drawBackground();
		this.drawLogo();
		const instructionsBottom = this.drawInstructions();
		this.createButtons(instructionsBottom + 14);
		audioManager.playMusic(this, PIPES_AUDIO.introMusic.cacheKey);

		// La música pertenece a esta pantalla: al salir no debe seguir sonando.
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audioManager.stopMusic());

		this.controls = new Controls(this, { config: { keys: ['C'], pad: ['y'] } });
	}

	update() {
		if (this.controls.justDown('confirm')) {
			this.startGame();
			return;
		}

		if (this.controls.justDown('config')) {
			this.openConfig();
			return;
		}

		if (this.controls.justDown('back')) {
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
		this.add.text(400, 92, 'PIPES', {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: '72px',
			color: '#f5f7ff',
			letterSpacing: 10,
		}).setOrigin(0.5);

		this.add.text(400, 145, i18n.t('pipes.title.tagline'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '13px',
			color: '#7384aa',
			letterSpacing: 3,
		}).setOrigin(0.5);

		// El recorrido decorativo usa el mismo dibujante que el tablero.
		const decoration = this.add.container(400, 218);
		const graphics = this.add.graphics();
		decoration.add(graphics);

		const route: Array<[number, PipeType]> = [
			[-150, 'horizontal'],
			[-100, 'horizontal'],
			[-50, 'curveEastSouth'],
			[0, 'cross'],
			[50, 'curveWestNorth'],
			[100, 'horizontal'],
			[150, 'horizontal'],
		];

		for (const [x, type] of route) {
			drawPipe(graphics, x, 0, 48, type);
		}

		this.tweens.add({
			targets: decoration,
			y: 226,
			duration: 1200,
			yoyo: true,
			repeat: -1,
			ease: 'Sine.inOut',
		});
	}

	/**
	 * Los textos se apilan con su alto real: el bloque de controles cambia de
	 * renglones con el idioma o con una tecla nueva, y con posiciones fijas
	 * terminaba pisando el título y el botón de jugar. Devuelve dónde termina.
	 */
	private drawInstructions(): number {
		const howToPlay = this.add.text(400, 266, i18n.t('pipes.title.howToPlay'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '13px',
			color: '#7384aa',
			letterSpacing: 3,
		}).setOrigin(0.5, 0);

		const controls = this.add.text(400, howToPlay.y + howToPlay.displayHeight + 10, i18n.t('pipes.title.controls'), {
			fontFamily: 'Courier New, monospace',
			fontSize: '15px',
			color: '#d9e2ff',
			align: 'center',
			lineSpacing: 10,
		}).setOrigin(0.5, 0);

		// La regla de la meta define el juego, así que se explica antes de jugar.
		const goal = this.add.text(400, controls.y + controls.displayHeight + 12, i18n.t('pipes.title.goal'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '12px',
			color: '#8290b3',
			align: 'center',
			lineSpacing: 5,
		}).setOrigin(0.5, 0);

		return goal.y + goal.displayHeight;
	}

	private createButtons(top: number) {
		const playY = top + 26;
		const playButton = this.add.rectangle(400, playY, 270, 52, 0x17402d)
			.setStrokeStyle(2, 0x5ee48a)
			.setInteractive({ useHandCursor: true });
		this.add.text(400, playY, i18n.t('pipes.title.play'), {
			fontFamily: 'Courier New, monospace',
			fontSize: '18px',
			color: '#ffffff',
		}).setOrigin(0.5);
		playButton.on('pointerdown', () => this.startGame());

		// La configuración vive acá y no dentro de la partida: cambia las reglas
		// del nivel, así que no debería tocarse con el agua corriendo.
		const configY = playY + 52;
		const configButton = this.add.rectangle(400, configY, 270, 38, 0x1b2947)
			.setStrokeStyle(1, 0x46d9ff)
			.setInteractive({ useHandCursor: true });
		this.add.text(400, configY, i18n.t('pipes.title.config'), {
			fontFamily: 'Courier New, monospace',
			fontSize: '13px',
			color: '#bfe9ff',
		}).setOrigin(0.5);
		configButton.on('pointerdown', () => this.openConfig());

		const backY = configY + 50;
		const backButton = this.add.rectangle(400, backY, 270, 38, 0x111a31)
			.setStrokeStyle(1, 0x40577f)
			.setInteractive({ useHandCursor: true });
		this.add.text(400, backY, i18n.t('pipes.title.backToArcade'), {
			fontFamily: 'Courier New, monospace',
			fontSize: '13px',
			color: '#9eacd0',
		}).setOrigin(0.5);
		backButton.on('pointerdown', () => this.goToLauncher());
	}

	private startGame() {
		audioManager.playSfx(this, PIPES_AUDIO.confirm.cacheKey);
		this.scene.start(PIPES_SCENES.GAME);
	}

	private openConfig() {
		audioManager.playSfx(this, PIPES_AUDIO.confirm.cacheKey);
		this.scene.start(PIPES_SCENES.CONFIG);
	}

	private goToLauncher() {
		audioManager.playSfx(this, PIPES_AUDIO.confirm.cacheKey);
		this.scene.start(CORE_SCENES.LAUNCHER);
	}
}
