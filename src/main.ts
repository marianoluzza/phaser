import './instrument';
import Phaser from 'phaser';
import './style.css';
import { GAME_SCENES } from './core/gameCatalog';
import { LauncherScene } from './core/scenes/LauncherScene';

/**
 * Punto de entrada de la aplicación.
 *
 * Phaser crea un único canvas y va intercambiando escenas dentro de él. El
 * La primera escena arranca automáticamente. Cada juego aporta después sus
 * propias escenas mediante el manifiesto registrado en el catálogo.
 */
const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#080d1a',
  parent: 'app',
  scene: [LauncherScene, ...GAME_SCENES],
  scale: {
    // FIT conserva la proporción del juego en pantallas chicas.
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
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
