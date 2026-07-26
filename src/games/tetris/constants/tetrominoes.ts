import type { BlockPosition } from '../objects/Piece';

export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

export type PieceDefinition = {
	/** Cuatro bloques relativos al origen de la pieza. */
	shape: BlockPosition[];
	/** Punto alrededor del cual se aplica la fórmula de rotación. */
	pivot: BlockPosition;
	/** Los colores en Phaser se expresan habitualmente como hexadecimales. */
	color: number;
};

/**
 * Definiciones inmutables de los siete tetrominós.
 *
 * El eje X crece hacia la derecha y el eje Y hacia abajo, igual que las
 * coordenadas del canvas. Las piezas reales copian estos datos al construirse.
 */
export const TETROMINOES: Record<PieceType, PieceDefinition> = {
	I: {
		shape: [
			[0, 1],
			[1, 1],
			[2, 1],
			[3, 1],
		],
		pivot: [1.5, 1.5],
		color: 0x00ffff,// cyan
	},

	O: {
		shape: [
			[1, 0],
			[2, 0],
			[1, 1],
			[2, 1],
		],
		pivot: [1.5, 0.5],
		color: 0xffff00,// yellow
	},

	T: {
		shape: [
			[1, 0],
			[0, 1],
			[1, 1],
			[2, 1],
		],
		pivot: [1, 1],
		color: 0xaa00ff,// purple
	},

	S: {
		shape: [
			[1, 0],
			[2, 0],
			[0, 1],
			[1, 1],
		],
		pivot: [1, 1],
		color: 0x00ff00,// green
	},

	Z: {
		shape: [
			[0, 0],
			[1, 0],
			[1, 1],
			[2, 1],
		],
		pivot: [1, 1],
		color: 0xff0000,// red
	},

	J: {
		shape: [
			[0, 0],
			[0, 1],
			[1, 1],
			[2, 1],
		],
		pivot: [1, 1],
		color: 0x0000ff,// blue
	},

	L: {
		shape: [
			[2, 0],
			[0, 1],
			[1, 1],
			[2, 1],
		],
		pivot: [1, 1],
		color: 0xffaa00,// orange
	},
};
