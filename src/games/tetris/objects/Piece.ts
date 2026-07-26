import { TETROMINOES, type PieceType } from '../constants/tetrominoes';

export type BlockPosition = [number, number];

/**
 * Una pieza lógica, sin objetos visuales de Phaser.
 *
 * Sus coordenadas `x` e `y` indican dónde está el origen de la pieza dentro
 * del tablero. Cada par de `shape` es la posición relativa de uno de sus
 * cuatro bloques respecto de ese origen.
 */
export class Piece {
	x = 3;
	y = 0;

	type: PieceType;
	shape: BlockPosition[];
	pivot: BlockPosition;
	color: number;

	constructor(type: PieceType) {
		this.type = type;

		const definition = TETROMINOES[type];

		// Copiamos el array para nunca modificar la definición global al rotar.
		this.shape = definition.shape.map(([x, y]) => [x, y]);
		this.pivot = definition.pivot;
		this.color = definition.color;
	}

	getBlocksAt(x = this.x, y = this.y, shape = this.shape) {
		// Convierte coordenadas locales de la forma en coordenadas del tablero.
		return shape.map(([blockX, blockY]) => ({
			x: x + blockX,
			y: y + blockY,
		}));
	}

	getRotatedShape(): BlockPosition[] {
		// El cuadrado se ve igual en todas sus rotaciones.
		if (this.type === 'O') {
			return this.shape;
		}

		const [pivotX, pivotY] = this.pivot;

		return this.shape.map(([x, y]) => {
			// 1. Movemos el bloque para que el pivote sea temporalmente (0, 0).
			const relativeX = x - pivotX;
			const relativeY = y - pivotY;

			// 2. La fórmula (-y, x) rota un punto 90° en sentido horario.
			const rotatedX = -relativeY;
			const rotatedY = relativeX;

			// 3. Devolvemos el punto a su sistema original y a la grilla entera.
			return [
				Math.round(rotatedX + pivotX),
				Math.round(rotatedY + pivotY),
			];
		});
	}

	rotate() {
		// La escena valida posibles colisiones antes de confirmar esta rotación.
		this.shape = this.getRotatedShape();
	}

	moveDown() {
		this.y++;
	}

	moveLeft() {
		this.x--;
	}

	moveRight() {
		this.x++;
	}
}
