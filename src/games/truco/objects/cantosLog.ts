import Phaser from 'phaser';

/**
 * Registro de cantos: cada renglón lleva el distintivo de quien habló y los
 * resultados se destacan como cierre de cada canto. Los renglones largos
 * pasan al siguiente; cuando el panel se llena, se descartan los más viejos.
 */
export type CantosSpeaker = 'player' | 'ai' | null;

export type CantosLogLayout = { left: number; top: number; width: number; height: number };

type Entry = { speaker: CantosSpeaker; message: string };

const MAX_ENTRIES = 16;
const PADDING = 10;
const BADGE_SLOT = 20;
const ROW_GAP = 6;
const FIRST_ROW_OFFSET = 40;

const SPEAKER_STYLES: Record<'player' | 'ai', { badge: number; figure: number; text: string }> = {
	player: { badge: 0x6a4d25, figure: 0xf2b84b, text: '#fff4d6' },
	ai: { badge: 0x5a2a22, figure: 0xe08a5e, text: '#f0c9a8' },
};

const RESULT_STYLE = { strip: 0x3a2a17, edge: 0xf2b84b, text: '#f2b84b' };

export class CantosLog {
	private entries: Entry[] = [];
	private rows: Phaser.GameObjects.GameObject[] = [];
	private readonly scene: Phaser.Scene;
	private readonly layout: CantosLogLayout;

	constructor(scene: Phaser.Scene, layout: CantosLogLayout, title: string) {
		this.scene = scene;
		this.layout = layout;
		const { left, top, width, height } = layout;
		const g = scene.add.graphics();
		g.fillStyle(0x241a11, 1);
		g.fillRoundedRect(left, top, width, height, 6);
		g.lineStyle(1, 0x6a512d, 1);
		g.strokeRoundedRect(left, top, width, height, 6);
		g.lineStyle(1, 0x4a3920, 1);
		g.lineBetween(left + PADDING, top + 30, left + width - PADDING, top + 30);
		scene.add.text(left + PADDING + 1, top + 9, title, { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '13px', color: '#d8a542' });
	}

	add(speaker: CantosSpeaker, message: string) {
		this.entries = [...this.entries, { speaker, message }].slice(-MAX_ENTRIES);
		this.render();
	}

	clear() {
		this.entries = [];
		this.render();
	}

	private render() {
		this.rows.forEach((row) => row.destroy());
		this.rows = [];
		const bottom = this.layout.top + this.layout.height - PADDING;
		// Se arma de nuevo descartando el renglón más viejo hasta que todo entre.
		for (let first = 0; first < this.entries.length; first++) {
			if (this.layoutRows(first) <= bottom) return;
			this.rows.forEach((row) => row.destroy());
			this.rows = [];
		}
	}

	/** Dibuja desde la entrada `first` y devuelve dónde terminó el último renglón. */
	private layoutRows(first: number) {
		const { left, top, width } = this.layout;
		let y = top + FIRST_ROW_OFFSET;
		for (const { speaker, message } of this.entries.slice(first)) {
			if (speaker === null) {
				const text = this.scene.add.text(left + PADDING + 6, y + 3, message, this.textStyle(RESULT_STYLE.text, width - PADDING * 2 - 12));
				const strip = this.scene.add.graphics();
				strip.fillStyle(RESULT_STYLE.strip, 1);
				strip.fillRect(left + PADDING, y, width - PADDING * 2, text.height + 6);
				strip.fillStyle(RESULT_STYLE.edge, 1);
				strip.fillRect(left + PADDING, y, 2, text.height + 6);
				this.scene.children.bringToTop(text);
				this.rows.push(strip, text);
				y += text.height + 6 + ROW_GAP;
				continue;
			}

			const style = SPEAKER_STYLES[speaker];
			const text = this.scene.add.text(left + PADDING + BADGE_SLOT, y, message, this.textStyle(style.text, width - PADDING * 2 - BADGE_SLOT));
			const badge = this.scene.add.graphics({ x: left + PADDING + 7, y: y + 6 });
			drawSpeakerBadge(badge, speaker, style.badge, style.figure);
			this.rows.push(badge, text);
			y += Math.max(text.height, 14) + ROW_GAP;
		}
		return y - ROW_GAP;
	}

	private textStyle(color: string, wrapWidth: number): Phaser.Types.GameObjects.Text.TextStyle {
		return { fontFamily: 'Courier New, monospace', fontSize: '11px', color, lineSpacing: 2, wordWrap: { width: wrapWidth, useAdvancedWrap: true } };
	}
}

/** Un círculo con la silueta de una persona o, para la IA, un robotito; centrado en el origen. */
function drawSpeakerBadge(g: Phaser.GameObjects.Graphics, speaker: 'player' | 'ai', badge: number, figure: number) {
	g.fillStyle(badge, 1);
	g.fillCircle(0, 0, 7);
	g.fillStyle(figure, 1);
	if (speaker === 'player') {
		g.fillCircle(0, -2, 2.6);
		g.slice(0, 5, 4.4, Math.PI, Math.PI * 2, false);
		g.fillPath();
		return;
	}
	// Cabeza cuadrada con antena, dos ojos y una boca de rejilla.
	g.lineStyle(1, figure, 1);
	g.lineBetween(0, -2.5, 0, -4.8);
	g.fillCircle(0, -5, 1.1);
	g.fillRoundedRect(-4.2, -2.5, 8.4, 6.6, 1.5);
	g.fillRect(-5.4, -0.4, 1.2, 2.4);
	g.fillRect(4.2, -0.4, 1.2, 2.4);
	g.fillStyle(badge, 1);
	g.fillCircle(-1.8, -0.2, 1.05);
	g.fillCircle(1.8, -0.2, 1.05);
	g.fillRect(-2, 2, 4, 0.9);
}
