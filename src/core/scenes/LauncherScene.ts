import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { CORE_AUDIO, loadCoreAudio } from '../audio/coreAudio';
import { GAME_CATALOG, type GameDefinition } from '../gameCatalog';
import { i18n, type Locale } from '../i18n/i18n';
import { CORE_SCENES } from '../sceneKeys';

/**
 * Primera escena que ve el jugador.
 *
 * Una Scene de Phaser agrupa objetos visuales, entrada de usuario y lógica de
 * una pantalla. Al iniciar otra escena con `scene.start`, Phaser apaga ésta y
 * crea/activa la elegida.
 */
export class LauncherScene extends Phaser.Scene {
	/** La selección permitirá navegar con teclado cuando haya más juegos. */
	private selectedGameIndex = 0;

	private leftKey!: Phaser.Input.Keyboard.Key;
	private rightKey!: Phaser.Input.Keyboard.Key;
	private enterKey!: Phaser.Input.Keyboard.Key;
	private gameCards: Phaser.GameObjects.Container[] = [];

	constructor() {
		super(CORE_SCENES.LAUNCHER);
	}

	preload() {
		loadCoreAudio(this);
	}

	/** `create` se ejecuta cada vez que entramos a esta escena. */
	create() {
		this.selectedGameIndex = 0;
		this.gameCards = [];

		this.drawBackground();
		this.drawHeader();
		this.createGameCards();
		this.drawFooter();
		this.configureKeyboard();
		this.refreshSelection();
		audioManager.playMusic(this, CORE_AUDIO.launcherMusic.cacheKey);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audioManager.stopMusic());
	}

	/** `update` corre una vez por frame y acá se consulta el teclado. */
	update() {
		if (Phaser.Input.Keyboard.JustDown(this.leftKey)) {
			this.moveSelection(-1);
		}

		if (Phaser.Input.Keyboard.JustDown(this.rightKey)) {
			this.moveSelection(1);
		}

		if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
			this.launchGame(GAME_CATALOG[this.selectedGameIndex]);
		}
	}

	private drawBackground() {
		// El canvas se repinta completo al cambiar de escena; no es HTML/CSS.
		this.cameras.main.setBackgroundColor('#080d1a');

		const graphics = this.add.graphics();
		graphics.fillStyle(0x101b36, 1);
		graphics.fillCircle(700, 40, 260);
		graphics.fillStyle(0x17234a, 0.55);
		graphics.fillCircle(90, 570, 210);

		// Una grilla tenue le da al launcher una identidad relacionada con Tetris.
		graphics.lineStyle(1, 0x29416f, 0.16);
		for (let x = 0; x <= 800; x += 40) {
			graphics.lineBetween(x, 0, x, 600);
		}
		for (let y = 0; y <= 600; y += 40) {
			graphics.lineBetween(0, y, 800, y);
		}
	}

	private drawHeader() {
		this.add.text(70, 58, 'ARCADE', {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: '52px',
			color: '#f5f7ff',
			letterSpacing: 8,
		});

		this.add.text(73, 120, i18n.t('launcher.collection'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '14px',
			color: '#7f91bd',
			letterSpacing: 3,
		});

		this.add.text(730, 76, `${GAME_CATALOG.length.toString().padStart(2, '0')}`, {
			fontFamily: 'Courier New, monospace',
			fontSize: '28px',
			color: '#46d9ff',
		}).setOrigin(1, 0);

		this.createLanguageSelector();
	}

	private createLanguageSelector() {
		this.add.text(592, 130, i18n.t('launcher.language'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '10px',
			color: '#6d7da8',
			letterSpacing: 2,
		}).setOrigin(1, 0.5);

		this.createLanguageButton(625, 130, 'ES', 'es');
		this.createLanguageButton(685, 130, 'EN', 'en');
	}

	private createLanguageButton(x: number, y: number, label: string, locale: Locale) {
		const selected = i18n.getLocale() === locale;
		const button = this.add.rectangle(x, y, 48, 28, selected ? 0x18365b : 0x111a31)
			.setStrokeStyle(1, selected ? 0x46d9ff : 0x40577f)
			.setInteractive({ useHandCursor: true });
		this.add.text(x, y, label, {
			fontFamily: 'Courier New, monospace',
			fontSize: '13px',
			color: selected ? '#ffffff' : '#8290b3',
		}).setOrigin(0.5);

		button.on('pointerdown', () => {
			if (i18n.setLocale(locale)) {
				// Los textos son objetos del canvas: reiniciar la escena los redibuja.
				this.scene.restart();
			}
		});
	}

	private createGameCards() {
		GAME_CATALOG.forEach((game, index) => {
			const card = this.createGameCard(game, index);
			this.gameCards.push(card);
		});
	}

	private createGameCard(game: GameDefinition, index: number) {
		const compactLayout = GAME_CATALOG.length > 2;
		const x = compactLayout ? 40 + index * 250 : 70 + index * 380;
		const y = 185;
		const card = this.add.container(x, y).setScale(compactLayout ? 0.68 : 1);

		const shadow = this.add.rectangle(8, 10, 330, 285, 0x000000, 0.35)
			.setOrigin(0);
		const surface = this.add.rectangle(0, 0, 330, 285, 0x111a31, 1)
			.setOrigin(0)
			.setStrokeStyle(2, 0x34486f);

		// La zona interactiva recibe eventos del mouse aunque sus hijos sean texto.
		surface.setInteractive({ useHandCursor: true });
		surface.on('pointerover', () => {
			this.selectedGameIndex = index;
			this.refreshSelection();
		});
		surface.on('pointerdown', () => this.launchGame(game));

		const cover = this.add.rectangle(18, 18, 294, 132, 0x09101f).setOrigin(0);
		const title = this.add.text(24, 170, i18n.t(game.titleKey), {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: '30px',
			color: '#ffffff',
		});
		const description = this.add.text(24, 215, i18n.t(game.descriptionKey), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '15px',
			color: '#9eacd0',
			wordWrap: { width: 280 },
		});
		const controls = this.add.text(24, 262, i18n.t(game.controlsKey), {
			fontFamily: 'Courier New, monospace',
			fontSize: '10px',
			color: '#64759f',
		});

		card.add([shadow, surface, cover, title, description, controls]);
		this.drawGameCover(card, game.coverType, game.accentColor);

		return card;
	}

	private drawGameCover(
		card: Phaser.GameObjects.Container,
		coverType: GameDefinition['coverType'],
		accentColor: number
	) {
		if (coverType === 'jukebox') {
			this.drawJukeboxCover(card, accentColor);
			return;
		}
		if (coverType === 'truco') {
			this.drawTrucoCover(card, accentColor);
			return;
		}

		this.drawTetrisCover(card, accentColor);
	}

	private drawTetrisCover(card: Phaser.GameObjects.Container, accentColor: number) {
		const colors = [accentColor, 0xffca4b, 0xc66cff, 0x5ee48a, 0xff647c];
		const blocks: Array<[number, number, number]> = [
			[42, 42, 0], [66, 42, 0], [90, 42, 0], [114, 42, 0],
			[174, 38, 1], [198, 38, 1], [174, 62, 1], [198, 62, 1],
			[120, 92, 2], [144, 92, 2], [168, 92, 2], [144, 68, 2],
			[234, 92, 3], [258, 92, 3], [258, 68, 3], [282, 68, 3],
		];

		for (const [x, y, colorIndex] of blocks) {
			const block = this.add.rectangle(x, y, 20, 20, colors[colorIndex])
				.setOrigin(0)
				.setStrokeStyle(1, 0xffffff, 0.25);
			card.add(block);
		}
	}

	private drawJukeboxCover(card: Phaser.GameObjects.Container, accentColor: number) {
		// El disco y el ecualizador identifican el laboratorio sin usar imágenes.
		card.add(this.add.circle(88, 84, 48, 0x090b13).setStrokeStyle(2, accentColor));
		card.add(this.add.circle(88, 84, 31, 0x171b2b).setStrokeStyle(1, 0x4d5570));
		card.add(this.add.circle(88, 84, 10, accentColor));
		card.add(this.add.circle(88, 84, 3, 0x080d1a));

		const barHeights = [24, 52, 36, 68, 44, 28];
		barHeights.forEach((height, index) => {
			card.add(
				this.add.rectangle(170 + index * 22, 112, 12, height, index % 2 ? accentColor : 0x7f8cff)
					.setOrigin(0.5, 1)
			);
		});
	}

	private drawTrucoCover(card: Phaser.GameObjects.Container, accentColor: number) {
		// La v1 usa cartas tipográficas: la portada anticipa la regla sin imágenes.
		for (const [x, y, label] of [[82, 48, '1'], [132, 68, '7'], [182, 48, '3']] as const) {
			card.add(this.add.rectangle(x, y, 54, 76, 0x3a2815).setStrokeStyle(2, accentColor));
			card.add(this.add.text(x, y, label, { fontFamily: 'Georgia, serif', fontSize: '28px', color: '#fff4d6' }).setOrigin(0.5));
		}
	}

	private drawFooter() {
		this.add.text(70, 510, i18n.t('launcher.chooseGame'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '13px',
			color: '#6d7da8',
			letterSpacing: 2,
		});
		this.add.text(70, 540, i18n.t('launcher.navigation'), {
			fontFamily: 'Courier New, monospace',
			fontSize: '16px',
			color: '#d9e2ff',
		});
	}

	private configureKeyboard() {
		const keyboard = this.input.keyboard!;
		this.leftKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
		this.rightKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
		this.enterKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
	}

	private moveSelection(direction: -1 | 1) {
		// El módulo permite que al pasar el último juego volvamos al primero.
		const gameCount = GAME_CATALOG.length;
		this.selectedGameIndex = (this.selectedGameIndex + direction + gameCount) % gameCount;
		this.refreshSelection();
	}

	private refreshSelection() {
		const baseScale = GAME_CATALOG.length > 2 ? 0.68 : 1;
		this.gameCards.forEach((card, index) => {
			const surface = card.list[1] as Phaser.GameObjects.Rectangle;
			const selected = index === this.selectedGameIndex;
			surface.setStrokeStyle(2, selected ? 0x46d9ff : 0x34486f);
			card.setScale(selected ? baseScale * 1.02 : baseScale);
		});
	}

	private launchGame(game: GameDefinition) {
		// `start` detiene el launcher y activa la escena asociada a la ficha.
		this.scene.start(game.entrySceneKey);
	}
}
