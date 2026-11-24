import Phaser from 'phaser';
import { audioManager } from '../../../core/audio/AudioManager';
import { i18n } from '../../../core/i18n/i18n';
import { GALACTICA_AUDIO, loadGalacticaAudio } from '../audio';
import { FAMILY_COLORS } from '../constants/families';
import { shipFrame } from '../constants/ships';
import { EVOLUTION_CORES, FIELD_H, FIELD_W, POWER_UP_SECONDS, SHIELD_CAPACITY, STEP } from '../constants/tuning';
import { loadGalacticaArt, sharpenGalacticaArt, SHIPS_ATLAS } from '../objects/art';
import { drawProjectiles, drawWarnings, Effects, spriteViews, type Offset } from '../objects/battleRenderer';
import {
	BOSS_LABELS,
	FAMILY_LABELS,
	FREIGHTER_COLORS,
	PASSAGE_LABELS,
	PICKUP_COLORS,
	PICKUP_LABELS,
	SHIP_LABELS,
	TEXT,
} from '../objects/labels';
import { SpriteLayer } from '../objects/SpriteLayer';
import { Starfield } from '../objects/Starfield';
import { Battle, newRun, type BattleEvent, type RunState } from '../state/Battle';
import { readHighScore } from '../state/hangar';
import { GALACTICA_SCENES } from '../sceneKeys';
import type { GalacticaResult } from './GalacticaResultScene';

const VIEW: Offset = { x: 12, y: 12 };
const HUD_X = 604;
const BAR_W = 172;
const WIN_DELAY = 2.2;
const LOSS_DELAY = 3.2;

/** La partida: traduce teclado a `Battle`, dibuja su estado y suena sus eventos. */
export class GalacticaGameScene extends Phaser.Scene {
	/** Público para que `npm run shots` pueda leer y empujar el estado de la zona. */
	battle!: Battle;
	private run!: RunState;

	private starfield!: Starfield;
	private sprites!: SpriteLayer;
	private warnings!: Phaser.GameObjects.Graphics;
	private projectiles!: Phaser.GameObjects.Graphics;
	private effectLayer!: Phaser.GameObjects.Graphics;
	private hud!: Phaser.GameObjects.Graphics;
	private effects = new Effects();

	private zoneText!: Phaser.GameObjects.Text;
	private phaseText!: Phaser.GameObjects.Text;
	private scoreText!: Phaser.GameObjects.Text;
	private highScoreText!: Phaser.GameObjects.Text;
	private lifeText!: Phaser.GameObjects.Text;
	private energyText!: Phaser.GameObjects.Text;
	private stageText!: Phaser.GameObjects.Text;
	private shipIcon!: Phaser.GameObjects.Image;
	private shieldText!: Phaser.GameObjects.Text;
	private powerUpText!: Phaser.GameObjects.Text;
	private maxStageText!: Phaser.GameObjects.Text;
	private bossName!: Phaser.GameObjects.Text;
	private banner!: Phaser.GameObjects.Text;
	private subBanner!: Phaser.GameObjects.Text;
	private pauseOverlay!: Phaser.GameObjects.Container;
	private gameOverText!: Phaser.GameObjects.Text;

	private leftKeys: Phaser.Input.Keyboard.Key[] = [];
	private rightKeys: Phaser.Input.Keyboard.Key[] = [];
	private upKeys: Phaser.Input.Keyboard.Key[] = [];
	private downKeys: Phaser.Input.Keyboard.Key[] = [];
	private fireKeys: Phaser.Input.Keyboard.Key[] = [];
	private shieldKeys: Phaser.Input.Keyboard.Key[] = [];
	private pauseKey!: Phaser.Input.Keyboard.Key;
	private escapeKey!: Phaser.Input.Keyboard.Key;

	private accumulator = 0;
	private paused = false;
	private finished = false;
	private highScore = 0;
	private playerVisible = true;
	private zoneBonus = 0;
	private lastSfx = new Map<string, number>();

	constructor() {
		super(GALACTICA_SCENES.GAME);
	}

	init(data: Partial<RunState>) {
		this.run = { ...newRun(data.shipId ?? 'halcon'), ...data };
	}

	preload() {
		loadGalacticaArt(this);
		loadGalacticaAudio(
			this,
			GALACTICA_AUDIO.gameMusic, GALACTICA_AUDIO.bossMusic, GALACTICA_AUDIO.shoot, GALACTICA_AUDIO.hit,
			GALACTICA_AUDIO.explosion, GALACTICA_AUDIO.bigExplosion, GALACTICA_AUDIO.blast, GALACTICA_AUDIO.playerHit,
			GALACTICA_AUDIO.shield, GALACTICA_AUDIO.podOpen, GALACTICA_AUDIO.pickup, GALACTICA_AUDIO.evolve, GALACTICA_AUDIO.warning,
			GALACTICA_AUDIO.strike, GALACTICA_AUDIO.stormBlock,
			GALACTICA_AUDIO.zoneClear, GALACTICA_AUDIO.gameOver, GALACTICA_AUDIO.pauseToggle, GALACTICA_AUDIO.confirm,
		);
	}

	create() {
		sharpenGalacticaArt(this);
		// Las escenas se reutilizan: todo el estado de la zona se arma de nuevo acá.
		this.battle = new Battle(this.run);
		this.effects = new Effects();
		this.accumulator = 0;
		this.paused = false;
		this.finished = false;
		this.playerVisible = true;
		this.zoneBonus = 0;
		this.highScore = readHighScore();
		this.lastSfx.clear();

		this.cameras.main.setBackgroundColor('#05060d');
		this.starfield = new Starfield(this, { x: VIEW.x, y: VIEW.y, w: FIELD_W, h: FIELD_H }, this.battle.zone.sky);
		this.warnings = this.add.graphics();
		this.sprites = new SpriteLayer(this, VIEW, 5);
		this.projectiles = this.add.graphics().setDepth(6);
		this.effectLayer = this.add.graphics().setDepth(7);
		this.add.rectangle(VIEW.x, VIEW.y, FIELD_W, FIELD_H).setOrigin(0).setStrokeStyle(2, 0x29416f).setDepth(8);
		// Lo que se sale del campo queda tapado por el marco del HUD. En una ventana
		// más ancha que 4:3 se ve más allá de los 800 de la escena: los paños siguen
		// hasta bien afuera, que un carguero o un muro entran desde 220 px del borde.
		const beyond = 1000;
		this.add.rectangle(VIEW.x + FIELD_W + 1, -beyond, 800 - VIEW.x - FIELD_W + beyond, 600 + beyond * 2, 0x05060d).setOrigin(0).setDepth(9);
		this.add.rectangle(-beyond, VIEW.y + FIELD_H + 1, 800 + beyond * 2, 600 + beyond, 0x05060d).setOrigin(0).setDepth(9);
		this.add.rectangle(-beyond, -beyond, 800 + beyond * 2, VIEW.y - 1 + beyond, 0x05060d).setOrigin(0).setDepth(9);
		this.add.rectangle(-beyond, -beyond, VIEW.x - 1 + beyond, 600 + beyond * 2, 0x05060d).setOrigin(0).setDepth(9);

		this.createHud();
		this.createOverlays();
		this.configureKeyboard();
		this.announce(`${i18n.t('galactica.game.zone')} ${this.battle.zoneNumber}`, i18n.t(FAMILY_LABELS[this.battle.zone.family]), '#f5f7ff');
		this.render();

		audioManager.playMusic(this, GALACTICA_AUDIO.gameMusic.cacheKey);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audioManager.stopMusic());
	}

	update(_time: number, delta: number) {
		const dt = Math.min(delta, 100) / 1000;

		if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
			this.goToTitle();
			return;
		}
		if (Phaser.Input.Keyboard.JustDown(this.pauseKey) && this.battle.outcome === 'playing') {
			this.togglePause();
		}
		if (this.paused) {
			return;
		}

		const left = this.leftKeys.some((key) => key.isDown);
		const right = this.rightKeys.some((key) => key.isDown);
		const up = this.upKeys.some((key) => key.isDown);
		const down = this.downKeys.some((key) => key.isDown);
		this.battle.setInput({
			move: (right ? 1 : 0) - (left ? 1 : 0),
			moveY: (down ? 1 : 0) - (up ? 1 : 0),
			fire: this.fireKeys.some((key) => key.isDown),
			shield: this.shieldKeys.some((key) => key.isDown),
		});
		this.accumulator += dt;
		while (this.accumulator >= STEP) {
			this.battle.step(STEP);
			this.accumulator -= STEP;
		}
		this.consumeEvents();
		this.effects.update(dt);
		this.render();
		this.checkEnd();
	}

	// ---------------------------------------------------------------- entrada

	private configureKeyboard() {
		const keyboard = this.input.keyboard!;
		const codes = Phaser.Input.Keyboard.KeyCodes;
		const add = (...keyCodes: number[]) => keyCodes.map((code) => keyboard.addKey(code));
		this.leftKeys = add(codes.LEFT, codes.A);
		this.rightKeys = add(codes.RIGHT, codes.D);
		this.upKeys = add(codes.UP, codes.W);
		this.downKeys = add(codes.DOWN, codes.S);
		this.fireKeys = add(codes.SPACE, codes.Z, codes.J);
		// Shift no: apretado cinco veces, Windows abre el cartel de teclas especiales.
		this.shieldKeys = add(codes.X, codes.K);
		this.pauseKey = keyboard.addKey(codes.P);
		this.escapeKey = keyboard.addKey(codes.ESC);
	}

	private togglePause() {
		this.paused = !this.paused;
		this.pauseOverlay.setVisible(this.paused);
		audioManager.setMusicDucked(this.paused);
		audioManager.playSfx(this, GALACTICA_AUDIO.pauseToggle.cacheKey);
	}

	// ----------------------------------------------------------------- eventos

	private consumeEvents() {
		for (const event of this.battle.events) {
			this.handleEvent(event);
		}
		this.battle.events = [];
	}

	private handleEvent(event: BattleEvent) {
		const family = this.battle.zone.family;
		switch (event.type) {
			case 'playerShot':
				this.playSfx(GALACTICA_AUDIO.shoot.cacheKey, 90);
				break;
			case 'hit':
				this.effects.burst(event.x, event.y, [0xffffff, 0xffe28a], 3, 90);
				this.playSfx(GALACTICA_AUDIO.hit.cacheKey);
				break;
			case 'kill': {
				const colors = event.family === 'rock'
					? [0xb0a090, 0x7a6c5e, 0x4a3f38]
					: event.family === 'pod' ? [0xa4b0cc, 0xef5466, 0xffd860]
					: event.family === 'freighter' ? FREIGHTER_COLORS : FAMILY_COLORS[event.family];
				this.effects.burst(event.x, event.y, colors, event.big ? 26 : 14, event.big ? 240 : 170);
				if (event.big) {
					this.effects.ring(event.x, event.y, 44, colors[0]);
				}
				this.playSfx(GALACTICA_AUDIO.explosion.cacheKey);
				if (event.points > 0) {
					// El del carguero va arriba: abajo queda la cápsula.
					const lift = event.family === 'freighter' ? 34 : 0;
					this.popup(event.x, event.y - lift, String(event.points), '#f5f7ff');
				}
				break;
			}
			case 'playerHit':
				this.effects.burst(this.battle.player.x, this.battle.player.y, [0xef5466, 0xffffff, 0xff8a3a], 12, 160);
				this.cameras.main.shake(160, 0.006);
				this.playSfx(GALACTICA_AUDIO.playerHit.cacheKey);
				break;
			case 'shieldUp':
				this.playSfx(GALACTICA_AUDIO.shield.cacheKey);
				break;
			case 'shieldBlock':
				this.effects.ring(event.x, event.y, 34, 0xc49bff, 0.3);
				this.playSfx(GALACTICA_AUDIO.shield.cacheKey);
				break;
			case 'pickup':
				this.effects.ring(event.x, event.y, 30, Phaser.Display.Color.HexStringToColor(PICKUP_COLORS[event.kind]).color, 0.35);
				this.popup(event.x, event.y - 10, i18n.t(PICKUP_LABELS[event.kind].name), PICKUP_COLORS[event.kind]);
				this.playSfx(GALACTICA_AUDIO.pickup.cacheKey);
				break;
			case 'evolve':
				this.effects.ring(this.battle.player.x, this.battle.player.y, 70, 0x7fe0ff, 0.7);
				this.effects.burst(this.battle.player.x, this.battle.player.y, [0x7fe0ff, 0xc4fbff, 0xffffff], 24, 200);
				this.announce(i18n.t('galactica.game.evolved'), `MK ${event.stage + 1}`, '#7fe0ff');
				this.playSfx(GALACTICA_AUDIO.evolve.cacheKey);
				break;
			case 'warning':
				if (event.kind === 'comets') {
					this.announce(i18n.t('galactica.game.comets'), '', '#ffe0a0');
				} else if (event.kind === 'asteroids') {
					this.announce(i18n.t('galactica.game.asteroids'), '', '#b0a090');
				} else if (event.kind === 'pod') {
					this.announce(i18n.t('galactica.game.pod'), '', '#a4b0cc');
				}
				this.playSfx(GALACTICA_AUDIO.warning.cacheKey);
				break;
			case 'blast':
				this.effects.ring(event.x, event.y, event.radius, 0xff5466, 0.5);
				this.effects.burst(event.x, event.y, [0xff5466, 0xff8a3a, 0xffd860], 30, 260);
				this.cameras.main.shake(220, 0.01);
				this.playSfx(GALACTICA_AUDIO.blast.cacheKey);
				break;
			case 'waveStart':
				if (event.wave > 1) {
					this.announce(`${i18n.t('galactica.game.wave')} ${event.wave}`, '', '#f5f7ff');
				}
				break;
			case 'passageStart': {
				const { name, hint } = PASSAGE_LABELS[event.id];
				// Queda más que los otros carteles: además del nombre, dice qué hay que hacer.
				this.announce(i18n.t(name), i18n.t(hint), '#7fe0ff', 2100);
				this.playSfx(GALACTICA_AUDIO.warning.cacheKey);
				break;
			}
			case 'deflect':
				this.effects.burst(event.x, event.y, [0xa4b0cc, 0x5a6482], 3, 120);
				this.playSfx(GALACTICA_AUDIO.hit.cacheKey, 120);
				break;
			case 'strike':
				this.playSfx(GALACTICA_AUDIO.strike.cacheKey);
				break;
			case 'stormBlock':
				this.effects.ring(event.x, event.y, 56, 0x7fe0ff, 0.45);
				this.popup(event.x, event.y - 34, `+${event.amount}% ${i18n.t('galactica.game.energy')}`, PICKUP_COLORS.energy);
				this.playSfx(GALACTICA_AUDIO.stormBlock.cacheKey);
				break;
			case 'bossSpawn':
				this.announce(i18n.t('galactica.game.bossWarning'), i18n.t(FAMILY_LABELS[family]), '#ff647c');
				audioManager.playMusic(this, GALACTICA_AUDIO.bossMusic.cacheKey);
				this.playSfx(GALACTICA_AUDIO.warning.cacheKey);
				break;
			case 'bossDown':
				for (let index = 0; index < 4; index += 1) {
					this.time.delayedCall(index * 180, () => {
						const x = event.x + (Math.random() - 0.5) * 70;
						const y = event.y + (Math.random() - 0.5) * 50;
						this.effects.burst(x, y, FAMILY_COLORS[family], 30, 260);
						this.effects.ring(x, y, 60, FAMILY_COLORS[family][0], 0.6);
						this.playSfx(GALACTICA_AUDIO.bigExplosion.cacheKey);
					});
				}
				this.cameras.main.shake(500, 0.012);
				this.popup(event.x, event.y, String(event.points), '#f2c14e');
				audioManager.stopMusic();
				break;
			case 'energyEmpty':
				this.announce(i18n.t('galactica.game.energyEmpty'), '', '#ff647c');
				this.playSfx(GALACTICA_AUDIO.warning.cacheKey);
				break;
			case 'podOpened':
				this.playSfx(GALACTICA_AUDIO.podOpen.cacheKey);
				if (event.ships) {
					this.announce(i18n.t('galactica.game.podShips'), '', '#ff647c');
				}
				break;
			case 'zoneClear':
				this.zoneBonus = event.bonus;
				this.announce(i18n.t('galactica.game.zoneClear'), `+${event.bonus}`, '#9be15d');
				this.playSfx(GALACTICA_AUDIO.zoneClear.cacheKey);
				break;
			case 'playerDown':
				this.playerVisible = false;
				this.effects.burst(event.x, event.y, [0xeef3ff, 0xef5466, 0xffd860, 0xff8a3a], 40, 280);
				this.effects.ring(event.x, event.y, 70, 0xffffff, 0.7);
				this.cameras.main.shake(500, 0.014);
				this.playSfx(GALACTICA_AUDIO.bigExplosion.cacheKey);
				audioManager.stopMusic();
				this.time.delayedCall(700, () => this.playSfx(GALACTICA_AUDIO.gameOver.cacheKey));
				break;
		}
	}

	/** Varios impactos en el mismo paso sonarían como uno solo pero más fuerte. */
	private playSfx(cacheKey: string, minGap = 50) {
		const now = this.time.now;
		if (now - (this.lastSfx.get(cacheKey) ?? -Infinity) < minGap) {
			return;
		}
		this.lastSfx.set(cacheKey, now);
		audioManager.playSfx(this, cacheKey);
	}

	private popup(x: number, y: number, label: string, color: string) {
		const text = this.add.text(VIEW.x + x, VIEW.y + y, label, {
			fontFamily: 'Courier New, monospace',
			fontSize: '14px',
			color,
			fontStyle: 'bold',
			stroke: '#05070d',
			strokeThickness: 4,
		}).setOrigin(0.5).setDepth(20);
		this.tweens.add({
			targets: text,
			y: text.y - 24,
			alpha: 0,
			delay: 300,
			duration: 600,
			onComplete: () => text.destroy(),
		});
	}

	/** Un cartel grande en el centro del campo, que se desvanece solo. */
	private announce(title: string, subtitle: string, color: string, hold = 1300) {
		this.tweens.killTweensOf([this.banner, this.subBanner]);
		this.banner.setText(title).setColor(color).setAlpha(1);
		this.subBanner.setText(subtitle).setAlpha(subtitle ? 1 : 0);
		this.tweens.add({ targets: [this.banner, this.subBanner], alpha: 0, delay: hold, duration: 500 });
	}

	// ------------------------------------------------------------------ dibujo

	private render() {
		const battle = this.battle;
		this.starfield.draw(battle.time);
		drawWarnings(this.warnings, battle, VIEW);
		this.sprites.sync(spriteViews(battle, this.playerVisible));
		drawProjectiles(this.projectiles, battle, VIEW, this.playerVisible);
		this.effects.draw(this.effectLayer, VIEW);
		this.renderHud();

		if (battle.outcome === 'lost') {
			const progress = Math.min(1, battle.endTimer / 1.4);
			this.gameOverText.setVisible(true).setAlpha(progress).setScale(1.4 - progress * 0.4);
		}
	}

	private createHud() {
		this.add.rectangle(HUD_X - 6, VIEW.y, 192, FIELD_H, 0x0d1428).setOrigin(0).setStrokeStyle(1, 0x29416f).setDepth(10);
		this.hud = this.add.graphics().setDepth(11);
		const text = (x: number, y: number, value: string, style: Phaser.Types.GameObjects.Text.TextStyle) =>
			this.add.text(x, y, value, style).setDepth(12);

		text(HUD_X + 6, 24, i18n.t('galactica.game.zone'), TEXT.label);
		this.zoneText = text(HUD_X + 6, 38, '', { ...TEXT.value, fontSize: '28px', color: '#7fe0ff' });
		this.add.text(HUD_X + 40, 44, i18n.t(FAMILY_LABELS[this.battle.zone.family]), { ...TEXT.mono, fontStyle: 'bold' }).setDepth(12);
		this.phaseText = text(HUD_X + 6, 74, '', { ...TEXT.mono, color: '#9eacd0' });

		text(HUD_X + 6, 104, i18n.t('galactica.game.score'), TEXT.label);
		this.scoreText = text(HUD_X + 6, 118, '', TEXT.value);
		text(HUD_X + 6, 148, i18n.t('galactica.game.highScore'), TEXT.label);
		this.highScoreText = text(HUD_X + 6, 162, '', { ...TEXT.value, fontSize: '16px', color: '#9eacd0' });

		text(HUD_X + 6, 196, i18n.t('galactica.game.life'), TEXT.label);
		this.lifeText = text(HUD_X + 6 + BAR_W, 194, '', { ...TEXT.mono, fontStyle: 'bold' }).setOrigin(1, 0);
		text(HUD_X + 6, 240, i18n.t('galactica.game.energy'), TEXT.label);
		this.energyText = text(HUD_X + 6 + BAR_W, 238, '', { ...TEXT.mono, fontStyle: 'bold' }).setOrigin(1, 0);

		text(HUD_X + 6, 290, i18n.t('galactica.game.ship'), TEXT.label);
		this.shipIcon = this.add.image(HUD_X + 30, 334, SHIPS_ATLAS, shipFrame(this.battle.ship.id, this.battle.stage))
			.setScale(3)
			.setDepth(12);
		text(HUD_X + 62, 308, i18n.t(SHIP_LABELS[this.battle.ship.id].name), { ...TEXT.mono, fontStyle: 'bold' });
		this.stageText = text(HUD_X + 62, 326, '', { ...TEXT.mono, color: '#7fe0ff' });
		text(HUD_X + 6, 372, i18n.t('galactica.game.cores'), TEXT.label);
		this.maxStageText = text(HUD_X + 6, 390, '', { ...TEXT.mono, color: '#7fe0ff' });

		text(HUD_X + 6, 420, i18n.t('galactica.game.powerUps'), TEXT.label);
		this.shieldText = text(HUD_X + 6, 438, i18n.t('galactica.game.shield'), TEXT.mono);
		this.powerUpText = text(HUD_X + 6, 463, '', { ...TEXT.mono, lineSpacing: 10 });

		text(HUD_X + 92, 562, i18n.t('galactica.game.footer'), { ...TEXT.mono, fontSize: '11px', color: '#64759f' }).setOrigin(0.5);

		this.bossName = this.add.text(VIEW.x + FIELD_W / 2, VIEW.y + 8, '', { ...TEXT.label, color: '#ff9aa8' })
			.setOrigin(0.5, 0)
			.setDepth(12);
	}

	private renderHud() {
		const battle = this.battle;
		const g = this.hud;
		g.clear();

		this.zoneText.setText(String(battle.zoneNumber));
		this.phaseText.setText(battle.boss || battle.phase === 'bossIntro'
			? i18n.t('galactica.game.boss')
			: battle.passage
				? i18n.t(PASSAGE_LABELS[battle.passage.id].name)
				: `${i18n.t('galactica.game.wave')} ${Math.max(1, battle.wave + 1)} / ${battle.waveCount}`);
		this.scoreText.setText(String(battle.score));
		this.highScoreText.setText(String(Math.max(this.highScore, battle.score)));

		const life = battle.hp / 100;
		const lifeColor = life > 0.5 ? 0x9be15d : life > 0.25 ? 0xffd860 : 0xff5466;
		this.drawBar(g, HUD_X + 6, 214, life, lifeColor, life <= 0.25 && Math.floor(battle.time * 4) % 2 === 0);
		this.lifeText.setText(`${Math.ceil(battle.hp)}%`);

		const energy = battle.energy / 100;
		this.drawBar(g, HUD_X + 6, 258, energy, 0xffd860, energy <= 0 && Math.floor(battle.time * 4) % 2 === 0);
		this.energyText.setText(`${Math.ceil(battle.energy)}%`).setColor(energy <= 0 ? '#ff647c' : '#d9e2ff');

		this.shipIcon.setFrame(shipFrame(battle.ship.id, battle.stage));

		// Un casillero por núcleo que falta para la etapa siguiente.
		const next = EVOLUTION_CORES[battle.stage + 1];
		if (next === undefined) {
			this.drawCoreRow(g, 0, 0, i18n.t('galactica.game.maxStage'));
		} else {
			const previous = EVOLUTION_CORES[battle.stage];
			this.drawCoreRow(g, battle.cores - previous, next - previous, '');
		}

		// El escudo es una carga, no un tiempo: se ve siempre, aunque esté vacía.
		const { shield, shielding } = battle.player;
		this.shieldText.setColor(shielding ? '#ffffff' : shield > 0 ? PICKUP_COLORS.shield : '#64759f');
		g.fillStyle(0x1a2440, 1);
		g.fillRect(HUD_X + 86, 443, 90, 6);
		g.fillStyle(shielding ? 0xffffff : Phaser.Display.Color.HexStringToColor(PICKUP_COLORS.shield).color, 1);
		g.fillRect(HUD_X + 86, 443, 90 * (shield / SHIELD_CAPACITY), 6);

		const active = (['double', 'speed'] as const).filter((kind) => battle.player[kind] > 0);
		this.powerUpText.setText(active.map((kind) => `${i18n.t(PICKUP_LABELS[kind].name)}`).join('\n'));
		active.forEach((kind, index) => {
			const color = Phaser.Display.Color.HexStringToColor(PICKUP_COLORS[kind]).color;
			const fraction = Math.min(1, battle.player[kind] / POWER_UP_SECONDS[kind]);
			g.fillStyle(0x1a2440, 1);
			const y = 468 + index * 25;
			g.fillRect(HUD_X + 86, y, 90, 6);
			g.fillStyle(color, 1);
			g.fillRect(HUD_X + 86, y, 90 * fraction, 6);
		});

		const boss = battle.boss;
		this.bossName.setText(boss ? i18n.t(BOSS_LABELS[boss.family].name) : '');
		if (boss) {
			const width = FIELD_W - 120;
			g.fillStyle(0x05060d, 0.8);
			g.fillRect(VIEW.x + 60, VIEW.y + 24, width, 8);
			g.fillStyle(boss.hp < boss.maxHp / 2 ? 0xff5466 : 0xff9a4a, 1);
			g.fillRect(VIEW.x + 60, VIEW.y + 24, width * (boss.hp / boss.maxHp), 8);
			g.lineStyle(1, 0xffffff, 0.4);
			g.strokeRect(VIEW.x + 60, VIEW.y + 24, width, 8);
		}
	}

	private drawBar(g: Phaser.GameObjects.Graphics, x: number, y: number, fraction: number, color: number, alarm: boolean) {
		g.fillStyle(alarm ? 0x5a1a24 : 0x1a2440, 1);
		g.fillRect(x, y, BAR_W, 14);
		g.fillStyle(color, 1);
		g.fillRect(x, y, BAR_W * Phaser.Math.Clamp(fraction, 0, 1), 14);
		g.lineStyle(1, 0x40577f, 1);
		g.strokeRect(x, y, BAR_W, 14);
	}

	private drawCoreRow(g: Phaser.GameObjects.Graphics, have: number, need: number, label: string) {
		this.stageText.setText(`MK ${this.battle.stage + 1}`);
		this.maxStageText.setText(label);
		for (let index = 0; index < need; index += 1) {
			const x = HUD_X + 12 + index * 24;
			const y = 396;
			g.fillStyle(index < have ? 0x7fe0ff : 0x1a2440, 1);
			g.fillTriangle(x, y - 8, x + 7, y, x, y + 8);
			g.fillTriangle(x, y - 8, x - 7, y, x, y + 8);
		}
	}

	private createOverlays() {
		const centerX = VIEW.x + FIELD_W / 2;
		const centerY = VIEW.y + FIELD_H / 2;

		this.banner = this.add.text(centerX, centerY - 40, '', {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: '34px',
			color: '#f5f7ff',
			letterSpacing: 4,
			stroke: '#05070d',
			strokeThickness: 6,
		}).setOrigin(0.5).setDepth(30).setAlpha(0);
		this.subBanner = this.add.text(centerX, centerY + 2, '', {
			...TEXT.mono,
			fontSize: '16px',
			fontStyle: 'bold',
			letterSpacing: 3,
			stroke: '#05070d',
			strokeThickness: 4,
		}).setOrigin(0.5).setDepth(30).setAlpha(0);

		const shade = this.add.rectangle(VIEW.x, VIEW.y, FIELD_W, FIELD_H, 0x05070d, 0.72).setOrigin(0);
		const pausedTitle = this.add.text(centerX, centerY - 18, i18n.t('galactica.game.paused'), {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: '42px',
			color: '#7fe0ff',
			letterSpacing: 6,
		}).setOrigin(0.5);
		const pausedHint = this.add.text(centerX, centerY + 32, i18n.t('galactica.game.pausedHint'), TEXT.mono).setOrigin(0.5);
		this.pauseOverlay = this.add.container(0, 0, [shade, pausedTitle, pausedHint]).setDepth(40).setVisible(false);

		this.gameOverText = this.add.text(centerX, centerY, i18n.t('galactica.game.gameOver'), {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: '48px',
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
		const won = battle.outcome === 'won';
		const result: GalacticaResult = {
			outcome: won ? (battle.isLastZone ? 'victory' : 'zoneClear') : 'gameOver',
			zone: battle.zoneNumber,
			shipId: battle.ship.id,
			stage: battle.stage,
			score: battle.score,
			hp: battle.hp,
			energy: battle.energy,
			stats: battle.stats,
			bonus: this.zoneBonus,
			next: battle.nextRun(),
		};
		this.scene.start(GALACTICA_SCENES.RESULT, result);
	}

	private goToTitle() {
		audioManager.setMusicDucked(false);
		audioManager.playSfx(this, GALACTICA_AUDIO.confirm.cacheKey);
		this.scene.start(GALACTICA_SCENES.TITLE);
	}
}

