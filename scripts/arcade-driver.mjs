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

export async function openArcade({ headless = true, shotsDir = SHOTS_DIR } = {}) {
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
	// Las coordenadas de click siguen siendo las de 800×600.
	const page = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 2 });
	const errors = [];
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(message.text());
	});
	page.on('pageerror', (error) => errors.push(error.message));

	await page.goto(DEV_URL);
	await waitForScene(page);

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

		/** Click en coordenadas del canvas, que es la única forma de apuntarle. */
		async click(x, y) {
			const canvas = page.locator('canvas');
			await canvas.click({ position: { x, y } });
			await page.waitForTimeout(220);
		},

		/** Lleva el puntero a un punto del canvas sin apretar: para ver lo que aparece al pasar. */
		async move(x, y) {
			const box = await page.locator('canvas').boundingBox();
			await page.mouse.move(box.x + x, box.y + y, { steps: 4 });
			await page.waitForTimeout(220);
		},

		/** Gira la rueda del mouse sobre un punto del canvas. */
		async wheel(x, y, deltaY) {
			const box = await page.locator('canvas').boundingBox();
			await page.mouse.move(box.x + x, box.y + y);
			await page.mouse.wheel(0, deltaY);
			await page.waitForTimeout(220);
		},

		/** Arrastra de un punto a otro del canvas, con pasos intermedios como una mano. */
		async drag(from, to) {
			const box = await page.locator('canvas').boundingBox();
			await page.mouse.move(box.x + from.x, box.y + from.y);
			await page.mouse.down();
			await page.mouse.move(box.x + to.x, box.y + to.y, { steps: 10 });
			await page.mouse.up();
			await page.waitForTimeout(220);
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
	);

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
