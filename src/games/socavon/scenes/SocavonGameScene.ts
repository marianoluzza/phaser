import Phaser from 'phaser';
import { audioManager } from '../../../core/audio/AudioManager';
import { i18n, type TranslationKey } from '../../../core/i18n/i18n';
import { GAME_WIDTH, useFullWidth } from '../../../core/renderScale';
import { loadSocavonAudio, SOCAVON_AUDIO, type SocavonAudioAsset } from '../audio';
import { loadSocavonArt, sharpenSocavonArt } from '../objects/art';
import { centerX, feetY } from '../objects/geometry';
import { Hud, HUD_BOTTOM, HUD_TOP } from '../objects/Hud';
import { MineView } from '../objects/MineView';
import { phrase } from '../objects/ui';
import { SOCAVON_SCENES } from '../sceneKeys';
import { minePlan } from '../state/campaign';
import { parseLevel } from '../state/level';
import { Mine, type MineEvent, type MineInput } from '../state/Mine';
import { newRun, type Run } from '../state/run';

const STEP = 1 / 60;
/** Tras un tirón no se recupera más que esto: evita atropellos invisibles. */
const MAX_FRAME = 0.1;
const BELL_EVERY = 1.1;

const EVENT_SOUNDS: Partial<Record<MineEvent['type'], SocavonAudioAsset>> = {
	take: SOCAVON_AUDIO.take,
	load: SOCAVON_AUDIO.take,
	drop: SOCAVON_AUDIO.drop,
	land: SOCAVON_AUDIO.drop,
	hide: SOCAVON_AUDIO.hide,
	grip: SOCAVON_AUDIO.hide,
	slip: SOCAVON_AUDIO.locked,
	board: SOCAVON_AUDIO.take,
	alight: SOCAVON_AUDIO.drop,
	locked: SOCAVON_AUDIO.locked,
	lamp: SOCAVON_AUDIO.lamp,
	relight: SOCAVON_AUDIO.lamp,
	silence: SOCAVON_AUDIO.lamp,
	hit: SOCAVON_AUDIO.hit,
	wallBroken: SOCAVON_AUDIO.wallBroken,
	stunned: SOCAVON_AUDIO.hit,
	cartStart: SOCAVON_AUDIO.cartStart,
	vault: SOCAVON_AUDIO.vault,
	deliver: SOCAVON_AUDIO.deliver,
	key: SOCAVON_AUDIO.key,
	spotted: SOCAVON_AUDIO.spotted,
	lifeLost: SOCAVON_AUDIO.caught,
	cleared: SOCAVON_AUDIO.cleared,
};

const EVENT_NOTICES: Partial<Record<MineEvent['type'], TranslationKey>> = {
	key: 'socavon.notice.key',
	vault: 'socavon.notice.vault',
	locked: 'socavon.notice.locked',
	silence: 'socavon.notice.silence',
	ring: 'socavon.notice.ring',
	spotted: 'socavon.notice.spotted',
	slip: 'socavon.notice.slip',
	lifeLost: 'socavon.notice.caught',
};

const MINE_NAMES: Record<'entrance' | 'rails' | 'deep', TranslationKey> = {
	entrance: 'socavon.mine.entrance',
	rails: 'socavon.mine.rails',
	deep: 'socavon.mine.deep',
};

/**
 * Traduce teclas a entradas, avanza `Mine` con paso fijo y dibuja. Las reglas
 * están todas en `state/`.
 */
export class SocavonGameScene extends Phaser.Scene {
	private run: Run = newRun();
	private mine!: Mine;
	private view!: MineView;
	private hud!: Hud;
	private accumulator = 0;
	private bellTimer = 0;
	private paused = false;
	private follow = { x: 0, y: 0 };
	private pressed = { use: false, lamp: false, headlamp: false };

	private keys!: Record<
		'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'use' | 'lamp' | 'headlamp' | 'pause' | 'escape' | 'enter',
		Phaser.Input.Keyboard.Key
	>;

	constructor() {
		super(SOCAVON_SCENES.GAME);
	}

	init(data: { run?: Run }) {
		this.run = data.run ?? newRun();
	}

	preload() {
		loadSocavonArt(this);
		loadSocavonAudio(this, ...Object.values(SOCAVON_AUDIO));
	}

	create() {
		useFullWidth(this, () => this.layout());
		sharpenSocavonArt(this);
		this.cameras.main.setBackgroundColor('#0b0708');
		this.accumulator = 0;
		this.bellTimer = 0;
		this.paused = false;
		this.pressed = { use: false, lamp: false, headlamp: false };

		const plan = minePlan(this.run);
		this.mine = new Mine(parseLevel(plan.rows), this.run);
		this.view = new MineView(this, this.mine);
		const name = plan.id
			? i18n.t(MINE_NAMES[plan.id])
			: phrase('socavon.mine.generated', { depth: this.run.depth, seed: this.run.seed });
		this.hud = new Hud(this, name);
		this.hud.showNotice('socavon.notice.start', 4);

		this.createKeys();
		this.moveCamera(Infinity);
		this.view.update(0);
		this.hud.update(this.mine, 0);

		audioManager.continueMusic(this, SOCAVON_AUDIO.gameMusic.cacheKey);
		audioManager.setMusicDucked(false);
	}

	private createKeys() {
		const keyboard = this.input.keyboard!;
		const { KeyCodes } = Phaser.Input.Keyboard;
		this.keys = {
			up: keyboard.addKey(KeyCodes.UP),
			down: keyboard.addKey(KeyCodes.DOWN),
			left: keyboard.addKey(KeyCodes.LEFT),
			right: keyboard.addKey(KeyCodes.RIGHT),
			w: keyboard.addKey(KeyCodes.W),
			a: keyboard.addKey(KeyCodes.A),
			s: keyboard.addKey(KeyCodes.S),
			d: keyboard.addKey(KeyCodes.D),
			use: keyboard.addKey(KeyCodes.SPACE),
			lamp: keyboard.addKey(KeyCodes.Z),
			headlamp: keyboard.addKey(KeyCodes.X),
			pause: keyboard.addKey(KeyCodes.P),
			escape: keyboard.addKey(KeyCodes.ESC),
			enter: keyboard.addKey(KeyCodes.ENTER),
		};
	}

	update(_time: number, delta: number) {
		const { JustDown } = Phaser.Input.Keyboard;
		if (JustDown(this.keys.escape)) {
			this.leave();
			return;
		}
		if (this.mine.status === 'cleared') {
			if (JustDown(this.keys.enter)) this.nextMine();
			return;
		}
		if (JustDown(this.keys.pause)) this.togglePause();
		if (this.paused) return;

		// Una pulsación espera al próximo paso: un frame puede no tener ninguno.
		if (JustDown(this.keys.use)) this.pressed.use = true;
		if (JustDown(this.keys.lamp)) this.pressed.lamp = true;
		if (JustDown(this.keys.headlamp)) this.pressed.headlamp = true;

		const dt = Math.min(delta / 1000, MAX_FRAME);
		const events: MineEvent[] = [];
		this.accumulator += dt;
		while (this.accumulator >= STEP) {
			this.accumulator -= STEP;
			events.push(...this.mine.step(STEP, this.readInput()));
			this.pressed = { use: false, lamp: false, headlamp: false };
		}

		for (const event of events) this.react(event);
		this.ringBell(dt);
		this.view.update(dt);
		this.hud.update(this.mine, dt);
		this.moveCamera(dt);

		if (events.some((event) => event.type === 'over')) this.finish();
		else if (events.some((event) => event.type === 'cleared')) this.celebrate();
	}

	private readInput(): MineInput {
		const { keys } = this;
		return {
			x: Number(keys.right.isDown || keys.d.isDown) - Number(keys.left.isDown || keys.a.isDown),
			y: Number(keys.down.isDown || keys.s.isDown) - Number(keys.up.isDown || keys.w.isDown),
			...this.pressed,
		};
	}

	private react(event: MineEvent) {
		this.view.react(event);
		const sound = EVENT_SOUNDS[event.type];
		if (sound) audioManager.playSfx(this, sound.cacheKey);
		const notice = EVENT_NOTICES[event.type];
		if (notice) this.hud.showNotice(notice);
	}

	private ringBell(dt: number) {
		if (this.mine.alarm <= 0 || this.mine.status !== 'playing') {
			this.bellTimer = 0;
			return;
		}
		this.bellTimer -= dt;
		if (this.bellTimer > 0) return;
		this.bellTimer = BELL_EVERY;
		audioManager.playSfx(this, SOCAVON_AUDIO.bell.cacheKey);
	}

	/** Sigue al minero sin mostrar nada fuera de la mina. */
	private moveCamera(dt: number) {
		const { player } = this.mine;
		const { width, height } = this.view;
		const visible = 600 - HUD_TOP - HUD_BOTTOM;
		const x = width <= GAME_WIDTH
			? (GAME_WIDTH - width) / 2
			: Phaser.Math.Clamp(GAME_WIDTH / 2 - centerX(player.x), GAME_WIDTH - width, 0);
		const y = height <= visible
			? HUD_TOP + (visible - height) / 2
			: Phaser.Math.Clamp(
				HUD_TOP + visible / 2 + 40 - feetY(player.y),
				HUD_TOP + visible - height,
				HUD_TOP
			);
		const ease = dt === Infinity ? 1 : 1 - Math.exp(-dt * 8);
		this.follow.x = ease === 1 ? x : this.follow.x + (x - this.follow.x) * ease;
		this.follow.y = ease === 1 ? y : this.follow.y + (y - this.follow.y) * ease;
		this.view.root.setPosition(Math.round(this.follow.x), Math.round(this.follow.y));
	}

	private layout() {
		this.hud.layout();
		this.moveCamera(Infinity);
	}

	private togglePause() {
		this.paused = !this.paused;
		audioManager.playSfx(this, SOCAVON_AUDIO.pauseToggle.cacheKey);
		audioManager.setMusicDucked(this.paused);
		if (this.paused) this.tweens.pauseAll();
		else this.tweens.resumeAll();
		this.hud.showBanner(
			this.paused ? i18n.t('socavon.pause.title') : null,
			i18n.t('socavon.pause.text')
		);
	}

	private celebrate() {
		audioManager.setMusicDucked(true);
		this.hud.showBanner(
			i18n.t('socavon.cleared.title'),
			[
				phrase('socavon.hud.score', { score: this.mine.score }),
				i18n.t(this.mine.seen ? 'socavon.cleared.seen' : 'socavon.cleared.unseen'),
				'',
				i18n.t('socavon.cleared.next'),
			].join('\n')
		);
	}

	private nextMine() {
		const { score, lives } = this.mine;
		const run: Run = { ...this.run, score, lives, depth: this.run.depth + 1 };
		this.scene.restart({ run });
	}

	private finish() {
		audioManager.stopMusic();
		this.scene.start(SOCAVON_SCENES.RESULT, { run: { ...this.run, score: this.mine.score, lives: 0 } });
	}

	private leave() {
		audioManager.stopMusic();
		this.scene.start(SOCAVON_SCENES.TITLE);
	}
}
