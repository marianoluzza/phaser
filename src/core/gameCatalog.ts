import type Phaser from 'phaser';
import { jukeboxGame } from '../games/jukebox';
import { tetrisGame } from '../games/tetris';
import { trucoGame } from '../games/truco';
import type { TranslationKey } from './i18n/i18n';

/**
 * Contrato que debe cumplir cualquier juego instalable en el arcade.
 *
 * El launcher usa los datos visuales y `entrySceneKey`. `main.ts` utiliza
 * `scenes` para registrar todas las pantallas internas sin conocerlas una a una.
 */
export type GameDefinition = {
	id: string;
	titleKey: TranslationKey;
	descriptionKey: TranslationKey;
	controlsKey: TranslationKey;
	accentColor: number;
	coverType: 'tetris' | 'jukebox' | 'truco';
	/** Primera pantalla que se abre al elegir el juego desde el launcher. */
	entrySceneKey: string;
	/** Clases de Scene que Phaser debe registrar para ejecutar el juego. */
	scenes: Phaser.Types.Scenes.SceneType[];
};

/**
 * Catálogo de juegos disponibles.
 *
 * Agregar un juego consiste en importar su manifiesto y sumarlo a este array.
 * El resto de la aplicación obtiene de acá tanto las fichas como las escenas.
 */
export const GAME_CATALOG: GameDefinition[] = [tetrisGame, trucoGame, jukeboxGame];

/** Lista plana que se entrega a la configuración inicial de Phaser. */
export const GAME_SCENES = GAME_CATALOG.flatMap((game) => game.scenes);
