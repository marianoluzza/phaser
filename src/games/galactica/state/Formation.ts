import { FIELD_W, FORMATION } from '../constants/tuning';
import type { Point } from './paths';

/**
 * La grilla de casilleros a la que vuelven los enemigos.
 *
 * Mientras entran, la formación se balancea de lado a lado; con todos
 * adentro, además "respira": se abre y se cierra. Los casilleros se mueven
 * con ella, así que una nave que vuelve persigue un punto en movimiento.
 */
export class Formation {
	time = 0;
	/** Va de 0 a 1 cuando termina la entrada, para que la respiración no arranque de golpe. */
	breathing = 0;
	settled = false;

	step(dt: number) {
		this.time += dt;
		const target = this.settled ? 1 : 0;
		this.breathing += Math.sign(target - this.breathing) * Math.min(Math.abs(target - this.breathing), dt * 0.5);
	}

	reset() {
		this.time = 0;
		this.breathing = 0;
		this.settled = false;
	}

	/** Dónde está hoy el casillero. */
	slot(col: number, row: number): Point {
		const spread = 1 + FORMATION.breath * this.breathing * Math.sin(this.time * FORMATION.breathSpeed);
		const sway = FORMATION.sway * Math.sin(this.time * FORMATION.swaySpeed);
		const base = this.baseSlot(col, row);
		return {
			x: FIELD_W / 2 + (base.x - FIELD_W / 2) * spread + sway,
			y: FORMATION.top + (base.y - FORMATION.top) * (1 + (spread - 1) * 0.6),
		};
	}

	/** El casillero quieto, sin balanceo: el destino de las trayectorias de entrada. */
	baseSlot(col: number, row: number): Point {
		return {
			x: FIELD_W / 2 + (col - (FORMATION.cols - 1) / 2) * FORMATION.colGap,
			y: FORMATION.top + row * FORMATION.rowGap,
		};
	}
}
