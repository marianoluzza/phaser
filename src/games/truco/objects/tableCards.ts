import Phaser from 'phaser';
import type { Card } from '../rules';
import { createCard, createCardBack } from './cardRenderer';
import type { CardHighlight } from './cardRenderer';

/**
 * Cartas de la mesa con movimiento.
 *
 * La escena vuelve a dibujar todas las cartas cada vez que cambia el estado y
 * sólo dice dónde va cada una. Esta clase recuerda dónde estaba cada carta en
 * el dibujo anterior —aunque estuviera a mitad de camino— y la desliza desde
 * ahí hasta su lugar nuevo. Si además cambia de cara, como la carta que la IA
 * saca de su mano, se da vuelta en el medio del recorrido. Una carta sin
 * dibujo anterior acaba de repartirse y sale del mazo.
 *
 * Varios dibujos pueden ocurrir en el mismo frame (jugar, responder y cerrar
 * la baza es una sola cadena de llamadas): cada uno retoma la carta en el
 * punto exacto donde quedó y conserva la demora que le faltaba.
 */
export type CardTarget = {
	x: number;
	y: number;
	faceUp: boolean;
	highlight?: CardHighlight;
	onClick?: () => void;
	/** El puntero encima le pide el foco; la escena decide y llama a `setFocus`. */
	onHover?: () => void;
	/** Turno en el reparto; sólo cuenta si la carta sale del mazo. */
	dealOrder?: number;
	/** Las jugadas que se mueven en un mismo dibujo salen una detrás de otra. */
	staggerMove?: boolean;
};

type Snapshot = { x: number; y: number; faceUp: boolean; startAt: number };

const MOVE_MS = 300;
const DEAL_STAGGER_MS = 80;
/** Pausa entre la carta jugada y la respuesta, para que no lleguen juntas. */
const RESPONSE_DELAY_MS = 260;
/** Cuánto se levanta la carta con foco, como al sacarla de la mano. */
const FOCUS_LIFT = 8;
/** Cuánto crece la carta a mitad de camino, como si se levantara de la mesa. */
const TRAVEL_SCALE = 0.08;

export class TableCards {
	private views: Phaser.GameObjects.Container[] = [];
	private snapshots = new Map<string, Snapshot>();
	private staggered = 0;
	private focusedId: string | null = null;
	private readonly scene: Phaser.Scene;
	private readonly width: number;
	private readonly height: number;
	private readonly deck: { x: number; y: number };

	constructor(scene: Phaser.Scene, width: number, height: number, deck: { x: number; y: number }) {
		this.scene = scene;
		this.width = width;
		this.height = height;
		this.deck = deck;
	}

	/** Empieza un dibujo nuevo: anota dónde está cada carta y borra las anteriores. */
	beginLayout() {
		this.snapshots = new Map(this.views.map((view) => [view.getData('cardId') as string, {
			x: view.x,
			// Una carta levantada por el foco cuenta desde su lugar en la mano.
			y: (view.getData('restY') as number | undefined) ?? view.y,
			faceUp: view.getData('faceUp') as boolean,
			startAt: view.getData('startAt') as number,
		}]));
		this.destroyViews();
		this.staggered = 0;
		// Las cartas nuevas nacen sin foco: la escena lo vuelve a aplicar.
		this.focusedId = null;
	}

	/** Levanta la carta con foco y baja las demás; `null` las baja a todas. */
	setFocus(cardId: string | null, instant: boolean) {
		this.focusedId = cardId;
		for (const view of this.views) {
			const restY = view.getData('restY') as number | undefined;
			if (restY === undefined) continue;
			const y = view.getData('cardId') === cardId ? restY - FOCUS_LIFT : restY;
			this.scene.tweens.killTweensOf(view);
			if (instant) view.setY(y);
			else this.scene.tweens.add({ targets: view, y, duration: 90, ease: 'Quad.easeOut' });
		}
	}

	/** Una mano nueva: nada viene de la anterior, todo se reparte desde el mazo. */
	clear() {
		this.destroyViews();
		this.snapshots.clear();
	}

	place(card: Card, target: CardTarget) {
		const now = this.scene.time.now;
		const previous = this.snapshots.get(card.id);
		const from: Snapshot = previous ?? { ...this.deck, faceUp: false, startAt: now + (target.dealOrder ?? 0) * DEAL_STAGGER_MS };
		const moving = from.x !== target.x || from.y !== target.y || from.faceUp !== target.faceUp;
		let delay = Math.max(0, from.startAt - now);
		if (moving && previous && target.staggerMove) delay = Math.max(delay, this.staggered++ * RESPONSE_DELAY_MS);

		const view = this.scene.add.container(from.x, from.y).setSize(this.width, this.height);
		const back = createCardBack(this.scene, 0, 0, this.width, this.height);
		// El resalte de la baza aparece recién cuando la carta llega a la mesa.
		let face = createCard(this.scene, 0, 0, card, this.width, this.height, moving ? 'none' : target.highlight);
		view.add([back, face]);
		const showFace = (faceUp: boolean) => {
			back.setVisible(!faceUp);
			face.setVisible(faceUp);
			view.setData('faceUp', faceUp);
		};
		view.setData({ cardId: card.id, startAt: now + delay });
		showFace(from.faceUp);
		this.views.push(view);

		if (!moving) {
			this.makePlayable(view, target);
			return;
		}

		// En viaje pasa por encima de las demás, también de la mano de la que sale.
		view.setDepth(1);
		const progress = { t: 0 };
		const tween = this.scene.tweens.add({
			targets: progress,
			t: 1,
			delay,
			duration: MOVE_MS,
			ease: 'Cubic.easeInOut',
			onUpdate: () => {
				const { t } = progress;
				const lift = 1 + TRAVEL_SCALE * Math.sin(Math.PI * t);
				view.setPosition(Phaser.Math.Linear(from.x, target.x, t), Phaser.Math.Linear(from.y, target.y, t));
				if (from.faceUp === target.faceUp) {
					view.setScale(lift);
					return;
				}
				// Se angosta hasta desaparecer de canto y reaparece con la otra cara.
				showFace(t < 0.5 ? from.faceUp : target.faceUp);
				view.setScale(lift * Math.abs(1 - 2 * t), lift);
			},
			onComplete: () => {
				view.setPosition(target.x, target.y).setScale(1).setDepth(0);
				if (target.highlight && target.highlight !== 'none') {
					view.remove(face, true);
					face = createCard(this.scene, 0, 0, card, this.width, this.height, target.highlight);
					view.add(face);
				}
				showFace(target.faceUp);
				this.makePlayable(view, target);
			},
		});
		view.once(Phaser.GameObjects.Events.DESTROY, () => tween.remove());
	}

	/**
	 * Sólo una carta quieta en la mano se puede tocar; si tenía el foco mientras
	 * viajaba, se levanta al llegar.
	 */
	private makePlayable(view: Phaser.GameObjects.Container, { y, onClick, onHover }: CardTarget) {
		if (!onClick) return;
		view.setData('restY', y);
		if (view.getData('cardId') === this.focusedId) view.setY(y - FOCUS_LIFT);
		view.setInteractive({ useHandCursor: true }).on('pointerdown', onClick);
		if (onHover) view.on('pointerover', onHover);
	}

	private destroyViews() {
		this.views.forEach((view) => {
			this.scene.tweens.killTweensOf(view);
			view.destroy();
		});
		this.views = [];
	}
}
