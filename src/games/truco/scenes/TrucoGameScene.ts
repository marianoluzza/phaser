import Phaser from 'phaser';
import { audioManager } from '../../../core/audio/AudioManager';
import { i18n } from '../../../core/i18n/i18n';
import type { TranslationKey } from '../../../core/i18n/i18n';
import { CORE_SCENES } from '../../../core/sceneKeys';
import { getTrucoAiChoice, resolveTrucoAi } from '../ai/aiSelection';
import type { AiTableView, EnvidoClue, TrucoAiProfile, TrucoBet } from '../ai/types';
import { loadTrucoAudio, TRUCO_AUDIO } from '../audio';
import { calculateEnvido, CARDS_PER_HAND, compareCards, createDeck, getEnvidoAcceptedPoints, getEnvidoRaises, getEnvidoRejectedPoints, resolveHandWinner, shuffleDeck, TRUCO_TARGET_SCORE } from '../rules';
import type { Card, EnvidoCall, TrickWinner } from '../rules';
import { ActionButton } from '../objects/actionButton';
import { CantosLog } from '../objects/cantosLog';
import type { CantosSpeaker } from '../objects/cantosLog';
import { TrucoScoreBoard } from '../objects/scoreBoard';
import { FocusNavigator } from '../objects/focusNavigator';
import type { Direction } from '../objects/focusNavigator';
import { TableCards } from '../objects/tableCards';
import { TRUCO_SCENES } from '../sceneKeys';

type Player = 'player' | 'ai';
type TrucoValue = 1 | 2 | 3 | 4;
type CardOutcome = 'won' | 'lost' | 'tie';
type PlayedCard = { card: Card; owner: Player; outcome?: CardOutcome };
type PendingTruco = { caller: Player; value: Exclude<TrucoValue, 1>; resume?: () => void };

const TABLE_CARD_X = [320, 400, 480] as const;
const TABLE_CARD_WIDTH = 68;
const TABLE_CARD_HEIGHT = 96;
/** Filas de la mesa: mano de la IA, sus cartas jugadas, las del jugador y su mano. */
const TABLE_ROW_Y = { aiHand: 120, aiTrick: 255, playerTrick: 385, playerHand: 520 } as const;
/** El mazo desde donde se reparte: el centro de la mesa, entre las dos manos. */
const DECK_POSITION = { x: 400, y: 320 } as const;
const NEXT_HAND_DELAY_MS = 3000;

/**
 * Grilla de cantos debajo del registro: respuestas arriba, envido a la
 * izquierda y truco a la derecha. Los botones nunca cambian de lugar; sólo
 * se prenden y se apagan.
 */
const ACTIONS_LEFT = 27;
const ACTIONS_WIDTH = 222;
const GRID_COLUMN_GAP = 10;
const GRID_COLUMN_WIDTH = (ACTIONS_WIDTH - GRID_COLUMN_GAP) / 2;
const GRID_COLUMN_X = [ACTIONS_LEFT + GRID_COLUMN_WIDTH / 2, ACTIONS_LEFT + ACTIONS_WIDTH - GRID_COLUMN_WIDTH / 2] as const;
const GRID_ROW_Y = [403, 455, 501, 547] as const;
const GRID_BUTTON_HEIGHT = 38;
const ACTIONS_CENTER_X = ACTIONS_LEFT + ACTIONS_WIDTH / 2;

const ENVIDO_BUTTONS: { call: EnvidoCall; label: TranslationKey; hotkey: TranslationKey }[] = [
	{ call: 'envido', label: 'truco.envido.call', hotkey: 'truco.keys.envido' },
	{ call: 'realEnvido', label: 'truco.envido.realCall', hotkey: 'truco.keys.realEnvido' },
	{ call: 'faltaEnvido', label: 'truco.envido.faltaCall', hotkey: 'truco.keys.faltaEnvido' },
];

const ARROW_DIRECTIONS: Partial<Record<string, Direction>> = {
	ArrowLeft: 'left',
	ArrowRight: 'right',
	ArrowUp: 'up',
	ArrowDown: 'down',
};

/** Fila de las teclas A/S/D, debajo de la mano. */
const CARD_KEY_HINT_Y = 584;

const cardFocusId = (card: Card) => `card:${card.id}`;

/** Partida de Truco v1: cartas, turnos y un punto por mano ganada. */
export class TrucoGameScene extends Phaser.Scene {
	private playerScore = 0;
	private aiScore = 0;
	private playerHand: Card[] = [];
	private aiHand: Card[] = [];
	private trickWinners: TrickWinner[] = [];
	private playerIsMano = true;
	private playerLeadsTrick = true;
	private playerCard: Card | null = null;
	private aiCard: Card | null = null;
	private currentTrickCards: PlayedCard[] = [];
	private playedTricks: PlayedCard[][] = [];
	private playerTurn = false;
	private waitingForNext = false;
	private scoreBoard!: TrucoScoreBoard;
	private cantosLog!: CantosLog;
	private escapeKey!: Phaser.Input.Keyboard.Key;
	private tableCards!: TableCards;
	private actionObjects: Phaser.GameObjects.GameObject[] = [];
	private envidoResolved = false;
	/** Cantos de envido de esta mano, en orden; vacía mientras nadie cantó. */
	private envidoChain: EnvidoCall[] = [];
	/** Quién tiene que responder el último canto; `null` si ya se quiso. */
	private envidoAwaiting: Player | null = null;
	/** Jugada de la IA que quedó en suspenso cuando ella cantó el envido. */
	private envidoResume?: () => void;
	private declaringEnvido = false;
	private pendingEnvidoPoints = '';
	private trucoValue: TrucoValue = 1;
	private lastTrucoCaller: Player | null = null;
	private pendingTruco?: PendingTruco;
	private awaitingNextHand = false;
	private matchFinished = false;
	private nextHandTimer?: Phaser.Time.TimerEvent;
	private nextHandReadyAt = 0;
	private nextHandButton?: ActionButton;
	private actionButtons: ActionButton[] = [];
	private focus!: FocusNavigator;
	/** Teclas que eligen la primera, segunda y tercera carta de la mano. */
	private cardKeys: string[] = [];
	private cardKeyHints: Phaser.GameObjects.GameObject[][] = [];
	private aiProfile!: TrucoAiProfile;
	/** Nombre visible del rival; con el sorteo es genérico para no delatarlo. */
	private aiName = '';
	private aiEnvidoPoints = 0;
	/** Tanto que dijo la IA en esta mano; siendo mano lo dice antes que el jugador. */
	private aiDeclaredEnvido: number | null = null;
	/** Lo que el jugador dejó ver de su tanto: la IA lo usa para adivinar sus cartas. */
	private playerEnvidoClue: EnvidoClue | null = null;

	constructor() {
		super(TRUCO_SCENES.GAME);
	}

	preload() {
		loadTrucoAudio(this);
	}

	create() {
		// Se resuelve en cada partida: Repetir vuelve a sortear si se eligió al azar.
		const { profile, hidden } = resolveTrucoAi(getTrucoAiChoice(), Math.random);
		this.aiProfile = profile;
		this.aiName = i18n.t(hidden ? 'truco.game.opponent' : profile.nameKey);
		this.resetMatch();
		audioManager.playMusic(this, TRUCO_AUDIO.music.cacheKey);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audioManager.stopMusic());
		const keyboard = this.input.keyboard!;
		this.escapeKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
		keyboard.on('keydown', this.handleKeyDown, this);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => keyboard.off('keydown', this.handleKeyDown, this));
	}

	update() {
		this.updateNextHandProgress();
		if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
			if (this.declaringEnvido) {
				this.cancelEnvidoDeclaration();
				return;
			}
			this.scene.start(CORE_SCENES.LAUNCHER);
			return;
		}
		// Enter queda disponible para no romper el control esperado, aunque los
		// choques ahora avanzan solos después de mostrar sus cartas.
	}

	private resetMatch() {
		this.playerScore = 0;
		this.aiScore = 0;
		this.playerIsMano = true;
		this.matchFinished = false;
		this.drawStaticUi();
		this.startHand();
	}

	private startHand() {
		this.nextHandTimer?.remove(false);
		this.nextHandTimer = undefined;
		const deck = shuffleDeck(createDeck());
		this.playerHand = deck.slice(0, CARDS_PER_HAND);
		this.aiHand = deck.slice(CARDS_PER_HAND, CARDS_PER_HAND * 2);
		this.aiEnvidoPoints = calculateEnvido(this.aiHand);
		this.trickWinners = [];
		this.playerCard = null;
		this.aiCard = null;
		this.currentTrickCards = [];
		this.playedTricks = [];
		this.waitingForNext = false;
		this.awaitingNextHand = false;
		this.envidoResolved = false;
		this.envidoChain = [];
		this.envidoAwaiting = null;
		this.envidoResume = undefined;
		this.declaringEnvido = false;
		this.pendingEnvidoPoints = '';
		this.aiDeclaredEnvido = null;
		this.playerEnvidoClue = null;
		this.trucoValue = 1;
		this.lastTrucoCaller = null;
		this.pendingTruco = undefined;
		this.cantosLog.clear();
		this.tableCards.clear();
		// La mano abre el primer turno; los siguientes los abre quien ganó el turno previo.
		this.playerLeadsTrick = this.playerIsMano;
		this.playerTurn = this.playerLeadsTrick;
		this.renderState();
		if (!this.playerLeadsTrick) this.aiLeadTrick();
	}

	private drawStaticUi() {
		this.cameras.main.setBackgroundColor('#17120d');
		this.add.text(38, 30, i18n.t('truco.game.title'), { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '30px', color: '#fff4d6' });
		this.tableCards = new TableCards(this, TABLE_CARD_WIDTH, TABLE_CARD_HEIGHT, DECK_POSITION);
		// Sin foco, las flechas parten de un lugar imaginario antes de la primera
		// carta: `←` entra a los cantos y `→`, sin cartas jugables, también, por el otro lado.
		this.focus = new FocusNavigator(() => this.defaultFocus(), () => ({
			x: TABLE_CARD_X[0] - (TABLE_CARD_X[1] - TABLE_CARD_X[0]),
			y: TABLE_ROW_Y.playerHand,
		}));
		this.actionButtons = [];
		this.cardKeys = i18n.t('truco.keys.cards').toLowerCase().split('');
		this.cardKeyHints = TABLE_CARD_X.map((x, index) => this.drawKeyHint(x, CARD_KEY_HINT_Y, this.cardKeys[index] ?? ''));
		this.cantosLog = new CantosLog(this, { left: 27, top: 112, width: 222, height: 258 }, i18n.t('truco.envido.logTitle'));
		this.scoreBoard = new TrucoScoreBoard(this, { left: 532, top: 112, width: 248, height: 456 }, {
			player: i18n.t('truco.game.you'),
			ai: this.aiName,
			bad: i18n.t('truco.score.bad'),
			good: i18n.t('truco.score.good'),
		});
	}

	private renderState() {
		this.scoreBoard.setScores(this.playerScore, this.aiScore);
		this.scoreBoard.setMano(this.playerIsMano ? 'player' : 'ai');
		this.renderCards();
		this.renderActions();
	}

	private renderCards() {
		this.tableCards.beginLayout();
		// El reparto alterna, empezando por quien es mano.
		const dealOrder = (owner: Player, index: number) => index * 2 + ((owner === 'player') === this.playerIsMano ? 0 : 1);
		this.aiHand.forEach((card, index) => {
			this.tableCards.place(card, { x: TABLE_CARD_X[index], y: TABLE_ROW_Y.aiHand, faceUp: false, dealOrder: dealOrder('ai', index) });
		});
		this.playedTricks.forEach((trick, trickIndex) => this.drawTrickCards(trick, TABLE_CARD_X[trickIndex]));
		if (this.currentTrickCards.length > 0) this.drawTrickCards(this.currentTrickCards, TABLE_CARD_X[this.playedTricks.length]);
		const playable = this.canPlayCard();
		this.playerHand.forEach((card, index) => this.tableCards.place(card, {
			x: TABLE_CARD_X[index],
			y: TABLE_ROW_Y.playerHand,
			faceUp: true,
			highlight: playable ? 'playable' : 'none',
			onClick: playable ? () => this.playPlayerCard(index) : undefined,
			onHover: () => this.focus.focus(cardFocusId(card)),
			dealOrder: dealOrder('player', index),
		}));
		this.cardKeyHints.forEach((hint, index) => hint.forEach((object) => (object as Phaser.GameObjects.Graphics).setVisible(playable && index < this.playerHand.length)));
		this.focus.setGroup('cards', this.playerHand.map((card, index) => ({
			id: cardFocusId(card),
			x: TABLE_CARD_X[index],
			y: TABLE_ROW_Y.playerHand,
			enabled: playable,
			setFocused: (focused: boolean, instant: boolean) => this.tableCards.setFocus(focused ? card.id : null, instant),
			activate: () => this.playPlayerCard(index),
		})));
	}

	/** Al empezar el turno, la carta del medio; al tener que responder, ninguna. */
	private defaultFocus(): string | null {
		if (this.matchFinished) return 'action:retry';
		if (this.awaitingNextHand) return 'action:next';
		if (!this.canPlayCard() || this.playerHand.length === 0) return null;
		return cardFocusId(this.playerHand[Math.floor(this.playerHand.length / 2)]);
	}

	/** Una tecla chiquita, como la de las esquinas de los botones. */
	private drawKeyHint(x: number, y: number, key: string) {
		const size = 14;
		const badge = this.add.graphics();
		badge.fillStyle(0x17120d, 1);
		badge.fillRoundedRect(x - size / 2, y - size / 2, size, size, 3);
		badge.lineStyle(1, 0x8b6a38, 1);
		badge.strokeRoundedRect(x - size / 2, y - size / 2, size, size, 3);
		const letter = this.add.text(x, y, key.toUpperCase(), { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '8px', color: '#cdb88f' }).setOrigin(0.5);
		return [badge, letter];
	}

	private renderActions() {
		this.actionObjects.forEach((object) => object.destroy());
		this.actionObjects = [];
		this.actionButtons.forEach((button) => button.destroy());
		this.actionButtons = [];
		this.nextHandButton = undefined;

		if (this.matchFinished) {
			// El menú del Truco es donde se elige el próximo rival.
			this.addGridButton('menu', 0, 1, i18n.t('truco.actions.menu'), true, () => this.scene.start(TRUCO_SCENES.TITLE));
			this.addGridButton('retry', 1, 1, i18n.t('truco.actions.retry'), true, () => this.scene.restart());
		} else if (this.awaitingNextHand) {
			this.nextHandButton = this.addActionButton('next', ACTIONS_CENTER_X, (GRID_ROW_Y[1] + GRID_ROW_Y[2]) / 2, ACTIONS_WIDTH, 44, i18n.t('truco.actions.next'), true, () => this.advanceToNextHand());
			this.updateNextHandProgress();
		} else if (this.declaringEnvido) {
			this.drawEnvidoPointsInput();
		} else {
			this.drawCallGrid();
		}
		this.focus.setGroup('actions', this.actionButtons.map((button) => button.focusable));
	}

	/**
	 * Todos los cantos a la vista, sin submenús. Las respuestas sirven para el
	 * canto pendiente: primero el envido, que puede interrumpir un truco.
	 */
	private drawCallGrid() {
		const answeringEnvido = this.envidoAwaiting === 'player';
		const answeringTruco = !answeringEnvido && this.pendingTruco?.caller === 'ai';
		const answering = answeringEnvido || answeringTruco;
		this.addGridButton('want', 0, 0, i18n.t('truco.envido.want'), answering, () => {
			if (answeringEnvido) this.acceptEnvido();
			else this.respondToTruco(true);
		}, 'truco.keys.want');
		this.addGridButton('dontWant', 1, 0, i18n.t('truco.envido.dontWant'), answering, () => {
			if (!answeringEnvido) {
				this.respondToTruco(false);
				return;
			}
			this.addDialogue('player', i18n.t('truco.envido.dontWant'));
			this.rejectEnvido('player');
		}, 'truco.keys.dontWant');

		// Al responder sólo se puede subir; al abrir, cualquier canto vale.
		const envidoAllowed = answeringEnvido ? getEnvidoRaises(this.envidoChain) : this.canCallEnvido() ? getEnvidoRaises([]) : [];
		ENVIDO_BUTTONS.forEach(({ call, label, hotkey }, index) => {
			this.addGridButton(call, 0, index + 1, i18n.t(label), envidoAllowed.includes(call), () => this.callEnvido(call), hotkey);
		});

		// Un solo botón de truco: siempre el canto siguiente al vigente o al pendiente.
		const baseValue = answeringTruco ? this.pendingTruco!.value : this.trucoValue;
		const nextValue = Math.min(4, baseValue + 1) as Exclude<TrucoValue, 1>;
		const canRaise = answeringTruco ? baseValue < 4 : !answeringEnvido && this.canUseTrucoActions();
		this.addGridButton('truco', 1, 1, this.getTrucoLabel(nextValue), canRaise, () => {
			if (answeringTruco) this.respondToTruco(true, nextValue);
			else this.offerTruco('player', nextValue);
		}, 'truco.keys.truco');
	}

	private addGridButton(name: string, column: 0 | 1, row: number, label: string, enabled: boolean, onClick: () => void, hotkey?: TranslationKey) {
		return this.addActionButton(name, GRID_COLUMN_X[column], GRID_ROW_Y[row], GRID_COLUMN_WIDTH, GRID_BUTTON_HEIGHT, label, enabled, onClick, hotkey);
	}

	private addActionButton(name: string, x: number, y: number, width: number, height: number, label: string, enabled: boolean, onClick: () => void, hotkey?: TranslationKey) {
		const id = `action:${name}`;
		const button = new ActionButton(this, {
			id,
			x,
			y,
			width,
			height,
			label,
			enabled,
			onClick,
			onHover: () => this.focus.focus(id),
			hotkey: hotkey && i18n.t(hotkey),
		});
		this.actionButtons.push(button);
		return button;
	}

	private drawEnvidoPointsInput() {
		const top = GRID_ROW_Y[0] - GRID_BUTTON_HEIGHT / 2;
		const height = GRID_ROW_Y[3] - GRID_BUTTON_HEIGHT / 2 - 10 - top;
		const panel = this.add.graphics();
		panel.fillStyle(0x2b2115, 1);
		panel.fillRoundedRect(ACTIONS_LEFT, top, ACTIONS_WIDTH, height, 5);
		panel.lineStyle(2, 0xf2b84b, 1);
		panel.strokeRoundedRect(ACTIONS_LEFT, top, ACTIONS_WIDTH, height, 5);
		const title = this.add.text(ACTIONS_CENTER_X, top + 18, i18n.t('truco.envido.pointsTitle'), {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: '14px',
			color: '#f2b84b',
		}).setOrigin(0.5);
		const points = this.add.text(ACTIONS_CENTER_X, top + 54, this.pendingEnvidoPoints || '—', {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: '30px',
			color: '#fff4d6',
		}).setOrigin(0.5);
		const hint = this.add.text(ACTIONS_CENTER_X, top + height - 24, i18n.t('truco.envido.pointsHint'), {
			fontFamily: 'Courier New, monospace',
			fontSize: '11px',
			color: '#cdb88f',
			align: 'center',
			lineSpacing: 6,
		}).setOrigin(0.5);
		this.actionObjects.push(panel, title, points, hint);
		// Si la IA ya quiso no hay vuelta atrás: sólo queda declarar.
		if (this.envidoAwaiting === 'player') {
			this.addActionButton('back', ACTIONS_CENTER_X, GRID_ROW_Y[3], ACTIONS_WIDTH, GRID_BUTTON_HEIGHT, i18n.t('truco.actions.back'), true, () => this.cancelEnvidoDeclaration());
		}
		// Si la IA ya dijo su tanto, se puede perder sin mostrar el propio.
		if (this.aiDeclaredEnvido !== null) {
			this.addActionButton('goodOnes', ACTIONS_CENTER_X, GRID_ROW_Y[3], ACTIONS_WIDTH, GRID_BUTTON_HEIGHT, i18n.t('truco.envido.goodOnes'), true, () => this.concedeEnvido(), 'truco.keys.goodOnes');
		}
	}

	private canCallEnvido() {
		return !this.matchFinished
			&& !this.awaitingNextHand
			&& !this.envidoResolved
			&& this.envidoChain.length === 0
			// La única excepción: el rival cantó Truco y todavía no fue respondido.
			&& this.trucoValue === 1
			&& (!this.pendingTruco || this.pendingTruco.caller === 'ai')
			&& this.playedTricks.length === 0
			&& this.playerHand.length === CARDS_PER_HAND
			&& this.currentTrickCards.length <= 1;
	}

	private canUseTrucoActions() {
		return !this.matchFinished
			&& !this.awaitingNextHand
			&& this.envidoChain.length === 0
			&& (this.pendingTruco?.caller === 'ai' || (!this.pendingTruco && this.canOfferTruco('player')));
	}

	/** La IA sólo canta envido antes de su primera carta y con el truco sin cantar. */
	private canAiCallEnvido() {
		return !this.matchFinished
			&& !this.awaitingNextHand
			&& !this.envidoResolved
			&& this.envidoChain.length === 0
			&& !this.pendingTruco
			&& this.trucoValue === 1
			&& this.playedTricks.length === 0
			&& this.aiHand.length === CARDS_PER_HAND;
	}

	/** Un canto pendiente se responde antes de seguir jugando. */
	private canPlayCard() {
		return this.playerTurn && !this.pendingTruco && this.envidoChain.length === 0;
	}

	private canOfferTruco(player: Player) {
		return this.trucoValue < 4 && (this.trucoValue === 1 || this.lastTrucoCaller !== player);
	}

	private getNextTrucoValue(): Exclude<TrucoValue, 1> {
		return (this.trucoValue + 1) as Exclude<TrucoValue, 1>;
	}

	private getTrucoLabel(value: Exclude<TrucoValue, 1>) {
		if (value === 2) return i18n.t('truco.truco.call');
		if (value === 3) return i18n.t('truco.truco.retruco');
		return i18n.t('truco.truco.valeFour');
	}

	/** En el orden en que se jugaron: si se mueven juntas, la respuesta sale después. */
	private drawTrickCards(cards: PlayedCard[], centerX: number) {
		cards.forEach(({ card, owner, outcome }) => this.tableCards.place(card, {
			x: centerX,
			y: owner === 'ai' ? TABLE_ROW_Y.aiTrick : TABLE_ROW_Y.playerTrick,
			faceUp: true,
			highlight: outcome ?? 'none',
			staggerMove: true,
		}));
	}

	private playPlayerCard(index: number) {
		if (!this.canPlayCard() || this.waitingForNext || !this.playerHand[index]) return;
		this.playerCard = this.playerHand.splice(index, 1)[0];
		this.currentTrickCards.push({ card: this.playerCard, owner: 'player' });
		audioManager.playSfx(this, TRUCO_AUDIO.cardPlay.cacheKey);
		this.playerTurn = false;
		if (!this.aiCard) this.aiPlayResponse();
		else this.resolveTrick();
	}

	private aiLeadTrick() {
		if (this.maybeAiCallEnvido(() => this.aiLeadTrick())) return;
		if (this.maybeAiOfferTruco(() => this.aiLeadTrick())) return;
		this.aiCard = this.takeAiCard();
		if (this.aiCard) {
			this.currentTrickCards.push({ card: this.aiCard, owner: 'ai' });
			audioManager.playSfx(this, TRUCO_AUDIO.cardPlay.cacheKey);
		}
		this.playerTurn = true;
		this.renderState();
	}

	private aiPlayResponse() {
		if (this.maybeAiCallEnvido(() => this.aiPlayResponse())) return;
		if (this.maybeAiOfferTruco(() => this.aiPlayResponse())) return;
		this.aiCard = this.takeAiCard();
		if (!this.aiCard) return;
		this.currentTrickCards.push({ card: this.aiCard, owner: 'ai' });
		audioManager.playSfx(this, TRUCO_AUDIO.cardPlay.cacheKey);
		this.resolveTrick();
	}

	/** El perfil propone; la partida valida y consume la carta. */
	private takeAiCard() {
		const proposedCard = this.aiProfile.decideCard(this.buildAiView());
		if (!proposedCard) return null;

		const cardIndex = this.aiHand.findIndex((card) => card.id === proposedCard.id);
		return cardIndex === -1 ? null : this.aiHand.splice(cardIndex, 1)[0];
	}

	/**
	 * Lo que la IA puede ver de la mesa. Se arma en cada decisión porque la
	 * mano y las bazas cambian; las cartas ocultas del jugador nunca entran.
	 */
	private buildAiView(): AiTableView {
		const cardOf = (cards: PlayedCard[], owner: Player) => cards.find((played) => played.owner === owner)?.card ?? null;
		return {
			hand: this.aiHand,
			ownCard: cardOf(this.currentTrickCards, 'ai'),
			opponentCard: cardOf(this.currentTrickCards, 'player'),
			playedTricks: this.playedTricks.map((trick, index) => ({
				ai: cardOf(trick, 'ai')!,
				player: cardOf(trick, 'player')!,
				winner: this.trickWinners[index],
			})),
			isMano: !this.playerIsMano,
			trucoValue: this.trucoValue,
			envidoPoints: this.aiEnvidoPoints,
			opponentEnvido: this.playerEnvidoClue,
			score: { own: this.aiScore, opponent: this.playerScore },
			random: Math.random,
		};
	}

	private maybeAiCallEnvido(resume: () => void) {
		if (!this.canAiCallEnvido()) return false;
		const call = this.aiProfile.decideCallEnvido(this.buildAiView());
		if (!call) return false;
		this.envidoResume = resume;
		this.singEnvido('ai', call);
		return true;
	}

	private maybeAiOfferTruco(resume: () => void) {
		if (!this.canOfferTruco('ai')) return false;
		const value = this.getNextTrucoValue();
		if (!this.aiProfile.decideCallTruco({ ...this.buildAiView(), value })) return false;
		this.openTrucoOffer('ai', value, resume);
		return true;
	}

	private offerTruco(caller: Player, value: Exclude<TrucoValue, 1>, resume?: () => void) {
		this.openTrucoOffer(caller, value, resume);
		if (caller !== 'player') return;

		const response = this.aiProfile.decideTruco({ ...this.buildAiView(), value });
		if (response === 'reject') {
			this.addDialogue('ai', i18n.t('truco.truco.dontWant'));
			this.pendingTruco = undefined;
			this.finishHand('player', value - 1);
			return;
		}

		const pendingResume = this.pendingTruco?.resume;
		if (response === 'raise' && value < 4) {
			// Subir es aceptar y cantar el siguiente: ahora responde el jugador.
			this.acceptTrucoOffer();
			this.openTrucoOffer('ai', (value + 1) as TrucoBet, pendingResume);
			return;
		}

		this.addDialogue('ai', i18n.t('truco.truco.want'));
		this.acceptTrucoOffer();
		pendingResume?.();
	}

	private openTrucoOffer(caller: Player, value: Exclude<TrucoValue, 1>, resume?: () => void) {
		this.pendingTruco = { caller, value, resume };
		this.addDialogue(caller, this.getTrucoLabel(value));
		// También las cartas: si la IA canta al responder, la del jugador ya está
		// en la mesa, y la mano queda bloqueada hasta contestar.
		this.renderState();
	}

	private respondToTruco(wants: boolean, raiseTo?: Exclude<TrucoValue, 1>) {
		const offer = this.pendingTruco;
		if (!offer || offer.caller !== 'ai') return;

		if (!wants) {
			this.addDialogue('player', i18n.t('truco.truco.dontWant'));
			this.pendingTruco = undefined;
			this.finishHand('ai', offer.value - 1);
			return;
		}

		if (!raiseTo) this.addDialogue('player', i18n.t('truco.truco.want'));
		const resume = offer.resume;
		this.acceptTrucoOffer();
		if (raiseTo) {
			this.offerTruco('player', raiseTo, resume);
			return;
		}
		resume?.();
	}

	private acceptTrucoOffer() {
		const offer = this.pendingTruco;
		if (!offer) return;
		this.trucoValue = offer.value;
		this.lastTrucoCaller = offer.caller;
		this.pendingTruco = undefined;
		// Las cartas dependen del canto pendiente: se vuelven a dibujar junto con las acciones.
		this.renderState();
	}

	/** Abre el envido o sube el que cantó la IA. */
	private callEnvido(call: EnvidoCall) {
		const answering = this.envidoAwaiting === 'player';
		if (answering ? !getEnvidoRaises(this.envidoChain).includes(call) : !this.canCallEnvido()) return;
		this.singEnvido('player', call);
	}

	/**
	 * Suma un canto a la cadena y le pasa la respuesta al otro. Cantar sobre
	 * un canto equivale a quererlo y subir la apuesta.
	 */
	private singEnvido(caller: Player, call: EnvidoCall) {
		this.envidoChain = [...this.envidoChain, call];
		this.addDialogue(caller, this.getEnvidoLabel(call));
		if (caller === 'ai') {
			this.envidoAwaiting = 'player';
			this.renderState();
			return;
		}

		this.envidoAwaiting = 'ai';
		const raises = getEnvidoRaises(this.envidoChain);
		const response = this.aiProfile.decideEnvido({ ...this.buildAiView(), call, chain: this.envidoChain, raises });
		if (response === 'reject') {
			this.addDialogue('ai', i18n.t('truco.envido.dontWant'));
			this.rejectEnvido('ai');
			return;
		}
		if (response !== 'accept' && raises.includes(response)) {
			this.singEnvido('ai', response);
			return;
		}
		this.addDialogue('ai', i18n.t('truco.envido.want'));
		this.envidoAwaiting = null;
		this.beginEnvidoDeclarations();
	}

	/**
	 * El jugador quiere el canto de la IA. Siendo mano, el "quiero" se anota
	 * al declarar y hasta entonces puede volver atrás; si no, la IA dice su
	 * tanto enseguida.
	 */
	private acceptEnvido() {
		if (this.envidoAwaiting !== 'player') return;
		if (this.playerIsMano) {
			this.startEnvidoDeclaration();
			return;
		}
		this.addDialogue('player', i18n.t('truco.envido.want'));
		this.envidoAwaiting = null;
		this.beginEnvidoDeclarations();
	}

	/**
	 * Querido el envido, la mano dice su tanto primero; el otro lo escucha y
	 * puede contestar con el suyo o con "son buenas", sin mostrarlo.
	 */
	private beginEnvidoDeclarations() {
		if (!this.playerIsMano) {
			const declaration = this.aiProfile.decideDeclareEnvido({ ...this.buildAiView(), rivalPoints: null });
			this.aiDeclaredEnvido = declaration === 'concede' ? this.aiEnvidoPoints : declaration;
			this.addDialogue('ai', this.aiDeclaredEnvido.toString());
		}
		this.startEnvidoDeclaration();
	}

	private startEnvidoDeclaration() {
		this.declaringEnvido = true;
		this.pendingEnvidoPoints = '';
		this.renderState();
	}

	/** Quien no quiere le entrega al otro lo que ya estaba aceptado. */
	private rejectEnvido(rejecter: Player) {
		const winner: Player = rejecter === 'player' ? 'ai' : 'player';
		const points = getEnvidoRejectedPoints(this.envidoChain);
		const message = rejecter === 'player' ? i18n.t('truco.envido.youNotWanted') : `${this.aiName} ${i18n.t('truco.envido.notWanted')}`;
		this.closeEnvido(winner, points, `${message} · +${points}`);
	}

	/** Cierra la cadena y, si la IA cantó, sigue con la jugada que dejó en suspenso. */
	private closeEnvido(winner: Player, points: number, result: string) {
		const resume = this.envidoResume;
		this.envidoChain = [];
		this.envidoAwaiting = null;
		this.envidoResume = undefined;
		this.declaringEnvido = false;
		this.pendingEnvidoPoints = '';
		this.resolveEnvido(winner, points, result);
		if (resume && !this.matchFinished) resume();
	}

	private getEnvidoLabel(call: EnvidoCall) {
		if (call === 'envido') return i18n.t('truco.envido.call');
		if (call === 'realEnvido') return i18n.t('truco.envido.realCall');
		return i18n.t('truco.envido.faltaCall');
	}

	/**
	 * Flechas para mover el foco, las teclas de las cartas para ir directo a una,
	 * Enter o Espacio para activar lo que tiene foco y una letra por canto.
	 * Mientras se declaran los tantos, el teclado es del cuadro de puntos.
	 */
	private handleKeyDown(event: KeyboardEvent) {
		if (this.declaringEnvido) {
			this.handleEnvidoInput(event);
			return;
		}
		const direction = ARROW_DIRECTIONS[event.key];
		if (direction) {
			this.focus.move(direction);
			return;
		}
		if (event.key === 'Enter' || event.key === ' ') {
			this.focus.activate();
			return;
		}
		const key = event.key.toLowerCase();
		const cardIndex = this.cardKeys.indexOf(key);
		if (cardIndex !== -1) {
			const card = this.playerHand[cardIndex];
			if (card) this.focus.focus(cardFocusId(card));
			return;
		}
		this.actionButtons.find((button) => button.hotkey === key)?.focusable.activate();
	}

	private handleEnvidoInput(event: KeyboardEvent) {
		if (!this.declaringEnvido) return;

		if (/^\d$/.test(event.key) && this.pendingEnvidoPoints.length < 2) {
			this.pendingEnvidoPoints += event.key;
			this.renderActions();
			return;
		}

		if (event.key === 'Backspace') {
			this.pendingEnvidoPoints = this.pendingEnvidoPoints.slice(0, -1);
			this.renderActions();
			return;
		}

		if (event.key === 'Enter') {
			this.submitEnvidoDeclaration();
			return;
		}

		this.actionButtons.find((button) => button.hotkey === event.key.toLowerCase())?.focusable.activate();
	}

	/**
	 * El jugador dice un número, cierto o no: el juego todavía no le pide
	 * mostrar las cartas. Si es mano, después contesta la IA.
	 */
	private submitEnvidoDeclaration() {
		const declaredPoints = Number(this.pendingEnvidoPoints);
		if (!this.declaringEnvido) return;
		if (this.pendingEnvidoPoints === '' || !Number.isInteger(declaredPoints) || declaredPoints < 0 || declaredPoints > 33) {
			this.addDialogue(null, i18n.t('truco.envido.invalidPoints'));
			return;
		}

		// El "quiero" se anota recién al declarar: cancelar el cuadro no deja rastro.
		if (this.envidoAwaiting === 'player') {
			this.addDialogue('player', i18n.t('truco.envido.want'));
			this.envidoAwaiting = null;
		}
		this.addDialogue('player', declaredPoints.toString());

		if (this.aiDeclaredEnvido === null) {
			const answer = this.aiProfile.decideDeclareEnvido({ ...this.buildAiView(), rivalPoints: declaredPoints });
			if (answer === 'concede') {
				this.addDialogue('ai', i18n.t('truco.envido.goodOnes'));
				this.playerEnvidoClue = { kind: 'declared', points: declaredPoints, won: true };
				this.settleEnvido('player');
				return;
			}
			this.aiDeclaredEnvido = answer;
			this.addDialogue('ai', answer.toString());
		}

		// Los empates los gana la mano.
		const playerWins = declaredPoints === this.aiDeclaredEnvido ? this.playerIsMano : declaredPoints > this.aiDeclaredEnvido;
		this.playerEnvidoClue = { kind: 'declared', points: declaredPoints, won: playerWins };
		this.settleEnvido(playerWins ? 'player' : 'ai');
	}

	/** "Son buenas": pierde el envido sin decir su tanto. Sólo vale después del de la IA. */
	private concedeEnvido() {
		if (!this.declaringEnvido || this.aiDeclaredEnvido === null) return;
		this.addDialogue('player', i18n.t('truco.envido.goodOnes'));
		this.playerEnvidoClue = { kind: 'conceded', atMost: this.aiDeclaredEnvido };
		this.settleEnvido('ai');
	}

	private settleEnvido(winner: Player) {
		const points = getEnvidoAcceptedPoints(this.envidoChain, winner === 'player' ? this.playerScore : this.aiScore);
		const message = winner === 'player' ? i18n.t('truco.envido.youWon') : `${this.aiName} ${i18n.t('truco.envido.won')}`;
		this.closeEnvido(winner, points, `${message} · +${points}`);
	}

	/** Sólo se vuelve atrás si el "quiero" fue del jugador: regresa a la respuesta. */
	private cancelEnvidoDeclaration() {
		if (this.envidoAwaiting !== 'player') return;
		this.declaringEnvido = false;
		this.pendingEnvidoPoints = '';
		this.renderActions();
	}

	private updateNextHandProgress() {
		if (!this.awaitingNextHand || !this.nextHandButton) return;
		const elapsed = NEXT_HAND_DELAY_MS - Math.max(0, this.nextHandReadyAt - this.time.now);
		this.nextHandButton.setProgress(Phaser.Math.Clamp(elapsed / NEXT_HAND_DELAY_MS, 0, 1));
	}

	private advanceToNextHand() {
		if (!this.awaitingNextHand) return;
		this.nextHandTimer?.remove(false);
		this.nextHandTimer = undefined;
		this.awaitingNextHand = false;
		this.playerIsMano = !this.playerIsMano;
		this.startHand();
	}

	private finishMatch() {
		this.awaitingNextHand = false;
		this.matchFinished = true;
		this.nextHandTimer?.remove(false);
		this.nextHandTimer = undefined;
		this.renderState();
	}

	private resolveEnvido(winner: Player, points: number, result: string) {
		if (winner === 'player') this.playerScore += points;
		if (winner === 'ai') this.aiScore += points;
		this.envidoResolved = true;
		this.renderState();
		this.addDialogue(null, result);

		if (this.playerScore >= TRUCO_TARGET_SCORE || this.aiScore >= TRUCO_TARGET_SCORE) {
			this.finishMatch();
		}
	}

	private addDialogue(speaker: CantosSpeaker, message: string) {
		this.cantosLog.add(speaker, message);
	}

	private resolveTrick() {
		if (!this.playerCard || !this.aiCard) return;
		const comparison = compareCards(this.playerCard, this.aiCard);
		const winner: Player | null = comparison === 0 ? null : comparison > 0 ? 'player' : 'ai';
		this.trickWinners.push(winner);
		if (winner) this.playerLeadsTrick = winner === 'player';
		this.playedTricks.push(this.currentTrickCards.map((playedCard) => ({
			...playedCard,
			outcome: winner === null ? 'tie' : playedCard.owner === winner ? 'won' : 'lost',
		})));
		this.currentTrickCards = [];
		this.playerTurn = false;
		this.waitingForNext = true;
		this.renderState();
		// La transición ocurre en el siguiente frame de Phaser, sin depender de
		// un botón ni de un timer que pueda dejar la escena detenida.
		this.continueRound();
	}

	private continueRound() {
		if (!this.waitingForNext) return;
		this.waitingForNext = false;
		const winner = resolveHandWinner(this.trickWinners, this.playerIsMano ? 'player' : 'ai');
		if (winner) {
			this.finishHand(winner);
			return;
		}
		this.playerCard = null;
		this.aiCard = null;
		this.playerTurn = this.playerLeadsTrick;
		this.renderState();
		if (!this.playerLeadsTrick) this.aiLeadTrick();
	}

	private finishHand(winner: Player, points: number = this.trucoValue) {
		if (winner === 'player') this.playerScore += points;
		if (winner === 'ai') this.aiScore += points;
		audioManager.playSfx(this, TRUCO_AUDIO.handResult.cacheKey);
		// En segunda persona: "VOS ganó" no suena a nadie hablando.
		const message = winner === 'player' ? i18n.t('truco.game.youWonHand') : `${this.aiName} ${i18n.t('truco.game.handWon')}`;
		this.addDialogue(null, `${message} · +${points}`);
		if (this.playerScore >= TRUCO_TARGET_SCORE || this.aiScore >= TRUCO_TARGET_SCORE) {
			this.finishMatch();
			return;
		}

		this.waitingForNext = true;
		this.awaitingNextHand = true;
		this.nextHandReadyAt = this.time.now + NEXT_HAND_DELAY_MS;
		this.renderState();

		// Conservamos el resultado y las cartas sobre la mesa antes de repartir de nuevo.
		this.nextHandTimer = this.time.delayedCall(NEXT_HAND_DELAY_MS, () => this.advanceToNextHand());
	}
}
