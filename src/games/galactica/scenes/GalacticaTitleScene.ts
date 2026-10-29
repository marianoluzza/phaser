import Phaser from 'phaser';
import { audioManager } from '../../../core/audio/AudioManager';
import { i18n } from '../../../core/i18n/i18n';
import { CORE_SCENES } from '../../../core/sceneKeys';
import { GALACTICA_AUDIO, loadGalacticaAudio } from '../audio';
import { SHIP_IDS, SHIPS, shipFrame, type ShipId } from '../constants/ships';
import { addShip, loadGalacticaArt, sharpenGalacticaArt } from '../objects/art';
import { SHIP_LABELS, TEXT } from '../objects/labels';
import { seededRandom } from '../state/rng';
import { newRun } from '../state/Battle';
import { readHangar, readHighScore } from '../state/hangar';
import { GALACTICA_SCENES } from '../sceneKeys';

/** El hangar dibujado y la ficha de la nave, uno al lado del otro. */
const HANGAR = { x: 30, y: 116, w: 452, h: 372 };
const CX = HANGAR.x + HANGAR.w / 2;
/** La boca de la bahía, por donde sale la nave al despegar. */
const BAY = { x: CX - 92, y: HANGAR.y, w: 184, h: 148 };
const PAD = { x: CX, y: HANGAR.y + 300 };
const SHIP_Y = PAD.y - 40;
const CARD = { x: 498, y: 116, w: 272, h: 372 };

/** La nave elegida se recuerda mientras el arcade siga abierto. */
let lastShip: ShipId = 'halcon';

type Spark = { x: number; y: number; vx: number; vy: number; age: number; life: number; color: number };

/**
 * Pantalla de inicio: el hangar con la nave elegida en la plataforma, su ficha
 * y la entrada a la Galactopedia. Al despegar, la nave sale volando por la
 * boca de la bahía antes de empezar la zona.
 */
export class GalacticaTitleScene extends Phaser.Scene {
	private hangar = new Set<ShipId>();
	private selected: ShipId = 'halcon';
	private launching = false;
	private launchTime = 0;
	private sparks: Spark[] = [];

	private ship!: Phaser.GameObjects.Image;
	private parked: Phaser.GameObjects.Image[] = [];
	private live!: Phaser.GameObjects.Graphics;
	private flame!: Phaser.GameObjects.Graphics;
	private bayStars: Array<{ x: number; y: number; speed: number }> = [];

	private nameText!: Phaser.GameObjects.Text;
	private statusText!: Phaser.GameObjects.Text;
	private descriptionText!: Phaser.GameObjects.Text;
	private statBars!: Phaser.GameObjects.Graphics;
	private stageImages: Phaser.GameObjects.Image[] = [];
	private stageTexts: Phaser.GameObjects.Text[] = [];
	private footText!: Phaser.GameObjects.Text;
	private launchLabel!: Phaser.GameObjects.Text;

	private enterKey!: Phaser.Input.Keyboard.Key;
	private escapeKey!: Phaser.Input.Keyboard.Key;
	private leftKey!: Phaser.Input.Keyboard.Key;
	private rightKey!: Phaser.Input.Keyboard.Key;
	private pediaKey!: Phaser.Input.Keyboard.Key;

	constructor() {
		super(GALACTICA_SCENES.TITLE);
	}

	preload() {
		loadGalacticaArt(this);
		loadGalacticaAudio(this, GALACTICA_AUDIO.titleMusic, GALACTICA_AUDIO.confirm, GALACTICA_AUDIO.select, GALACTICA_AUDIO.blast);
	}

	create() {
		sharpenGalacticaArt(this);
		this.hangar = readHangar();
		this.selected = this.hangar.has(lastShip) ? lastShip : 'halcon';
		this.launching = false;
		this.sparks = [];

		this.cameras.main.setBackgroundColor('#05060d');
		this.drawLogo();
		this.drawHangar();
		this.createShips();
		this.createCard();
		this.createButtons();
		this.refresh();

		audioManager.playMusic(this, GALACTICA_AUDIO.titleMusic.cacheKey);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audioManager.stopMusic());

		const keyboard = this.input.keyboard!;
		this.enterKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
		this.escapeKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
		this.leftKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
		this.rightKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
		this.pediaKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.G);
	}

	update(time: number, delta: number) {
		const dt = Math.min(delta, 100) / 1000;
		this.drawLive(time / 1000);
		this.updateLaunch(dt);
		if (!this.launching) {
			// Estacionada, la nave flota apenas sobre la plataforma.
			this.ship.setY(SHIP_Y + Math.sin(time / 420) * 3);
		}
		if (this.launching) {
			return;
		}

		if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
			this.launch();
		} else if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
			this.goTo(CORE_SCENES.LAUNCHER);
		} else if (Phaser.Input.Keyboard.JustDown(this.pediaKey)) {
			this.goTo(GALACTICA_SCENES.PEDIA);
		} else if (Phaser.Input.Keyboard.JustDown(this.leftKey)) {
			this.changeShip(-1);
		} else if (Phaser.Input.Keyboard.JustDown(this.rightKey)) {
			this.changeShip(1);
		}
	}

	// ── Logo y hangar ────────────────────────────────────────────────────────

	private drawLogo() {
		this.add.text(400, 48, i18n.t('galactica.catalog.title'), {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: '54px',
			color: '#7fe0ff',
			letterSpacing: 10,
			stroke: '#163a6a',
			strokeThickness: 6,
		}).setOrigin(0.5);
		this.add.text(400, 92, i18n.t('galactica.title.tagline'), { ...TEXT.label, fontSize: '12px', letterSpacing: 3 })
			.setOrigin(0.5);
		this.add.text(770, 14, `${i18n.t('galactica.title.highScore')}  ${readHighScore()}`, { ...TEXT.mono, color: '#9eacd0' })
			.setOrigin(1, 0);
	}

	/** La parte quieta del hangar: paredes, bahía abierta, grúas, piso y plataformas. */
	private drawHangar() {
		const g = this.add.graphics();
		const { x, y, w, h } = HANGAR;

		g.fillStyle(0x0f1730, 1);
		g.fillRect(x, y, w, h);

		// Costillas de la pared y la viga que sostiene la bahía.
		g.fillStyle(0x16223f, 1);
		for (let rib = x + 22; rib < x + w; rib += 58) {
			if (rib + 12 < BAY.x - 44 || rib > BAY.x + BAY.w + 44) {
				g.fillRect(rib, y, 12, h - 80);
			}
		}
		g.fillStyle(0x1d2b4f, 1);
		g.fillRect(x, BAY.y + BAY.h, w, 16);

		// Las hojas de la compuerta, corridas a los costados.
		for (const side of [-1, 1]) {
			const left = side < 0 ? BAY.x - 44 : BAY.x + BAY.w;
			g.fillStyle(0x24345c, 1);
			g.fillRect(left, BAY.y, 44, BAY.h);
			g.fillStyle(0x1a2747, 1);
			for (let line = BAY.y + 14; line < BAY.y + BAY.h; line += 22) {
				g.fillRect(left + 6, line, 32, 4);
			}
		}

		// La boca de la bahía, con franjas de peligro en el borde.
		g.fillStyle(0x03040a, 1);
		g.fillRect(BAY.x, BAY.y, BAY.w, BAY.h);
		g.lineStyle(3, 0x3a4a6e, 1);
		g.strokeRect(BAY.x, BAY.y, BAY.w, BAY.h);
		for (let stripe = 0; stripe < BAY.w; stripe += 16) {
			g.fillStyle(stripe % 32 === 0 ? 0xffd860 : 0x1a1a24, 1);
			g.fillRect(BAY.x + stripe, BAY.y + BAY.h - 6, 16, 6);
		}

		// Piso en perspectiva: las líneas fugan hacia la bahía.
		const floorTop = PAD.y - 26;
		g.fillStyle(0x0a1122, 1);
		g.fillPoints([
			new Phaser.Math.Vector2(x + 70, floorTop),
			new Phaser.Math.Vector2(x + w - 70, floorTop),
			new Phaser.Math.Vector2(x + w, y + h),
			new Phaser.Math.Vector2(x, y + h),
		], true);
		g.lineStyle(1, 0x1d2b4f, 1);
		for (let line = -4; line <= 4; line += 1) {
			g.lineBetween(CX + line * 48, floorTop, CX + line * 120, y + h);
		}
		g.lineBetween(x + 50, floorTop + 30, x + w - 50, floorTop + 30);

		// Grúas a los costados de la plataforma, con su brazo apuntando a la nave.
		for (const side of [-1, 1]) {
			const tower = CX + side * 132;
			g.fillStyle(0x24345c, 1);
			g.fillRect(tower - 8, BAY.y + BAY.h + 16, 16, floorTop - BAY.y - BAY.h - 4);
			g.fillRect(Math.min(tower, CX + side * 70), SHIP_Y - 18, Math.abs(tower - (CX + side * 70)), 8);
			g.lineStyle(1, 0x3a4a6e, 1);
			for (let cross = BAY.y + BAY.h + 24; cross < floorTop; cross += 18) {
				g.lineBetween(tower - 8, cross, tower + 8, cross + 18);
			}
		}

		// Plataformas: la de despegue en el centro y dos de estacionamiento.
		this.drawPad(g, PAD.x, PAD.y, 74, 16);
		this.drawPad(g, x + 62, y + h - 46, 44, 10);
		this.drawPad(g, x + w - 62, y + h - 46, 44, 10);

		g.lineStyle(2, 0x29416f, 1);
		g.strokeRect(x, y, w, h);

		this.bayStars = [];
		const random = seededRandom(11);
		for (let star = 0; star < 26; star += 1) {
			this.bayStars.push({ x: random() * (BAY.w - 8) + 4, y: random() * (BAY.h - 10), speed: 8 + random() * 30 });
		}
		this.live = this.add.graphics();
	}

	private drawPad(g: Phaser.GameObjects.Graphics, x: number, y: number, rx: number, ry: number) {
		g.fillStyle(0x1a2a4a, 1);
		g.fillEllipse(x, y, rx * 2, ry * 2);
		g.lineStyle(2, 0x3a5a8a, 1);
		g.strokeEllipse(x, y, rx * 2, ry * 2);
		g.fillStyle(0x0f1a33, 1);
		g.fillEllipse(x, y, rx * 1.2, ry * 1.2);
	}

	/** Lo que se mueve en el hangar: las estrellas de la bahía y las luces. */
	private drawLive(time: number) {
		const g = this.live;
		g.clear();
		for (const star of this.bayStars) {
			const sy = (star.y + time * star.speed) % (BAY.h - 10);
			g.fillStyle(0xd9e2ff, star.speed > 25 ? 0.9 : 0.45);
			g.fillRect(BAY.x + star.x, BAY.y + 2 + sy, star.speed > 25 ? 2 : 1, star.speed > 25 ? 2 : 1);
		}

		// Luces del techo, y el anillo de la plataforma que gira; más rápido al despegar.
		for (let light = 0; light < 6; light += 1) {
			const lx = HANGAR.x + 30 + light * 78;
			g.fillStyle(0xbfe8ff, 0.12);
			g.fillCircle(lx, BAY.y + BAY.h + 8, 12);
			g.fillStyle(0xe8f6ff, 1);
			g.fillRect(lx - 6, BAY.y + BAY.h + 6, 12, 4);
		}
		const speed = this.launching ? 18 : 4;
		const unlocked = this.hangar.has(this.selected);
		for (let index = 0; index < 10; index += 1) {
			const angle = (index / 10) * Math.PI * 2;
			const lit = Math.floor(time * speed) % 10 === index;
			g.fillStyle(unlocked ? 0x7fe0ff : 0xff5466, lit ? 1 : 0.25);
			g.fillRect(PAD.x + Math.cos(angle) * 64 - 2, PAD.y + Math.sin(angle) * 12 - 2, 4, 4);
		}
		for (const side of [-1, 1]) {
			const blink = Math.floor(time * 2 + (side > 0 ? 1 : 0)) % 2 === 0;
			g.fillStyle(0xff5466, blink ? 1 : 0.2);
			g.fillRect(CX + side * 132 - 3, BAY.y + BAY.h + 22, 6, 6);
		}
	}

	private createShips() {
		// Las otras dos naves, estacionadas a los costados: el hangar se va llenando.
		this.parked = [
			addShip(this, HANGAR.x + 62, HANGAR.y + HANGAR.h - 66, shipFrame('halcon', 0), 3),
			addShip(this, HANGAR.x + HANGAR.w - 62, HANGAR.y + HANGAR.h - 66, shipFrame('halcon', 0), 3),
		];
		this.flame = this.add.graphics().setDepth(9);
		this.ship = addShip(this, CX, SHIP_Y, shipFrame('halcon', 0), 6).setDepth(10);

		for (const [label, offset, delta] of [['◀', -104, -1], ['▶', 104, 1]] as const) {
			this.add.text(CX + offset, SHIP_Y, label, { fontFamily: 'Arial, sans-serif', fontSize: '24px', color: '#7fe0ff' })
				.setOrigin(0.5)
				.setInteractive({ useHandCursor: true })
				.on('pointerdown', () => this.changeShip(delta));
		}
	}

	// ── Ficha de la nave ─────────────────────────────────────────────────────

	private createCard() {
		const { x, y, w, h } = CARD;
		this.add.rectangle(x, y, w, h, 0x0d1428, 0.95).setOrigin(0).setStrokeStyle(2, 0x29416f);
		this.add.text(x + 14, y + 12, i18n.t('galactica.title.hangar'), TEXT.label);
		this.add.text(x + w - 14, y + 12, `${i18n.t('galactica.title.collection')}  ${this.hangar.size} / ${SHIP_IDS.length}`, TEXT.label)
			.setOrigin(1, 0);

		this.nameText = this.add.text(x + 14, y + 32, '', {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: '24px',
			color: '#f5f7ff',
			letterSpacing: 3,
		});
		this.statusText = this.add.text(x + 14, y + 66, '', { ...TEXT.label, fontSize: '11px' });
		this.descriptionText = this.add.text(x + 14, y + 88, '', {
			...TEXT.small,
			fontSize: '12px',
			lineSpacing: 3,
			wordWrap: { width: w - 28 },
		});

		const labels = ['galactica.stat.speed', 'galactica.stat.armor', 'galactica.stat.fire'] as const;
		labels.forEach((key, index) => {
			this.add.text(x + 14, y + 172 + index * 20, i18n.t(key), { ...TEXT.label, fontSize: '10px' });
		});
		this.statBars = this.add.graphics();

		this.add.text(x + 14, y + 240, i18n.t('galactica.title.evolution'), TEXT.label);
		this.stageImages = [0, 1, 2].map((stage) => addShip(this, x + 48 + stage * 88, y + 282, shipFrame('halcon', stage), 2));
		this.stageTexts = [0, 1, 2].map((stage) => this.add.text(x + 48 + stage * 88, y + 304, '', {
			...TEXT.small,
			fontSize: '10px',
			align: 'center',
			wordWrap: { width: 84 },
		}).setOrigin(0.5, 0));

		this.footText = this.add.text(x + w / 2, y + h - 22, '', { ...TEXT.label, fontSize: '10px', align: 'center' }).setOrigin(0.5);
	}

	private refresh() {
		const ship = SHIPS[this.selected];
		const labels = SHIP_LABELS[ship.id];
		const unlocked = this.hangar.has(this.selected);
		lastShip = this.selected;

		this.ship.setFrame(shipFrame(ship.id, 0));
		// Una nave bloqueada se ve como silueta: se sabe que existe, no cómo es.
		const shade = (image: Phaser.GameObjects.Image, visible: boolean) => {
			if (visible) {
				image.clearTint();
			} else {
				image.setTint(0x1d2a4a).setTintMode(Phaser.TintModes.FILL);
			}
		};
		shade(this.ship, unlocked);
		const others = SHIP_IDS.filter((id) => id !== this.selected);
		this.parked.forEach((image, index) => {
			image.setFrame(shipFrame(others[index], 0));
			shade(image, this.hangar.has(others[index]));
		});

		this.nameText.setText(i18n.t(labels.name));
		this.statusText
			.setText(unlocked ? i18n.t('galactica.title.ready') : i18n.t('galactica.title.locked'))
			.setColor(unlocked ? '#9be15d' : '#ff647c');
		this.descriptionText.setText(i18n.t(labels.text));
		this.stageImages.forEach((image, stage) => {
			image.setFrame(shipFrame(ship.id, stage));
			shade(image, unlocked);
		});
		this.stageTexts.forEach((text, stage) => text.setText(`MK ${stage + 1}\n${i18n.t(labels.stages[stage])}`));
		this.footText.setText(unlocked
			? i18n.t('galactica.title.hangarHint')
			: i18n.t('galactica.title.unlockHint').replace('{zone}', String(ship.unlockZone)));
		this.launchLabel.setAlpha(unlocked ? 1 : 0.4);

		const values = [(ship.speed - 150) / 200, (1.5 - ship.armor) / 0.9, (1 / ship.cooldown) / 6.5];
		const g = this.statBars;
		g.clear();
		values.forEach((value, index) => {
			const bx = CARD.x + 104;
			const by = CARD.y + 174 + index * 20;
			g.fillStyle(0x1a2440, 1);
			g.fillRect(bx, by, 150, 8);
			g.fillStyle(unlocked ? 0x7fe0ff : 0x2a3a5a, 1);
			g.fillRect(bx, by, 150 * Phaser.Math.Clamp(value, 0.08, 1), 8);
		});
	}

	private changeShip(delta: number) {
		if (this.launching) {
			return;
		}
		const index = Phaser.Math.Wrap(SHIP_IDS.indexOf(this.selected) + delta, 0, SHIP_IDS.length);
		this.selected = SHIP_IDS[index];
		audioManager.playSfx(this, GALACTICA_AUDIO.select.cacheKey);
		this.refresh();
		// La nave nueva sube a la plataforma desde abajo, como en un montacargas.
		this.tweens.killTweensOf(this.ship);
		this.ship.setScale(6, 0.2).setAlpha(0.3);
		this.tweens.add({ targets: this.ship, scaleY: 6, alpha: 1, duration: 220, ease: 'Back.easeOut' });
	}

	// ── Despegue ─────────────────────────────────────────────────────────────

	private launch() {
		if (!this.hangar.has(this.selected)) {
			this.cameras.main.shake(120, 0.004);
			return;
		}
		this.launching = true;
		this.launchTime = 0;
		audioManager.playSfx(this, GALACTICA_AUDIO.confirm.cacheKey);
	}

	/**
	 * El despegue en tres tiempos: los motores se encienden y la nave tiembla,
	 * sube por la bahía acelerando con su estela, y la pantalla destella antes
	 * de pasar a la zona.
	 */
	private updateLaunch(dt: number) {
		const g = this.flame;
		g.clear();
		for (const spark of this.sparks) {
			spark.age += dt;
			spark.x += spark.vx * dt;
			spark.y += spark.vy * dt;
		}
		this.sparks = this.sparks.filter((spark) => spark.age < spark.life);
		for (const spark of this.sparks) {
			g.fillStyle(spark.color, 1 - spark.age / spark.life);
			g.fillRect(spark.x - 2, spark.y - 2, 4, 4);
		}
		if (!this.launching) {
			return;
		}

		const previous = this.launchTime;
		this.launchTime += dt;
		const t = this.launchTime;
		const IGNITION = 0.55;

		if (t < IGNITION) {
			this.ship.setPosition(CX + (Math.random() - 0.5) * 3, SHIP_Y - (t / IGNITION) * 10);
		} else {
			if (previous < IGNITION) {
				audioManager.playSfx(this, GALACTICA_AUDIO.blast.cacheKey);
				this.cameras.main.shake(260, 0.008);
			}
			const climb = t - IGNITION;
			this.ship.setPosition(CX, SHIP_Y - 10 - 520 * climb * climb - 60 * climb);
		}

		// La llama crece con el empuje; las chispas caen y se abren.
		const power = Math.min(1, t / IGNITION);
		const length = 14 + power * 30 + Math.random() * 8;
		const tail = this.ship.y + 34;
		g.fillStyle(0xff8a3a, 0.9);
		g.fillTriangle(CX - 14, tail, CX + 14, tail, CX, tail + length);
		g.fillStyle(0xffd860, 1);
		g.fillTriangle(CX - 7, tail, CX + 7, tail, CX, tail + length * 0.6);
		for (let index = 0; index < 3; index += 1) {
			this.sparks.push({
				x: CX + (Math.random() - 0.5) * 20,
				y: tail + 6,
				vx: (Math.random() - 0.5) * 160,
				vy: 60 + Math.random() * 140,
				age: 0,
				life: 0.3 + Math.random() * 0.4,
				color: Math.random() < 0.5 ? 0xffd860 : 0xff8a3a,
			});
		}

		if (previous < 1.45 && t >= 1.45) {
			this.cameras.main.flash(220, 220, 240, 255);
			this.cameras.main.fadeOut(320, 5, 6, 13);
			this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
				this.scene.start(GALACTICA_SCENES.GAME, newRun(this.selected));
			});
		}
	}

	private createButtons() {
		const launchButton = this.add.rectangle(400, 524, 300, 44, 0x18365b)
			.setStrokeStyle(2, 0x7fe0ff)
			.setInteractive({ useHandCursor: true })
			.on('pointerdown', () => this.launch());
		this.launchLabel = this.add.text(launchButton.x, launchButton.y, i18n.t('galactica.title.launch'), {
			fontFamily: 'Courier New, monospace',
			fontSize: '18px',
			color: '#ffffff',
		}).setOrigin(0.5);

		for (const [x, label, scene] of [
			[272, i18n.t('galactica.title.pedia'), GALACTICA_SCENES.PEDIA],
			[528, i18n.t('galactica.title.backToArcade'), CORE_SCENES.LAUNCHER],
		] as const) {
			this.add.rectangle(x, 572, 250, 30, 0x111a31)
				.setStrokeStyle(1, 0x40577f)
				.setInteractive({ useHandCursor: true })
				.on('pointerdown', () => this.goTo(scene));
			this.add.text(x, 572, label, { fontFamily: 'Courier New, monospace', fontSize: '13px', color: '#9eacd0' }).setOrigin(0.5);
		}
	}

	private goTo(sceneKey: string) {
		if (this.launching) {
			return;
		}
		audioManager.playSfx(this, GALACTICA_AUDIO.confirm.cacheKey);
		this.scene.start(sceneKey);
	}
}
