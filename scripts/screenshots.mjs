import { openArcade } from './arcade-driver.mjs';

/**
 * Recorridos por el arcade con capturas, para revisar un cambio en el navegador
 * sin abrirlo a mano.
 *
 *   npm run shots            recorre el launcher y Astro Chess
 *   npm run shots -- pipes   recorre sólo el flujo indicado
 *   npm run shots -- --show  con ventana visible, para mirarlo en vivo
 *
 * Cada flujo verifica la escena activa además de sacar la foto: una captura
 * prueba que algo se dibujó, no que sea la pantalla correcta.
 */
const FLOWS = {
	launcher: async (arcade) => {
		await arcade.waitForScene('core:launcher');
		await arcade.shot('launcher');
	},

	'astro-chess': async (arcade) => {
		await arcade.waitForScene('core:launcher');
		// Astro Chess es la cuarta ficha del catálogo.
		await arcade.press('ArrowRight', 3);
		await arcade.shot('launcher-astro-seleccionado');

		await arcade.press('Enter');
		await arcade.waitForScene('astro:title');
		await arcade.shot('astro-titulo-rey');

		// La fila de tripulación se recorre con las flechas.
		await arcade.press('ArrowRight', 3);
		await arcade.shot('astro-titulo-alfil');

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
};

const args = process.argv.slice(2);
const headless = !args.includes('--show');
const names = args.filter((arg) => !arg.startsWith('--'));
const flows = names.length ? names : ['launcher', 'astro-chess'];

const unknown = flows.filter((name) => !FLOWS[name]);
if (unknown.length) {
	console.error(`Flujo desconocido: ${unknown.join(', ')}`);
	console.error(`Disponibles: ${Object.keys(FLOWS).join(', ')}`);
	process.exit(1);
}

const arcade = await openArcade({ headless });

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
