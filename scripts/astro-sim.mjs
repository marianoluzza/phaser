/**
 * Simulador de combates de Astro Chess.
 *
 * `state/` no importa Phaser, así que el combate se puede jugar cientos de
 * veces sin abrir el navegador. Vite carga los módulos TypeScript tal cual,
 * sin compilar nada aparte ni sumar dependencias.
 *
 *   npm run sim:astro            # 1000 combates por jugador
 *   npm run sim:astro -- 5000    # otra cantidad
 *
 * Tres jugadores:
 * - Estático: reparte bien y no vuelve a tocar nada.
 * - Reactivo: en cada ronda prueba todos los movimientos que autoriza el
 *   puente y se queda con el que mejor pronóstico da.
 * - Sin armería: control, tiene que perder siempre.
 */
import { createServer } from 'vite';

const GAMES = Number(process.argv[2] ?? 1000);
const MAX_ROUNDS = 40;

const server = await createServer({
	logLevel: 'silent',
	server: { middlewareMode: true },
	appType: 'custom',
});

try {
	const load = (path) => server.ssrLoadModule(`/src/games/astro-chess/${path}`);
	const { Combat } = await load('state/Combat.ts');
	const { Crew } = await load('state/Crew.ts');
	const { Ship } = await load('state/Ship.ts');
	const { Rng } = await load('state/rng.ts');
	const { RAIDER, ENEMY_INTENTS } = await load('constants/enemies.ts');
	const { ROOMS, ROOM_IDS } = await load('constants/rooms.ts');
	const { COMBAT_TUNING } = await load('constants/tuning.ts');

	const SLOTS = ROOM_IDS.flatMap((room) =>
		Array.from({ length: ROOMS[room].slots }, (_, slot) => ({ room, slot }))
	);

	/** Torre y peón a escudos, alfil y caballo a la armería, rey al puente. */
	const BALANCED = [
		{ ref: { room: 'bridge', slot: 0 }, memberId: 'king-1' },
		{ ref: { room: 'shields', slot: 0 }, memberId: 'rook-2' },
		{ ref: { room: 'shields', slot: 1 }, memberId: 'pawn-5' },
		{ ref: { room: 'weapons', slot: 0 }, memberId: 'bishop-3' },
		{ ref: { room: 'weapons', slot: 1 }, memberId: 'knight-4' },
	];

	const NO_WEAPONS = [
		{ ref: { room: 'bridge', slot: 0 }, memberId: 'king-1' },
		{ ref: { room: 'shields', slot: 0 }, memberId: 'rook-2' },
		{ ref: { room: 'shields', slot: 1 }, memberId: 'pawn-5' },
		{ ref: { room: 'medbay', slot: 0 }, memberId: 'bishop-3' },
		{ ref: { room: 'engines', slot: 0 }, memberId: 'knight-4' },
	];

	function setLayout(ship, layout) {
		for (const ref of SLOTS) ship.clear(ref);
		ship.restore(layout);
	}

	/**
	 * Cuánto vale el pronóstico de la ronda para el jugador.
	 *
	 * Ganar o perder pesa más que todo; después, casco propio, casco enemigo y
	 * heridas. El último término evita que deje la nave desarmada por ahorrarse
	 * un golpe chico: el próximo anuncio no se conoce.
	 */
	function score(combat, forecast, ship) {
		if (forecast.outcome === 'won') return 1e6;
		if (forecast.outcome === 'lost') return -1e6;

		const wounds = forecast.entries.filter((entry) => entry.key === 'astro.log.wounded').length;
		return (
			-(ship.hull - forecast.playerHull) * 1.5 +
			(combat.enemyHull - forecast.enemyHull) -
			wounds * 2.5 +
			(combat.damage + combat.shieldCapacity) * 0.3
		);
	}

	/** Todas las formas de usar los movimientos: a puestos libres o intercambiando. */
	function* candidates(combat, ship, crew, movesLeft) {
		yield [];
		if (movesLeft === 0) return;

		const movable = crew.available().filter((member) => combat.canMove(member.id));
		for (const member of movable) {
			for (const ref of SLOTS) {
				const occupant = ship.memberIdAt(ref);
				if (occupant === member.id) continue;

				if (!occupant) {
					yield [{ memberId: member.id, ref }];
					if (movesLeft < 2) continue;

					// Una segunda pieza a un puesto libre.
					for (const other of movable) {
						if (other.id <= member.id) continue;
						for (const ref2 of SLOTS) {
							if (ship.memberIdAt(ref2) || (ref2.room === ref.room && ref2.slot === ref.slot)) continue;
							yield [
								{ memberId: member.id, ref },
								{ memberId: other.id, ref: ref2 },
							];
						}
					}
				} else if (movesLeft >= 2 && combat.canMove(occupant) && member.id < occupant) {
					const from = ship.slotOf(member.id);
					yield from
						? [
								{ memberId: member.id, ref },
								{ memberId: occupant, ref: from },
							]
						: [{ memberId: member.id, ref }];
				}
			}
		}
	}

	function reactiveTurn(combat, ship, crew, tally) {
		const before = ship.layout();
		let best = { value: -Infinity, moves: [] };

		for (const moves of candidates(combat, ship, crew, combat.movesLeft)) {
			setLayout(ship, before);
			for (const { memberId, ref } of moves) {
				const occupant = ship.memberIdAt(ref);
				const from = ship.slotOf(memberId);
				ship.assign(ref, memberId);
				if (occupant && from) ship.assign(from, occupant);
			}
			// Sacar a alguien del puente baja los movimientos: el juego ya no
			// autorizaría los que vienen después.
			if (moves.length > combat.movesPerRound) continue;

			const value = score(combat, combat.forecast(), ship);
			if (value > best.value) best = { value, moves };
		}

		setLayout(ship, before);
		for (const { memberId, ref } of best.moves) {
			const occupant = ship.memberIdAt(ref);
			const from = ship.slotOf(memberId);
			combat.registerMove(memberId);
			tally.moves[ref.room] += 1;
			ship.assign(ref, memberId);
			if (occupant && from) ship.assign(from, occupant);
		}
	}

	function play(layout, reactive, seed, tally) {
		const crew = Crew.starting();
		const ship = new Ship(COMBAT_TUNING.playerHull);
		ship.restore(layout);
		const combat = new Combat(crew, ship, RAIDER, new Rng(seed));

		while (combat.outcome === 'ongoing' && combat.round <= MAX_ROUNDS) {
			if (reactive) reactiveTurn(combat, ship, crew, tally);

			const intent = combat.intent;
			tally.intents[intent] += 1;
			if (intent === 'torpedo' && ship.output('engines', crew) > 0) tally.answered.torpedo += 1;
			if (intent === 'radiation' && ship.output('medbay', crew) > 0) tally.answered.radiation += 1;

			combat.resolveRound();
		}

		tally.rounds += combat.round;
		tally.hull += combat.outcome === 'won' ? ship.hull : 0;
		return combat.outcome === 'won';
	}

	const players = [
		['Estático', BALANCED, false],
		['Reactivo', BALANCED, true],
		['Sin armería', NO_WEAPONS, false],
	];

	console.log(`${GAMES} combates contra el corsario por jugador\n`);
	for (const [name, layout, reactive] of players) {
		const tally = {
			rounds: 0,
			hull: 0,
			intents: Object.fromEntries(ENEMY_INTENTS.map((intent) => [intent, 0])),
			answered: { torpedo: 0, radiation: 0 },
			moves: Object.fromEntries(ROOM_IDS.map((room) => [room, 0])),
		};
		let wins = 0;
		for (let seed = 1; seed <= GAMES; seed += 1) {
			if (play(layout, reactive, seed, tally)) wins += 1;
		}

		const totalIntents = Object.values(tally.intents).reduce((a, b) => a + b, 0);
		const mix = ENEMY_INTENTS.map(
			(intent) => `${intent} ${Math.round((tally.intents[intent] / totalIntents) * 100)}%`
		).join(' · ');
		const answered = (intent) =>
			tally.intents[intent] ? Math.round((tally.answered[intent] / tally.intents[intent]) * 100) : 0;

		console.log(`${name.padEnd(12)} victorias ${((wins / GAMES) * 100).toFixed(1).padStart(5)} %`);
		console.log(`  rondas promedio ${(tally.rounds / GAMES).toFixed(1)}, casco al ganar ${wins ? (tally.hull / wins).toFixed(1) : '-'}`);
		console.log(`  intenciones: ${mix}`);
		console.log(
			`  motores ante torpedo ${answered('torpedo')} %, enfermería ante radiación ${answered('radiation')} %`
		);
		const totalMoves = Object.values(tally.moves).reduce((a, b) => a + b, 0);
		if (totalMoves) {
			const destinations = ROOM_IDS.map(
				(room) => `${room} ${Math.round((tally.moves[room] / totalMoves) * 100)}%`
			).join(' · ');
			console.log(`  movimientos hacia: ${destinations}`);
		}
		console.log('');
	}
} finally {
	await server.close();
}
