/**
 * Tests de las reglas de combate de Galáctica.
 *
 *   npm run test:galactica
 *
 * `state/` no importa Phaser: todo se juega con las mismas entradas que manda
 * la escena y se mira lo que la batalla deja en sus listas y en sus eventos.
 */
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const STEP = 1 / 60;
const STILL = { move: 0, moveY: 0, fire: false, shield: false };

const server = await createServer({ logLevel: 'silent', server: { middlewareMode: true }, appType: 'custom' });
let failed = 0;

function test(name, body) {
	try {
		body();
		console.log(`  ok     ${name}`);
	} catch (error) {
		failed += 1;
		console.error(`  FALLA  ${name}\n         ${error.message.split('\n').join('\n         ')}`);
	}
}

const close = (actual, expected, margin, label) =>
	assert.ok(Math.abs(actual - expected) <= margin, `${label}: ${actual}, se esperaba ${expected} ± ${margin}`);

try {
	const load = (file) => server.ssrLoadModule(`/src/games/galactica/${file}.ts`);
	const { Battle, newRun } = await load('state/Battle');
	const { seededRandom } = await load('state/rng');
	const { SHIP_IDS, SHIPS } = await load('constants/ships');
	const { ZONES } = await load('constants/zones');
	const { DAMAGE, FIELD_W, FIELD_H, EMPTY_ENERGY_LIFE_DRAIN } = await load('constants/tuning');
	const { STORM } = await load('constants/passages');

	const START_Y = FIELD_H - 44;

	const zone = (number = 1, shipId = 'halcon', seed = 1) => new Battle({ ...newRun(shipId), zone: number }, seededRandom(seed));
	const bench = (number = 1, shipId = 'halcon') => zone(number, shipId).sandbox();
	const play = (battle, seconds, input = {}) => {
		battle.setInput({ ...STILL, ...input });
		for (let step = 0; step < Math.round(seconds / STEP); step += 1) battle.step(STEP);
		return battle;
	};
	const forward = (battle) => play(battle, 3, { moveY: -1 });
	const give = (battle, kind) => {
		battle.pickups.push({ id: -battle.pickups.length - 1, x: battle.player.x, y: battle.player.y, kind, age: 0 });
		return play(battle, STEP);
	};
	const hitByBullet = (battle) => {
		const { x, y } = battle.player;
		battle.bullets.push({ id: 9999, x, y, vx: 0, vy: 0, style: 'bolt', damage: DAMAGE.bolt, age: 0, cx: x, cy: y, phase: 0 });
	};

	/** Una oleada entera con el jugador quieto e inmortal; mira cada paso. */
	const watchWave = ({ number, wave = 0, seconds = 30, seed = 1, ahead = false }, look) => {
		const battle = zone(number, 'halcon', seed);
		battle.randomEvents = false;
		battle.pendingPassage = null;
		battle.wave = wave - 1;
		battle.setInput({ ...STILL, moveY: ahead ? -1 : 0 });
		while (battle.time < seconds) {
			battle.hp = 100;
			battle.energy = 100;
			battle.player.invulnerable = 9;
			battle.step(STEP);
			look(battle);
			battle.events = [];
		}
	};
	const parkedShots = (battle) => battle.events.filter((event) => event.type === 'enemyShot' && battle.enemies.some(
		(enemy) => enemy.state === 'formation' && enemy.x === event.x && enemy.y + 14 === event.y,
	));

	console.log('\nMovimiento');

	test('avanza hasta la mitad de la pantalla y no más', () => {
		const battle = forward(bench());
		close(battle.player.y, FIELD_H / 2, 0.01, 'y adelante');
	});

	test('retrocede hasta la línea de salida y no más', () => {
		const battle = forward(bench());
		play(battle, 3, { moveY: 1 });
		close(battle.player.y, START_Y, 0.01, 'y atrás');
	});

	test('en diagonal no va más rápido', () => {
		const battle = bench();
		const { x, y } = battle.player;
		play(battle, 0.5, { move: 1, moveY: -1 });
		close(Math.hypot(battle.player.x - x, battle.player.y - y), SHIPS.halcon.speed * 0.5, 1, 'recorrido');
	});

	test('de lado a lado sigue igual que antes', () => {
		const battle = bench();
		play(battle, 0.5, { move: 1 });
		close(battle.player.x, FIELD_W / 2 + SHIPS.halcon.speed * 0.5, 1, 'x');
		assert.equal(battle.player.y, START_Y);
	});

	console.log('\nEnergía');

	test('sin disparar baja al ritmo de la zona, como antes', () => {
		ZONES.forEach((def, index) => {
			const battle = play(bench(index + 1), 10);
			close(100 - battle.energy, 1000 / def.energySeconds, 0.05, `zona ${index + 1}`);
		});
	});

	for (const id of SHIP_IDS) {
		test(`${id}: con el gatillo fijo gasta un 75 % más rápido, también con turbo`, () => {
			for (const speed of [0, 99]) {
				const battle = bench(1, id);
				battle.player.speed = speed;
				play(battle, 20, { fire: true });
				close(100 - battle.energy, (2000 / ZONES[0].energySeconds) * 1.75, 0.3, `turbo ${speed}`);
			}
		});
	}

	test('un disparo suelto cuesta menos que el gatillo fijo', () => {
		const single = bench();
		play(single, STEP, { fire: true });
		play(single, 3);
		const held = play(bench(), 3 + STEP, { fire: true });
		assert.ok(single.energy > held.energy + 0.8, `${single.energy} contra ${held.energy}`);
	});

	test('sin energía se puede seguir disparando y la vida drena como antes', () => {
		const battle = bench();
		battle.energy = 0;
		play(battle, 2, { fire: true });
		assert.ok(battle.shots.length > 0, 'no disparó');
		close(100 - battle.hp, 2 * EMPTY_ENERGY_LIFE_DRAIN, 0.1, 'drenaje');
	});

	console.log('\nEscudo');

	test('la cápsula suma carga, no prende el escudo', () => {
		const battle = give(bench(), 'shield');
		assert.equal(battle.player.shield, 8);
		hitByBullet(battle);
		play(battle, STEP);
		close(battle.hp, 100 - DAMAGE.bolt, 0.01, 'vida');
	});

	test('las cápsulas se acumulan hasta el tope', () => {
		const battle = bench();
		give(battle, 'shield');
		give(battle, 'shield');
		assert.equal(battle.player.shield, 16);
		give(battle, 'shield');
		give(battle, 'shield');
		assert.equal(battle.player.shield, 24);
	});

	test('guardada, la carga no se gasta', () => {
		const battle = give(bench(), 'shield');
		play(battle, 10);
		assert.equal(battle.player.shield, 8);
	});

	test('prendido bloquea', () => {
		const battle = give(bench(), 'shield');
		hitByBullet(battle);
		play(battle, STEP, { shield: true });
		assert.equal(battle.hp, 100);
		assert.ok(battle.events.some((event) => event.type === 'shieldBlock'), 'no avisó el bloqueo');
	});

	test('prendido gasta su carga y un 50 % más de energía', () => {
		const battle = give(bench(), 'shield');
		const before = battle.energy;
		play(battle, 4, { shield: true });
		close(battle.player.shield, 4, 0.05, 'carga');
		close(before - battle.energy, (400 / ZONES[0].energySeconds) * 1.5, 0.05, 'energía');
	});

	test('sin carga no prende ni cobra', () => {
		const battle = bench();
		hitByBullet(battle);
		play(battle, 1, { shield: true });
		close(battle.hp, 100 - DAMAGE.bolt, 0.01, 'vida');
		close(100 - battle.energy, 100 / ZONES[0].energySeconds, 0.05, 'energía');
	});

	test('sin energía no prende y conserva la carga', () => {
		const battle = give(bench(), 'shield');
		battle.energy = 0;
		hitByBullet(battle);
		play(battle, STEP, { shield: true });
		assert.ok(battle.hp < 100 - DAMAGE.bolt + 0.01, `vida ${battle.hp}`);
		assert.equal(battle.player.shield, 8);
	});

	test('soltar la tecla lo apaga', () => {
		const battle = give(bench(), 'shield');
		play(battle, 1, { shield: true });
		play(battle, STEP);
		hitByBullet(battle);
		play(battle, STEP);
		close(battle.hp, 100 - DAMAGE.bolt, 0.01, 'vida');
	});

	test('la carga pasa a la zona siguiente', () => {
		const next = give(bench(), 'shield').nextRun();
		assert.equal(new Battle(next).player.shield, 8);
	});

	test('doble y turbo siguen prendiéndose al juntarlos', () => {
		for (const [kind, seconds] of [['double', 12], ['speed', 10]]) {
			const battle = give(bench(), kind);
			play(battle, 2);
			close(battle.player[kind], seconds - 2, 0.05, kind);
		}
	});

	console.log('\nAtaques');

	test('disparan desde la formación en las cuatro zonas, y cada tanto', () => {
		ZONES.forEach((_, index) => {
			let shots = 0;
			for (let seed = 1; seed <= 10; seed += 1) {
				watchWave({ number: index + 1, seed }, (battle) => { shots += parkedShots(battle).length; });
			}
			// Son diez oleadas de 30 s: entre 4 y 25 salvas por minuto.
			assert.ok(shots >= 20 && shots <= 125, `zona ${index + 1}: ${shots} salvas en 5 minutos`);
		});
	});

	test('desde la formación no disparan a quemarropa', () => {
		let shots = 0;
		for (let seed = 1; seed <= 10; seed += 1) {
			watchWave({ number: 2, wave: 2, seed, ahead: true }, (battle) => {
				for (const shot of parkedShots(battle)) {
					shots += 1;
					assert.ok(battle.player.y - shot.y >= 75, `salió a ${battle.player.y - shot.y} px`);
				}
			});
		}
		assert.ok(shots > 0, 'nadie disparó');
	});

	test('mientras entran, la formación no dispara', () => {
		watchWave({ number: 1, seconds: 6 }, (battle) => {
			if (battle.enemies.some((enemy) => enemy.state === 'waiting' || enemy.state === 'entering')) {
				assert.equal(parkedShots(battle).length, 0);
			}
		});
	});

	test('se lanzan más seguido que antes', () => {
		// Lanzamientos por minuto medidos con esta misma cuenta antes del ajuste.
		[36.2, 49.0, 42.6, 53.5].forEach((before, index) => {
			let launches = 0;
			let seconds = 0;
			for (let seed = 1; seed <= 40; seed += 1) {
				const last = new Map();
				watchWave({ number: index + 1, seed }, (battle) => {
					const { enemies } = battle;
					if (!enemies.length || enemies.some((enemy) => enemy.state === 'waiting' || enemy.state === 'entering')) return;
					seconds += STEP;
					for (const enemy of enemies) {
						if (last.get(enemy.id) === 'formation' && enemy.state !== 'formation') launches += 1;
						last.set(enemy.id, enemy.state);
					}
				});
			}
			const rate = (launches * 60) / seconds;
			assert.ok(rate >= before * 1.15 && rate <= before * 1.7, `zona ${index + 1}: ${rate.toFixed(1)} contra ${before}`);
		});
	});

	/** Una maniobra desde cada columna contra la nave adelantada: lo más cerca que pasó y sus disparos. */
	const passes = (maneuver) => Array.from({ length: 8 }, (_, col) => {
		const battle = bench();
		// Se la pone adelante a mano: lo que se prueba es la puntería del enemigo, no el movimiento.
		battle.player.y = FIELD_H / 2;
		battle.player.invulnerable = 99;
		const enemy = battle.placeEnemy('terran', 1, col, 0);
		battle.startManeuver(enemy, maneuver);
		let nearest = Infinity;
		const shots = [];
		for (let step = 0; step < 360 && ['telegraph', 'dive', 'swoop'].includes(enemy.state); step += 1) {
			battle.events = [];
			play(battle, STEP);
			nearest = Math.min(nearest, Math.hypot(enemy.x - battle.player.x, enemy.y - battle.player.y));
			shots.push(...battle.events.filter((event) => event.type === 'enemyShot'));
		}
		return { col, nearest, shots, playerY: battle.player.y };
	});

	test('la picada busca a la nave adelantada desde cualquier columna', () => {
		for (const { col, nearest } of passes('dive')) {
			assert.ok(nearest < 45, `columna ${col}: pasó a ${nearest.toFixed(0)} px`);
		}
	});

	test('el rizo busca a la nave adelantada y dispara antes de pasarla', () => {
		for (const { col, nearest, shots, playerY } of passes('swoop')) {
			assert.ok(nearest < 45, `columna ${col}: pasó a ${nearest.toFixed(0)} px`);
			assert.ok(shots.some((shot) => shot.y < playerY - 60), `columna ${col}: no disparó antes de pasar`);
		}
	});

	test('el plantado se pone encima de la línea de la nave, atrás y adelante', () => {
		for (const ahead of [false, true]) {
			const battle = bench(2);
			if (ahead) forward(battle);
			const enemy = battle.placeEnemy('insect', 3, 1, 0);
			battle.startManeuver(enemy, 'planted');
			play(battle, 2.4);
			assert.equal(enemy.state, 'planted');
			close(enemy.y, battle.player.y - 38, 0.01, 'y');
		}
	});

	test('la carga del jefe pega en las dos puntas de la franja', () => {
		for (const ahead of [false, true]) {
			const battle = bench(2);
			if (ahead) forward(battle);
			battle.startBoss();
			Object.assign(battle.boss, { state: 'charging', y: 112, telegraph: 0.1, chargeX: battle.player.x });
			play(battle, 2.5);
			assert.ok(battle.hp < 100, ahead ? 'adelante' : 'atrás');
		}
	});

	test('el pod no cruza encima de la nave adelantada', () => {
		for (let seed = 1; seed <= 50; seed += 1) {
			const battle = zone(1, 'halcon', seed).sandbox();
			battle.startEvent('pod');
			assert.ok(battle.pods[0].y <= FIELD_H / 2 - 32, `y ${battle.pods[0].y}`);
		}
	});

	console.log('\nCápsulas');

	test('toma la cápsula que pasa pegada al costado, no la que pasa lejos', () => {
		for (const [dx, taken] of [[-40, true], [40, true], [62, false]]) {
			const battle = bench();
			battle.energy = 50;
			const { x, y } = battle.player;
			battle.pickups.push({ id: -1, x: x + dx, y: y - 60, kind: 'energy', age: 0 });
			play(battle, 2);
			assert.equal(battle.energy > 50, taken, `a ${dx} px`);
		}
	});

	test('los enemigos sueltan más que antes', () => {
		// Chance de antes, por rango, en la familia terrestre.
		for (const [rank, before] of [[1, 0.02], [2, 0.05], [3, 0.3]]) {
			const battle = bench();
			const random = seededRandom(rank);
			let drops = 0;
			const kills = 6000;
			for (let count = 0; count < kills; count += 1) {
				// Otra semilla por derribo, para medir la chance y no una racha.
				const one = new Battle(newRun('halcon'), random).sandbox();
				const enemy = one.placeEnemy(battle.zone.family, rank, 3, 0);
				enemy.hp = 1;
				one.shots.push({ id: 1, x: enemy.x, y: enemy.y, vx: 0, vy: 0, pierce: false, hits: [] });
				one.step(STEP);
				drops += one.pickups.length;
			}
			assert.ok(drops / kills > before * 1.15, `rango ${rank}: ${drops / kills} contra ${before}`);
		}
	});

	console.log('\nTramos');

	const PASSAGE_IDS = ['crossing', 'convoy', 'storm', 'combined'];
	const passage = (id, seed = 1, shipId = 'halcon') => {
		const battle = zone(PASSAGE_IDS.indexOf(id) + 1, shipId, seed).sandbox();
		battle.startPassage(id);
		return battle;
	};
	/** Juega el tramo entero con la nave inmortal; mira cada paso. */
	const watchPassage = (battle, look, drive = () => STILL) => {
		assert.equal(battle.phase, 'passage');
		let seconds = 0;
		while (battle.phase === 'passage' && seconds < 40) {
			battle.hp = 100;
			battle.player.invulnerable = 9;
			battle.setInput({ ...STILL, ...drive(battle) });
			battle.step(STEP);
			seconds += STEP;
			look(battle, seconds);
			battle.events = [];
		}
		return seconds;
	};

	test('R1 y R2: cada zona tiene su tramo entre la segunda oleada y la tercera', () => {
		ZONES.forEach((_, index) => {
			const battle = zone(index + 1);
			battle.randomEvents = false;
			const order = [];
			while (battle.time < 120 && order.length < 5) {
				battle.hp = 100;
				battle.player.invulnerable = 9;
				if (battle.phase === 'wave') battle.enemies = [];
				battle.step(STEP);
				for (const event of battle.events) {
					if (event.type === 'waveStart') order.push(event.wave);
					if (event.type === 'passageStart') order.push(event.id);
					if (event.type === 'bossSpawn') order.push('boss');
				}
				battle.events = [];
			}
			assert.deepEqual(order, [1, 2, PASSAGE_IDS[index], 3, 'boss'], `zona ${index + 1}`);
		});
	});

	test('R2: en la zona 4 las tres pasan a la vez', () => {
		let together = 0;
		watchPassage(passage('combined'), (battle) => {
			if (battle.rocks.length && battle.freighters.length && battle.strikes.length) together += STEP;
		});
		assert.ok(together > 3, `${together.toFixed(1)} s juntas`);
	});

	test('R3: los tramos duran 25 s y no traen formación', () => {
		for (const id of PASSAGE_IDS) {
			for (let seed = 1; seed <= 20; seed += 1) {
				const seconds = watchPassage(passage(id, seed), (battle) => {
					assert.ok(!battle.enemies.some((enemy) => enemy.slot), `${id}: hay formación`);
				});
				close(seconds, 25, 1, id);
			}
		}
	});

	/**
	 * Todos los lugares adonde pudo llegar la nave más lenta sin que la toquen
	 * rocas ni descargas, paso a paso. Si se vacía, el tramo no tenía salida.
	 */
	const survives = (id, seed, start) => {
		const cell = 10;
		const every = 3;
		close(SHIPS.bastion.speed * every * STEP, cell, 0.001, 'paso de la búsqueda');
		const cols = Math.floor((FIELD_W - 52) / cell) + 1;
		const rows = Math.floor((START_Y - FIELD_H / 2) / cell) + 1;
		const wander = seededRandom(seed + 999);
		// Arranca en una esquina: que exista un buen lugar donde empezar no alcanza.
		let reached = new Uint8Array(cols * rows);
		reached[[0, cols - 1, (rows - 1) * cols, rows * cols - 1][start]] = 1;
		let frame = 0;
		let input = STILL;
		let lostAt = null;
		watchPassage(passage(id, seed, 'bastion'), (battle, seconds) => {
			frame += 1;
			if (frame % every || lostAt !== null) return;
			const next = new Uint8Array(cols * rows);
			const bands = battle.strikes.filter((strike) => strike.timer <= 0);
			let any = false;
			for (let row = 0; row < rows; row += 1) for (let col = 0; col < cols; col += 1) {
				const at = row * cols + col;
				const came = reached[at] || (col && reached[at - 1]) || (col < cols - 1 && reached[at + 1])
					|| (row && reached[at - cols]) || (row < rows - 1 && reached[at + cols]);
				if (!came) continue;
				const x = 26 + col * cell;
				const y = START_Y - row * cell;
				if (battle.rocks.some((rock) => (rock.x - x) ** 2 + (rock.y - y) ** 2 < 28 ** 2)) continue;
				if (bands.some(({ axis, from, to }) => {
					const at = axis === 'x' ? x : y;
					return at > from - 11 && at < to + 11;
				})) continue;
				next[at] = 1;
				any = true;
			}
			reached = next;
			if (!any) lostAt = seconds;
		}, () => {
			// Pasea al azar: las descargas apuntan a donde esté.
			if (frame % 40 === 0) input = { move: Math.round(wander() * 2 - 1), moveY: Math.round(wander() * 2 - 1) };
			return input;
		});
		assert.equal(lostAt, null, `${id}, semilla ${seed}, esquina ${start}: sin salida a los ${lostAt?.toFixed(1)} s`);
	};

	for (const id of ['crossing', 'storm', 'combined']) {
		test(`R3 y R8: ${id} siempre tiene salida con la nave más lenta (200 semillas, desde las 4 esquinas)`, () => {
			for (let seed = 1; seed <= 200; seed += 1) for (let start = 0; start < 4; start += 1) survives(id, seed, start);
		});
	}

	test('R8: esté donde esté, la descarga le da tiempo de salir', () => {
		// Le caen justo encima: desde cada lugar, lo que tarda la más lenta hasta el más cercano libre.
		for (let x = 26; x <= FIELD_W - 26; x += 8) {
			for (let y = FIELD_H / 2; y <= START_Y; y += 8) {
				const battle = passage('storm', x * y, 'bastion');
				Object.assign(battle.player, { x, y, invulnerable: 99 });
				const first = new Map();
				for (const [axis, at, min, max] of [['x', x, 26, FIELD_W - 26], ['y', y, FIELD_H / 2, START_Y]]) {
					const bands = axis === 'x' ? battle.passage.bandsX(x) : battle.passage.bandsY(y, 2);
					let nearest = Infinity;
					for (let to = min; to <= max; to += 1) {
						if (bands.every((band) => to <= band.from - 11 || to >= band.to + 11)) nearest = Math.min(nearest, Math.abs(to - at));
					}
					first.set(axis, nearest / SHIPS.bastion.speed);
				}
				for (const [axis, seconds] of first) assert.ok(seconds <= STORM.warning - 0.25, `${axis} desde ${x},${y}: ${seconds} s`);
			}
		}
	});

	test('R4: hay muros que obligan a cambiar de altura', () => {
		for (let seed = 1; seed <= 50; seed += 1) {
			// Sin avanzar ni retroceder no se los pasa, se esté a la altura que se esté.
			const blocked = new Set();
			watchPassage(passage('crossing', seed), (battle) => {
				for (const rock of battle.rocks) {
					if (rock.vy !== 0) continue;
					for (let y = FIELD_H / 2; y <= START_Y; y += 4) if (Math.abs(rock.y - y) < 27) blocked.add(y);
				}
			});
			for (let y = FIELD_H / 2; y <= START_Y; y += 4) assert.ok(blocked.has(y), `semilla ${seed}: libre siempre en y ${y}`);
		}
	});

	test('la Travesía trae más rocas que antes, y más rápidas', () => {
		// Antes: 10 líneas por tramo, filas a 160 px/s y muros a 190.
		let lines = 0;
		for (let seed = 1; seed <= 20; seed += 1) {
			const seen = new Set();
			watchPassage(passage('crossing', seed), (battle) => {
				const fresh = battle.rocks.filter((rock) => rock.gap !== undefined && !seen.has(rock.id));
				if (fresh.length) lines += 1;
				for (const rock of fresh) {
					seen.add(rock.id);
					const speed = Math.hypot(rock.vx, rock.vy);
					assert.ok(speed >= (rock.vy ? 160 : 190) * 1.1, `${rock.vy ? 'fila' : 'muro'} a ${speed} px/s`);
				}
			});
		}
		assert.ok(lines / 20 >= 12, `${lines / 20} líneas por tramo`);
	});

	test('los muros que salen por el costado se borran', () => {
		const battle = passage('crossing');
		watchPassage(battle, () => {});
		assert.equal(battle.rocks.length, 0);
	});

	const untilFreighter = (id = 'convoy', seed = 1) => {
		const battle = passage(id, seed);
		const centred = () => battle.freighters[0]?.x > 150 && battle.freighters[0]?.x < FIELD_W - 150;
		for (let step = 0; step < 900 && !centred(); step += 1) {
			battle.player.invulnerable = 9;
			battle.step(STEP);
		}
		assert.ok(centred(), 'no pasó ningún carguero');
		return battle;
	};
	const shootFreighter = (battle, dx, pierce = false) => {
		const freighter = battle.freighters[0];
		const x = freighter.x + freighter.vx * STEP + dx;
		battle.shots.push({ id: 7000 + battle.shots.length, x, y: freighter.y + 14, vx: 0, vy: 0, pierce, hits: [] });
		battle.step(STEP);
	};

	test('R5: las escoltas acompañan a cada carguero', () => {
		const battle = untilFreighter();
		const freighter = battle.freighters[0];
		const escorts = battle.enemies.filter((enemy) => enemy.state === 'escort' && enemy.leader === freighter.id);
		assert.equal(escorts.length, 3);
		const gaps = escorts.map((enemy) => enemy.x - freighter.x);
		play(battle, 1);
		escorts.forEach((enemy, index) => close(enemy.x - freighter.x, gaps[index], 0.01, 'distancia'));
	});

	test('R5: una escolta va debajo de la bodega y frena el disparo antes que el casco', () => {
		for (const id of SHIP_IDS) {
			const battle = untilFreighter();
			const freighter = battle.freighters[0];
			const guard = battle.enemies.find((enemy) => enemy.leader === freighter.id && Math.abs(enemy.x - freighter.x) < 5);
			assert.ok(guard, 'no hay escolta debajo de la bodega');
			const { hp } = freighter;
			const speed = SHIPS[id].bulletSpeed;
			const fromY = START_Y - 20;
			battle.shots.push({ id: 7200, x: freighter.x + freighter.vx * ((fromY - freighter.y - 21) / speed), y: fromY, vx: 0, vy: -speed, pierce: false, hits: [] });
			play(battle, 1.2);
			assert.equal(freighter.hp, hp, `${id}: la bodega recibió el disparo`);
			assert.ok(guard.hp < guard.spec.hp, `${id}: la escolta no lo frenó`);
		}
	});

	test('R5: las escoltas tiran más seguido que antes', () => {
		// Antes: 9,65 salvas por convoy en promedio.
		let shots = 0;
		for (let seed = 1; seed <= 20; seed += 1) {
			watchPassage(passage('convoy', seed), (battle) => {
				shots += battle.events.filter((event) => event.type === 'enemyShot').length;
			});
		}
		assert.ok(shots / 20 >= 14, `${shots / 20} salvas por convoy`);
	});

	test('R5: las escoltas disparan, siempre con aviso', () => {
		let shots = 0;
		let aimed = new Set();
		watchPassage(passage('convoy'), (battle) => {
			for (const shot of battle.events.filter((event) => event.type === 'enemyShot')) {
				const shooter = battle.enemies.find((enemy) => enemy.x === shot.x && enemy.y + 14 === shot.y);
				assert.ok(shooter && aimed.has(shooter.id), 'disparó sin avisar');
				shots += 1;
			}
			aimed = new Set(battle.enemies.filter((enemy) => enemy.aim > 0).map((enemy) => enemy.id));
		});
		assert.ok(shots >= 3, `${shots} salvas`);
	});

	test('R5: el aviso de una escolta se ve: no apunta ni tira desde afuera de la pantalla', () => {
		for (let seed = 1; seed <= 100; seed += 1) {
			watchPassage(passage('convoy', seed), (battle) => {
				for (const enemy of battle.enemies) {
					if (enemy.aim > 0) assert.ok(enemy.x >= 0 && enemy.x <= FIELD_W, `semilla ${seed}: apunta desde x ${enemy.x}`);
				}
				for (const event of battle.events) {
					if (event.type === 'enemyShot') assert.ok(event.x >= 0 && event.x <= FIELD_W, `semilla ${seed}: tiró desde x ${event.x}`);
				}
			});
		}
	});

	test('R6: el casco frena los disparos sin recibir daño, también los que atraviesan', () => {
		for (const [dx, pierce] of [[-30, false], [30, false], [42, true]]) {
			const battle = untilFreighter();
			const { hp } = battle.freighters[0];
			shootFreighter(battle, dx, pierce);
			assert.equal(battle.freighters[0].hp, hp);
			assert.equal(battle.shots.length, 0, 'pasó de largo');
		}
	});

	test('R6: por la bodega recibe daño', () => {
		const battle = untilFreighter();
		const { hp } = battle.freighters[0];
		shootFreighter(battle, 0);
		assert.equal(battle.freighters[0].hp, hp - 1);
	});

	test('R6: un disparo adelantado desde la línea de salida llega a la bodega con cada nave', () => {
		for (const id of SHIP_IDS) {
			const battle = untilFreighter();
			battle.enemies = [];
			const { x, y, vx, hp } = battle.freighters[0];
			const speed = SHIPS[id].bulletSpeed;
			const fromY = START_Y - 20;
			battle.shots.push({ id: 7100, x: x + vx * ((fromY - y - 21) / speed), y: fromY, vx: 0, vy: -speed, pierce: false, hits: [] });
			play(battle, 1.2);
			assert.equal(battle.freighters[0].hp, hp - 1, id);
		}
	});

	test('R7: roto, siempre suelta energía y las escoltas se tiran', () => {
		for (let seed = 1; seed <= 30; seed += 1) {
			const battle = untilFreighter('convoy', seed);
			const freighter = battle.freighters[0];
			const escorts = battle.enemies.filter((enemy) => enemy.leader === freighter.id);
			for (let hit = 0; hit < 20 && battle.freighters.includes(freighter); hit += 1) shootFreighter(battle, 0);
			const capsule = battle.pickups.find((pickup) => pickup.kind === 'energy');
			assert.ok(capsule, 'no soltó energía');
			play(battle, 0.1);
			for (const enemy of escorts) assert.equal(enemy.state, 'telegraph');
			battle.energy = 20;
			Object.assign(capsule, { x: battle.player.x, y: battle.player.y });
			play(battle, STEP);
			assert.ok(battle.energy > 25, `energía ${battle.energy}`);
		}
	});

	test('R8: ninguna descarga cae sin 1,2 s de aviso', () => {
		for (const id of ['storm', 'combined']) {
			const seen = new Map();
			let fired = 0;
			watchPassage(passage(id), (battle, seconds) => {
				for (const strike of battle.strikes) {
					if (!seen.has(strike.id)) seen.set(strike.id, { at: seconds, fired: false });
					const first = seen.get(strike.id);
					if (strike.timer > 0 || first.fired) continue;
					first.fired = true;
					fired += 1;
					assert.ok(seconds - first.at >= 1.2, `${id}: avisó ${seconds - first.at} s`);
				}
			});
			assert.ok(fired >= 5, `${id}: ${fired} descargas`);
		}
	});

	test('R8: las franjas van de arriba abajo y de lado a lado', () => {
		const axes = new Set();
		watchPassage(passage('storm'), (battle) => battle.strikes.forEach((strike) => axes.add(strike.axis)));
		assert.deepEqual([...axes].sort(), ['x', 'y']);
	});

	/** Una descarga encima de la nave, a punto de caer. */
	const struck = (setup = () => {}) => {
		const battle = passage('storm');
		battle.energy = 50;
		const { x } = battle.player;
		battle.strikes = [{ id: 8000, axis: 'x', from: x - 40, to: x + 40, timer: 0.01, resolved: false }];
		setup(battle);
		return battle;
	};

	test('R8: sin escudo la descarga lastima', () => {
		const battle = play(struck(), 0.2);
		close(battle.hp, 100 - DAMAGE.storm, 0.01, 'vida');
	});

	test('R9: bloquearla devuelve energía, una vez', () => {
		for (const blinking of [false, true]) {
			const battle = struck((one) => { if (blinking) one.player.invulnerable = 2; });
			play(battle, 0.05, { shield: true });
			const gained = battle.energy;
			assert.ok(gained > 53, `energía ${gained}`);
			assert.equal(battle.hp, 100);
			play(battle, 0.15, { shield: true });
			assert.ok(battle.energy <= gained, 'pagó dos veces');
		}
	});

	test('R9: no pasa de 100', () => {
		const battle = play(struck((one) => { one.energy = 99; }), 0.1, { shield: true });
		assert.ok(battle.energy > 99 && battle.energy <= 100, `energía ${battle.energy}`);
	});

	test('R10: el escudo fijo no alcanza para todas; en el momento justo, sí', () => {
		const count = (style) => {
			let blocks = 0;
			const battle = passage('storm');
			watchPassage(battle, () => {
				blocks += battle.events.filter((event) => event.type === 'stormBlock').length;
			}, () => {
				const { x, y } = battle.player;
				const due = battle.strikes.some(({ axis, from, to, timer }) => {
					const at = axis === 'x' ? x : y;
					return timer < 0.1 && timer > -0.15 && at > from - 11 && at < to + 11;
				});
				return { shield: style === 'fijo' || due };
			});
			return blocks;
		};
		const held = count('fijo');
		const timed = count('justo');
		assert.ok(held > 0 && timed >= held * 2, `fijo ${held}, justo ${timed}`);
	});

	test('D1: en un tramo el reloj no corre ni drena, pero disparar se cobra', () => {
		const idle = passage('crossing');
		idle.player.invulnerable = 99;
		play(idle, 4);
		assert.equal(idle.energy, 100);
		const firing = passage('crossing');
		firing.player.invulnerable = 99;
		play(firing, 4, { fire: true });
		close(100 - firing.energy, (400 / ZONES[0].energySeconds) * 0.75, 0.1, 'disparo');
		const empty = passage('crossing');
		empty.player.invulnerable = 99;
		empty.energy = 0;
		play(empty, 4);
		assert.equal(empty.hp, 100);
	});

	test('D1: tampoco corre en la pausa de antes ni en la de después', () => {
		for (const pendingPassage of ['crossing', null]) {
			const battle = zone(1);
			battle.randomEvents = false;
			Object.assign(battle, { wave: 1, phase: 'interlude', phaseTimer: 2, pendingPassage });
			play(battle, 1.5);
			assert.equal(battle.energy, 100, pendingPassage ?? 'después');
		}
		const between = zone(1);
		between.randomEvents = false;
		Object.assign(between, { wave: 0, phase: 'interlude', phaseTimer: 2 });
		play(between, 1.5);
		assert.ok(between.energy < 99, 'entre las otras oleadas sí corre');
	});

	test('D2: la tormenta asegura carga de escudo, sin sumarle a la que sobra', () => {
		for (const id of ['storm', 'combined']) assert.equal(passage(id).player.shield, 8, id);
		const full = zone(3).sandbox();
		full.player.shield = 20;
		full.startPassage('storm');
		assert.equal(full.player.shield, 20);
		assert.equal(passage('crossing').player.shield, 0);
	});

	test('D3: el tramo espera a que se vayan las rocas y los cometas de antes', () => {
		for (const hazard of ['rocks', 'comets']) {
			const battle = zone(1);
			battle.randomEvents = false;
			Object.assign(battle, { wave: 1, phase: 'interlude', phaseTimer: 0.02 });
			battle.player.invulnerable = 99;
			battle[hazard].push({ id: 8100, x: 100, y: 300, vx: 0, vy: 150, hp: 3, spin: 0, angle: 0, frame: 1, flash: 0 });
			play(battle, 1);
			assert.equal(battle.phase, 'interlude', hazard);
			play(battle, 2);
			assert.equal(battle.phase, 'passage', hazard);
		}
	});
} catch (error) {
	failed += 1;
	console.error(`  FALLA  carga de módulos\n         ${error.message}`);
} finally {
	await server.close();
}

console.log(failed ? `\n${failed} fallaron` : '\nTodo en verde');
process.exitCode = failed ? 1 : 0;
