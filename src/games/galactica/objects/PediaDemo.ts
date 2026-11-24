import type Phaser from 'phaser';
import { canvasRect, RENDER_SCALE } from '../../../core/renderScale';
import { FAMILY_COLORS } from '../constants/families';
import type { ShipId } from '../constants/ships';
import { EVOLUTION_CORES, FIELD_H, FIELD_W, STEP } from '../constants/tuning';
import { Battle, newRun } from '../state/Battle';
import { drawProjectiles, drawWarnings, Effects, spriteViews, type Offset } from './battleRenderer';
import { FREIGHTER_COLORS } from './labels';
import { SpriteLayer } from './SpriteLayer';
import { Starfield } from './Starfield';

/**
 * Dónde vive el ejemplo en el mundo: lejos de la pantalla de 800×600, para que
 * la cámara principal no lo vea y la del recuadro no vea la interfaz.
 */
const ORIGIN: Offset = { x: 3000, y: 0 };

/** Lo que pasa en el ejemplo: se llama cada paso, antes de avanzar la batalla. */
export type DemoScript = (demo: PediaDemo) => void;

export type DemoSetup = {
	zone: number;
	shipId?: ShipId;
	stage?: number;
	script: DemoScript;
};

/**
 * Un ejemplo vivo de la Galactopedia: una `Battle` de verdad en modo banco de
 * pruebas, dibujada con los mismos renderers que la partida y mostrada en un
 * recuadro por una cámara propia, achicada.
 *
 * Así la Galactopedia no tiene una segunda implementación de los ataques: el
 * helicoide que se ve es el del juego. La nave del ejemplo no muere (la vida y
 * la energía se reponen cada paso) y se mueve sola.
 */
export class PediaDemo {
	battle!: Battle;
	/** Segundos desde que arrancó el ejemplo actual. */
	time = 0;
	/** Hacia dónde va la nave: por defecto barre la pantalla de lado a lado. */
	target: (() => number) | null = null;
	/** A qué altura va: por defecto no avanza ni retrocede. */
	targetY: (() => number) | null = null;
	fire = false;
	shield = false;

	private readonly scene: Phaser.Scene;
	private readonly sprites: SpriteLayer;
	private readonly warnings: Phaser.GameObjects.Graphics;
	private readonly projectiles: Phaser.GameObjects.Graphics;
	private readonly effectLayer: Phaser.GameObjects.Graphics;
	private effects = new Effects();
	private starfield: Starfield | null = null;
	private script: DemoScript = () => {};
	private accumulator = 0;
	/** Variables que los guiones guardan entre pasos: la nave que muestran, un reloj. */
	memo: Record<string, unknown> = {};

	constructor(scene: Phaser.Scene, area: { x: number; y: number; size: number }) {
		this.scene = scene;
		// La escena destruye sus cámaras y objetos al cerrarse: el ejemplo no necesita limpieza propia.
		scene.cameras
			.add(...canvasRect(scene, area.x, area.y, area.size, area.size))
			.setOrigin(0)
			.setZoom((RENDER_SCALE * area.size) / FIELD_W)
			.setScroll(ORIGIN.x, ORIGIN.y);
		this.warnings = scene.add.graphics().setDepth(1);
		this.sprites = new SpriteLayer(scene, ORIGIN, 2);
		this.projectiles = scene.add.graphics().setDepth(3);
		this.effectLayer = scene.add.graphics().setDepth(4);
	}

	show(setup: DemoSetup) {
		this.battle = new Battle({
			...newRun(setup.shipId ?? 'halcon'),
			zone: setup.zone,
			cores: EVOLUTION_CORES[setup.stage ?? 0],
		}).sandbox();
		this.script = setup.script;
		this.time = 0;
		this.accumulator = 0;
		this.target = null;
		this.targetY = null;
		this.fire = false;
		this.shield = false;
		this.memo = {};
		this.effects = new Effects();
		this.starfield?.destroy();
		this.starfield = new Starfield(this.scene, { ...ORIGIN, w: FIELD_W, h: FIELD_H }, this.battle.zone.sky, 70).setDepth(0);
	}

	update(dt: number) {
		this.time += dt;
		this.accumulator += dt;
		const battle = this.battle;
		while (this.accumulator >= STEP) {
			this.script(this);
			const target = this.target?.() ?? FIELD_W / 2 + Math.sin(this.time * 0.8) * 190;
			battle.setInput({
				move: Math.max(-1, Math.min(1, (target - battle.player.x) / 30)),
				moveY: this.targetY ? Math.max(-1, Math.min(1, (this.targetY() - battle.player.y) / 30)) : 0,
				fire: this.fire,
				shield: this.shield,
			});
			battle.hp = 100;
			battle.energy = 100;
			battle.step(STEP);
			this.accumulator -= STEP;
		}
		this.consumeEvents();
		this.effects.update(dt);

		this.starfield?.draw(this.time);
		drawWarnings(this.warnings, battle, ORIGIN);
		this.sprites.sync(spriteViews(battle, true));
		drawProjectiles(this.projectiles, battle, ORIGIN, true);
		this.effects.draw(this.effectLayer, ORIGIN);
	}

	/** Sólo las chispas: el ejemplo no suena, para no tapar la música ni cansar. */
	private consumeEvents() {
		const family = this.battle.zone.family;
		for (const event of this.battle.events) {
			if (event.type === 'kill') {
				const colors = event.family === 'rock'
					? [0xb0a090, 0x7a6c5e]
					: event.family === 'pod' ? [0xa4b0cc, 0xef5466, 0xffd860]
					: event.family === 'freighter' ? FREIGHTER_COLORS : FAMILY_COLORS[event.family];
				this.effects.burst(event.x, event.y, colors, event.big ? 22 : 12, event.big ? 220 : 160);
			} else if (event.type === 'hit') {
				this.effects.burst(event.x, event.y, [0xffffff, 0xffe28a], 3, 90);
			} else if (event.type === 'blast') {
				this.effects.ring(event.x, event.y, event.radius, 0xff5466, 0.5);
				this.effects.burst(event.x, event.y, [0xff5466, 0xff8a3a, 0xffd860], 24, 240);
			} else if (event.type === 'playerHit') {
				this.effects.burst(this.battle.player.x, this.battle.player.y, [0xef5466, 0xffffff], 8, 140);
			} else if (event.type === 'deflect') {
				this.effects.burst(event.x, event.y, [0xa4b0cc, 0x5a6482], 3, 120);
			} else if (event.type === 'stormBlock') {
				this.effects.ring(event.x, event.y, 56, 0x7fe0ff, 0.45);
			} else if (event.type === 'pickup') {
				this.effects.ring(event.x, event.y, 30, 0x7fe0ff, 0.35);
			} else if (event.type === 'bossDown') {
				this.effects.burst(event.x, event.y, FAMILY_COLORS[family], 40, 260);
			}
		}
		this.battle.events = [];
	}
}
