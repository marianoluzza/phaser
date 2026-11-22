/** Cada píxel del arte son dos unidades del mundo. */
export const PIXEL = 2;
/**
 * De celdas y galerías a unidades del mundo. Cada galería son tres tiles de
 * alto: dos de aire y la losa, que es también el techo de la de abajo.
 */
export const TILE = 24 * PIXEL;
export const GALLERY = TILE * 3;
/*
 * En el aire de una galería (96 unidades) entran, uno sobre otro y sin
 * tocarse, la vagoneta y el minero agarrado del techo. Lo controla un test
 * contra el atlas: si cambia un sprite, avisa.
 */
export const CART_LIFT = 1;
export const GRIP_LIFT = 9;

export function centerX(x: number) {
	return x * TILE + TILE / 2;
}

/** Altura a la que pisa quien está en la galería `y`. */
export function feetY(y: number) {
	return (y + 1) * GALLERY;
}

export function mineSize(width: number, height: number) {
	return { width: width * TILE, height: height * GALLERY + TILE };
}
