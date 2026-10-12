import Phaser from 'phaser';
import { audioManager } from '../../../core/audio/AudioManager';
import { i18n } from '../../../core/i18n/i18n';
import { CORE_SCENES } from '../../../core/sceneKeys';
import { loadTanksAudio, TANKS_AUDIO } from '../audio';
import { ENEMY_SPAWNS, LEVELS, lineupForStage, PLAYER_SPAWN } from '../constants/levels';
import { FIELD, START_LIVES } from '../constants/tuning';
import { drawPowerUpIcon, drawTank, drawTerrain, drawTrees, type View } from '../objects/battleRenderer';
import { POWER_UP_LABELS } from '../objects/labels';
import { Battle, POWER_UP_KINDS, type CampaignState } from '../state/Battle';
import { readHighScore } from '../state/highScore';
import { randomSeed } from '../state/rng';
import { TANKS_SCENES } from '../sceneKeys';

const PREVIEW: View = { x: 478, y: 168, scale: 1.2 };
const PREVIEW_PX = FIELD * PREVIEW.scale;
const PREVIEW_CENTER_X = PREVIEW.x + PREVIEW_PX / 2;

/** Una etapa escrita a mano o una partida con mapas generados. */
type Selection = number | 'random';
const SELECTIONS: Selection[] = [...LEVELS.map((_, index) => index + 1), 'random'];

/** Se recuerdan la elección y la semilla mientras el arcade siga abierto. */
let lastSelection: Selection = 1;
let lastSeed = randomSeed();

/** Pantalla de inicio: controles, bonus y elección de etapa con su mapa. */
export class TanksTitleScene extends Phaser.Scene {
	private selection: Selection = 1;
	private seed = 0;
	private hintText!: Phaser.GameObjects.Text;
	private previewTerrain!: Phaser.GameObjects.Graphics;
	private previewActors!: Phaser.GameObjects.Graphics;
	private previewTrees!: Phaser.GameObjects.Graphics;
	private stageText!: Phaser.GameObjects.Text;

	private enterKey!: Phaser.Input.Keyboard.Key;
	private escapeKey!: Phaser.Input.Keyboard.Key;
	private leftKey!: Phaser.Input.Keyboard.Key;
	private rightKey!: Phaser.Input.Keyboard.Key;
	private rerollKey!: Phaser.Input.Keyboard.Key;

	constructor() {
		super(TANKS_SCENES.TITLE);
	}

	preload() {
		loadTanksAudio(this, TANKS_AUDIO.introMusic, TANKS_AUDIO.confirm, TANKS_AUDIO.select);
	}

	create() {
		this.selection = lastSelection;
		this.seed = lastSeed;
		this.cameras.main.setBackgroundColor('#080d1a');
		this.drawBackground();
		this.drawLogo();
		this.drawInstructions();
		this.drawPowerUps();
		this.createStagePicker();
		this.createButtons();
		this.refreshPreview();

		audioManager.playMusic(this, TANKS_AUDIO.introMusic.cacheKey);
		// La música pertenece a esta pantalla: al salir no debe seguir sonando.
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audioManager.stopMusic());

		const keyboard = this.input.keyboard!;
		this.enterKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
		this.escapeKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
		this.leftKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
		this.rightKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
		this.rerollKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.N);
	}

	update() {
		if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
			this.startGame();
			return;
		}
		if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
			this.goToLauncher();
			return;
		}
		if (Phaser.Input.Keyboard.JustDown(this.leftKey)) {
			this.changeStage(-1);
		}
		if (Phaser.Input.Keyboard.JustDown(this.rightKey)) {
			this.changeStage(1);
		}
		if (Phaser.Input.Keyboard.JustDown(this.rerollKey)) {
			this.reroll();
		}
	}

	private drawBackground() {
		const graphics = this.add.graphics();
		graphics.fillStyle(0x101b36, 1);
		graphics.fillCircle(690, 40, 270);
		graphics.fillStyle(0x17234a, 0.55);
		graphics.fillCircle(90, 570, 220);

		graphics.lineStyle(1, 0x29416f, 0.18);
		for (let x = 0; x <= 800; x += 40) {
			graphics.lineBetween(x, 0, x, 600);
		}
		for (let y = 0; y <= 600; y += 40) {
			graphics.lineBetween(0, y, 800, y);
		}
	}

	private drawLogo() {
		this.add.text(400, 60, i18n.t('tanks.catalog.title'), {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: '62px',
			color: '#f2c14e',
			letterSpacing: 10,
			stroke: '#5a2a12',
			strokeThickness: 6,
		}).setOrigin(0.5);

		this.add.text(400, 112, i18n.t('tanks.title.tagline'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '13px',
			color: '#7384aa',
			letterSpacing: 3,
		}).setOrigin(0.5);

		this.add.text(770, 20, `${i18n.t('tanks.title.highScore')}  ${readHighScore()}`, {
			fontFamily: 'Courier New, monospace',
			fontSize: '13px',
			color: '#9eacd0',
		}).setOrigin(1, 0);
	}

	private drawInstructions() {
		this.add.text(70, 150, i18n.t('tanks.title.howToPlay'), this.labelStyle());
		this.add.text(70, 172, i18n.t('tanks.title.controls'), {
			fontFamily: 'Courier New, monospace',
			fontSize: '14px',
			color: '#d9e2ff',
			lineSpacing: 6,
		});
		this.add.text(70, 252, i18n.t('tanks.title.goal'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '13px',
			color: '#9eacd0',
			lineSpacing: 4,
		});
	}

	private drawPowerUps() {
		this.add.text(70, 310, i18n.t('tanks.title.powerUps'), this.labelStyle());
		const graphics = this.add.graphics();
		POWER_UP_KINDS.forEach((kind, index) => {
			const x = 70 + (index % 2) * 190;
			const y = 334 + Math.floor(index / 2) * 40;
			drawPowerUpIcon(graphics, x, y, 26, kind);
			this.add.text(x + 36, y - 1, i18n.t(POWER_UP_LABELS[kind].name), {
				fontFamily: 'Courier New, monospace',
				fontSize: '12px',
				color: '#f5f7ff',
				fontStyle: 'bold',
			});
			this.add.text(x + 36, y + 14, i18n.t(POWER_UP_LABELS[kind].hint), {
				fontFamily: 'Arial, sans-serif',
				fontSize: '11px',
				color: '#7384aa',
			});
		});
	}

	private createStagePicker() {
		this.stageText = this.add.text(PREVIEW_CENTER_X, 146, '', {
			fontFamily: 'Courier New, monospace',
			fontSize: '18px',
			color: '#f5f7ff',
			fontStyle: 'bold',
		}).setOrigin(0.5);

		for (const [label, offset, delta] of [['◀', -134, -1], ['▶', 134, 1]] as const) {
			this.add.text(PREVIEW_CENTER_X + offset, 146, label, {
				fontFamily: 'Arial, sans-serif',
				fontSize: '18px',
				color: '#f2c14e',
			}).setOrigin(0.5)
				.setInteractive({ useHandCursor: true })
				.on('pointerdown', () => this.changeStage(delta));
		}

		// Un click sobre el mapa aleatorio pide otro, igual que la tecla N.
		this.add.rectangle(PREVIEW.x, PREVIEW.y, PREVIEW_PX, PREVIEW_PX)
			.setOrigin(0)
			.setStrokeStyle(2, 0x29416f)
			.setDepth(1)
			.setInteractive()
			.on('pointerdown', () => this.reroll());
		this.previewTerrain = this.add.graphics();
		this.previewActors = this.add.graphics();
		this.previewTrees = this.add.graphics();

		this.hintText = this.add.text(PREVIEW_CENTER_X, PREVIEW.y + PREVIEW_PX + 18, '', {
			fontFamily: 'Courier New, monospace',
			fontSize: '12px',
			color: '#64759f',
		}).setOrigin(0.5);
	}

	/** El mapa sale de una `Battle` real: así la vista previa nunca se desfasa del juego. */
	private refreshPreview() {
		const random = this.selection === 'random';
		this.stageText.setText(random
			? `${i18n.t('tanks.title.random')}  #${this.seed}`
			: `${i18n.t('tanks.title.stage')}  ${this.selection}`);
		this.hintText.setText(random
			? `${i18n.t('tanks.title.stageHint')}   ·   ${i18n.t('tanks.title.reroll')}`
			: i18n.t('tanks.title.stageHint'));
		const battle = new Battle(this.campaign(), () => 0.5);
		drawTerrain(this.previewTerrain, battle, PREVIEW, 0);
		drawTrees(this.previewTrees, battle, PREVIEW);

		this.previewActors.clear();
		drawTank(this.previewActors, PREVIEW, {
			kind: 'player', x: PLAYER_SPAWN.x, y: PLAYER_SPAWN.y, dir: 'up', hp: 1, bonus: false, travelled: 0,
		}, 1);
		const lineup = lineupForStage(this.campaign().stage);
		const kinds = (['armor', 'power', 'fast'] as const).filter((kind) => lineup[kind] > 0);
		ENEMY_SPAWNS.forEach((spawn, index) => {
			drawTank(this.previewActors, PREVIEW, {
				kind: kinds[index] ?? 'basic', x: spawn.x, y: spawn.y, dir: 'down', hp: 4, bonus: false, travelled: 0,
			}, 1);
		});
	}

	private changeStage(delta: number) {
		const index = Phaser.Math.Wrap(SELECTIONS.indexOf(this.selection) + delta, 0, SELECTIONS.length);
		this.selection = SELECTIONS[index];
		lastSelection = this.selection;
		audioManager.playSfx(this, TANKS_AUDIO.select.cacheKey);
		this.refreshPreview();
	}

	private reroll() {
		if (this.selection !== 'random') {
			return;
		}
		this.seed = randomSeed();
		lastSeed = this.seed;
		audioManager.playSfx(this, TANKS_AUDIO.select.cacheKey);
		this.refreshPreview();
	}

	private createButtons() {
		const playButton = this.add.rectangle(400, 486, 270, 50, 0x18365b)
			.setStrokeStyle(2, 0xf2c14e)
			.setInteractive({ useHandCursor: true });
		this.add.text(400, 486, i18n.t('tanks.title.play'), {
			fontFamily: 'Courier New, monospace',
			fontSize: '18px',
			color: '#ffffff',
		}).setOrigin(0.5);
		playButton.on('pointerdown', () => this.startGame());

		const backButton = this.add.rectangle(400, 548, 270, 38, 0x111a31)
			.setStrokeStyle(1, 0x40577f)
			.setInteractive({ useHandCursor: true });
		this.add.text(400, 548, i18n.t('tanks.title.backToArcade'), {
			fontFamily: 'Courier New, monospace',
			fontSize: '13px',
			color: '#9eacd0',
		}).setOrigin(0.5);
		backButton.on('pointerdown', () => this.goToLauncher());
	}

	private labelStyle(): Phaser.Types.GameObjects.Text.TextStyle {
		return { fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#7384aa', letterSpacing: 3 };
	}

	private campaign(): CampaignState {
		return this.selection === 'random'
			? { stage: 1, score: 0, lives: START_LIVES, playerLevel: 0, seed: this.seed }
			: { stage: this.selection, score: 0, lives: START_LIVES, playerLevel: 0 };
	}

	private startGame() {
		audioManager.playSfx(this, TANKS_AUDIO.confirm.cacheKey);
		this.scene.start(TANKS_SCENES.GAME, this.campaign());
	}

	private goToLauncher() {
		audioManager.playSfx(this, TANKS_AUDIO.confirm.cacheKey);
		this.scene.start(CORE_SCENES.LAUNCHER);
	}
}
