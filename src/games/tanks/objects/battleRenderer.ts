import Phaser from 'phaser';
import { BASE_CELL, FORTRESS_CELLS } from '../constants/levels';
import { CELL, FIELD, GRID, SHOVEL_WARNING, TANK_SIZE } from '../constants/tuning';
import {
	TERRAIN,
	type Battle,
	type Bullet,
	type Direction,
	type PowerUp,
	type TankKind,
} from '../state/Battle';

/**
 * Dibujo de Tanques con figuras vectoriales.
 *
 * No se generan texturas: un `Graphics` se rasteriza a la resolución real del
 * canvas (ver core/renderScale.ts), así que los tanques se ven nítidos aunque
 * el campo se escale. Todas las funciones reciben posiciones en unidades del
 * campo y una `View` que dice dónde y a qué escala va el campo en la escena.
 */
export type View = { x: number; y: number; scale: number };

type G = Phaser.GameObjects.Graphics;

export const TANKS_COLORS = {
	field: 0x05070d,
	brick: 0xb4582a,
	brickLight: 0xd8794a,
	mortar: 0x5a2a12,
	steel: 0x8a93a6,
	steelLight: 0xd3d9e4,
	steelDark: 0x4d5466,
	water: 0x1d4fa0,
	waterLight: 0x5b8ee0,
	treeDark: 0x2c6b2f,
	treeLight: 0x4fa64a,
	player: 0xf2c14e,
	enemy: 0xc5ccd9,
	bonus: 0xe5484d,
	accent: 0x9be15d,
} as const;

/** El blindado cambia de color a medida que pierde blindaje. */
const ARMOR_COLORS = [0xc5ccd9, 0xe08a5a, 0xe8c35a, 0x6fd36f];

type Palette = { body: number; dark: number; light: number };

function shade(color: number, factor: number) {
	const r = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
	const g = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
	const b = Math.min(255, Math.round((color & 0xff) * factor));
	return (r << 16) | (g << 8) | b;
}

export function fillPolygon(g: G, points: Array<{ x: number; y: number }>) {
	g.fillPoints(points.map(({ x, y }) => new Phaser.Math.Vector2(x, y)), true);
}

function palette(color: number): Palette {
	return { body: color, dark: shade(color, 0.45), light: shade(color, 1.25) };
}

// ------------------------------------------------------------------ terreno

/** Fondo, ladrillo, acero, agua y base. El bosque va aparte, por encima de los tanques. */
export function drawTerrain(g: G, battle: Battle, view: View, time: number) {
	const s = view.scale;
	g.clear();
	g.fillStyle(TANKS_COLORS.field, 1);
	g.fillRect(view.x, view.y, FIELD * s, FIELD * s);

	const shovelBlink = battle.shovelTimer > 0 && battle.shovelTimer < SHOVEL_WARNING
		&& Math.floor(time * 4) % 2 === 0;
	const fortress = new Set(FORTRESS_CELLS.map(([col, row]) => row * GRID + col));
	const wavePhase = Math.floor(time * 1.5) % 2;

	for (let row = 0; row < GRID; row += 1) {
		for (let col = 0; col < GRID; col += 1) {
			const terrain = battle.terrainAt(col, row);
			const x = view.x + col * CELL * s;
			const y = view.y + row * CELL * s;
			if (terrain === TERRAIN.BRICK) {
				drawBrick(g, x, y, s, col, row);
			} else if (terrain === TERRAIN.STEEL) {
				// Al terminar la pala el acero titila para avisar que vuelve a ser ladrillo.
				if (shovelBlink && fortress.has(row * GRID + col)) {
					drawBrick(g, x, y, s, col, row);
				} else {
					drawSteel(g, x, y, s, col, row);
				}
			} else if (terrain === TERRAIN.WATER) {
				drawWater(g, x, y, s, (Math.floor(col / 2) + Math.floor(row / 2) + wavePhase) % 2);
			}
		}
	}

	drawBase(g, view.x + BASE_CELL.col * CELL * s, view.y + BASE_CELL.row * CELL * s, s, battle.baseDestroyed);
}

export function drawTrees(g: G, battle: Battle, view: View) {
	const s = view.scale;
	g.clear();
	for (let row = 0; row < GRID; row += 1) {
		for (let col = 0; col < GRID; col += 1) {
			if (battle.terrainAt(col, row) === TERRAIN.TREES) {
				drawTree(g, view.x + col * CELL * s, view.y + row * CELL * s, s, col, row);
			}
		}
	}
}

/**
 * Cada celda es un medio ladrillo. Las juntas verticales dependen de la
 * posición en el campo, así que las hiladas quedan trabadas aunque la pared
 * esté mordida por los tiros.
 */
function drawBrick(g: G, x: number, y: number, s: number, col: number, row: number) {
	const size = CELL * s;
	const joint = 0.6 * s;
	g.fillStyle(TANKS_COLORS.brick, 1);
	g.fillRect(x, y, size, size);
	g.fillStyle(TANKS_COLORS.brickLight, 1);
	g.fillRect(x, y, size, joint);
	g.fillStyle(TANKS_COLORS.mortar, 1);
	g.fillRect(x, y + size - joint, size, joint);
	if ((col + row) % 2 === 0) {
		g.fillRect(x, y, joint, size);
	}
}

/** El acero va en placas de 8×8 con un bisel; cada celda dibuja su cuarto. */
function drawSteel(g: G, x: number, y: number, s: number, col: number, row: number) {
	const size = CELL * s;
	const right = col % 2 === 1;
	const bottom = row % 2 === 1;
	g.fillStyle(TANKS_COLORS.steel, 1);
	g.fillRect(x, y, size, size);
	g.fillStyle(TANKS_COLORS.steelDark, 1);
	if (right) {
		g.fillRect(x + size - 0.8 * s, y, 0.8 * s, size);
	}
	if (bottom) {
		g.fillRect(x, y + size - 0.8 * s, size, 0.8 * s);
	}
	g.fillStyle(TANKS_COLORS.steelLight, 1);
	g.fillRect(x + (right ? 0 : 2 * s), y + (bottom ? 0 : 2 * s), 2 * s, 2 * s);
}

function drawWater(g: G, x: number, y: number, s: number, phase: number) {
	g.fillStyle(TANKS_COLORS.water, 1);
	g.fillRect(x, y, CELL * s, CELL * s);
	g.fillStyle(TANKS_COLORS.waterLight, 1);
	g.fillRect(x + (phase ? 1.5 : 0.3) * s, y + (phase ? 2.6 : 1) * s, 2.2 * s, 0.7 * s);
}

function drawTree(g: G, x: number, y: number, s: number, col: number, row: number) {
	g.fillStyle(TANKS_COLORS.treeDark, 0.96);
	g.fillRect(x, y, CELL * s, CELL * s);
	g.fillStyle(TANKS_COLORS.treeLight, 1);
	const shift = (col + row) % 2 === 0 ? 0 : 1;
	g.fillCircle(x + (1.6 + shift) * s, y + (1.8 + shift) * s, 1.4 * s);
}

/** El águila del original, reducida a unas pocas figuras. */
export function drawBase(g: G, x: number, y: number, s: number, destroyed: boolean) {
	const p = (lx: number, ly: number) => ({ x: x + lx * s, y: y + ly * s });
	g.fillStyle(0x0b0f1a, 1);
	g.fillRect(x, y, TANK_SIZE * s, TANK_SIZE * s);

	if (destroyed) {
		g.fillStyle(0x4a4f5c, 1);
		fillPolygon(g, [p(1, 15), p(4, 9), p(7, 12), p(10, 7), p(15, 15)]);
		g.fillStyle(0x2a2d36, 1);
		fillPolygon(g, [p(3, 15), p(7, 11), p(9, 15)]);
		g.fillStyle(0xe5484d, 1);
		g.fillRect(x + 10 * s, y + 3 * s, 0.8 * s, 5 * s);
		g.fillTriangle(x + 10.8 * s, y + 3 * s, x + 14 * s, y + 4.3 * s, x + 10.8 * s, y + 5.6 * s);
		return;
	}

	const light = 0xd6dbe8;
	g.fillStyle(light, 1);
	fillPolygon(g, [p(8, 5), p(1, 2), p(1.5, 7), p(3, 10), p(7, 9)]);
	fillPolygon(g, [p(8, 5), p(15, 2), p(14.5, 7), p(13, 10), p(9, 9)]);
	g.fillRect(x + 6.5 * s, y + 4 * s, 3 * s, 8 * s);
	g.fillTriangle(x + 5.5 * s, y + 11.5 * s, x + 10.5 * s, y + 11.5 * s, x + 8 * s, y + 15 * s);
	g.fillCircle(x + 8 * s, y + 3.3 * s, 1.9 * s);
	g.fillStyle(0xf2c14e, 1);
	g.fillTriangle(x + 8 * s, y + 3 * s, x + 10.3 * s, y + 3.6 * s, x + 8 * s, y + 4.6 * s);
	g.fillStyle(0x0b0f1a, 1);
	g.fillCircle(x + 7.5 * s, y + 2.9 * s, 0.45 * s);
}

// ------------------------------------------------------------------ tanques

export type DrawableTank = {
	kind: TankKind;
	x: number;
	y: number;
	dir: Direction;
	hp: number;
	bonus: boolean;
	travelled: number;
};

/**
 * Lleva un punto del tanque "mirando hacia arriba" (marco local de 16×16) a
 * la dirección real. Como los giros son de 90°, un rectángulo sigue siendo
 * un rectángulo y alcanza con transformar dos esquinas.
 */
function rotate(dir: Direction, lx: number, ly: number) {
	switch (dir) {
		case 'up': return { x: lx, y: ly };
		case 'down': return { x: 16 - lx, y: 16 - ly };
		case 'right': return { x: 16 - ly, y: lx };
		case 'left': return { x: ly, y: 16 - lx };
	}
}

export function tankColor(tank: Pick<DrawableTank, 'kind' | 'hp' | 'bonus'>, time: number) {
	if (tank.bonus && Math.floor(time * 7) % 2 === 0) {
		return TANKS_COLORS.bonus;
	}
	if (tank.kind === 'player') {
		return TANKS_COLORS.player;
	}
	if (tank.kind === 'armor') {
		return ARMOR_COLORS[Math.max(0, Math.min(ARMOR_COLORS.length - 1, tank.hp - 1))];
	}
	return TANKS_COLORS.enemy;
}

/**
 * Cada tipo tiene su silueta además de su color: el blindado y el básico se
 * distinguen aunque el blindado ya haya vuelto al gris.
 */
export function drawTank(g: G, view: View, tank: DrawableTank, time: number) {
	const s = view.scale;
	const ox = view.x + tank.x * s;
	const oy = view.y + tank.y * s;
	const colors = palette(tankColor(tank, time));

	const rect = (lx: number, ly: number, w: number, h: number) => {
		const a = rotate(tank.dir, lx, ly);
		const b = rotate(tank.dir, lx + w, ly + h);
		g.fillRect(ox + Math.min(a.x, b.x) * s, oy + Math.min(a.y, b.y) * s, Math.abs(b.x - a.x) * s, Math.abs(b.y - a.y) * s);
	};
	const circle = (lx: number, ly: number, r: number) => {
		const c = rotate(tank.dir, lx, ly);
		g.fillCircle(ox + c.x * s, oy + c.y * s, r * s);
	};

	// Orugas: los eslabones se corren con la distancia recorrida.
	const treadWidth = tank.kind === 'fast' ? 3 : 4;
	g.fillStyle(colors.dark, 1);
	rect(0, 1, treadWidth, 14);
	rect(16 - treadWidth, 1, treadWidth, 14);
	g.fillStyle(colors.body, 1);
	const phase = (tank.travelled * 1.5) % 3;
	for (let ly = 1 + phase; ly < 14.5; ly += 3) {
		rect(0, ly, treadWidth, 1);
		rect(16 - treadWidth, ly, treadWidth, 1);
	}

	switch (tank.kind) {
		case 'player':
			g.fillStyle(colors.body, 1);
			rect(3, 4, 10, 10);
			g.fillStyle(colors.light, 1);
			rect(5, 6, 6, 6);
			g.fillStyle(colors.dark, 1);
			rect(6.5, 7.5, 3, 3);
			g.fillStyle(colors.light, 1);
			rect(7, 0, 2, 7);
			break;
		case 'basic':
			g.fillStyle(colors.body, 1);
			rect(3.5, 3, 9, 11);
			g.fillStyle(colors.dark, 1);
			circle(8, 9, 3.3);
			g.fillStyle(colors.light, 1);
			circle(8, 9, 2.3);
			rect(7, 0.5, 2, 7.5);
			break;
		case 'fast':
			g.fillStyle(colors.body, 1);
			rect(4, 4, 8, 11);
			rect(5.5, 2, 5, 2);
			g.fillStyle(colors.light, 1);
			circle(8, 10, 2.2);
			rect(7.25, 0, 1.5, 9);
			break;
		case 'power':
			g.fillStyle(colors.body, 1);
			rect(3, 4, 10, 11);
			g.fillStyle(colors.dark, 1);
			rect(4.5, 5.5, 7, 7);
			g.fillStyle(colors.light, 1);
			rect(5.5, 6.5, 5, 5);
			rect(6, 0, 4, 7);
			g.fillStyle(colors.dark, 1);
			rect(7.5, 0, 1, 6);
			break;
		case 'armor':
			g.fillStyle(colors.body, 1);
			rect(2.5, 2.5, 11, 12.5);
			g.fillStyle(colors.dark, 1);
			rect(4, 4, 8, 9.5);
			g.fillStyle(colors.light, 1);
			rect(5, 5, 6, 7.5);
			rect(4, 14, 8, 1);
			rect(7, 0.5, 2, 6);
			break;
	}
}

/** Silueta mínima para el marcador y las planillas. */
export function drawTankIcon(g: G, x: number, y: number, size: number, color: number) {
	const u = size / 16;
	g.fillStyle(shade(color, 0.5), 1);
	g.fillRect(x, y + u, 4 * u, 14 * u);
	g.fillRect(x + 12 * u, y + u, 4 * u, 14 * u);
	g.fillStyle(color, 1);
	g.fillRect(x + 3 * u, y + 4 * u, 10 * u, 10 * u);
	g.fillRect(x + 7 * u, y, 2 * u, 8 * u);
}

export function drawShield(g: G, view: View, tank: { x: number; y: number }, time: number) {
	const s = view.scale;
	const cx = view.x + (tank.x + 8) * s;
	const cy = view.y + (tank.y + 8) * s;
	const pulse = Math.floor(time * 12) % 2;
	g.lineStyle(1.2 * s * 0.5, 0xffffff, pulse ? 0.9 : 0.45);
	g.strokeCircle(cx, cy, (10.5 + pulse * 0.6) * s);
	g.lineStyle(1, 0x9fd8ff, 0.6);
	g.strokeCircle(cx, cy, (9.3 - pulse * 0.4) * s);
}

/** Destello en forma de estrella mientras un tanque se materializa. */
export function drawSpawnStar(g: G, view: View, tank: { x: number; y: number; spawning: number }, time: number) {
	const s = view.scale;
	const cx = view.x + (tank.x + 8) * s;
	const cy = view.y + (tank.y + 8) * s;
	const size = (3 + 5 * Math.abs(Math.sin(time * 12))) * s;
	const thin = size * 0.28;
	g.fillStyle(0xffffff, 0.95);
	fillPolygon(g, [
		{ x: cx, y: cy - size }, { x: cx + thin, y: cy - thin }, { x: cx + size, y: cy },
		{ x: cx + thin, y: cy + thin }, { x: cx, y: cy + size }, { x: cx - thin, y: cy + thin },
		{ x: cx - size, y: cy }, { x: cx - thin, y: cy - thin },
	]);
	g.fillStyle(0x9fd8ff, 1);
	g.fillCircle(cx, cy, thin * 0.8);
}

export function drawBullet(g: G, view: View, bullet: Bullet) {
	const s = view.scale;
	const cx = view.x + bullet.x * s;
	const cy = view.y + bullet.y * s;
	g.fillStyle(bullet.fromPlayer ? 0xfff1c2 : 0xffffff, 1);
	g.fillCircle(cx, cy, 1.6 * s);
	g.fillStyle(bullet.fromPlayer ? 0xf2c14e : 0xc5ccd9, 1);
	g.fillCircle(cx, cy, 0.9 * s);
}

// -------------------------------------------------------------------- bonus

export function drawPowerUp(g: G, view: View, powerUp: Pick<PowerUp, 'kind' | 'x' | 'y'>) {
	drawPowerUpIcon(g, view.x + powerUp.x * view.scale, view.y + powerUp.y * view.scale, TANK_SIZE * view.scale, powerUp.kind);
}

export function drawPowerUpIcon(g: G, x: number, y: number, size: number, kind: PowerUp['kind']) {
	const u = size / 16;
	const p = (lx: number, ly: number) => ({ x: x + lx * u, y: y + ly * u });
	g.fillStyle(0xffffff, 1);
	g.fillRect(x, y, size, size);
	g.fillStyle(0x1c2a52, 1);
	g.fillRect(x + u, y + u, 14 * u, 14 * u);

	const ink = 0xffffff;
	switch (kind) {
		case 'star': {
			const points = [];
			for (let index = 0; index < 10; index += 1) {
				const angle = -Math.PI / 2 + (index * Math.PI) / 5;
				const radius = index % 2 === 0 ? 6 : 2.6;
				points.push(p(8 + Math.cos(angle) * radius, 8.5 + Math.sin(angle) * radius));
			}
			g.fillStyle(0xf2c14e, 1);
			fillPolygon(g, points);
			break;
		}
		case 'grenade':
			g.fillStyle(0x6fd36f, 1);
			g.fillCircle(x + 8 * u, y + 9.5 * u, 4.2 * u);
			g.fillStyle(ink, 1);
			g.fillRect(x + 7 * u, y + 3 * u, 2 * u, 3 * u);
			g.fillRect(x + 9 * u, y + 3 * u, 3 * u, 1 * u);
			break;
		case 'helmet':
			g.fillStyle(0x9fd8ff, 1);
			g.slice(x + 8 * u, y + 10 * u, 5 * u, Math.PI, 0, false);
			g.fillPath();
			g.fillRect(x + 2 * u, y + 10 * u, 12 * u, 1.6 * u);
			break;
		case 'shovel':
			g.fillStyle(ink, 1);
			g.fillRect(x + 7.3 * u, y + 2.5 * u, 1.4 * u, 7 * u);
			g.fillRect(x + 5.8 * u, y + 2.5 * u, 4.4 * u, 1.2 * u);
			g.fillStyle(TANKS_COLORS.steelLight, 1);
			fillPolygon(g, [p(5, 9), p(11, 9), p(11, 12), p(8, 14), p(5, 12)]);
			break;
		case 'clock':
			g.fillStyle(ink, 1);
			g.fillCircle(x + 8 * u, y + 8.5 * u, 5 * u);
			g.fillStyle(0x1c2a52, 1);
			g.fillRect(x + 7.5 * u, y + 5 * u, 1 * u, 4 * u);
			g.fillRect(x + 7.5 * u, y + 8 * u, 3 * u, 1 * u);
			break;
		case 'tank':
			drawTankIcon(g, x + 3.5 * u, y + 3.5 * u, 9 * u, TANKS_COLORS.player);
			break;
	}
}

// ------------------------------------------------------------------ efectos

/** Bola de fuego que crece y se apaga; `progress` va de 0 a 1. */
export function drawExplosion(g: G, view: View, x: number, y: number, progress: number, big: boolean) {
	const s = view.scale;
	const cx = view.x + x * s;
	const cy = view.y + y * s;
	const peak = big ? 14 : 6;
	const radius = peak * Math.sin(Math.min(1, progress) * Math.PI) * s + s;
	const alpha = 1 - progress * 0.6;
	g.fillStyle(0xe5484d, alpha * 0.85);
	g.fillCircle(cx, cy, radius);
	g.fillStyle(0xf2a14e, alpha);
	g.fillCircle(cx + radius * 0.12, cy - radius * 0.1, radius * 0.68);
	g.fillStyle(0xfff1c2, alpha);
	g.fillCircle(cx - radius * 0.1, cy + radius * 0.05, radius * 0.34);
}
