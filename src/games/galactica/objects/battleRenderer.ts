import type Phaser from 'phaser';
import { FAMILY_FRAME } from '../constants/families';
import { shipFrame } from '../constants/ships';
import { STORM } from '../constants/passages';
import { FIELD_H, FIELD_W, PLANT_RADIUS, PLAYER_RADIUS, ROCK_RADIUS } from '../constants/tuning';
import type { Battle, Strike } from '../state/Battle';
import { BOSSES_ATLAS, SHIPS_ATLAS } from './art';
import type { SpriteView } from './SpriteLayer';

export type Offset = { x: number; y: number };

const BULLET_COLORS = {
	bolt: [0xff6a5a, 0xffd0c0],
	helix: [0xe46ad2, 0xffd0f6],
	fan: [0xffb04a, 0xfff0b0],
	split: [0x7fe0ff, 0xe8fbff],
} as const;

/** Qué sprites hay en pantalla y cómo se ven. El parpadeo y los destellos salen del estado. */
export function spriteViews(battle: Battle, playerVisible: boolean): SpriteView[] {
	const views: SpriteView[] = [];
	const time = battle.time;

	for (const pod of battle.pods) {
		views.push({ id: pod.id, atlas: SHIPS_ATLAS, frame: 'pod', x: pod.x, y: pod.y, tint: pod.flash > 0 ? 0xffffff : undefined });
	}
	for (const rock of battle.rocks) {
		views.push({
			id: rock.id, atlas: SHIPS_ATLAS, frame: `rock_${rock.frame}`, x: rock.x, y: rock.y, angle: rock.angle,
			tint: rock.flash > 0 ? 0xffffff : undefined,
		});
	}
	for (const freighter of battle.freighters) {
		views.push({
			id: freighter.id, atlas: SHIPS_ATLAS, frame: 'freighter', x: freighter.x, y: freighter.y,
			flipX: freighter.vx < 0,
			tint: freighter.flash > 0 ? 0xffffff : undefined,
		});
	}
	for (const pickup of battle.pickups) {
		views.push({
			id: pickup.id, atlas: SHIPS_ATLAS, frame: `pick_${pickup.kind}`,
			x: pickup.x, y: pickup.y + Math.sin(pickup.age * 5) * 2,
		});
	}

	for (const enemy of battle.enemies) {
		if (enemy.state === 'waiting' || enemy.state === 'gone') {
			continue;
		}
		let tint: number | undefined = enemy.flash > 0 ? 0xffffff : undefined;
		if (enemy.aim > 0 && Math.floor(enemy.aim * 15) % 2 === 0) {
			tint = 0xffd860;
		}
		if (enemy.state === 'planted') {
			// El parpadeo se acelera cuando falta poco para la explosión.
			const rate = enemy.timer < 0.8 ? 14 : 6;
			if (Math.floor(enemy.timer * rate) % 2 === 0) {
				tint = 0xff3b4e;
			}
		}
		views.push({
			id: enemy.id,
			atlas: SHIPS_ATLAS,
			frame: enemy.rank === 0 ? 'shard' : `${FAMILY_FRAME[enemy.family]}_${enemy.rank}`,
			x: enemy.x,
			y: enemy.y,
			angle: enemy.angle,
			tint,
		});
	}

	const boss = battle.boss;
	if (boss) {
		views.push({
			id: boss.id, atlas: BOSSES_ATLAS, frame: boss.def.frame, x: boss.x, y: boss.y,
			tint: boss.flash > 0 ? 0xffffff : boss.telegraph > 0 && Math.floor(time * 16) % 2 === 0 ? 0xff5466 : undefined,
		});
	}

	if (playerVisible) {
		const player = battle.player;
		const blinking = player.invulnerable > 0 && Math.floor(time * 20) % 2 === 0;
		views.push({
			id: 0, atlas: SHIPS_ATLAS, frame: shipFrame(battle.ship.id, battle.stage),
			x: player.x, y: player.y, alpha: blinking ? 0.35 : 1,
			// Se inclina apenas hacia donde se mueve.
			angle: (player.vx / battle.ship.speed) * 0.12,
		});
	}
	return views;
}

/** Avisos debajo de las naves: la explosión que viene, la carga del jefe, los cometas. */
export function drawWarnings(g: Phaser.GameObjects.Graphics, battle: Battle, view: Offset) {
	g.clear();
	const time = battle.time;
	for (const enemy of battle.enemies) {
		if (enemy.state !== 'planted') {
			continue;
		}
		const urgency = 1 - enemy.timer / 2.2;
		g.fillStyle(0xff3b4e, 0.06 + urgency * 0.12);
		g.fillCircle(view.x + enemy.x, view.y + enemy.y, PLANT_RADIUS);
		g.lineStyle(2, 0xff5466, 0.4 + 0.4 * Math.abs(Math.sin(time * (6 + urgency * 10))));
		g.strokeCircle(view.x + enemy.x, view.y + enemy.y, PLANT_RADIUS);
	}

	const boss = battle.boss;
	if (boss && boss.state === 'charging' && boss.telegraph > 0) {
		g.fillStyle(0xff3b4e, 0.12 + 0.1 * Math.abs(Math.sin(time * 12)));
		g.fillRect(view.x + boss.chargeX - 44, view.y + boss.y, 88, FIELD_H - boss.y);
	}

	drawRockMarks(g, battle, view);
	for (const strike of battle.strikes) {
		if (strike.timer <= 0) {
			continue;
		}
		// Se llena a medida que se acerca; el último cuarto de segundo es el momento del escudo.
		const urgency = 1 - strike.timer / STORM.warning;
		const now = strike.timer < 0.25;
		const { x, y, w, h } = bandRect(strike, view);
		g.fillStyle(0x7fe0ff, now ? 0.28 : 0.07 + urgency * 0.14);
		g.fillRect(x, y, w, h);
		g.lineStyle(now ? 3 : 1, now ? 0xffffff : 0x7fe0ff, 0.35 + urgency * 0.5);
		g.strokeRect(x, y, w, h);
	}

	for (const warning of battle.cometWarnings) {
		if (warning.timer <= -warning.delay) {
			continue;
		}
		// La línea por donde va a pasar: misma pendiente que el cometa.
		const alpha = 0.25 + 0.35 * Math.abs(Math.sin(time * 10));
		const x0 = view.x + warning.x;
		const slope = warning.vx / 440;
		g.lineStyle(1, 0xffe0a0, alpha);
		for (let y = 0; y < FIELD_H; y += 24) {
			g.lineBetween(x0 + slope * y, view.y + y, x0 + slope * (y + 12), view.y + y + 12);
		}
		g.fillStyle(0xffe0a0, alpha + 0.2);
		g.fillTriangle(x0 - 6, view.y + 4, x0 + 6, view.y + 4, x0, view.y + 14);
	}
}

/** Disparos, cometas y el escudo: todo lo que se redibuja entero cada cuadro. */
export function drawProjectiles(g: Phaser.GameObjects.Graphics, battle: Battle, view: Offset, playerVisible: boolean) {
	g.clear();

	for (const shot of battle.shots) {
		const color = battle.ship.color;
		const x = view.x + shot.x;
		const y = view.y + shot.y;
		g.fillStyle(color, 0.25);
		g.fillRect(x - 3, y - 2, 6, shot.pierce ? 18 : 14);
		g.fillStyle(0xffffff, 1);
		g.fillRect(x - 1, y, 3, shot.pierce ? 14 : 10);
	}

	for (const bullet of battle.bullets) {
		const [color, core] = BULLET_COLORS[bullet.style];
		const x = view.x + bullet.x;
		const y = view.y + bullet.y;
		g.fillStyle(color, 0.3);
		g.fillCircle(x, y, 7);
		g.fillStyle(color, 1);
		g.fillCircle(x, y, 4);
		g.fillStyle(core, 1);
		g.fillCircle(x, y, 2);
	}

	for (const comet of battle.comets) {
		const x = view.x + comet.x;
		const y = view.y + comet.y;
		const length = Math.hypot(comet.vx, comet.vy);
		for (let index = 6; index >= 1; index -= 1) {
			const back = index * 9;
			g.fillStyle(0xff9a4a, 0.1 + (6 - index) * 0.06);
			g.fillCircle(x - (comet.vx / length) * back, y - (comet.vy / length) * back, 7 - index * 0.8);
		}
		g.fillStyle(0xfff4d8, 1);
		g.fillCircle(x, y, 6);
	}

	for (const strike of battle.strikes) {
		if (strike.timer <= 0) {
			drawBolts(g, strike, battle.time, view);
		}
	}

	if (playerVisible && battle.player.shielding) {
		const fading = battle.player.shield < 2 && Math.floor(battle.time * 10) % 2 === 0;
		g.lineStyle(2, 0xc49bff, fading ? 0.3 : 0.85);
		g.strokeCircle(view.x + battle.player.x, view.y + battle.player.y, PLAYER_RADIUS + 18);
		g.fillStyle(0xb072e6, 0.12);
		g.fillCircle(view.x + battle.player.x, view.y + battle.player.y, PLAYER_RADIUS + 18);
	}
}

function bandRect(strike: Strike, view: Offset) {
	const size = strike.to - strike.from;
	return strike.axis === 'x'
		? { x: view.x + strike.from, y: view.y, w: size, h: FIELD_H }
		: { x: view.x, y: view.y + strike.from, w: FIELD_W, h: size };
}

/** Lo que todavía no asomó se marca en el borde: en rojo las rocas, en verde el hueco. */
function drawRockMarks(g: Phaser.GameObjects.Graphics, battle: Battle, view: Offset) {
	for (const rock of battle.rocks) {
		if (rock.gap === undefined) {
			continue;
		}
		if (rock.vy > 0 && rock.y < -ROCK_RADIUS) {
			g.fillStyle(0xff5466, 0.75);
			g.fillRect(view.x + rock.x - 16, view.y + 2, 32, 5);
			g.fillStyle(0x9be15d, 0.9);
			g.fillTriangle(
				view.x + rock.gap - 12, view.y + 3, view.x + rock.gap + 12, view.y + 3, view.x + rock.gap, view.y + 19,
			);
		} else if (rock.vy === 0 && (rock.vx > 0 ? rock.x < -ROCK_RADIUS : rock.x > FIELD_W + ROCK_RADIUS)) {
			const side = rock.vx > 0 ? 1 : -1;
			const edge = view.x + (side === 1 ? 0 : FIELD_W);
			g.fillStyle(0xff5466, 0.75);
			g.fillRect(side === 1 ? edge + 2 : edge - 7, view.y + rock.y - 16, 5, 32);
			g.fillStyle(0x9be15d, 0.9);
			const y = view.y + rock.gap;
			g.fillTriangle(edge + side * 3, y - 12, edge + side * 3, y + 12, edge + side * 19, y);
		}
	}
}

/** La descarga: la franja encendida y tres rayos que cambian unas veinte veces por segundo. */
function drawBolts(g: Phaser.GameObjects.Graphics, strike: Strike, time: number, view: Offset) {
	const { x, y, w, h } = bandRect(strike, view);
	g.fillStyle(0x7fe0ff, 0.35);
	g.fillRect(x, y, w, h);
	const along = strike.axis === 'x' ? FIELD_H : FIELD_W;
	const size = strike.to - strike.from;
	const frame = Math.floor(time * 20);
	for (let bolt = 0; bolt < 3; bolt += 1) {
		const points: Offset[] = [];
		for (let step = 0; step <= 16; step += 1) {
			// El azar sale de los números del rayo, no de la partida: dibujar no puede correr su semilla.
			const jag = Math.sin((step + 1) * 91.7 + bolt * 37.3 + frame * 13.1 + strike.id);
			const across = strike.from + size * ((bolt + 0.5) / 3 + jag * 0.14);
			const reach = (along * step) / 16;
			points.push(strike.axis === 'x'
				? { x: view.x + across, y: view.y + reach }
				: { x: view.x + reach, y: view.y + across });
		}
		g.lineStyle(bolt === 1 ? 3 : 2, bolt === 1 ? 0xffffff : 0xc4fbff, 1);
		for (let step = 1; step < points.length; step += 1) {
			g.lineBetween(points[step - 1].x, points[step - 1].y, points[step].x, points[step].y);
		}
	}
}

export type Particle = { x: number; y: number; vx: number; vy: number; age: number; life: number; color: number; size: number };
export type Ring = { x: number; y: number; radius: number; age: number; life: number; color: number };

/** Chispas y ondas de las explosiones. Sólo decoran: la batalla no se entera. */
export class Effects {
	particles: Particle[] = [];
	rings: Ring[] = [];

	burst(x: number, y: number, colors: number[], count: number, speed: number, random: () => number = Math.random) {
		for (let index = 0; index < count; index += 1) {
			const angle = random() * Math.PI * 2;
			const velocity = speed * (0.3 + random() * 0.7);
			this.particles.push({
				x, y,
				vx: Math.cos(angle) * velocity,
				vy: Math.sin(angle) * velocity,
				age: 0,
				life: 0.35 + random() * 0.45,
				color: colors[index % colors.length],
				size: random() < 0.3 ? 4 : 3,
			});
		}
	}

	ring(x: number, y: number, radius: number, color: number, life = 0.45) {
		this.rings.push({ x, y, radius, age: 0, life, color });
	}

	update(dt: number) {
		for (const particle of this.particles) {
			particle.age += dt;
			particle.x += particle.vx * dt;
			particle.y += particle.vy * dt;
			particle.vx *= 0.96;
			particle.vy *= 0.96;
		}
		this.particles = this.particles.filter((particle) => particle.age < particle.life);
		for (const ring of this.rings) {
			ring.age += dt;
		}
		this.rings = this.rings.filter((ring) => ring.age < ring.life);
	}

	draw(g: Phaser.GameObjects.Graphics, view: Offset) {
		g.clear();
		for (const ring of this.rings) {
			const progress = ring.age / ring.life;
			g.lineStyle(3, ring.color, 1 - progress);
			g.strokeCircle(view.x + ring.x, view.y + ring.y, ring.radius * (0.3 + progress * 0.7));
			g.fillStyle(ring.color, (1 - progress) * 0.15);
			g.fillCircle(view.x + ring.x, view.y + ring.y, ring.radius * (0.3 + progress * 0.7));
		}
		for (const particle of this.particles) {
			g.fillStyle(particle.color, 1 - particle.age / particle.life);
			// Cuadrados, no círculos: las chispas también son píxeles.
			g.fillRect(view.x + particle.x - particle.size / 2, view.y + particle.y - particle.size / 2, particle.size, particle.size);
		}
	}
}
