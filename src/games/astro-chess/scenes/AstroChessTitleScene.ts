import Phaser from 'phaser';
import { audioManager } from '../../../core/audio/AudioManager';
import { i18n } from '../../../core/i18n/i18n';
import { CORE_SCENES } from '../../../core/sceneKeys';
import { ASTRO_AUDIO, loadAstroAudio } from '../audio';
import { aptitude, PIECES, PIECE_TYPES } from '../constants/pieces';
import { ROOM_IDS, ROOMS } from '../constants/rooms';
import { drawPiece } from '../objects/pieceRenderer';
import { ASTRO_SCENES } from '../sceneKeys';

/** Separación entre siluetas y altura de la fila de tripulación. */
const CREW_ROW_Y = 262;
const CREW_SPACING = 108;
const PIECE_SIZE = 64;
const PANEL = { y: 408, height: 124 };
const APTITUDE_ROW_Y = 458;
const APTITUDE_SPACING = 112;
const APTITUDE_COLORS = ['#ff647c', '#d9e2ff', '#5ee48a'];

/**
 * Pantalla de inicio de Astro Chess.
 *
 * Presenta la tripulación antes que la nave: los rasgos de las piezas son las
 * reglas del juego, así que conocerlas es la introducción real.
 */
export class AstroChessTitleScene extends Phaser.Scene {
	private selectedIndex = 0;
	private crewGraphics!: Phaser.GameObjects.Graphics;
	private nameLabels: Phaser.GameObjects.Text[] = [];
	private traitText!: Phaser.GameObjects.Text;
	private aptitudeTexts: Phaser.GameObjects.Text[] = [];

	private leftKey!: Phaser.Input.Keyboard.Key;
	private rightKey!: Phaser.Input.Keyboard.Key;
	private enterKey!: Phaser.Input.Keyboard.Key;
	private escapeKey!: Phaser.Input.Keyboard.Key;

	constructor() {
		super(ASTRO_SCENES.TITLE);
	}

	preload() {
		loadAstroAudio(this, ASTRO_AUDIO.introMusic, ASTRO_AUDIO.select, ASTRO_AUDIO.confirm);
	}

	create() {
		// Las escenas se reutilizan: la selección arranca siempre en el Rey.
		this.selectedIndex = 0;
		this.nameLabels = [];
		this.aptitudeTexts = [];

		this.cameras.main.setBackgroundColor('#050914');
		this.drawBackground();
		this.drawLogo();
		this.createCrewRow();
		this.createTraitPanel();
		this.createFooter();
		this.refreshSelection();

		audioManager.playMusic(this, ASTRO_AUDIO.introMusic.cacheKey);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audioManager.stopMusic());

		const keyboard = this.input.keyboard!;
		this.leftKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
		this.rightKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
		this.enterKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
		this.escapeKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
	}

	update() {
		if (Phaser.Input.Keyboard.JustDown(this.leftKey)) {
			this.moveSelection(-1);
			return;
		}

		if (Phaser.Input.Keyboard.JustDown(this.rightKey)) {
			this.moveSelection(1);
			return;
		}

		if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
			this.openShip();
			return;
		}

		if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
			this.goToLauncher();
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
		this.add.text(400, 84, 'ASTRO CHESS', {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: '62px',
			color: '#f5f7ff',
			letterSpacing: 8,
		}).setOrigin(0.5);

		this.add.text(400, 132, i18n.t('astro.title.tagline'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '13px',
			color: '#8f86c8',
			letterSpacing: 3,
		}).setOrigin(0.5);
	}

	private createCrewRow() {
		this.add.text(400, 190, i18n.t('astro.title.crew'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '12px',
			color: '#6d7da8',
			letterSpacing: 3,
		}).setOrigin(0.5);

		this.crewGraphics = this.add.graphics();

		PIECE_TYPES.forEach((type, index) => {
			const x = this.pieceX(index);

			// La zona sensible es un rectángulo aparte: la silueta se dibuja con
			// Graphics y un Graphics no recibe eventos por sí solo.
			const hitArea = this.add.rectangle(x, CREW_ROW_Y, 92, 108, 0x000000, 0)
				.setInteractive({ useHandCursor: true });
			hitArea.on('pointerover', () => this.select(index));
			hitArea.on('pointerdown', () => this.select(index));

			const label = this.add.text(x, CREW_ROW_Y + 62, i18n.t(PIECES[type].nameKey), {
				fontFamily: 'Courier New, monospace',
				fontSize: '12px',
				color: '#8290b3',
			}).setOrigin(0.5);
			this.nameLabels.push(label);
		});
	}

	/**
	 * El rasgo y, debajo, cuánto rinde la pieza en cada sala.
	 *
	 * La fila de aptitudes es lo que el jugador va a necesitar al repartir:
	 * verla acá, pieza por pieza, es aprender la tabla sin leer una tabla.
	 */
	private createTraitPanel() {
		this.add.rectangle(400, PANEL.y, 620, PANEL.height, 0x0d1130)
			.setStrokeStyle(1, 0x3d3a72);

		this.traitText = this.add.text(400, PANEL.y - 30, '', {
			fontFamily: 'Arial, sans-serif',
			fontSize: '14px',
			color: '#d9e2ff',
			align: 'center',
			lineSpacing: 5,
			wordWrap: { width: 580 },
		}).setOrigin(0.5);

		this.add.text(400, PANEL.y + 12, i18n.t('astro.title.aptitude'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '10px',
			color: '#6d7da8',
			letterSpacing: 2,
		}).setOrigin(0.5);

		ROOM_IDS.forEach((room, index) => {
			const x = 400 + (index - (ROOM_IDS.length - 1) / 2) * APTITUDE_SPACING;
			this.add.text(x - 6, APTITUDE_ROW_Y, i18n.t(ROOMS[room].nameKey), {
				fontFamily: 'Courier New, monospace',
				fontSize: '11px',
				color: '#8290b3',
			}).setOrigin(1, 0.5);
			this.aptitudeTexts.push(
				this.add.text(x, APTITUDE_ROW_Y, '', {
					fontFamily: 'Courier New, monospace',
					fontSize: '14px',
					fontStyle: 'bold',
				}).setOrigin(0, 0.5)
			);
		});
	}

	private createFooter() {
		this.add.text(400, 488, i18n.t('astro.title.hint'), {
			fontFamily: 'Courier New, monospace',
			fontSize: '13px',
			color: '#7384aa',
			letterSpacing: 2,
		}).setOrigin(0.5);

		const playButton = this.add.rectangle(400, 522, 300, 36, 0x231a4d)
			.setStrokeStyle(2, 0xc66cff)
			.setInteractive({ useHandCursor: true });
		this.add.text(400, 522, i18n.t('astro.title.play'), {
			fontFamily: 'Courier New, monospace',
			fontSize: '14px',
			color: '#ffffff',
		}).setOrigin(0.5);
		playButton.on('pointerdown', () => this.openShip());

		const backButton = this.add.rectangle(400, 564, 300, 30, 0x141130)
			.setStrokeStyle(1, 0x4a4488)
			.setInteractive({ useHandCursor: true });
		this.add.text(400, 564, i18n.t('astro.title.backToArcade'), {
			fontFamily: 'Courier New, monospace',
			fontSize: '12px',
			color: '#bfb6ff',
		}).setOrigin(0.5);
		backButton.on('pointerdown', () => this.goToLauncher());
	}

	private pieceX(index: number) {
		return 400 + (index - (PIECE_TYPES.length - 1) / 2) * CREW_SPACING;
	}

	private moveSelection(direction: -1 | 1) {
		const count = PIECE_TYPES.length;
		this.select((this.selectedIndex + direction + count) % count);
	}

	private select(index: number) {
		if (index === this.selectedIndex) return;

		this.selectedIndex = index;
		audioManager.playSfx(this, ASTRO_AUDIO.select.cacheKey);
		this.refreshSelection();
	}

	/**
	 * Redibuja la fila entera a partir de la selección.
	 *
	 * Es más simple que mantener seis objetos visuales sincronizados y sigue la
	 * misma idea que el resto del arcade: el estado manda y la pantalla se
	 * vuelve a dibujar desde cero.
	 */
	private refreshSelection() {
		this.crewGraphics.clear();

		PIECE_TYPES.forEach((type, index) => {
			const x = this.pieceX(index);
			const selected = index === this.selectedIndex;

			if (selected) {
				this.crewGraphics.fillStyle(PIECES[type].color, 0.12);
				this.crewGraphics.fillRect(x - 44, CREW_ROW_Y - 52, 88, 104);
				this.crewGraphics.lineStyle(1, PIECES[type].color, 0.7);
				this.crewGraphics.strokeRect(x - 44, CREW_ROW_Y - 52, 88, 104);
			}

			drawPiece(this.crewGraphics, x, CREW_ROW_Y - 6, PIECE_SIZE, type, selected ? 1 : 0.5);
			this.nameLabels[index].setColor(selected ? '#ffffff' : '#8290b3');
		});

		const type = PIECE_TYPES[this.selectedIndex];
		this.traitText.setText(i18n.t(PIECES[type].traitKey));
		ROOM_IDS.forEach((room, index) => {
			const value = aptitude(type, room);
			this.aptitudeTexts[index].setText(value === 0 ? '—' : `×${value}`).setColor(APTITUDE_COLORS[value]);
		});
	}

	private openShip() {
		audioManager.playSfx(this, ASTRO_AUDIO.confirm.cacheKey);
		this.scene.start(ASTRO_SCENES.SHIP);
	}

	private goToLauncher() {
		audioManager.playSfx(this, ASTRO_AUDIO.confirm.cacheKey);
		this.scene.start(CORE_SCENES.LAUNCHER);
	}
}
