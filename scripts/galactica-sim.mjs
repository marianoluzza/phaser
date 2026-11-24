/**
 * Simulador de partidas de Galáctica.
 *
 * `state/` no importa Phaser, así que se pueden jugar campañas enteras sin
 * navegador. Un piloto automático juega las cuatro zonas con cada nave del
 * hangar y se mide lo que pide el diseño: cuánto dura cada zona, cuánta vida
 * saca cada ataque, cuánta energía sobra y dónde se muere.
 *
 *   npm run sim:galactica           # 40 campañas por nave y estilo
 *   npm run sim:galactica -- 200    # otra cantidad
 *
 * Cada nave se juega con dos estilos: «gatillo», que no suelta el disparo, y
 * «puntería», que dispara sólo si hay un blanco en la línea de un cañón y lo
 * que ya está en vuelo no alcanza para derribarlo.
 *
 * El piloto no es un buen jugador: esquiva mirando medio segundo adelante,
 * prende el escudo si no tiene salida o le cae una descarga, y persigue a la
 * nave más baja, al hueco que sigue o a la bodega. Los tramos se informan
 * aparte. Sirve para comparar, no como techo.
 */
import { createServer } from 'vite';

const RUNS = Number(process.argv[2] ?? 40);
const STEP = 1 / 60;
const MAX_ZONE_TIME = 600;

const server = await createServer({
	logLevel: 'silent',
	server: { middlewareMode: true },
	appType: 'custom',
});

/** mulberry32: cada campaña se puede repetir con su número. */
function seededRandom(seed) {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

try {
	const { Battle, newRun } = await server.ssrLoadModule('/src/games/galactica/state/Battle.ts');
	const tuning = await server.ssrLoadModule('/src/games/galactica/constants/tuning.ts');
	const { SHIP_IDS } = await server.ssrLoadModule('/src/games/galactica/constants/ships.ts');
	const { ZONES } = await server.ssrLoadModule('/src/games/galactica/constants/zones.ts');
	const { nextGap, hatchLead } = await server.ssrLoadModule('/src/games/galactica/state/Passage.ts');
	const { FREIGHTER, PASSAGES } = await server.ssrLoadModule('/src/games/galactica/constants/passages.ts');
	const { FIELD_W, PLAYER_MARGIN, PLAYER_MIN_Y, PLAYER_RADIUS, PLAYER_Y, PLANT_RADIUS } = tuning;
	const MOVES = [-1, -0.5, 0, 0.5, 1];
	const MOVES_Y = [0, -1, 1];
	const STYLES = ['gatillo', 'puntería'];
	const previous = new WeakMap();

	/** Mira adelante cada movimiento posible y elige el menos peligroso que lo acerque al blanco. */
	function pilot(battle, style) {
		const player = battle.player;
		const speed = battle.ship.speed * (player.speed > 0 ? 1.35 : 1);
		const threats = [];
		for (const bullet of battle.bullets) threats.push({ x: bullet.x, y: bullet.y, vx: bullet.vx, vy: bullet.vy, r: 12 });
		for (const comet of battle.comets) threats.push({ x: comet.x, y: comet.y, vx: comet.vx, vy: comet.vy, r: 14 });
		for (const rock of battle.rocks) threats.push({ x: rock.x, y: rock.y, vx: rock.vx, vy: rock.vy, r: 28 });
		for (const enemy of battle.enemies) {
			if (['dive', 'swoop', 'planting', 'entering', 'joining'].includes(enemy.state)) {
				// La velocidad se mide de un paso al otro: en las curvas no está en el estado.
				const last = previous.get(enemy) ?? enemy;
				threats.push({ x: enemy.x, y: enemy.y, vx: (enemy.x - last.x) / STEP, vy: (enemy.y - last.y) / STEP, r: 28 });
			}
		}
		for (const enemy of battle.enemies) previous.set(enemy, { x: enemy.x, y: enemy.y });
		const warnings = battle.cometWarnings.map((warning) => warning.x + warning.vx * 1.2);

		let best = { cost: Infinity, move: 0, moveY: 0, danger: 0 };
		const gap = nextGap(battle.rocks, player);
		const aimX = gap?.axis === 'x' ? gap.at : target(battle);
		const aimY = gap?.axis === 'y' ? gap.at : PLAYER_Y;
		// A la bodega hay que seguirla fino: con cinco velocidades la nave más rápida se pasaba de largo.
		const moves = battle.freighters.length
			? [...MOVES, Math.max(-1, Math.min(1, (aimX - player.x) / (speed * 0.3)))]
			: MOVES;
		for (const moveY of MOVES_Y) for (const move of moves) {
			let danger = 0;
			const pace = speed / Math.max(1, Math.hypot(move, moveY));
			for (const t of [0.1, 0.25, 0.45, 0.7]) {
				const x = Math.max(PLAYER_MARGIN, Math.min(FIELD_W - PLAYER_MARGIN, player.x + move * pace * t));
				const y = Math.max(PLAYER_MIN_Y, Math.min(PLAYER_Y, player.y + moveY * pace * t));
				for (const threat of threats) {
					const tx = threat.x + threat.vx * t;
					const ty = threat.y + threat.vy * t;
					if (Math.hypot(tx - x, ty - y) < threat.r + PLAYER_RADIUS) danger += 1 / (t + 0.1);
				}
				for (const enemy of battle.enemies) {
					if (enemy.state === 'planted' && Math.hypot(enemy.x - x, enemy.y - y) < PLANT_RADIUS + 16) danger += 0.6 / (enemy.timer + 0.2);
				}
				if (battle.boss && battle.boss.state === 'charging' && Math.abs(battle.boss.chargeX - x) < 60) danger += 1;
				for (const wx of warnings) if (Math.abs(wx - x) < 20) danger += 0.2;
				for (const strike of battle.strikes) {
					// Con carga las espera: bloquearlas paga.
					if (player.shield > 0 && battle.energy > 0) break;
					if (onBand(strike, { x, y }) && strike.timer < t + 0.2) danger += 1;
				}
			}

			const finalX = player.x + move * pace * 0.3;
			const finalY = Math.max(PLAYER_MIN_Y, Math.min(PLAYER_Y, player.y + moveY * pace * 0.3));
			// Vive atrás: adelanta sólo para esquivar.
			const cost = danger * 100 + Math.abs(finalX - aimX) / 50 + Math.abs(aimY - finalY) / 5;
			if (cost < best.cost) best = { cost, move, moveY, danger };
		}
		return {
			move: best.move,
			moveY: best.moveY,
			fire: style === 'gatillo' || onTarget(battle),
			shield: player.shield > 0
				&& (best.danger > 1.2 || battle.strikes.some((strike) => !strike.resolved && strike.timer < 0.12 && onBand(strike, player))),
		};
	}

	function onBand(strike, point) {
		const at = strike.axis === 'x' ? point.x : point.y;
		return at > strike.from - PLAYER_RADIUS && at < strike.to + PLAYER_RADIUS;
	}

	/** Si algún cañón de la etapa actual le pegaría a algo, adelantando al jefe. */
	function onTarget(battle) {
		const { player, boss, ship } = battle;
		// A las rocas de un tramo no les tira: se pasan por el hueco.
		const rocks = battle.rocks.filter((rock) => rock.gap === undefined);
		const targets = [...battle.enemies.filter((enemy) => enemy.state !== 'waiting'), ...battle.pods, ...rocks]
			.map((item) => ({ x: item.x, y: item.y, r: 19, hp: item.hp }));
		if (boss && boss.state !== 'entering') {
			targets.push({ x: boss.x + boss.vx * ((player.y - boss.y) / ship.bulletSpeed), y: boss.y, r: 42, hp: boss.hp });
		}
		for (const freighter of battle.freighters) {
			if (freighter.x < 0 || freighter.x > FIELD_W) continue;
			targets.push({ x: hatchLead(freighter, player, ship.bulletSpeed), y: freighter.y, r: FREIGHTER.hatch, hp: freighter.hp });
		}
		return ship.stages[battle.stage].some((muzzle) => targets.some((item) => {
			if (item.y <= 0 || item.y >= player.y) return false;
			const x = player.x + muzzle.dx + Math.tan(((muzzle.angle ?? 0) * Math.PI) / 180) * (player.y - item.y);
			if (Math.abs(x - item.x) >= item.r) return false;
			const onTheWay = battle.shots.filter((shot) => shot.y > item.y
				&& Math.abs(shot.x + (shot.vx / -shot.vy) * (shot.y - item.y) - item.x) < item.r);
			return onTheWay.length < item.hp;
		}));
	}

	function target(battle) {
		const near = battle.pickups.filter((pickup) => pickup.y > 300);
		if (near.length) return near[0].x;
		const freighter = battle.freighters.find((one) => one.x > 0 && one.x < FIELD_W);
		// Y 0,3 s más, que es a cuánto mira el piloto para elegir cómo moverse.
		if (freighter) return hatchLead(freighter, battle.player, battle.ship.bulletSpeed) + freighter.vx * 0.3;
		// Al jefe hay que adelantarle la puntería: el disparo tarda en llegar.
		if (battle.boss) return battle.boss.x + battle.boss.vx * 0.5;
		const planted = battle.enemies.find((enemy) => enemy.state === 'planted');
		if (planted) return planted.x < FIELD_W / 2 ? planted.x + 150 : planted.x - 150;
		const targets = battle.enemies.filter((enemy) => enemy.state !== 'waiting');
		if (!targets.length) return FIELD_W / 2;
		targets.sort((a, b) => b.y - a.y);
		return targets[0].x;
	}

	for (const shipId of SHIP_IDS) for (const style of STYLES) {
		const zones = ZONES.map(() => ({ reached: 0, cleared: 0, time: 0, bossTime: 0, energyLeft: 0, emptyTime: 0, played: 0, firing: 0, damage: {}, pickups: {}, pods: 0, run: { played: 0, change: 0, hurt: 0, broken: 0, freighters: 0, blocks: 0 } }));
		let finished = 0;
		let score = 0;

		for (let runIndex = 0; runIndex < RUNS; runIndex += 1) {
			const random = seededRandom(1000 + runIndex);
			let run = newRun(shipId);
			for (let zone = 1; zone <= ZONES.length; zone += 1) {
				const battle = new Battle({ ...run, zone }, random);
				const stats = zones[zone - 1];
				stats.reached += 1;
				let emptyTime = 0;
				while (battle.outcome === 'playing' && battle.time < MAX_ZONE_TIME) {
					battle.setInput(pilot(battle, style));
					const inPassage = battle.phase === 'passage';
					const { energy, hp } = battle;
					battle.step(STEP);
					if (inPassage) {
						stats.run.change += battle.energy - energy;
						stats.run.hurt += Math.max(0, hp - battle.hp);
					}
					for (const event of battle.events) {
						if (event.type === 'passageStart') {
							stats.run.played += 1;
							stats.run.freighters += PASSAGES[event.id].cues.filter((cue) => cue.kind === 'freighter').length;
						}
						if (event.type === 'kill' && event.family === 'freighter') stats.run.broken += 1;
						if (event.type === 'stormBlock') stats.run.blocks += 1;
					}
					battle.events = [];
					stats.played += STEP;
					if (battle.player.cooldown > 0) stats.firing += STEP;
					if (battle.energy <= 0) emptyTime += STEP;
				}
				for (const [source, amount] of Object.entries(battle.stats.damage)) {
					stats.damage[source] = (stats.damage[source] ?? 0) + amount;
				}
				for (const [kind, amount] of Object.entries(battle.stats.pickups)) {
					stats.pickups[kind] = (stats.pickups[kind] ?? 0) + amount;
				}
				stats.pods += battle.stats.podsOpened;
				stats.emptyTime += emptyTime;
				if (battle.outcome !== 'won') {
					score += battle.score;
					break;
				}
				stats.cleared += 1;
				stats.time += battle.stats.time;
				stats.bossTime += battle.stats.bossTime;
				stats.energyLeft += battle.energy;
				run = battle.nextRun();
				if (zone === ZONES.length) {
					finished += 1;
					score += battle.score;
				}
			}
		}

		console.log(`\n${shipId.toUpperCase()}, ${style}  —  ${RUNS} campañas, ${finished} completas, puntaje medio ${Math.round(score / RUNS)}`);
		console.log('zona  llegan  pasan  duración  jefe  energía  sin energía  cañón  daño por fuente (por zona jugada)');
		zones.forEach((stats, index) => {
			if (!stats.reached) return;
			const cleared = Math.max(1, stats.cleared);
			const damage = Object.entries(stats.damage)
				.filter(([, amount]) => amount > 0.5 * stats.reached)
				.map(([source, amount]) => `${source} ${(amount / stats.reached).toFixed(0)}`)
				.join('  ');
			console.log([
				String(index + 1).padStart(4),
				String(stats.reached).padStart(7),
				String(stats.cleared).padStart(6),
				`${(stats.time / cleared).toFixed(0)} s`.padStart(9),
				`${(stats.bossTime / cleared).toFixed(0)} s`.padStart(5),
				`${(stats.energyLeft / cleared).toFixed(0)}%`.padStart(8),
				`${(stats.emptyTime / stats.reached).toFixed(1)} s`.padStart(12),
				`${((100 * stats.firing) / stats.played).toFixed(0)}%`.padStart(6),
				` ${damage}`,
			].join(' '));
		});
		console.log('tramo  energía  vida  cargueros  bloqueos');
		zones.forEach(({ run }, index) => {
			if (!run.played) return;
			console.log([
				ZONES[index].passage.padEnd(9),
				`${(run.change / run.played).toFixed(0)}`.padStart(5),
				`${(-run.hurt / run.played).toFixed(0)}`.padStart(5),
				(run.freighters ? `${((100 * run.broken) / run.freighters).toFixed(0)}%` : '-').padStart(9),
				(run.blocks / run.played).toFixed(1).padStart(9),
			].join(' '));
		});
	}
} finally {
	await server.close();
}
