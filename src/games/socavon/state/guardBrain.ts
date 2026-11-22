import { GUARD, LAMP_RADIUS, REACH } from '../constants/tuning';
import { findPath, footing, reachable, type Node, type Passable } from './level';
import type { Guard, Mine } from './Mine';

/** Lo que piensa y hace un sereno en cada paso. */
export function updateGuard(mine: Mine, guard: Guard, dt: number) {
	if (guard.mode === 'stunned') {
		guard.timer -= dt;
		if (guard.timer <= 0) getUp(mine, guard);
		return;
	}
	guard.shakenFor = Math.max(0, guard.shakenFor - dt);
	guard.ignoreFor = Math.max(0, guard.ignoreFor - dt);

	const seen = canSee(mine, guard);
	if (seen) {
		guard.noticed += dt;
		if (guard.mode !== 'chase' && guard.noticed >= GUARD.notice) {
			guard.mode = 'chase';
			mine.seen = true;
			mine.emit({ type: 'spotted', x: guard.x, y: guard.y });
		}
	} else {
		guard.noticed = Math.max(0, guard.noticed - dt);
	}

	if (guard.mode === 'chase') chase(mine, guard, seen, dt);
	else if (guard.mode === 'investigate') investigate(mine, guard, dt);
	else if (guard.mode === 'search') search(guard, dt);
	else patrol(mine, guard, dt);

	if (guard.mode === 'patrol' && Number.isInteger(guard.y)) relight(mine, guard);
}

/** Manda al sereno a mirar un lugar. */
export function investigateAt(mine: Mine, guard: Guard, node: Node) {
	guard.mode = 'investigate';
	guard.timer = GUARD.persist;
	guard.waitFor = 0;
	setGoal(mine, guard, node);
}

/** Hasta dónde alcanzaría a ver al minero según la luz que tiene encima. */
export function sightRange(mine: Mine) {
	const { player } = mine;
	const lit = player.headlamp || mine.lamps.some((lamp) => (
		lamp.lit && Math.abs(lamp.y - player.y) < REACH.sameFloor && Math.abs(lamp.x - player.x) <= LAMP_RADIUS
	));
	return lit ? GUARD.sightLit : GUARD.sightDark;
}

/** El único que puede con quien va en la vagoneta. */
export function isWitness(guard: Guard) {
	return guard.sawBoard && guard.mode === 'chase';
}

export function canSee(mine: Mine, guard: Guard) {
	const { player } = mine;
	if (player.hidden || player.invincible > 0 || guard.ignoreFor > 0) return false;
	// Agachado en la vagoneta sólo lo ve quien ya sabe que está ahí.
	if (player.state === 'ride' && !isWitness(guard)) return false;
	if (Math.abs(player.y - guard.y) > REACH.sameFloor) return false;
	const dx = player.x - guard.x;
	// Ya persiguiendo, no lo pierde porque le pase por al lado.
	const inFront = dx * guard.facing > 0 || (guard.mode === 'chase' && Math.abs(dx) < GUARD.sightDark);
	if (!inFront || Math.abs(dx) > sightRange(mine)) return false;
	return mine.clearBetween(guard.x, player.x, Math.round(guard.y));
}

function chase(mine: Mine, guard: Guard, seen: boolean, dt: number) {
	const { player } = mine;
	if (seen) {
		guard.timer = GUARD.persist;
		const floor = player.climbTo ?? Math.round(player.y);
		const sameFloor = Number.isInteger(guard.y) && floor === guard.y && Number.isInteger(player.y);
		// Con piso hasta el minero va derecho, sin saltar de celda en celda.
		if (sameFloor && floorBetween(mine, guard.x, player.x, floor)) {
			const dx = player.x - guard.x;
			if (dx !== 0) guard.facing = Math.sign(dx);
			guard.x += Math.sign(dx) * Math.min(Math.abs(dx), speedOf(mine, guard) * dt);
			guard.goal = { x: Math.round(player.x), y: floor };
			guard.route = [];
			guard.staring = 0;
			guard.moving = true;
			return;
		}
		// Si no, da la vuelta. Y si no hay vuelta, desiste en vez de hacer guardia.
		setGoal(mine, guard, { x: Math.round(player.x), y: floor });
		if (guard.route.length) {
			guard.staring = 0;
			followRoute(mine, guard, dt);
			return;
		}
		guard.moving = false;
		guard.facing = Math.sign(player.x - guard.x) || guard.facing;
		guard.staring += dt;
		if (guard.staring >= GUARD.stare) giveUp(guard);
		return;
	}
	// Perdido de vista, sigue hasta el último lugar donde lo vio.
	if (!seen && !guard.route.length && guard.goal) {
		const lastSeen = guard.goal;
		guard.goal = null;
		setGoal(mine, guard, lastSeen);
	}
	guard.timer -= dt;
	if (followRoute(mine, guard, dt) || guard.timer <= 0) startSearch(guard);
}

function floorBetween(mine: Mine, a: number, b: number, y: number) {
	const passable = footing(mine.level, mine.isOpen);
	for (let x = Math.round(Math.min(a, b)); x <= Math.round(Math.max(a, b)); x += 1) {
		if (!passable(x, y)) return false;
	}
	return true;
}

function giveUp(guard: Guard) {
	guard.mode = 'patrol';
	guard.staring = 0;
	guard.noticed = 0;
	guard.ignoreFor = GUARD.ignore;
	guard.waitFor = 0;
	guard.route = [];
	guard.goal = null;
	guard.facing *= -1;
}

function isOnRail(mine: Mine, node: Node) {
	return mine.carts.some((cart) => cart.y === node.y && node.x >= cart.from && node.x <= cart.to);
}

/** Después de un atropello lo primero es salir del riel. */
function getUp(mine: Mine, guard: Guard) {
	guard.mode = 'patrol';
	guard.waitFor = 0;
	guard.noticed = 0;
	guard.shakenFor = GUARD.shaken;
	guard.route = [];
	guard.goal = null;
	const passable = footing(mine.level, mine.isOpen);
	const here = nodeOf(guard);
	const way = findPath(mine.level, here, (node) => !isOnRail(mine, node) && node.y !== mine.level.start.y, passable);
	if (way) setGoal(mine, guard, way[way.length - 1]);
}

function investigate(mine: Mine, guard: Guard, dt: number) {
	guard.timer -= dt;
	// Aunque no tenga cómo llegar, se queda un momento atento.
	if (!guard.route.length) {
		guard.moving = false;
		if (guard.timer < GUARD.persist - 1) startSearch(guard);
		return;
	}
	if (followRoute(mine, guard, dt) || guard.timer <= 0) startSearch(guard);
}

function startSearch(guard: Guard) {
	guard.mode = 'search';
	guard.timer = GUARD.searchTime;
	guard.goal = null;
	guard.moving = false;
}

function search(guard: Guard, dt: number) {
	const before = Math.floor(guard.timer / 0.8);
	guard.timer -= dt;
	if (guard.timer <= 0) {
		guard.mode = 'patrol';
		guard.waitFor = 0;
	} else if (Math.floor(guard.timer / 0.8) !== before) {
		guard.facing *= -1;
	}
}

function patrol(mine: Mine, guard: Guard, dt: number) {
	if (guard.waitFor > 0) {
		guard.waitFor -= dt;
		guard.moving = false;
		return;
	}
	if (!guard.route.length) choosePatrolGoal(mine, guard);
	if (followRoute(mine, guard, dt)) {
		// Recién atropellado no descansa al borde del riel: se aleja.
		if (guard.shakenFor > 0) guard.waitFor = 0;
		else guard.waitFor = mine.alarm > 0 ? 0.4 : 1 + mine.random() * 1.6;
	}
}

function choosePatrolGoal(mine: Mine, guard: Guard) {
	const { level } = mine;
	const here = nodeOf(guard);
	const walkable = footing(level, mine.isOpen);
	// La galería de entrada es el respiro de quien llega o revive: sólo se sube
	// por un ruido o una persecución, y de ahí la patrulla vuelve a bajar.
	const atEntrance = here.y === level.start.y;
	let beat: Passable = atEntrance ? walkable : (x, y) => y !== level.start.y && walkable(x, y);
	if (guard.shakenFor > 0 && !isOnRail(mine, here)) {
		// Y no elige volver a cruzarlo, si tiene otro lado adonde ir.
		const anywhere = beat;
		const away: Passable = (x, y) => anywhere(x, y) && !isOnRail(mine, { x, y });
		if (reachable(level, here, away).cells.length > 3) beat = away;
	}
	const changeFloor = atEntrance || mine.random() < 0.25;
	const cells = reachable(level, here, beat).cells.filter((cell) => cell.y !== level.start.y);
	// No se planta a descansar donde es paso obligado: rieles y escaleras.
	const restable = cells.filter(({ x, y }) => (
		!isOnRail(mine, { x, y }) && level.at(x, y) !== 'H' && level.at(x, y - 1) !== 'H'
	));
	let options = restable.filter((cell) => {
		const floors = Math.abs(cell.y - here.y);
		return changeFloor ? floors === 1 : floors === 0 && Math.abs(cell.x - here.x) >= 3;
	});
	// En un tramo corto igual camina: cualquier otro lugar antes que quedarse.
	if (!options.length) options = cells.filter((cell) => cell.y !== here.y || cell.x !== here.x);
	if (options.length) setGoal(mine, guard, options[Math.floor(mine.random() * options.length)], beat);
}

function nodeOf(guard: Guard): Node {
	return { x: Math.round(guard.x), y: Math.round(guard.y) };
}

function setGoal(mine: Mine, guard: Guard, goal: Node, passable: Passable = footing(mine.level, mine.isOpen)) {
	if (guard.goal?.x === goal.x && guard.goal.y === goal.y && guard.route.length) return;
	guard.goal = goal;
	// A mitad de escalera termina el tramo antes de cambiar de rumbo.
	const climbing = !Number.isInteger(guard.y) && guard.route.length > 0;
	const from = climbing ? guard.route[0] : nodeOf(guard);
	const path = findPath(mine.level, from, (node) => node.x === goal.x && node.y === goal.y, passable);
	if (!path) {
		guard.route = climbing ? [from] : [];
		return;
	}
	// Si el tramo siguiente es plano no hace falta volver al centro de la celda.
	if (!climbing && path.length > 1 && path[1].y === path[0].y) path.shift();
	guard.route = path;
}

function speedOf(mine: Mine, guard: Guard) {
	if (guard.mode === 'chase') return GUARD.chase;
	const speed = guard.mode === 'investigate' ? GUARD.investigate : GUARD.patrol;
	return mine.alarm > 0 ? speed * GUARD.alarmBoost : speed;
}

/** Avanza por la ruta; devuelve si llegó al final. */
function followRoute(mine: Mine, guard: Guard, dt: number) {
	const next = guard.route[0];
	if (!next) {
		guard.moving = false;
		return true;
	}
	guard.moving = true;
	if (next.y === guard.y) {
		const dx = next.x - guard.x;
		const reach = speedOf(mine, guard) * dt;
		if (Math.abs(dx) > 0.001) guard.facing = Math.sign(dx);
		guard.x = Math.abs(dx) <= reach ? next.x : guard.x + Math.sign(dx) * reach;
		if (guard.x === next.x) guard.route.shift();
	} else {
		const dy = next.y - guard.y;
		const reach = GUARD.climb * (guard.mode === 'patrol' ? 1 : 1.3) * dt;
		guard.x = next.x;
		guard.y = Math.abs(dy) <= reach ? next.y : guard.y + Math.sign(dy) * reach;
		if (guard.y === next.y) guard.route.shift();
	}
	return guard.route.length === 0;
}

function relight(mine: Mine, guard: Guard) {
	for (const lamp of mine.lamps) {
		if (lamp.lit || lamp.y !== guard.y || Math.abs(lamp.x - guard.x) > REACH.take / 2) continue;
		if (mine.time - lamp.offSince < GUARD.relightAfter) continue;
		lamp.lit = true;
		mine.emit({ type: 'relight', x: lamp.x, y: lamp.y });
	}
}
