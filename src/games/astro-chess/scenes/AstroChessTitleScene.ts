import Phaser from 'phaser';
import { audioManager } from '../../../core/audio/AudioManager';
import { i18n } from '../../../core/i18n/i18n';
import { CORE_SCENES } from '../../../core/sceneKeys';
import { ASTRO_AUDIO, loadAstroAudio } from '../audio';
import { PIECE_TYPES } from '../constants/pieces';
import { drawPiece } from '../objects/pieceRenderer';
import { addButton, FONTS } from '../objects/ui';
import { ASTRO_SCENES } from '../sceneKeys';

const CREW_ROW_Y = 300;
const CREW_SPACING = 96;
const PIECE_SIZE = 56;

/**
 * Pantalla de inicio de Astro Chess.
 *
 * Sólo presenta y deja elegir: jugar, aprender o volver. Lo que hace cada
 * pieza, cada sala y cada anuncio enemigo vive en la ayuda, que tiene lugar
 * para mostrarlo sobre el plano en vez de contarlo en una línea.
 */
export class AstroChessTitleScene extends Phaser.Scene {
	private enterKey!: Phaser.Input.Keyboard.Key;
	private helpKey!: Phaser.Input.Keyboard.Key;
	private escapeKey!: Phaser.Input.Keyboard.Key;

	constructor() {
		super(ASTRO_SCENES.TITLE);
	}

	preload() {
		loadAstroAudio(this, ASTRO_AUDIO.introMusic, ASTRO_AUDIO.select, ASTRO_AUDIO.confirm);
	}

	create() {
		this.cameras.main.setBackgroundColor('#050914');
		this.drawBackground();
		this.drawLogo();
		this.drawCrew();
		this.createButtons();

		audioManager.playMusic(this, ASTRO_AUDIO.introMusic.cacheKey);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audioManager.stopMusic());

		const keyboard = this.input.keyboard!;
		this.enterKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
		this.helpKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.H);
		this.escapeKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
	}

	update() {
		if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
			this.open(ASTRO_SCENES.SHIP);
			return;
		}

		if (Phaser.Input.Keyboard.JustDown(this.helpKey)) {
			this.open(ASTRO_SCENES.HELP);
			return;
		}

		if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
			this.open(CORE_SCENES.LAUNCHER);
		}
	}

	private drawBackground() {
		const graphics = this.add.graphics();
		graphics.fillStyle(0x101431, 1);
		graphics.fillCircle(660, 60, 250);
		graphics.fillStyle(0x1a1442, 0.5);
		graphics.fillCircle(110, 560, 200);

		// El campo de estrellas se sortea una vez por entrada a la escena: no hay
		// nada que animar y así ninguna partida se ve igual a la anterior.
		graphics.fillStyle(0xffffff, 0.55);
		for (let i = 0; i < 90; i += 1) {
			const x = Phaser.Math.Between(0, 800);
			const y = Phaser.Math.Between(0, 600);
			graphics.fillRect(x, y, 1, Phaser.Math.Between(1, 2));
		}

		// La grilla del fondo es el guiño al tablero: está, pero no se juega ahí.
		graphics.lineStyle(1, 0x3a2f7a, 0.16);
		for (let x = 0; x <= 800; x += 50) {
			graphics.lineBetween(x, 0, x, 600);
		}
		for (let y = 0; y <= 600; y += 50) {
			graphics.lineBetween(0, y, 800, y);
		}
	}

	private drawLogo() {
		this.add.text(400, 132, 'ASTRO CHESS', {
			fontFamily: FONTS.display,
			fontSize: '62px',
			color: '#f5f7ff',
			letterSpacing: 8,
		}).setOrigin(0.5);

		this.add.text(400, 182, i18n.t('astro.title.tagline'), {
			fontFamily: FONTS.sans,
			fontSize: '13px',
			color: '#8f86c8',
			letterSpacing: 3,
		}).setOrigin(0.5);
	}

	/** La tripulación en fila, como piezas en su casilla de salida. */
	private drawCrew() {
		const graphics = this.add.graphics();

		PIECE_TYPES.forEach((type, index) => {
			const x = 400 + (index - (PIECE_TYPES.length - 1) / 2) * CREW_SPACING;
			graphics.fillStyle(index % 2 === 0 ? 0x2b3372 : 0x111632, 0.7);
			graphics.fillRect(x - 40, CREW_ROW_Y - 40, 80, 80);
			drawPiece(graphics, x, CREW_ROW_Y, PIECE_SIZE, type);
		});
	}

	private createButtons() {
		addButton(this, 400, 418, 320, 40, i18n.t('astro.title.play'), () => this.open(ASTRO_SCENES.SHIP));
		addButton(this, 400, 470, 320, 34, i18n.t('astro.title.help'), () => this.open(ASTRO_SCENES.HELP), 'secondary');
		addButton(
			this,
			400,
			516,
			320,
			34,
			i18n.t('astro.title.backToArcade'),
			() => this.open(CORE_SCENES.LAUNCHER),
			'secondary'
		);
	}

	private open(sceneKey: string) {
		audioManager.playSfx(this, ASTRO_AUDIO.confirm.cacheKey);
		this.scene.start(sceneKey);
	}
}
