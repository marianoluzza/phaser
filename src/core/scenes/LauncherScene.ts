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
const CARD_WIDTH = 330;
const CARD_HEIGHT = 285;
const CAROUSEL_X = 400;
const CAROUSEL_Y = 315;
const DOTS_Y = 492;
const DOT_SPACING = 18;
const SLIDE_DURATION = 180;

/**
 * Ranuras del carrusel según la distancia a la ficha elegida. La última está
 * fuera de la pantalla: ahí esperan las fichas que no se ven y por ahí entran
 * las que dan la vuelta al otro extremo de la lista.
 *
 * Las laterales se apagan con un velo opaco y no con transparencia: una ficha
 * translúcida dejaría ver a la que tiene detrás.
 */
const CAROUSEL_SLOTS = [
	{ x: 0, scale: 1, dim: 0 },
	{ x: 255, scale: 0.62, dim: 0.5 },
	{ x: 395, scale: 0.45, dim: 0.75 },
	{ x: 560, scale: 0.35, dim: 0.75 },
];
const HIDDEN_SLOT = CAROUSEL_SLOTS.length - 1;

export class LauncherScene extends Phaser.Scene {
	/** Índice en `GAME_CATALOG` de la ficha que ocupa el centro del carrusel. */
	private selectedGameIndex = 0;

	private leftKey!: Phaser.Input.Keyboard.Key;
	private rightKey!: Phaser.Input.Keyboard.Key;
	private enterKey!: Phaser.Input.Keyboard.Key;
	private gameCards: Phaser.GameObjects.Container[] = [];
	private cardSurfaces: Phaser.GameObjects.Rectangle[] = [];
	private cardVeils: Phaser.GameObjects.Rectangle[] = [];
	/** Distancia de cada ficha al centro en el último dibujo; detecta las que dan la vuelta. */
	private cardOffsets: number[] = [];
	private pageDots: Phaser.GameObjects.Arc[] = [];
	private lastWheelAt = 0;

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
		this.cardSurfaces = [];
		this.cardVeils = [];
		this.cardOffsets = [];
		this.pageDots = [];
		this.lastWheelAt = 0;

		this.drawBackground();
		this.drawHeader();
		this.createGameCards();
		this.createPageDots();
		this.drawFooter();
		this.configureKeyboard();
		this.configureWheel();
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

	/**
	 * Distancia circular de una ficha a la elegida: negativa a la izquierda,
	 * positiva a la derecha. La lista no tiene extremos, así que siempre se
	 * toma el camino más corto alrededor del círculo.
	 */
	private getCircularOffset(index: number, from = this.selectedGameIndex) {
		const count = GAME_CATALOG.length;
		const offset = (index - from + count) % count;
		return offset > count / 2 ? offset - count : offset;
	}

	private getSlotTransform(offset: number) {
		const distance = Math.min(Math.abs(offset), HIDDEN_SLOT);
		const slot = CAROUSEL_SLOTS[distance];

		return {
			x: CAROUSEL_X + Math.sign(offset) * slot.x,
			y: CAROUSEL_Y,
			scale: slot.scale,
			dim: slot.dim,
			alpha: distance < HIDDEN_SLOT ? 1 : 0,
			depth: 10 - distance,
			visible: distance < HIDDEN_SLOT,
		};
	}

	private createGameCard(game: GameDefinition, index: number) {
		// El contenido se corre medio ancho y medio alto para que la ficha se
		// mueva y escale desde su centro, como pide el carrusel.
		const card = this.add.container(CAROUSEL_X, CAROUSEL_Y);
		const content = this.add.container(-CARD_WIDTH / 2, -CARD_HEIGHT / 2);
		card.add(content);

		const shadow = this.add.rectangle(8, 10, CARD_WIDTH, CARD_HEIGHT, 0x000000, 0.35)
			.setOrigin(0);
		const surface = this.add.rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT, 0x111a31, 1)
			.setOrigin(0)
			.setStrokeStyle(2, 0x34486f);
		this.cardSurfaces.push(surface);

		// La zona interactiva recibe eventos del mouse aunque sus hijos sean texto.
		// Una ficha lateral primero viene al centro; recién la del centro se juega.
		surface.setInteractive({ useHandCursor: true });
		surface.on('pointerdown', () => {
			if (index === this.selectedGameIndex) {
				this.launchGame(game);
			} else {
				this.selectGame(index);
			}
		});

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

		content.add([shadow, surface, cover, title, description, controls]);
		this.drawGameCover(content, game.coverType, game.accentColor);

		const veil = this.add.rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT, 0x080d1a, 0).setOrigin(0);
		content.add(veil);
		this.cardVeils.push(veil);

		return card;
	}

	/** Un punto por juego bajo el carrusel, con flechas a los costados. */
	private createPageDots() {
		const count = GAME_CATALOG.length;
		const rowWidth = (count - 1) * DOT_SPACING;
		const startX = CAROUSEL_X - rowWidth / 2;

		GAME_CATALOG.forEach((_game, index) => {
			const x = startX + index * DOT_SPACING;
			this.pageDots.push(this.add.circle(x, DOTS_Y, 4, 0x34486f));
			this.add.zone(x, DOTS_Y, DOT_SPACING, DOT_SPACING)
				.setInteractive({ useHandCursor: true })
				.on('pointerdown', () => this.selectGame(index));
		});

		this.createArrow(startX - 30, -1);
		this.createArrow(startX + rowWidth + 30, 1);
	}

	private createArrow(x: number, direction: -1 | 1) {
		const tip = 7 * direction;
		this.add.triangle(x, DOTS_Y, -tip / 2, -7, tip / 2, 0, -tip / 2, 7, 0x7f91bd)
			.setOrigin(0);
		this.add.zone(x, DOTS_Y, 28, 28)
			.setInteractive({ useHandCursor: true })
			.on('pointerdown', () => this.moveSelection(direction));
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
		if (coverType === 'pipes') {
			this.drawPipesCover(card, accentColor);
			return;
		}
		if (coverType === 'astro-chess') {
			this.drawAstroChessCover(card, accentColor);
			return;
		}
		if (coverType === 'tanks') {
			this.drawTanksCover(card, accentColor);
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

	private drawPipesCover(card: Phaser.GameObjects.Container, accentColor: number) {
		// Un recorrido corto de cañería anticipa la mecánica sin usar imágenes.
		const segments: Array<[number, number, number, number]> = [
			[38, 48, 108, 16],
			[130, 48, 16, 60],
			[130, 92, 120, 16],
			[234, 34, 16, 74],
		];

		for (const [x, y, width, height] of segments) {
			card.add(this.add.rectangle(x - 4, y - 4, width + 8, height + 8, 0x2a3f63).setOrigin(0));
			card.add(this.add.rectangle(x, y, width, height, accentColor).setOrigin(0));
		}
	}

	private drawAstroChessCover(card: Phaser.GameObjects.Container, accentColor: number) {
		// El plano de la nave con sus salas en damero: la portada tiene que decir
		// "nave" y "ajedrez" al mismo tiempo, sin mostrar un tablero.
		const graphics = this.add.graphics();
		card.add(graphics);

		const hull = [
			[36, 40], [246, 40], [288, 85], [246, 130], [36, 130], [60, 85],
		].map(([x, y]) => new Phaser.Math.Vector2(x, y));

		graphics.fillStyle(0x121a3c, 1);
		graphics.fillPoints(hull, true);
		graphics.lineStyle(2, accentColor, 0.75);
		graphics.strokePoints(hull, true);

		[78, 130, 182].forEach((x, index) => {
			graphics.fillStyle(index % 2 === 0 ? 0x232a5e : 0x0d1330, 1);
			graphics.fillRect(x, 63, 44, 44);
			graphics.lineStyle(1, accentColor, 0.3);
			graphics.strokeRect(x, 63, 44, 44);
		});

		// Dos tripulantes alcanzan para insinuar la asignación por puestos.
		graphics.fillStyle(accentColor, 1);
		graphics.fillTriangle(100, 71, 114, 97, 86, 97);
		graphics.fillStyle(0xffca4b, 1);
		graphics.fillCircle(204, 85, 11);
	}

	private drawTanksCover(card: Phaser.GameObjects.Container, accentColor: number) {
		// Un tanque frente a un muro de ladrillos y una bala en camino.
		const graphics = this.add.graphics();
		card.add(graphics);

		for (let row = 0; row < 3; row += 1) {
			for (let column = 0; column < 4; column += 1) {
				const x = 196 + column * 22 + (row % 2) * 11;
				graphics.fillStyle(0xb4582a, 1);
				graphics.fillRect(x, 50 + row * 22, 20, 20);
				graphics.fillStyle(0xd8794a, 1);
				graphics.fillRect(x, 50 + row * 22, 20, 3);
			}
		}

		graphics.fillStyle(0x8a6514, 1);
		graphics.fillRect(40, 54, 52, 16);
		graphics.fillRect(40, 100, 52, 16);
		graphics.fillStyle(accentColor, 1);
		graphics.fillRect(46, 66, 42, 38);
		graphics.fillStyle(0xffe49a, 1);
		graphics.fillCircle(67, 85, 12);
		graphics.fillRect(67, 81, 54, 8);

		graphics.fillStyle(0xfff1c2, 1);
		graphics.fillCircle(152, 85, 5);
	}

	private drawTrucoCover(card: Phaser.GameObjects.Container, accentColor: number) {
		// La v1 usa cartas tipográficas: la portada anticipa la regla sin imágenes.
		for (const [x, y, label] of [[82, 48, '1'], [132, 68, '7'], [182, 48, '3']] as const) {
			card.add(this.add.rectangle(x, y, 54, 76, 0x3a2815).setStrokeStyle(2, accentColor));
			card.add(this.add.text(x, y, label, { fontFamily: 'Georgia, serif', fontSize: '28px', color: '#fff4d6' }).setOrigin(0.5));
		}
	}

	private drawFooter() {
		// El pie va debajo del carrusel y de sus puntos.
		this.add.text(70, 522, i18n.t('launcher.chooseGame'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '13px',
			color: '#6d7da8',
			letterSpacing: 2,
		});
		this.add.text(70, 550, i18n.t('launcher.navigation'), {
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

	private configureWheel() {
		// Un trackpad dispara decenas de eventos por gesto: se toma uno por vez.
		this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _over: unknown, deltaX: number, deltaY: number) => {
			const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
			if (delta === 0 || this.time.now - this.lastWheelAt < SLIDE_DURATION) {
				return;
			}
			this.lastWheelAt = this.time.now;
			this.moveSelection(delta > 0 ? 1 : -1);
		});
	}

	private moveSelection(direction: -1 | 1) {
		// El módulo permite que al pasar el último juego volvamos al primero.
		const gameCount = GAME_CATALOG.length;
		this.selectGame((this.selectedGameIndex + direction + gameCount) % gameCount);
	}

	private selectGame(index: number) {
		if (index === this.selectedGameIndex) {
			return;
		}
		// Cuánto gira el carrusel, por el camino más corto.
		const shift = this.getCircularOffset(index);
		this.selectedGameIndex = index;
		this.refreshSelection(shift);
	}

	/**
	 * Lleva cada ficha a su ranura. Sin `shift` (el primer dibujo) se ubican de
	 * golpe; con `shift` se deslizan. Una ficha que da la vuelta al círculo
	 * cruzaría la pantalla de punta a punta, así que se la pone fuera de vista
	 * del lado donde termina y entra desde ahí.
	 */
	private refreshSelection(shift?: number) {
		this.gameCards.forEach((card, index) => {
			const veil = this.cardVeils[index];
			const offset = this.getCircularOffset(index);
			const previous = this.cardOffsets[index];
			const slot = this.getSlotTransform(offset);
			this.cardOffsets[index] = offset;

			card.setDepth(slot.depth);
			this.cardSurfaces[index].setStrokeStyle(2, offset === 0 ? 0x46d9ff : 0x34486f);
			this.tweens.killTweensOf([card, veil]);

			if (shift === undefined) {
				card.setPosition(slot.x, slot.y).setScale(slot.scale).setAlpha(slot.alpha).setVisible(slot.visible);
				veil.setFillStyle(0x080d1a, slot.dim);
				return;
			}

			if (previous - shift !== offset) {
				const entry = this.getSlotTransform(Math.sign(offset) * HIDDEN_SLOT);
				card.setPosition(entry.x, entry.y).setScale(entry.scale).setAlpha(0);
			}

			card.setVisible(true);
			this.tweens.add({
				targets: card,
				x: slot.x,
				scale: slot.scale,
				alpha: slot.alpha,
				duration: SLIDE_DURATION,
				ease: 'Cubic.Out',
				onComplete: () => card.setVisible(slot.visible),
			});
			this.tweens.add({
				targets: veil,
				fillAlpha: slot.dim,
				duration: SLIDE_DURATION,
				ease: 'Cubic.Out',
			});
		});

		this.pageDots.forEach((dot, index) => {
			const selected = index === this.selectedGameIndex;
			dot.setRadius(selected ? 5 : 4).setFillStyle(selected ? 0x46d9ff : 0x34486f);
		});
	}

	private launchGame(game: GameDefinition) {
		// `start` detiene el launcher y activa la escena asociada a la ficha.
		this.scene.start(game.entrySceneKey);
	}
}
