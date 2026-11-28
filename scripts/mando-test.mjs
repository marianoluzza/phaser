import { openArcade } from './arcade-driver.mjs';

/**
 * Cada juego jugado con el mando de prueba del driver, sin teclado (ver
 * docs/tareas/mando.md). Mira efectos observables: la escena activa y el
 * estado de la partida.
 *
 *   npm run test:mando            todos los juegos que ya tienen mando
 *   npm run test:mando -- socavon sólo uno
 */
/** Socavón es la anteúltima ficha: dos a la izquierda de la primera. */
async function openSocavon(arcade) {
	await arcade.waitForScene('core:launcher');
	await arcade.padPress('left', 2);
	await arcade.padPress('a');
	await arcade.waitForScene('socavon:title');
}

const TESTS = {
	launcher: async (arcade) => {
		const { page } = arcade;
		const selected = () => page.evaluate(() => window.arcade.scene.getScene('core:launcher').selectedGameIndex);
		const check = (what, actual, expected) => {
			if (actual !== expected) throw new Error(`Launcher: ${what} = ${actual}, se esperaba ${expected}`);
		};
		await arcade.waitForScene('core:launcher');
		check('ficha inicial', await selected(), 0);
		await arcade.padPress('right');
		check('ficha tras la cruceta', await selected(), 1);
		await arcade.padStick(-1, 0);
		await page.waitForTimeout(150);
		await arcade.padStick(0, 0);
		await page.waitForTimeout(150);
		check('ficha tras el stick', await selected(), 0);
		// La primera ficha es Tetris.
		await arcade.padPress('start');
		await arcade.waitForScene('tetris:title');
		await page.evaluate(() => window.arcade.scene.getScenes(true)[0].scene.start('core:launcher'));
		await arcade.waitForScene('core:launcher');
		await openSocavon(arcade);
	},

	tetris: async (arcade) => {
		const { page } = arcade;
		const game = "window.arcade.scene.getScene('tetris:game')";
		const read = (expression) => page.evaluate(expression);
		const check = (what, actual, expected) => {
			if (actual !== expected) throw new Error(`Tetris: ${what} = ${actual}, se esperaba ${expected}`);
		};
		const startGameOver = () => page.evaluate(() => window.arcade.scene.getScene('tetris:game')
			.scene.start('tetris:game-over', { score: 100, lines: 2, level: 1 }));

		// La primera ficha del launcher. El A que la abre no arranca la partida.
		await arcade.padDown('a');
		await arcade.waitForScene('tetris:title');
		await page.waitForTimeout(300);
		check('escena con A todavía apretado', await arcade.sceneKey(), 'tetris:title');
		await arcade.padUp('a');
		await arcade.padPress('a');
		await arcade.waitForScene('tetris:game');

		// Una T recién puesta arriba, para que rotar se note.
		const freshT = () => page.evaluate(() => {
			const scene = window.arcade.scene.getScene('tetris:game');
			const piece = new scene.currentPiece.constructor('T');
			scene.currentPiece = piece;
			scene.gravityTimer = 0;
			scene.renderPiece();
		});
		await freshT();
		const x = () => read(`${game}.currentPiece.x`);
		const startX = await x();
		await arcade.padPress('right');
		check('x tras la cruceta', await x(), startX + 1);
		await arcade.padStick(-1, 0);
		await page.waitForTimeout(100);
		await arcade.padStick(0, 0);
		await page.waitForTimeout(150);
		check('x tras el stick', await x(), startX);

		// Rotar con B y con la cruceta hacia arriba.
		const shape = () => read(`JSON.stringify(${game}.currentPiece.shape)`);
		const flat = await shape();
		await arcade.padPress('b');
		const turned = await shape();
		check('rota con B', turned !== flat, true);
		await arcade.padPress('up');
		check('rota con ↑', (await shape()) !== turned, true);

		// Abajo baja rápido; A la deja caer de una.
		await freshT();
		await arcade.padDown('down');
		await page.waitForTimeout(400);
		await arcade.padUp('down');
		check('baja con la cruceta', (await read(`${game}.currentPiece.y`)) >= 3, true);
		await page.evaluate(() => { window.__piece = window.arcade.scene.getScene('tetris:game').currentPiece; });
		await arcade.padPress('a');
		check('A la deja caer y sale otra', await read(`${game}.currentPiece !== window.__piece`), true);

		// Start pausa y despausa; Select vuelve al título.
		await arcade.padPress('start');
		check('pausa con Start', await read(`${game}.paused`), true);
		await arcade.padPress('start');
		check('sigue con Start', await read(`${game}.paused`), false);
		await arcade.padPress('select');
		await arcade.waitForScene('tetris:title');

		// Fin: A juega otra vez, Y va al título, B al arcade. B en el título también.
		await arcade.padPress('a');
		await arcade.waitForScene('tetris:game');
		await startGameOver();
		await arcade.waitForScene('tetris:game-over');
		await arcade.padPress('a');
		await arcade.waitForScene('tetris:game');
		await startGameOver();
		await arcade.waitForScene('tetris:game-over');
		await arcade.padPress('y');
		await arcade.waitForScene('tetris:title');
		await arcade.padPress('a');
		await arcade.waitForScene('tetris:game');
		await startGameOver();
		await arcade.waitForScene('tetris:game-over');
		await arcade.padPress('b');
		await arcade.waitForScene('core:launcher');
		await arcade.padPress('a');
		await arcade.waitForScene('tetris:title');
		await arcade.padPress('b');
		await arcade.waitForScene('core:launcher');
	},

	/**
	 * El Truco usa A, S y D para elegir carta: con él, WASD no son direcciones.
	 * El mando sí navega el foco, juega, responde y dice el tanto.
	 */
	truco: async (arcade) => {
		const { page } = arcade;
		const scene = "window.arcade.scene.getScene('truco:game')";
		const read = (expression) => page.evaluate(expression);
		const check = (what, actual, expected) => {
			if (actual !== expected) throw new Error(`Truco: ${what} = ${actual}, se esperaba ${expected}`);
		};
		const focused = () => read(`${scene}.focus.focusedId`);
		const points = () => read(`${scene}.pendingEnvidoPoints`);
		const declaring = () => read(`${scene}.declaringEnvido`);
		// El rival cantó envido y el jugador, que es mano, tiene que contestar.
		const answerEnvido = async () => {
			await page.evaluate(() => {
				const game = window.arcade.scene.getScene('truco:game');
				Object.assign(game, { envidoChain: ['envido'], envidoAwaiting: 'player', envidoResolved: false });
				game.renderState();
				game.focus.focus('action:want');
			});
			await arcade.padPress('a');
			check('cuadro del tanto tras A en «Quiero»', await declaring(), true);
		};

		await page.evaluate(() => localStorage.removeItem('truco.aiProfile'));
		await arcade.padPress('right');
		await arcade.padPress('a');
		await arcade.waitForScene('truco:title');

		// Título: D no cambia de rival; la cruceta y el stick, sí.
		const rival = () => read("window.arcade.scene.getScene('truco:title').choiceName.text");
		const first = await rival();
		await arcade.press('d');
		check('rival tras D', await rival(), first);
		await arcade.padPress('right');
		check('rival tras la cruceta', (await rival()) !== first, true);
		await arcade.padStick(-1, 0);
		await page.waitForTimeout(150);
		await arcade.padStick(0, 0);
		await page.waitForTimeout(150);
		check('rival tras el stick', await rival(), first);

		await arcade.padPress('a');
		await arcade.waitForScene('truco:game');
		await page.waitForFunction(() => window.arcade.scene.getScene('truco:game').canPlayCard());

		// El tanto con la cruceta: ↑ arranca en 20, ↓ baja y saltea 8 a 19.
		await answerEnvido();
		await arcade.padPress('up', 2);
		check('tanto tras ↑ ↑', await points(), '21');
		await arcade.padPress('down', 2);
		check('tanto tras ↓ ↓', await points(), '7');
		await arcade.padPress('b');
		check('B cierra el cuadro', await declaring(), false);

		// Cuando el rival ya dijo el suyo, el botón de abajo es «son buenas» y B lo aprieta.
		await page.evaluate(() => { window.arcade.scene.getScene('truco:game').aiDeclaredEnvido = 27; });
		await answerEnvido();
		await arcade.padPress('b');
		check('B dice «son buenas»', await declaring(), false);
		check('envido resuelto', await read(`${scene}.envidoResolved`), true);

		// Cartas: la cruceta mueve el foco, la letra D sigue eligiendo la tercera y A la juega.
		await page.evaluate(() => window.arcade.scene.getScene('truco:game').focus.focus(null));
		await page.evaluate(() => {
			const game = window.arcade.scene.getScene('truco:game');
			game.focus.focus(`card:${game.playerHand[1].id}`);
		});
		await arcade.padPress('left');
		check('foco tras ←', await focused(), await read(`'card:' + ${scene}.playerHand[0].id`));
		await arcade.press('d');
		check('foco tras la letra D', await focused(), await read(`'card:' + ${scene}.playerHand[2].id`));
		await arcade.padPress('a');
		check('cartas tras A', await read(`${scene}.playerHand.length`), 2);

		// Select sale al arcade; B en el título, también.
		await arcade.padPress('select');
		await arcade.waitForScene('core:launcher');
		await arcade.padPress('right');
		await arcade.padPress('a');
		await arcade.waitForScene('truco:title');
		await arcade.padPress('b');
		await arcade.waitForScene('core:launcher');
	},

	pipes: async (arcade) => {
		const { page } = arcade;
		const game = "window.arcade.scene.getScene('pipes:game')";
		const read = (expression) => page.evaluate(expression);
		const check = (what, actual, expected) => {
			if (actual !== expected) throw new Error(`Pipes: ${what} = ${actual}, se esperaba ${expected}`);
		};
		const roundEnd = async (cleared) => {
			await page.evaluate((cleared) => window.arcade.scene.getScenes(true)[0].scene.start('pipes:round-end', {
				level: 3, score: 900, segments: 12, goal: 10, cleared,
			}), cleared);
			await arcade.waitForScene('pipes:round-end');
		};

		await arcade.padPress('right', 2);
		await arcade.padPress('a');
		await arcade.waitForScene('pipes:title');

		// Y abre la configuración: abajo la recorre y B vuelve.
		await arcade.padPress('y');
		await arcade.waitForScene('pipes:config');
		await arcade.padDown('down');
		await page.waitForTimeout(400);
		await arcade.padUp('down');
		check('la configuración baja', (await read("window.arcade.scene.getScene('pipes:config').scrollY")) > 0, true);
		await arcade.padPress('b');
		await arcade.waitForScene('pipes:title');

		// Partida: cursor con la cruceta y el stick, A coloca, Y reinicia, B larga el agua.
		await arcade.padPress('a');
		await arcade.waitForScene('pipes:game');
		const cursor = () => read(`[${game}.cursorColumn, ${game}.cursorRow].join(',')`);
		const [column, row] = (await cursor()).split(',').map(Number);
		await arcade.padPress('right');
		await arcade.padStick(0, 1);
		await page.waitForTimeout(150);
		await arcade.padStick(0, 0);
		await page.waitForTimeout(150);
		check('cursor', await cursor(), `${column + 1},${row + 1}`);
		await arcade.padPress('a');
		check('piezas tras A', await read(`${game}.board.placedCount`), 1);
		await arcade.padPress('y');
		await page.waitForTimeout(300);
		check('piezas tras Y', await read(`${game}.board.placedCount`), 0);
		await arcade.padPress('b');
		check('cuenta tras B', await read(`${game}.countdownRemaining`), 0);

		// Fin del nivel: A sigue (o empieza de nuevo), Y al título, B al arcade.
		await roundEnd(true);
		await arcade.padPress('a');
		await arcade.waitForScene('pipes:game');
		check('nivel tras superar', await read(`${game}.setup.level`), 4);
		await roundEnd(false);
		await arcade.padPress('a');
		await arcade.waitForScene('pipes:game');
		check('nivel tras perder', await read(`${game}.setup.level`), 1);
		await roundEnd(false);
		await arcade.padPress('y');
		await arcade.waitForScene('pipes:title');
		await arcade.padPress('a');
		await arcade.waitForScene('pipes:game');
		await roundEnd(true);
		await arcade.padPress('b');
		await arcade.waitForScene('core:launcher');

		// Select sale de la partida al título y B del título al arcade.
		await arcade.padPress('right', 2);
		await arcade.padPress('a');
		await arcade.waitForScene('pipes:title');
		await arcade.padPress('a');
		await arcade.waitForScene('pipes:game');
		await arcade.padPress('select');
		await arcade.waitForScene('pipes:title');
		await arcade.padPress('b');
		await arcade.waitForScene('core:launcher');
	},

	'astro-chess': async (arcade) => {
		const { page } = arcade;
		const scene = (key) => `window.arcade.scene.getScene('${key}')`;
		const read = (expression) => page.evaluate(expression);
		const check = (what, actual, expected) => {
			if (actual !== expected) throw new Error(`Astro Chess: ${what} = ${actual}, se esperaba ${expected}`);
		};
		const stick = async (x, y) => {
			await arcade.padStick(x, y);
			await page.waitForTimeout(150);
			await arcade.padStick(0, 0);
			await page.waitForTimeout(150);
		};

		// La cuarta ficha del launcher.
		await arcade.padPress('right', 3);
		await arcade.padPress('a');
		await arcade.waitForScene('astro:title');

		// Ayuda: Y la abre, ← → cambian de página, ↑ ↓ eligen, B vuelve.
		const help = scene('astro:help');
		await arcade.padPress('y');
		await arcade.waitForScene('astro:help');
		await arcade.padPress('right');
		await page.waitForTimeout(200);
		check('página tras la cruceta', await read(`${help}.page`), 'crew');
		await stick(0, 1);
		check('pieza tras el stick', await read(`${help}.choice`), 1);
		await stick(-1, 0);
		await page.waitForTimeout(200);
		check('página tras el stick', await read(`${help}.page`), 'ship');
		await arcade.padPress('b');
		await arcade.waitForScene('astro:title');

		// Puestos: A levanta, B suelta, y con la mano vacía B vuelve al título.
		const ship = scene('astro:ship');
		const held = () => read(`${ship}.board.selectedMemberId !== null`);
		const unassigned = () => read(`${ship}.ship.unassigned(${ship}.crew).length`);
		await arcade.padPress('a');
		await arcade.waitForScene('astro:ship');
		await arcade.padPress('a');
		check('pieza en la mano tras A', await held(), true);
		await arcade.padPress('b');
		check('pieza en la mano tras B', await held(), false);
		check('escena tras soltar con B', await arcade.sceneKey(), 'astro:ship');
		await arcade.padPress('b');
		await arcade.waitForScene('astro:title');
		await arcade.padPress('a');
		await arcade.waitForScene('astro:ship');

		// A levanta de la reserva, arriba va a un puesto y A lo deja ahí.
		const free = await unassigned();
		await arcade.padPress('a');
		await arcade.padPress('up');
		await arcade.padPress('a');
		check('reserva tras poner una pieza', await unassigned(), free - 1);
		check('pieza en la mano tras dejarla', await held(), false);

		// Start va al combate; sin armería, el primero avisa y el segundo confirma.
		const toCombat = async () => {
			await arcade.padPress('start');
			if ((await arcade.sceneKey()) === 'astro:ship') {
				check('aviso sin armería', await read(`${ship}.confirmedNoWeapons`), true);
				await arcade.padPress('start');
			}
			await arcade.waitForScene('astro:combat');
		};
		// Un reparto con puente y armería, para que en el combate haya movimientos.
		await page.evaluate(() => {
			const scene = window.arcade.scene.getScene('astro:ship');
			const [bridge, gunner, gunner2, shields] = scene.crew.all().map((member) => member.id);
			scene.scene.restart({ layout: [
				{ ref: { room: 'bridge', slot: 0 }, memberId: bridge },
				{ ref: { room: 'weapons', slot: 0 }, memberId: gunner },
				{ ref: { room: 'weapons', slot: 1 }, memberId: gunner2 },
				{ ref: { room: 'shields', slot: 0 }, memberId: shields },
			] });
		});
		await page.waitForTimeout(300);
		await arcade.waitForScene('astro:ship');
		await toCombat();

		// Combate: A levanta, B suelta sin salir, Start cuenta la ronda y la saltea.
		const combat = scene('astro:combat');
		const combatHeld = () => read(`${combat}.board.selectedMemberId !== null`);
		await arcade.padPress('a');
		check('pieza en la mano en el combate', await combatHeld(), true);
		await arcade.padPress('b');
		check('pieza tras B en el combate', await combatHeld(), false);
		check('escena tras B en el combate', await arcade.sceneKey(), 'astro:combat');
		await arcade.padPress('start');
		check('rondas tras Start', await read(`${combat}.combat.history.length`), 1);
		check('cuenta en curso', await read(`${combat}.playing`), true);
		await arcade.padPress('start');
		check('cuenta salteada', await read(`${combat}.playing`), false);

		// R1 y L1 recorren la bitácora.
		await arcade.padPress('start', 4);
		const scroll = () => read(`${combat}.logScroll`);
		const room = await read(`${combat}.logContentHeight - 160`);
		check('hay bitácora para recorrer', room > 0, true);
		await arcade.padPress('r1');
		check('bitácora tras R1', (await scroll()) > 0, true);
		await arcade.padPress('l1');
		check('bitácora tras L1', await scroll(), 0);

		// Hasta el final: el cartel se acepta con A, que reintenta.
		const outcome = () => read(`${combat}.combat.outcome`);
		for (let round = 0; round < 30 && (await outcome()) === 'ongoing'; round += 1) {
			await arcade.padPress('start', 2);
		}
		check('combate terminado', (await outcome()) !== 'ongoing', true);
		await page.waitForTimeout(400);
		await arcade.padPress('a');
		await arcade.waitForScene('astro:ship');

		// El cartel también se cierra con B, hacia el título.
		await toCombat();
		await page.evaluate(() => {
			const scene = window.arcade.scene.getScene('astro:combat');
			scene.combat.outcome = 'lost';
			scene.showOutcome();
		});
		await arcade.padPress('b');
		await arcade.waitForScene('astro:title');

		// Select sale del combate al título y B del título al arcade.
		await arcade.padPress('a');
		await arcade.waitForScene('astro:ship');
		await toCombat();
		await arcade.padPress('select');
		await arcade.waitForScene('astro:title');
		await arcade.padPress('b');
		await arcade.waitForScene('core:launcher');
	},

	traffic: async (arcade) => {
		const { page } = arcade;
		const read = (expression) => page.evaluate(expression);
		const check = (what, actual, expected) => {
			if (actual !== expected) throw new Error(`Semáforos: ${what} = ${actual}, se esperaba ${expected}`);
		};
		const openTraffic = async () => {
			await arcade.padPress('right', 5);
			await arcade.padPress('a');
			await arcade.waitForScene('traffic:title');
		};
		/** El semáforo de cada lado de la pantalla, como N:red,E:green,... */
		const lights = () => read(`(() => {
			const scene = window.arcade.scene.getScene('traffic:game');
			return ['N', 'E', 'S', 'W']
				.map((arm) => arm + ':' + scene.traffic.lights[scene.anchors.find((a) => a.arm === arm).lightId])
				.join(',');
		})()`);
		const gameOver = async () => {
			await page.evaluate(() => {
				const scene = window.arcade.scene.getScene('traffic:game');
				scene.scene.start('traffic:over', { score: 120, time: 45, stats: scene.traffic.stats });
			});
			await arcade.waitForScene('traffic:over');
		};

		// La sexta ficha. A en el título arranca la partida.
		await openTraffic();
		await arcade.padPress('a');
		await arcade.waitForScene('traffic:game');
		check('al empezar', await lights(), 'N:red,E:red,S:red,W:red');

		// La cruceta cambia el semáforo de ese lado.
		await arcade.padPress('up');
		await arcade.padPress('right');
		check('tras ↑ y →', await lights(), 'N:green,E:green,S:red,W:red');

		// El stick en diagonal cuenta sólo su eje más inclinado: acá, la derecha.
		await arcade.padStick(0.8, -0.6);
		await page.waitForTimeout(150);
		await arcade.padStick(0, 0);
		await page.waitForTimeout(150);
		check('tras el stick en diagonal', await lights(), 'N:green,E:red,S:red,W:red');
		await arcade.padStick(0, 1);
		await page.waitForTimeout(150);
		await arcade.padStick(0, 0);
		await page.waitForTimeout(150);
		await arcade.padPress('left');
		check('tras el stick abajo y ←', await lights(), 'N:green,E:red,S:green,W:green');

		// Ni A ni B ni Start salen de la partida; Select vuelve al título.
		await arcade.padPress('a');
		await arcade.padPress('b');
		await arcade.padPress('start');
		check('escena tras A, B y Start', await arcade.sceneKey(), 'traffic:game');
		await arcade.padPress('select');
		await arcade.waitForScene('traffic:title');

		// Fin de partida: A juega de nuevo, Y al título, B al arcade.
		await arcade.padPress('a');
		await arcade.waitForScene('traffic:game');
		await gameOver();
		await arcade.padPress('a');
		await arcade.waitForScene('traffic:game');
		await gameOver();
		await arcade.padPress('y');
		await arcade.waitForScene('traffic:title');
		await arcade.padPress('a');
		await arcade.waitForScene('traffic:game');
		await gameOver();
		await arcade.padPress('b');
		await arcade.waitForScene('core:launcher');

		// B en el título también vuelve al arcade.
		await openTraffic();
		await arcade.padPress('b');
		await arcade.waitForScene('core:launcher');
	},

	jukebox: async (arcade) => {
		const { page } = arcade;
		const jukebox = "window.arcade.scene.getScene('jukebox:main')";
		const read = (expression) => page.evaluate(expression);
		const check = (what, actual, expected) => {
			if (actual !== expected) throw new Error(`Jukebox: ${what} = ${actual}, se esperaba ${expected}`);
		};
		const openJukebox = async () => {
			await arcade.padPress('left');
			await arcade.padPress('a');
			await arcade.waitForScene('jukebox:main');
		};

		// La última ficha: una a la izquierda de la primera.
		await openJukebox();
		// Oír y parar se espían para no descargar audio de R2 en la prueba.
		await page.evaluate(() => {
			const scene = window.arcade.scene.getScene('jukebox:main');
			scene.calls = [];
			scene.playSelectedAsset = () => scene.calls.push('play');
			scene.stopMusic = () => scene.calls.push('stop');
		});
		const calls = () => read(`${jukebox}.calls.join(',')`);
		const selected = () => read(`${jukebox}.selectedIndex`);

		// ↑ ↓ eligen, con la cruceta y con el stick; ← → cambian de página.
		await arcade.padPress('down');
		check('fila tras ↓', await selected(), 1);
		await arcade.padStick(0, 1);
		await page.waitForTimeout(150);
		await arcade.padStick(0, 0);
		await page.waitForTimeout(150);
		check('fila tras el stick', await selected(), 2);
		await arcade.padPress('up');
		check('fila tras ↑', await selected(), 1);
		await arcade.padPress('right');
		check('página tras →', await read(`${jukebox}.currentPage`), 1);
		await arcade.padPress('left');
		check('página tras ←', await read(`${jukebox}.currentPage`), 0);

		// R1 y L1 cambian entre música y efectos.
		await arcade.padPress('r1');
		check('pestaña tras R1', await read(`${jukebox}.activeKind`), 'sfx');
		await arcade.padPress('l1');
		check('pestaña tras L1', await read(`${jukebox}.activeKind`), 'music');

		// A oye, X para.
		await arcade.padPress('a');
		await arcade.padPress('x');
		check('acciones', await calls(), 'play,stop');

		// B vuelve al arcade, y Select también.
		await arcade.padPress('b');
		await arcade.waitForScene('core:launcher');
		await openJukebox();
		await arcade.padPress('select');
		await arcade.waitForScene('core:launcher');
	},

	galactica: async (arcade) => {
		const { page } = arcade;
		const scene = (key) => `window.arcade.scene.getScene('${key}')`;
		const read = (expression) => page.evaluate(expression);
		const check = (what, actual, expected) => {
			if (actual !== expected) throw new Error(`Galáctica: ${what} = ${actual}, se esperaba ${expected}`);
		};
		const stick = async (x, y) => {
			await arcade.padStick(x, y);
			await page.waitForTimeout(150);
			await arcade.padStick(0, 0);
			await page.waitForTimeout(150);
		};
		const openGalactica = async () => {
			await arcade.padPress('right', 6);
			await arcade.padPress('a');
			await arcade.waitForScene('galactica:title');
		};
		const gameOver = async () => {
			await page.evaluate(() => {
				const game = window.arcade.scene.getScene('galactica:game');
				const { battle } = game;
				game.scene.start('galactica:result', {
					outcome: 'gameOver', zone: 1, shipId: 'halcon', stage: battle.stage, score: 50, hp: 0,
					energy: battle.energy, stats: battle.stats, bonus: 0, next: battle.nextRun(),
				});
			});
			await arcade.waitForScene('galactica:result');
		};

		// La séptima ficha. En el hangar la cruceta y el stick cambian de nave.
		await openGalactica();
		const ship = () => read(`${scene('galactica:title')}.selected`);
		const first = await ship();
		await arcade.padPress('right');
		check('nave tras →', (await ship()) !== first, true);
		await stick(-1, 0);
		check('nave tras el stick', await ship(), first);

		// Galactopedia: Y la abre, ← → pasan página, ↑ ↓ eligen, B vuelve.
		const pedia = scene('galactica:pedia');
		await arcade.padPress('y');
		await arcade.waitForScene('galactica:pedia');
		const firstPage = await read(`${pedia}.page`);
		await arcade.padPress('right');
		await page.waitForTimeout(200);
		check('página tras →', (await read(`${pedia}.page`)) !== firstPage, true);
		await stick(0, 1);
		check('elección tras el stick', await read(`${pedia}.choice`), 1);
		await arcade.padPress('left');
		await page.waitForTimeout(200);
		check('página tras ←', await read(`${pedia}.page`), firstPage);
		await arcade.padPress('b');
		await arcade.waitForScene('galactica:title');

		// A despega.
		await arcade.padPress('a');
		await arcade.waitForScene('galactica:game');
		const input = (field) => read(`${scene('galactica:game')}.battle.input.${field}`);

		// El stick en diagonal mueve en los dos ejes: para moverse no cuenta sólo el dominante.
		await arcade.padStick(-0.8, -0.7);
		await page.waitForTimeout(150);
		check('movimiento x con el stick en diagonal', await input('move'), -1);
		check('movimiento y con el stick en diagonal', await input('moveY'), -1);
		await arcade.padStick(0, 0);
		await arcade.padDown('right');
		await page.waitForTimeout(150);
		check('movimiento con la cruceta', await input('move'), 1);
		await arcade.padUp('right');

		// A dispara y X prende el escudo, mientras se mantengan; B no sale.
		await arcade.padDown('a');
		await page.waitForTimeout(150);
		check('disparo con A', await input('fire'), true);
		await arcade.padUp('a');
		check('disparo al soltar A', await input('fire'), false);
		await arcade.padDown('x');
		await page.waitForTimeout(150);
		check('escudo con X', await input('shield'), true);
		await arcade.padUp('x');
		await arcade.padPress('b');
		check('escena tras B', await arcade.sceneKey(), 'galactica:game');

		// Start pausa y sigue; Select vuelve al título.
		const paused = () => read(`${scene('galactica:game')}.paused`);
		await arcade.padPress('start');
		check('pausa con Start', await paused(), true);
		await arcade.padPress('start');
		check('sigue con Start', await paused(), false);
		await arcade.padPress('select');
		await arcade.waitForScene('galactica:title');

		// Resultado: A juega de nuevo, Y al título, B al arcade.
		await arcade.padPress('a');
		await arcade.waitForScene('galactica:game');
		await gameOver();
		await arcade.padPress('a');
		await arcade.waitForScene('galactica:game');
		check('zona tras jugar de nuevo', await read(`${scene('galactica:game')}.battle.zoneNumber`), 1);
		await gameOver();
		await arcade.padPress('y');
		await arcade.waitForScene('galactica:title');
		await arcade.padPress('a');
		await arcade.waitForScene('galactica:game');
		await gameOver();
		await arcade.padPress('b');
		await arcade.waitForScene('core:launcher');

		// B en el título también vuelve al arcade.
		await openGalactica();
		await arcade.padPress('b');
		await arcade.waitForScene('core:launcher');
	},

	socavon: async (arcade) => {
		const { page } = arcade;
		const scene = (key) => `window.arcade.scene.getScene('${key}')`;
		const read = (expression) => page.evaluate(expression);
		const check = (what, actual, expected) => {
			if (actual !== expected) throw new Error(`Socavón: ${what} = ${actual}, se esperaba ${expected}`);
		};
		const startResult = () => page.evaluate(() => window.arcade.scene.getScene('socavon:game')
			.scene.start('socavon:result', { run: { seed: 7, campaign: true, depth: 2, score: 120, lives: 0 } }));

		await openSocavon(arcade);

		// Título: la cruceta y el stick cambian el modo; Y pide otra semilla.
		const mode = () => read(`${scene('socavon:title')}.modeText.text`);
		const seed = () => read(`${scene('socavon:title')}.seedText.text`);
		const campaign = await mode();
		await arcade.padPress('right');
		check('modo tras la cruceta', (await mode()) !== campaign, true);
		const firstSeed = await seed();
		await arcade.padPress('y');
		check('semilla tras Y', (await seed()) !== firstSeed, true);
		await arcade.padStick(-1, 0);
		await page.waitForTimeout(150);
		await arcade.padStick(0, 0);
		await page.waitForTimeout(150);
		check('modo tras el stick', await mode(), campaign);

		// Start entra a la mina; seguir apretándolo no pausa la partida nueva.
		await arcade.padDown('start');
		await arcade.waitForScene('socavon:game');
		await page.waitForTimeout(300);
		check('pausa con Start todavía apretado', await read(`${scene('socavon:game')}.paused`), false);
		await arcade.padUp('start');
		await page.evaluate(() => {
			const { mine } = window.arcade.scene.getScene('socavon:game');
			mine.threats = false;
			for (const guard of mine.guards) Object.assign(guard, { x: guard.home.x, y: guard.home.y, moving: false });
		});

		// Moverse con el stick y con la cruceta.
		const x = () => read(`${scene('socavon:game')}.mine.player.x`);
		const before = await x();
		await arcade.padStick(1, 0);
		await page.waitForTimeout(400);
		await arcade.padStick(0, 0);
		const afterStick = await x();
		check('avanza con el stick', afterStick > before, true);
		await arcade.padDown('left');
		await page.waitForTimeout(300);
		await arcade.padUp('left');
		check('vuelve con la cruceta', (await x()) < afterStick, true);

		// X prende y apaga la linterna del casco.
		const headlamp = () => read(`${scene('socavon:game')}.mine.player.headlamp`);
		const lit = await headlamp();
		await arcade.padPress('x');
		check('linterna tras X', await headlamp(), !lit);

		// Start pausa y despausa.
		const paused = () => read(`${scene('socavon:game')}.paused`);
		await arcade.padPress('start');
		check('pausa con Start', await paused(), true);
		await arcade.padPress('start');
		check('sigue con Start', await paused(), false);

		// B es una acción de la partida, no una salida.
		await arcade.padPress('b');
		check('escena tras B en la mina', await arcade.sceneKey(), 'socavon:game');

		// Mina vacía: A baja a la siguiente.
		const depth = await read(`${scene('socavon:game')}.run.depth`);
		await page.evaluate(() => { window.arcade.scene.getScene('socavon:game').mine.status = 'cleared'; });
		await arcade.padPress('a');
		await page.waitForTimeout(400);
		check('profundidad tras A', await read(`${scene('socavon:game')}.run.depth`), depth + 1);

		// Select sale al título.
		await arcade.padPress('select');
		await arcade.waitForScene('socavon:title');

		// Resultado: A vuelve a jugar, Y al menú, B al arcade.
		await arcade.padPress('a');
		await arcade.waitForScene('socavon:game');
		await startResult();
		await arcade.waitForScene('socavon:result');
		await arcade.padPress('a');
		await arcade.waitForScene('socavon:game');
		await startResult();
		await arcade.waitForScene('socavon:result');
		await arcade.padPress('y');
		await arcade.waitForScene('socavon:title');
		await arcade.padPress('a');
		await arcade.waitForScene('socavon:game');
		await startResult();
		await arcade.waitForScene('socavon:result');
		await arcade.padPress('b');
		await arcade.waitForScene('core:launcher');

		// B en el título también vuelve al arcade, que vuelve a empezar por la primera ficha.
		await openSocavon(arcade);
		await arcade.padPress('b');
		await arcade.waitForScene('core:launcher');
	},
};

const wanted = process.argv.slice(2);
const names = wanted.length ? wanted : Object.keys(TESTS);
const unknown = names.filter((name) => !TESTS[name]);
if (unknown.length) {
	console.error(`No hay prueba de mando para: ${unknown.join(', ')}. Hay: ${Object.keys(TESTS).join(', ')}`);
	process.exit(1);
}

// Un solo navegador y un solo servidor: cerrar Vite entre pruebas y volver a
// levantarlo choca con el que todavía se está apagando. Cada prueba arranca de
// una página recién cargada, con el mando suelto.
const arcade = await openArcade({ gamepad: true, shotsDir: 'screenshots/mando' });
let failed = 0;
try {
	for (const name of names) {
		await arcade.page.reload();
		await arcade.waitForScene('core:launcher');
		arcade.errors.length = 0;
		try {
			await TESTS[name](arcade);
			if (arcade.errors.length) throw new Error(`errores en la consola:\n${arcade.errors.join('\n')}`);
			console.log(`ok    ${name}`);
		} catch (error) {
			failed += 1;
			await arcade.shot(`${name}-fallo`).catch(() => {});
			console.error(`FALLA ${name}: ${error.message}`);
		}
	}
} finally {
	await arcade.close();
}
process.exit(failed ? 1 : 0);
