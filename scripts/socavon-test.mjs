/**
 * Tests de Socavón, uno por regla de docs/tareas/socavon.md.
 *
 *   npm run test:socavon           # reglas y 500 minas generadas
 *   npm run test:socavon -- 5000   # otra cantidad de minas
 *
 * `state/` no importa Phaser: todo se juega por la interfaz pública de Mine,
 * con las mismas entradas que manda la escena.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';

const SEEDS = Number(process.argv[2] ?? 500);
const STEP = 1 / 60;
const STILL = { x: 0, y: 0, use: false, lamp: false, headlamp: false };

const server = await createServer({ logLevel: 'silent', server: { middlewareMode: true }, appType: 'custom' });
let failed = 0;

async function test(name, body) {
	try {
		await body();
		console.log(`  ok     ${name}`);
	} catch (error) {
		failed += 1;
		console.error(`  FALLA  ${name}\n         ${error.message.split('\n').join('\n         ')}`);
	}
}

try {
	const load = (file) => server.ssrLoadModule(`/src/games/socavon/${file}.ts`);
	const { Mine } = await load('state/Mine');
	const { parseLevel, checkLevel } = await load('state/level');
	const { generateLevel } = await load('state/generator');
	const { LEVELS } = await load('constants/levels');
	const { newRun, readHighScore, submitHighScore } = await load('state/run');
	const { autopilot } = await load('state/autopilot');

	const mine = (...rows) => new Mine(parseLevel(rows), newRun());
	const play = (game, seconds, input = {}) => {
		const events = [];
		for (let time = 0; time < seconds; time += STEP) events.push(...game.step(STEP, { ...STILL, ...input }));
		return events;
	};
	const use = (game) => game.step(STEP, { ...STILL, use: true });
	const walkTo = (game, x) => {
		for (let i = 0; i < 1500 && Math.abs(game.player.x - x) > 0.08; i += 1) {
			game.step(STEP, { ...STILL, x: Math.sign(x - game.player.x) });
		}
		assert.ok(Math.abs(game.player.x - x) <= 0.08, `no llegó a ${x}: quedó en ${game.player.x}`);
	};

	await test('R1 las minas a mano son válidas y se completan', () => {
		assert.ok(LEVELS.length >= 3);
		LEVELS.forEach(({ rows }, index) => {
			assert.deepEqual(checkLevel(parseLevel(rows)), [], `mina ${index + 1}`);
			assert.equal(autopilot(rows), 'cleared', `mina ${index + 1}`);
		});
	});

	await test(`R1 ${SEEDS} minas generadas: repetibles, válidas y completables`, () => {
		for (let seed = 10000; seed < 10000 + SEEDS; seed += 1) {
			const depth = (seed % 9) + 1;
			const rows = generateLevel(seed, depth);
			assert.deepEqual(rows, generateLevel(seed, depth), `semilla ${seed}: no se repite`);
			assert.deepEqual(checkLevel(parseLevel(rows)), [], `semilla ${seed}`);
			assert.equal(autopilot(rows), 'cleared', `semilla ${seed}, profundidad ${depth}`);
		}
	});

	await test('R1 el validador rechaza una mina imposible', () => {
		assert.notDeepEqual(checkLevel(parseLevel(['#E..%.$..#'])), []);
		assert.notDeepEqual(checkLevel(parseLevel(['#E..V....#'])), []);
	});

	/**
	 * R15, calculado acá y no con el validador del juego: un sereno parado tapa
	 * su celda y las de al lado. Devuelve lo que queda sin camino.
	 */
	const cutOff = (rows) => {
		const width = rows[0].length;
		const at = (x, y) => rows[y]?.[x] ?? '#';
		const find = (symbols) => rows.flatMap((row, y) => [...row].flatMap(
			(symbol, x) => (symbols.includes(symbol) ? [{ x, y, symbol }] : [])
		));
		const start = find('E')[0];
		const flood = (shut, solid) => {
			const seen = new Set([start.y * width + start.x]);
			const queue = [[start.x, start.y]];
			for (const [x, y] of queue) {
				const next = [[x - 1, y], [x + 1, y]];
				if (at(x, y) === 'H') next.push([x, y + 1]);
				if (at(x, y - 1) === 'H') next.push([x, y - 1]);
				for (const [a, b] of next) {
					if (solid.includes(at(a, b)) || shut(a, b) || seen.has(b * width + a)) continue;
					seen.add(b * width + a);
					queue.push([a, b]);
				}
			}
			return (node) => seen.has(node.y * width + node.x);
		};
		const targets = find('$VBWEKT');
		const picks = find('T');
		const cut = new Set();
		rows.forEach((row, y) => [...row].forEach((symbol, x) => {
			if ('#h%'.includes(symbol) || (y === start.y && Math.abs(x - start.x) <= 1)) return;
			const shut = (a, b) => b === y && Math.abs(a - x) <= 1;
			const unaided = flood(shut, '#h%');
			const withPick = picks.some(unaided) ? flood(shut, '#h') : unaided;
			for (const target of targets) {
				if (shut(target.x, target.y)) continue;
				if (!('KT'.includes(target.symbol) ? unaided : withPick)(target)) {
					cut.add(`${target.symbol}(${target.x},${target.y})`);
				}
			}
		}));
		return [...cut];
	};

	await test('R15 un sereno parado no corta ningún objetivo en las minas a mano', () => {
		LEVELS.forEach(({ rows }, index) => assert.deepEqual(cutOff(rows), [], `mina ${index + 1}`));
	});

	await test(`R15 un sereno parado no corta ningún objetivo en ${SEEDS} generadas`, () => {
		for (let seed = 10000; seed < 10000 + SEEDS; seed += 1) {
			assert.deepEqual(cutOff(generateLevel(seed, (seed % 9) + 1)), [], `semilla ${seed}`);
		}
	});

	await test('R15 el validador rechaza una bóveda al final de un camino', () => {
		const rows = ['#..H.E...H...#', '#K.........V.#'];
		assert.notDeepEqual(cutOff(rows), []);
		assert.notDeepEqual(checkLevel(parseLevel(rows)), []);
	});

	await test('R15 el caso reportado: bóveda de la mina 1 con un sereno plantado en el camino', () => {
		const game = mine(...LEVELS[0].rows);
		// El único sereno, plantado entre la escalera del medio y la bóveda, mirándola de espaldas.
		game.guards.splice(1);
		Object.assign(game.guards[0], { x: 18.5, y: 3, facing: -1, waitFor: 999, route: [] });
		const vault = game.vaults[0];
		const ladder = [...LEVELS[0].rows[2]].findLastIndex((symbol) => symbol === 'H');
		assert.ok(ladder > vault.x, 'no hay bajada del otro lado de la bóveda');
		Object.assign(game.player, { x: ladder, y: 2, state: 'walk', keys: 1 });
		const events = play(game, 1.5, { y: 1 });
		walkTo(game, vault.x);
		events.push(...use(game));
		assert.equal(vault.open, true);
		use(game);
		assert.equal(game.player.hands, 'bag');
		walkTo(game, ladder);
		events.push(...play(game, 1.5, { y: -1 }));
		assert.equal(game.player.y, 2);
		assert.ok(!events.some((event) => event.type === 'lifeLost'));
	});

	/** El mayor tiempo que un sereno pasa sin alejarse una celda. */
	const longestParked = (game, seconds) => {
		const anchors = game.guards.map(({ x, y }) => ({ x, y, time: 0 }));
		let longest = 0;
		for (let time = 0; time < seconds; time += STEP) {
			game.step(STEP, STILL);
			game.guards.forEach((guard, index) => {
				const anchor = anchors[index];
				if (guard.y !== anchor.y || Math.abs(guard.x - anchor.x) > 1) {
					anchors[index] = { x: guard.x, y: guard.y, time };
				} else {
					longest = Math.max(longest, time - anchor.time);
				}
			});
		}
		return longest;
	};

	await test('R15 ningún sereno que patrulla se queda clavado', () => {
		const mines = LEVELS.map((level) => level.rows);
		for (let seed = 0; seed < 150; seed += 1) mines.push(generateLevel(30000 + seed, (seed % 9) + 1));
		mines.forEach((rows, index) => {
			const longest = longestParked(mine(...rows), 90);
			assert.ok(longest <= 12, `mina ${index}: ${longest.toFixed(1)} s en el mismo lugar`);
		});
	});

	await test('R15 la vagoneta no lo vuelve a aturdir apenas se levanta', () => {
		const game = mine('#E.........#', '#C==G=====.#');
		let last = -Infinity;
		let time = 0;
		for (; time < 60; time += STEP) {
			if (game.step(STEP, STILL).some((event) => event.type === 'stunned')) {
				// 4 s tirado y 4 de inmunidad (R16.11).
				assert.ok(time - last >= 7.9, `otra vez a los ${(time - last).toFixed(1)} s`);
				last = time;
			}
		}
		assert.ok(last > 0, 'nunca lo aturdió');
	});

	await test('R15 no hace guardia eterna debajo de quien cuelga', () => {
		const game = mine('#E............#', '#..hhh..G.....#', '#.............#');
		Object.assign(game.player, { x: 4, y: 1, state: 'hang' });
		Object.assign(game.guards[0], { facing: -1, waitFor: 1 });
		assert.ok(longestParked(game, 30) <= 8);
	});

	await test('R15 al que está del otro lado de un pozo lo busca dando la vuelta', () => {
		const game = mine('#E.......#', '#H.hhh.GH#', '#........#');
		Object.assign(game.player, { x: 2, y: 1 });
		Object.assign(game.guards[0], { facing: -1, waitFor: 1 });
		assert.ok(play(game, 12).some((event) => event.type === 'lifeLost'), 'se quedó mirando el pozo');
	});

	await test('R15 en el pie de la escalera no avisa una y otra vez que te vio', () => {
		const game = mine('#E..H....#', '#......G.#');
		Object.assign(game.player, { x: 4, y: 0.68, state: 'climb', climbTo: 1, ladderTop: 0 });
		Object.assign(game.guards[0], { facing: -1, waitFor: 1 });
		assert.ok(play(game, 8).filter((event) => event.type === 'spotted').length <= 1);
	});

	await test('R3 la bolsa frena, se suelta y se entrega', () => {
		const free = mine('#E..........#');
		play(free, 1, { x: 1 });
		const game = mine('#E$.........#');
		walkTo(game, 2);
		use(game);
		assert.equal(game.player.hands, 'bag');
		const from = game.player.x;
		play(game, 1, { x: 1 });
		assert.ok(game.player.x - from < free.player.x - 1 - 0.5, 'cargado no frena');
		use(game);
		assert.equal(game.player.hands, null);
		use(game);
		assert.equal(game.player.hands, 'bag');
		walkTo(game, 1);
		use(game);
		assert.equal(game.delivered, 1);
	});

	await test('R3 con el pico tirado encima, se levanta la bolsa', () => {
		const game = mine('#E.$......#');
		game.player.x = 3.07;
		game.items.push({ kind: 'pick', x: 3.07, y: 0 });
		use(game);
		assert.equal(game.player.hands, 'bag');
	});

	{
		const { liveSpans } = await load('state/vision');
		const { VISION } = await load('constants/tuning');
		/** Las celdas vivas de cada galería, como texto: `0:0-9` es la galería 0 entera. */
		const spans = (game) => liveSpans(game).map(({ y, from, to }) => `${y}:${from}-${to}`).sort().join(' ');
		const ladder = () => mine('#E..H.....#', '#.........#', '#.........#');
		/** Trepa hasta que el recorrido entre las dos galerías llegue a `part`. */
		const climbTo = (game, direction, part) => {
			for (let i = 0; i < 600; i += 1) {
				const done = direction > 0 ? game.player.y - Math.floor(game.player.y) : Math.ceil(game.player.y) - game.player.y;
				if (game.player.state === 'climb' && done >= part) return;
				game.step(STEP, { ...STILL, y: direction });
			}
			assert.fail(`no llegó al ${part * 100} % de la escalera`);
		};

		await test('R19.1 en una galería se ve sólo esa, de punta a punta', () => {
			const game = ladder();
			assert.equal(spans(game), '0:0-10');
			walkTo(game, 7);
			assert.equal(spans(game), '0:0-10');
		});

		await test('R19.2 al empezar a bajar se ve el pie de la escalera', () => {
			const game = ladder();
			walkTo(game, 4);
			climbTo(game, 1, 0.05);
			assert.equal(spans(game), `0:0-10 1:${4 - VISION.window}-${4 + VISION.window}`);
		});

		await test('R19.2 al empezar a subir se ve la boca de arriba', () => {
			const game = ladder();
			Object.assign(game.player, { x: 4, y: 1 });
			climbTo(game, -1, 0.05);
			assert.equal(spans(game), `0:${4 - VISION.window}-${4 + VISION.window} 1:0-10`);
		});

		await test('R19.3 en el medio de la escalera se ven las dos galerías', () => {
			const game = ladder();
			walkTo(game, 4);
			climbTo(game, 1, 0.5);
			assert.equal(spans(game), '0:0-10 1:0-10');
			climbTo(game, 1, 0.8);
			assert.equal(spans(game), `0:${4 - VISION.window}-${4 + VISION.window} 1:0-10`);
		});

		await test('R19.2 al caer de una argolla se ve abajo, alrededor', () => {
			const game = mine('#E.hhh....#', '#.........#');
			walkTo(game, 4);
			game.step(STEP, { ...STILL, y: 1 });
			game.step(STEP, { ...STILL });
			assert.equal(game.player.state, 'fall');
			assert.equal(spans(game), `0:0-10 1:${4 - VISION.window}-${4 + VISION.window}`);
		});

		await test('R20.1 un muro o la roca cortan la vista, como al sereno', () => {
			const walled = mine('#E..%....#');
			assert.equal(spans(walled), '0:0-4');
			const rock = mine('#E..#....#');
			assert.equal(spans(rock), '0:0-4');
			// Roto, se ve a través.
			const broken = mine('#E..%....#');
			broken.walls[0].hits = 3;
			assert.equal(spans(broken), '0:0-9');
		});

		await test('R20.1 el muro también corta la ventana de la escalera', () => {
			const game = mine('#E..H.....#', '#....%....#');
			walkTo(game, 4);
			climbTo(game, 1, 0.05);
			assert.equal(spans(game), `0:0-10 1:${4 - VISION.window}-5`);
		});

		await test('R20.3 colgado sobre un pozo se ve abajo, alrededor', () => {
			const game = mine('#E.hhhh...#', '#.........#');
			walkTo(game, 5);
			assert.equal(game.player.state, 'hang');
			assert.equal(spans(game), `0:0-10 1:${5 - VISION.window}-${5 + VISION.window}`);
		});

		await test('R19.2 la ventana no se sale de la mina', () => {
			const game = mine('#EH.....#', '#.......#');
			walkTo(game, 2);
			climbTo(game, 1, 0.05);
			assert.equal(spans(game), `0:0-8 1:0-${2 + VISION.window}`);
		});
	}

	{
		const { heard, eventLoudness } = await load('state/hearing');
		const { HEARING, NOISE } = await load('constants/tuning');
		/** Un sereno en `x` de la galería `y`, caminando, corriendo o quieto. */
		const withGuard = (rows, x, y, values = {}) => {
			const game = mine(...rows);
			const guard = mine('#E.G......#').guards[0];
			Object.assign(guard, { x, y, home: { x, y }, moving: true, mode: 'patrol' }, values);
			game.guards.push(guard);
			return game;
		};
		const wide = ['#E....................#', '#.....................#', '#.....................#'];
		const only = (game) => heard(game).map(({ kind, x, y }) => `${kind}@${x},${y}`).join(' ');

		await test('R19.6 se oyen los pasos de un sereno cercano, y corriendo desde más lejos', () => {
			assert.equal(only(withGuard(wide, 1 + 4, 0)), 'walk@5,0');
			assert.equal(only(withGuard(wide, 1 + HEARING.walk + 1, 0)), '', 'caminando, demasiado lejos');
			assert.equal(only(withGuard(wide, 1 + HEARING.walk + 1, 0, { mode: 'chase' })), `run@${HEARING.walk + 2},0`);
		});

		await test('R19.6 lo quieto o aturdido no se oye', () => {
			assert.equal(only(withGuard(wide, 3, 0, { moving: false })), '');
			assert.equal(only(withGuard(wide, 3, 0, { mode: 'stunned' })), '');
		});

		await test('R19.6 el sonido atraviesa muros y roca', () => {
			assert.equal(only(withGuard(['#E.%.#.....#'], 4, 0)), 'walk@4,0');
		});

		await test('R19.6 en la galería de al lado se oye atenuado, y más lejos nada', () => {
			const near = HEARING.walk * NOISE.throughFloor;
			assert.equal(only(withGuard(wide, 1 + Math.floor(near), 1)), `walk@${1 + Math.floor(near)},1`);
			assert.equal(only(withGuard(wide, 1 + Math.ceil(near) + 1, 1)), '', 'abajo y lejos');
			assert.equal(only(withGuard(wide, 1, 2)), '', 'dos galerías más abajo');
			const below = heard(withGuard(wide, 2, 1))[0].loudness;
			const beside = heard(withGuard(wide, 2, 0))[0].loudness;
			assert.ok(below < beside, `abajo ${below}, al lado ${beside}`);
		});

		await test('R19.6 más lejos se oye más bajo y del lado de donde viene', () => {
			const close = heard(withGuard(wide, 2, 0))[0];
			const far = heard(withGuard(wide, 5, 0))[0];
			assert.ok(far.loudness < close.loudness, `${far.loudness} no es menos que ${close.loudness}`);
			assert.ok(far.pan > 0, 'a la derecha');
			const game = withGuard(wide, 2, 0);
			game.player.x = 6;
			assert.ok(heard(game)[0].pan < 0, 'a la izquierda');
		});

		await test('R19.6 la vagoneta se oye en marcha, no detenida', () => {
			const game = mine('#E.........#', '#C========.#');
			game.player.y = 1;
			game.player.x = 9;
			game.carts[0].waitFor = 1;
			assert.equal(only(game), '');
			game.carts[0].waitFor = 0;
			assert.equal(only(game), 'cart@1,1');
		});

		await test('R19.6 la campana se oye mientras suena', () => {
			const game = mine('#E....B...#');
			assert.equal(only(game), '');
			game.alarm = 5;
			assert.equal(only(game), 'bell@6,0');
		});

		await test('R19.8 lo que no se oye no suena, y lo del minero suena siempre', () => {
			const game = mine('#E.........#', '#..........#', '#..........#', '#C========.#');
			assert.equal(eventLoudness(game, { type: 'cartStart', x: 1, y: 3 }), 0, 'tres galerías abajo');
			assert.ok(eventLoudness(game, { type: 'cartStart', x: 3, y: 0 }) > 0, 'en la misma galería');
			assert.equal(eventLoudness(game, { type: 'relight', x: 9, y: 2 }), 0);
			assert.equal(eventLoudness(game, { type: 'take', x: 1, y: 0 }), 1);
			assert.equal(eventLoudness(game, { type: 'spotted', x: 9, y: 3 }), 1, 'los avisos no se atenúan');
		});
	}

	{
		const { seenSpans } = await load('state/vision');
		const { VISION, PLAYER } = await load('constants/tuning');
		const seen = (game) => seenSpans(game).map(({ y, from, to }) => `${y}:${from}-${to}`).sort().join(' ');
		const dark = (...rows) => {
			const game = mine(...rows);
			game.player.headlamp = false;
			return game;
		};
		const reach = VISION.headlamp;

		await test('R19.10 sin linterna, en la propia galería se ve sólo el halo', () => {
			assert.equal(seen(dark('#E..........#')), '0:0-2');
		});

		await test('R19.10 la linterna alumbra hacia adelante', () => {
			const game = mine('#E..........#');
			assert.equal(seen(game), `0:0-${1 + reach}`);
			Object.assign(game.player, { x: 10, facing: -1 });
			assert.equal(seen(game), `0:${10 - reach}-11`);
		});

		await test('R19.10 una lámpara prendida se ve desde lejos; apagada, no', () => {
			const game = dark('#E......l..#');
			assert.equal(seen(game), '0:0-2 0:6-10');
			game.lamps[0].lit = false;
			assert.equal(seen(game), '0:0-2');
		});

		await test('R19.10 al sereno se lo ve por su encendedor', () => {
			const game = dark('#E.....G...#');
			game.guards[0].x = 7;
			assert.equal(seen(game), '0:0-2 0:6-8');
		});

		await test('R19.10 un muro tapa la luz de más allá', () => {
			assert.equal(seen(dark('#E..%...l..#')), '0:0-2');
		});

		await test('R19.10 en la escalera, la linterna alumbra la otra punta; sin ella, el halo', () => {
			const start = (headlamp) => {
				const game = mine('#E..H.....#', '#.........#');
				game.player.headlamp = headlamp;
				walkTo(game, 4);
				for (let i = 0; i < 60 && game.player.y < 0.05; i += 1) game.step(STEP, { ...STILL, y: 1 });
				assert.equal(game.player.state, 'climb');
				return game;
			};
			const window = `${4 - VISION.window}-${4 + VISION.window}`;
			assert.equal(seen(start(true)), `0:${window} 1:${window}`);
			assert.equal(seen(start(false)), '0:3-5 1:3-5');
		});

		const walked = (game, seconds) => {
			const from = game.player.x;
			play(game, seconds, { x: 1 });
			return game.player.x - from;
		};

		await test('R19.11 a tientas se camina al 60 %', () => {
			const lit = walked(mine('#E............................#'), 1);
			const groping = walked(dark('#E............................#'), 1);
			assert.ok(Math.abs(groping / lit - PLAYER.groping) < 0.02, `${groping} contra ${lit}`);
		});

		await test('R19.11 bajo una lámpara no se va a tientas', () => {
			const lit = walked(mine('#E.l..........#'), 0.4);
			const lamp = walked(dark('#E.l..........#'), 0.4);
			assert.ok(Math.abs(lamp - lit) < 0.01, `${lamp} contra ${lit}`);
		});

		await test('R19.11 a tientas se trepa al 60 %', () => {
			const climbed = (game) => {
				walkTo(game, 4);
				play(game, 0.5, { y: 1 });
				return game.player.y;
			};
			const lit = climbed(mine('#E..H.....#', '#.........#'));
			const groping = climbed(dark('#E..H.....#', '#.........#'));
			assert.ok(Math.abs(groping / lit - PLAYER.groping) < 0.03, `${groping} contra ${lit}`);
		});

		/** Un sereno lejos, en `x`, mirando para el lado de `facing`. */
		const flash = (rows, x, facing) => {
			const game = mine(...rows);
			const guard = game.guards[0];
			Object.assign(guard, { x, facing, waitFor: 99, route: [], goal: null, home: { x, y: 0 } });
			return game;
		};
		const far = ['#E..................G..#'];

		await test('R19.12 el sereno que mira para tu lado ve el destello de lejos', () => {
			const game = flash(far, 20, -1);
			game.step(STEP, STILL);
			assert.equal(game.guards[0].mode, 'investigate');
			assert.ok(game.guards[0].goal && Math.abs(game.guards[0].goal.x - 1) <= 1, `va a ${JSON.stringify(game.guards[0].goal)}`);
		});

		await test('R19.12 de espaldas, apagada o tras un muro, no', () => {
			const away = flash(far, 20, 1);
			away.step(STEP, STILL);
			assert.equal(away.guards[0].mode, 'patrol', 'de espaldas');
			const off = flash(far, 20, -1);
			off.player.headlamp = false;
			off.step(STEP, STILL);
			assert.equal(off.guards[0].mode, 'patrol', 'apagada');
			const wall = flash(['#E....%............G..#'], 19, -1);
			wall.step(STEP, STILL);
			assert.equal(wall.guards[0].mode, 'patrol', 'tras un muro');
		});

		await test('R19.12 prenderla un instante alcanza', () => {
			const game = flash(far, 20, -1);
			game.player.headlamp = false;
			game.step(STEP, { ...STILL, headlamp: true });
			game.step(STEP, { ...STILL, headlamp: true });
			assert.equal(game.player.headlamp, false);
			assert.equal(game.guards[0].mode, 'investigate');
		});
	}

	await test('R20.2 en una escalera de varios pisos se baja en el del medio', () => {
		const game = mine('#E..H.....#', '#...H.....#', '#.........#');
		walkTo(game, 4);
		// ↓ apretado todo el tiempo y → al llegar: se baja en la galería 1.
		for (let i = 0; i < 600 && game.player.y < 1; i += 1) game.step(STEP, { ...STILL, y: 1 });
		play(game, 0.5, { x: 1, y: 1 });
		assert.equal(game.player.y, 1, `siguió bajando: y = ${game.player.y}`);
		assert.ok(game.player.x > 4.5, `no salió de la escalera: x = ${game.player.x}`);
		// Sin → sigue de largo hasta abajo, como antes.
		const through = mine('#E..H.....#', '#...H.....#', '#.........#');
		walkTo(through, 4);
		play(through, 3, { y: 1 });
		assert.equal(through.player.y, 2);
	});

	await test('R18 la carretilla suelta queda mirando para donde se la llevaba', () => {
		const game = mine('#E.......W..#');
		walkTo(game, 9);
		use(game);
		assert.equal(game.player.hands, 'barrow');
		walkTo(game, 5);
		use(game);
		assert.equal(game.player.hands, null);
		assert.equal(game.barrows[0].facing, -1, 'hacia la izquierda');
		assert.ok(game.barrows[0].x < 5, `quedó en ${game.barrows[0].x}, no delante`);
		walkTo(game, Math.round(game.barrows[0].x));
		use(game);
		walkTo(game, 8);
		use(game);
		assert.equal(game.barrows[0].facing, 1, 'hacia la derecha');
	});

	await test('R4 la carretilla junta tres, suena, no sube y descarga', () => {
		const game = mine('#EW$$$$.H..#', '#..........#');
		walkTo(game, 2);
		use(game);
		assert.equal(game.player.hands, 'barrow');
		const events = play(game, 2.5, { x: 1 });
		assert.equal(game.player.load, 3);
		assert.ok(events.some((event) => event.type === 'noise'));
		walkTo(game, 8);
		play(game, 1, { y: 1 });
		assert.equal(game.player.y, 0);
		walkTo(game, 1);
		use(game);
		assert.equal(game.delivered, 3);
	});

	await test('R5 la vagoneta atropella al minero', () => {
		const game = mine('#E..C=====.#');
		walkTo(game, 6);
		assert.ok(play(game, 10).some((event) => event.type === 'lifeLost'));
	});

	await test('R5 la vagoneta aturde al sereno', () => {
		const game = mine('#E.........#', '#C==G=====.#');
		let stunned = false;
		for (let i = 0; i < 1500 && !stunned; i += 1) {
			game.step(STEP, STILL);
			stunned = game.guards[0].mode === 'stunned';
		}
		assert.ok(stunned);
	});

	// R16: agarre en x=6 sobre un riel de 1 a 11.
	const rail = () => mine('#E...........#', '#C====A=====.#');
	const onRail = (game, x, state = {}) => Object.assign(game.player, { x, y: 1, ...state });
	const gripped = () => {
		const game = rail();
		onRail(game, 6);
		game.step(STEP, { ...STILL, y: -1 });
		assert.equal(game.player.state, 'grip', 'no se agarró');
		return game;
	};
	const died = (events) => events.some((event) => event.type === 'lifeLost');
	const boarded = () => {
		const game = rail();
		onRail(game, 1);
		use(game);
		assert.equal(game.player.state, 'ride', 'no se subió');
		return game;
	};
	const addGuard = (game, values) => {
		const guard = mine('#E.G......#').guards[0];
		Object.assign(guard, { x: 4, y: 1, home: { x: 4, y: 1 }, facing: -1, waitFor: 99, route: [], goal: null }, values);
		game.guards.push(guard);
		return guard;
	};
	/** Se sube en la parada con un sereno ya puesto. */
	const boardBefore = (values) => {
		const game = rail();
		onRail(game, 1);
		const guard = addGuard(game, values);
		use(game);
		assert.equal(game.player.state, 'ride', 'no se subió');
		return { game, guard };
	};
	const allMines = () => {
		const mines = LEVELS.map((level) => level.rows);
		for (let seed = 10000; seed < 10000 + SEEDS; seed += 1) mines.push(generateLevel(seed, (seed % 9) + 1));
		return mines;
	};

	await test('R16.1 con ↑ y las manos libres se cuelga del agarre', () => {
		gripped();
		for (const hands of ['bag', 'pick', 'barrow']) {
			const game = rail();
			onRail(game, 6, { hands });
			game.step(STEP, { ...STILL, y: -1 });
			assert.equal(game.player.state, 'walk', hands);
		}
	});

	await test('R16.1 cada riel tiene su agarre y el validador lo exige', () => {
		const rows = ['#.H..E.....H....H.#', '#..C=======.......#'];
		assert.ok(checkLevel(parseLevel(rows)).some((problem) => problem.includes('riel sin agarre')));
		allMines().forEach((mineRows, index) => {
			for (const cart of mine(...mineRows).carts) {
				assert.match(mineRows[cart.y].slice(cart.from, cart.to + 1), /A/, `mina ${index}`);
			}
		});
	});

	await test('R16.2 colgado, la vagoneta le pasa por abajo', () => {
		const game = gripped();
		assert.ok(!died(play(game, 4)));
		assert.ok(game.carts[0].x > 7, 'la vagoneta no pasó');
		assert.equal(game.player.state, 'grip');
	});

	await test('R16.2 el dibujo entra: techo, minero y vagoneta sin pisarse', async () => {
		const { TILE, PIXEL, GRIP_LIFT, CART_LIFT } = await load('objects/geometry');
		const atlas = JSON.parse(readFileSync('public/assets/socavon/mine.json', 'utf8'));
		const extent = (name) => {
			const { frames, origin } = atlas.meta.clips[name];
			return frames.map((key) => {
				const { spriteSourceSize: box, sourceSize } = atlas.frames[key];
				const top = (origin[1] * sourceSize.h - box.y) * PIXEL;
				return { top, bottom: top - box.h * PIXEL };
			});
		};
		const miner = extent('minero/grip');
		const cartTop = Math.max(...extent('grandes/cart').map(({ top }) => top)) + CART_LIFT;
		assert.ok(Math.max(...miner.map(({ top }) => top)) + GRIP_LIFT <= TILE * 2, 'se mete en el techo');
		assert.ok(Math.min(...miner.map(({ bottom }) => bottom)) + GRIP_LIFT >= cartTop, 'lo toca la vagoneta');
	});

	await test('R16.3 se cansa, cae y no se vuelve a agarrar sin descansar', () => {
		const game = gripped();
		game.carts[0].waitFor = 999;
		const events = play(game, 7.5, { y: -1 });
		assert.ok(events.some((event) => event.type === 'slip'), 'no se cansó');
		assert.equal(game.player.state, 'walk');
		play(game, 4);
		game.step(STEP, { ...STILL, y: -1 });
		assert.equal(game.player.state, 'grip', 'descansado no se pudo agarrar');
	});

	await test('R16.3 aguanta hasta que pase la vagoneta, con tiempo para soltarse', async () => {
		const { GRIP, CART } = await load('constants/tuning');
		allMines().forEach((rows, index) => {
			const game = mine(...rows);
			for (const { x, y } of game.level.find('A')) {
				const cart = game.carts.find((other) => other.y === y);
				const wait = (2 * Math.max(x - cart.from, cart.to - x)) / CART.speed + CART.wait;
				assert.ok(wait <= GRIP.time - 1, `mina ${index}: ${wait.toFixed(1)} s de espera`);
			}
		});
		assert.ok(GRIP.time < 10, 'es casi para siempre');
	});

	await test('R16.4 el sereno lo agarra colgado', () => {
		for (const x of [3, 9]) {
			const game = gripped();
			game.carts[0].waitFor = 999;
			addGuard(game, { x, facing: x < 6 ? 1 : -1 });
			assert.ok(died(play(game, 3)), `desde ${x}`);
			assert.notEqual(game.player.state, 'grip');
		}
	});

	/** Colgado en el medio de un pozo de tres argollas. */
	const hanging = (...rows) => {
		const game = mine(...rows);
		walkTo(game, 4);
		assert.equal(game.player.state, 'hang', 'no se colgó');
		return game;
	};

	await test('R16.13 las argollas cansan: cae a la galería de abajo', () => {
		const game = hanging('#E.hhh....#', '#.........#');
		const events = play(game, 7.5);
		assert.ok(events.some((event) => event.type === 'slip'), 'no se cansó');
		assert.equal(game.player.y, 1);
		assert.ok(!died(events));
	});

	await test('R16.13 sin galería abajo, cansado pierde una vida', () => {
		const game = hanging('#E.hhh....#', '##########');
		assert.ok(died(play(game, 7.5)));
	});

	await test('R16.13 cruzar no cansa de más, y en el piso se recupera', async () => {
		const { GRIP, PLAYER } = await load('constants/tuning');
		const game = mine('#E.hhh....#', '##########');
		walkTo(game, 8);
		assert.ok(game.player.stamina < GRIP.time, 'no gastó nada');
		play(game, 3);
		assert.equal(game.player.stamina, GRIP.time);
		allMines().forEach((rows, index) => {
			for (const row of rows) {
				for (const pit of row.match(/h+/g) ?? []) {
					assert.ok((pit.length + 1) / PLAYER.hang <= GRIP.time / 2, `mina ${index}: pozo de ${pit.length}`);
				}
			}
		});
	});

	await test('R16.5 se suelta encima de la vagoneta y viaja', () => {
		const game = gripped();
		const cart = game.carts[0];
		for (let i = 0; i < 600 && cart.x < 4.8; i += 1) game.step(STEP, STILL);
		assert.ok(!died([...game.step(STEP, { ...STILL, y: 1 }), ...play(game, 0.6)]));
		assert.equal(game.player.state, 'ride');
		assert.equal(game.player.x, cart.x);
		assert.ok(cart.x > 7, 'no viajó');
	});

	await test('R16.5 sin vagoneta abajo, soltarse es caer al piso', () => {
		const game = gripped();
		game.carts[0].waitFor = 999;
		play(game, 0.5, { y: 1 });
		assert.equal(game.player.state, 'walk');
		assert.equal(game.player.y, 1);
	});

	await test('R16.5 cansado también cae adentro si está pasando', () => {
		const game = gripped();
		Object.assign(game.carts[0], { x: 5.2, waitFor: 0, direction: 1 });
		game.player.stamina = STEP / 2;
		assert.ok(!died(play(game, 0.4)));
		assert.equal(game.player.state, 'ride');
	});

	await test('R16.5 desde un pozo también le cae adentro', () => {
		for (const waitFor of [0, 2]) {
			const game = mine('#E..hhh.....#', '#C======A==.#');
			Object.assign(game.player, { x: 5, y: 0.82, state: 'fall', fallTo: 1 });
			Object.assign(game.carts[0], { x: 4.7, waitFor, direction: 1 });
			assert.ok(!died(play(game, 0.3)));
			assert.equal(game.player.state, 'ride', waitFor ? 'detenida' : 'en marcha');
		}
	});

	await test('R16.5 de frente sigue matando, aunque se apriete Espacio', () => {
		const game = rail();
		onRail(game, 6);
		const events = [];
		for (let i = 0; i < 240; i += 1) events.push(...game.step(STEP, { ...STILL, use: i % 6 === 0 }));
		assert.ok(died(events));
	});

	await test('R16.8 hay al menos 0,4 s para soltarse encima', () => {
		for (const direction of [-1, 1]) {
			let hits = 0;
			for (let offset = -4; offset <= 4.001; offset += 0.05) {
				const game = gripped();
				Object.assign(game.carts[0], { x: 6 + offset, waitFor: 0, direction });
				game.step(STEP, { ...STILL, y: 1 });
				for (let i = 0; i < 30 && game.player.state === 'drop'; i += 1) game.step(STEP, STILL);
				if (game.player.state === 'ride') hits += 1;
			}
			const seconds = (hits * 0.05) / 6;
			assert.ok(seconds >= 0.4, `${seconds.toFixed(2)} s`);
		}
	});

	await test('R16.6 Espacio sube y baja con la vagoneta detenida, también con bolsa', () => {
		for (const hands of [null, 'bag', 'pick']) {
			const game = rail();
			onRail(game, 1, { hands });
			use(game);
			assert.equal(game.player.state, 'ride');
			assert.equal(game.player.hands, hands);
			use(game);
			assert.equal(game.player.state, 'walk');
			assert.equal(game.player.hands, hands);
		}
		const pushing = rail();
		onRail(pushing, 1, { hands: 'barrow' });
		assert.notEqual(pushing.action()?.kind, 'board');
	});

	await test('R16.6 lo que quedó tirado bajo la vagoneta se levanta antes de subir', () => {
		for (const kind of ['bag', 'pick']) {
			const game = rail();
			onRail(game, 1);
			game.items.push({ kind, x: 1, y: 1 });
			use(game);
			assert.equal(game.player.hands, kind);
			use(game);
			assert.equal(game.player.state, 'ride');
		}
		const pushing = rail();
		onRail(pushing, 1);
		pushing.barrows.push({ x: 1, y: 1, load: 2 });
		use(pushing);
		assert.equal(pushing.player.hands, 'barrow');
	});

	await test('R16.6 en marcha no se baja con Espacio', () => {
		const game = boarded();
		play(game, 2.6);
		use(game);
		assert.equal(game.player.state, 'ride');
	});

	await test('R16.6 bajarse justo cuando arranca no lo atropella', () => {
		for (const stop of [1, 11]) {
			const game = rail();
			Object.assign(game.carts[0], { x: stop, direction: stop === 1 ? 1 : -1 });
			onRail(game, stop);
			use(game);
			assert.equal(game.player.state, 'ride', 'no se subió');
			game.carts[0].waitFor = STEP * 1.5;
			use(game);
			assert.equal(game.player.state, 'walk', 'no se bajó');
			assert.ok(!died(play(game, 0.5)), `parada ${stop}`);
		}
	});

	await test('R16.7 arriba no lo ve ni lo toca quien no lo vio subir', () => {
		const game = boarded();
		addGuard(game, { x: 1.4 });
		const events = play(game, 1.5);
		assert.ok(!died(events));
		assert.ok(!events.some((event) => event.type === 'spotted'));
	});

	await test('R16.7 perseguirlo sin haberlo visto subir no alcanza', () => {
		const { game, guard } = boardBefore({ x: 5, facing: 1, mode: 'chase', timer: 14 });
		Object.assign(guard, { x: 1.2, facing: -1, goal: { x: 1, y: 1 } });
		assert.ok(!died(play(game, 1.5)));
	});

	await test('R16.7 verlo subir sin estar siguiéndolo tampoco', () => {
		const { game } = boardBefore({ x: 3 });
		assert.ok(!died(play(game, 1.8)));
	});

	await test('R16.7 el que lo sigue y lo vio subir lo agarra detenido', () => {
		const { game } = boardBefore({ x: 4, mode: 'chase', timer: 14 });
		assert.ok(died(play(game, 1.8)));
		assert.equal(game.player.state, 'walk');
	});

	await test('R16.7 el testigo no lo agarra en marcha', () => {
		const { game, guard } = boardBefore({ x: 4, mode: 'chase', timer: 14, shakenFor: 5 });
		game.carts[0].waitFor = 0;
		guard.x = 1.2;
		assert.ok(!died(play(game, 0.3)));
	});

	await test('R16.7 si lo pierde de vista deja de ser testigo', () => {
		const { game, guard } = boardBefore({ x: 4, mode: 'chase', timer: 14 });
		Object.assign(guard, { mode: 'search', timer: 5, x: 1.3, facing: -1, route: [] });
		const events = play(game, 1.8);
		assert.ok(!died(events));
		assert.ok(!events.some((event) => event.type === 'spotted'));
	});

	await test('R16.7 atropellado deja de ser testigo', () => {
		const { game, guard } = boardBefore({ x: 2.5, mode: 'chase', timer: 14 });
		game.carts[0].waitFor = 0;
		play(game, 0.3);
		assert.equal(guard.mode, 'stunned');
		Object.assign(guard, { mode: 'patrol', waitFor: 99, x: 11, facing: -1 });
		assert.ok(!died(play(game, 2.5)));
	});

	await test('R16.9 el validador rechaza una parada sin salida', () => {
		const rows = ['#E..H..$..H.#', '#C====A===.##'];
		assert.ok(checkLevel(parseLevel(rows)).some((problem) => problem.includes('parada sin salida')));
	});

	await test('R16.9 ninguna parada deja encerrado con el testigo detrás', () => {
		allMines().forEach((rows, index) => {
			const game = mine(...rows);
			const at = (x, y) => rows[y]?.[x] ?? '#';
			for (const { y, from, to } of game.carts) {
				for (const stop of [from, to]) {
					const seen = new Set([`${stop},${y}`]);
					const queue = [[stop, y]];
					for (const [x, floor] of queue) {
						const next = [[x - 1, floor], [x + 1, floor]];
						if (at(x, floor) === 'H') next.push([x, floor + 1]);
						if (at(x, floor - 1) === 'H') next.push([x, floor - 1]);
						for (const [a, b] of next) {
							const behind = b === y && a >= from && a <= to;
							if (behind || '#h%'.includes(at(a, b)) || seen.has(`${a},${b}`)) continue;
							seen.add(`${a},${b}`);
							queue.push([a, b]);
						}
					}
					assert.ok(seen.has(`${game.level.start.x},${game.level.start.y}`), `mina ${index}, parada ${stop},${y}`);
				}
			}
		});
	});

	await test('R16.10 ningún objetivo pegado a una parada', () => {
		const rows = ['#..H.E.....H..#', '#.$C===A====..#'];
		assert.ok(checkLevel(parseLevel(rows)).some((problem) => problem.includes('pegado a una parada')));
		allMines().forEach((mineRows, index) => {
			for (const cart of mine(...mineRows).carts) {
				for (const stop of [cart.from, cart.to]) {
					assert.doesNotMatch(mineRows[cart.y].slice(stop - 1, stop + 2), /[$TVWBKE%]/, `mina ${index}`);
				}
			}
		});
	});

	await test('R16.11 la inmunidad al levantarse dura 4 s', () => {
		for (const [after, stunned] of [[3.5, false], [4.3, true]]) {
			const game = rail();
			const guard = addGuard(game, { x: 6, shakenFor: 0, mode: 'stunned', timer: STEP / 2 });
			game.carts[0].waitFor = 999;
			play(game, after);
			Object.assign(guard, { x: 6, y: 1, route: [], waitFor: 99 });
			Object.assign(game.carts[0], { x: 6, waitFor: 0 });
			game.step(STEP, STILL);
			assert.equal(guard.mode === 'stunned', stunned, `a los ${after} s`);
		}
	});

	await test('R16.12 al pie de la escalera atropella igual al sereno', () => {
		const game = rail();
		const guard = addGuard(game, { x: 4, y: 1.05 });
		Object.assign(game.carts[0], { x: 3.8, waitFor: 0 });
		game.step(STEP, STILL);
		assert.equal(guard.mode, 'stunned');
		assert.equal(guard.y, 1);
	});

	await test('R6 se baja y se sube la escalera con una bolsa', () => {
		const game = mine('#E$.H.....#', '#.........#');
		walkTo(game, 2);
		use(game);
		walkTo(game, 4);
		play(game, 1.5, { y: 1 });
		assert.equal(game.player.y, 1);
		play(game, 1.5, { y: -1 });
		assert.equal(game.player.y, 0);
		assert.equal(game.player.hands, 'bag');
	});

	await test('R7 las manijas cruzan con las manos libres', () => {
		const game = mine('#E.hhh....#', '#.........#');
		walkTo(game, 8);
		assert.equal(game.player.y, 0);
	});

	await test('R7 con carga el pozo frena y colgado se puede soltar', () => {
		const loaded = mine('#E$.hhh...#', '#.........#');
		walkTo(loaded, 2);
		use(loaded);
		play(loaded, 3, { x: 1 });
		assert.ok(loaded.player.x < 4);
		assert.equal(loaded.player.y, 0);
		const hanging = mine('#E.hhh....#', '#.........#');
		walkTo(hanging, 4);
		play(hanging, 1.2, { y: 1 });
		assert.equal(hanging.player.y, 1);
	});

	await test('R8 tres golpes de pico abren el muro y se oyen', () => {
		const game = mine('#ET.%.....#');
		play(game, 2, { x: 1 });
		assert.ok(game.player.x < 4, 'el muro no frena');
		walkTo(game, 2);
		use(game);
		play(game, 2, { x: 1 });
		const events = [];
		for (let hit = 0; hit < 3; hit += 1) {
			assert.equal(game.walls[0].hits, hit);
			events.push(...use(game), ...play(game, 0.5));
		}
		assert.equal(events.filter((event) => event.type === 'noise').length, 3);
		walkTo(game, 7);
	});

	await test('R9 la llave se saca por la espalda', () => {
		const game = mine('#E.K......#');
		Object.assign(game.guards[0], { facing: 1, waitFor: 9 });
		walkTo(game, 2.3);
		use(game);
		assert.equal(game.player.keys, 1);
		const front = mine('#E.K......#');
		Object.assign(front.guards[0], { facing: -1, waitFor: 9 });
		front.player.x = 2.3;
		use(front);
		assert.equal(front.player.keys, 0);
	});

	await test('R9 y R11 la bóveda pide llave, da dos bolsas y hace sonar la campana', () => {
		const game = mine('#E..V..B..#', '#G........#');
		walkTo(game, 4);
		use(game);
		assert.equal(game.vaults[0].open, false);
		game.player.keys = 1;
		use(game);
		assert.equal(game.vaults[0].open, true);
		assert.equal(game.items.filter((item) => item.kind === 'bag').length, 2);
		assert.ok(game.alarm > 0);
		play(game, 0.2);
		assert.equal(game.guards[0].mode, 'investigate');
		walkTo(game, 7);
		use(game);
		assert.equal(game.alarm, 0);
	});

	await test('R9 el botín de una bóveda junto a un pozo no cae sobre el pozo', () => {
		const game = mine('#E..Vhh..#');
		game.player.keys = 1;
		game.player.x = 4;
		use(game);
		for (const bag of game.items) assert.equal(game.level.at(Math.round(bag.x), bag.y), 'V');
	});

	await test('R10 a oscuras y sin linterna el sereno ve menos', () => {
		const dark = mine('#E....G...#');
		dark.player.headlamp = false;
		Object.assign(dark.guards[0], { facing: -1, waitFor: 9 });
		play(dark, 1);
		assert.notEqual(dark.guards[0].mode, 'chase');
		const bright = mine('#E....G...#');
		Object.assign(bright.guards[0], { facing: -1, waitFor: 9 });
		play(bright, 1);
		assert.equal(bright.guards[0].mode, 'chase');
	});

	await test('R10 la lámpara se apaga', () => {
		const game = mine('#E.l......#');
		walkTo(game, 3);
		game.step(STEP, { ...STILL, lamp: true });
		assert.equal(game.lamps[0].lit, false);
	});

	await test('R12 persigue y atrapa; la carga queda en el piso', () => {
		const game = mine('#E$...G...#');
		Object.assign(game.guards[0], { facing: -1, waitFor: 9 });
		game.player.x = 2;
		use(game);
		assert.ok(play(game, 4).some((event) => event.type === 'lifeLost'));
		play(game, 2);
		assert.equal(game.player.hands, null);
		assert.equal(game.items.filter((item) => item.kind === 'bag').length, 1);
	});

	await test('R12 si lo pierde de vista va hasta donde lo vio', () => {
		const game = mine('#E.........G..#', '#.............#');
		Object.assign(game.guards[0], { x: 9, facing: -1, waitFor: 9 });
		game.player.x = 3;
		play(game, 0.6);
		assert.equal(game.guards[0].mode, 'chase');
		game.player.y = 1;
		play(game, 2.5);
		assert.ok(game.guards[0].x < 4, `se quedó en ${game.guards[0].x}`);
	});

	await test('R17.2 con las manos libres toca la campana y los serenos van para ahí', () => {
		const game = mine('#E..B.......G#');
		Object.assign(game.guards[0], { facing: 1, waitFor: 9 });
		walkTo(game, 4);
		const events = use(game);
		assert.ok(game.alarm > 0, 'no sonó');
		assert.ok(events.some((event) => event.type === 'ring'), 'sin evento');
		assert.equal(game.guards[0].mode, 'investigate');
		walkTo(game, 1);
		play(game, 2);
		assert.ok(game.guards[0].x < 10, `no fue: quedó en ${game.guards[0].x}`);
	});

	await test('R17.2 suena 8 segundos y sonando Espacio la calla', () => {
		const game = mine('#E..B.....#');
		walkTo(game, 4);
		use(game);
		play(game, 7.9);
		assert.ok(game.alarm > 0, 'se calló antes');
		play(game, 0.2);
		assert.equal(game.alarm, 0);
		use(game);
		assert.ok(game.alarm > 0);
		use(game);
		assert.equal(game.alarm, 0);
	});

	await test('R17.2 no distrae a quien persigue ni a quien está aturdido', () => {
		const game = mine('#E..B......G.G#');
		walkTo(game, 4);
		Object.assign(game.guards[0], { mode: 'chase', timer: 9, facing: -1, x: 8 });
		Object.assign(game.guards[1], { mode: 'stunned', timer: 3 });
		use(game);
		assert.equal(game.guards[0].mode, 'chase');
		assert.equal(game.guards[1].mode, 'stunned');
	});

	await test('R17.2 cargado o con algo tirado al lado, Espacio no la toca', () => {
		const loaded = mine('#E..B.....#');
		loaded.player.x = 4;
		loaded.player.hands = 'bag';
		use(loaded);
		assert.equal(loaded.alarm, 0);
		assert.equal(loaded.player.hands, null);
		const lying = mine('#E..$B....#');
		walkTo(lying, 4);
		use(lying);
		assert.equal(lying.alarm, 0);
		assert.equal(lying.player.hands, 'bag');
	});

	await test('R11 al vaciar la mina la campana se calla', () => {
		const game = mine('#E$.......#');
		game.alarm = 9;
		game.player.x = 2;
		use(game);
		game.player.x = 1;
		use(game);
		assert.equal(game.status, 'cleared');
		assert.equal(game.alarm, 0);
	});

	await test('R12 la patrulla no baja del montacargas al que recién llega', () => {
		const mines = LEVELS.map((level) => level.rows);
		for (let seed = 0; seed < 90; seed += 1) mines.push(generateLevel(20000 + seed, (seed % 9) + 1));
		mines.forEach((rows, index) => {
			const game = new Mine(parseLevel(rows), newRun());
			assert.ok(!play(game, 30).some((event) => event.type === 'lifeLost'), `mina ${index}: muere sin moverse`);
		});
	});

	await test('R12 no ve a quien se esconde ni a través de un muro', () => {
		const niche = mine('#En...G...#');
		Object.assign(niche.guards[0], { facing: -1, waitFor: 9 });
		niche.player.x = 2;
		play(niche, 3, { y: -1 });
		assert.equal(niche.player.hidden, true);
		assert.notEqual(niche.guards[0].mode, 'chase');
		const wall = mine('#E..%.G...#');
		Object.assign(wall.guards[0], { facing: -1, waitFor: 9 });
		play(wall, 2);
		assert.notEqual(wall.guards[0].mode, 'chase');
	});

	await test('R13 se pasa con todo entregado', () => {
		const game = mine('#E$.......#');
		walkTo(game, 2);
		use(game);
		walkTo(game, 1);
		use(game);
		assert.equal(game.status, 'cleared');
		assert.ok(game.score > 0);
	});

	await test('R13 tres vidas', () => {
		const game = mine('#E..C=====.#');
		assert.equal(game.lives, 3);
		for (let i = 0; i < 3; i += 1) {
			for (let wait = 0; wait < 600 && game.status !== 'playing'; wait += 1) game.step(STEP, STILL);
			game.player.invincible = 0;
			game.player.x = game.carts[0].x;
			game.carts[0].waitFor = 0;
			game.step(STEP, STILL);
		}
		play(game, 2);
		assert.equal(game.lives, 0);
		assert.equal(game.status, 'over');
	});

	await test('R13 el récord se guarda y sólo sube', () => {
		const saved = new Map();
		Object.defineProperty(globalThis, 'localStorage', {
			configurable: true,
			value: { getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, String(value)) },
		});
		assert.equal(submitHighScore(700), true);
		assert.equal(submitHighScore(300), false);
		assert.equal(readHighScore(), 700);
	});
} catch (error) {
	failed += 1;
	console.error(`  FALLA  carga de módulos\n         ${error.message}`);
} finally {
	await server.close();
}

console.log(failed ? `\n${failed} fallaron` : '\nTodo en verde');
process.exitCode = failed ? 1 : 0;
