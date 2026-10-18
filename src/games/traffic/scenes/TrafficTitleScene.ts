import Phaser from 'phaser';
import { audioManager } from '../../../core/audio/AudioManager';
import { i18n } from '../../../core/i18n/i18n';
import { CORE_SCENES } from '../../../core/sceneKeys';
import { loadTrafficAudio, TRAFFIC_AUDIO } from '../audio';
import { CENTRO, type ArmId, type Turn } from '../constants/layouts';
import { CAR_LENGTH, MIN_GAP } from '../constants/tuning';
import { drawCarBody, drawCarLights, drawPatienceBar } from '../objects/carRenderer';
import { drawCity, drawExitSigns, exitSigns, inkFor } from '../objects/cityRenderer';
import { createLightLabels, createSignLetters } from '../objects/labels';
import { drawLight, drawStopLine, lightAnchors } from '../objects/lightRenderer';
import { readHighScore } from '../state/highScore';
import { buildRoutes, poseAt, type Route } from '../state/routes';
import { TRAFFIC_SCENES } from '../sceneKeys';

/** Coches de muestra esperando en rojo: uno por acceso, con giros distintos. */
const DEMO: Array<{ arm: ArmId; turn: Turn; queue: number; patience: number }> = [
	{ arm: 'N', turn: 'left', queue: 0, patience: 1 },
	{ arm: 'E', turn: 'straight', queue: 0, patience: 1 },
	{ arm: 'S', turn: 'right', queue: 0, patience: 1 },
	{ arm: 'W', turn: 'straight', queue: 0, patience: 0.75 },
	{ arm: 'W', turn: 'left', queue: 1, patience: 0.45 },
];

/** Pantalla inicial: la intersección con todo en rojo, cómo se juega y los destinos. */
export class TrafficTitleScene extends Phaser.Scene {
	private demoLights: Array<{ graphics: Phaser.GameObjects.Graphics; turn: Turn }> = [];
	private enterKey!: Phaser.Input.Keyboard.Key;
	private escapeKey!: Phaser.Input.Keyboard.Key;

	constructor() {
		super(TRAFFIC_SCENES.TITLE);
	}

	preload() {
		loadTrafficAudio(this, TRAFFIC_AUDIO.titleMusic, TRAFFIC_AUDIO.confirm);
	}

	create() {
		this.cameras.main.setBackgroundColor('#080d1a');
		this.drawIntersection();
		this.drawLogo();
		this.drawHowToPlay();
		this.drawDestinations();
		this.createPlayButton();

		audioManager.playMusic(this, TRAFFIC_AUDIO.titleMusic.cacheKey);
		// La música pertenece a esta pantalla: al salir no debe seguir sonando.
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audioManager.stopMusic());

		const keyboard = this.input.keyboard!;
		this.enterKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
		this.escapeKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
	}

	update(time: number) {
		const blinkOn = Math.floor((time / 1000) * 2.5) % 2 === 0;
		for (const { graphics, turn } of this.demoLights) {
			drawCarLights(graphics, true, turn, blinkOn);
		}

		if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
			this.startGame();
			return;
		}
		if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
			this.goToLauncher();
		}
	}

	private drawIntersection() {
		const city = this.add.graphics();
		drawCity(city, CENTRO);
		const signs = exitSigns(CENTRO);
		drawExitSigns(city, signs);
		createSignLetters(this, signs);

		const anchors = lightAnchors(CENTRO);
		const lights = this.add.graphics().setDepth(15);
		for (const anchor of anchors) {
			drawStopLine(city, anchor, 'red');
			drawLight(lights, anchor, 'red', false);
		}
		createLightLabels(this, anchors).forEach((label) => label.setDepth(16));

		const routes = buildRoutes(CENTRO);
		const bars = this.add.graphics().setDepth(20);
		this.demoLights = [];
		for (const demo of DEMO) {
			const route = routes.find((candidate) => candidate.entryArm === demo.arm && candidate.turn === demo.turn);
			if (route) {
				this.addDemoCar(route, demo.queue, demo.turn);
				if (demo.patience < 1) {
					const pose = poseAt(route, route.stopAt - demo.queue * (CAR_LENGTH + MIN_GAP));
					drawPatienceBar(bars, pose.x, pose.y, demo.patience, 0.5);
				}
			}
		}
	}

	private addDemoCar(route: Route, queue: number, turn: Turn) {
		const pose = poseAt(route, route.stopAt - queue * (CAR_LENGTH + MIN_GAP));
		const body = this.add.graphics();
		drawCarBody(body, route.exit.color);
		const lights = this.add.graphics();
		this.add.container(pose.x, pose.y, [body, lights]).setRotation(pose.angle).setDepth(10);
		this.add.text(pose.x, pose.y, route.exit.letter, {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: '11px',
			color: inkFor(route.exit.color),
		}).setOrigin(0.5).setDepth(11);
		this.demoLights.push({ graphics: lights, turn });
	}

	private drawLogo() {
		this.add.text(400, 72, i18n.t('traffic.catalog.title'), {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: '58px',
			color: '#3ddc84',
			letterSpacing: 8,
			stroke: '#0b1020',
			strokeThickness: 8,
		}).setOrigin(0.5).setDepth(30);

		this.add.text(400, 116, i18n.t('traffic.title.tagline'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '13px',
			color: '#f5f7ff',
			letterSpacing: 3,
			backgroundColor: '#0b1020cc',
			padding: { x: 8, y: 4 },
		}).setOrigin(0.5).setDepth(30);

		this.add.text(784, 10, `${i18n.t('traffic.title.highScore')}  ${readHighScore()}`, {
			fontFamily: 'Courier New, monospace',
			fontSize: '13px',
			color: '#f5f7ff',
			backgroundColor: '#0b1020cc',
			padding: { x: 6, y: 3 },
		}).setOrigin(1, 0).setDepth(30);
	}

	private drawHowToPlay() {
		this.panel(16, 392, 270, 192);
		this.add.text(32, 406, i18n.t('traffic.title.howToPlay'), this.labelStyle()).setDepth(31);
		this.add.text(32, 428, i18n.t('traffic.title.rules'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '13px',
			color: '#d9e2ff',
			lineSpacing: 5,
			wordWrap: { width: 240 },
		}).setDepth(31);
	}

	private drawDestinations() {
		this.panel(514, 392, 270, 192);
		this.add.text(530, 406, i18n.t('traffic.title.destinations'), this.labelStyle()).setDepth(31);

		const swatches = this.add.graphics().setDepth(31);
		Object.values(CENTRO.crossings[0].arms).forEach((arm, index) => {
			const x = 544 + index * 58;
			swatches.fillStyle(arm.exit.color, 1);
			swatches.fillRoundedRect(x - 14, 430, 28, 28, 6);
			this.add.text(x, 444, arm.exit.letter, {
				fontFamily: 'Arial Black, Arial, sans-serif',
				fontSize: '16px',
				color: inkFor(arm.exit.color),
			}).setOrigin(0.5).setDepth(32);
		});
		this.add.text(530, 470, i18n.t('traffic.title.destinationsHint'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '12px',
			color: '#9eacd0',
			lineSpacing: 4,
			wordWrap: { width: 240 },
		}).setDepth(31);

		const back = this.add.rectangle(649, 556, 238, 34, 0x111a31)
			.setStrokeStyle(1, 0x40577f)
			.setDepth(31)
			.setInteractive({ useHandCursor: true });
		this.add.text(649, 556, i18n.t('traffic.title.backToArcade'), {
			fontFamily: 'Courier New, monospace',
			fontSize: '12px',
			color: '#9eacd0',
		}).setOrigin(0.5).setDepth(32);
		back.on('pointerdown', () => this.goToLauncher());
	}

	/** El botón de jugar ocupa el centro del cruce. */
	private createPlayButton() {
		const button = this.add.rectangle(400, 300, 150, 50, 0x0f2b1f, 0.95)
			.setStrokeStyle(2, 0x3ddc84)
			.setDepth(30)
			.setInteractive({ useHandCursor: true });
		this.add.text(400, 300, i18n.t('traffic.title.play'), {
			fontFamily: 'Courier New, monospace',
			fontSize: '17px',
			color: '#ffffff',
			fontStyle: 'bold',
		}).setOrigin(0.5).setDepth(31);
		button.on('pointerdown', () => this.startGame());
		this.tweens.add({ targets: button, alpha: 0.75, duration: 700, yoyo: true, repeat: -1 });
	}

	private panel(x: number, y: number, width: number, height: number) {
		const graphics = this.add.graphics().setDepth(30);
		graphics.fillStyle(0x0b1020, 0.9);
		graphics.fillRoundedRect(x, y, width, height, 10);
		graphics.lineStyle(1, 0x2c3a5c, 1);
		graphics.strokeRoundedRect(x, y, width, height, 10);
	}

	private labelStyle(): Phaser.Types.GameObjects.Text.TextStyle {
		return { fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#7384aa', letterSpacing: 3 };
	}

	private startGame() {
		audioManager.playSfx(this, TRAFFIC_AUDIO.confirm.cacheKey);
		this.scene.start(TRAFFIC_SCENES.GAME);
	}

	private goToLauncher() {
		audioManager.playSfx(this, TRAFFIC_AUDIO.confirm.cacheKey);
		this.scene.start(CORE_SCENES.LAUNCHER);
	}
}
