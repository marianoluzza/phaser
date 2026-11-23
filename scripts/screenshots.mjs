import { openArcade } from './arcade-driver.mjs';

/**
 * Recorridos por el arcade con capturas, para revisar un cambio en el navegador
 * sin abrirlo a mano.
 *
 *   npm run shots            recorre el launcher y Astro Chess
 *   npm run shots -- pipes   recorre sólo el flujo indicado
 *   npm run shots -- --show  con ventana visible, para mirarlo en vivo
 *   npm run shots -- --size=1280x720  con otra ventana (por defecto 800×600)
 *
 * Cada flujo verifica la escena activa además de sacar la foto: una captura
 * prueba que algo se dibujó, no que sea la pantalla correcta.
 */
const FLOWS = {
	/**
	 * Socavón de punta a punta: la primera mina entera con el teclado (con los
	 * serenos quietos, para que el recorrido sea repetible), la mina de
	 * abajo, una persecución de verdad, el fin de la partida y la veta sin fin.
	 */
	socavon: async (arcade) => {
		const { page } = arcade;
		const state = () => page.evaluate(() => {
			const { mine } = window.arcade.scene.getScene('socavon:game');
			return {
				x: mine.player.x, y: mine.player.y, hands: mine.player.hands, keys: mine.player.keys,
				delivered: mine.delivered, status: mine.status, lives: mine.lives,
			};
		});
		const expect = async (key, value) => {
			const actual = (await state())[key];
			if (actual !== value) throw new Error(`Socavón: ${key} = ${actual}, se esperaba ${value}`);
		};
		const hold = async (key, reached) => {
			await page.keyboard.down(key);
			try {
				await page.waitForFunction(reached.test, reached.value, { timeout: 15000, polling: 'raf' });
			} finally {
				await page.keyboard.up(key);
			}
			await page.waitForTimeout(80);
		};
		const walk = async (x) => {
			const from = (await state()).x;
			if (Math.abs(from - x) < 0.25) return;
			await hold(x > from ? 'ArrowRight' : 'ArrowLeft', {
				value: [x, Math.sign(x - from)],
				test: ([goal, side]) => (window.arcade.scene.getScene('socavon:game').mine.player.x - goal) * side >= -0.1,
			});
		};
		const climb = async (y) => {
			const from = (await state()).y;
			await hold(y > from ? 'ArrowDown' : 'ArrowUp', {
				value: y,
				test: (goal) => window.arcade.scene.getScene('socavon:game').mine.player.y === goal,
			});
		};
		const use = () => arcade.press('Space');

		await arcade.waitForScene('core:launcher');
		// Socavón es la anteúltima ficha del catálogo, antes del Jukebox.
		await arcade.press('ArrowLeft', 2);
		await arcade.shot('socavon-launcher');
		await arcade.press('Enter');
		await arcade.waitForScene('socavon:title');
		await arcade.shot('socavon-titulo');
		await arcade.press('Enter');
		await arcade.waitForScene('socavon:game');
		await page.waitForTimeout(700);
		await arcade.shot('socavon-mina1');
		await page.evaluate(() => {
			const { mine } = window.arcade.scene.getScene('socavon:game');
			mine.threats = false;
			for (const guard of mine.guards) Object.assign(guard, { x: guard.home.x, y: guard.home.y, facing: 1, moving: false });
		});

		await walk(11);
		await climb(1);
		await walk(9);
		await use();
		await expect('hands', 'bag');
		await arcade.shot('socavon-con-bolsa');
		await walk(11);
		await climb(0);
		await walk(5);
		await use();
		await expect('delivered', 1);
		await walk(15);
		await use();
		await walk(5);
		await use();
		await expect('delivered', 2);

		await walk(11);
		await climb(1);
		await walk(13);
		await use();
		await expect('hands', 'pick');
		await arcade.shot('socavon-con-pico');
		await walk(4);
		await climb(2);
		await walk(14.6);
		await use();
		await expect('keys', 1);
		await walk(18);
		await use();
		await arcade.shot('socavon-muro-golpeado');
		await page.waitForTimeout(300);
		await use();
		await page.waitForTimeout(300);
		await use();
		await page.waitForTimeout(400);
		await use();
		await expect('hands', null);
		await walk(21);
		await use();
		await expect('hands', 'bag');
		await walk(5);
		await use();
		await expect('delivered', 3);

		await walk(10);
		await climb(3);
		await walk(4);
		await use();
		await walk(10);
		await climb(2);
		await walk(5);
		await use();
		await expect('delivered', 4);
		// R15: un sereno de verdad, plantado en el camino del medio a la bóveda.
		// Se entra por la bajada del otro lado, a su espalda.
		await page.evaluate(() => {
			const { mine } = window.arcade.scene.getScene('socavon:game');
			Object.assign(mine.guards[0], { x: 15, y: 3, facing: -1, waitFor: 999, route: [], goal: null, mode: 'patrol', moving: false });
			mine.threats = true;
		});
		await walk(25);
		await climb(3);
		await walk(22);
		await arcade.shot('socavon-por-el-otro-lado');
		await expect('lives', 3);
		await use();
		await page.evaluate(() => {
			window.arcade.scene.getScene('socavon:game').mine.threats = false;
		});
		await expect('keys', 0);
		await expect('lives', 3);
		await arcade.shot('socavon-boveda');
		for (const total of [5, 6]) {
			await walk(22);
			await use();
			await expect('hands', 'bag');
			await walk(25);
			await climb(2);
			await walk(5);
			await use();
			await expect('delivered', total);
			if (total === 5) {
				await walk(25);
				await climb(3);
			}
		}
		await expect('status', 'cleared');
		await arcade.shot('socavon-mina-vacia');

		await arcade.press('Enter');
		await arcade.waitForScene('socavon:game');
		await page.waitForTimeout(700);
		await expect('status', 'playing');
		await expect('delivered', 0);
		await arcade.shot('socavon-mina2');

		// Carretilla, manijas y oscuridad.
		const put = (x, y) => page.evaluate(([px, py]) => {
			const { mine } = window.arcade.scene.getScene('socavon:game');
			Object.assign(mine.player, { x: px, y: py, state: 'walk' });
			mine.threats = false;
		}, [x, y]);
		await put(9, 1);
		await walk(10.2);
		await page.waitForTimeout(500);
		await arcade.shot('socavon-manijas');
		await put(23, 2);
		await page.waitForTimeout(700);
		await use();
		await expect('hands', 'barrow');
		await walk(20);
		await arcade.shot('socavon-carretilla');
		await use();
		// R18: suelta, sigue mirando para donde se la llevaba.
		await page.waitForTimeout(200);
		await arcade.shot('socavon-carretilla-suelta');
		const barrowFacing = await page.evaluate(() => window.arcade.scene.getScene('socavon:game').view.barrows[0].flipX);
		if (!barrowFacing) throw new Error('Socavón: la carretilla suelta quedó mirando a la derecha');

		// R17.1: escondido en el nicho, el sereno que pasa queda por delante.
		await put(18, 1);
		const hidden = (wanted) => ({ value: wanted, test: (goal) => window.arcade.scene.getScene('socavon:game').mine.player.hidden === goal });
		await hold('ArrowUp', hidden(true));
		const order = () => page.evaluate(() => {
			const { view } = window.arcade.scene.getScene('socavon:game');
			return view.root.getIndex(view.player) < view.root.getIndex(view.guards[0].body) ? 'detrás' : 'delante';
		});
		await page.evaluate(() => {
			const { mine } = window.arcade.scene.getScene('socavon:game');
			Object.assign(mine.guards[0], { x: 18.2, y: 1, facing: -1, mode: 'patrol', moving: true, route: [], goal: null });
		});
		await page.waitForTimeout(300);
		await arcade.shot('socavon-sereno-delante-del-nicho');
		if ((await order()) !== 'detrás') throw new Error('Socavón: escondido, el minero se dibuja delante del sereno');
		await page.evaluate(() => {
			Object.assign(window.arcade.scene.getScene('socavon:game').mine.guards[0], { x: 3, y: 0, moving: false });
		});
		await hold('ArrowRight', hidden(false));
		if ((await order()) !== 'delante') throw new Error('Socavón: fuera del nicho, el minero quedó detrás del sereno');

		// R17.2: la campana se toca a mano y se calla.
		await put(21, 4);
		await page.waitForTimeout(200);
		await use();
		const alarm = () => page.evaluate(() => window.arcade.scene.getScene('socavon:game').mine.alarm);
		if (!((await alarm()) > 7)) throw new Error('Socavón: la campana no sonó al tocarla');
		await page.waitForTimeout(400);
		await arcade.shot('socavon-campana-tocada');
		await use();
		if ((await alarm()) !== 0) throw new Error('Socavón: la campana no se calló');

		// R19: lo que no se ve es negro; lo que se dejó de ver, un recuerdo fijo que se apaga.
		const look = (x, row) => page.evaluate(([cx, r]) => {
			const { view } = window.arcade.scene.getScene('socavon:game');
			const piece = view.lit.find((other) => Math.floor(other.x / 48) === cx && Math.floor(other.y / 48) === r);
			const age = view.sight.ageAt(piece.x, piece.y);
			return { tint: piece.image.tint, age: age === Infinity ? 'nunca' : age };
		}, [x, row]);
		const fail = (what, value) => {
			throw new Error(`Socavón: ${what} (${JSON.stringify(value)})`);
		};
		// La galería 3 nunca se vio: el minero llegó a la 4 sin pasar por ella.
		const never = await look(10, 10);
		if (never.age !== 'nunca' || never.tint !== 0) fail('la galería nunca vista no es negra', never);
		const pausedAt = (low, high) => page.waitForFunction(([from, to]) => {
			const scene = window.arcade.scene.getScene('socavon:game');
			const { y } = scene.mine.player;
			if (y <= from || y >= to) return false;
			scene.paused = true;
			return true;
		}, [low, high], { timeout: 8000, polling: 'raf' });
		const resume = () => page.evaluate(() => {
			window.arcade.scene.getScene('socavon:game').paused = false;
		});
		const watchman = () => page.evaluate(() => {
			const sprites = window.arcade.scene.getScene('socavon:game').view.guards[0];
			return { body: sprites.body.visible, ghost: sprites.ghost.visible, ghostX: sprites.ghost.x };
		});

		await put(5, 1);
		await page.evaluate(() => {
			const { mine } = window.arcade.scene.getScene('socavon:game');
			Object.assign(mine.guards[0], { x: 9, y: 1, facing: -1, mode: 'patrol', moving: false, waitFor: 999, route: [], goal: null });
		});
		await page.waitForTimeout(200);
		if (!(await watchman()).body) fail('no se ve al sereno de la propia galería', await watchman());
		await page.keyboard.down('ArrowDown');
		await pausedAt(1.03, 1.25);
		// R19.2: el pie de la escalera se ve; cuatro celdas más allá, no.
		const foot = await look(5, 8);
		const beyond = await look(9, 8);
		if (foot.age !== 0) fail('al bajar no se ve el pie de la escalera', foot);
		if (beyond.age === 0) fail('al bajar se ve más que el pie de la escalera', beyond);
		await arcade.shot('socavon-asomarse-a-la-escalera');
		await resume();
		await pausedAt(1.42, 1.58);
		// R19.3: en el medio, las dos galerías enteras.
		const up = await look(20, 4);
		const down = await look(20, 8);
		if (up.age !== 0 || down.age !== 0) fail('en el medio no se ven las dos galerías', { up, down });
		await arcade.shot('socavon-mitad-y-mitad');
		await resume();
		await page.waitForFunction(() => window.arcade.scene.getScene('socavon:game').mine.player.y === 2, null, { timeout: 8000, polling: 'raf' });
		await page.keyboard.up('ArrowDown');
		// R19.4: el sereno se va, pero el recuerdo lo deja donde se lo vio.
		await page.evaluate(() => {
			Object.assign(window.arcade.scene.getScene('socavon:game').mine.guards[0], { x: 20 });
		});
		await page.waitForTimeout(300);
		const remembered = await watchman();
		if (remembered.body || !remembered.ghost || remembered.ghostX !== 9 * 48 + 24) fail('el recuerdo no deja al sereno donde se lo vio', remembered);
		const memory = await look(14, 4);
		if (memory.age === 0 || memory.age === 'nunca' || memory.tint === 0) fail('la galería de arriba no quedó como recuerdo', memory);
		await arcade.shot('socavon-recuerdo');
		await page.waitForTimeout(12300);
		const faded = await look(14, 4);
		if (faded.tint !== 0 || (await watchman()).ghost) fail('a los 12 s el recuerdo no está negro', { faded, guard: await watchman() });
		await arcade.shot('socavon-recuerdo-apagado');

		// R20.1: el muro corta la vista, como al sereno.
		await put(10, 3);
		await page.waitForTimeout(200);
		const before = await look(11, 10);
		const behind = await look(14, 10);
		if (before.age !== 0 || behind.age === 0) fail('el muro no corta la vista', { before, behind });
		await arcade.shot('socavon-muro-tapa');
		// R20.4: al sereno que se lo vio irse no lo trae el recuerdo de esa galería.
		await put(7, 1);
		await page.evaluate(() => {
			const { mine } = window.arcade.scene.getScene('socavon:game');
			Object.assign(mine.guards[0], { x: 3, y: 0.6, mode: 'patrol', moving: false, waitFor: 999, route: [], goal: null });
		});
		await page.waitForTimeout(250);
		if (!(await watchman()).body) fail('no se ve al sereno que trepa desde la propia galería', await watchman());
		await page.evaluate(() => {
			Object.assign(window.arcade.scene.getScene('socavon:game').mine.guards[0], { y: 0.2 });
		});
		await page.waitForTimeout(250);
		await put(7, 2);
		await page.waitForTimeout(250);
		if ((await watchman()).ghost) fail('el recuerdo trae al sereno que se lo vio irse', await watchman());

		// R16: colgarse, que pase la vagoneta, caerle adentro y bajarse, con el teclado.
		await put(13, 2);
		await page.evaluate(() => {
			const { mine } = window.arcade.scene.getScene('socavon:game');
			for (const guard of mine.guards) {
				Object.assign(guard, { x: 3, y: 0, mode: 'patrol', waitFor: 999, ignoreFor: 999, route: [], goal: null, moving: false });
			}
			Object.assign(mine.carts.find((cart) => cart.y === 2), { x: 6, direction: 1, waitFor: 1.5 });
			mine.threats = true;
		});
		await arcade.shot('socavon-agarre-en-el-techo');
		await hold('ArrowUp', { value: 'grip', test: (wanted) => window.arcade.scene.getScene('socavon:game').mine.player.state === wanted });
		// Se congela en el cruce para mirar que no se toquen.
		await page.waitForFunction(() => {
			const scene = window.arcade.scene.getScene('socavon:game');
			if (scene.mine.carts.find((cart) => cart.y === 2).x < 12.9) return false;
			scene.paused = true;
			return true;
		}, null, { timeout: 15000, polling: 'raf' });
		await arcade.shot('socavon-pasa-por-abajo');
		await expect('lives', 3);
		await page.evaluate(() => {
			window.arcade.scene.getScene('socavon:game').paused = false;
		});
		await page.waitForFunction(() => {
			const cart = window.arcade.scene.getScene('socavon:game').mine.carts.find((other) => other.y === 2);
			return cart.direction < 0 && cart.waitFor <= 0 && cart.x < 14.9;
		}, null, { timeout: 15000, polling: 'raf' });
		await hold('ArrowDown', { value: null, test: () => window.arcade.scene.getScene('socavon:game').mine.player.state !== 'grip' });
		await page.waitForFunction(() => {
			const scene = window.arcade.scene.getScene('socavon:game');
			if (scene.mine.player.state !== 'ride' || scene.mine.player.x > 10) return false;
			scene.paused = true;
			return true;
		}, null, { timeout: 5000, polling: 'raf' });
		await arcade.shot('socavon-viajando');
		await page.evaluate(() => {
			window.arcade.scene.getScene('socavon:game').paused = false;
		});
		await page.waitForFunction(
			() => window.arcade.scene.getScene('socavon:game').mine.player.cart?.waitFor > 0,
			null,
			{ timeout: 5000, polling: 'raf' }
		);
		await arcade.shot('socavon-vagoneta-detenida');
		const riderIs = (state) => page.waitForFunction(
			(wanted) => window.arcade.scene.getScene('socavon:game').mine.player.state === wanted,
			state,
			{ timeout: 3000, polling: 'raf' }
		);
		await use();
		await riderIs('walk');
		await expect('lives', 3);
		// Y de vuelta arriba, con Espacio desde el piso.
		await use();
		await riderIs('ride');
		await use();
		await riderIs('walk');
		await expect('lives', 3);

		// R16.4: colgado, el sereno lo agarra.
		await put(13, 4);
		await page.evaluate(() => {
			const { mine } = window.arcade.scene.getScene('socavon:game');
			mine.player.stamina = 6;
		});
		await hold('ArrowUp', { value: 'grip', test: (wanted) => window.arcade.scene.getScene('socavon:game').mine.player.state === wanted });
		await page.evaluate(() => {
			const scene = window.arcade.scene.getScene('socavon:game');
			const { mine } = scene;
			Object.assign(mine.guards[0], { x: 11.6, y: 4, facing: 1, mode: 'chase', timer: 9, ignoreFor: 0, shakenFor: 3 });
			scene.view.update(0);
			scene.paused = true;
		});
		await arcade.shot('socavon-viene-por-el-colgado');
		await page.evaluate(() => {
			const scene = window.arcade.scene.getScene('socavon:game');
			for (const cart of scene.mine.carts) cart.waitFor = 999;
			scene.mine.threats = true;
			scene.paused = false;
		});
		await page.waitForFunction(
			() => window.arcade.scene.getScene('socavon:game').mine.lives === 2,
			null,
			{ timeout: 4000, polling: 'raf' }
		);
		await page.waitForTimeout(1900);
		await page.evaluate(() => {
			window.arcade.scene.getScene('socavon:game').mine.lives = 3;
		});
		await put(20, 2);
		await page.waitForTimeout(700);
		await arcade.press('x');
		await page.waitForTimeout(500);
		await arcade.shot('socavon-sin-linterna');
		await arcade.press('p');
		await arcade.shot('socavon-pausa');
		await arcade.press('p');

		await arcade.press('x');
		await page.evaluate(() => {
			const { mine } = window.arcade.scene.getScene('socavon:game');
			Object.assign(mine.player, { x: 12, y: 0, state: 'walk', invincible: 0 });
			Object.assign(mine.guards[0], { x: 19, y: 0, facing: -1, waitFor: 9, route: [] });
			mine.lives = 1;
			mine.threats = true;
		});
		await page.waitForTimeout(1100);
		await arcade.shot('socavon-persecucion');
		await arcade.waitForScene('socavon:result');
		await arcade.shot('socavon-fin');
		await arcade.press('m');
		await arcade.waitForScene('socavon:title');

		await arcade.press('ArrowRight');
		await arcade.shot('socavon-veta-titulo');
		await arcade.resize(1280, 640);
		await arcade.waitForScene('socavon:title');
		await arcade.shot('socavon-veta-titulo-ancho');
		await arcade.press('Enter');
		await arcade.waitForScene('socavon:game');
		await page.waitForTimeout(700);
		await arcade.shot('socavon-generada-ancho');
		await page.evaluate(() => {
			const scene = window.arcade.scene.getScene('socavon:game');
			scene.scene.restart({ run: { score: 0, lives: 3, depth: 9, seed: 48151, campaign: false } });
		});
		await page.waitForTimeout(1500);
		await arcade.shot('socavon-generada-profunda');
		await arcade.resize(800, 600);
		await arcade.shot('socavon-achicada-en-vivo');
		await arcade.press('Escape');
		await arcade.waitForScene('socavon:title');
		await arcade.press('Escape');
		await arcade.waitForScene('core:launcher');

		await page.evaluate(() => localStorage.setItem('arcade.locale', 'en'));
		await page.reload();
		await arcade.waitForScene('core:launcher');
		await arcade.press('ArrowLeft', 2);
		await arcade.shot('socavon-launcher-en');
		await arcade.press('Enter');
		await arcade.waitForScene('socavon:title');
		await arcade.shot('socavon-titulo-en');
		await arcade.press('Escape');
		await arcade.waitForScene('core:launcher');
		await page.evaluate(() => localStorage.setItem('arcade.locale', 'es'));
		await page.reload();
		await arcade.waitForScene('core:launcher');
	},

	launcher: async (arcade) => {
		await arcade.waitForScene('core:launcher');
		await arcade.shot('launcher');
	},

	/**
	 * Ancho elástico: el launcher usa todo el ancho y los juegos todavía en
	 * 800×600 quedan centrados. Cada cambio de ventana reacomoda lo que esté
	 * abierto sin perder la ficha elegida.
	 */
	ancho: async (arcade) => {
		await arcade.waitForScene('core:launcher');
		await arcade.resize(1280, 720);
		await arcade.shot('ancho-launcher-16x9');
		await arcade.press('ArrowRight', 6);
		await arcade.resize(1600, 800);
		await arcade.waitForScene('core:launcher');
		await arcade.shot('ancho-launcher-2x1-galactica');

		// La Galactopedia tiene cámaras extra para sus ejemplos: se corren con la principal.
		await arcade.press('Enter');
		await arcade.waitForScene('galactica:title');
		await arcade.press('g');
		await arcade.waitForScene('galactica:pedia');
		await arcade.press('ArrowRight');
		await arcade.page.waitForTimeout(1500);
		await arcade.shot('ancho-galactopedia-2x1');
		await arcade.resize(1100, 825);
		await arcade.page.waitForTimeout(1000);
		await arcade.shot('ancho-galactopedia-4x3');

		await arcade.press('Escape');
		await arcade.waitForScene('galactica:title');
		await arcade.press('Escape');
		await arcade.waitForScene('core:launcher');
		await arcade.shot('ancho-launcher-4x3');
		await arcade.resize(800, 600);
	},

	'astro-chess': async (arcade) => {
		await arcade.waitForScene('core:launcher');
		// Astro Chess es la cuarta ficha del catálogo.
		await arcade.press('ArrowRight', 3);
		await arcade.shot('launcher-astro-seleccionado');

		await arcade.press('Enter');
		await arcade.waitForScene('astro:title');
		await arcade.shot('astro-titulo');

		// La ayuda: ← → cambia de página, ↑ ↓ elige dentro de la página.
		await arcade.press('h');
		await arcade.waitForScene('astro:help');
		await arcade.shot('astro-ayuda-nave');
		await arcade.press('ArrowRight');
		await arcade.press('ArrowDown', 3);
		await arcade.shot('astro-ayuda-alfil');
		await arcade.press('ArrowRight');
		await arcade.shot('astro-ayuda-combate');
		await arcade.press('ArrowRight');
		await arcade.press('ArrowDown', 3);
		await arcade.shot('astro-ayuda-abordaje-anuncio');
		// El ejemplo alterna solo entre el anuncio y la respuesta.
		await arcade.page.waitForTimeout(1900);
		await arcade.shot('astro-ayuda-abordaje-respuesta');
		await arcade.press('Escape');
		await arcade.waitForScene('astro:title');

		await arcade.press('Enter');
		await arcade.waitForScene('astro:ship');
		await arcade.shot('astro-nave-vacia');

		// Sin nadie en la armería, el primer Enter avisa en vez de ir al combate.
		await arcade.press('Enter');
		await arcade.waitForScene('astro:ship');
		await arcade.shot('astro-aviso-sin-armeria');

		// Pasar por encima de una sala explica qué produce.
		await arcade.move(560, 255);
		await arcade.shot('astro-ayuda-puente');

		// Elegir una pieza muestra su aptitud en cada puesto y en cuánto quedaría
		// cada sala. Las coordenadas salen de `slotCenter`.
		await arcade.click(96, 494);
		await arcade.move(470, 330);
		await arcade.shot('astro-rey-elegido');
		await arcade.click(540, 312);

		// La reserva se corre a la izquierda cada vez que alguien toma un puesto,
		// así que siempre se toca la primera posición.
		await arcade.click(96, 494);
		await arcade.click(236, 239);
		await arcade.click(96, 494);
		await arcade.click(384, 239);
		// El caballo va arrastrado: click y arrastre llegan al mismo lugar.
		await arcade.drag({ x: 96, y: 494 }, { x: 121, y: 310 });

		// Con teclado: el foco arranca en la reserva y Espacio levanta la pieza.
		await arcade.press('ArrowRight');
		await arcade.press('Space');
		await arcade.press('ArrowUp');
		await arcade.shot('astro-teclado');
		await arcade.press('Escape');
		await arcade.move(700, 120);
		await arcade.shot('astro-nave-con-puestos');

		// Al combate.
		await arcade.press('Enter');
		await arcade.waitForScene('astro:combat');
		await arcade.shot('astro-combate-ronda-1');

		// La torre se levanta y se vuelve a dejar: ya se movió, así que la
		// tercera vez el combate la rechaza y explica por qué.
		await arcade.click(161, 203);
		await arcade.click(161, 203);
		await arcade.click(161, 203);
		await arcade.shot('astro-combate-bloqueada');

		// La ronda se cuenta paso a paso; un segundo Enter la saltea.
		await arcade.press('Enter');
		await arcade.page.waitForTimeout(700);
		await arcade.shot('astro-combate-resolviendo');
		await arcade.press('Enter');
		await arcade.press('Enter');
		await arcade.press('Enter');
		await arcade.shot('astro-combate-ronda-3');

		// La bitácora guarda todas las rondas: la rueda baja hasta las viejas.
		await arcade.press('Enter', 2);
		await arcade.wheel(640, 420, 600);
		await arcade.shot('astro-bitacora-scroll');

		// Se pelea hasta el final: la escena expone el resultado, así que no hay
		// que adivinar cuántas rondas faltan. Cada ronda lleva dos Enter: uno la
		// resuelve y el otro saltea la cuenta.
		const outcome = () =>
			arcade.page.evaluate(() => window.arcade.scene.getScene('astro:combat').combat.outcome);
		for (let round = 0; round < 30 && (await outcome()) === 'ongoing'; round += 1) {
			await arcade.press('Enter', 2);
		}
		await arcade.page.waitForTimeout(400);
		await arcade.shot(`astro-combate-${await outcome()}`);

		// Reintentar vuelve a los puestos con el mismo reparto.
		await arcade.press('Enter');
		await arcade.waitForScene('astro:ship');
		await arcade.shot('astro-reintento');

		await arcade.press('Escape');
		await arcade.waitForScene('astro:title');
		await arcade.press('Escape');
		await arcade.waitForScene('core:launcher');
	},

	tanks: async (arcade) => {
		await arcade.waitForScene('core:launcher');
		// Tanques es la quinta ficha del catálogo.
		await arcade.press('ArrowRight', 4);
		await arcade.shot('launcher-tanques-seleccionado');

		await arcade.press('Enter');
		await arcade.waitForScene('tanks:title');
		// La etapa elegida se recuerda mientras el arcade siga abierto.
		await arcade.press('ArrowRight', 2);
		await arcade.shot('tanques-titulo-etapa-3');
		await arcade.press('ArrowLeft', 2);
		await arcade.shot('tanques-titulo');

		await arcade.press('Enter');
		await arcade.waitForScene('tanks:game');
		await arcade.shot('tanques-cortina');
		await arcade.page.waitForTimeout(1600);

		// Se mantiene la flecha para avanzar y se dispara contra los ladrillos.
		const battle = (expression) =>
			arcade.page.evaluate(`(() => { const battle = window.arcade.scene.getScene('tanks:game').battle; return ${expression}; })()`);
		await arcade.page.keyboard.down('ArrowUp');
		await arcade.page.waitForTimeout(600);
		await arcade.page.keyboard.up('ArrowUp');
		await arcade.press('Space');
		await arcade.page.waitForTimeout(150);
		await arcade.shot('tanques-disparo');
		await arcade.page.waitForTimeout(4000);
		await arcade.shot('tanques-enemigos');

		await arcade.press('p');
		await arcade.shot('tanques-pausa');
		await arcade.press('p');

		// Se fuerza el final de la etapa en vez de jugarla entera: lo que importa
		// acá es la planilla, no la puntería.
		await battle('(battle.enemyQueue.splice(0), battle.enemies.forEach((tank) => battle.tanks.splice(battle.tanks.indexOf(tank), 1)), battle.kills.basic = 12, battle.kills.fast = 3, battle.score += 1800)');
		await arcade.waitForScene('tanks:result');
		await arcade.page.waitForTimeout(1800);
		await arcade.shot('tanques-etapa-superada');

		await arcade.press('Enter');
		await arcade.waitForScene('tanks:game');
		await arcade.page.waitForTimeout(1800);
		await arcade.shot('tanques-etapa-2');

		await battle('battle.destroyBase()');
		await arcade.page.waitForTimeout(1200);
		await arcade.shot('tanques-game-over');
		await arcade.waitForScene('tanks:result');
		await arcade.page.waitForTimeout(1800);
		await arcade.shot('tanques-cayo-el-aguila');

		await arcade.press('m');
		await arcade.waitForScene('tanks:title');

		// ALEATORIO va después de la última etapa: desde la 1 se llega yendo a la izquierda.
		await arcade.press('ArrowLeft');
		await arcade.shot('tanques-titulo-aleatorio');
		await arcade.press('n');
		await arcade.shot('tanques-titulo-otro-mapa');
		await arcade.press('Enter');
		await arcade.waitForScene('tanks:game');
		await arcade.page.waitForTimeout(1800);
		await arcade.shot('tanques-mapa-aleatorio');

		// Superar la última etapa diseñada pasa a mapas generados, con su semilla en el marcador.
		await arcade.press('Escape');
		await arcade.waitForScene('tanks:title');
		await arcade.press('ArrowLeft');
		await arcade.press('Enter');
		await arcade.waitForScene('tanks:game');
		await battle('(battle.enemyQueue.splice(0), battle.enemies.forEach((tank) => battle.tanks.splice(battle.tanks.indexOf(tank), 1)), true)');
		await arcade.waitForScene('tanks:result');
		await arcade.press('Enter');
		await arcade.waitForScene('tanks:game');
		await arcade.page.waitForTimeout(1800);
		await arcade.shot('tanques-etapa-7-generada');

		await arcade.press('Escape');
		await arcade.waitForScene('tanks:title');
		await arcade.press('Escape');
		await arcade.waitForScene('core:launcher');
	},

	galactica: async (arcade) => {
		await arcade.waitForScene('core:launcher');
		// Galáctica es la séptima ficha del catálogo.
		await arcade.press('ArrowRight', 6);
		await arcade.shot('launcher-galactica-seleccionado');

		await arcade.press('Enter');
		await arcade.waitForScene('galactica:title');
		await arcade.page.waitForTimeout(400);
		await arcade.shot('galactica-titulo');
		// La Aguja empieza bloqueada: se ve como silueta con su condición.
		await arcade.press('ArrowRight');
		await arcade.shot('galactica-hangar-bloqueada');
		await arcade.press('ArrowLeft');

		// La Galactopedia: una captura por página, con los ejemplos ya andando.
		await arcade.press('g');
		await arcade.waitForScene('galactica:pedia');
		await arcade.page.waitForTimeout(300);
		await arcade.shot('galactopedia-como-jugar');
		await arcade.press('ArrowRight');
		await arcade.page.waitForTimeout(2600);
		await arcade.shot('galactopedia-naves');
		await arcade.press('ArrowDown', 2);
		await arcade.page.waitForTimeout(4200);
		await arcade.shot('galactopedia-naves-bastion');
		await arcade.press('ArrowRight');
		await arcade.press('ArrowDown', 5);
		await arcade.page.waitForTimeout(3200);
		await arcade.shot('galactopedia-enemigos');
		await arcade.press('ArrowRight');
		await arcade.press('ArrowDown', 2);
		await arcade.page.waitForTimeout(2200);
		await arcade.shot('galactopedia-ataques-helicoide');
		await arcade.press('ArrowDown', 7);
		await arcade.page.waitForTimeout(3600);
		await arcade.shot('galactopedia-ataques-plantado');
		await arcade.press('ArrowRight');
		await arcade.page.waitForTimeout(3500);
		await arcade.shot('galactopedia-eventos-pod');
		await arcade.press('ArrowDown', 5);
		await arcade.page.waitForTimeout(6000);
		await arcade.shot('galactopedia-jefe-cristal');
		await arcade.press('Escape');
		await arcade.waitForScene('galactica:title');

		// El despegue: motores, la nave saliendo por la bahía y el corte a la zona.
		await arcade.press('Enter');
		await arcade.page.waitForTimeout(250);
		await arcade.shot('galactica-despegue-motores');
		await arcade.page.waitForTimeout(550);
		await arcade.shot('galactica-despegue-vuelo');
		await arcade.waitForScene('galactica:game');
		const battle = (expression) =>
			arcade.page.evaluate(`(() => { const battle = window.arcade.scene.getScene('galactica:game').battle; return ${expression}; })()`);
		await arcade.page.waitForTimeout(2600);
		await arcade.shot('galactica-entrada');

		// Se mueve y dispara un rato para ver la formación armada.
		await arcade.page.keyboard.down('Space');
		await arcade.page.keyboard.down('ArrowLeft');
		await arcade.page.waitForTimeout(900);
		await arcade.page.keyboard.up('ArrowLeft');
		await arcade.page.waitForTimeout(5000);
		await arcade.shot('galactica-formacion');

		// Los eventos se provocan en vez de esperarlos: lo que importa es cómo se ven.
		await battle(`(battle.player.shield = 99, battle.startEvent('comets'), battle.startEvent('pod'), true)`);
		await arcade.page.waitForTimeout(700);
		await arcade.shot('galactica-aviso-cometas');
		await arcade.page.waitForTimeout(900);
		await arcade.shot('galactica-cometas-y-pod');
		await battle(`(battle.startEvent('asteroids'), true)`);
		await arcade.page.waitForTimeout(2200);
		await arcade.shot('galactica-asteroides');

		// Un kamikaze plantado con su radio de explosión marcado.
		await battle(`(() => { const enemy = battle.enemies.find((e) => e.state === 'formation'); if (enemy) battle.startManeuver(enemy, 'planted'); return true; })()`);
		await arcade.page.waitForTimeout(1500);
		await arcade.shot('galactica-kamikaze-plantado');

		// Tres núcleos de una: la nave evoluciona a mk2.
		await battle(`(['core', 'core', 'core', 'double'].forEach((kind, i) => battle.pickups.push({ id: 90000 + i, x: battle.player.x, y: battle.player.y - 40 - i * 30, kind, age: 0 })), true)`);
		await arcade.page.waitForTimeout(1300);
		await arcade.shot('galactica-evolucion');
		await arcade.page.keyboard.up('Space');

		await arcade.press('p');
		await arcade.shot('galactica-pausa');
		await arcade.press('p');

		// Se vacía la zona y se llama al jefe.
		await battle(`(battle.enemies = [], battle.wave = battle.waveCount - 1, battle.phase = 'interlude', battle.phaseTimer = 0.05, true)`);
		await arcade.page.waitForTimeout(1200);
		await arcade.shot('galactica-jefe-aviso');
		await arcade.page.keyboard.down('Space');
		await arcade.page.waitForTimeout(5000);
		await arcade.shot('galactica-jefe');
		await arcade.page.keyboard.up('Space');

		await battle('(battle.killBoss(battle.boss), true)');
		await arcade.page.waitForTimeout(1200);
		await arcade.shot('galactica-jefe-derribado');
		await arcade.waitForScene('galactica:result');
		await arcade.page.waitForTimeout(2400);
		await arcade.shot('galactica-zona-liberada');

		await arcade.press('Enter');
		await arcade.waitForScene('galactica:game');
		await arcade.page.waitForTimeout(4500);
		await arcade.shot('galactica-zona-2');

		// Las zonas 3 y 4, con su jefe, empezando directamente desde el estado.
		for (const zone of [3, 4]) {
			await arcade.page.evaluate(`window.arcade.scene.getScene('galactica:game').scene.start('galactica:game', { zone: ${zone}, shipId: 'bastion', score: 0, hp: 100, cores: 8 })`);
			await arcade.page.waitForTimeout(800);
			await arcade.waitForScene('galactica:game');
			await arcade.page.waitForTimeout(5000);
			await arcade.shot(`galactica-zona-${zone}`);
			await battle(`(battle.player.shield = 99, battle.enemies = [], battle.wave = battle.waveCount - 1, battle.phase = 'interlude', battle.phaseTimer = 0.05, true)`);
			await arcade.page.waitForTimeout(7000);
			await arcade.shot(`galactica-zona-${zone}-jefe`);
		}

		await battle(`(battle.player.invulnerable = 0, battle.player.shield = 0, battle.damagePlayer('ram', 500), true)`);
		await arcade.page.waitForTimeout(1500);
		await arcade.shot('galactica-game-over');
		await arcade.waitForScene('galactica:result');
		await arcade.page.waitForTimeout(2400);
		await arcade.shot('galactica-nave-derribada');

		await arcade.press('m');
		await arcade.waitForScene('galactica:title');
		await arcade.press('ArrowRight');
		await arcade.shot('galactica-hangar-aguja');

		// En inglés: los textos son otros y tienen que entrar en los mismos lugares.
		await arcade.page.evaluate(() => localStorage.setItem('arcade.locale', 'en'));
		await arcade.page.reload();
		await arcade.waitForScene('core:launcher');
		await arcade.press('ArrowRight', 6);
		await arcade.press('Enter');
		await arcade.waitForScene('galactica:title');
		await arcade.page.waitForTimeout(300);
		await arcade.shot('galactica-titulo-en');
		await arcade.press('Enter');
		await arcade.waitForScene('galactica:game');
		await arcade.page.waitForTimeout(3000);
		await arcade.shot('galactica-partida-en');
		await arcade.page.evaluate(() => localStorage.setItem('arcade.locale', 'es'));

		await arcade.press('Escape');
		await arcade.waitForScene('galactica:title');
		await arcade.press('Escape');
		await arcade.waitForScene('core:launcher');
	},

	traffic: async (arcade) => {
		await arcade.waitForScene('core:launcher');
		// Semáforos es la sexta ficha del catálogo.
		await arcade.press('ArrowRight', 5);
		await arcade.shot('launcher-semaforos-seleccionado');

		await arcade.press('Enter');
		await arcade.waitForScene('traffic:title');
		await arcade.page.waitForTimeout(300);
		await arcade.shot('semaforos-titulo');

		await arcade.press('Enter');
		await arcade.waitForScene('traffic:game');
		const traffic = (expression) =>
			arcade.page.evaluate(`(() => { const traffic = window.arcade.scene.getScene('traffic:game').traffic; return ${expression}; })()`);
		/** Espera a que la simulación cumpla la condición; los coches salen al azar. */
		const until = async (expression, timeout = 30000) => {
			const start = Date.now();
			while (!(await traffic(expression))) {
				if (Date.now() - start > timeout) throw new Error(`No se cumplió: ${expression}`);
				await arcade.page.waitForTimeout(40);
			}
		};

		// Todo arranca en rojo: se forman colas y aparecen las barras de paciencia.
		await arcade.page.waitForTimeout(4500);
		await arcade.shot('semaforos-colas-en-rojo');

		// Norte y sur en verde con el teclado; el puntero sobre el del este resalta su carril.
		await arcade.press('ArrowUp');
		await arcade.press('ArrowDown');
		await arcade.move(489, 214);
		await arcade.page.waitForTimeout(500);
		await arcade.shot('semaforos-norte-sur-verde');

		// Con todo en verde el choque llega solo.
		await arcade.click(489, 214);
		await arcade.press('ArrowLeft');
		await until('traffic.stats.crashes > 0');
		await arcade.page.waitForTimeout(120);
		await arcade.shot('semaforos-choque');

		// Todo en rojo hasta que alguien se canse de esperar.
		await traffic('(traffic.lightIds.forEach((id) => traffic.setLight(id, "red")), traffic.lives = 3, true)');
		await until('traffic.stats.impatient > 0', 40000);
		await arcade.page.waitForTimeout(150);
		await arcade.shot('semaforos-impaciencia');

		// Se fuerza la última vida para no esperar el final entero.
		await traffic('(traffic.lives = 1, traffic.lightIds.forEach((id) => traffic.setLight(id, "green")), true)');
		await until('traffic.outcome === "over"', 60000);
		await arcade.shot('semaforos-ultimo-golpe');
		await arcade.waitForScene('traffic:over');
		await arcade.page.waitForTimeout(300);
		await arcade.shot('semaforos-game-over');

		await arcade.press('Enter');
		await arcade.waitForScene('traffic:game');
		await arcade.page.waitForTimeout(600);
		await arcade.shot('semaforos-reinicio');

		await arcade.press('Escape');
		await arcade.waitForScene('traffic:title');

		// Las pantallas en inglés: el idioma se lee al arrancar.
		await arcade.page.evaluate(() => localStorage.setItem('arcade.locale', 'en'));
		await arcade.page.reload();
		await arcade.waitForScene('core:launcher');
		await arcade.press('ArrowRight', 5);
		await arcade.press('Enter');
		await arcade.waitForScene('traffic:title');
		await arcade.page.waitForTimeout(300);
		await arcade.shot('semaforos-titulo-en');
		await arcade.press('Enter');
		await arcade.waitForScene('traffic:game');
		// Esta vez la última vida se va por impaciencia, que no depende del azar.
		await until('traffic.cars.some((car) => car.speed < 1)');
		await traffic('(traffic.lives = 1, traffic.cars.forEach((car) => { car.patience = 0.2; }), true)');
		await arcade.waitForScene('traffic:over');
		await arcade.page.waitForTimeout(300);
		await arcade.shot('semaforos-game-over-en');
		await arcade.page.evaluate(() => localStorage.setItem('arcade.locale', 'es'));
		await arcade.page.reload();
		await arcade.waitForScene('core:launcher');
	},

	truco: async (arcade) => {
		await arcade.waitForScene('core:launcher');
		// El rival elegido se recuerda: se parte siempre del predeterminado.
		await arcade.page.evaluate(() => localStorage.removeItem('truco.aiProfile'));
		// El Truco es la segunda ficha del catálogo.
		await arcade.press('ArrowRight');
		await arcade.press('Enter');
		await arcade.waitForScene('truco:title');
		await arcade.shot('truco-titulo-noob');

		// El selector recorre Noob, Pibe, Viejo y Aleatorio.
		await arcade.press('ArrowRight');
		await arcade.shot('truco-titulo-pibe');
		await arcade.press('ArrowRight', 2);
		await arcade.shot('truco-titulo-aleatorio');

		// Con el sorteo, la mesa no delata qué perfil tocó.
		await arcade.press('Enter');
		await arcade.waitForScene('truco:game');
		await arcade.shot('truco-mesa-aleatorio');

		// El Viejo tiene el nombre más largo: el marcador no debe salirse.
		await arcade.press('Escape');
		await arcade.waitForScene('core:launcher');
		await arcade.press('ArrowRight');
		await arcade.press('Enter');
		await arcade.waitForScene('truco:title');
		await arcade.press('ArrowLeft');
		await arcade.press('Enter');
		await arcade.waitForScene('truco:game');
		await arcade.shot('truco-mesa-viejo');

		// Un solo foco para cartas y cantos: dos `←` desde la carta del medio
		// pasan por la primera y entran a la grilla.
		await arcade.press('ArrowLeft', 2);
		await arcade.shot('truco-foco-cantos');

		// `A` vuelve a la primera carta y Enter la juega. La tecla se suelta a mano
		// para capturar la carta en pleno vuelo; después, al llegar.
		await arcade.press('a');
		await arcade.page.keyboard.press('Enter', { delay: 40 });
		await arcade.page.waitForTimeout(60);
		await arcade.shot('truco-carta-en-vuelo');
		await arcade.page.waitForTimeout(1200);
		await arcade.shot('truco-baza-jugada');

		// Con un truco por responder no hay foco: `←` entra a la grilla por la
		// derecha y `→`, sin cartas jugables, da la vuelta y entra por la izquierda.
		const setTrucoPending = (pending) => arcade.page.evaluate((pending) => {
			const scene = window.arcade.scene.getScene('truco:game');
			scene.pendingTruco = pending ? { caller: 'ai', value: 2 } : undefined;
			scene.focus.focus(null);
			scene.renderState();
		}, pending);
		await setTrucoPending(true);
		await arcade.shot('truco-responder');
		await arcade.press('ArrowLeft');
		await arcade.shot('truco-responder-izquierda');
		await setTrucoPending(true);
		await arcade.press('ArrowRight');
		await arcade.shot('truco-responder-derecha');
		await setTrucoPending(false);

		// Los tantos se dicen en orden: con la IA de mano, ella declara primero y
		// el jugador puede contestar "son buenas" (`B`) sin mostrar el suyo.
		const startDeclarations = (playerIsMano) => arcade.page.evaluate((playerIsMano) => {
			const scene = window.arcade.scene.getScene('truco:game');
			scene.playerIsMano = playerIsMano;
			scene.envidoResolved = false;
			scene.aiDeclaredEnvido = null;
			scene.envidoChain = ['envido'];
			scene.envidoAwaiting = 'player';
			scene.acceptEnvido();
			return window.arcade.scene.getScene('truco:game').declaringEnvido;
		}, playerIsMano);
		if (!await startDeclarations(false)) throw new Error('El cuadro de tantos no se abrió.');
		await arcade.shot('truco-tantos-ia-mano');
		await arcade.press('b');
		await arcade.shot('truco-son-buenas');
		// Siendo mano, el jugador declara primero y la IA contesta.
		if (!await startDeclarations(true)) throw new Error('El cuadro de tantos no se abrió.');
		await arcade.press('3', 2);
		await arcade.press('Enter');
		await arcade.shot('truco-tantos-jugador-mano');

		// El anotador y el registro sólo se llenan jugando: se fuerza un tanteador
		// que cruce a las buenas y algunos cantos, incluido uno que no entra en un renglón.
		await arcade.page.evaluate(() => {
			const scene = window.arcade.scene.getScene('truco:game');
			scene.playerScore = 17;
			scene.aiScore = 8;
			scene.addDialogue('player', 'ENVIDO');
			scene.addDialogue('ai', 'REAL ENVIDO');
			scene.addDialogue('player', 'QUIERO');
			scene.addDialogue('player', '27');
			scene.addDialogue('ai', '31');
			scene.addDialogue(null, 'IA VIEJO ganó el envido · +5');
			scene.addDialogue(null, 'Ingresá un tanto válido entre 0 y 33.');
			// Dos bazas sobre la mesa: una ganada por la IA y una parda, con los cuatro palos.
			const card = (value, suit) => ({ id: `${value}-${suit}`, value, suit, power: 0 });
			scene.playedTricks = [
				[{ card: card(1, 'espadas'), owner: 'ai', outcome: 'won' }, { card: card(7, 'oros'), owner: 'player', outcome: 'lost' }],
				[{ card: card(3, 'copas'), owner: 'ai', outcome: 'tie' }, { card: card(3, 'bastos'), owner: 'player', outcome: 'tie' }],
			];
			scene.renderState();
		});
		await arcade.page.waitForTimeout(2500);
		await arcade.shot('truco-anotador');

		await arcade.press('Escape');
		await arcade.waitForScene('core:launcher');
	},
};

const args = process.argv.slice(2);
const headless = !args.includes('--show');
const size = args.find((arg) => arg.startsWith('--size='))?.slice('--size='.length);
const [width, height] = (size ?? '800x600').split('x').map(Number);
const names = args.filter((arg) => !arg.startsWith('--'));
const flows = names.length ? names : ['launcher', 'astro-chess'];

const unknown = flows.filter((name) => !FLOWS[name]);
if (unknown.length) {
	console.error(`Flujo desconocido: ${unknown.join(', ')}`);
	console.error(`Disponibles: ${Object.keys(FLOWS).join(', ')}`);
	process.exit(1);
}

const arcade = await openArcade({ headless, viewport: { width, height } });

try {
	for (const name of flows) {
		await FLOWS[name](arcade);
		console.log(`✓ ${name}`);
	}
} finally {
	await arcade.close();
}

if (arcade.errors.length) {
	console.error(`\nErrores de consola:\n${arcade.errors.join('\n')}`);
	process.exit(1);
}

console.log('\nCapturas en screenshots/');
