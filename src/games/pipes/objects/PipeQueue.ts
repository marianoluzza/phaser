import { buildBag, turnsFlow, type PipeType, type PipeWeights } from '../constants/pipeTypes';

/**
 * Tope de piezas seguidas que no hacen doblar el agua.
 *
 * La bolsa ya evita las sequías largas, pero incluso con una bolsa justa pueden
 * caer varias rectas pegadas. Quedarse sin forma de girar mientras el agua
 * avanza no es una decisión difícil: es una mano perdida sin nada que hacer.
 */
const MAX_STRAIGHT_RUN = 3;

/**
 * Cola de piezas que el jugador está obligado a usar en orden.
 *
 * Las piezas no se sortean de cero cada vez: salen de una bolsa mezclada con
 * todas las piezas adentro, como el "7-bag" de Tetris. Al vaciarse se rellena
 * con una bolsa nueva, así en cada vuelta aparecen todas y ninguna desaparece
 * durante rachas largas.
 *
 * Mostrar las próximas piezas es parte de la estrategia: se decide dónde
 * colocar la actual sabiendo lo que viene después. Igual que el tablero, es
 * lógica pura sin objetos visuales.
 *
 * El contenido de la bolsa llega desde afuera porque es configurable: la cola
 * sabe repartir, no cuántos cruces conviene que haya.
 */
export class PipeQueue {
	readonly size: number;
	/** Contenido de una vuelta completa; se usa para mostrar cuánto falta. */
	readonly bagSize: number;
	private readonly contents: readonly PipeType[];
	private upcoming: PipeType[] = [];
	private bag: PipeType[] = [];
	private straightRun = 0;

	constructor(weights: PipeWeights, size: number = 5) {
		this.size = size;
		this.contents = buildBag(weights);
		this.bagSize = this.contents.length;
		this.reset();
	}

	/** Pieza que se colocará con el próximo click. */
	get current(): PipeType {
		return this.upcoming[0];
	}

	/** Vista de sólo lectura de la cola completa, incluida la pieza actual. */
	get preview(): readonly PipeType[] {
		return this.upcoming;
	}

	/** Piezas que quedan en la bolsa antes de mezclar una nueva. */
	get remainingInBag(): number {
		return this.bag.length;
	}

	/** Consume la pieza actual y repone el final de la cola. */
	shift(): PipeType {
		const used = this.upcoming.shift()!;
		this.upcoming.push(this.deal());
		return used;
	}

	reset() {
		this.bag = [];
		this.straightRun = 0;
		this.upcoming = Array.from({ length: this.size }, () => this.deal());
	}

	/** Reparte la próxima pieza de la bolsa, respetando el tope de rectas. */
	private deal(): PipeType {
		if (this.bag.length === 0) this.refillBag();
		if (this.straightRun >= MAX_STRAIGHT_RUN) this.bringCurveForward();

		const piece = this.bag.shift()!;
		this.straightRun = turnsFlow(piece) ? 0 : this.straightRun + 1;

		return piece;
	}

	/**
	 * Adelanta la próxima curva de la bolsa.
	 *
	 * Sólo cambia el orden, nunca el contenido: la vuelta sigue teniendo las
	 * mismas piezas. Si a la bolsa ya no le quedan curvas, se mezcla la
	 * siguiente y se toma de ahí. Con una bolsa configurada sin curvas no hay
	 * nada que adelantar y el tope deja de aplicarse.
	 */
	private bringCurveForward() {
		if (!this.contents.some(turnsFlow)) return;

		let index = this.bag.findIndex(turnsFlow);

		if (index === -1) {
			this.refillBag();
			index = this.bag.findIndex(turnsFlow);
		}

		if (index <= 0) return;

		const [curve] = this.bag.splice(index, 1);
		this.bag.unshift(curve);
	}

	/** Suma una bolsa nueva, mezclada con Fisher-Yates. */
	private refillBag() {
		const shuffled = [...this.contents];

		for (let index = shuffled.length - 1; index > 0; index -= 1) {
			const swapIndex = Math.floor(Math.random() * (index + 1));
			[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
		}

		this.bag.push(...shuffled);
	}
}
