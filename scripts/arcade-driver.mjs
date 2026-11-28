import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { chromium } from 'playwright-core';

/**
 * Driver del arcade para revisar cambios en el navegador de verdad.
 *
 * Usa `playwright-core` y el Chrome instalado en la máquina (`channel: 'chrome'`)
 * en vez del paquete `playwright` completo, que descargaría sus propios
 * navegadores. Con un juego dentro de un canvas no hay selectores que valgan:
 * todo se maneja con teclado, coordenadas y capturas, así que el driver ofrece
 * eso y una única aserción real, la escena activa de Phaser.
 */
/**
 * El puerto se puede cambiar con `ARCADE_PORT` cuando el 5173 lo tiene otro
 * proyecto: Vite es el mismo para todos y el driver no tiene que manejar una
 * aplicación ajena creyendo que es el arcade.
 */
const PORT = Number(process.env.ARCADE_PORT ?? 5173);
const DEV_URL = `http://localhost:${PORT}/`;
const SHOTS_DIR = 'screenshots';

/**
 * `viewport` es el tamaño de la ventana en píxeles CSS. El de 800×600 deja el
 * mundo en su ancho mínimo; uno más ancho ejercita el ancho elástico de
 * core/renderScale.ts.
 */
/** Botones del mapeo estándar del navegador, como los nombra `core/input/controls.ts`. */
const PAD_BUTTONS = {
	a: 0, b: 1, x: 2, y: 3, l1: 4, r1: 5, l2: 6, r2: 7,
	select: 8, start: 9, l3: 10, r3: 11, up: 12, down: 13, left: 14, right: 15,
};

/**
 * Un mando de mentira: Chrome headless no tiene uno de verdad, así que se
 * reemplaza `navigator.getGamepads` antes de que cargue el arcade. El estado
 * vive en `window.__pad` y el driver lo cambia con `padDown`, `padUp`,
 * `padPress` y `padStick`.
 */
function installFakePad() {
	window.__pad = { buttons: new Array(17).fill(false), axes: [0, 0, 0, 0] };
	Object.defineProperty(Navigator.prototype, 'getGamepads', {
		configurable: true,
		value: () => [{
			id: 'Mando de prueba (STANDARD GAMEPAD)',
			index: 0,
			connected: true,
			mapping: 'standard',
			timestamp: performance.now(),
			axes: [...window.__pad.axes],
			buttons: window.__pad.buttons.map((pressed) => ({ pressed, touched: pressed, value: pressed ? 1 : 0 })),
			vibrationActuator: null,
		}],
	});
}

export async function openArcade({ headless = true, shotsDir = SHOTS_DIR, viewport = { width: 800, height: 600 }, gamepad = false } = {}) {
	rmSync(shotsDir, { recursive: true, force: true });
	mkdirSync(shotsDir, { recursive: true });

	const server = await startDevServer();
	const browser = await chromium.launch({
		channel: 'chrome',
		headless,
		// El navegador reproduce la música del arcade como lo haría un jugador.
		args: ['--autoplay-policy=no-user-gesture-required'],
	});

	// Densidad 2, como un monitor HiDPI: ejercita el zoom de core/renderScale.ts.
	// Las coordenadas de click son siempre las de la escena (ver `toPage`).
	const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
	const errors = [];
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(message.text());
	});
	page.on('pageerror', (error) => errors.push(error.message));

	if (gamepad) await page.addInitScript(installFakePad);
	await page.goto(DEV_URL);
	await waitForScene(page);

	const setButton = (name, pressed) => {
		if (!(name in PAD_BUTTONS)) throw new Error(`Botón de mando desconocido: ${name}`);
		return page.evaluate(([index, value]) => { window.__pad.buttons[index] = value; }, [PAD_BUTTONS[name], pressed]);
	};

	let shotIndex = 0;

	return {
		page,
		errors,

		/**
		 * Manda una tecla al juego y le da tiempo a la escena a reaccionar.
		 *
		 * La tecla se mantiene apretada 80 ms a propósito: `Key.onUp` de Phaser
		 * borra el `justDown`, así que soltarla en el mismo frame en que se
		 * apretó hace que `update()` nunca llegue a verla y la tecla se pierda.
		 */
		async press(key, times = 1) {
			for (let i = 0; i < times; i += 1) {
				await page.keyboard.press(key, { delay: 80 });
				await page.waitForTimeout(220);
			}
		},

		/** Aprieta un botón del mando de prueba (`gamepad: true`) y lo deja apretado. */
		padDown: (name) => setButton(name, true),

		/**
		 * Suelta un botón y espera unos frames: el mando se lee una vez por
		 * frame, y soltar y volver a apretar sin que pase ninguno no es una
		 * pulsación nueva.
		 */
		async padUp(name) {
			await setButton(name, false);
			await page.waitForTimeout(150);
		},

		/**
		 * Aprieta y suelta un botón del mando. Como con las teclas, se mantiene
		 * 80 ms: el mando se lee una vez por frame y un toque más corto se pierde.
		 */
		async padPress(name, times = 1) {
			for (let i = 0; i < times; i += 1) {
				await setButton(name, true);
				await page.waitForTimeout(80);
				await setButton(name, false);
				await page.waitForTimeout(220);
			}
		},

		/** Inclina el stick izquierdo; `padStick(0, 0)` lo suelta. */
		padStick: (x, y) => page.evaluate(([ax, ay]) => { window.__pad.axes[0] = ax; window.__pad.axes[1] = ay; }, [x, y]),

		/** Click en coordenadas de la escena, que es la única forma de apuntarle. */
		async click(x, y) {
			const point = await toPage(page, x, y);
			await page.mouse.click(point.x, point.y);
			await page.waitForTimeout(220);
		},

		/** Lleva el puntero a un punto de la escena sin apretar: para ver lo que aparece al pasar. */
		async move(x, y) {
			const point = await toPage(page, x, y);
			await page.mouse.move(point.x, point.y, { steps: 4 });
			await page.waitForTimeout(220);
		},

		/** Gira la rueda del mouse sobre un punto de la escena. */
		async wheel(x, y, deltaY) {
			const point = await toPage(page, x, y);
			await page.mouse.move(point.x, point.y);
			await page.mouse.wheel(0, deltaY);
			await page.waitForTimeout(220);
		},

		/** Arrastra de un punto a otro de la escena, con pasos intermedios como una mano. */
		async drag(from, to) {
			const start = await toPage(page, from.x, from.y);
			const end = await toPage(page, to.x, to.y);
			await page.mouse.move(start.x, start.y);
			await page.mouse.down();
			await page.mouse.move(end.x, end.y, { steps: 10 });
			await page.mouse.up();
			await page.waitForTimeout(220);
		},

		/** Cambia el tamaño de la ventana y espera a que el arcade se reacomode. */
		async resize(width, height) {
			await page.setViewportSize({ width, height });
			// `main.ts` espera 150 ms quieta a la ventana antes de recalcular.
			await page.waitForTimeout(600);
		},

		async shot(name) {
			shotIndex += 1;
			const file = `${shotsDir}/${String(shotIndex).padStart(2, '0')}-${name}.png`;
			await page.screenshot({ path: file });
			return file;
		},

		/** Clave de la escena que Phaser está corriendo ahora mismo. */
		sceneKey: () => currentSceneKey(page),

		/** Espera a que la escena activa sea la esperada, sin dormir a ciegas. */
		async waitForScene(key, timeout = 15000) {
			await waitForScene(page, key, timeout);
		},

		async close() {
			await browser.close();
			server.stop();
		},
	};
}

/**
 * Pasa coordenadas de la escena a píxeles de la página. Según el ancho de la
 * ventana, la cámara principal centra el área clásica de 800 (scroll negativo)
 * o la escena ocupa todo el ancho; el canvas además está escalado por CSS.
 */
function toPage(page, x, y) {
	return page.evaluate(([x, y]) => {
		const game = window.arcade;
		const active = game.scene.getScenes(true);
		const camera = active[active.length - 1].cameras.main;
		const box = game.canvas.getBoundingClientRect();
		const css = box.width / game.canvas.width;
		return {
			x: box.left + (x - camera.scrollX) * camera.zoom * css,
			y: box.top + (y - camera.scrollY) * camera.zoom * css,
		};
	}, [x, y]);
}

function currentSceneKey(page) {
	// `main.ts` publica el juego en `window.arcade` sólo en desarrollo.
	return page.evaluate(() => {
		const game = window.arcade;
		const active = game?.scene.getScenes(true) ?? [];
		return active.length ? active[active.length - 1].scene.key : null;
	});
}

async function waitForScene(page, key, timeout = 15000) {
	await page.waitForFunction(
		(expected) => {
			const game = window.arcade;
			const active = game?.scene.getScenes(true) ?? [];
			if (!active.length) return false;
			return expected ? active[active.length - 1].scene.key === expected : true;
		},
		key,
		{ timeout }
	).catch(async (error) => {
		const current = await currentSceneKey(page).catch(() => null);
		throw new Error(`Se esperaba la escena ${key ?? 'cualquiera'} y sigue ${current}: ${error.message}`);
	});

	// Un frame de más: la escena ya existe, pero puede estar dibujándose.
	await page.waitForTimeout(400);
}

/** Levanta `npm run dev`, o reutiliza el que ya esté escuchando el puerto. */
async function startDevServer() {
	const serving = await servedApp();
	if (serving === 'arcade') {
		return { stop: () => {} };
	}
	if (serving === 'other') {
		throw new Error(
			`El puerto ${PORT} lo está usando otra aplicación. Probá con ARCADE_PORT=5180 npm run shots.`
		);
	}

	const child = spawn('npm', ['run', 'dev', '--', '--port', String(PORT), '--strictPort'], {
		shell: true,
		stdio: 'ignore',
	});
	const deadline = Date.now() + 30000;

	while (Date.now() < deadline) {
		if ((await servedApp()) === 'arcade') return { stop: () => stopTree(child) };
		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	stopTree(child);
	throw new Error('El servidor de desarrollo no respondió en 30 segundos.');
}

/**
 * En Windows, `npm run dev` corre bajo un `cmd` intermedio: matar al hijo deja
 * a Vite escuchando el puerto. `taskkill /t` sí baja el árbol completo.
 */
function stopTree(child) {
	if (!child.pid) return;

	if (process.platform === 'win32') {
		spawn('taskkill', ['/pid', String(child.pid), '/f', '/t'], { stdio: 'ignore' });
		return;
	}

	child.kill();
}

/** Qué responde en el puerto: el arcade, otra aplicación o nada. */
async function servedApp() {
	try {
		const response = await fetch(DEV_URL, { signal: AbortSignal.timeout(1500) });
		if (!response.ok) return 'other';

		return (await response.text()).includes('<title>Mi Arcade</title>') ? 'arcade' : 'other';
	} catch {
		return 'none';
	}
}
