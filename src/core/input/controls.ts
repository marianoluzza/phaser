import Phaser from 'phaser';

/**
 * El esquema de controles común a todo el arcade: teclado y mando juntos, con
 * el mismo botón haciendo lo mismo en cada juego (docs/tareas/mando.md).
 *
 * Las escenas preguntan por acciones (`left`, `confirm`, `pause`...) y no por
 * teclas ni botones. Las direcciones son flechas, WASD, cruceta y stick
 * izquierdo; cada juego suma sus acciones propias con una tecla y un botón, y
 * puede sacar del esquema las teclas que usa para otra cosa (`withoutKeys`).
 *
 * El mando se lee con la Gamepad API del navegador, una vez por frame. No se
 * usa el plugin de mandos de Phaser: hay que encenderlo en la configuración del
 * juego, crea una instancia por escena y necesita el evento `gamepadconnected`;
 * leer `navigator.getGamepads()` alcanza y es lo que hace el plugin por dentro.
 */

/** Botones del mapeo `standard` del navegador, con nombres de un mando de Xbox. */
const PAD_BUTTONS = {
	a: 0,
	b: 1,
	x: 2,
	y: 3,
	l1: 4,
	r1: 5,
	l2: 6,
	r2: 7,
	select: 8,
	start: 9,
	up: 12,
	down: 13,
	left: 14,
	right: 15,
} as const;

export type PadButton = keyof typeof PAD_BUTTONS;

export type KeyName = keyof typeof Phaser.Input.Keyboard.KeyCodes;

export type Binding = {
	/** Nombres de `Phaser.Input.Keyboard.KeyCodes`, como `'SPACE'` o `'Z'`. */
	keys: KeyName[];
	pad: PadButton[];
};

export type ControlsOptions = {
	/**
	 * Teclas que el juego usa para otra cosa y salen del esquema común. El
	 * Truco elige carta con A, S y D: sin WASD, sus direcciones quedan en las
	 * flechas y el mando.
	 */
	withoutKeys?: KeyName[];
};

const COMMON = {
	left: { keys: ['LEFT', 'A'], pad: ['left'] },
	right: { keys: ['RIGHT', 'D'], pad: ['right'] },
	up: { keys: ['UP', 'W'], pad: ['up'] },
	down: { keys: ['DOWN', 'S'], pad: ['down'] },
	/** Menús y carteles de «seguir». */
	confirm: { keys: ['ENTER'], pad: ['a', 'start'] },
	/** Menús: volver a la pantalla anterior. */
	back: { keys: ['ESC'], pad: ['b', 'select'] },
	/** Partida: la acción principal. */
	action: { keys: ['SPACE'], pad: ['a'] },
	pause: { keys: ['P'], pad: ['start'] },
	/** Partida: salir al menú. B no, porque en la partida es una acción. */
	menu: { keys: ['ESC'], pad: ['select'] },
} as const satisfies Record<string, Binding>;

export type CommonAction = keyof typeof COMMON;

/** Cuánto hay que inclinar el stick para que cuente como una dirección. */
const STICK_THRESHOLD = 0.5;

function connectedPads(): Gamepad[] {
	const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
	return pads.filter((pad): pad is Gamepad => pad?.connected === true);
}

/** Las direcciones del stick inclinadas más allá del umbral, cada eje por su lado. */
function stickDirections(pad: Gamepad): PadButton[] {
	const x = pad.axes[0] ?? 0;
	const y = pad.axes[1] ?? 0;
	const directions: PadButton[] = [];
	if (Math.abs(x) >= STICK_THRESHOLD) directions.push(x > 0 ? 'right' : 'left');
	if (Math.abs(y) >= STICK_THRESHOLD) directions.push(y > 0 ? 'down' : 'up');
	return directions;
}

/** Sólo la dirección del eje más inclinado del stick. */
function stickMainDirection(pad: Gamepad): PadButton | null {
	const x = pad.axes[0] ?? 0;
	const y = pad.axes[1] ?? 0;
	if (Math.max(Math.abs(x), Math.abs(y)) < STICK_THRESHOLD) return null;
	if (Math.abs(x) > Math.abs(y)) return x > 0 ? 'right' : 'left';
	return y > 0 ? 'down' : 'up';
}

/**
 * Qué botones están apretados en cualquier mando; el stick cuenta como cruceta.
 *
 * El stick se lee de dos maneras. Mantenido (`held`), cada eje cuenta por su
 * lado: en diagonal la nave de Galáctica se mueve en los dos ejes. Como
 * pulsación (`pressed`), sólo cuenta el eje más inclinado: si no, en Tetris
 * rotaba la pieza al moverla en diagonal hacia arriba, y en Semáforos el
 * stick cambiaba dos semáforos a la vez al pasar de arriba a la derecha.
 */
function readPads(): { held: Set<PadButton>; pressed: Set<PadButton> } {
	const held = new Set<PadButton>();
	const pressed = new Set<PadButton>();
	for (const pad of connectedPads()) {
		for (const [name, index] of Object.entries(PAD_BUTTONS) as [PadButton, number][]) {
			if (pad.buttons[index]?.pressed) {
				held.add(name);
				pressed.add(name);
			}
		}
		for (const direction of stickDirections(pad)) held.add(direction);
		const main = stickMainDirection(pad);
		if (main) pressed.add(main);
	}
	return { held, pressed };
}

export class Controls<Extra extends string = never> {
	private readonly scene: Phaser.Scene;
	private readonly bindings: Record<CommonAction | Extra, Binding>;
	private readonly keys = new Map<CommonAction | Extra, Phaser.Input.Keyboard.Key[]>();
	/** Teclas que bajaron desde la última lectura: un toque más corto que un frame no se pierde. */
	private readonly tapped = new Set<CommonAction | Extra>();
	private pressed = new Set<CommonAction | Extra>();
	private padNow: { held: Set<PadButton>; pressed: Set<PadButton> };
	private padBefore: { held: Set<PadButton>; pressed: Set<PadButton> };
	private frame: number;

	constructor(scene: Phaser.Scene, extra = {} as Record<Extra, Binding>, options: ControlsOptions = {}) {
		this.scene = scene;
		const without = new Set(options.withoutKeys ?? []);
		this.bindings = Object.fromEntries(
			Object.entries<Binding>({ ...COMMON, ...extra }).map(([action, { keys, pad }]) => [
				action,
				{ keys: keys.filter((key) => !without.has(key)), pad },
			])
		) as Record<CommonAction | Extra, Binding>;
		const keyboard = scene.input.keyboard!;
		for (const [action, binding] of Object.entries(this.bindings) as [CommonAction | Extra, Binding][]) {
			const keys = binding.keys.map((name) => keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[name]));
			// Una tecla compartida por dos acciones avisa a las dos. Las teclas se
			// destruyen con la escena, y con ellas estos oyentes.
			for (const key of keys) key.on(Phaser.Input.Keyboard.Events.DOWN, () => this.tapped.add(action));
			this.keys.set(action, keys);
		}
		// Lo que ya venía apretado de la escena anterior no es una pulsación nueva.
		this.padNow = readPads();
		this.padBefore = this.padNow;
		this.frame = scene.game.loop.frame;
	}

	/** Mantenida: para moverse o cualquier cosa que dure. */
	isDown(action: CommonAction | Extra): boolean {
		this.sample();
		return (
			this.keys.get(action)!.some((key) => key.isDown) ||
			this.bindings[action].pad.some((button) => this.padNow.held.has(button))
		);
	}

	/** Recién apretada en este frame, por teclado o por mando. */
	justDown(action: CommonAction | Extra): boolean {
		this.sample();
		return this.pressed.has(action);
	}

	/** Las direcciones como -1, 0 o 1 en cada eje. */
	direction(): { x: number; y: number } {
		return {
			x: Number(this.isDown('right')) - Number(this.isDown('left')),
			y: Number(this.isDown('down')) - Number(this.isDown('up')),
		};
	}

	/** Se lee una vez por frame, la primera vez que la escena pregunta. */
	private sample() {
		const { frame } = this.scene.game.loop;
		if (frame === this.frame) return;
		this.frame = frame;
		this.padBefore = this.padNow;
		this.padNow = readPads();
		this.pressed = new Set(this.tapped);
		this.tapped.clear();
		for (const [action, binding] of Object.entries(this.bindings) as [CommonAction | Extra, Binding][]) {
			const { pressed } = this.padNow;
			const before = this.padBefore.pressed;
			if (binding.pad.some((button) => pressed.has(button) && !before.has(button))) this.pressed.add(action);
		}
	}
}
