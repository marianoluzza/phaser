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
