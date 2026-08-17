import { DIRECTIONS, type Direction, type PipeType } from '../constants/pipeTypes';

/** Medidas de la grilla de la primera versión. */
export const BOARD_COLUMNS = 10;
export const BOARD_ROWS = 10;

/** Una celda vacía se representa con `null`. */
export type BoardCell = PipeType | null;

/** Celda por la que entra el agua, con la dirección hacia la que sale. */
export type PipeSource = {
	column: number;
	row: number;
	direction: Direction;
};

/**
 * Resultado de intentar colocar una pieza; la escena decide qué comunicar.
 * `blocked` es el origen o una celda que el agua ya mojó.
 */
export type PlacementResult = 'placed' | 'replaced' | 'blocked' | 'outside';

/**
 * Estado real del tablero.
 *
 * Es una clase sin Phaser adentro: sabe qué pieza hay en cada celda, cuáles
 * mojó el agua y dónde está el origen. Los gráficos de la escena son sólo un
 * reflejo de esto, así que las reglas se pueden probar y cambiar sin tocar el
 * dibujo.
 */
export class PipeBoard {
	readonly columns: number;
	readonly rows: number;
	readonly source: PipeSource;
	private cells: BoardCell[];
	private floodEntries: Direction[][];

	constructor(columns: number = BOARD_COLUMNS, rows: number = BOARD_ROWS) {
		this.columns = columns;
		this.rows = rows;
		this.cells = new Array<BoardCell>(columns * rows).fill(null);
		this.floodEntries = Array.from({ length: columns * rows }, () => []);
		this.source = this.createSource();
	}

	/** Cantidad de piezas colocadas actualmente. */
	get placedCount(): number {
		return this.cells.reduce((total, cell) => (cell ? total + 1 : total), 0);
	}

	/** Piezas por las que pasó el agua; la diferencia con `placedCount` son las sueltas. */
	get floodedCount(): number {
		return this.floodEntries.reduce(
			(total, entries, index) => (entries.length > 0 && this.cells[index] ? total + 1 : total),
			0
		);
	}

	contains(column: number, row: number): boolean {
		return column >= 0 && column < this.columns && row >= 0 && row < this.rows;
	}

	get(column: number, row: number): BoardCell {
		if (!this.contains(column, row)) return null;
		return this.cells[this.indexOf(column, row)];
	}

	isSource(column: number, row: number): boolean {
		return this.source.column === column && this.source.row === row;
	}

	isFlooded(column: number, row: number): boolean {
		return this.floodEntriesAt(column, row).length > 0;
	}

	/**
	 * Bordes por los que el agua entró a una celda.
	 *
	 * Es una lista y no un solo borde porque el cruce se puede atravesar dos
	 * veces, una por cada eje. El dibujo lo necesita para saber qué brazos
	 * pintar, y el caudal para saber si el camino que va a usar está libre.
	 */
	floodEntriesAt(column: number, row: number): readonly Direction[] {
		if (!this.contains(column, row)) return [];
		return this.floodEntries[this.indexOf(column, row)];
	}

	/** El origen y las celdas mojadas ya no se pueden tocar. */
	isBlocked(column: number, row: number): boolean {
		return this.isSource(column, row) || this.isFlooded(column, row);
	}

	/**
	 * Coloca una pieza. Una celda seca ya ocupada se puede sobrescribir, igual
	 * que en el Pipe Mania original mientras la cañería no esté mojada.
	 */
	place(column: number, row: number, type: PipeType): PlacementResult {
		if (!this.contains(column, row)) return 'outside';
		if (this.isBlocked(column, row)) return 'blocked';

		const index = this.indexOf(column, row);
		const hadPipe = this.cells[index] !== null;
		this.cells[index] = type;

		return hadPipe ? 'replaced' : 'placed';
	}

	/**
	 * Marca una celda como mojada apenas le llega el agua.
	 *
	 * Se moja al entrar y no al terminar de llenarse: el tramo que el agua está
	 * recorriendo tampoco se puede reemplazar.
	 */
	flood(column: number, row: number, entry: Direction) {
		if (!this.contains(column, row)) return;
		this.floodEntries[this.indexOf(column, row)].push(entry);
	}

	/** Recorre las celdas ocupadas para que la escena las dibuje. */
	forEachPipe(callback: (column: number, row: number, type: PipeType) => void) {
		this.cells.forEach((cell, index) => {
			if (!cell) return;
			callback(index % this.columns, Math.floor(index / this.columns), cell);
		});
	}

	/**
	 * Sortea el origen sobre una celda interior.
	 *
	 * Dejar un margen evita que el agua salga del tablero apenas arranca y le da
	 * al jugador lugar para construir en cualquier dirección.
	 */
	private createSource(): PipeSource {
		const margin = 2;
		const column = margin + Math.floor(Math.random() * (this.columns - margin * 2));
		const row = margin + Math.floor(Math.random() * (this.rows - margin * 2));
		const direction = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];

		return { column, row, direction };
	}

	private indexOf(column: number, row: number): number {
		return row * this.columns + column;
	}
}
