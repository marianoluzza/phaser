import './instrument';
import Phaser from 'phaser';
import './style.css';
import { GAME_SCENES } from './core/gameCatalog';
import { LauncherScene } from './core/scenes/LauncherScene';
import { canvasSize, relayout, RenderScalePlugin } from './core/renderScale';

/**
 * Punto de entrada de la aplicación.
 *
 * Phaser crea un único canvas y va intercambiando escenas dentro de él. El
 * La primera escena arranca automáticamente. Cada juego aporta después sus
 * propias escenas mediante el manifiesto registrado en el catálogo.
 */
const game = new Phaser.Game({
  type: Phaser.AUTO,
  // El canvas tiene la resolución real de pantalla; ver core/renderScale.ts.
  ...canvasSize(),
  // Evita posiciones en medio píxel, que reparten cada trazo en dos columnas.
  roundPixels: true,
  backgroundColor: '#080d1a',
  parent: 'app',
  scene: [LauncherScene, ...GAME_SCENES],
  scale: {
    // FIT conserva la proporción mientras el ancho del mundo se pone al día
    // con la ventana, y en ventanas más angostas que 4:3 o más anchas que 2:1.
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    // La pantalla completa abarca el fondo de la página, no sólo el canvas.
    fullscreenTarget: 'app',
  },
  plugins: {
    scene: [{ key: 'RenderScalePlugin', plugin: RenderScalePlugin, mapping: 'renderScale' }],
  },
});

/**
 * Mientras se arrastra el borde de la ventana, `Scale.FIT` estira el canvas
 * que ya hay. Recién cuando se queda quieta se recalculan el ancho del mundo y
 * la resolución: cada recálculo reinicia los menús y vuelve a rasterizar los
 * textos.
 */
let resizeTimer = 0;
window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => relayout(game), 150);
});

/**
 * En desarrollo el juego queda accesible desde la consola y desde el driver de
 * `npm run shots`, que necesita preguntarle a Phaser qué escena está activa.
 * El build de producción no expone nada.
 */
if (import.meta.env.DEV) {
  (window as unknown as { arcade: Phaser.Game }).arcade = game;
}
