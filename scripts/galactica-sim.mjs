/**
 * Simulador de partidas de Galáctica.
 *
 * `state/` no importa Phaser, así que se pueden jugar campañas enteras sin
 * navegador. Un piloto automático juega las cuatro zonas con cada nave del
 * hangar y se mide lo que pide el diseño: cuánto dura cada zona, cuánta vida
 * saca cada ataque, cuánta energía sobra y dónde se muere.
 *
 *   npm run sim:galactica           # 40 campañas por nave
 *   npm run sim:galactica -- 200    # otra cantidad
 *
 * El piloto no es un buen jugador: esquiva mirando medio segundo adelante y
 * persigue a la nave más baja. Sirve para comparar, no como techo.
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
	const { FIELD_W, PLAYER_MARGIN, PLAYER_RADIUS, PLANT_RADIUS } = tuning;

	/** Mira adelante cada movimiento posible y elige el menos peligroso que lo acerque al blanco. */
	function pilot(battle) {
		const player = battle.player;
		const speed = battle.ship.speed * (player.speed > 0 ? 1.35 : 1);
		const threats = [];
		for (const bullet of battle.bullets) threats.push({ x: bullet.x, y: bullet.y, vx: bullet.vx, vy: bullet.vy, r: 12 });
		for (const comet of battle.comets) threats.push({ x: comet.x, y: comet.y, vx: comet.vx, vy: comet.vy, r: 14 });
		for (const rock of battle.rocks) threats.push({ x: rock.x, y: rock.y, vx: rock.vx, vy: rock.vy, r: 28 });
		for (const enemy of battle.enemies) {
			if (enemy.state === 'dive' || enemy.state === 'swoop' || enemy.state === 'planting') {
				threats.push({ x: enemy.x, y: enemy.y, vx: enemy.state === 'dive' ? enemy.vx : 0, vy: enemy.state === 'dive' ? enemy.vy : 200, r: 26 });
			}
		}
		const warnings = battle.cometWarnings.map((warning) => warning.x + warning.vx * 1.2);

		let best = { cost: Infinity, move: 0 };
		for (const move of [-1, -0.5, 0, 0.5, 1]) {
			let danger = 0;
			for (const t of [0.1, 0.25, 0.45, 0.7]) {
				const x = Math.max(PLAYER_MARGIN, Math.min(FIELD_W - PLAYER_MARGIN, player.x + move * speed * t));
				for (const threat of threats) {
					const tx = threat.x + threat.vx * t;
					const ty = threat.y + threat.vy * t;
					if (Math.hypot(tx - x, ty - player.y) < threat.r + PLAYER_RADIUS) danger += 1 / (t + 0.1);
				}
				for (const enemy of battle.enemies) {
					if (enemy.state === 'planted' && Math.abs(enemy.x - x) < PLANT_RADIUS + 16) danger += 0.6 / (enemy.timer + 0.2);
				}
				if (battle.boss && battle.boss.state === 'charging' && Math.abs(battle.boss.chargeX - x) < 60) danger += 1;
				for (const wx of warnings) if (Math.abs(wx - x) < 20) danger += 0.2;
			}

			const finalX = player.x + move * speed * 0.3;
			const cost = danger * 100 + Math.abs(finalX - target(battle)) / 50;
			if (cost < best.cost) best = { cost, move };
		}
		return { move: best.move, fire: true };
	}

	function target(battle) {
		const near = battle.pickups.filter((pickup) => pickup.y > 300);
		if (near.length) return near[0].x;
		// Al jefe hay que adelantarle la puntería: el disparo tarda en llegar.
		if (battle.boss) return battle.boss.x + battle.boss.vx * 0.5;
		const planted = battle.enemies.find((enemy) => enemy.state === 'planted');
		if (planted) return planted.x < FIELD_W / 2 ? planted.x + 150 : planted.x - 150;
		const targets = battle.enemies.filter((enemy) => enemy.state !== 'waiting');
		if (!targets.length) return FIELD_W / 2;
		targets.sort((a, b) => b.y - a.y);
		return targets[0].x;
	}

	const totals = {};
	for (const shipId of SHIP_IDS) {
		const zones = ZONES.map(() => ({ reached: 0, cleared: 0, time: 0, bossTime: 0, energyLeft: 0, emptyTime: 0, damage: {}, pickups: {}, pods: 0 }));
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
					battle.setInput(pilot(battle));
					battle.step(STEP);
					battle.events = [];
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

		console.log(`\n${shipId.toUpperCase()}  —  ${RUNS} campañas, ${finished} completas, puntaje medio ${Math.round(score / RUNS)}`);
		console.log('zona  llegan  pasan  duración  jefe  energía  sin energía  daño por fuente (por zona jugada)');
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
				` ${damage}`,
			].join(' '));
		});
		totals[shipId] = finished;
	}
} finally {
	await server.close();
}
