import Phaser from 'phaser';
import { audioManager } from '../../../core/audio/AudioManager';
import { i18n } from '../../../core/i18n/i18n';
import { loadTrafficAudio, TRAFFIC_AUDIO } from '../audio';
import { CENTRO, type ArmId } from '../constants/layouts';
import { END_DELAY, START_LIVES } from '../constants/tuning';
import { drawCarBody, drawCarLights, drawPatienceBar, patienceColor } from '../objects/carRenderer';
import { drawCity, drawExitSigns, exitSigns, inkFor, type ExitSign } from '../objects/cityRenderer';
import { drawAnger, drawCrash, drawHeart } from '../objects/effects';
import {
	drawApproachHighlight,
	drawLight,
	drawStopLine,
	lightAnchors,
	type LightAnchor,
} from '../objects/lightRenderer';
import { readHighScore } from '../state/highScore';
import { Traffic, type Car, type TrafficEvent } from '../state/Traffic';
import { TRAFFIC_SCENES } from '../sceneKeys';
import { createLightLabels, createSignLetters, formatTime } from '../objects/labels';
import type { TrafficResult } from './TrafficGameOverScene';

/** La simulación avanza a pasos fijos: igual en un monitor de 60 Hz que en uno de 144 Hz. */
const STEP = 1 / 60;
const HINT_DURATION = 5;

type CarView = {
	container: Phaser.GameObjects.Container;
	lights: Phaser.GameObjects.Graphics;
	letter: Phaser.GameObjects.Text;
};

type Effect = { kind: 'crash' | 'anger'; x: number; y: number; age: number; duration: number; seed: number };

const LABEL_STYLE = {
	fontFamily: 'Arial, sans-serif',
	fontSize: '11px',
	color: '#9eacd0',
	letterSpacing: 2,
};
const VALUE_STYLE = {
	fontFamily: 'Courier New, monospace',
	fontSize: '26px',
	color: '#f5f7ff',
	fontStyle: 'bold',
};

/** Las flechas cambian el semáforo que está de ese lado de la pantalla. */
const KEY_ARMS: Array<[ArmId, number[]]> = [
	['N', [Phaser.Input.Keyboard.KeyCodes.UP, Phaser.Input.Keyboard.KeyCodes.W]],
	['E', [Phaser.Input.Keyboard.KeyCodes.RIGHT, Phaser.Input.Keyboard.KeyCodes.D]],
	['S', [Phaser.Input.Keyboard.KeyCodes.DOWN, Phaser.Input.Keyboard.KeyCodes.S]],
	['W', [Phaser.Input.Keyboard.KeyCodes.LEFT, Phaser.Input.Keyboard.KeyCodes.A]],
];

/** La partida: clicks y teclas → `Traffic`, dibujo de su estado y sonido de sus eventos. */
export class TrafficGameScene extends Phaser.Scene {
	/** Público para que `npm run shots` pueda leer y forzar el estado. */
	traffic!: Traffic;

	private anchors: LightAnchor[] = [];
	private signs: ExitSign[] = [];
	private hovered: string | null = null;
	private views = new Map<number, CarView>();
	private effects: Effect[] = [];

	private highlightLayer!: Phaser.GameObjects.Graphics;
	private lightLayer!: Phaser.GameObjects.Graphics;
	private barLayer!: Phaser.GameObjects.Graphics;
	private effectLayer!: Phaser.GameObjects.Graphics;
	private heartLayer!: Phaser.GameObjects.Graphics;
	private scoreText!: Phaser.GameObjects.Text;
	private timeText!: Phaser.GameObjects.Text;
	private highScoreText!: Phaser.GameObjects.Text;
	private hintText!: Phaser.GameObjects.Text;

	private keys: Array<{ lightId: string; keys: Phaser.Input.Keyboard.Key[] }> = [];
	private escapeKey!: Phaser.Input.Keyboard.Key;

	private accumulator = 0;
	private highScore = 0;
	private heartSignature = '';
	private finished = false;

	constructor() {
		super(TRAFFIC_SCENES.GAME);
	}

	preload() {
		loadTrafficAudio(
			this,
			TRAFFIC_AUDIO.gameMusic, TRAFFIC_AUDIO.toggle, TRAFFIC_AUDIO.completed,
			TRAFFIC_AUDIO.crash, TRAFFIC_AUDIO.impatient, TRAFFIC_AUDIO.confirm,
		);
	}

	create() {
		// Las escenas se reutilizan: todo el estado de la partida se arma de nuevo acá.
		this.traffic = new Traffic(CENTRO);
		this.anchors = lightAnchors(CENTRO);
		this.signs = exitSigns(CENTRO);
		this.hovered = null;
		this.views = new Map();
		this.effects = [];
		this.accumulator = 0;
		this.highScore = readHighScore();
		this.heartSignature = '';
		this.finished = false;

		this.cameras.main.setBackgroundColor('#080d1a');
		const city = this.add.graphics();
		drawCity(city, CENTRO);
		drawExitSigns(city, this.signs);
		createSignLetters(this, this.signs);

		this.highlightLayer = this.add.graphics().setDepth(1);
		this.lightLayer = this.add.graphics().setDepth(15);
		this.barLayer = this.add.graphics().setDepth(20);
		this.effectLayer = this.add.graphics().setDepth(25);
		createLightLabels(this, this.anchors).forEach((label) => label.setDepth(16));

		this.createLightZones();
		this.createHud();
		this.configureKeyboard();
		this.render();

		audioManager.playMusic(this, TRAFFIC_AUDIO.gameMusic.cacheKey);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audioManager.stopMusic());
	}

	update(_time: number, delta: number) {
		const dt = Math.min(delta, 100) / 1000;

		if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
			this.goToTitle();
			return;
		}
		for (const { lightId, keys } of this.keys) {
			if (keys.some((key) => Phaser.Input.Keyboard.JustDown(key))) {
				this.traffic.toggle(lightId);
			}
		}

		this.accumulator += dt;
		while (this.accumulator >= STEP) {
			this.traffic.step(STEP);
			this.accumulator -= STEP;
			this.consumeEvents();
		}

		this.updateEffects(dt);
		this.render();
		this.checkEnd();
	}

	// ---------------------------------------------------------------- entrada

	private createLightZones() {
		for (const anchor of this.anchors) {
			const { x, y, width, height } = anchor.hitArea;
			this.add.zone(x, y, width, height)
				.setOrigin(0)
				.setDepth(17)
				.setInteractive({ useHandCursor: true })
				.on('pointerdown', () => this.traffic.toggle(anchor.lightId))
				.on('pointerover', () => { this.hovered = anchor.lightId; })
				.on('pointerout', () => {
					if (this.hovered === anchor.lightId) this.hovered = null;
				});
		}
	}

	private configureKeyboard() {
		const keyboard = this.input.keyboard!;
		this.keys = KEY_ARMS.flatMap(([arm, codes]) => {
			const anchor = this.anchors.find((candidate) => candidate.arm === arm);
			return anchor ? [{ lightId: anchor.lightId, keys: codes.map((code) => keyboard.addKey(code)) }] : [];
		});
		this.escapeKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
	}

	// ----------------------------------------------------------------- eventos

	private consumeEvents() {
		for (const event of this.traffic.events) {
			this.handleEvent(event);
		}
		this.traffic.events = [];
	}

	private handleEvent(event: TrafficEvent) {
		switch (event.type) {
			case 'spawned':
				this.views.set(event.car.id, this.createCarView(event.car));
				break;
			case 'toggled':
				audioManager.playSfx(this, TRAFFIC_AUDIO.toggle.cacheKey);
				this.hintText.setVisible(false);
				break;
			case 'completed':
				this.destroyView(event.car);
				this.popupAtExit(event.car, event.points);
				audioManager.playSfx(this, TRAFFIC_AUDIO.completed.cacheKey);
				break;
			case 'crash':
				event.cars.forEach((car) => this.destroyView(car));
				this.effects.push({ kind: 'crash', x: event.x, y: event.y, age: 0, duration: 0.7, seed: event.cars[0].id });
				this.cameras.main.shake(260, 0.008);
				audioManager.playSfx(this, TRAFFIC_AUDIO.crash.cacheKey);
				break;
			case 'impatient':
				this.retireImpatient(event.car);
				this.cameras.main.shake(160, 0.004);
				audioManager.playSfx(this, TRAFFIC_AUDIO.impatient.cacheKey);
				break;
			case 'gameOver':
				audioManager.setMusicDucked(true);
				break;
		}
	}

	private createCarView(car: Car): CarView {
		const body = this.add.graphics();
		drawCarBody(body, car.exit.color);
		const lights = this.add.graphics();
		const container = this.add.container(car.x, car.y, [body, lights]).setRotation(car.angle).setDepth(10);
		// La letra va aparte para que no gire con el coche y se lea siempre derecha.
		const letter = this.add.text(car.x, car.y, car.exit.letter, {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: '11px',
			color: inkFor(car.exit.color),
		}).setOrigin(0.5).setDepth(11);
		return { container, lights, letter };
	}

	private destroyView(car: Car) {
		const view = this.views.get(car.id);
		if (!view) {
			return;
		}
		view.container.destroy();
		view.letter.destroy();
		this.views.delete(car.id);
	}

	/** El coche impaciente se va desvaneciendo con la marca de enojo encima. */
	private retireImpatient(car: Car) {
		const view = this.views.get(car.id);
		if (view) {
			this.views.delete(car.id);
			this.tweens.add({
				targets: [view.container, view.letter],
				alpha: 0,
				delay: 250,
				duration: 450,
				onComplete: () => {
					view.container.destroy();
					view.letter.destroy();
				},
			});
		}
		this.effects.push({ kind: 'anger', x: car.x, y: car.y - 4, age: 0, duration: 0.9, seed: car.id });
	}

	/** El "+N" sale del cartel de la salida, del color que tenía la paciencia al arrancar. */
	private popupAtExit(car: Car, points: number) {
		const sign = this.signs.find((candidate) => candidate.exit.id === car.exit.id);
		if (!sign) {
			return;
		}
		const x = sign.x - sign.direction.x * 34;
		const y = sign.y - sign.direction.y * 34 - 6;
		const color = `#${patienceColor(car.scoreFraction).toString(16).padStart(6, '0')}`;
		const text = this.add.text(x, y, `+${points}`, {
			fontFamily: 'Courier New, monospace',
			fontSize: '18px',
			color,
			fontStyle: 'bold',
			stroke: '#05070d',
			strokeThickness: 4,
		}).setOrigin(0.5).setDepth(35);
		this.tweens.add({
			targets: text,
			y: y - 26,
			alpha: 0,
			delay: 300,
			duration: 650,
			onComplete: () => text.destroy(),
		});
	}

	private updateEffects(dt: number) {
		for (const effect of this.effects) {
			effect.age += dt;
		}
		this.effects = this.effects.filter((effect) => effect.age < effect.duration);
	}

	// ------------------------------------------------------------------ dibujo

	private render() {
		const traffic = this.traffic;
		const blinkOn = Math.floor(traffic.time * 2.5) % 2 === 0;

		for (const car of traffic.cars) {
			const view = this.views.get(car.id);
			if (!view) {
				continue;
			}
			view.container.setPosition(car.x, car.y).setRotation(car.angle);
			view.letter.setPosition(car.x, car.y);
			// El guiño se apaga cuando terminó de doblar.
			const turn = car.s < car.route.boxEnd ? car.route.turn : null;
			drawCarLights(view.lights, car.braking, turn, blinkOn);
		}

		this.highlightLayer.clear();
		const hovered = this.anchors.find((anchor) => anchor.lightId === this.hovered);
		if (hovered && traffic.outcome === 'playing') {
			drawApproachHighlight(this.highlightLayer, CENTRO, hovered);
		}

		this.lightLayer.clear();
		for (const anchor of this.anchors) {
			const state = traffic.lights[anchor.lightId];
			drawStopLine(this.highlightLayer, anchor, state);
			drawLight(this.lightLayer, anchor, state, anchor.lightId === this.hovered);
		}

		this.barLayer.clear();
		for (const car of traffic.cars) {
			if (!car.committed && car.patience < car.maxPatience - 0.05) {
				drawPatienceBar(this.barLayer, car.x, car.y, car.patience / car.maxPatience, traffic.time);
			}
		}

		this.effectLayer.clear();
		for (const effect of this.effects) {
			const progress = effect.age / effect.duration;
			if (effect.kind === 'crash') {
				drawCrash(this.effectLayer, effect.x, effect.y, progress, effect.seed);
			} else {
				drawAnger(this.effectLayer, effect.x, effect.y - 26, progress);
			}
		}

		this.renderHud();
	}

	private createHud() {
		const panel = this.add.graphics().setDepth(30);
		panel.fillStyle(0x0b1020, 0.86);
		panel.fillRoundedRect(14, 12, 216, 76, 10);
		panel.fillRoundedRect(570, 12, 216, 76, 10);
		panel.lineStyle(1, 0x2c3a5c, 1);
		panel.strokeRoundedRect(14, 12, 216, 76, 10);
		panel.strokeRoundedRect(570, 12, 216, 76, 10);

		this.add.text(30, 22, i18n.t('traffic.game.score'), LABEL_STYLE).setDepth(31);
		this.scoreText = this.add.text(30, 38, '', VALUE_STYLE).setDepth(31);
		this.add.text(144, 22, i18n.t('traffic.game.lives'), LABEL_STYLE).setDepth(31);
		this.heartLayer = this.add.graphics().setDepth(31);

		this.add.text(586, 22, i18n.t('traffic.game.time'), LABEL_STYLE).setDepth(31);
		this.timeText = this.add.text(586, 38, '', VALUE_STYLE).setDepth(31);
		this.add.text(770, 22, i18n.t('traffic.game.highScore'), LABEL_STYLE).setOrigin(1, 0).setDepth(31);
		this.highScoreText = this.add.text(770, 42, '', { ...VALUE_STYLE, fontSize: '18px', color: '#9eacd0' })
			.setOrigin(1, 0)
			.setDepth(31);

		this.add.text(784, 584, i18n.t('traffic.game.footer'), {
			fontFamily: 'Courier New, monospace',
			fontSize: '11px',
			color: '#c9d1e6',
			backgroundColor: '#0b1020cc',
			padding: { x: 6, y: 3 },
		}).setOrigin(1, 1).setDepth(31);

		// Todo arranca en rojo: el primer coche se detiene y hay que darle paso.
		// El aviso va sobre una manzana para no tapar semáforos ni carriles.
		this.hintText = this.add.text(150, 470, i18n.t('traffic.game.hint'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '15px',
			color: '#f5f7ff',
			fontStyle: 'bold',
			align: 'center',
			lineSpacing: 4,
			wordWrap: { width: 240 },
			backgroundColor: '#0b1020dd',
			padding: { x: 12, y: 8 },
		}).setOrigin(0.5).setDepth(32);
		this.time.delayedCall(HINT_DURATION * 1000, () => this.hintText.setVisible(false));
	}

	private renderHud() {
		const traffic = this.traffic;
		this.scoreText.setText(String(traffic.score));
		this.timeText.setText(formatTime(traffic.time));
		this.highScoreText.setText(String(Math.max(this.highScore, traffic.score)));

		if (String(traffic.lives) === this.heartSignature) {
			return;
		}
		this.heartSignature = String(traffic.lives);
		this.heartLayer.clear();
		for (let index = 0; index < START_LIVES; index += 1) {
			const alive = index < traffic.lives;
			drawHeart(this.heartLayer, 156 + index * 26, 58, 22, alive ? 0xff4d6d : 0x3a3f4f);
		}
	}

	// ------------------------------------------------------------------ salida

	private checkEnd() {
		if (this.finished || this.traffic.outcome !== 'over' || this.traffic.endTimer < END_DELAY) {
			return;
		}
		this.finished = true;
		audioManager.setMusicDucked(false);
		const result: TrafficResult = {
			score: this.traffic.score,
			time: this.traffic.time,
			stats: this.traffic.stats,
		};
		this.scene.start(TRAFFIC_SCENES.OVER, result);
	}

	private goToTitle() {
		audioManager.setMusicDucked(false);
		audioManager.playSfx(this, TRAFFIC_AUDIO.confirm.cacheKey);
		this.scene.start(TRAFFIC_SCENES.TITLE);
	}
}
