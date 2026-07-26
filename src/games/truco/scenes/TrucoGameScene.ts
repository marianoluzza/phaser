import Phaser from 'phaser';
import { audioManager } from '../../../core/audio/AudioManager';
import { i18n } from '../../../core/i18n/i18n';
import { CORE_SCENES } from '../../../core/sceneKeys';
import { loadTrucoAudio, TRUCO_AUDIO } from '../audio';
import { CARDS_PER_HAND, chooseAiResponse, compareCards, createDeck, shuffleDeck, TRUCO_TARGET_SCORE } from '../rules';
import type { Card } from '../rules';
import { TRUCO_SCENES } from '../sceneKeys';

type Player = 'player' | 'ai';
type CardOutcome = 'won' | 'lost' | 'tie';
type PlayedCard = { card: Card; owner: Player; outcome?: CardOutcome };

/** Partida de Truco v1: cartas, turnos y un punto por mano ganada. */
export class TrucoGameScene extends Phaser.Scene {
	private playerScore = 0;
	private aiScore = 0;
	private playerHand: Card[] = [];
	private aiHand: Card[] = [];
	private playerTricks = 0;
	private aiTricks = 0;
	private playerIsMano = true;
	private playerLeadsTrick = true;
	private playerCard: Card | null = null;
	private aiCard: Card | null = null;
	private currentTrickCards: PlayedCard[] = [];
	private playedTricks: PlayedCard[][] = [];
	private playerTurn = false;
	private waitingForNext = false;
	private scoreText!: Phaser.GameObjects.Text;
	private escapeKey!: Phaser.Input.Keyboard.Key;
	private cardObjects: Phaser.GameObjects.GameObject[] = [];

	constructor() {
		super(TRUCO_SCENES.GAME);
	}

	preload() {
		loadTrucoAudio(this);
	}

	create() {
		this.resetMatch();
		const keyboard = this.input.keyboard!;
		this.escapeKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
	}

	update() {
		if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
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
		this.drawStaticUi();
		this.startHand();
	}

	private startHand() {
		const deck = shuffleDeck(createDeck());
		this.playerHand = deck.slice(0, CARDS_PER_HAND);
		this.aiHand = deck.slice(CARDS_PER_HAND, CARDS_PER_HAND * 2);
		this.playerTricks = 0;
		this.aiTricks = 0;
		this.playerCard = null;
		this.aiCard = null;
		this.currentTrickCards = [];
		this.playedTricks = [];
		this.waitingForNext = false;
		// La mano abre el primer turno; los siguientes los abre quien ganó el turno previo.
		this.playerLeadsTrick = this.playerIsMano;
		this.playerTurn = this.playerLeadsTrick;
		this.renderState();
		if (!this.playerLeadsTrick) this.aiLeadTrick();
	}

	private drawStaticUi() {
		this.cameras.main.setBackgroundColor('#17120d');
		this.add.text(38, 30, i18n.t('truco.game.title'), { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '30px', color: '#fff4d6' });
		this.scoreText = this.add.text(762, 38, '', { fontFamily: '"Segoe UI Emoji", "Courier New", monospace', fontSize: '18px', color: '#f2b84b', align: 'right' }).setOrigin(1, 0);
	}

	private renderState() {
		const playerMano = this.playerIsMano ? '✋ ' : '';
		const aiMano = this.playerIsMano ? '' : '✋ ';
		this.scoreText.setText(`${playerMano}${i18n.t('truco.game.you')}: ${this.playerScore}    ${aiMano}${i18n.t('truco.game.ai')}: ${this.aiScore}`);
		this.renderCards();
	}

	private renderCards() {
		this.cardObjects.forEach((object) => object.destroy());
		this.cardObjects = [];
		this.aiHand.forEach((_card, index) => this.drawCardBack(330 + index * 70, 125, 58, 82));
		this.playedTricks.forEach((trick, trickIndex) => this.drawTrickCards(trick, 230 + trickIndex * 170));
		if (this.currentTrickCards.length > 0) this.drawTrickCards(this.currentTrickCards, 230 + this.playedTricks.length * 170);
		this.playerHand.forEach((card, index) => {
			const x = 230 + index * 170;
			this.drawCard(x, 540, card, 72, 92, this.playerTurn, () => this.playPlayerCard(index));
		});
	}

	private drawTrickCards(cards: PlayedCard[], centerX: number) {
		const aiPlayedCard = cards.find(({ owner }) => owner === 'ai');
		const playerPlayedCard = cards.find(({ owner }) => owner === 'player');
		if (aiPlayedCard) this.drawCard(centerX, 220, aiPlayedCard.card, 72, 92, false, undefined, aiPlayedCard.outcome);
		if (playerPlayedCard) this.drawCard(centerX, 325, playerPlayedCard.card, 72, 92, false, undefined, playerPlayedCard.outcome);
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
		if (!this.playerTurn || this.waitingForNext || !this.playerHand[index]) return;
		this.playerCard = this.playerHand.splice(index, 1)[0];
		this.currentTrickCards.push({ card: this.playerCard, owner: 'player' });
		audioManager.playSfx(this, TRUCO_AUDIO.cardPlay.cacheKey);
		this.playerTurn = false;
		if (!this.aiCard) this.aiPlayResponse();
		else this.resolveTrick();
	}

	private aiLeadTrick() {
		this.aiCard = this.aiHand.shift() ?? null;
		if (this.aiCard) {
			this.currentTrickCards.push({ card: this.aiCard, owner: 'ai' });
			audioManager.playSfx(this, TRUCO_AUDIO.cardPlay.cacheKey);
		}
		this.playerTurn = true;
		this.renderState();
	}

	private aiPlayResponse() {
		const response = chooseAiResponse(this.aiHand);
		this.aiHand = this.aiHand.filter((card) => card.id !== response.id);
		this.aiCard = response;
		this.currentTrickCards.push({ card: response, owner: 'ai' });
		audioManager.playSfx(this, TRUCO_AUDIO.cardPlay.cacheKey);
		this.resolveTrick();
	}

	private resolveTrick() {
		if (!this.playerCard || !this.aiCard) return;
		const comparison = compareCards(this.playerCard, this.aiCard);
		const winner: Player | null = comparison === 0 ? null : comparison > 0 ? 'player' : 'ai';
		if (winner === 'player') this.playerTricks += 1;
		if (winner === 'ai') this.aiTricks += 1;
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
		if (this.playerTricks >= 2 || this.aiTricks >= 2 || this.playerHand.length === 0) {
			this.finishHand();
			return;
		}
		this.playerCard = null;
		this.aiCard = null;
		this.playerTurn = this.playerLeadsTrick;
		this.renderState();
		if (!this.playerLeadsTrick) this.aiLeadTrick();
	}

	private finishHand() {
		const winner: Player | null = this.playerTricks === this.aiTricks
			? null
			: this.playerTricks > this.aiTricks
				? 'player'
				: 'ai';
		if (winner === 'player') this.playerScore += 1;
		if (winner === 'ai') this.aiScore += 1;
		audioManager.playSfx(this, TRUCO_AUDIO.handResult.cacheKey);
		if (this.playerScore >= TRUCO_TARGET_SCORE || this.aiScore >= TRUCO_TARGET_SCORE) {
			this.scene.start(TRUCO_SCENES.GAME_OVER, { playerScore: this.playerScore, aiScore: this.aiScore });
			return;
		}
		this.playerIsMano = !this.playerIsMano;
		this.startHand();
	}
}
