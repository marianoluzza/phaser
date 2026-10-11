import type { TranslationKey } from '../../../core/i18n/i18n';
import { choosePlan, type EnemyIntent, type EnemyPlan, type EnemyProfile } from '../constants/enemies';
import { PIECES, type PieceType } from '../constants/pieces';
import { ROOMS, type RoomId } from '../constants/rooms';
import { COMBAT_TUNING } from '../constants/tuning';
import { effectiveAptitude, type Crew } from './Crew';
import type { Ship } from './Ship';
import { Rng } from './rng';

/**
 * Línea de la bitácora.
 *
 * Guarda la clave de traducción y los datos que la completan, nunca texto ya
 * armado: la bitácora tiene que poder leerse en cualquier idioma y el combate
 * no sabe cuál está activo.
 */
export type LogEntry = {
	key: TranslationKey;
	values?: Record<string, number>;
	/** Nombre de la pieza involucrada, si la línea habla de alguien. */
	piece?: TranslationKey;
	/** Sala involucrada, si la línea habla de un lugar de la nave. */
	room?: RoomId;
	/** Tripulante involucrado: la pantalla lo usa para señalarlo en el plano. */
	memberId?: string;
};

export type CombatOutcome = 'ongoing' | 'won' | 'lost';

/** Por qué una pieza no puede dejar su puesto. */
export type MoveBlock = 'moved' | 'noMoves' | 'noBridge';

/**
 * Lo que pasaría si la ronda se resolviera ahora y nadie esquivara.
 *
 * Son las mismas líneas que escribiría la bitácora, porque salen de jugar la
 * ronda de verdad sobre una copia: el pronóstico no puede contradecir al
 * combate porque es el combate.
 */
export type RoundForecast = {
	entries: LogEntry[];
	outcome: CombatOutcome;
	playerHull: number;
	playerShield: number;
	enemyHull: number;
	enemyShield: number;
};

/** Un golpe al casco, para explicar cómo terminó el combate. */
export type Hit = { round: number; damage: number; hull: number; kind: 'fire' | 'charged' | 'torpedo' };

export type CombatStats = {
	dealt: number;
	taken: number;
	worstHit: Hit | null;
	bestShot: Hit | null;
};

/**
 * Un combate contra otra nave, resuelto por rondas.
 *
 * Todo lo que decide la ronda vive acá y no en la escena: el resultado depende
 * únicamente del reparto de la tripulación, del enemigo y de la semilla, así
 * que se puede probar el balance sin abrir el navegador.
 *
 * La única decisión del jugador es dónde está cada tripulante. No hay botones
 * de disparar ni de escudar: la armería dispara si hay alguien que sepa
 * hacerlo. Eso es el juego.
 */
export class Combat {
	round = 1;
	outcome: CombatOutcome = 'ongoing';
	/** Líneas de la última ronda resuelta. */
	log: LogEntry[] = [];
	/** Todas las rondas resueltas, de la primera a la última. */
	readonly history: LogEntry[][] = [];
	readonly stats: CombatStats = { dealt: 0, taken: 0, worstHit: null, bestShot: null };

	playerShield: number;
	enemyHull: number;
	enemyShield = 0;
	enemyCharged = false;
	/** Lo que el enemigo anuncia para esta ronda: qué hace y contra qué sala. */
	plan: EnemyPlan;

	/** Cada pieza se mueve una vez por ronda, como en el tablero. */
	private readonly moved = new Set<string>();

	readonly enemy: EnemyProfile;
	private readonly crew: Crew;
	private readonly ship: Ship;
	private readonly rng: Rng;

	constructor(crew: Crew, ship: Ship, enemy: EnemyProfile, rng: Rng) {
		this.crew = crew;
		this.ship = ship;
		this.enemy = enemy;
		this.rng = rng;
		this.enemyHull = enemy.hull;
		this.playerShield = this.shieldCapacity;
		this.plan = this.nextPlan();
	}

	get intent(): EnemyIntent {
		return this.plan.intent;
	}

	get target(): RoomId | null {
		return this.plan.target;
	}

	get shieldCapacity(): number {
		return this.ship.output('shields', this.crew);
	}

	get damage(): number {
		return this.ship.output('weapons', this.crew);
	}

	get initiative(): number {
		return this.ship.output('bridge', this.crew);
	}

	/**
	 * Cuántas piezas pueden dejar su puesto en esta ronda: lo que produce el
	 * puente.
	 *
	 * Es el trabajo del puente y la razón de que exista. Antes sólo decidía
	 * quién disparaba primero, y las simulaciones fueron tajantes: daba
	 * exactamente lo mismo tener al rey ahí que no tenerlo. Ahora el puente es
	 * el que permite reaccionar a lo que el enemigo anuncia, que es de dónde
	 * sale casi toda la ventaja de jugar bien. Sin nadie al mando, la nave
	 * entra en combate con el reparto que traía y se lo aguanta.
	 */
	get movesPerRound(): number {
		return this.ship.output('bridge', this.crew);
	}

	/** Disparar primero sólo importa cuando ese disparo termina el combate. */
	get playerFirst(): boolean {
		return this.initiative > this.enemy.initiative;
	}

	get movesLeft(): number {
		return Math.max(0, this.movesPerRound - this.moved.size);
	}

	/** Evasión en porcentaje, con techo: los motores no vuelven intocable a la nave. */
	get evasion(): number {
		const raw = this.ship.output('engines', this.crew) * COMBAT_TUNING.evasionPerPoint;
		return Math.min(COMBAT_TUNING.maxEvasion, raw);
	}

	canMove(memberId: string): boolean {
		return this.moveBlock(memberId) === null;
	}

	/** El motivo importa: "ya se movió" y "no hay puente" se arreglan distinto. */
	moveBlock(memberId: string): MoveBlock | null {
		if (this.moved.has(memberId)) return 'moved';
		if (this.movesPerRound === 0) return 'noBridge';
		if (this.movesLeft === 0) return 'noMoves';

		return null;
	}

	registerMove(memberId: string) {
		this.moved.add(memberId);
	}

	/**
	 * Resuelve la ronda completa.
	 *
	 * El orden importa y es siempre el mismo: quien tiene mejor puente dispara
	 * primero, después se atiende a los heridos y por último se regeneran los
	 * escudos. Disparar primero sólo se nota cuando el disparo alcanza para
	 * terminar el combate, que es exactamente cuando tiene que notarse.
	 */
	resolveRound() {
		if (this.outcome !== 'ongoing') return;

		// El jugador acaba de repartir gente: si sacó a alguien de escudos, el
		// escudo que quedaba levantado no puede seguir siendo más grande que la
		// sala que lo sostiene.
		this.clampShield();
		this.log = [{ key: 'astro.log.roundStart', values: { round: this.round } }];
		this.history.push(this.log);
		this.exchangeFire();

		if (this.outcome !== 'ongoing') return;

		this.runMedbay();
		this.regenerateShields();

		this.round += 1;
		this.moved.clear();
		this.plan = this.nextPlan();
	}

	/**
	 * Juega la ronda sobre una copia, sin azar, y cuenta qué pasó.
	 *
	 * Sólo cubre el intercambio de golpes: lo que el jugador puede cambiar
	 * moviendo gente. La enfermería y la recarga del escudo vienen después y no
	 * dependen de esta decisión.
	 */
	forecast(): RoundForecast {
		const sim = new Combat(this.crew.clone(), this.ship.clone(), this.enemy, Rng.certain());
		sim.round = this.round;
		sim.plan = this.plan;
		sim.playerShield = this.playerShield;
		sim.enemyHull = this.enemyHull;
		sim.enemyShield = this.enemyShield;
		sim.enemyCharged = this.enemyCharged;

		sim.clampShield();
		sim.exchangeFire();

		return {
			entries: sim.log,
			outcome: sim.outcome,
			playerHull: sim.ship.hull,
			playerShield: sim.playerShield,
			enemyHull: sim.enemyHull,
			enemyShield: sim.enemyShield,
		};
	}

	private exchangeFire() {
		if (this.playerFirst) {
			this.playerAttack();
			if (this.outcome === 'ongoing') this.enemyAction();
		} else {
			this.enemyAction();
			if (this.outcome === 'ongoing') this.playerAttack();
		}
	}

	private playerAttack() {
		const damage = this.damage;
		if (damage === 0) {
			this.log.push({ key: 'astro.log.noWeapons' });
			return;
		}

		if (this.rng.chance(this.enemy.evasion)) {
			this.log.push({ key: 'astro.log.enemyEvaded' });
			return;
		}

		const absorbed = Math.min(this.enemyShield, damage);
		this.enemyShield -= absorbed;
		// Lo que pasa de largo de un casco ya destruido no cuenta como daño hecho.
		this.stats.dealt += Math.min(this.enemyHull, damage - absorbed);
		this.enemyHull = Math.max(0, this.enemyHull - (damage - absorbed));
		this.stats.bestShot = harder(this.stats.bestShot, {
			round: this.round,
			damage,
			hull: damage - absorbed,
			kind: 'fire',
		});

		this.log.push({
			key: 'astro.log.playerFires',
			values: { damage, absorbed, hull: damage - absorbed },
		});

		if (this.enemyHull === 0) {
			this.outcome = 'won';
			this.log.push({ key: 'astro.log.victory' });
		}
	}

	private enemyAction() {
		if (this.intent === 'charge') {
			this.enemyCharged = true;
			// Con cuánto va a pegar y cuánto aguanta hoy el escudo: es lo que el
			// jugador tiene que comparar para la ronda que viene.
			this.log.push({
				key: 'astro.log.enemyCharges',
				values: {
					next: this.enemy.damage * COMBAT_TUNING.chargeMultiplier,
					shield: this.shieldCapacity,
				},
			});
			return;
		}

		if (this.intent === 'shield') {
			this.enemyShield = Math.min(this.enemy.shieldCapacity, this.enemyShield + 2);
			this.log.push({ key: 'astro.log.enemyShields', values: { shield: this.enemyShield } });
			return;
		}

		if (this.intent === 'board') {
			this.resolveBoarding();
			return;
		}

		if (this.intent === 'torpedo') {
			this.resolveTorpedo();
			return;
		}

		if (this.intent === 'radiation') {
			this.resolveRadiation();
			return;
		}

		this.resolveEnemyFire();
	}

	/**
	 * Torpedo: rodea el escudo y lo único que lo achica son los motores.
	 *
	 * No tira evasión: cada punto de motores le saca una cantidad fija. Así el
	 * pronóstico dice exactamente cuánto entra y la respuesta queda a la vista,
	 * igual que el escudo contra el disparo.
	 */
	private resolveTorpedo() {
		const damage = COMBAT_TUNING.torpedoDamage;
		const dodged = Math.min(
			damage,
			this.ship.output('engines', this.crew) * COMBAT_TUNING.torpedoDodgePerPoint
		);
		const hull = damage - dodged;

		this.stats.taken += Math.min(this.ship.hull, hull);
		this.ship.hull = Math.max(0, this.ship.hull - hull);
		this.stats.worstHit = harder(this.stats.worstHit, {
			round: this.round,
			damage,
			hull,
			kind: 'torpedo',
		});

		this.log.push({ key: 'astro.log.torpedo', values: { damage, dodged, hull }, room: 'engines' });

		if (this.ship.hull === 0) {
			this.outcome = 'lost';
			this.log.push({ key: 'astro.log.defeat' });
		}
	}

	/**
	 * Radiación: hiere a las piezas que más rinden, salvo las que atienda la
	 * enfermería.
	 *
	 * Elige por aporte y no al azar, para que el pronóstico nombre a quién va a
	 * herir. Cada punto de enfermería evita una herida: el alfil la cubre
	 * entera, el peón la mitad.
	 */
	private resolveRadiation() {
		const blocked = this.ship.output('medbay', this.crew);
		const count = Math.max(0, COMBAT_TUNING.radiationWounds - blocked);

		if (count === 0) {
			this.log.push({ key: 'astro.log.radiationBlocked', room: 'medbay' });
			return;
		}

		// El orden de la tripulación desempata, así que el resultado no depende
		// del orden en que se recorran las salas.
		const order = this.crew.all();
		const targets = (Object.keys(ROOMS) as RoomId[])
			.flatMap((room) =>
				this.ship.occupants(room, this.crew).map((member) => ({
					member,
					room,
					output: effectiveAptitude(member, room) * ROOMS[room].perSlot,
				}))
			)
			.sort((a, b) => b.output - a.output || order.indexOf(a.member) - order.indexOf(b.member))
			.slice(0, count);

		this.log.push({
			key: 'astro.log.radiation',
			values: { blocked: Math.min(blocked, COMBAT_TUNING.radiationWounds) },
			room: 'medbay',
		});
		for (const { member, room } of targets) this.wound(member, room);
	}

	/**
	 * Disparo enemigo: va al casco y lo frena el escudo.
	 *
	 * No hiere a nadie. La respuesta a un disparo es tener escudo, y la
	 * respuesta a una carga es tener más escudo justo esa ronda; herir además a
	 * la tripulación hacía que cada golpe recibido bajara el escudo y el
	 * siguiente golpe pegara más fuerte, hasta volver irrelevante todo lo demás.
	 */
	private resolveEnemyFire() {
		const charged = this.enemyCharged;
		const damage = this.enemy.damage * (charged ? COMBAT_TUNING.chargeMultiplier : 1);
		this.enemyCharged = false;

		if (this.rng.chance(this.evasion / 100)) {
			this.log.push({ key: 'astro.log.playerEvaded', values: { damage } });
			return;
		}

		const absorbed = Math.min(this.playerShield, damage);
		const throughShield = damage - absorbed;
		this.playerShield -= absorbed;
		this.stats.taken += Math.min(this.ship.hull, throughShield);
		this.ship.hull = Math.max(0, this.ship.hull - throughShield);
		this.stats.worstHit = harder(this.stats.worstHit, {
			round: this.round,
			damage,
			hull: throughShield,
			kind: charged ? 'charged' : 'fire',
		});

		this.log.push({
			key: 'astro.log.enemyFires',
			values: { damage, absorbed, hull: throughShield },
		});

		if (this.ship.hull === 0) {
			this.outcome = 'lost';
			this.log.push({ key: 'astro.log.defeat' });
		}
	}

	private wound(target: { id: string; type: PieceType }, room: RoomId) {
		const down = this.crew.wound(target.id);
		const who = { piece: PIECES[target.type].nameKey, memberId: target.id, room };
		this.log.push({ key: 'astro.log.wounded', ...who });

		if (down) {
			this.ship.dropIncapacitated(this.crew);
			this.log.push({ key: 'astro.log.crewDown', ...who });
		}

		// Herir a la gente de escudos baja la capacidad en el acto.
		this.clampShield();
	}

	private clampShield() {
		this.playerShield = Math.min(this.playerShield, this.shieldCapacity);
	}

	/**
	 * Abordaje enemigo contra una sala anunciada.
	 *
	 * El abordaje va a la gente, no al casco, y el escudo no lo frena: lo único
	 * que lo evita es que la sala esté vacía cuando llegan. Un abordaje a una
	 * sala vacía es una ronda entera que el enemigo tira a la basura, y por eso
	 * es la intención que más premia mirar el anuncio.
	 */
	private resolveBoarding() {
		const room = this.plan.target;
		const occupants = room ? this.ship.occupants(room, this.crew) : [];

		if (!room || !occupants.length) {
			// Una nave completamente vacía no tiene a quién perder: ahí sí se lo
			// comen las paredes.
			if (!this.ship.occupiedRooms(this.crew).length) {
				this.stats.taken += Math.min(this.ship.hull, COMBAT_TUNING.emptyBoardingDamage);
				this.ship.hull = Math.max(0, this.ship.hull - COMBAT_TUNING.emptyBoardingDamage);
				this.log.push({
					key: 'astro.log.boardingEmpty',
					values: { damage: COMBAT_TUNING.emptyBoardingDamage },
				});

				if (this.ship.hull === 0) {
					this.outcome = 'lost';
					this.log.push({ key: 'astro.log.defeat' });
				}
				return;
			}

			this.log.push({ key: 'astro.log.boardingMissed', room: room ?? undefined });
			return;
		}

		// El grupo de abordaje barre la sala: hiere a todos los que encuentre.
		// Con una sola herida por abordaje, esquivarlo no compensaba perder la
		// producción de la sala durante la ronda.
		this.log.push({ key: 'astro.log.boarding', room });
		for (const occupant of occupants) this.wound(occupant, room);
	}

	private runMedbay() {
		if (this.ship.output('medbay', this.crew) === 0) return;

		const healed = this.crew.healOne();
		if (healed) {
			this.log.push({
				key: 'astro.log.healed',
				piece: PIECES[healed.type].nameKey,
				memberId: healed.id,
				room: 'medbay',
			});
		}
	}

	private regenerateShields() {
		const capacity = this.shieldCapacity;
		const before = this.playerShield;
		this.playerShield = COMBAT_TUNING.shieldRechargesFully
			? capacity
			: Math.min(capacity, this.playerShield + 2);

		if (this.playerShield !== before) {
			this.log.push({ key: 'astro.log.shieldUp', values: { shield: this.playerShield } });
		}

		this.enemyShield = Math.min(
			this.enemy.shieldCapacity,
			this.enemyShield + this.enemy.shieldRegen
		);
	}

	private nextPlan(): EnemyPlan {
		return choosePlan(
			{
				shield: this.enemyShield,
				charged: this.enemyCharged,
				playerDamage: this.damage,
				playerShield: this.shieldCapacity,
				enemyDamage: this.enemy.damage,
				occupiedRooms: this.ship.occupiedRooms(this.crew),
			},
			(probability) => this.rng.chance(probability),
			(items) => this.rng.pick(items)
		);
	}
}

/** Se queda con el golpe que más casco se llevó; ante un empate, con el primero. */
function harder(current: Hit | null, candidate: Hit): Hit | null {
	if (candidate.hull === 0) return current;

	return !current || candidate.hull > current.hull ? candidate : current;
}
