import './instrument';
import Phaser from 'phaser';
import './style.css';
import { GAME_SCENES } from './core/gameCatalog';
import { LauncherScene } from './core/scenes/LauncherScene';
import {
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  RENDER_SCALE,
  RenderScalePlugin,
} from './core/renderScale';

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
  width: DESIGN_WIDTH * RENDER_SCALE,
  height: DESIGN_HEIGHT * RENDER_SCALE,
  // Evita posiciones en medio píxel, que reparten cada trazo en dos columnas.
  roundPixels: true,
  backgroundColor: '#080d1a',
  parent: 'app',
  scene: [LauncherScene, ...GAME_SCENES],
  scale: {
    // FIT conserva la proporción del juego en pantallas chicas.
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  plugins: {
    scene: [{ key: 'RenderScalePlugin', plugin: RenderScalePlugin, mapping: 'renderScale' }],
  },
});

/**
 * En desarrollo el juego queda accesible desde la consola y desde el driver de
 * `npm run shots`, que necesita preguntarle a Phaser qué escena está activa.
 * El build de producción no expone nada.
 */
if (import.meta.env.DEV) {
  (window as unknown as { arcade: Phaser.Game }).arcade = game;
}
