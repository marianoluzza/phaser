export type Point = { x: number; y: number };

/**
 * Trayectoria suave que pasa por todos sus puntos de control (Catmull-Rom).
 *
 * Se muestrea una vez en una polilínea y se recorre por distancia, no por el
 * parámetro de la curva: así la nave va a velocidad pareja aunque los puntos
 * estén desparejos, y la misma curva sirve a cualquier velocidad.
 */
export class Path {
	private readonly points: Point[] = [];
	private readonly distances: number[] = [];
	readonly length: number;

	constructor(controls: Point[], samplesPerSegment = 14) {
		const padded = [controls[0], ...controls, controls[controls.length - 1]];
		for (let index = 1; index < padded.length - 2; index += 1) {
			const [p0, p1, p2, p3] = [padded[index - 1], padded[index], padded[index + 1], padded[index + 2]];
			for (let step = 0; step < samplesPerSegment; step += 1) {
				this.points.push(catmullRom(p0, p1, p2, p3, step / samplesPerSegment));
			}
		}
		this.points.push(controls[controls.length - 1]);

		let total = 0;
		this.distances.push(0);
		for (let index = 1; index < this.points.length; index += 1) {
			total += Math.hypot(this.points[index].x - this.points[index - 1].x, this.points[index].y - this.points[index - 1].y);
			this.distances.push(total);
		}
		this.length = total;
	}

	/** Posición y rumbo (radianes) a cierta distancia del inicio. */
	at(distance: number): Point & { heading: number } {
		const d = Math.max(0, Math.min(distance, this.length));
		let low = 0;
		let high = this.distances.length - 1;
		while (high - low > 1) {
			const mid = (low + high) >> 1;
			if (this.distances[mid] <= d) {
				low = mid;
			} else {
				high = mid;
			}
		}
		const a = this.points[low];
		const b = this.points[high];
		const span = this.distances[high] - this.distances[low] || 1;
		const t = (d - this.distances[low]) / span;
		return {
			x: a.x + (b.x - a.x) * t,
			y: a.y + (b.y - a.y) * t,
			heading: Math.atan2(b.y - a.y, b.x - a.x),
		};
	}
}

function catmullRom(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
	const t2 = t * t;
	const t3 = t2 * t;
	const blend = (a: number, b: number, c: number, d: number) =>
		0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
	return { x: blend(p0.x, p1.x, p2.x, p3.x), y: blend(p0.y, p1.y, p2.y, p3.y) };
}
