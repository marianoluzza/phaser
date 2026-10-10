import Phaser from 'phaser';

/**
 * Nitidez del canvas.
 *
 * Todas las escenas se diseñan en un espacio fijo de 800×600. Si el canvas
 * tuviera también 800×600 píxeles reales, `Scale.FIT` lo estiraría por CSS
 * hasta llenar la ventana y el navegador interpolaría cada píxel: los trazos
 * finos, sobre todo los textos chicos, quedarían borrosos.
 *
 * En cambio el canvas se crea con tantos píxeles como ocupará en pantalla
 * (tamaño de la ventana × densidad del monitor) y la cámara principal de cada
 * escena hace zoom en la misma proporción. Las escenas siguen escribiendo
 * coordenadas de 800×600; sólo cambia la cantidad de píxeles que las dibujan.
 *
 * La escala se calcula una vez al arrancar. Si después se agranda mucho la
 * ventana, el canvas vuelve a estirarse un poco hasta recargar la página.
 */
export const DESIGN_WIDTH = 800;
export const DESIGN_HEIGHT = 600;

export const RENDER_SCALE = computeRenderScale();

function computeRenderScale() {
	const fit = Math.min(window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT);
	// Por debajo de 1 el canvas sólo perdería detalle; por encima de 3 gasta
	// memoria en píxeles que ningún monitor común llega a mostrar.
	const scale = Phaser.Math.Clamp(fit * (window.devicePixelRatio || 1), 1, 3);
	// Múltiplos de 1/200 dan un canvas de 4n×3n: ancho y alto enteros.
	return Math.round(scale * 200) / 200;
}

/**
 * Plugin instalado en todas las escenas: hace zoom en la cámara principal y
 * rasteriza cada texto a la escala real. Sin esto último, el texto se dibujaría
 * a 800×600 y la cámara lo agrandaría igual de borroso que antes.
 *
 * Las cámaras extra que cree una escena (como el visor de la configuración de
 * Pipes) deben aplicar `RENDER_SCALE` por su cuenta.
 */
export class RenderScalePlugin extends Phaser.Plugins.ScenePlugin {
	boot() {
		const events = this.systems!.events;
		// READY llega después de que el CameraManager crea la cámara principal.
		events.on(Phaser.Scenes.Events.READY, this.zoomMainCamera, this);
		events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, this.sharpenText, this);
	}

	private zoomMainCamera() {
		// Con origen en la esquina, scroll 0 sigue mostrando el mundo desde (0, 0).
		this.systems!.cameras.main.setOrigin(0).setZoom(RENDER_SCALE);
	}

	private sharpenText(gameObject: Phaser.GameObjects.GameObject) {
		if (gameObject instanceof Phaser.GameObjects.Text) {
			gameObject.setResolution(RENDER_SCALE);
		}
	}
}
