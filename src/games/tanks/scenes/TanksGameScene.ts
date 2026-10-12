import Phaser from 'phaser';
import { audioManager } from '../../../core/audio/AudioManager';
import { i18n } from '../../../core/i18n/i18n';
import { POWER_UP_LABELS } from '../objects/labels';
import { loadTanksAudio, TANKS_AUDIO } from '../audio';
import { FIELD, START_LIVES } from '../constants/tuning';
import {
	drawBullet,
	drawExplosion,
	drawPowerUp,
	drawShield,
	drawSpawnStar,
	drawTank,
	drawTankIcon,
	drawTerrain,
	drawTrees,
	fillPolygon,
	TANKS_COLORS,
	type View,
} from '../objects/battleRenderer';
import { Battle, type BattleEvent, type CampaignState, type Direction } from '../state/Battle';
import { readHighScore } from '../state/highScore';
import { TANKS_SCENES } from '../sceneKeys';
import type { TanksResult } from './TanksResultScene';

/** El campo de 208 unidades ocupa 572 px: casi todo el alto de la pantalla. */
const VIEW: View = { x: 14, y: 14, scale: 2.75 };
const FIELD_PX = FIELD * VIEW.scale;
const HUD_X = 616;

/** La simulación avanza a pasos fijos: igual en un monitor de 60 Hz que en uno de 144 Hz. */
const STEP = 1 / 60;
const INTRO_DURATION = 1.4;
const WIN_DELAY = 2.8;
const LOSS_DELAY = 3.6;

type Effect = { x: number; y: number; big: boolean; age: number; duration: number };

const LABEL_STYLE = {
	fontFamily: 'Arial, sans-serif',
	fontSize: '11px',
	color: '#7384aa',
	letterSpacing: 2,
};
const VALUE_STYLE = {
	fontFamily: 'Courier New, monospace',
	fontSize: '20px',
	color: '#f5f7ff',
	fontStyle: 'bold',
};

/** La partida: traduce teclado a `Battle`, dibuja su estado y suena sus eventos. */
export class TanksGameScene extends Phaser.Scene {
	/** Público para que `npm run shots` pueda leer el estado de la etapa. */
	battle!: Battle;
	private campaignAtStart!: CampaignState;

	private terrainLayer!: Phaser.GameObjects.Graphics;
	private actorLayer!: Phaser.GameObjects.Graphics;
	private treeLayer!: Phaser.GameObjects.Graphics;
	private effectLayer!: Phaser.GameObjects.Graphics;
	private hudGraphics!: Phaser.GameObjects.Graphics;
	private terrainSignature = '';
	private hudSignature = '';

	private stageText!: Phaser.GameObjects.Text;
	private scoreText!: Phaser.GameObjects.Text;
	private highScoreText!: Phaser.GameObjects.Text;
	private livesText!: Phaser.GameObjects.Text;
	private statusText!: Phaser.GameObjects.Text;
	private banner!: Phaser.GameObjects.Container;
	private pauseOverlay!: Phaser.GameObjects.Container;
	private gameOverText!: Phaser.GameObjects.Text;

	private keys!: Record<Direction, Phaser.Input.Keyboard.Key[]>;
	private fireKeys: Phaser.Input.Keyboard.Key[] = [];
	private pauseKey!: Phaser.Input.Keyboard.Key;
	private escapeKey!: Phaser.Input.Keyboard.Key;
	/** Direcciones apretadas, la última manda: soltar una devuelve la anterior. */
	private heldDirections: Direction[] = [];

	private effects: Effect[] = [];
	private accumulator = 0;
	private introTimer = 0;
	private paused = false;
	private finished = false;
	private highScore = 0;
	private lastSfx = new Map<string, number>();

	constructor() {
		super(TANKS_SCENES.GAME);
	}

	init(data: Partial<CampaignState>) {
		this.campaignAtStart = {
			stage: data.stage ?? 1,
			score: data.score ?? 0,
			lives: data.lives ?? START_LIVES,
			playerLevel: data.playerLevel ?? 0,
			seed: data.seed,
		};
	}

	preload() {
		loadTanksAudio(
			this,
			TANKS_AUDIO.gameMusic, TANKS_AUDIO.shoot, TANKS_AUDIO.brick, TANKS_AUDIO.steel,
			TANKS_AUDIO.explosion, TANKS_AUDIO.playerDown, TANKS_AUDIO.baseDown,
			TANKS_AUDIO.powerUpAppear, TANKS_AUDIO.powerUpTaken, TANKS_AUDIO.extraLife,
			TANKS_AUDIO.pauseToggle, TANKS_AUDIO.confirm,
		);
	}

	create() {
		// Las escenas se reutilizan: todo el estado de la etapa se arma de nuevo acá.
		this.battle = new Battle(this.campaignAtStart);
		this.effects = [];
		this.accumulator = 0;
		this.introTimer = INTRO_DURATION;
		this.paused = false;
		this.finished = false;
		this.heldDirections = [];
		this.terrainSignature = '';
		this.hudSignature = '';
		this.highScore = readHighScore();
		this.lastSfx.clear();

		this.cameras.main.setBackgroundColor('#080d1a');
		this.terrainLayer = this.add.graphics();
		this.actorLayer = this.add.graphics();
		this.treeLayer = this.add.graphics();
		this.effectLayer = this.add.graphics();
		drawTrees(this.treeLayer, this.battle, VIEW);
		this.add.rectangle(VIEW.x, VIEW.y, FIELD_PX, FIELD_PX)
			.setOrigin(0)
			.setStrokeStyle(2, 0x29416f);

		this.createHud();
		this.createOverlays();
		this.configureKeyboard();
		this.render();

		audioManager.playMusic(this, TANKS_AUDIO.gameMusic.cacheKey);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audioManager.stopMusic());
	}

	update(_time: number, delta: number) {
		const dt = Math.min(delta, 100) / 1000;

		if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
			this.goToTitle();
			return;
		}
		if (Phaser.Input.Keyboard.JustDown(this.pauseKey) && this.introTimer <= 0 && this.battle.outcome === 'playing') {
			this.togglePause();
		}
		if (this.paused) {
			return;
		}

		this.updateHeldDirections();
		const fire = this.fireKeys.some((key) => Phaser.Input.Keyboard.JustDown(key));

		if (this.introTimer > 0) {
			this.introTimer -= dt;
			if (this.introTimer <= 0) {
				this.tweens.add({ targets: this.banner, alpha: 0, duration: 250 });
			}
		} else {
			this.battle.setInput({ dir: this.heldDirections.at(-1) ?? null, fire });
			this.accumulator += dt;
			while (this.accumulator >= STEP) {
				this.battle.step(STEP);
				this.accumulator -= STEP;
			}
			this.consumeEvents();
		}

		this.updateEffects(dt);
		this.render();
		this.checkEnd();
	}

	// ---------------------------------------------------------------- entrada

	private configureKeyboard() {
		const keyboard = this.input.keyboard!;
		const codes = Phaser.Input.Keyboard.KeyCodes;
		const add = (...keyCodes: number[]) => keyCodes.map((code) => keyboard.addKey(code));
		this.keys = {
			up: add(codes.UP, codes.W),
			right: add(codes.RIGHT, codes.D),
			down: add(codes.DOWN, codes.S),
			left: add(codes.LEFT, codes.A),
		};
		this.fireKeys = add(codes.SPACE, codes.Z, codes.J);
		this.pauseKey = keyboard.addKey(codes.P);
		this.escapeKey = keyboard.addKey(codes.ESC);
	}

	private updateHeldDirections() {
		for (const [dir, keys] of Object.entries(this.keys) as Array<[Direction, Phaser.Input.Keyboard.Key[]]>) {
			const down = keys.some((key) => key.isDown);
			const index = this.heldDirections.indexOf(dir);
			if (down && index < 0) {
				this.heldDirections.push(dir);
			} else if (!down && index >= 0) {
				this.heldDirections.splice(index, 1);
			}
		}
	}

	private togglePause() {
		this.paused = !this.paused;
		this.pauseOverlay.setVisible(this.paused);
		audioManager.setMusicDucked(this.paused);
		audioManager.playSfx(this, TANKS_AUDIO.pauseToggle.cacheKey);
	}

	// ----------------------------------------------------------------- eventos

	private consumeEvents() {
		for (const event of this.battle.events) {
			this.handleEvent(event);
		}
		this.battle.events = [];
	}

	private handleEvent(event: BattleEvent) {
		switch (event.type) {
			case 'shot':
				if (event.fromPlayer) {
					this.playSfx(TANKS_AUDIO.shoot.cacheKey);
				}
				break;
			case 'impact':
				this.addEffect(event.x, event.y, false);
				if (event.target === 'brick') {
					this.playSfx(TANKS_AUDIO.brick.cacheKey);
				} else if (event.target === 'steel' || event.target === 'wall' || event.target === 'shield') {
					this.playSfx(TANKS_AUDIO.steel.cacheKey);
				}
				break;
			case 'armorHit':
				this.addEffect(event.x, event.y, false);
				this.playSfx(TANKS_AUDIO.steel.cacheKey);
				break;
			case 'tankDestroyed':
				this.addEffect(event.x, event.y, true);
				this.playSfx(event.kind === 'player' ? TANKS_AUDIO.playerDown.cacheKey : TANKS_AUDIO.explosion.cacheKey);
				if (event.points > 0) {
					this.popup(event.x, event.y, String(event.points), '#f5f7ff');
				}
				break;
			case 'powerUpSpawned':
				this.playSfx(TANKS_AUDIO.powerUpAppear.cacheKey);
				break;
			case 'powerUpTaken':
				this.playSfx(TANKS_AUDIO.powerUpTaken.cacheKey);
				this.popup(event.x, event.y, i18n.t(POWER_UP_LABELS[event.kind].name), '#f2c14e');
				break;
			case 'baseDestroyed':
				this.addEffect(event.x, event.y, true);
				this.playSfx(TANKS_AUDIO.baseDown.cacheKey);
				this.cameras.main.shake(400, 0.008);
				break;
			case 'extraLife':
				this.playSfx(TANKS_AUDIO.extraLife.cacheKey);
				this.popupScreen(HUD_X + 80, 360, i18n.t('tanks.game.extraLife'), '#9be15d');
				break;
		}
	}

	/** Varios ladrillos en el mismo paso sonarían como uno solo pero más fuerte. */
	private playSfx(cacheKey: string) {
		const now = this.time.now;
		if (now - (this.lastSfx.get(cacheKey) ?? -Infinity) < 60) {
			return;
		}
		this.lastSfx.set(cacheKey, now);
		audioManager.playSfx(this, cacheKey);
	}

	private addEffect(x: number, y: number, big: boolean) {
		this.effects.push({ x, y, big, age: 0, duration: big ? 0.55 : 0.22 });
	}

	private updateEffects(dt: number) {
		for (const effect of this.effects) {
			effect.age += dt;
		}
		this.effects = this.effects.filter((effect) => effect.age < effect.duration);
	}

	private popup(x: number, y: number, label: string, color: string) {
		this.popupScreen(VIEW.x + x * VIEW.scale, VIEW.y + y * VIEW.scale, label, color);
	}

	private popupScreen(x: number, y: number, label: string, color: string) {
		const text = this.add.text(x, y, label, {
			fontFamily: 'Courier New, monospace',
			fontSize: '15px',
			color,
			fontStyle: 'bold',
			stroke: '#05070d',
			strokeThickness: 4,
		}).setOrigin(0.5).setDepth(20);
		this.tweens.add({
			targets: text,
			y: y - 26,
			alpha: 0,
			delay: 350,
			duration: 650,
			onComplete: () => text.destroy(),
		});
	}

	// ------------------------------------------------------------------ dibujo

	private render() {
		const battle = this.battle;
		const time = battle.time;

		const signature = `${battle.terrainVersion}|${Math.floor(time * 1.5)}|${Math.floor(time * 4) % 2}|${battle.shovelTimer > 0}|${battle.baseDestroyed}`;
		if (signature !== this.terrainSignature) {
			this.terrainSignature = signature;
			drawTerrain(this.terrainLayer, battle, VIEW, time);
		}

		const g = this.actorLayer;
		g.clear();
		const powerUp = battle.powerUp;
		// El bonus titila; en sus últimos segundos, más rápido.
		if (powerUp && Math.floor(time * (powerUp.timer < 4 ? 8 : 3)) % 4 !== 3) {
			drawPowerUp(g, VIEW, powerUp);
		}
		for (const tank of battle.tanks) {
			if (tank.spawning > 0) {
				drawSpawnStar(g, VIEW, tank, time);
				continue;
			}
			drawTank(g, VIEW, tank, time);
			if (tank.shield > 0) {
				drawShield(g, VIEW, tank, time);
			}
		}
		for (const bullet of battle.bullets) {
			drawBullet(g, VIEW, bullet);
		}

		this.effectLayer.clear();
		for (const effect of this.effects) {
			drawExplosion(this.effectLayer, VIEW, effect.x, effect.y, effect.age / effect.duration, effect.big);
		}

		this.renderHud();

		if (battle.outcome === 'lost') {
			// El cartel sube desde el pie del campo hasta el centro, como en el original.
			const progress = Math.min(1, battle.endTimer / 1.6);
			this.gameOverText.setVisible(true)
				.setY(VIEW.y + FIELD_PX - progress * (FIELD_PX / 2 - 10));
		}
	}

	private createHud() {
		this.add.rectangle(600, 14, 186, FIELD_PX, 0x0d1428)
			.setOrigin(0)
			.setStrokeStyle(1, 0x29416f);
		this.hudGraphics = this.add.graphics();

		this.add.text(HUD_X, 28, i18n.t('tanks.game.stage'), LABEL_STYLE);
		this.stageText = this.add.text(HUD_X, 44, '', { ...VALUE_STYLE, fontSize: '30px', color: '#f2c14e' });
		if (this.battle.seed !== undefined) {
			// En una partida aleatoria la semilla identifica el mapa: anotándola se puede repetir.
			this.add.text(HUD_X + 60, 56, `#${this.battle.seed}`, { ...VALUE_STYLE, fontSize: '14px', color: '#64759f' });
		}

		this.add.text(HUD_X, 98, i18n.t('tanks.game.enemies'), LABEL_STYLE);

		this.add.text(HUD_X, 232, i18n.t('tanks.game.score'), LABEL_STYLE);
		this.scoreText = this.add.text(HUD_X, 248, '', VALUE_STYLE);
		this.add.text(HUD_X, 286, i18n.t('tanks.game.highScore'), LABEL_STYLE);
		this.highScoreText = this.add.text(HUD_X, 302, '', { ...VALUE_STYLE, color: '#9eacd0' });

		this.add.text(HUD_X, 342, i18n.t('tanks.game.lives'), LABEL_STYLE);
		this.livesText = this.add.text(HUD_X + 30, 358, '', VALUE_STYLE);
		this.add.text(HUD_X, 400, i18n.t('tanks.game.power'), LABEL_STYLE);

		this.statusText = this.add.text(HUD_X, 458, '', {
			fontFamily: 'Arial, sans-serif',
			fontSize: '12px',
			color: '#9be15d',
			lineSpacing: 8,
			letterSpacing: 1,
		});

		this.add.text(693, 562, i18n.t('tanks.game.footer'), {
			fontFamily: 'Courier New, monospace',
			fontSize: '11px',
			color: '#64759f',
		}).setOrigin(0.5);
	}

	private renderHud() {
		const battle = this.battle;
		this.stageText.setText(String(battle.stage));
		this.scoreText.setText(String(battle.score));
		this.highScoreText.setText(String(Math.max(this.highScore, battle.score)));
		this.livesText.setText(`× ${battle.lives}`);

		const status = [];
		if (battle.freezeTimer > 0) {
			status.push(`${i18n.t('tanks.game.frozen')}  ${Math.ceil(battle.freezeTimer)}`);
		}
		if (battle.shovelTimer > 0) {
			status.push(`${i18n.t('tanks.game.fortified')}  ${Math.ceil(battle.shovelTimer)}`);
		}
		this.statusText.setText(status.join('\n'));

		const signature = `${battle.enemyQueue.length}|${battle.playerLevel}`;
		if (signature === this.hudSignature) {
			return;
		}
		this.hudSignature = signature;

		const g = this.hudGraphics;
		g.clear();
		// Reserva de enemigos: un ícono por cada tanque que todavía no salió.
		for (let index = 0; index < battle.enemyQueue.length; index += 1) {
			const column = index % 5;
			const row = Math.floor(index / 5);
			drawTankIcon(g, HUD_X + 4 + column * 30, 118 + row * 26, 18, 0x8f98ad);
		}
		drawTankIcon(g, HUD_X + 2, 360, 20, TANKS_COLORS.player);

		// Una estrella por mejora del cañón.
		for (let level = 0; level < 3; level += 1) {
			const filled = level < battle.playerLevel;
			const cx = HUD_X + 12 + level * 28;
			const cy = 430;
			const points = [];
			for (let index = 0; index < 10; index += 1) {
				const angle = -Math.PI / 2 + (index * Math.PI) / 5;
				const radius = index % 2 === 0 ? 10 : 4.2;
				points.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
			}
			g.fillStyle(filled ? TANKS_COLORS.player : 0x26304d, 1);
			fillPolygon(g, points);
		}
	}

	private createOverlays() {
		const centerX = VIEW.x + FIELD_PX / 2;
		const centerY = VIEW.y + FIELD_PX / 2;

		const curtain = this.add.rectangle(VIEW.x, VIEW.y, FIELD_PX, FIELD_PX, 0x5d6578).setOrigin(0);
		const stageLabel = this.add.text(centerX, centerY, `${i18n.t('tanks.game.stage')}  ${this.battle.stage}`, {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: '40px',
			color: '#05070d',
			letterSpacing: 6,
		}).setOrigin(0.5);
		this.banner = this.add.container(0, 0, [curtain, stageLabel]).setDepth(30);

		const shade = this.add.rectangle(VIEW.x, VIEW.y, FIELD_PX, FIELD_PX, 0x05070d, 0.72).setOrigin(0);
		const pausedTitle = this.add.text(centerX, centerY - 18, i18n.t('tanks.game.paused'), {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: '42px',
			color: '#f2c14e',
			letterSpacing: 6,
		}).setOrigin(0.5);
		const pausedHint = this.add.text(centerX, centerY + 32, i18n.t('tanks.game.pausedHint'), {
			fontFamily: 'Courier New, monospace',
			fontSize: '14px',
			color: '#d9e2ff',
		}).setOrigin(0.5);
		this.pauseOverlay = this.add.container(0, 0, [shade, pausedTitle, pausedHint]).setDepth(40).setVisible(false);

		this.gameOverText = this.add.text(centerX, VIEW.y + FIELD_PX, i18n.t('tanks.game.gameOver'), {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: '44px',
			color: '#e5484d',
			letterSpacing: 6,
			stroke: '#05070d',
			strokeThickness: 6,
		}).setOrigin(0.5).setDepth(35).setVisible(false);
	}

	// ------------------------------------------------------------------ salida

	private checkEnd() {
		const battle = this.battle;
		if (this.finished || battle.outcome === 'playing') {
			return;
		}
		if (battle.endTimer < (battle.outcome === 'won' ? WIN_DELAY : LOSS_DELAY)) {
			return;
		}

		this.finished = true;
		const result: TanksResult = {
			outcome: battle.outcome,
			reason: battle.baseDestroyed ? 'base' : 'lives',
			campaign: battle.campaign(),
			kills: { ...battle.kills },
		};
		this.scene.start(TANKS_SCENES.RESULT, result);
	}

	private goToTitle() {
		audioManager.setMusicDucked(false);
		audioManager.playSfx(this, TANKS_AUDIO.confirm.cacheKey);
		this.scene.start(TANKS_SCENES.TITLE);
	}
}
