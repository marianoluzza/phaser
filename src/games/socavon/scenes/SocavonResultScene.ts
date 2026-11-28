import Phaser from 'phaser';
import { audioManager } from '../../../core/audio/AudioManager';
import { i18n } from '../../../core/i18n/i18n';
import { Controls } from '../../../core/input/controls';
import { CORE_SCENES } from '../../../core/sceneKeys';
import { loadSocavonAudio, SOCAVON_AUDIO } from '../audio';
import { addClip, loadSocavonArt, sharpenSocavonArt, showClip } from '../objects/art';
import { addButton, addLabel, COLORS, phrase, TITLE_FONT } from '../objects/ui';
import { SOCAVON_SCENES } from '../sceneKeys';
import { newRun, readHighScore, submitHighScore, type Run } from '../state/run';

/** Fin de la partida: puntaje, récord y salidas. */
export class SocavonResultScene extends Phaser.Scene {
	private run: Run = newRun();

	private controls!: Controls<'title'>;

	constructor() {
		super(SOCAVON_SCENES.RESULT);
	}

	init(data: { run?: Run }) {
		this.run = data.run ?? newRun();
	}

	preload() {
		loadSocavonArt(this);
		loadSocavonAudio(this, SOCAVON_AUDIO.confirm);
	}

	create() {
		sharpenSocavonArt(this);
		this.cameras.main.setBackgroundColor('#0b0708');
		const { score, depth } = this.run;
		const isRecord = submitHighScore(score);

		for (let x = 56; x <= 744; x += 48) addClip(this, x, 296, 'tiles/floor_a');
		showClip(addClip(this, 356, 248, 'minero/caught'), 'minero/caught', 1);
		addClip(this, 444, 248, 'sereno/idle').setFlipX(true);

		this.add.text(400, 92, i18n.t('socavon.result.title'), {
			fontFamily: TITLE_FONT,
			fontSize: '48px',
			color: COLORS.gold,
		}).setOrigin(0.5);
		addLabel(this, 400, 342, phrase('socavon.result.score', { score }), 24).setOrigin(0.5);
		addLabel(this, 400, 378, phrase('socavon.result.depth', { depth }), 15, COLORS.muted).setOrigin(0.5);
		addLabel(
			this,
			400,
			408,
			isRecord ? i18n.t('socavon.result.newRecord') : phrase('socavon.title.record', { score: readHighScore() }),
			15,
			COLORS.gold
		).setOrigin(0.5);

		addButton(this, 400, 468, 300, i18n.t('socavon.result.retry'), () => this.retry());
		addButton(this, 320, 522, 148, i18n.t('socavon.result.menu'), () => this.scene.start(SOCAVON_SCENES.TITLE));
		addButton(this, 480, 522, 148, i18n.t('socavon.title.back'), () => this.scene.start(CORE_SCENES.LAUNCHER));

		this.controls = new Controls(this, { title: { keys: ['M'], pad: ['y'] } });
	}

	update() {
		const { controls } = this;
		if (controls.justDown('confirm')) this.retry();
		else if (controls.justDown('title')) this.scene.start(SOCAVON_SCENES.TITLE);
		else if (controls.justDown('back')) this.scene.start(CORE_SCENES.LAUNCHER);
	}

	private retry() {
		audioManager.playSfx(this, SOCAVON_AUDIO.confirm.cacheKey);
		this.scene.start(SOCAVON_SCENES.GAME, { run: newRun(this.run.seed, this.run.campaign) });
	}
}
