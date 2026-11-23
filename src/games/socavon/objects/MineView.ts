import Phaser from 'phaser';
import { CART, GRIP, GUARD, PICK_HITS } from '../constants/tuning';
import { sightRange } from '../state/guardBrain';
import { railRange } from '../state/level';
import type { Guard, Item, Mine, MineEvent } from '../state/Mine';
import { liveSpans } from '../state/vision';
import { addClip, showClip } from './art';
import { CART_LIFT, centerX, feetY, GALLERY, GRIP_LIFT, mineSize, TILE } from './geometry';
import { brightnessAt, collectLights, tintFor } from './lighting';
import { memoryTint, multiply, Sight } from './sight';

type Lit = { image: Phaser.GameObjects.Image; x: number; y: number; floor?: number };
/**
 * Lo que se mueve tiene dos sprites: el real, que se ve sólo en vivo, y el
 * recuerdo, una copia fija del último cuadro que se vio. Así un sereno que
 * sube a la galería del minero aparece en vivo sin borrarse del recuerdo.
 */
type Remembered = {
	real: Phaser.GameObjects.Image;
	ghost: Phaser.GameObjects.Image;
	wasLive: boolean;
	/** Si hay un recuerdo vigente: se borra en cuanto se ve ese lugar sin él. */
	remembered: boolean;
};
type GuardSprites = Remembered & {
	body: Phaser.GameObjects.Image;
	mark: Phaser.GameObjects.Text;
	key: Phaser.GameObjects.Image;
};
type Shaft = { x: number; bottom: number };

/** Lo que cuelga se engancha en el techo: su pie queda en el aire. */
const HANGING_OFFSET = 25;
const EYES = 62;
/** Agachado adentro de la vagoneta: asoman el casco y las manos. */
const RIDE_LIFT = 17;
/** Lo que baja el sprite mientras se suelta del agarre. */
const DROP_FALL = 40;

/**
 * Dibuja una mina a partir de su estado, sin guardar nada del juego. Todo vive
 * en un contenedor que la escena corre para seguir al minero; así la cámara
 * queda en manos del plugin de escala y el HUD no se mueve.
 */
export class MineView {
	readonly root: Phaser.GameObjects.Container;
	readonly width: number;
	readonly height: number;

	private readonly scene: Phaser.Scene;
	private readonly mine: Mine;
	private readonly lit: Lit[] = [];
	private readonly walls: Phaser.GameObjects.Image[][] = [];
	private readonly vaults: Phaser.GameObjects.Image[] = [];
	private readonly lamps: Phaser.GameObjects.Image[] = [];
	private readonly bells: Phaser.GameObjects.Image[] = [];
	private readonly barrows: Phaser.GameObjects.Image[] = [];
	private readonly carts: Remembered[] = [];
	private readonly guards: GuardSprites[] = [];
	private readonly shafts: Shaft[] = [];
	private readonly sight: Sight;
	private cable!: Phaser.GameObjects.Graphics;
	private readonly items = new Map<Item, Phaser.GameObjects.Image>();
	private readonly itemLayer: Phaser.GameObjects.Container;
	private readonly glow: Phaser.GameObjects.Graphics;
	private readonly beams: Phaser.GameObjects.Graphics;
	private readonly player: Phaser.GameObjects.Image;
	private readonly arms: Phaser.GameObjects.Graphics;
	private readonly effects: Phaser.GameObjects.Container;
	private time = 0;
	/** Avanza sólo si se mueve: quieto en la escalera, el sprite se queda quieto. */
	private stride = 0;
	private struckAt = -Infinity;
	private caughtAt = 0;
	private behindGuards = false;

	constructor(scene: Phaser.Scene, mine: Mine) {
		this.scene = scene;
		this.mine = mine;
		const size = mineSize(mine.level.width, mine.level.height);
		this.width = size.width;
		this.height = size.height;
		this.sight = new Sight(mine.level.width, mine.level.height);

		this.root = scene.add.container(0, 0);
		this.buildTerrain();
		this.buildFixtures();
		this.glow = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
		this.beams = scene.add.graphics();
		this.itemLayer = scene.add.container(0, 0);
		this.root.add([this.glow, this.beams, this.itemLayer]);

		for (const barrow of mine.barrows) {
			this.barrows.push(this.put(centerX(barrow.x), feetY(barrow.y), 'grandes/barrow_0'));
		}
		for (const guard of mine.guards) this.guards.push(this.createGuard(guard));
		this.player = this.put(centerX(mine.player.x), feetY(mine.player.y), 'minero/idle');
		for (const cart of mine.carts) {
			const real = this.put(centerX(cart.x), feetY(cart.y) - CART_LIFT, 'grandes/cart');
			this.carts.push({ real, ghost: this.put(real.x, real.y, 'grandes/cart').setVisible(false), wasLive: false, remembered: false });
		}

		this.arms = scene.add.graphics();
		this.effects = scene.add.container(0, 0);
		this.root.add([this.arms, this.effects]);
	}

	private put(x: number, y: number, clip: string) {
		const image = addClip(this.scene, x, y, clip);
		this.root.add(image);
		return image;
	}

	/** `y` es el pie del tile. */
	private putLit(x: number, y: number, clip: string, floor?: number) {
		const image = this.put(x, y, clip);
		this.lit.push({ image, x, y: y - TILE / 2, floor });
		return image;
	}

	private buildTerrain() {
		const { level } = this.mine;
		for (let x = 0; x < level.width; x += 1) {
			for (let row = 0; row <= level.height * 3; row += 1) {
				this.putLit(centerX(x), (row + 1) * TILE, this.tileAt(x, row));
			}
		}
	}

	private tileAt(x: number, row: number) {
		const { level } = this.mine;
		// Mezcla fija por celda: variedad sin azar en cada redibujo.
		const variant = (x * 7 + row * 13 + ((x * row) % 5)) % 3 === 0 ? 'b' : 'a';
		if (row === 0) return `tiles/rock_${variant}`;

		const y = Math.floor((row - 1) / 3);
		const symbol = level.at(x, y);
		if (symbol === '#') return `tiles/rock_${variant}`;
		if (row % 3 === 0) return symbol === 'h' ? 'tiles/back_b' : `tiles/floor_${variant}`;
		const post = '.$='.includes(symbol) && (x + y * 3) % 7 === 0;
		return post ? 'tiles/back_post' : `tiles/back_${variant}`;
	}

	private buildFixtures() {
		const { level } = this.mine;
		this.drawShafts();
		for (const { x, y } of level.find('n')) this.putLit(centerX(x), feetY(y), 'grandes/niche', 0.6);
		for (const { x, y } of this.mine.exits) this.putLit(centerX(x), feetY(y), 'grandes/hoist', 0.75);
		for (const { x, y } of this.mine.vaults) {
			this.vaults.push(this.putLit(centerX(x), feetY(y), 'grandes/vault_closed', 0.65));
		}
		for (const cart of level.find('C')) {
			const [from, to] = railRange(level, cart);
			for (let x = from; x <= to; x += 1) this.putLit(centerX(x), feetY(cart.y), 'tiles/rail', 0.6);
		}
		for (const { x, y } of level.find('H')) {
			for (let step = 1; step <= 3; step += 1) {
				this.putLit(centerX(x), feetY(y) + step * TILE, 'tiles/ladder', 0.65);
			}
		}
		for (const { x, y } of level.find('h')) {
			this.putLit(centerX(x), feetY(y) - TILE, 'tiles/beam', 0.65);
			this.putLit(centerX(x), feetY(y) - HANGING_OFFSET, 'objetos/handle', 0.75);
		}
		for (const { x, y } of level.find('A')) {
			this.putLit(centerX(x), feetY(y) - HANGING_OFFSET, 'objetos/staple', 0.85);
		}
		for (const { x, y } of this.mine.walls) {
			this.walls.push([0, 1].map((up) => this.putLit(centerX(x), feetY(y) - up * TILE, 'tiles/wall', 0.6)));
		}
		for (const { x, y } of this.mine.lamps) {
			this.lamps.push(this.put(centerX(x), feetY(y) - HANGING_OFFSET, 'objetos/lamp_on'));
		}
		for (const { x, y } of this.mine.bells) {
			this.bells.push(this.putLit(centerX(x), feetY(y) - HANGING_OFFSET, 'objetos/bell', 0.75));
		}
	}

	/** El cable del montacargas, de la superficie a su última parada. */
	private drawShafts() {
		const lowest = new Map<number, number>();
		for (const { x, y } of this.mine.exits) lowest.set(x, Math.max(y, lowest.get(x) ?? 0));
		for (const [x, y] of lowest) this.shafts.push({ x: centerX(x), bottom: feetY(y) - GALLERY + TILE });
		this.cable = this.scene.add.graphics();
		this.root.add(this.cable);
	}

	/** El cable cruza todas las galerías: se redibuja tramo por tramo, con lo que se ve de cada uno. */
	private drawCable() {
		const { cable, sight } = this;
		cable.clear();
		for (const { x, bottom } of this.shafts) {
			for (let top = 0; top < bottom; top += TILE) {
				const age = sight.ageAt(x, top + TILE / 2);
				const tint = age === 0 ? 0xffffff : memoryTint(age);
				if (tint === 0) continue;
				const height = Math.min(TILE, bottom - top);
				cable.fillStyle(multiply(0x050304, tint), 0.5).fillRect(x - 10, top, 20, height);
				cable.fillStyle(multiply(0xa06d4e, tint), 1).fillRect(x - 2, top, 4, height);
			}
		}
	}

	/**
	 * Muestra el sprite real si se ve en vivo. Si no, deja el recuerdo donde se
	 * lo vio por última vez, hasta que se apaga o ese lugar vuelve a verse.
	 */
	private remember(entry: Remembered, live: boolean) {
		const { real, ghost } = entry;
		real.setVisible(live);
		if (live) {
			entry.wasLive = true;
			entry.remembered = false;
			ghost.setVisible(false);
			return;
		}
		if (entry.wasLive) {
			entry.wasLive = false;
			entry.remembered = true;
			ghost.setFrame(real.frame.name).setOrigin(real.originX, real.originY)
				.setPosition(real.x, real.y).setFlipX(real.flipX).setAlpha(real.alpha);
		}
		const age = this.sight.ageAt(ghost.x, ghost.y - TILE);
		// Se lo vio irse, o se volvió a mirar ahí y no estaba: el recuerdo nuevo no lo tiene.
		if (age === 0) entry.remembered = false;
		const tint = entry.remembered ? memoryTint(age) : 0;
		ghost.setVisible(tint !== 0).setTint(tint);
	}

	private createGuard(guard: Guard): GuardSprites {
		const x = centerX(guard.x);
		const body = this.put(x, feetY(guard.y), 'sereno/idle');
		const ghost = this.put(x, feetY(guard.y), 'sereno/idle').setVisible(false);
		const key = this.put(x, feetY(guard.y), 'objetos/key').setScale(1);
		const mark = this.scene.add.text(x, 0, '', {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: '22px',
			color: '#ffd257',
			stroke: '#120c0e',
			strokeThickness: 5,
		}).setOrigin(0.5, 1);
		this.root.add(mark);
		return { body, real: body, ghost, wasLive: false, remembered: false, key, mark };
	}

	update(dt: number) {
		this.time += dt;
		const { mine } = this;
		const alarm = mine.alarm > 0 ? (Math.sin(this.time * 9) + 1) / 2 : 0;
		const lights = collectLights(mine);
		const { sight } = this;
		sight.update(liveSpans(mine), this.time);
		// En vivo, la luz; si no, el recuerdo que se apaga, o negro si nunca se vio.
		const shade = (x: number, y: number, floor?: number) => {
			const age = sight.ageAt(x, y);
			return age === 0 ? tintFor(brightnessAt(lights, x, y, floor), alarm) : memoryTint(age);
		};
		const seen = (x: number, y: number) => sight.ageAt(x, y) === 0;

		for (const { image, x, y, floor } of this.lit) image.setTint(shade(x, y, floor));
		this.drawCable();
		this.updateFixtures(alarm, seen);
		this.updateItems(shade);
		const watching = mine.guards.map((guard) => seen(centerX(guard.x), feetY(guard.y) - TILE));
		this.drawBeams(watching);
		mine.guards.forEach((guard, index) => {
			const sprites = this.guards[index];
			if (watching[index]) {
				this.updateGuard(guard, sprites);
				sprites.body.setTint(shade(centerX(guard.x), feetY(guard.y) - TILE, 0.75));
			}
			sprites.mark.setVisible(watching[index]);
			if (!watching[index]) sprites.key.setVisible(false);
			this.remember(sprites, watching[index]);
		});
		this.updatePlayer(dt);
		this.drawArms();

		mine.barrows.forEach((barrow, index) => {
			const held = mine.player.barrow === barrow;
			const facing = held ? mine.player.facing : barrow.facing;
			const x = centerX(barrow.x) + (held ? facing * 40 : 0);
			showClip(this.barrows[index], `grandes/barrow_${barrow.load}`)
				.setPosition(x, feetY(barrow.y))
				.setFlipX(facing < 0)
				.setTint(shade(x, feetY(barrow.y) - TILE, 0.7));
		});
		mine.carts.forEach((cart, index) => {
			const sprites = this.carts[index];
			const live = seen(centerX(cart.x), feetY(cart.y) - TILE);
			if (live) {
				const waiting = cart.waitFor > 0;
				const shake = waiting && cart.waitFor < CART.warning ? Math.sin(this.time * 70) * 2 : 0;
				showClip(sprites.real, 'grandes/cart', waiting ? 0 : this.time)
					.setPosition(centerX(cart.x) + shake, feetY(cart.y) - CART_LIFT)
					.setFlipX(cart.direction < 0)
					.setTint(shade(centerX(cart.x), feetY(cart.y) - TILE, 0.7));
			}
			this.remember(sprites, live);
		});
	}

	/** Lo que no se ve en vivo queda como se lo vio: una lámpara no se prende en el recuerdo. */
	private updateFixtures(alarm: number, seen: (x: number, y: number) => boolean) {
		const { mine, sight } = this;
		this.glow.clear();
		mine.lamps.forEach((lamp, index) => {
			const x = centerX(lamp.x);
			const y = feetY(lamp.y) - TILE;
			if (!seen(x, y)) {
				this.lamps[index].setTint(memoryTint(sight.ageAt(x, y)));
				return;
			}
			showClip(this.lamps[index], lamp.lit ? 'objetos/lamp_on' : 'objetos/lamp_off').setTint(0xffffff);
			if (!lamp.lit) return;
			const flicker = Math.sin(this.time * 11 + index * 2) * 2;
			this.glow.fillStyle(0xf39c12, 0.07);
			this.glow.fillCircle(centerX(lamp.x), feetY(lamp.y) - 59, 42 + flicker);
			this.glow.fillCircle(centerX(lamp.x), feetY(lamp.y) - 59, 24 + flicker);
		});
		mine.bells.forEach((bell, index) => {
			if (!seen(centerX(bell.x), feetY(bell.y) - TILE)) return;
			showClip(this.bells[index], mine.alarm > 0 ? 'objetos/bell_ring' : 'objetos/bell', this.time);
			if (mine.alarm <= 0) return;
			this.glow.fillStyle(0xff3b30, 0.08 + alarm * 0.08);
			this.glow.fillCircle(centerX(bell.x), feetY(bell.y) - 70, 40);
		});
		mine.vaults.forEach((vault, index) => {
			showClip(this.vaults[index], vault.open ? 'grandes/vault_open' : 'grandes/vault_closed');
		});
		mine.walls.forEach((wall, index) => {
			const [bottom, top] = this.walls[index];
			const broken = wall.hits >= PICK_HITS;
			top.setVisible(!broken);
			const clip = broken ? 'tiles/rubble' : wall.hits ? 'tiles/wall_cracked' : 'tiles/wall';
			showClip(bottom, clip);
			if (!broken) showClip(top, wall.hits > 1 ? 'tiles/wall_cracked' : 'tiles/wall');
		});
	}

	private updateItems(shade: (x: number, y: number, floor: number) => number) {
		const present = new Set(this.mine.items);
		for (const [item, image] of this.items) {
			if (present.has(item)) continue;
			image.destroy();
			this.items.delete(item);
		}
		for (const item of present) {
			const x = centerX(item.x);
			const y = feetY(item.y);
			let image = this.items.get(item);
			if (!image) {
				image = addClip(this.scene, x, y, `objetos/${item.kind}`);
				this.itemLayer.add(image);
				this.items.set(item, image);
			}
			image.setTint(shade(x, y - 20, 0.75));
		}
	}

	/** El haz llega hasta donde el sereno vería al minero con la luz de ahora. */
	private drawBeams(watching: boolean[]) {
		const { mine, beams } = this;
		beams.clear();
		const range = mine.player.hidden ? GUARD.sightDark : sightRange(mine);
		for (const [index, guard] of mine.guards.entries()) {
			if (!watching[index] || guard.mode === 'stunned' || !Number.isInteger(guard.y)) continue;
			let cells = range;
			for (let step = 1; step <= Math.ceil(range); step += 1) {
				if (mine.isSolid(Math.round(guard.x + guard.facing * step), guard.y)) {
					cells = step - 0.5;
					break;
				}
			}
			const x = centerX(guard.x) + guard.facing * 14;
			const end = x + guard.facing * cells * TILE;
			const feet = feetY(guard.y);
			const chasing = guard.mode === 'chase';
			beams.fillStyle(chasing ? 0xff5a3c : 0xffd257, chasing ? 0.16 : 0.08);
			beams.fillTriangle(x, feet - EYES, end, feet - 90, end, feet);
		}
	}

	private updateGuard(guard: Guard, sprites: GuardSprites) {
		let clip = 'idle';
		if (guard.mode === 'stunned') clip = 'stunned';
		else if (!Number.isInteger(guard.y)) clip = 'climb';
		else if (guard.moving) clip = guard.mode === 'chase' || guard.mode === 'investigate' ? 'run' : 'walk';

		const x = centerX(guard.x);
		const y = feetY(guard.y);
		showClip(sprites.body, `sereno/${clip}${guard.hasKey ? '' : '_empty'}`, this.time + guard.home.x)
			.setPosition(x, y)
			// Parpadea mientras la vagoneta no lo puede volver a tirar.
			.setAlpha(guard.shakenFor > 0 && Math.floor(this.time * 10) % 2 === 0 ? 0.4 : 1)
			.setFlipX(guard.facing < 0);

		let mark = '';
		if (guard.mode === 'chase') mark = '!';
		else if (guard.mode === 'stunned') mark = '✶';
		else if (guard.mode !== 'patrol' || guard.noticed > 0) mark = '?';
		if (sprites.mark.text !== mark) sprites.mark.setText(mark).setColor(mark === '!' ? '#ff5a3c' : '#ffd257');
		sprites.mark.setPosition(x, y - 80);
		// La llavecita marca a quién hay que robarle, aunque la tape el brazo.
		sprites.key
			.setVisible(guard.hasKey)
			.setPosition(x - guard.facing * 24, y - 64 + Math.sin(this.time * 4) * 3);
	}

	private updatePlayer(dt: number) {
		const { player, status, alarm } = this.mine;
		if (player.moving) this.stride += dt;

		let clip = 'idle';
		let time = this.time;
		let lift = 0;
		let shake = 0;
		if (status === 'dying' || status === 'over') {
			clip = 'caught';
			time = this.time - this.caughtAt;
		} else if (player.state === 'climb') {
			clip = player.hands === 'bag' ? 'climb_carry' : player.hands === 'pick' ? 'climb_pick' : 'climb';
			time = this.stride;
		} else if (player.state === 'grip' || player.state === 'drop') {
			clip = 'grip';
			lift = GRIP_LIFT;
			if (player.state === 'drop') lift -= (1 - player.dropFor / GRIP.drop) * DROP_FALL;
			else if (player.stamina < GRIP.warning) shake = Math.sin(this.time * 60) * 2;
			else time = 0;
		} else if (player.state === 'ride') {
			clip = player.hands === 'bag' ? 'ride_carry' : player.hands === 'pick' ? 'ride_pick' : 'ride';
			lift = RIDE_LIFT;
			const { cart } = player;
			if (cart && cart.waitFor > 0) {
				time = 0;
				if (cart.waitFor < CART.warning) shake = Math.sin(this.time * 70) * 2;
			}
		} else if (player.state === 'hang' || player.state === 'fall') {
			clip = 'hang';
			time = this.stride;
			lift = player.state === 'hang' ? 8 : 0;
			if (player.state === 'hang' && player.stamina < GRIP.warning) shake = Math.sin(this.time * 60) * 2;
		} else if (this.time - this.struckAt < 0.3) {
			clip = 'strike';
			time = this.time - this.struckAt;
		} else if (player.hands === 'bag') {
			clip = player.moving ? 'carry' : 'carry_idle';
		} else if (player.hands === 'pick') {
			clip = player.moving ? 'pick_walk' : 'pick_idle';
		} else if (player.hands === 'barrow') {
			clip = 'push';
			time = this.stride;
		} else if (player.moving) {
			clip = 'walk';
		}

		// Escondido en el nicho, el sereno que pasa le queda por delante.
		const behind = player.hidden && this.guards.length > 0;
		if (behind !== this.behindGuards) {
			this.behindGuards = behind;
			if (behind) this.root.moveBelow(this.player, this.guards[0].body);
			else this.root.moveAbove<Phaser.GameObjects.GameObject>(this.player, this.guards[this.guards.length - 1].mark);
		}

		const blink = status === 'playing' && player.invincible > 0 && Math.floor(this.time * 10) % 2 === 0;
		let tint = player.headlamp ? 0xffffff : 0xb4a8a8;
		if (player.hidden) tint = 0x4a4040;
		else if (alarm > 0) tint = 0xffe0d8;
		showClip(this.player, `minero/${clip}`, time)
			.setPosition(centerX(player.x) + shake, feetY(player.y) - lift)
			.setFlipX(player.facing < 0)
			.setAlpha(blink ? 0.35 : 1)
			.setTint(tint);
	}

	/** Cuánto le queda de brazos: baja colgado y vuelve descansando. */
	private drawArms() {
		const { arms } = this;
		const { player, status } = this.mine;
		arms.clear();
		const holding = player.state === 'grip' || player.state === 'hang';
		if (status !== 'playing' || (!holding && player.stamina >= GRIP.time)) return;
		const left = centerX(player.x) - 22;
		const top = feetY(player.y) - 110;
		const colour = player.stamina < GRIP.warning ? 0xff5a3c : 0xf2bd36;
		arms.fillStyle(0x120c0e, 1).fillRect(left - 2, top - 2, 48, 9);
		arms.fillStyle(colour, 1).fillRect(left, top, (44 * player.stamina) / GRIP.time, 5);
	}

	/** Efectos que no son estado: ondas de ruido, polvo y puntos. */
	react(event: MineEvent) {
		const x = centerX(event.x);
		const y = feetY(event.y);
		if (event.type === 'noise') this.ring(x, y - 40, event.radius * TILE);
		else if (event.type === 'score') this.floatingPoints(x, y - 80, event.points);
		else if (event.type === 'hit' || event.type === 'wallBroken') {
			this.struckAt = this.time;
			this.dust(x, y - 44, event.type === 'hit' ? 7 : 18);
		} else if (event.type === 'land') this.dust(x, y - 4, 8);
		else if (event.type === 'lifeLost') this.caughtAt = this.time;
	}

	private ring(x: number, y: number, radius: number) {
		const ring = this.scene.add.ellipse(x, y, radius * 2, 96).setStrokeStyle(3, 0xffe98a, 0.4).setScale(0.05);
		this.effects.add(ring);
		this.scene.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 520, onComplete: () => ring.destroy() });
	}

	private dust(x: number, y: number, count: number) {
		for (let i = 0; i < count; i += 1) {
			const bit = this.scene.add.rectangle(x, y, 6, 6, i % 2 ? 0x857069 : 0x5a392c);
			this.effects.add(bit);
			this.scene.tweens.add({
				targets: bit,
				x: x + Phaser.Math.Between(-46, 46),
				y: y + Phaser.Math.Between(-22, 40),
				alpha: 0,
				duration: Phaser.Math.Between(250, 480),
				onComplete: () => bit.destroy(),
			});
		}
	}

	private floatingPoints(x: number, y: number, points: number) {
		const text = this.scene.add.text(x, y, `+${points}`, {
			fontFamily: 'Courier New, monospace',
			fontSize: '20px',
			fontStyle: 'bold',
			color: '#ffd257',
			stroke: '#120c0e',
			strokeThickness: 4,
		}).setOrigin(0.5);
		this.effects.add(text);
		this.scene.tweens.add({ targets: text, y: y - 36, alpha: 0, duration: 1000, onComplete: () => text.destroy() });
	}
}
