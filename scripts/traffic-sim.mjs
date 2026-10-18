/**
 * Simulador de partidas de Semáforos.
 *
 * `state/` no importa Phaser, así que se pueden jugar cientos de partidas sin
 * navegador, igual que con Astro Chess. Mide lo que pide el GDD para evaluar
 * el balance: duración, coches por minuto, choques, impaciencias y colas.
 *
 *   npm run sim:traffic           # 200 partidas por jugador
 *   npm run sim:traffic -- 1000   # otra cantidad
 *
 * Cuatro jugadores automáticos:
 * - Todo verde y Todo rojo: controles, tienen que perder enseguida.
 * - Ciclo fijo: norte-sur y este-oeste alternados, como un semáforo común.
 *   Los giros a la izquierda contra el que viene de frente lo hacen chocar.
 * - De a un brazo: verde para la cola más impaciente, de a una por vez, y
 *   espera a que el cruce se vacíe antes de cambiar. Es la estrategia segura;
 *   si sobreviviera para siempre, el juego no tendría techo.
 */
import { createServer } from 'vite';

const GAMES = Number(process.argv[2] ?? 200);
const STEP = 1 / 60;
const MAX_TIME = 900;

const server = await createServer({
	logLevel: 'silent',
	server: { middlewareMode: true },
	appType: 'custom',
});

/** mulberry32: cada partida se puede repetir con su número. */
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
	const { Traffic } = await server.ssrLoadModule('/src/games/traffic/state/Traffic.ts');

	const setAll = (traffic, state) => traffic.lightIds.forEach((id) => traffic.setLight(id, state));
	const insideBox = (traffic) => traffic.cars.some((car) => car.committed && car.s < car.route.boxEnd);

	function fixedCycle() {
		const phases = [['centro:N', 'centro:S'], ['centro:E', 'centro:W']];
		const GREEN = 4;
		const CLEAR = 1.2;
		return (traffic) => {
			const t = traffic.time % ((GREEN + CLEAR) * 2);
			const phase = Math.floor(t / (GREEN + CLEAR));
			const green = t - phase * (GREEN + CLEAR) < GREEN ? phases[phase] : [];
			traffic.lightIds.forEach((id) => traffic.setLight(id, green.includes(id) ? 'green' : 'red'));
		};
	}

	function oneArm() {
		let current = null;
		let greenFor = 0;
		const MAX_GREEN = 3.5;
		return (traffic) => {
			if (current) {
				greenFor += STEP;
				if (traffic.queueLength(current) === 0 && greenFor > 0.6 || greenFor > MAX_GREEN) {
					traffic.setLight(current, 'red');
					current = null;
				}
				return;
			}
			if (insideBox(traffic)) {
				return;
			}
			// La cola con el coche más impaciente, medido en segundos que le quedan.
			let best = null;
			let bestPatience = Infinity;
			for (const car of traffic.cars) {
				if (!car.committed && car.speed < 6 && car.patience < bestPatience) {
					best = car.route.lightId;
					bestPatience = car.patience;
				}
			}
			if (best) {
				current = best;
				greenFor = 0;
				traffic.setLight(best, 'green');
			}
		};
	}

	const players = [
		['Todo verde', () => (traffic) => setAll(traffic, 'green')],
		['Todo rojo', () => () => {}],
		['Ciclo fijo', fixedCycle],
		['De a un brazo', oneArm],
	];

	console.log(`${GAMES} partidas por jugador (tope ${MAX_TIME} s)\n`);
	for (const [name, makePlayer] of players) {
		const tally = { time: [], score: [], completed: 0, crashes: 0, impatient: 0, endedByCrash: 0, maxStopped: 0, redShare: 0, capped: 0 };
		for (let seed = 1; seed <= GAMES; seed += 1) {
			const traffic = new Traffic(undefined, seededRandom(seed));
			const play = makePlayer();
			let lastLoss = null;
			while (traffic.outcome === 'playing' && traffic.time < MAX_TIME) {
				play(traffic);
				traffic.step(STEP);
				for (const event of traffic.events) {
					if (event.type === 'crash' || event.type === 'impatient') lastLoss = event.type;
				}
				traffic.events = [];
			}
			if (traffic.outcome === 'playing') tally.capped += 1;
			tally.time.push(traffic.time);
			tally.score.push(traffic.score);
			tally.completed += traffic.stats.completed;
			tally.crashes += traffic.stats.crashes;
			tally.impatient += traffic.stats.impatient;
			tally.maxStopped += traffic.stats.maxStopped;
			if (lastLoss === 'crash') tally.endedByCrash += 1;
			const red = Object.values(traffic.stats.redTime);
			tally.redShare += red.reduce((a, b) => a + b, 0) / red.length / traffic.time;
		}

		const avg = (values) => values.reduce((a, b) => a + b, 0) / values.length;
		const minutes = tally.time.reduce((a, b) => a + b, 0) / 60;
		const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
		console.log(`${name.padEnd(14)} duración media ${avg(tally.time).toFixed(1).padStart(6)} s · mediana ${median(tally.time).toFixed(1)} s · llegaron al tope ${tally.capped}`);
		console.log(`  puntos: media ${avg(tally.score).toFixed(0)}, máximo ${Math.max(...tally.score)}`);
		console.log(`  coches por minuto ${(tally.completed / minutes).toFixed(1)}, choques por partida ${(tally.crashes / GAMES).toFixed(2)}, impaciencias por partida ${(tally.impatient / GAMES).toFixed(2)}`);
		console.log(`  terminaron por choque ${Math.round((tally.endedByCrash / GAMES) * 100)} %, en rojo ${Math.round((tally.redShare / GAMES) * 100)} % del tiempo, máximo detenidos ${(tally.maxStopped / GAMES).toFixed(1)}`);
		console.log('');
	}
} finally {
	await server.close();
}
