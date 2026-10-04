import type { TranslationKey } from '../../../core/i18n/i18n';
import type { RoomId } from './rooms';

/** Las seis piezas del ajedrez, que acá son los seis roles de la tripulación. */
export type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';

/**
 * Orden de la tripulación: de la pieza que decide la partida a la que la
 * sostiene. Es el orden en que se muestran y también el de la jerarquía.
 */
export const PIECE_TYPES: PieceType[] = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'];

/**
 * Silueta de cada pieza.
 *
 * No hay imágenes: la silueta es una forma geométrica que `pieceRenderer` sabe
 * dibujar. El color es el otro identificador, así que ninguna pieza comparte el
 * suyo con otra.
 */
export type PieceShape = 'crown' | 'diamond' | 'tower' | 'ogive' | 'wedge' | 'dot';

export type PieceProfile = {
	shape: PieceShape;
	color: number;
	nameKey: TranslationKey;
	/** Rasgo de la pieza: qué hace distinto, no cuánto suma. */
	traitKey: TranslationKey;
};

export const PIECES: Record<PieceType, PieceProfile> = {
	king: {
		shape: 'crown',
		color: 0xffca4b,
		nameKey: 'astro.piece.king',
		traitKey: 'astro.piece.king.trait',
	},
	queen: {
		shape: 'diamond',
		color: 0xc66cff,
		nameKey: 'astro.piece.queen',
		traitKey: 'astro.piece.queen.trait',
	},
	rook: {
		shape: 'tower',
		color: 0x46d9ff,
		nameKey: 'astro.piece.rook',
		traitKey: 'astro.piece.rook.trait',
	},
	bishop: {
		shape: 'ogive',
		color: 0x5ee48a,
		nameKey: 'astro.piece.bishop',
		traitKey: 'astro.piece.bishop.trait',
	},
	knight: {
		shape: 'wedge',
		color: 0xff8a3d,
		nameKey: 'astro.piece.knight',
		traitKey: 'astro.piece.knight.trait',
	},
	pawn: {
		shape: 'dot',
		color: 0x9eacd0,
		nameKey: 'astro.piece.pawn',
		traitKey: 'astro.piece.pawn.trait',
	},
};

/**
 * Aptitud de cada pieza en cada sala: `0` no aporta, `1` cumple, `2` es
 * especialista.
 *
 * Es la tabla que decide las partidas, así que está escrita entera y a la
 * vista en vez de derivarse de reglas sueltas. El peón vale `1` en todo: no es
 * malo, es exactamente normal, y esa es justamente su debilidad.
 */
export const APTITUDES: Record<PieceType, Record<RoomId, number>> = {
	king: { bridge: 2, shields: 1, weapons: 1, engines: 1, medbay: 1 },
	queen: { bridge: 2, shields: 2, weapons: 2, engines: 2, medbay: 2 },
	rook: { bridge: 1, shields: 2, weapons: 1, engines: 1, medbay: 0 },
	bishop: { bridge: 1, shields: 1, weapons: 2, engines: 1, medbay: 2 },
	knight: { bridge: 1, shields: 0, weapons: 1, engines: 2, medbay: 0 },
	pawn: { bridge: 1, shields: 1, weapons: 1, engines: 1, medbay: 1 },
};

export function aptitude(type: PieceType, room: RoomId): number {
	return APTITUDES[type][room];
}
