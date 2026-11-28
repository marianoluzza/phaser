import Phaser from 'phaser';
import { audioManager } from '../../../core/audio/AudioManager';
import { i18n, type TranslationKey } from '../../../core/i18n/i18n';
import { Controls } from '../../../core/input/controls';
import { GAME_WIDTH, useFullWidth } from '../../../core/renderScale';
import { CORE_SCENES } from '../../../core/sceneKeys';
import { loadSocavonAudio, SOCAVON_AUDIO } from '../audio';
import { addClip, loadSocavonArt, sharpenSocavonArt, showClip } from '../objects/art';
import { drawMinimap } from '../objects/minimap';
import { addButton, addLabel, COLORS, phrase, TITLE_FONT } from '../objects/ui';
import { SOCAVON_SCENES } from '../sceneKeys';
import { minePlan } from '../state/campaign';
import { parseLevel } from '../state/level';
import { randomSeed } from '../state/rng';
import { newRun, readHighScore } from '../state/run';

const STEPS: [clip: string, key: TranslationKey][] = [
	['objetos/key', 'socavon.title.stepKey'],
	['objetos/lamp_on', 'socavon.title.stepLight'],
	['objetos/bell', 'socavon.title.stepVault'],
	['objetos/bag', 'socavon.title.stepLoot'],
];

/** Se recuerdan mientras el arcade siga abierto. */
let lastCampaign = true;
let lastSeed = randomSeed();

/** Pantalla de inicio: cómo se juega, modo y plano de la primera mina. */
export class SocavonTitleScene extends Phaser.Scene {
	private left = 0;
	private elapsed = 0;
	private map!: Phaser.GameObjects.Graphics;
	private modeText!: Phaser.GameObjects.Text;
	private seedText!: Phaser.GameObjects.Text;
	private miner!: Phaser.GameObjects.Image;
	private guard!: Phaser.GameObjects.Image;

	private controls!: Controls<'reroll'>;

	constructor() {
		super(SOCAVON_SCENES.TITLE);
	}

	preload() {
		loadSocavonArt(this);
		loadSocavonAudio(this, SOCAVON_AUDIO.titleMusic, SOCAVON_AUDIO.confirm, SOCAVON_AUDIO.select);
	}

	create() {
		useFullWidth(this);
		sharpenSocavonArt(this);
		this.left = (GAME_WIDTH - 800) / 2;
		this.elapsed = 0;
		this.cameras.main.setBackgroundColor('#0b0708');

		this.drawHeader();
		this.drawInstructions();
		this.drawPicker();
		this.refreshPicker();

		audioManager.continueMusic(this, SOCAVON_AUDIO.titleMusic.cacheKey);

		this.controls = new Controls(this, { reroll: { keys: ['N'], pad: ['y'] } });
	}

	update(_time: number, delta: number) {
		this.elapsed += delta / 1000;
		showClip(this.miner, 'minero/carry', this.elapsed);
		showClip(this.guard, 'sereno/run', this.elapsed);

		const { controls } = this;
		if (controls.justDown('confirm')) this.startGame();
		else if (controls.justDown('back')) this.goToLauncher();
		else if (controls.justDown('left') || controls.justDown('right')) this.changeMode();
		else if (controls.justDown('reroll')) this.reroll();
	}

	private drawHeader() {
		// Una galería de lado a lado con la persecución.
		for (let x = 24; x < GAME_WIDTH + 48; x += 48) {
			const variant = x % 144 === 24 ? 'b' : 'a';
			addClip(this, x, 48, `tiles/back_${variant}`).setTint(0x8c8080);
			addClip(this, x, 96, `tiles/back_${variant}`).setTint(0x8c8080);
			addClip(this, x, 144, `tiles/back_${variant}`).setTint(0x8c8080);
			addClip(this, x, 192, `tiles/floor_${variant}`);
		}
		this.guard = addClip(this, this.left + 70, 144, 'sereno/run');
		this.miner = addClip(this, this.left + 732, 144, 'minero/carry');

		this.add.text(GAME_WIDTH / 2, 56, i18n.t('socavon.catalog.title'), {
			fontFamily: TITLE_FONT,
			fontSize: '62px',
			color: COLORS.gold,
			letterSpacing: 8,
			stroke: '#120c0e',
			strokeThickness: 8,
		}).setOrigin(0.5);
		addLabel(this, GAME_WIDTH / 2, 114, i18n.t('socavon.title.tagline'), 14).setOrigin(0.5);
		addLabel(this, GAME_WIDTH / 2, 214, phrase('socavon.title.record', { score: readHighScore() }), 14, COLORS.gold)
			.setOrigin(0.5);
	}

	private drawInstructions() {
		STEPS.forEach(([clip, key], index) => {
			const y = 278 + index * 54;
			// Centrados en lo que se ve, no en su pie: la lámpara y la campana cuelgan.
			const icon = addClip(this, this.left + 52, y - 4, clip, 1.5);
			const { frame } = icon;
			// En un cuadro recortado, x, y, width y height son lo que quedó con píxeles.
			icon.setOrigin((frame.x + frame.width / 2) / frame.realWidth, (frame.y + frame.height / 2) / frame.realHeight);
			addLabel(this, this.left + 92, y - 4, i18n.t(key), 14)
				.setOrigin(0, 0.5)
				.setWordWrapWidth(270);
		});
		addLabel(this, this.left + 30, 482, i18n.t('socavon.title.controls'), 13, COLORS.paper).setLineSpacing(4);
	}

	private drawPicker() {
		const x = this.left + 580;
		this.add.rectangle(x, 365, 372, 244, COLORS.panel).setStrokeStyle(2, COLORS.border);
		this.modeText = addLabel(this, x, 266, '', 17, COLORS.gold).setOrigin(0.5);
		this.map = this.add.graphics();
		this.seedText = addLabel(this, x, 468, '', 13, COLORS.muted)
			.setOrigin(0.5)
			.setInteractive({ useHandCursor: true })
			.on('pointerdown', () => this.reroll());

		for (const side of [-1, 1]) {
			addLabel(this, x + side * 160, 266, side < 0 ? '◀' : '▶', 17)
				.setOrigin(0.5)
				.setInteractive({ useHandCursor: true })
				.on('pointerdown', () => this.changeMode());
		}

		addButton(this, x - 82, 532, 208, i18n.t('socavon.title.start'), () => this.startGame());
		addButton(this, x + 112, 532, 148, i18n.t('socavon.title.back'), () => this.goToLauncher());
	}

	private refreshPicker() {
		this.modeText.setText(i18n.t(lastCampaign ? 'socavon.title.campaign' : 'socavon.title.endless'));
		this.seedText.setText(lastCampaign
			? i18n.t('socavon.title.campaignHint')
			: phrase('socavon.title.seed', { seed: lastSeed }));
		const level = parseLevel(minePlan(newRun(lastSeed, lastCampaign)).rows);
		drawMinimap(this.map, level, { x: this.left + 412, y: 288, width: 336, height: 164 });
	}

	private changeMode() {
		lastCampaign = !lastCampaign;
		audioManager.playSfx(this, SOCAVON_AUDIO.select.cacheKey);
		this.refreshPicker();
	}

	private reroll() {
		if (lastCampaign) return;
		lastSeed = randomSeed();
		audioManager.playSfx(this, SOCAVON_AUDIO.select.cacheKey);
		this.refreshPicker();
	}

	private startGame() {
		audioManager.playSfx(this, SOCAVON_AUDIO.confirm.cacheKey);
		audioManager.stopMusic();
		this.scene.start(SOCAVON_SCENES.GAME, { run: newRun(lastSeed, lastCampaign) });
	}

	private goToLauncher() {
		audioManager.stopMusic();
		this.scene.start(CORE_SCENES.LAUNCHER);
	}
}
