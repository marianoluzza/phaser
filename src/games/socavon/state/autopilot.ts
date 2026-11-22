import { PICK_HITS } from '../constants/tuning';
import { findPath, footing, parseLevel, type Node } from './level';
import { Mine, type MineInput } from './Mine';
import { newRun } from './run';

const STEP = 1 / 30;
const MAX_STEPS = 60000;
const CLOSE = 0.1;

/**
 * Juega una mina entera con las mismas entradas que el teclado, con serenos y
 * vagonetas quietos. No mide dificultad: prueba que la mina se puede terminar.
 * Nunca usa manijas, porque con una bolsa tampoco se podría.
 */
export function autopilot(rows: readonly string[]): 'cleared' | string {
	const mine = new Mine(parseLevel(rows), newRun(), { threats: false });
	const { level, player } = mine;
	const passable = footing(level, mine.isOpen);
	let path: Node[] = [];
	let arrived = false;

	for (let step = 0; step < MAX_STEPS; step += 1) {
		if (mine.status === 'cleared') return 'cleared';
		// Siempre de espaldas: acá no se prueba el sigilo.
		for (const guard of mine.guards) guard.facing = Math.sign(guard.x - player.x) || 1;

		const input: MineInput = { x: 0, y: 0, use: false, lamp: false, headlamp: false };
		if (path.length) {
			const next = path[0];
			if (player.state === 'climb') {
				input.y = Math.sign(next.y - player.y);
			} else if (next.y !== player.y) {
				input.y = Math.sign(next.y - player.y);
			} else if (Math.abs(next.x - player.x) > CLOSE) {
				input.x = Math.sign(next.x - player.x);
			} else {
				path.shift();
				arrived = path.length === 0;
				continue;
			}
			mine.step(STEP, input);
			continue;
		}

		if (arrived) {
			arrived = false;
			input.use = true;
			mine.step(STEP, input);
			// El pico y la pausa entre golpes.
			for (let wait = 0; wait < 12; wait += 1) mine.step(STEP, { ...input, use: false });
			continue;
		}

		const goals = chooseGoals(mine);
		if (!goals) {
			// Con el pico en la mano y sin muros por romper: soltarlo.
			mine.step(STEP, { ...input, use: true });
			continue;
		}
		const here = { x: Math.round(player.x), y: player.y };
		const found = findPath(level, here, (node) => goals.some((goal) => goal.x === node.x && goal.y === node.y), passable);
		if (!found) return `sin camino desde (${here.x},${here.y}) con ${player.hands ?? 'las manos libres'}`;
		path = found;
	}
	return `sin tiempo: ${mine.delivered}/${mine.total}`;
}

function chooseGoals(mine: Mine): Node[] | null {
	const { player, level } = mine;
	const passable = footing(level, mine.isOpen);
	const here = { x: Math.round(player.x), y: player.y };
	const standing = (things: { x: number; y: number }[]) => things.map(({ x, y }) => ({ x: Math.round(x), y }));
	const canGetTo = (nodes: Node[]) => nodes.filter((node) => (
		findPath(level, here, (other) => other.x === node.x && other.y === node.y, passable) !== null
	));

	if (player.hands === 'bag') return mine.exits;

	const besideWalls = canGetTo(mine.walls
		.filter((wall) => wall.hits < PICK_HITS)
		.flatMap(({ x, y }) => [{ x: x - 1, y }, { x: x + 1, y }])
		.filter(({ x, y }) => passable(x, y)));
	if (besideWalls.length) {
		if (player.hands === 'pick') return besideWalls;
		const picks = canGetTo(standing(mine.items.filter((item) => item.kind === 'pick')));
		if (picks.length) return picks;
	}
	if (player.hands) return null;

	const closed = mine.vaults.filter((vault) => !vault.open);
	if (player.keys < closed.length) return standing(mine.guards.filter((guard) => guard.hasKey));
	if (closed.length) return closed;
	return standing(mine.items.filter((item) => item.kind === 'bag'));
}
