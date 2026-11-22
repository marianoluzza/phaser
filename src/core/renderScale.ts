import Phaser from 'phaser';

/**
 * Tamaño y nitidez del canvas.
 *
 * Ancho elástico. La altura del mundo es siempre de 600 unidades y el ancho
 * acompaña la proporción de la ventana, desde 800 (4:3) hasta `MAX_WIDTH`
 * (2:1). Es lo que en Godot se llama `keep_height`: en una pantalla más ancha
 * no se agranda nada, se ve más mundo a los costados.
 *
 * Las escenas se diseñaron en 800×600 y ésa sigue siendo su área por defecto:
 * la cámara la centra y a los costados queda el fondo. Una escena que sabe
 * aprovechar el ancho real lo declara con `useFullWidth` y se ubica con
 * `GAME_WIDTH`.
 *
 * Nitidez. Si el canvas tuviera 800×600 píxeles reales, `Scale.FIT` lo
 * estiraría por CSS hasta llenar la ventana y el navegador interpolaría cada
 * píxel: los trazos finos, sobre todo los textos chicos, quedarían borrosos.
 * En cambio el canvas se crea con tantos píxeles como ocupará en pantalla
 * (tamaño de la ventana × densidad del monitor) y la cámara principal de cada
 * escena hace zoom en la misma proporción (`RENDER_SCALE`).
 *
 * Las dos cosas se recalculan al cambiar el tamaño de la ventana, al entrar en
 * pantalla completa o al girar un celular (ver `relayout`).
 */
export const DESIGN_WIDTH = 800;
export const DESIGN_HEIGHT = 600;
export const MAX_WIDTH = 1200;

/** Ancho del mundo visible, entre `DESIGN_WIDTH` y `MAX_WIDTH`. */
export let GAME_WIDTH = DESIGN_WIDTH;
/** Píxeles del canvas por unidad del mundo. */
export let RENDER_SCALE = 1;

/** Se emite en cada escena viva después de un cambio de tamaño. */
export const LAYOUT_EVENT = 'core:layout';

applyLayout(computeLayout());

function computeLayout() {
	const aspect = window.innerWidth / window.innerHeight;
	const width = Math.round(Phaser.Math.Clamp(DESIGN_HEIGHT * aspect, DESIGN_WIDTH, MAX_WIDTH));
	const fit = Math.min(window.innerWidth / width, window.innerHeight / DESIGN_HEIGHT);
	// Por debajo de 1 el canvas sólo perdería detalle; por encima de 3 gasta
	// memoria en píxeles que ningún monitor común llega a mostrar.
	const scale = Phaser.Math.Clamp(fit * (window.devicePixelRatio || 1), 1, 3);
	// Múltiplos de 1/200 dan un alto de canvas entero (600 × n/200 = 3n).
	return { width, scale: Math.round(scale * 200) / 200 };
}

function applyLayout(layout: { width: number; scale: number }) {
	GAME_WIDTH = layout.width;
	RENDER_SCALE = layout.scale;
}

export function canvasSize() {
	return {
		width: Math.round(GAME_WIDTH * RENDER_SCALE),
		height: Math.round(DESIGN_HEIGHT * RENDER_SCALE),
	};
}

const plugins = new Map<Phaser.Scene, RenderScalePlugin>();

/**
 * Recalcula el ancho y la escala y se los aplica al juego y a todas las
 * escenas vivas. `main.ts` lo llama cuando la ventana termina de cambiar de
 * tamaño.
 */
export function relayout(game: Phaser.Game) {
	const layout = computeLayout();
	if (layout.width === GAME_WIDTH && layout.scale === RENDER_SCALE) {
		return;
	}

	applyLayout(layout);
	const { width, height } = canvasSize();
	game.scale.setGameSize(width, height);

	for (const plugin of plugins.values()) {
		plugin.relayout();
	}
}

/**
 * La escena dibuja sobre el ancho completo (`GAME_WIDTH`) en vez de sobre el
 * área clásica de 800 centrada. Se llama desde `create`.
 *
 * `onLayout` corre cuando cambia el ancho. Por defecto la escena se reinicia,
 * que alcanza para un menú; una partida en curso tiene que reubicar sus
 * objetos sin perder el estado.
 */
export function useFullWidth(scene: Phaser.Scene, onLayout: () => void = () => scene.scene.restart()) {
	plugins.get(scene)?.fillWidth(onLayout);
}

/**
 * Rectángulo de la escena en píxeles del canvas, para el viewport de una
 * cámara extra. Tiene en cuenta el zoom y el corrimiento de la principal.
 */
export function canvasRect(scene: Phaser.Scene, x: number, y: number, width: number, height: number) {
	const main = scene.cameras.main;
	return [
		(x - main.scrollX) * main.zoom,
		(y - main.scrollY) * main.zoom,
		width * main.zoom,
		height * main.zoom,
	] as const;
}

/**
 * Plugin instalado en todas las escenas: ubica y hace zoom en la cámara
 * principal y rasteriza cada texto a la escala real. Sin esto último, el
 * texto se dibujaría a 800×600 y la cámara lo agrandaría igual de borroso.
 *
 * Las cámaras extra que cree una escena (como el visor de la configuración de
 * Pipes) toman su viewport de `canvasRect` y su zoom de `RENDER_SCALE`; al
 * cambiar el tamaño, el plugin las corre y escala junto con la principal.
 */
export class RenderScalePlugin extends Phaser.Plugins.ScenePlugin {
	private onLayout: (() => void) | null = null;

	boot() {
		plugins.set(this.scene!, this);
		const events = this.systems!.events;
		// READY llega después de que el CameraManager crea la cámara principal
		// y antes de `create`, que es donde la escena puede pedir el ancho completo.
		events.on(Phaser.Scenes.Events.READY, this.placeMainCamera, this);
		events.on(Phaser.Scenes.Events.SHUTDOWN, () => (this.onLayout = null));
		events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, this.sharpenText, this);
		events.once(Phaser.Scenes.Events.DESTROY, () => plugins.delete(this.scene!));
	}

	fillWidth(onLayout: () => void) {
		this.onLayout = onLayout;
		this.placeMainCamera();
	}

	relayout() {
		const sys = this.systems!;
		if (!sys.isActive() && !sys.isPaused() && !sys.isSleeping()) {
			// Una escena apagada se ubica sola en su próximo READY.
			return;
		}

		const main = sys.cameras.main;
		const before = { zoom: main.zoom, scrollX: main.scrollX, scrollY: main.scrollY };
		this.placeMainCamera();
		main.setSize(canvasSize().width, canvasSize().height);

		// Cada cámara extra conserva el rectángulo de la escena que cubría.
		const ratio = main.zoom / before.zoom;
		for (const camera of sys.cameras.cameras) {
			if (camera === main) continue;
			const x = camera.x / before.zoom + before.scrollX;
			const y = camera.y / before.zoom + before.scrollY;
			camera
				.setViewport(
					(x - main.scrollX) * main.zoom,
					(y - main.scrollY) * main.zoom,
					camera.width * ratio,
					camera.height * ratio
				)
				.setZoom(camera.zoom * ratio);
		}

		this.sharpenAllText(sys.displayList.list);
		this.onLayout?.();
		sys.events.emit(LAYOUT_EVENT);
	}

	private placeMainCamera() {
		// Con origen en la esquina, el scroll es el punto del mundo que queda en
		// la esquina superior izquierda: negativo, centra el área de 800.
		const offset = this.onLayout ? 0 : (GAME_WIDTH - DESIGN_WIDTH) / 2;
		this.systems!.cameras.main.setOrigin(0).setZoom(RENDER_SCALE).setScroll(-offset, 0);
	}

	private sharpenText(gameObject: Phaser.GameObjects.GameObject) {
		if (gameObject instanceof Phaser.GameObjects.Text) {
			gameObject.setResolution(RENDER_SCALE);
		}
	}

	private sharpenAllText(list: Phaser.GameObjects.GameObject[]) {
		for (const gameObject of list) {
			if (gameObject instanceof Phaser.GameObjects.Container) {
				this.sharpenAllText(gameObject.list);
			} else {
				this.sharpenText(gameObject);
			}
		}
	}
}
