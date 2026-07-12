import { TETROMINOES, type PieceType } from '../constants/tetrominoes';

export type BlockPosition = [number, number];

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

		this.shape = definition.shape.map(([x, y]) => [x, y]);
		this.pivot = definition.pivot;
		this.color = definition.color;
	}

	getBlocksAt(x = this.x, y = this.y, shape = this.shape) {
		return shape.map(([blockX, blockY]) => ({
			x: x + blockX,
			y: y + blockY,
		}));
	}

	getRotatedShape(): BlockPosition[] {
		if (this.type === 'O') {
			return this.shape;
		}

		const [pivotX, pivotY] = this.pivot;

		return this.shape.map(([x, y]) => {
			const relativeX = x - pivotX;
			const relativeY = y - pivotY;

			const rotatedX = -relativeY;
			const rotatedY = relativeX;

			return [
				Math.round(rotatedX + pivotX),
				Math.round(rotatedY + pivotY),
			];
		});
	}

	rotate() {
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