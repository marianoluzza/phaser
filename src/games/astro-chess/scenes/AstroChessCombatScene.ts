import Phaser from 'phaser';
import { audioManager } from '../../../core/audio/AudioManager';
import { i18n, type TranslationKey } from '../../../core/i18n/i18n';
import { ASTRO_AUDIO, loadAstroAudio } from '../audio';
import { RAIDER, type EnemyIntent } from '../constants/enemies';
import { PIECES } from '../constants/pieces';
import { ROOMS } from '../constants/rooms';
import { CrewBoard, type RoomAlert } from '../objects/CrewBoard';
import { type PlanTransform } from '../objects/shipRenderer';
import { fill, formatEntry } from '../objects/text';
import { addButton, floatText, FONTS, type Button } from '../objects/ui';
import { ASTRO_SCENES } from '../sceneKeys';
import { Combat, type LogEntry, type RoundForecast } from '../state/Combat';
import { Crew } from '../state/Crew';
import { Ship, type ShipLayout } from '../state/Ship';
import { Rng } from '../state/rng';

/**
 * Distribución de la pantalla.
 *
 * La nave ocupa la columna izquierda, que es donde se juega; el enemigo, el
 * pronóstico y la bitácora van a la derecha, que es donde se lee. Antes el
 * plano entraba al 62 % con letra de nueve píxeles y debajo sobraba espacio.
 */
const PLAN: PlanTransform = { x: -16, y: 24, scale: 0.75 };
const RESERVE = { x: 52, y: 404, spacing: 58, size: 32 };
const SHIP_CENTER = { x: 250, y: 236 };

const PLAYER_BARS = { x: 92, hullY: 46, shieldY: 70, width: 208, valueX: 308 };
const ENEMY_BARS = { x: 576, hullY: 54, shieldY: 76, width: 136, valueX: 720 };
const ENEMY_CENTER = { x: 645, y: 84 };
const MOVES = { x: 372, labelY: 24, tokenY: 50, spacing: 22 };
const PIP = { width: 18, height: 10, gap: 4 };
const COLUMN = { x: 518, width: 256 };
const FORECAST = { top: 168, bottom: 312 };
const LOG = { top: 320, bottom: 506 };
/** Ventana visible de la bitácora; lo que no entra se recorre con scroll. */
const LOG_VIEW = { top: LOG.top + 24, height: LOG.bottom - LOG.top - 26, textWidth: 246, barX: 776 };

/** Cuánto dura cada línea de la bitácora cuando se cuenta la ronda. */
const STEP_MS = 480;

/** Colores de la intención enemiga: el jugador la lee antes que el texto. */
const INTENT_COLORS: Record<EnemyIntent, string> = {
	fire: '#ff647c',
	charge: '#ffca4b',
	shield: '#46d9ff',
	board: '#ff8a3d',
};

const COLORS = {
	shield: 0x46d9ff,
	loss: 0xff647c,
	enemyHull: 0xc66cff,
	track: 0x1a1f45,
	border: 0x3d3a72,
	token: 0xffca4b,
};

type CombatData = { crew?: Crew; ship?: Ship; layout?: ShipLayout };

/** Lo que muestran las barras: el estado real, o el de un paso de la ronda que se está contando. */
type Shown = {
	playerHull: number;
	playerShield: number;
	shieldCapacity: number;
	enemyHull: number;
	enemyShield: number;
};

type ForecastLine = { text: string; color: string };

/**
 * Combate por rondas contra otra nave.
 *
 * La pantalla no decide nada: `Combat` resuelve la ronda y esto la muestra. La
 * única decisión del jugador es dónde está cada tripulante, así que la pantalla
 * se dedica a que se vea qué cambia cada decisión antes de tomarla: qué sala
 * amenaza el enemigo, cuánto va a pegar cada uno y cuántas piezas quedan por
 * mover.
 */
export class AstroChessCombatScene extends Phaser.Scene {
	private crew!: Crew;
	private ship!: Ship;
	private layout: ShipLayout = [];
	private combat!: Combat;
	private board!: CrewBoard;
	private forecast: RoundForecast | null = null;
	private shown!: Shown;

	private hud!: Phaser.GameObjects.Graphics;
	/** Lo que el pronóstico dice que se pierde, en rojo y latiendo sobre las barras. */
	private lossGraphics!: Phaser.GameObjects.Graphics;
	private playerHullText!: Phaser.GameObjects.Text;
	private playerShieldText!: Phaser.GameObjects.Text;
	private playerStats!: Phaser.GameObjects.Text;
	private noBridgeLabel!: Phaser.GameObjects.Text;
	private enemyHullText!: Phaser.GameObjects.Text;
	private enemyShieldText!: Phaser.GameObjects.Text;
	private intentLabel!: Phaser.GameObjects.Text;
	private intentDetail!: Phaser.GameObjects.Text;
	private forecastLayer!: Phaser.GameObjects.Container;
	private logLayer!: Phaser.GameObjects.Container;
	private logScrollbar!: Phaser.GameObjects.Graphics;
	/** Cuánto se bajó en la bitácora, en píxeles desde la ronda más nueva. */
	private logScroll = 0;
	private logContentHeight = 0;
	private logDrag: { y: number; scroll: number } | null = null;
	private toast!: Phaser.GameObjects.Text;
	private resolveButton!: Button;
	private overlay: Phaser.GameObjects.Container | null = null;

	/** Mientras se cuenta la ronda, cuántas líneas de la bitácora ya se mostraron. */
	private playing = false;
	private revealed = 0;
	private timers: Phaser.Time.TimerEvent[] = [];

	private enterKey!: Phaser.Input.Keyboard.Key;
	private escapeKey!: Phaser.Input.Keyboard.Key;

	constructor() {
		super(ASTRO_SCENES.COMBAT);
	}

	/**
	 * La tripulación llega repartida desde la pantalla de puestos.
	 *
	 * Si alguien abre el combate directamente —recargando la página, por
	 * ejemplo— se arma una tripulación nueva: la escena nunca depende de que
	 * otra haya corrido antes.
	 */
	init(data: CombatData) {
		this.crew = data.crew ?? Crew.starting();
		this.ship = data.ship ?? new Ship();
		this.layout = data.layout ?? this.ship.layout();
		this.overlay = null;
		this.playing = false;
		this.timers = [];
		this.logScroll = 0;
		this.logDrag = null;
	}

	preload() {
		loadAstroAudio(
			this,
			ASTRO_AUDIO.introMusic,
			ASTRO_AUDIO.select,
			ASTRO_AUDIO.confirm,
			ASTRO_AUDIO.blocked,
			ASTRO_AUDIO.fire,
			ASTRO_AUDIO.hit
		);
	}

	create() {
		this.combat = new Combat(this.crew, this.ship, RAIDER, new Rng());

		this.cameras.main.setBackgroundColor('#050914');
		this.drawFrames();
		this.hud = this.add.graphics();
		this.lossGraphics = this.add.graphics();
		this.tweens.add({
			targets: this.lossGraphics,
			alpha: { from: 1, to: 0.25 },
			duration: 550,
			yoyo: true,
			repeat: -1,
		});

		this.board = new CrewBoard(this, {
			crew: this.crew,
			ship: this.ship,
			transform: PLAN,
			reserve: RESERVE,
			onChange: () => this.refreshPanels(),
			canMove: (memberId) => this.combat.canMove(memberId),
			onMove: (memberId) => this.combat.registerMove(memberId),
			onBlocked: (memberId) => this.explainBlock(memberId),
			sounds: {
				select: () => audioManager.playSfx(this, ASTRO_AUDIO.select.cacheKey),
				confirm: () => audioManager.playSfx(this, ASTRO_AUDIO.confirm.cacheKey),
				blocked: () => audioManager.playSfx(this, ASTRO_AUDIO.blocked.cacheKey),
			},
		});
		this.createPlayerPanel();
		this.createEnemyPanel();
		this.createForecastPanel();
		this.createLogPanel();
		this.createControls();
		this.refreshPanels();

		audioManager.playMusic(this, ASTRO_AUDIO.introMusic.cacheKey);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audioManager.stopMusic());

		const keyboard = this.input.keyboard!;
		this.enterKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
		this.escapeKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
	}

	update() {
		if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
			if (this.overlay) this.restart();
			else this.resolveRound();
			return;
		}

		if (Phaser.Input.Keyboard.JustDown(this.escapeKey) && !this.board.cancelSelection()) {
			this.leave();
		}
	}

	private drawFrames() {
		const graphics = this.add.graphics();
		graphics.fillStyle(0x14102e, 1);
		graphics.fillCircle(700, 80, 170);

		const frame = (x: number, y: number, width: number, height: number, fillColor: number) => {
			graphics.fillStyle(fillColor, 0.94);
			graphics.fillRect(x, y, width, height);
			graphics.lineStyle(1, COLORS.border, 1);
			graphics.strokeRect(x, y, width, height);
		};

		frame(16, 10, 474, 108, 0x0a0e26);
		frame(506, 10, 278, 150, 0x0d1130);
		frame(506, FORECAST.top, 278, FORECAST.bottom - FORECAST.top, 0x0a0e26);
		frame(506, LOG.top, 278, LOG.bottom - LOG.top, 0x0a0e26);
	}

	private label(x: number, y: number, text: string) {
		return this.add.text(x, y, text, {
			fontFamily: FONTS.sans,
			fontSize: '10px',
			color: '#6d7da8',
			letterSpacing: 2,
		});
	}

	private mono(x: number, y: number, size: number, color = '#d9e2ff') {
		return this.add.text(x, y, '', { fontFamily: FONTS.mono, fontSize: `${size}px`, color }).setOrigin(0, 0.5);
	}

	private createPlayerPanel() {
		this.label(28, 16, i18n.t('astro.combat.you'));
		this.mono(28, PLAYER_BARS.hullY, 11, '#9eacd0').setText(i18n.t('astro.combat.hull'));
		this.mono(28, PLAYER_BARS.shieldY, 11, '#9eacd0').setText(i18n.t('astro.combat.shield'));
		this.playerHullText = this.mono(PLAYER_BARS.valueX, PLAYER_BARS.hullY, 13);
		this.playerShieldText = this.mono(PLAYER_BARS.valueX, PLAYER_BARS.shieldY, 13);
		this.playerStats = this.mono(28, 96, 12);

		this.label(MOVES.x, MOVES.labelY - 8, i18n.t('astro.combat.moves'));
		this.noBridgeLabel = this.add.text(MOVES.x, 66, i18n.t('astro.combat.noBridge'), {
			fontFamily: FONTS.sans,
			fontSize: '11px',
			color: '#ffca4b',
			wordWrap: { width: 112 },
		});

		this.label(24, RESERVE.y - 42, i18n.t('astro.combat.reserve'));

		this.toast = this.add.text(24, 462, '', {
			fontFamily: FONTS.sans,
			fontSize: '12px',
			color: '#ffca4b',
			wordWrap: { width: 460 },
		});
	}

	private createEnemyPanel() {
		this.add.text(ENEMY_CENTER.x, 28, i18n.t(RAIDER.nameKey), {
			fontFamily: FONTS.display,
			fontSize: '18px',
			color: '#ffffff',
			letterSpacing: 2,
		}).setOrigin(0.5);

		this.mono(520, ENEMY_BARS.hullY, 11, '#9eacd0').setText(i18n.t('astro.combat.hull'));
		this.mono(520, ENEMY_BARS.shieldY, 11, '#9eacd0').setText(i18n.t('astro.combat.shield'));
		this.enemyHullText = this.mono(ENEMY_BARS.valueX, ENEMY_BARS.hullY, 13);
		this.enemyShieldText = this.mono(ENEMY_BARS.valueX, ENEMY_BARS.shieldY, 13);

		this.add.text(ENEMY_CENTER.x, 98, i18n.t('astro.combat.intent'), {
			fontFamily: FONTS.sans,
			fontSize: '10px',
			color: '#6d7da8',
			letterSpacing: 2,
		}).setOrigin(0.5);

		this.intentLabel = this.add.text(ENEMY_CENTER.x, 116, '', {
			fontFamily: FONTS.display,
			fontSize: '17px',
			color: '#ffffff',
		}).setOrigin(0.5);

		this.intentDetail = this.add.text(ENEMY_CENTER.x, 140, '', {
			fontFamily: FONTS.sans,
			fontSize: '10px',
			color: '#9eacd0',
			align: 'center',
			wordWrap: { width: 260 },
		}).setOrigin(0.5);
	}

	private createForecastPanel() {
		this.label(COLUMN.x, FORECAST.top + 8, i18n.t('astro.combat.forecast'));
		this.forecastLayer = this.add.container(0, 0);
	}

	private createLogPanel() {
		this.label(COLUMN.x, LOG.top + 8, i18n.t('astro.combat.log'));
		this.logLayer = this.add.container(0, 0);
		this.logScrollbar = this.add.graphics();

		this.bindLogScroll();
	}

	/**
	 * Rueda, arrastre o RePág/AvPág.
	 *
	 * El arrastre es para pantallas táctiles, donde no hay rueda. La bitácora no
	 * toca el plano de la nave, así que no compite con el reparto de piezas.
	 */
	private bindLogScroll() {
		const inLog = (pointer: Phaser.Input.Pointer) =>
			pointer.worldX >= 506 && pointer.worldX <= 784 && pointer.worldY >= LOG_VIEW.top && pointer.worldY <= LOG.bottom;

		this.input.on(
			'wheel',
			(pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
				if (inLog(pointer) && !this.overlay) this.scrollLog(this.logScroll + dy * 0.5);
			}
		);
		this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
			if (inLog(pointer) && !this.overlay) this.logDrag = { y: pointer.worldY, scroll: this.logScroll };
		});
		this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
			if (this.logDrag && pointer.isDown) this.scrollLog(this.logDrag.scroll - (pointer.worldY - this.logDrag.y));
		});
		this.input.on('pointerup', () => {
			this.logDrag = null;
		});

		const page = LOG_VIEW.height * 0.8;
		this.input.keyboard?.on('keydown-PAGE_DOWN', () => this.scrollLog(this.logScroll + page));
		this.input.keyboard?.on('keydown-PAGE_UP', () => this.scrollLog(this.logScroll - page));
	}

	private scrollLog(to: number) {
		const max = Math.max(0, this.logContentHeight - LOG_VIEW.height);
		this.logScroll = Phaser.Math.Clamp(to, 0, max);
		this.logLayer.y = -this.logScroll;
		this.clipLog();
		this.drawLogScrollbar();
	}

	/**
	 * Recorta cada línea a la ventana de la bitácora.
	 *
	 * Con una máscara de Phaser sobre el contenedor las líneas se seguían
	 * viendo fuera del panel. El recorte por línea es exacto al píxel y no
	 * depende del renderer: una línea a medio salir se ve a medias.
	 */
	private clipLog() {
		const bottom = LOG_VIEW.top + LOG_VIEW.height;

		for (const child of this.logLayer.list) {
			const text = child as Phaser.GameObjects.Text;
			const top = text.y + this.logLayer.y;
			const from = Math.max(0, LOG_VIEW.top - top);
			const to = Math.min(text.height, bottom - top);

			// El recorte se mide en píxeles de la textura, que tiene `resolution`
			// veces el tamaño del texto en pantalla (ver core/renderScale.ts).
			const r = text.style.resolution;
			text.setVisible(to > from);
			if (to > from) text.setCrop(0, from * r, text.width * r, (to - from) * r);
		}
	}

	/** Sólo aparece cuando hay más bitácora de la que entra. */
	private drawLogScrollbar() {
		const g = this.logScrollbar;
		g.clear();
		if (this.logContentHeight <= LOG_VIEW.height) return;

		const thumb = Math.max(18, (LOG_VIEW.height * LOG_VIEW.height) / this.logContentHeight);
		const max = this.logContentHeight - LOG_VIEW.height;
		const y = LOG_VIEW.top + (this.logScroll / max) * (LOG_VIEW.height - thumb);

		g.fillStyle(0x1a1f45, 1);
		g.fillRect(LOG_VIEW.barX, LOG_VIEW.top, 4, LOG_VIEW.height);
		g.fillStyle(0x8f86c8, 1);
		g.fillRect(LOG_VIEW.barX, y, 4, thumb);
	}

	private createControls() {
		this.resolveButton = addButton(this, ENEMY_CENTER.x, 534, 278, 40, '', () => this.resolveRound());

		this.add.text(16, 580, i18n.t('astro.combat.hint'), {
			fontFamily: FONTS.mono,
			fontSize: '11px',
			color: '#7384aa',
		}).setOrigin(0, 0.5);

		addButton(this, 709, 580, 150, 28, i18n.t('astro.combat.leave'), () => this.leave(), 'secondary');
	}

	/** Redibuja todo desde el estado real. Durante la cuenta de una ronda, manda la cuenta. */
	private refreshPanels() {
		if (this.playing) return;

		this.shown = this.realShown();
		this.forecast = this.combat.outcome === 'ongoing' ? this.combat.forecast() : null;

		this.drawHud();
		this.updateIntent();
		this.renderForecast();
		this.renderLog();
		this.board.setAlert(this.alert());
		this.resolveButton.label.setText(fill('astro.combat.resolve', { round: this.combat.round }));
	}

	private realShown(): Shown {
		return {
			playerHull: this.ship.hull,
			playerShield: this.combat.playerShield,
			shieldCapacity: this.combat.shieldCapacity,
			enemyHull: this.combat.enemyHull,
			enemyShield: this.combat.enemyShield,
		};
	}

	private drawHud() {
		const { combat, ship, shown } = this;
		const forecast = this.playing ? null : this.forecast;
		this.hud.clear();
		this.lossGraphics.clear();

		const hullRatio = shown.playerHull / ship.maxHull;
		const hullColor = hullRatio > 0.5 ? 0x5ee48a : hullRatio > 0.25 ? 0xffca4b : 0xff647c;
		this.drawBar(PLAYER_BARS, shown.playerHull, ship.maxHull, forecast?.playerHull, hullColor);
		this.drawPips(PLAYER_BARS, shown.playerShield, shown.shieldCapacity, forecast?.playerShield);
		this.drawBar(ENEMY_BARS, shown.enemyHull, combat.enemy.hull, forecast?.enemyHull, COLORS.enemyHull);
		this.drawPips(ENEMY_BARS, shown.enemyShield, combat.enemy.shieldCapacity, forecast?.enemyShield);

		this.playerHullText.setText(`${shown.playerHull}/${ship.maxHull}`);
		this.playerShieldText.setText(`${shown.playerShield}/${shown.shieldCapacity}`);
		this.enemyHullText.setText(`${shown.enemyHull}/${combat.enemy.hull}`);
		this.enemyShieldText.setText(`${shown.enemyShield}/${combat.enemy.shieldCapacity}`);
		this.playerStats.setText(
			`${i18n.t('astro.combat.damage')} ${combat.damage}    ${i18n.t('astro.combat.evasion')} ${combat.evasion} %`
		);

		this.drawMoveTokens();
	}

	private drawBar(
		at: { x: number; hullY: number; width: number },
		value: number,
		max: number,
		after: number | undefined,
		color: number
	) {
		const height = 12;
		const top = at.hullY - height / 2;
		const filled = (at.width * value) / max;

		this.hud.fillStyle(COLORS.track, 1);
		this.hud.fillRect(at.x, top, at.width, height);
		this.hud.fillStyle(color, 1);
		this.hud.fillRect(at.x, top, filled, height);
		this.hud.lineStyle(1, COLORS.border, 1);
		this.hud.strokeRect(at.x, top, at.width, height);

		if (after !== undefined && after < value) {
			const kept = (at.width * after) / max;
			this.lossGraphics.fillStyle(COLORS.loss, 1);
			this.lossGraphics.fillRect(at.x + kept, top, filled - kept, height);
		}
	}

	/** El escudo va en puntos y no en barra: se recarga entero y se cuenta de a uno. */
	private drawPips(at: { x: number; shieldY: number }, value: number, capacity: number, after?: number) {
		const top = at.shieldY - PIP.height / 2;

		for (let index = 0; index < capacity; index += 1) {
			const x = at.x + index * (PIP.width + PIP.gap);
			if (index < value) {
				this.hud.fillStyle(COLORS.shield, 1);
				this.hud.fillRect(x, top, PIP.width, PIP.height);
			} else {
				this.hud.lineStyle(1, COLORS.shield, 0.45);
				this.hud.strokeRect(x, top, PIP.width, PIP.height);
			}

			if (after !== undefined && index >= after && index < value) {
				this.lossGraphics.fillStyle(COLORS.loss, 1);
				this.lossGraphics.fillRect(x, top, PIP.width, PIP.height);
			}
		}
	}

	/**
	 * Los movimientos como fichas que se gastan.
	 *
	 * Son el recurso que el puente produce y lo único que limita reaccionar al
	 * anuncio enemigo; como texto gris en una esquina no se notaban.
	 */
	private drawMoveTokens() {
		const { movesPerRound, movesLeft } = this.combat;
		this.noBridgeLabel.setVisible(movesPerRound === 0);

		for (let index = 0; index < movesPerRound; index += 1) {
			const x = MOVES.x + 8 + index * MOVES.spacing;
			if (index < movesLeft) {
				this.hud.fillStyle(COLORS.token, 1);
				this.hud.fillCircle(x, MOVES.tokenY, 8);
			} else {
				this.hud.lineStyle(2, COLORS.token, 0.4);
				this.hud.strokeCircle(x, MOVES.tokenY, 7);
			}
		}
	}

	private updateIntent() {
		const { combat } = this;
		// La sala apuntada es la mitad importante del anuncio: es contra qué hay
		// que decidir si se evacúa o se aguanta.
		const target = combat.target ? ` → ${i18n.t(ROOMS[combat.target].nameKey)}` : '';
		this.intentLabel
			.setText(`${i18n.t(`astro.intent.${combat.intent}` as const)}${target}`)
			.setColor(INTENT_COLORS[combat.intent]);
		this.intentDetail.setText(i18n.t(`astro.intent.${combat.intent}.detail` as const));
	}

	/**
	 * La amenaza, marcada sobre el plano.
	 *
	 * Un abordaje marca la sala a la que van. Un disparo que el escudo no
	 * alcanza a parar, o una carga que el escudo no va a aguantar, marcan los
	 * escudos: la respuesta está ahí, no en el texto del enemigo.
	 */
	private alert(): RoomAlert | null {
		const { combat, forecast } = this;
		if (!forecast) return null;

		if (combat.intent === 'board' && combat.target) {
			return { room: combat.target, color: 0xff8a3d, label: i18n.t('astro.intent.board') };
		}

		const shot = forecast.entries.find((entry) => entry.key === 'astro.log.enemyFires');
		if (shot && (shot.values?.hull ?? 0) > 0) {
			return { room: 'shields', color: 0xff647c, label: i18n.t('astro.alert.shieldShort') };
		}

		const charge = forecast.entries.find((entry) => entry.key === 'astro.log.enemyCharges');
		const next = charge?.values?.next ?? 0;
		if (charge && next > combat.shieldCapacity) {
			return { room: 'shields', color: 0xffca4b, label: fill('astro.alert.charge', { next }) };
		}

		return null;
	}

	private renderForecast() {
		this.forecastLayer.removeAll(true);
		if (!this.forecast) return;

		let y = FORECAST.top + 26;
		for (const line of this.forecastLines(this.forecast)) {
			const text = this.add.text(COLUMN.x, y, line.text, {
				fontFamily: FONTS.sans,
				fontSize: '12px',
				color: line.color,
				wordWrap: { width: COLUMN.width },
			});
			this.forecastLayer.add(text);
			y += text.height + 4;
		}
	}

	/**
	 * La ronda simulada, contada en frases cortas.
	 *
	 * Sale de jugar la ronda sobre una copia: el jugador mueve una pieza y ve en
	 * el acto qué cambia, sin hacer la cuenta de escudo contra daño de cabeza.
	 */
	private forecastLines(forecast: RoundForecast): ForecastLine[] {
		const { combat } = this;
		const lines: ForecastLine[] = [
			{
				text: i18n.t(combat.playerFirst ? 'astro.forecast.first.player' : 'astro.forecast.first.enemy'),
				color: '#8f86c8',
			},
		];
		const entries = forecast.entries;

		entries.forEach((entry, index) => {
			const values = entry.values ?? {};

			switch (entry.key) {
				case 'astro.log.playerFires':
					lines.push({ text: formatEntry(entry, 'astro.forecast.youFire'), color: '#46d9ff' });
					break;
				case 'astro.log.noWeapons':
					lines.push({ text: i18n.t('astro.forecast.noWeapons'), color: '#ffca4b' });
					break;
				case 'astro.log.enemyFires':
					lines.push({
						text: formatEntry(entry, 'astro.forecast.enemyFire'),
						color: values.hull > 0 ? '#ff647c' : '#9eacd0',
					});
					break;
				case 'astro.log.enemyCharges':
					lines.push({
						text: formatEntry(entry, 'astro.forecast.enemyCharge'),
						color: values.next > values.shield ? '#ffca4b' : '#9eacd0',
					});
					break;
				case 'astro.log.enemyShields':
					lines.push({ text: formatEntry(entry, 'astro.forecast.enemyShield'), color: '#9eacd0' });
					break;
				case 'astro.log.boarding': {
					const wounded = entries
						.slice(index + 1)
						.filter((next) => next.key === 'astro.log.wounded' && next.piece)
						.map((next) => i18n.t(next.piece!));
					lines.push({
						text: fill('astro.forecast.boarding', {
							room: entry.room ? i18n.t(ROOMS[entry.room].nameKey) : '',
							pieces: wounded.join(', '),
						}),
						color: '#ff8a3d',
					});
					break;
				}
				case 'astro.log.boardingMissed':
					lines.push({ text: formatEntry(entry, 'astro.forecast.boardingMissed'), color: '#5ee48a' });
					break;
				case 'astro.log.boardingEmpty':
					lines.push({ text: formatEntry(entry, 'astro.forecast.boardingEmpty'), color: '#ff647c' });
					break;
				case 'astro.log.victory':
					lines.push({ text: i18n.t('astro.forecast.win'), color: '#5ee48a' });
					break;
				case 'astro.log.defeat':
					lines.push({ text: i18n.t('astro.forecast.lose'), color: '#ff647c' });
					break;
			}
		});

		lines.push({
			text: fill('astro.forecast.odds', {
				player: combat.evasion,
				enemy: Math.round(combat.enemy.evasion * 100),
			}),
			color: '#6d7da8',
		});

		return lines;
	}

	/**
	 * La bitácora entera, la ronda más nueva arriba.
	 *
	 * Antes cada ronda borraba la anterior y no había forma de mirar qué venía
	 * pasando. Las rondas viejas quedan en gris, más abajo, a un scroll de
	 * distancia.
	 */
	private renderLog() {
		this.logLayer.removeAll(true);

		const rounds = [...this.combat.history].reverse();
		const top = LOG_VIEW.top + 2;
		let y = top;

		rounds.forEach((entries, age) => {
			const visible = age === 0 && this.playing ? entries.slice(0, this.revealed) : entries;
			const color = age === 0 ? '#d9e2ff' : '#59628a';

			visible.forEach((entry, index) => {
				const text = this.add.text(COLUMN.x, y, formatEntry(entry), {
					fontFamily: FONTS.mono,
					fontSize: '11px',
					color: index === 0 ? (age === 0 ? '#8f86c8' : '#454c70') : color,
					wordWrap: { width: LOG_VIEW.textWidth },
				});
				this.logLayer.add(text);
				y += text.height + 4;
			});
			y += 6;
		});

		this.logContentHeight = y - top;
		this.scrollLog(this.logScroll);
	}

	/** Explica por qué no se pudo mover a alguien, con lo que habría que cambiar. */
	private explainBlock(memberId: string) {
		const member = this.crew.byId(memberId);
		const block = this.combat.moveBlock(memberId);
		if (!member || !block) return;

		const text =
			block === 'moved'
				? fill('astro.combat.blocked.moved', { piece: i18n.t(PIECES[member.type].nameKey) })
				: block === 'noMoves'
					? fill('astro.combat.blocked.noMoves', { moves: this.combat.movesPerRound })
					: i18n.t('astro.combat.blocked.noBridge');

		this.tweens.killTweensOf(this.toast);
		this.toast.setText(text).setAlpha(1);
		this.tweens.add({ targets: this.toast, alpha: 0, delay: 2200, duration: 500 });
	}

	/**
	 * Resuelve la ronda y la cuenta de a una línea.
	 *
	 * El estado se resuelve entero en el acto; lo que se demora es mostrarlo.
	 * Las barras parten de cómo estaban y cada paso aplica lo que dice su línea
	 * de bitácora, así el jugador ve qué golpe hizo qué. Enter o el botón la
	 * saltean.
	 */
	private resolveRound() {
		if (this.playing) {
			this.finishPlayback();
			return;
		}
		if (this.combat.outcome !== 'ongoing') return;

		const before = this.realShown();
		this.board.clearSelection();
		this.combat.resolveRound();
		audioManager.playSfx(this, ASTRO_AUDIO.confirm.cacheKey);

		this.playing = true;
		this.revealed = 1;
		this.logScroll = 0;
		this.shown = before;
		this.board.setEnabled(false);
		this.board.setAlert(null);
		this.forecastLayer.removeAll(true);
		this.toast.setAlpha(0);
		this.resolveButton.label.setText(i18n.t('astro.combat.skip'));
		this.drawHud();
		this.renderLog();

		const entries = this.combat.log;
		for (let index = 1; index < entries.length; index += 1) {
			this.timers.push(this.time.delayedCall(index * STEP_MS, () => this.playStep(entries[index])));
		}
		this.timers.push(this.time.delayedCall(entries.length * STEP_MS + 250, () => this.finishPlayback()));
	}

	private playStep(entry: LogEntry) {
		const values = entry.values ?? {};
		const shown = this.shown;
		const weapons = this.board.roomCenter('weapons');
		const enemyHull = { x: ENEMY_BARS.x + ENEMY_BARS.width / 2, y: ENEMY_BARS.hullY };
		const enemyShield = { x: ENEMY_BARS.x + 40, y: ENEMY_BARS.shieldY };
		const playerHull = { x: PLAYER_BARS.x + PLAYER_BARS.width / 2, y: PLAYER_BARS.hullY };
		const playerShield = { x: PLAYER_BARS.x + 40, y: PLAYER_BARS.shieldY };
		const roomCenter = entry.room ? this.board.roomCenter(entry.room) : SHIP_CENTER;

		this.revealed += 1;

		switch (entry.key) {
			case 'astro.log.playerFires':
				this.tracer(weapons, ENEMY_CENTER, COLORS.shield);
				audioManager.playSfx(this, ASTRO_AUDIO.fire.cacheKey);
				shown.enemyShield -= values.absorbed;
				shown.enemyHull = Math.max(0, shown.enemyHull - values.hull);
				if (values.hull > 0) floatText(this, enemyHull.x, enemyHull.y, `−${values.hull}`, '#ff8a3d');
				if (values.absorbed > 0) floatText(this, enemyShield.x, enemyShield.y, `−${values.absorbed}`, '#46d9ff');
				break;
			case 'astro.log.enemyEvaded':
				this.tracer(weapons, { x: ENEMY_CENTER.x + 60, y: ENEMY_CENTER.y - 70 }, COLORS.shield);
				floatText(this, ENEMY_CENTER.x, ENEMY_CENTER.y, i18n.t('astro.float.dodge'), '#9eacd0');
				break;
			case 'astro.log.noWeapons':
				this.board.flashRoom('weapons', 0x5d6790);
				break;
			case 'astro.log.enemyFires':
				this.tracer({ x: 520, y: ENEMY_CENTER.y }, SHIP_CENTER, COLORS.loss);
				audioManager.playSfx(this, ASTRO_AUDIO.fire.cacheKey);
				shown.playerShield -= values.absorbed;
				shown.playerHull = Math.max(0, shown.playerHull - values.hull);
				if (values.absorbed > 0) {
					this.board.flashRoom('shields', COLORS.shield);
					floatText(this, playerShield.x, playerShield.y, `−${values.absorbed}`, '#46d9ff');
				}
				if (values.hull > 0) {
					this.cameras.main.shake(180, 0.008);
					audioManager.playSfx(this, ASTRO_AUDIO.hit.cacheKey);
					floatText(this, playerHull.x, playerHull.y, `−${values.hull}`, '#ff647c');
				}
				break;
			case 'astro.log.playerEvaded':
				this.tracer({ x: 520, y: ENEMY_CENTER.y }, { x: SHIP_CENTER.x, y: 120 }, COLORS.loss);
				this.board.flashRoom('engines', 0x5ee48a);
				floatText(this, SHIP_CENTER.x, SHIP_CENTER.y, i18n.t('astro.float.dodge'), '#5ee48a');
				break;
			case 'astro.log.enemyCharges':
				floatText(this, ENEMY_CENTER.x, ENEMY_CENTER.y + 30, i18n.t('astro.float.charge'), '#ffca4b');
				break;
			case 'astro.log.enemyShields':
				shown.enemyShield = values.shield;
				floatText(this, enemyShield.x, enemyShield.y, `${values.shield}`, '#46d9ff');
				break;
			case 'astro.log.boarding':
				if (entry.room) this.board.flashRoom(entry.room, 0xff8a3d);
				audioManager.playSfx(this, ASTRO_AUDIO.hit.cacheKey);
				break;
			case 'astro.log.boardingMissed':
				floatText(this, roomCenter.x, roomCenter.y, i18n.t('astro.float.empty'), '#5ee48a');
				break;
			case 'astro.log.boardingEmpty':
				shown.playerHull = Math.max(0, shown.playerHull - values.damage);
				this.cameras.main.shake(180, 0.008);
				floatText(this, playerHull.x, playerHull.y, `−${values.damage}`, '#ff647c');
				break;
			case 'astro.log.wounded':
				if (entry.room) this.board.flashRoom(entry.room, COLORS.loss);
				floatText(this, roomCenter.x, roomCenter.y, i18n.t('astro.float.wounded'), '#ff647c');
				break;
			case 'astro.log.crewDown':
				floatText(this, roomCenter.x, roomCenter.y + 18, i18n.t('astro.float.down'), '#ff647c');
				break;
			case 'astro.log.healed':
				floatText(this, roomCenter.x, roomCenter.y, '+1', '#5ee48a');
				break;
			case 'astro.log.shieldUp':
				shown.playerShield = values.shield;
				floatText(this, playerShield.x, playerShield.y, `${values.shield}`, '#46d9ff');
				break;
			case 'astro.log.victory':
				this.cameras.main.flash(350, 94, 228, 138);
				break;
			case 'astro.log.defeat':
				this.cameras.main.shake(450, 0.015);
				break;
		}

		this.drawHud();
		this.renderLog();
	}

	/** Un trazo que va de quien dispara a quien recibe y se apaga. */
	private tracer(from: { x: number; y: number }, to: { x: number; y: number }, color: number) {
		const graphics = this.add.graphics().setDepth(15);
		graphics.lineStyle(3, color, 1);
		graphics.lineBetween(from.x, from.y, to.x, to.y);
		graphics.fillStyle(color, 1);
		graphics.fillCircle(to.x, to.y, 6);

		this.tweens.add({
			targets: graphics,
			alpha: 0,
			duration: 380,
			onComplete: () => graphics.destroy(),
		});
	}

	private finishPlayback() {
		for (const timer of this.timers) timer.remove(false);
		this.timers = [];
		this.playing = false;

		this.board.setEnabled(this.combat.outcome === 'ongoing');
		this.refreshPanels();

		if (this.combat.outcome !== 'ongoing') this.showOutcome();
	}

	private showOutcome() {
		const won = this.combat.outcome === 'won';
		const accent = won ? 0x5ee48a : 0xff647c;
		const panel = this.add.container(0, 0).setDepth(30);

		// El velo es interactivo para que los clicks no lleguen al plano de abajo.
		panel.add(this.add.rectangle(400, 300, 800, 600, 0x030512, 0.84).setInteractive());
		panel.add(this.add.rectangle(400, 300, 620, 300, 0x0d1130).setStrokeStyle(2, accent));
		panel.add(
			this.add.text(400, 186, i18n.t(won ? 'astro.combat.victory' : 'astro.combat.defeat'), {
				fontFamily: FONTS.display,
				fontSize: '30px',
				color: won ? '#5ee48a' : '#ff647c',
			}).setOrigin(0.5)
		);
		panel.add(
			this.add.text(400, 246, this.outcomeSummary(), {
				fontFamily: FONTS.mono,
				fontSize: '13px',
				color: '#d9e2ff',
				align: 'center',
				lineSpacing: 8,
			}).setOrigin(0.5)
		);
		panel.add(
			this.add.text(400, 310, this.outcomeLesson(), {
				fontFamily: FONTS.sans,
				fontSize: '13px',
				color: '#bfc8e8',
				align: 'center',
				lineSpacing: 4,
				wordWrap: { width: 540 },
			}).setOrigin(0.5)
		);

		const retry = addButton(this, 300, 394, 300, 38, i18n.t('astro.combat.retry'), () => this.restart());
		const title = addButton(this, 556, 394, 170, 38, i18n.t('astro.combat.toTitle'), () => this.leave(), 'secondary');
		panel.add([retry.background, retry.label, title.background, title.label]);

		panel.setAlpha(0);
		this.tweens.add({ targets: panel, alpha: 1, duration: 250 });
		this.overlay = panel;
	}

	private outcomeSummary(): string {
		const { combat, ship } = this;
		const wounded = this.crew.all().filter((member) => member.wounds > 0).length;

		return [
			`${i18n.t('astro.combat.rounds')} ${combat.history.length}   ·   ` +
				`${i18n.t('astro.combat.hull')} ${ship.hull}/${ship.maxHull}   ·   ` +
				`${i18n.t('astro.combat.wounded')} ${wounded}`,
			`${i18n.t('astro.combat.dealt')} ${combat.stats.dealt}   ·   ` +
				`${i18n.t('astro.combat.taken')} ${combat.stats.taken}`,
		].join('\n');
	}

	/**
	 * Por qué terminó así, en una frase.
	 *
	 * Perder sin saber por qué no enseña nada. El golpe que más casco se llevó
	 * casi siempre es el disparo cargado que encontró el escudo corto, y eso es
	 * justo lo que hay que corregir en el próximo intento.
	 */
	private outcomeLesson(): string {
		const { worstHit, bestShot } = this.combat.stats;

		if (this.combat.outcome === 'won') {
			return bestShot ? fill('astro.combat.best', { round: bestShot.round, hull: bestShot.hull }) : '';
		}
		if (!worstHit) return i18n.t('astro.combat.cause.none');

		const key: TranslationKey = worstHit.charged ? 'astro.combat.cause.charged' : 'astro.combat.cause.fire';
		return fill(key, { round: worstHit.round, damage: worstHit.damage, hull: worstHit.hull });
	}

	/** Reintentar arma una tripulación y una nave nuevas, con el mismo reparto con que se empezó. */
	private restart() {
		audioManager.playSfx(this, ASTRO_AUDIO.confirm.cacheKey);
		this.scene.start(ASTRO_SCENES.SHIP, { layout: this.layout });
	}

	private leave() {
		audioManager.playSfx(this, ASTRO_AUDIO.confirm.cacheKey);
		this.scene.start(ASTRO_SCENES.TITLE);
	}
}
