import Phaser from 'phaser';
import { audioManager } from '../../../core/audio/AudioManager';
import { i18n, type TranslationKey } from '../../../core/i18n/i18n';
import { ASTRO_AUDIO, loadAstroAudio } from '../audio';
import { ENEMY_INTENTS, RAIDER, type EnemyIntent } from '../constants/enemies';
import { aptitude, PIECES, PIECE_TYPES, type PieceType } from '../constants/pieces';
import { ROOM_IDS, ROOMS, type RoomId } from '../constants/rooms';
import { COMBAT_TUNING } from '../constants/tuning';
import { CrewBoard, type RoomAlert } from '../objects/CrewBoard';
import { drawPiece, drawWoundMarks } from '../objects/pieceRenderer';
import {
	drawHull,
	drawRoomShell,
	drawSlotBox,
	planX,
	planY,
	type PlanTransform,
} from '../objects/shipRenderer';
import { fill } from '../objects/text';
import { addButton, FONTS, INTENT_COLORS } from '../objects/ui';
import { ASTRO_SCENES } from '../sceneKeys';
import { Crew } from '../state/Crew';
import { Ship } from '../state/Ship';

type Page = 'ship' | 'crew' | 'combat' | 'enemy';
const PAGES: Page[] = ['ship', 'crew', 'combat', 'enemy'];

/** El plano de las páginas de la nave y del enemigo: el de verdad, más chico. */
const BOARD: PlanTransform = { x: 30 - 42 * 0.66, y: 92 - 138 * 0.66, scale: 0.66 };
/** El plano de aptitudes, debajo del rasgo de la pieza. */
const APTITUDE_PLAN: PlanTransform = { x: 292 - 42 * 0.7, y: 272 - 138 * 0.7, scale: 0.7 };
const RIGHT = { x: 478, width: 292 };
const BELOW_BOARD = { x: 34, y: 300, width: 410 };

const APTITUDE_COLORS = ['#ff647c', '#d9e2ff', '#5ee48a'];
const ANSWER_COLOR = 0x5ee48a;
/** Cuánto dura cada mitad del ejemplo: el anuncio y la respuesta. */
const EXAMPLE_MS = 1800;

/** Dónde trabaja cada pieza en un ejemplo. */
type Posts = Partial<Record<PieceType, RoomId>>;

/**
 * El reparto de partida que usan los ejemplos: el rey al mando, cada
 * especialista en su sala y el peón en la armería.
 */
const BASE: Posts = { king: 'bridge', rook: 'shields', bishop: 'weapons', knight: 'engines', pawn: 'weapons' };

type Example = {
	threat: Posts;
	answer: Posts;
	threatAlert: (read: Readout) => RoomAlert;
	answerAlert: (read: Readout) => RoomAlert;
	answerKey: TranslationKey;
};

/** Lo que produce una sala con el reparto que se está mostrando. */
type Readout = (room: RoomId) => number;

const effect = (room: RoomId, read: Readout) => `${i18n.t(ROOMS[room].effectKey)} ${read(room)}`;
const torpedoHull = (read: Readout) =>
	Math.max(0, COMBAT_TUNING.torpedoDamage - read('engines') * COMBAT_TUNING.torpedoDodgePerPoint);
const radiationWounds = (read: Readout) => Math.max(0, COMBAT_TUNING.radiationWounds - read('medbay'));
const color = (intent: EnemyIntent) => parseInt(INTENT_COLORS[intent].slice(1), 16);

/**
 * Cada intención, primero como se anuncia y después respondida.
 *
 * La marca del anuncio es la misma que pone el combate sobre el plano; la de
 * la respuesta es verde. Los números salen de la nave del ejemplo, no de un
 * texto, así que no pueden contradecir a las reglas.
 */
const EXAMPLES: Record<EnemyIntent, Example> = {
	fire: {
		threat: BASE,
		answer: { ...BASE, pawn: 'shields' },
		threatAlert: () => ({ room: 'shields', color: color('fire'), label: i18n.t('astro.alert.shieldShort') }),
		answerAlert: (read) => ({ room: 'shields', color: ANSWER_COLOR, label: effect('shields', read) }),
		answerKey: 'astro.help.answer.fire',
	},
	charge: {
		threat: BASE,
		answer: BASE,
		threatAlert: () => ({
			room: 'shields',
			color: color('charge'),
			label: fill('astro.alert.charge', { next: RAIDER.damage * COMBAT_TUNING.chargeMultiplier }),
		}),
		answerAlert: (read) => ({ room: 'weapons', color: ANSWER_COLOR, label: effect('weapons', read) }),
		answerKey: 'astro.help.answer.charge',
	},
	shield: {
		threat: { ...BASE, pawn: 'shields' },
		answer: BASE,
		threatAlert: (read) => ({ room: 'weapons', color: color('shield'), label: effect('weapons', read) }),
		answerAlert: (read) => ({ room: 'weapons', color: ANSWER_COLOR, label: effect('weapons', read) }),
		answerKey: 'astro.help.answer.shield',
	},
	board: {
		threat: BASE,
		answer: { ...BASE, bishop: 'medbay', pawn: 'shields' },
		threatAlert: () => ({ room: 'weapons', color: color('board'), label: i18n.t('astro.intent.board') }),
		answerAlert: () => ({ room: 'weapons', color: ANSWER_COLOR, label: i18n.t('astro.float.empty') }),
		answerKey: 'astro.help.answer.board',
	},
	torpedo: {
		threat: { ...BASE, knight: 'weapons', pawn: 'shields' },
		answer: { ...BASE, pawn: 'shields' },
		threatAlert: (read) => ({
			room: 'engines',
			color: color('torpedo'),
			label: fill('astro.alert.torpedo', { hull: torpedoHull(read) }),
		}),
		answerAlert: (read) => ({
			room: 'engines',
			color: ANSWER_COLOR,
			label: fill('astro.alert.torpedo', { hull: torpedoHull(read) }),
		}),
		answerKey: 'astro.help.answer.torpedo',
	},
	radiation: {
		threat: BASE,
		answer: { ...BASE, pawn: 'medbay' },
		threatAlert: (read) => ({
			room: 'medbay',
			color: color('radiation'),
			label: fill('astro.alert.radiation', { count: radiationWounds(read) }),
		}),
		answerAlert: (read) => ({
			room: 'medbay',
			color: ANSWER_COLOR,
			label: fill('astro.alert.radiation', { count: radiationWounds(read) }),
		}),
		answerKey: 'astro.help.answer.radiation',
	},
};

type HelpData = { page?: Page; keepMusic?: boolean };

/**
 * Cómo se juega, en cuatro páginas: la nave, la tripulación, el combate y lo
 * que anuncia el enemigo.
 *
 * Los ejemplos usan el mismo plano que el juego, con una tripulación de
 * muestra: la ayuda enseña a leer la pantalla que el jugador va a tener
 * delante, no un dibujo parecido.
 *
 * Cambiar de página reinicia la escena, que es la forma más simple de que el
 * plano y sus zonas desaparezcan enteros. La música no se corta en esos
 * reinicios: sólo al salir de la ayuda.
 */
export class AstroChessHelpScene extends Phaser.Scene {
	private page: Page = 'ship';
	/** Pieza o intención elegida dentro de la página. */
	private choice = 0;
	private flipping = false;

	private crew!: Crew;
	private ship!: Ship;
	private board: CrewBoard | null = null;
	private choiceLayer!: Phaser.GameObjects.Container;
	private choiceGraphics!: Phaser.GameObjects.Graphics;
	private exampleTimer: Phaser.Time.TimerEvent | null = null;

	constructor() {
		super(ASTRO_SCENES.HELP);
	}

	preload() {
		loadAstroAudio(this, ASTRO_AUDIO.introMusic, ASTRO_AUDIO.select, ASTRO_AUDIO.confirm);
	}

	create(data: HelpData = {}) {
		// Las escenas se reutilizan: todo lo que depende de la página se
		// vuelve a armar desde cero.
		this.page = data.page ?? 'ship';
		this.choice = 0;
		this.flipping = false;
		this.board = null;
		this.exampleTimer = null;
		this.crew = Crew.starting();
		this.ship = new Ship(COMBAT_TUNING.playerHull);

		this.cameras.main.setBackgroundColor('#050914');
		this.drawFrame();
		this.choiceGraphics = this.add.graphics();
		this.choiceLayer = this.add.container(0, 0);

		if (this.page === 'ship') this.createShipPage();
		if (this.page === 'crew') this.createCrewPage();
		if (this.page === 'combat') this.createCombatPage();
		if (this.page === 'enemy') this.createEnemyPage();

		if (!data.keepMusic) audioManager.playMusic(this, ASTRO_AUDIO.introMusic.cacheKey);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
			if (!this.flipping) audioManager.stopMusic();
		});

		const keyboard = this.input.keyboard!;
		keyboard.on('keydown-LEFT', () => this.turnPage(-1));
		keyboard.on('keydown-RIGHT', () => this.turnPage(1));
		keyboard.on('keydown-UP', () => this.moveChoice(-1));
		keyboard.on('keydown-DOWN', () => this.moveChoice(1));
		keyboard.on('keydown-ESC', () => this.back());
	}

	// ── Marco ────────────────────────────────────────────────────────────────

	private drawFrame() {
		this.add.text(30, 20, i18n.t('astro.help.title'), {
			fontFamily: FONTS.display,
			fontSize: '18px',
			color: '#f5f7ff',
			letterSpacing: 2,
		});

		PAGES.forEach((page, index) => {
			const x = 340 + index * 120;
			const current = page === this.page;
			const tab = this.add
				.rectangle(x, 32, 112, 28, current ? 0x231a4d : 0x0d1130)
				.setStrokeStyle(current ? 2 : 1, current ? 0xc66cff : 0x3d3a72)
				.setInteractive({ useHandCursor: true });
			tab.on('pointerdown', () => this.goToPage(page));
			this.add
				.text(x, 32, i18n.t(`astro.help.tab.${page}` as const), {
					fontFamily: FONTS.mono,
					fontSize: '11px',
					color: current ? '#ffffff' : '#8290b3',
				})
				.setOrigin(0.5);
		});

		const hint = this.page === 'crew' || this.page === 'enemy' ? 'astro.help.hintChoose' : 'astro.help.hint';
		this.add.text(30, 572, i18n.t(hint), {
			fontFamily: FONTS.mono,
			fontSize: '12px',
			color: '#6d7da8',
		}).setOrigin(0, 0.5);
		addButton(this, 690, 572, 160, 28, i18n.t('astro.help.back'), () => this.back(), 'secondary');
	}

	private turnPage(direction: -1 | 1) {
		const index = PAGES.indexOf(this.page) + direction;
		if (index < 0 || index >= PAGES.length) return;

		this.goToPage(PAGES[index]);
	}

	private goToPage(page: Page) {
		if (page === this.page) return;

		audioManager.playSfx(this, ASTRO_AUDIO.select.cacheKey);
		this.flipping = true;
		this.scene.restart({ page, keepMusic: true } satisfies HelpData);
	}

	private back() {
		audioManager.playSfx(this, ASTRO_AUDIO.confirm.cacheKey);
		this.scene.start(ASTRO_SCENES.TITLE);
	}

	private moveChoice(direction: -1 | 1) {
		const count = this.page === 'crew' ? PIECE_TYPES.length : this.page === 'enemy' ? ENEMY_INTENTS.length : 0;
		if (!count) return;

		this.select((this.choice + direction + count) % count);
	}

	private select(index: number) {
		if (index === this.choice) return;

		this.choice = index;
		audioManager.playSfx(this, ASTRO_AUDIO.select.cacheKey);
		if (this.page === 'crew') this.refreshCrew();
		if (this.page === 'enemy') this.refreshEnemy();
	}

	// ── Piezas sueltas ───────────────────────────────────────────────────────

	private heading(x: number, y: number, key: TranslationKey, color = '#8f86c8') {
		return this.add.text(x, y, i18n.t(key), {
			fontFamily: FONTS.sans,
			fontSize: '11px',
			color,
			letterSpacing: 2,
		});
	}

	private body(x: number, y: number, text: string, width: number, color = '#d9e2ff') {
		return this.add.text(x, y, text, {
			fontFamily: FONTS.sans,
			fontSize: '13px',
			color,
			lineSpacing: 4,
			wordWrap: { width },
		});
	}

	/** El plano real, quieto: se mira y se pasa el mouse, pero no se reparte. */
	private createBoard(posts: Posts) {
		this.arrange(posts);
		this.board = new CrewBoard(this, {
			crew: this.crew,
			ship: this.ship,
			transform: BOARD,
			// Nadie queda sin puesto en los ejemplos: la reserva va fuera de pantalla.
			reserve: { x: 0, y: 900, spacing: 0, size: 0 },
		});
		this.board.setEnabled(false);
	}

	private arrange(posts: Posts) {
		for (const room of ROOM_IDS) {
			for (let slot = 0; slot < ROOMS[room].slots; slot += 1) this.ship.clear({ room, slot });
		}

		for (const member of this.crew.all()) {
			const room = posts[member.type];
			if (!room) continue;

			for (let slot = 0; slot < ROOMS[room].slots; slot += 1) {
				if (!this.ship.memberIdAt({ room, slot })) {
					this.ship.assign({ room, slot }, member.id);
					break;
				}
			}
		}
	}

	// ── La nave ──────────────────────────────────────────────────────────────

	private createShipPage() {
		this.createBoard(BASE);

		const { x, width } = BELOW_BOARD;
		const lead = this.body(x, BELOW_BOARD.y, i18n.t('astro.help.ship.lead'), width);
		const slots = this.body(x, lead.y + lead.height + 16, i18n.t('astro.help.ship.slots'), width, '#9eacd0');
		this.body(x, slots.y + slots.height + 16, i18n.t('astro.help.ship.hover'), width, '#6d7da8');

		let y = 84;
		for (const room of ROOM_IDS) {
			const profile = ROOMS[room];
			this.add.text(RIGHT.x, y, i18n.t(profile.nameKey), {
				fontFamily: FONTS.mono,
				fontSize: '13px',
				color: '#ffffff',
				fontStyle: 'bold',
			});
			this.add.text(RIGHT.x + RIGHT.width, y + 1, i18n.t(profile.effectKey), {
				fontFamily: FONTS.mono,
				fontSize: '11px',
				color: '#5ee48a',
			}).setOrigin(1, 0);
			const help = this.body(
				RIGHT.x,
				y + 20,
				fill(`astro.room.${room}.help` as const, { percent: COMBAT_TUNING.evasionPerPoint }),
				RIGHT.width,
				'#9eacd0'
			);
			y += 30 + help.height + 14;
		}
	}

	// ── La tripulación ───────────────────────────────────────────────────────

	private createCrewPage() {
		PIECE_TYPES.forEach((_, index) => {
			const y = this.crewRowY(index);
			const zone = this.add.rectangle(140, y, 200, 62, 0x000000, 0).setInteractive({ useHandCursor: true });
			zone.on('pointerover', () => this.select(index));
			zone.on('pointerdown', () => this.select(index));
		});

		this.refreshCrew();
	}

	private crewRowY(index: number) {
		return 108 + index * 74;
	}

	/**
	 * La pieza elegida: su rasgo y cuánto rinde en cada sala, sobre el plano.
	 *
	 * El plano chico es la tabla de aptitudes puesta donde el jugador la va a
	 * usar: ×2 en la armería se lee mejor dibujado en la armería.
	 */
	private refreshCrew() {
		const graphics = this.choiceGraphics;
		graphics.clear();
		this.choiceLayer.removeAll(true);
		const type = PIECE_TYPES[this.choice];

		PIECE_TYPES.forEach((piece, index) => {
			const y = this.crewRowY(index);
			const selected = index === this.choice;
			if (selected) {
				graphics.fillStyle(PIECES[piece].color, 0.12);
				graphics.fillRect(40, y - 31, 200, 62);
				graphics.lineStyle(1, PIECES[piece].color, 0.7);
				graphics.strokeRect(40, y - 31, 200, 62);
			}
			drawPiece(graphics, 76, y - 2, 42, piece, selected ? 1 : 0.45);
			this.choiceLayer.add(
				this.add.text(112, y, i18n.t(PIECES[piece].nameKey), {
					fontFamily: FONTS.mono,
					fontSize: '14px',
					color: selected ? '#ffffff' : '#8290b3',
				}).setOrigin(0, 0.5)
			);
		});

		drawPiece(graphics, 312, 112, 64, type, 1);
		this.choiceLayer.add([
			this.add.text(360, 112, i18n.t(PIECES[type].nameKey), {
				fontFamily: FONTS.display,
				fontSize: '28px',
				color: '#f5f7ff',
			}).setOrigin(0, 0.5),
			this.body(282, 160, i18n.t(PIECES[type].traitKey), 480),
			this.heading(292, 236, 'astro.help.aptitude'),
		]);

		drawHull(graphics, APTITUDE_PLAN);
		for (const room of ROOM_IDS) {
			const profile = ROOMS[room];
			drawRoomShell(graphics, profile, APTITUDE_PLAN);
			const value = aptitude(type, room);
			const centerX = planX(APTITUDE_PLAN, profile.plan.x + profile.plan.width / 2);
			const top = planY(APTITUDE_PLAN, profile.plan.y);
			this.choiceLayer.add([
				this.add.text(centerX, top + 16, i18n.t(profile.nameKey), {
					fontFamily: FONTS.mono,
					fontSize: '10px',
					color: '#ffffff',
				}).setOrigin(0.5),
				this.add.text(centerX, top + profile.plan.height * APTITUDE_PLAN.scale * 0.6, value === 0 ? '—' : `×${value}`, {
					fontFamily: FONTS.mono,
					fontSize: '22px',
					fontStyle: 'bold',
					color: APTITUDE_COLORS[value],
				}).setOrigin(0.5),
			]);
		}

		this.choiceLayer.add(this.body(292, 490, i18n.t('astro.help.aptitude.legend'), 470, '#6d7da8'));
	}

	// ── El combate ───────────────────────────────────────────────────────────

	/**
	 * La ronda en tres pasos, cada uno con un pedazo de la pantalla de combate.
	 *
	 * Los textos de muestra son las mismas traducciones que usa el combate con
	 * números de ejemplo: si el combate cambia su forma de decirlo, la ayuda
	 * cambia con él.
	 */
	private createCombatPage() {
		const graphics = this.add.graphics();
		const cards = [30, 286, 542];
		const top = 74;
		const width = 228;
		const height = 236;

		cards.forEach((x, index) => {
			graphics.fillStyle(0x0d1130, 1);
			graphics.fillRect(x, top, width, height);
			graphics.lineStyle(1, 0x3d3a72, 1);
			graphics.strokeRect(x, top, width, height);
			this.add.text(x + 14, top + 12, `${index + 1}`, {
				fontFamily: FONTS.display,
				fontSize: '18px',
				color: '#c66cff',
			});
			this.heading(x + 40, top + 17, `astro.help.combat.step${index + 1}` as TranslationKey, '#d9e2ff');
			if (index < 2) {
				this.add.text(x + width + 14, top + height / 2, '→', {
					fontFamily: FONTS.display,
					fontSize: '20px',
					color: '#5b53a6',
				}).setOrigin(0.5);
			}
		});

		// 1. El anuncio, como lo muestra el panel del enemigo.
		const [first, second, third] = cards;
		this.heading(first + width / 2, top + 54, 'astro.combat.intent', '#6d7da8').setOrigin(0.5, 0);
		this.add.text(first + width / 2, top + 72, i18n.t('astro.intent.fire'), {
			fontFamily: FONTS.display,
			fontSize: '22px',
			color: INTENT_COLORS.fire,
		}).setOrigin(0.5, 0);
		this.add.text(first + width / 2, top + 102, i18n.t('astro.intent.fire.detail'), {
			fontFamily: FONTS.sans,
			fontSize: '11px',
			color: '#d9e2ff',
			align: 'center',
			wordWrap: { width: width - 28 },
		}).setOrigin(0.5, 0);

		// 2. Las fichas de movimiento: una gastada y una por gastar.
		this.heading(second + 16, top + 54, 'astro.combat.moves', '#6d7da8');
		graphics.fillStyle(0xffca4b, 1);
		graphics.fillCircle(second + 30, top + 88, 8);
		graphics.lineStyle(2, 0xffca4b, 0.4);
		graphics.strokeCircle(second + 52, top + 88, 7);
		drawSlotBox(graphics, second + 160, top + 92, 40, { occupied: true });
		drawPiece(graphics, second + 160, top + 92, 30, 'king');
		this.add.text(second + 160, top + 120, i18n.t('astro.room.bridge'), {
			fontFamily: FONTS.mono,
			fontSize: '10px',
			color: '#8290b3',
		}).setOrigin(0.5, 0);

		// 3. El pronóstico, con las líneas que escribiría el combate.
		this.heading(third + 16, top + 54, 'astro.combat.forecast', '#6d7da8');
		this.add.text(third + 16, top + 76, fill('astro.forecast.enemyFire', { damage: 7, absorbed: 6, hull: 1 }), {
			fontFamily: FONTS.sans,
			fontSize: '11px',
			color: '#ff647c',
			wordWrap: { width: width - 30 },
		});
		this.add.text(third + 16, top + 100, fill('astro.forecast.youFire', { damage: 6, absorbed: 0, hull: 6 }), {
			fontFamily: FONTS.sans,
			fontSize: '11px',
			color: '#46d9ff',
			wordWrap: { width: width - 30 },
		});

		cards.forEach((x, index) => {
			this.body(x + 14, top + 144, i18n.t(`astro.help.combat.step${index + 1}.text` as TranslationKey), width - 28, '#9eacd0')
				.setFontSize(12);
		});

		this.createWoundsRow(graphics, 336);

		this.add.text(400, 530, i18n.t('astro.help.combat.goal'), {
			fontFamily: FONTS.sans,
			fontSize: '13px',
			color: '#ffca4b',
			align: 'center',
			wordWrap: { width: 720 },
		}).setOrigin(0.5);
	}

	/** Herido, fuera de combate y la enfermería: lo que hay que saber de las heridas. */
	private createWoundsRow(graphics: Phaser.GameObjects.Graphics, top: number) {
		this.heading(30, top, 'astro.help.combat.wounds');

		const items: Array<{ x: number; key: TranslationKey; draw: (x: number, y: number) => void }> = [
			{
				x: 30,
				key: 'astro.help.combat.wounded',
				draw: (x, y) => {
					drawSlotBox(graphics, x, y, 48, { occupied: true });
					drawPiece(graphics, x, y, 36, 'rook');
					drawWoundMarks(graphics, x, y, 48, 1, 3.5);
				},
			},
			{
				x: 286,
				key: 'astro.help.combat.down',
				draw: (x, y) => {
					drawPiece(graphics, x, y, 36, 'rook', 0.2);
					drawWoundMarks(graphics, x, y, 48, COMBAT_TUNING.woundsToDrop, 3.5);
				},
			},
			{
				x: 542,
				key: 'astro.help.combat.medbay',
				draw: (x, y) => {
					drawSlotBox(graphics, x, y, 48, { occupied: true });
					drawPiece(graphics, x, y, 36, 'bishop');
					this.add.text(x, y - 38, '+1', {
						fontFamily: FONTS.display,
						fontSize: '16px',
						color: '#5ee48a',
					}).setOrigin(0.5);
				},
			},
		];

		for (const item of items) {
			item.draw(item.x + 26, top + 64);
			this.body(item.x + 66, top + 34, i18n.t(item.key), 158, '#d9e2ff').setFontSize(12);
		}
	}

	// ── El enemigo ───────────────────────────────────────────────────────────

	private createEnemyPage() {
		this.createBoard(BASE);

		ENEMY_INTENTS.forEach((_, index) => {
			const zone = this.add
				.rectangle(RIGHT.x + RIGHT.width / 2, this.intentRowY(index), RIGHT.width, 38, 0x000000, 0)
				.setInteractive({ useHandCursor: true });
			zone.on('pointerover', () => this.select(index));
			zone.on('pointerdown', () => this.select(index));
		});

		this.refreshEnemy();
	}

	private intentRowY(index: number) {
		return 100 + index * 46;
	}

	/**
	 * La intención elegida, contada en dos tiempos sobre el plano.
	 *
	 * Primero el anuncio, con la sala marcada como en combate; después la
	 * respuesta, con las piezas ya movidas y la sala en verde. Alterna solo:
	 * ver el antes y el después es lo que enseña qué mover.
	 */
	private refreshEnemy() {
		const graphics = this.choiceGraphics;
		graphics.clear();
		this.choiceLayer.removeAll(true);
		this.exampleTimer?.remove();

		ENEMY_INTENTS.forEach((intent, index) => {
			const y = this.intentRowY(index);
			const selected = index === this.choice;
			if (selected) {
				graphics.fillStyle(color(intent), 0.14);
				graphics.fillRect(RIGHT.x, y - 19, RIGHT.width, 38);
				graphics.lineStyle(1, color(intent), 0.8);
				graphics.strokeRect(RIGHT.x, y - 19, RIGHT.width, 38);
			}
			this.choiceLayer.add(
				this.add.text(RIGHT.x + 14, y, i18n.t(`astro.intent.${intent}` as const), {
					fontFamily: FONTS.display,
					fontSize: '15px',
					color: INTENT_COLORS[intent],
				}).setOrigin(0, 0.5).setAlpha(selected ? 1 : 0.55)
			);
		});

		const intent = ENEMY_INTENTS[this.choice];
		const { x, y, width } = BELOW_BOARD;
		const phase = this.add.text(x, y, '', {
			fontFamily: FONTS.mono,
			fontSize: '12px',
			color: '#050914',
			fontStyle: 'bold',
			padding: { x: 6, y: 2 },
		});
		const does = this.heading(x, y + 34, 'astro.help.enemy.does');
		const detail = this.body(x, y + 52, i18n.t(`astro.intent.${intent}.detail` as const), width);
		const answers = this.heading(x, detail.y + detail.height + 14, 'astro.help.enemy.answer', '#5ee48a');
		const answer = this.body(x, answers.y + 18, i18n.t(EXAMPLES[intent].answerKey), width);
		this.choiceLayer.add([phase, does, detail, answers, answer]);

		let answered = false;
		const show = () => {
			const example = EXAMPLES[intent];
			this.arrange(answered ? example.answer : example.threat);
			const read: Readout = (room) => this.ship.output(room, this.crew);
			this.board?.setAlert(answered ? example.answerAlert(read) : example.threatAlert(read));
			this.board?.refresh();

			phase
				.setText(i18n.t(answered ? 'astro.help.enemy.after' : 'astro.help.enemy.before'))
				.setBackgroundColor(answered ? '#5ee48a' : INTENT_COLORS[intent]);
			answered = !answered;
		};

		show();
		this.exampleTimer = this.time.addEvent({ delay: EXAMPLE_MS, loop: true, callback: show });
	}
}
