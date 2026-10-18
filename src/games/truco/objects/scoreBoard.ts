import Phaser from 'phaser';
import { TRUCO_GOOD_SCORE, TRUCO_TARGET_SCORE } from '../rules';

/**
 * Anotador de fósforos: cada tanto es un fósforo y cada cinco forman un
 * cuadrado cerrado por la diagonal. Las malas y las buenas quedan separadas
 * por una raya, como en el papel de un bar.
 */
export type ScoreSide = 'player' | 'ai';

export type ScoreBoardLayout = { left: number; top: number; width: number; height: number };

const POINTS_PER_BOX = 5;
const BOX_SIZE = 32;
const BOX_STEP = 44;
const SIDE_MATCH_LENGTH = BOX_SIZE + 4;
const DIAGONAL_MATCH_LENGTH = BOX_SIZE * 1.25;
const NAME_MAX_WIDTH = 98;
const HAND_ICON_SLOT = 21;
const MATCH_DELAY_MS = 90;

const COLORS = {
	panel: 0x241a11,
	panelEdge: 0x6a512d,
	divider: 0x4a3920,
	goodLine: 0xf2b84b,
	stick: 0xe9cf98,
	stickShade: 0xb08a4e,
	head: 0xc8382a,
	headShine: 0xff8a6a,
	hand: 0xf2b84b,
};

export class TrucoScoreBoard {
	private readonly columnX: Record<ScoreSide, number>;
	private readonly names: Record<ScoreSide, Phaser.GameObjects.Text>;
	private readonly totals: Record<ScoreSide, Phaser.GameObjects.Text>;
	private readonly matches: Record<ScoreSide, Phaser.GameObjects.Graphics[]> = { player: [], ai: [] };
	private readonly handIcon: Phaser.GameObjects.Graphics;
	private readonly badTop: number;
	private readonly goodTop: number;
	private readonly scene: Phaser.Scene;

	constructor(scene: Phaser.Scene, layout: ScoreBoardLayout, labels: { player: string; ai: string; bad: string; good: string }) {
		this.scene = scene;
		const { left, top, width, height } = layout;
		const centerX = left + width / 2;
		const bottom = top + height;
		this.columnX = { player: left + width / 4, ai: left + (width * 3) / 4 };
		this.badTop = top + 80;
		this.goodTop = this.badTop + BOX_STEP * 3 + 44;
		const goodLineY = this.goodTop - 34;
		const totalsLineY = this.goodTop + BOX_STEP * 2 + BOX_SIZE / 2 + 16;

		const g = scene.add.graphics();
		g.fillStyle(COLORS.panel, 1);
		g.fillRoundedRect(left, top, width, height, 6);
		g.lineStyle(1, COLORS.panelEdge, 1);
		g.strokeRoundedRect(left, top, width, height, 6);
		g.lineStyle(1, COLORS.divider, 1);
		g.lineBetween(left + 10, top + 40, left + width - 10, top + 40);
		g.lineBetween(centerX, top + 40, centerX, totalsLineY);
		g.lineBetween(left + 10, totalsLineY, left + width - 10, totalsLineY);
		// La raya de las buenas es la que importa: más gruesa y dorada.
		g.lineStyle(2, COLORS.goodLine, 1);
		g.lineBetween(left + 10, goodLineY, left + width - 10, goodLineY);

		const labelStyle = { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '11px', color: '#d8a542', backgroundColor: '#241a11', padding: { x: 6, y: 1 } };
		scene.add.text(centerX, this.badTop - 26, labels.bad, labelStyle).setOrigin(0.5);
		scene.add.text(centerX, goodLineY + 13, labels.good, labelStyle).setOrigin(0.5);

		this.names = {
			player: this.createName('player', labels.player, top + 21),
			ai: this.createName('ai', labels.ai, top + 21),
		};
		const totalStyle = { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '20px', color: '#fff4d6' };
		this.totals = {
			player: scene.add.text(this.columnX.player, (totalsLineY + bottom) / 2, '0', totalStyle).setOrigin(0.5),
			ai: scene.add.text(this.columnX.ai, (totalsLineY + bottom) / 2, '0', totalStyle).setOrigin(0.5),
		};
		this.handIcon = scene.add.graphics();
		drawHandIcon(this.handIcon, 0, 0, 1);
		this.handIcon.setVisible(false);
	}

	setScores(player: number, ai: number) {
		this.updateSide('player', player);
		this.updateSide('ai', ai);
	}

	/** La mano junto al nombre de quien es mano en este reparto. */
	setMano(side: ScoreSide) {
		const name = this.names[side];
		this.handIcon.setPosition(name.x - name.width / 2 - HAND_ICON_SLOT / 2, name.y + 1).setVisible(true);
	}

	/**
	 * El nombre se corre a la derecha dejando siempre lugar para la mano, así
	 * no salta de posición cuando cambia quién es mano.
	 */
	private createName(side: ScoreSide, label: string, y: number) {
		const text = this.scene.add.text(0, y, label, { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '13px', color: '#f2b84b' }).setOrigin(0.5);
		for (let size = 12; text.width > NAME_MAX_WIDTH && size >= 8; size--) text.setFontSize(size);
		return text.setX(this.columnX[side] + HAND_ICON_SLOT / 2);
	}

	private updateSide(side: ScoreSide, score: number) {
		const target = Phaser.Math.Clamp(score, 0, TRUCO_TARGET_SCORE);
		const matches = this.matches[side];
		this.totals[side].setText(score.toString());
		if (target < matches.length) {
			matches.forEach((match) => match.destroy());
			matches.length = 0;
		}
		// Los fósforos nuevos caen de a uno, en el orden en que se dibujan a mano.
		for (let index = matches.length, order = 0; index < target; index++, order++) {
			const match = this.createMatch(side, index);
			matches.push(match);
			const { y } = match;
			match.setAlpha(0).setScale(1.3).setY(y - 6);
			this.scene.tweens.add({ targets: match, alpha: 1, scale: 1, y, delay: order * MATCH_DELAY_MS, duration: 160, ease: 'Quad.easeOut' });
		}
	}

	/** Lados de arriba, derecha, abajo e izquierda; el quinto cruza en diagonal. */
	private createMatch(side: ScoreSide, point: number) {
		const inGood = point >= TRUCO_GOOD_SCORE;
		const indexInHalf = point % TRUCO_GOOD_SCORE;
		const box = Math.floor(indexInHalf / POINTS_PER_BOX);
		const stroke = indexInHalf % POINTS_PER_BOX;
		const boxX = this.columnX[side];
		const boxY = (inGood ? this.goodTop : this.badTop) + box * BOX_STEP;
		const half = BOX_SIZE / 2;
		const placements: [number, number, number][] = [
			[0, -half, 0],
			[half, 0, Math.PI / 2],
			[0, half, Math.PI],
			[-half, 0, -Math.PI / 2],
			[0, 0, Math.PI / 4],
		];
		const [dx, dy, rotation] = placements[stroke];
		const match = this.scene.add.graphics({ x: boxX + dx, y: boxY + dy });
		drawMatch(match, stroke === 4 ? DIAGONAL_MATCH_LENGTH : SIDE_MATCH_LENGTH);
		return match.setRotation(rotation);
	}
}

/** Un fósforo acostado, centrado en el origen, con la cabeza hacia +x. */
function drawMatch(g: Phaser.GameObjects.Graphics, length: number) {
	const half = length / 2;
	g.fillStyle(0x000000, 0.35);
	g.fillRoundedRect(-half + 1, -0.6, length, 3.2, 1.2);
	g.fillStyle(COLORS.stick, 1);
	g.fillRoundedRect(-half, -1.6, length, 3.2, 1.2);
	g.lineStyle(1, COLORS.stickShade, 1);
	g.lineBetween(-half + 1, 1.1, half - 4, 1.1);
	g.fillStyle(COLORS.head, 1);
	g.fillEllipse(half - 1.5, 0, 7, 5);
	g.fillStyle(COLORS.headShine, 1);
	g.fillCircle(half - 2.5, -0.9, 1);
}

/** Mano abierta, centrada en (x, y); a escala 1 mide unos 16 px. */
export function drawHandIcon(g: Phaser.GameObjects.Graphics, x: number, y: number, scale: number) {
	const parts = (dx: number, dy: number, color: number, alpha: number) => {
		const s = (value: number) => value * scale;
		g.fillStyle(color, alpha);
		g.fillRoundedRect(x + dx - s(5.5), y + dy - s(1), s(11), s(9), s(3));
		const fingers: [number, number][] = [[-5.2, 8], [-2.4, 9.5], [0.4, 9], [3.2, 7.5]];
		for (const [fx, fh] of fingers) g.fillRoundedRect(x + dx + s(fx), y + dy - s(fh) + s(1), s(2.3), s(fh), s(1.15));
		g.fillPoints([
			new Phaser.Math.Vector2(x + dx - s(5), y + dy + s(4)),
			new Phaser.Math.Vector2(x + dx - s(9.5), y + dy - s(1)),
			new Phaser.Math.Vector2(x + dx - s(8), y + dy - s(2.6)),
			new Phaser.Math.Vector2(x + dx - s(4), y + dy + s(0.5)),
		], true);
	};
	parts(1, 1, 0x000000, 0.35);
	parts(0, 0, COLORS.hand, 1);
}
