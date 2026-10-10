import Phaser from 'phaser';
import { audioManager } from '../../../core/audio/AudioManager';
import { i18n } from '../../../core/i18n/i18n';
import { CORE_SCENES } from '../../../core/sceneKeys';
import { getTrucoAiChoice, resolveTrucoAi } from '../ai/aiSelection';
import type { AiTableView, TrucoAiProfile, TrucoBet } from '../ai/types';
import { loadTrucoAudio, TRUCO_AUDIO } from '../audio';
import { calculateEnvido, CARDS_PER_HAND, compareCards, createDeck, getEnvidoAcceptedPoints, getEnvidoRaises, getEnvidoRejectedPoints, resolveHandWinner, shuffleDeck, TRUCO_GOOD_SCORE, TRUCO_TARGET_SCORE } from '../rules';
import type { Card, EnvidoCall, TrickWinner } from '../rules';
import { TRUCO_SCENES } from '../sceneKeys';

type Player = 'player' | 'ai';
type TrucoValue = 1 | 2 | 3 | 4;
type CardOutcome = 'won' | 'lost' | 'tie';
type PlayedCard = { card: Card; owner: Player; outcome?: CardOutcome };
type PendingTruco = { caller: Player; value: Exclude<TrucoValue, 1>; resume?: () => void };

const TABLE_CARD_X = [330, 400, 470] as const;
const TABLE_CARD_WIDTH = 58;
const TABLE_CARD_HEIGHT = 82;
const LOG_MAX_ENTRIES = 12;
const LOG_MAX_CHARACTERS = 31;
const NEXT_HAND_DELAY_MS = 3000;

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
	private playerScoreText!: Phaser.GameObjects.Text;
	private aiScoreText!: Phaser.GameObjects.Text;
	private playerScoreUnderline!: Phaser.GameObjects.Rectangle;
	private aiScoreUnderline!: Phaser.GameObjects.Rectangle;
	private dialogueText!: Phaser.GameObjects.Text;
	private escapeKey!: Phaser.Input.Keyboard.Key;
	private cardObjects: Phaser.GameObjects.GameObject[] = [];
	private actionObjects: Phaser.GameObjects.GameObject[] = [];
	private envidoResolved = false;
	private showingEnvidoActions = false;
	/** Cantos de envido de esta mano, en orden; vacía mientras nadie cantó. */
	private envidoChain: EnvidoCall[] = [];
	/** Quién tiene que responder el último canto; `null` si ya se quiso. */
	private envidoAwaiting: Player | null = null;
	/** Jugada de la IA que quedó en suspenso cuando ella cantó el envido. */
	private envidoResume?: () => void;
	private declaringEnvido = false;
	private pendingEnvidoPoints = '';
	private dialogueEntries: string[] = [];
	private trucoValue: TrucoValue = 1;
	private lastTrucoCaller: Player | null = null;
	private pendingTruco?: PendingTruco;
	private showingTrucoActions = false;
	private awaitingNextHand = false;
	private matchFinished = false;
	private nextHandTimer?: Phaser.Time.TimerEvent;
	private nextHandReadyAt = 0;
	private nextHandProgress?: Phaser.GameObjects.Rectangle;
	private aiProfile!: TrucoAiProfile;
	/** Nombre visible del rival; con el sorteo es genérico para no delatarlo. */
	private aiName = '';
	private aiEnvidoPoints = 0;

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
		keyboard.on('keydown', this.handleEnvidoInput, this);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => keyboard.off('keydown', this.handleEnvidoInput, this));
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
		this.showingEnvidoActions = false;
		this.envidoChain = [];
		this.envidoAwaiting = null;
		this.envidoResume = undefined;
		this.declaringEnvido = false;
		this.pendingEnvidoPoints = '';
		this.trucoValue = 1;
		this.lastTrucoCaller = null;
		this.pendingTruco = undefined;
		this.showingTrucoActions = false;
		this.dialogueEntries = [];
		this.dialogueText.setText('');
		// La mano abre el primer turno; los siguientes los abre quien ganó el turno previo.
		this.playerLeadsTrick = this.playerIsMano;
		this.playerTurn = this.playerLeadsTrick;
		this.renderState();
		if (!this.playerLeadsTrick) this.aiLeadTrick();
	}

	private drawStaticUi() {
		this.cameras.main.setBackgroundColor('#17120d');
		this.add.text(38, 30, i18n.t('truco.game.title'), { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '30px', color: '#fff4d6' });
		const scoreStyle = { fontFamily: '"Segoe UI Emoji", "Courier New", monospace', fontSize: '18px', color: '#f2b84b' };
		this.playerScoreText = this.add.text(440, 38, '', scoreStyle);
		// Alineado a la derecha: el nombre del rival cambia de largo según el perfil.
		this.aiScoreText = this.add.text(762, 38, '', scoreStyle).setOrigin(1, 0);
		this.playerScoreUnderline = this.add.rectangle(520, 62, 0, 2, 0xf2b84b).setOrigin(0, 0).setVisible(false);
		this.aiScoreUnderline = this.add.rectangle(665, 62, 0, 2, 0xf2b84b).setOrigin(0, 0).setVisible(false);
		this.add.rectangle(138, 245, 222, 250, 0x241a11).setStrokeStyle(1, 0x6a512d);
		this.add.text(38, 124, i18n.t('truco.envido.logTitle'), { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '13px', color: '#d8a542' });
		this.dialogueText = this.add.text(38, 150, '', { fontFamily: 'Courier New, monospace', fontSize: '10px', color: '#fff4d6', lineSpacing: 5 });
	}

	private renderState() {
		const playerMano = this.playerIsMano ? '✋ ' : '';
		const aiMano = this.playerIsMano ? '' : '✋ ';
		this.playerScoreText.setText(`${playerMano}${i18n.t('truco.game.you')}: ${this.playerScore}`);
		this.aiScoreText.setText(`${aiMano}${this.aiName}: ${this.aiScore}`);
		this.updateScoreUnderline(this.playerScoreText, this.playerScoreUnderline, this.playerScore >= TRUCO_GOOD_SCORE);
		this.updateScoreUnderline(this.aiScoreText, this.aiScoreUnderline, this.aiScore >= TRUCO_GOOD_SCORE);
		this.renderCards();
		this.renderActions();
	}

	private updateScoreUnderline(text: Phaser.GameObjects.Text, underline: Phaser.GameObjects.Rectangle, visible: boolean) {
		underline.setPosition(text.getTopLeft().x, text.y + text.height + 1).setSize(text.width, 2).setVisible(visible);
	}

	private renderCards() {
		this.cardObjects.forEach((object) => object.destroy());
		this.cardObjects = [];
		this.aiHand.forEach((_card, index) => this.drawCardBack(TABLE_CARD_X[index], 125, TABLE_CARD_WIDTH, TABLE_CARD_HEIGHT));
		this.playedTricks.forEach((trick, trickIndex) => this.drawTrickCards(trick, TABLE_CARD_X[trickIndex]));
		if (this.currentTrickCards.length > 0) this.drawTrickCards(this.currentTrickCards, TABLE_CARD_X[this.playedTricks.length]);
		this.playerHand.forEach((card, index) => {
			this.drawCard(TABLE_CARD_X[index], 525, card, TABLE_CARD_WIDTH, TABLE_CARD_HEIGHT, this.canPlayCard(), () => this.playPlayerCard(index));
		});
	}

	private renderActions() {
		this.actionObjects.forEach((object) => object.destroy());
		this.actionObjects = [];
		this.nextHandProgress = undefined;
		const canCallEnvido = this.canCallEnvido();

		if (this.matchFinished) {
			// El menú del Truco es donde se elige el próximo rival.
			this.drawActionButton(i18n.t('truco.actions.menu'), 465, true, () => this.scene.start(TRUCO_SCENES.TITLE));
			this.drawActionButton(i18n.t('truco.actions.retry'), 525, true, () => this.scene.restart());
			return;
		}

		if (this.awaitingNextHand) {
			this.drawNextHandButton();
			return;
		}

		if (this.showingTrucoActions && this.canUseTrucoActions()) {
			this.drawTrucoActions();
			return;
		}

		if (this.declaringEnvido) {
			this.drawEnvidoPointsInput();
			return;
		}

		const answeringEnvido = this.envidoAwaiting === 'player';
		if (this.showingEnvidoActions && (answeringEnvido || canCallEnvido)) {
			// Al responder sólo se puede subir; al abrir, cualquier canto vale.
			const allowed = getEnvidoRaises(this.envidoChain);
			this.drawActionButton(i18n.t('truco.envido.call'), 400, allowed.includes('envido'), () => this.callEnvido('envido'));
			this.drawActionButton(i18n.t('truco.envido.realCall'), 445, allowed.includes('realEnvido'), () => this.callEnvido('realEnvido'));
			this.drawActionButton(i18n.t('truco.envido.faltaCall'), 490, allowed.includes('faltaEnvido'), () => this.callEnvido('faltaEnvido'));
			this.drawActionButton(i18n.t('truco.actions.back'), 535, true, () => {
				this.showingEnvidoActions = false;
				this.renderActions();
			});
			return;
		}

		if (answeringEnvido) {
			this.drawActionButton(i18n.t('truco.envido.want'), 400, true, () => this.acceptEnvido());
			this.drawActionButton(i18n.t('truco.envido.dontWant'), 445, true, () => {
				this.addDialogue('player', i18n.t('truco.envido.dontWant'));
				this.rejectEnvido('player');
			});
			this.drawActionButton(i18n.t('truco.envido.firstAction'), 490, getEnvidoRaises(this.envidoChain).length > 0, () => {
				this.showingEnvidoActions = true;
				this.renderActions();
			});
			return;
		}

		this.drawActionButton(i18n.t('truco.envido.firstAction'), 465, canCallEnvido, () => {
			this.showingEnvidoActions = true;
			this.renderActions();
		});
		this.drawActionButton(i18n.t('truco.envido.secondAction'), 525, this.canUseTrucoActions(), () => {
			this.showingTrucoActions = true;
			this.renderActions();
		});
	}

	private drawEnvidoPointsInput() {
		const surface = this.add.rectangle(106, 470, 150, 174, 0x2b2115).setStrokeStyle(2, 0xf2b84b);
		const title = this.add.text(106, 407, i18n.t('truco.envido.pointsTitle'), {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: '14px',
			color: '#f2b84b',
		}).setOrigin(0.5);
		const points = this.add.text(106, 444, this.pendingEnvidoPoints || '—', {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: '30px',
			color: '#fff4d6',
		}).setOrigin(0.5);
		const hint = this.add.text(106, 492, i18n.t('truco.envido.pointsHint'), {
			fontFamily: 'Courier New, monospace',
			fontSize: '11px',
			color: '#cdb88f',
			align: 'center',
			lineSpacing: 6,
		}).setOrigin(0.5);
		this.actionObjects.push(surface, title, points, hint);
		// Si la IA ya quiso no hay vuelta atrás: sólo queda declarar.
		if (this.envidoAwaiting === 'player') {
			this.drawActionButton(i18n.t('truco.actions.back'), 535, true, () => this.cancelEnvidoDeclaration());
		}
	}

	private drawTrucoActions() {
		if (this.pendingTruco?.caller === 'ai') {
			this.drawActionButton(i18n.t('truco.truco.want'), 400, true, () => this.respondToTruco(true));
			this.drawActionButton(i18n.t('truco.truco.dontWant'), 445, true, () => this.respondToTruco(false));
			if (this.pendingTruco.value === 2) {
				this.drawActionButton(i18n.t('truco.truco.wantRetruco'), 490, true, () => this.respondToTruco(true, 3));
			} else if (this.pendingTruco.value === 3) {
				this.drawActionButton(i18n.t('truco.truco.wantValeFour'), 490, true, () => this.respondToTruco(true, 4));
			}
		} else {
			const value = this.getNextTrucoValue();
			this.drawActionButton(this.getTrucoLabel(value), 465, true, () => this.offerTruco('player', value));
		}

		this.drawActionButton(i18n.t('truco.actions.back'), 535, true, () => {
			this.showingTrucoActions = false;
			this.renderActions();
		});
	}

	private drawNextHandButton() {
		const x = 106;
		const y = 495;
		const width = 150;
		const height = 44;
		const surface = this.add.rectangle(x, y, width, height, 0x2b2115).setStrokeStyle(2, 0xf2b84b);
		const fill = this.add.rectangle(x - width / 2 + 2, y, width - 4, height - 4, 0x6a4d25)
			.setOrigin(0, 0.5)
			.setScale(0, 1);
		const text = this.add.text(x, y, i18n.t('truco.actions.next'), {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: '14px',
			color: '#fff4d6',
		}).setOrigin(0.5);
		this.nextHandProgress = fill;
		this.actionObjects.push(surface, fill, text);
		surface.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.advanceToNextHand());
		this.updateNextHandProgress();
	}

	private drawActionButton(label: string, y: number, enabled: boolean, onClick: () => void) {
		const surface = this.add.rectangle(106, y, 150, 44, enabled ? 0x50361b : 0x2b2115)
			.setStrokeStyle(2, enabled ? 0xf2b84b : 0x5f4a2c);
		const text = this.add.text(106, y, label, {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: '14px',
			color: enabled ? '#fff4d6' : '#806b4e',
		}).setOrigin(0.5);
		this.actionObjects.push(surface, text);
		if (enabled) surface.setInteractive({ useHandCursor: true }).on('pointerdown', onClick);
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

	private drawTrickCards(cards: PlayedCard[], centerX: number) {
		const aiPlayedCard = cards.find(({ owner }) => owner === 'ai');
		const playerPlayedCard = cards.find(({ owner }) => owner === 'player');
		if (aiPlayedCard) this.drawCard(centerX, 260, aiPlayedCard.card, TABLE_CARD_WIDTH, TABLE_CARD_HEIGHT, false, undefined, aiPlayedCard.outcome);
		if (playerPlayedCard) this.drawCard(centerX, 390, playerPlayedCard.card, TABLE_CARD_WIDTH, TABLE_CARD_HEIGHT, false, undefined, playerPlayedCard.outcome);
	}

	private drawCard(x: number, y: number, card: Card, width: number, height: number, interactive = false, onClick?: () => void, outcome?: CardOutcome) {
		const surface = this.add.rectangle(x, y, width, height, 0x2b2115)
			.setStrokeStyle(2, this.getCardBorderColor(interactive, outcome))
			.setInteractive(interactive ? { useHandCursor: true } : undefined);
		const value = this.add.text(x - width / 2 + 9, y - height / 2 + 7, card.value.toString(), {
			fontFamily: 'Georgia, serif',
			fontSize: width < 70 ? '12px' : '16px',
			color: '#fff4d6',
		}).setOrigin(0, 0);
		const suit = this.add.text(x, y + 4, this.suitIcon(card.suit), {
			fontFamily: '"Segoe UI Symbol", "Noto Sans Symbols", sans-serif',
			fontSize: width < 70 ? '25px' : '34px',
			color: '#fff4d6',
		}).setOrigin(0.5);
		this.cardObjects.push(surface, value, suit);
		if (onClick) surface.on('pointerdown', onClick);
	}

	private getCardBorderColor(interactive: boolean, outcome?: CardOutcome) {
		if (outcome === 'won') return 0x52d273;
		if (outcome === 'lost') return 0xd95858;
		return interactive ? 0xf2b84b : 0x8b6a38;
	}

	private drawCardBack(x: number, y: number, width: number, height: number) {
		const surface = this.add.rectangle(x, y, width, height, 0x43251d).setStrokeStyle(2, 0xc47d4b);
		const inner = this.add.rectangle(x, y, width - 10, height - 10, 0x6b3427).setStrokeStyle(1, 0xe0a064);
		const label = this.add.text(x, y, i18n.t('truco.game.cardBack'), { fontFamily: 'Courier New, monospace', fontSize: '9px', color: '#ffe5b5' }).setOrigin(0.5);
		this.cardObjects.push(surface, inner, label);
	}

	private suitIcon(suit: Card['suit']) {
		const icons: Record<Card['suit'], string> = {
			espadas: '⚔️',
			bastos: '🪵',
			oros: '🟡',
			copas: '🏆',
		};
		return icons[suit];
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
			this.showingTrucoActions = false;
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
		this.showingTrucoActions = false;
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
			this.showingTrucoActions = false;
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
		this.showingTrucoActions = false;
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
		this.showingEnvidoActions = false;
		this.showingTrucoActions = false;
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
		this.startEnvidoDeclaration();
	}

	/** El jugador quiere el canto de la IA; el "quiero" se anota al declarar. */
	private acceptEnvido() {
		if (this.envidoAwaiting !== 'player') return;
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
		const rejecterName = rejecter === 'player' ? i18n.t('truco.game.you') : this.aiName;
		this.closeEnvido(winner, points, `${rejecterName} ${i18n.t('truco.envido.notWanted')} · +${points}`);
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

		if (event.key === 'Enter') this.submitEnvidoDeclaration();
	}

	private submitEnvidoDeclaration() {
		const declaredPoints = Number(this.pendingEnvidoPoints);
		if (!this.declaringEnvido) return;
		if (this.pendingEnvidoPoints === '' || !Number.isInteger(declaredPoints) || declaredPoints < 0 || declaredPoints > 33) {
			this.addDialogue(null, i18n.t('truco.envido.invalidPoints'));
			return;
		}

		// El "quiero" se anota recién al declarar: cancelar el cuadro no deja rastro.
		if (this.envidoAwaiting === 'player') this.addDialogue('player', i18n.t('truco.envido.want'));
		this.addDialogue('player', declaredPoints.toString());

		// El tanto se calcula al repartir: si la IA ya jugó una carta, su mano no alcanza.
		const aiPoints = this.aiEnvidoPoints;
		this.addDialogue('ai', aiPoints.toString());
		const playerWins = declaredPoints === aiPoints
			? this.playerIsMano
			: declaredPoints > aiPoints;
		const winner: Player = playerWins ? 'player' : 'ai';
		const points = getEnvidoAcceptedPoints(this.envidoChain, winner === 'player' ? this.playerScore : this.aiScore);
		const winnerName = winner === 'player' ? i18n.t('truco.game.you') : this.aiName;
		this.closeEnvido(winner, points, `${winnerName} ${i18n.t('truco.envido.won')} · +${points}`);
	}

	/** Sólo se vuelve atrás si el "quiero" fue del jugador: regresa a la respuesta. */
	private cancelEnvidoDeclaration() {
		if (this.envidoAwaiting !== 'player') return;
		this.declaringEnvido = false;
		this.pendingEnvidoPoints = '';
		this.renderActions();
	}

	private updateNextHandProgress() {
		if (!this.awaitingNextHand || !this.nextHandProgress) return;
		const elapsed = NEXT_HAND_DELAY_MS - Math.max(0, this.nextHandReadyAt - this.time.now);
		this.nextHandProgress.setScale(Phaser.Math.Clamp(elapsed / NEXT_HAND_DELAY_MS, 0, 1), 1);
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
		this.showingEnvidoActions = false;
		this.renderState();
		this.addDialogue(null, result);

		if (this.playerScore >= TRUCO_TARGET_SCORE || this.aiScore >= TRUCO_TARGET_SCORE) {
			this.finishMatch();
		}
	}

	private addDialogue(speaker: Player | null, message: string) {
		const prefix = speaker === 'player' ? '👤 ' : speaker === 'ai' ? '🖥️ ' : '';
		const entry = `${prefix}${message}`;
		const compactEntry = entry.length > LOG_MAX_CHARACTERS ? `${entry.slice(0, LOG_MAX_CHARACTERS - 1)}…` : entry;
		this.dialogueEntries = [...this.dialogueEntries, compactEntry].slice(-LOG_MAX_ENTRIES);
		this.dialogueText.setText(this.dialogueEntries.join('\n'));
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
		const winnerName = winner === 'player' ? i18n.t('truco.game.you') : this.aiName;
		this.addDialogue(null, `${winnerName} ${i18n.t('truco.game.handWon')} · +${points}`);
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
