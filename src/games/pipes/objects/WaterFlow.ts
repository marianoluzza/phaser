import {
	DIRECTION_OFFSETS,
	exitDirection,
	OPPOSITE_DIRECTION,
	type Direction,
} from '../constants/pipeTypes';
import type { PipeBoard } from './PipeBoard';

/** Celda que el agua está llenando, con el borde por el que entró. */
export type FlowHead = {
	column: number;
	row: number;
	entry: Direction;
	/** Cuánto se llenó el tramo actual, de 0 a 1. */
	progress: number;
};

/**
 * Qué pasó en el último avance.
 * `entered` avisa que el agua terminó un tramo y pasó al siguiente.
 */
export type FlowStep = 'idle' | 'flowing' | 'entered' | 'spilled';

/**
 * Recorrido del agua por la cañería.
 *
 * El tablero sabe qué hay en cada celda; esta clase sabe por dónde va el agua.
 * Tampoco usa Phaser: recibe el `delta` del frame y devuelve qué ocurrió, así
 * la escena sólo tiene que dibujar y reaccionar.
 *
 * La velocidad llega desde afuera porque la define el nivel, no el caudal.
 */
export class WaterFlow {
	private board: PipeBoard;
	private msPerSegment: number;
	private head: FlowHead | null = null;
	private spilled = false;
	private segments = 0;
	private doubleCrosses = 0;

	constructor(board: PipeBoard, msPerSegment: number) {
		this.board = board;
		this.msPerSegment = msPerSegment;
	}

	/** Tramos completos recorridos; es la base del puntaje. */
	get filledSegments(): number {
		return this.segments;
	}

	/**
	 * Cruces atravesados por segunda vez.
	 *
	 * Es la única jugada del juego que exige planear: hay que volver a pasar por
	 * una celda que ya se usó. Se cuenta acá porque es el caudal el que sabe que
	 * está entrando a un cruce que ya tenía agua.
	 */
	get doubleCrossings(): number {
		return this.doubleCrosses;
	}

	get currentHead(): FlowHead | null {
		return this.head;
	}

	get hasSpilled(): boolean {
		return this.spilled;
	}

	/** Ubica el agua en la celda vecina al origen, según su dirección. */
	start() {
		const { column, row, direction } = this.board.source;
		const offset = DIRECTION_OFFSETS[direction];

		this.head = {
			column: column + offset.column,
			row: row + offset.row,
			entry: OPPOSITE_DIRECTION[direction],
			progress: 0,
		};
		this.spilled = false;
		this.segments = 0;
		this.doubleCrosses = 0;

		// El agua puede derramarse antes de avanzar si no hay pieza esperándola.
		if (!this.canFlowInto(this.head.column, this.head.row, this.head.entry)) {
			this.spill();
			return;
		}

		this.board.flood(this.head.column, this.head.row, this.head.entry);
	}

	/** Avanza el caudal con el tiempo del frame. */
	update(delta: number): FlowStep {
		if (!this.head || this.spilled) return 'idle';

		this.head.progress += delta / this.msPerSegment;
		if (this.head.progress < 1) return 'flowing';

		return this.moveToNextCell();
	}

	private moveToNextCell(): FlowStep {
		const head = this.head!;
		const type = this.board.get(head.column, head.row)!;
		const exit = exitDirection(type, head.entry)!;
		const offset = DIRECTION_OFFSETS[exit];
		const nextColumn = head.column + offset.column;
		const nextRow = head.row + offset.row;
		const nextEntry = OPPOSITE_DIRECTION[exit];

		this.segments += 1;

		if (!this.canFlowInto(nextColumn, nextRow, nextEntry)) {
			this.spill();
			return 'spilled';
		}

		// Entrar a una celda que ya tenía agua sólo es posible en un cruce, y ése
		// es exactamente el segundo uso que el puntaje premia.
		if (this.board.floodEntriesAt(nextColumn, nextRow).length > 0) {
			this.doubleCrosses += 1;
		}

		this.board.flood(nextColumn, nextRow, nextEntry);
		this.head = { column: nextColumn, row: nextRow, entry: nextEntry, progress: 0 };
		return 'entered';
	}

	/**
	 * El agua sigue sólo si hay una pieza que abra el borde por el que llega y
	 * el camino que usaría dentro de esa pieza todavía está seco.
	 *
	 * Lo segundo se mira por camino y no por celda porque el cruce tiene dos: se
	 * puede atravesar una vez por cada eje. En las demás piezas hay un único
	 * camino, así que mojarlo deja la celda terminada y un circuito cerrado no
	 * puede sumar tramos para siempre.
	 */
	private canFlowInto(column: number, row: number, entry: Direction): boolean {
		if (!this.board.contains(column, row)) return false;

		const type = this.board.get(column, row);
		if (type === null) return false;

		const exit = exitDirection(type, entry);
		if (!exit) return false;

		// Un camino queda tomado tanto por su entrada como por su salida: llegar
		// de contramano a un tramo lleno tampoco sirve.
		const used = this.board.floodEntriesAt(column, row);
		return !used.includes(entry) && !used.includes(exit);
	}

	private spill() {
		this.spilled = true;
		this.head = null;
	}
}
