import type { GameDefinition } from '../../core/gameCatalog';
import { PipesConfigScene } from './scenes/PipesConfigScene';
import { PipesGameScene } from './scenes/PipesGameScene';
import { PipesRoundEndScene } from './scenes/PipesRoundEndScene';
import { PipesTitleScene } from './scenes/PipesTitleScene';
import { PIPES_SCENES } from './sceneKeys';

/**
 * Manifiesto público de Pipes.
 * Éste es el único archivo que el catálogo general necesita importar.
 */
export const pipesGame: GameDefinition = {
	id: 'pipes',
	titleKey: 'pipes.catalog.title',
	descriptionKey: 'pipes.catalog.description',
	controlsKey: 'pipes.catalog.controls',
	accentColor: 0x5ee48a,
	coverType: 'pipes',
	entrySceneKey: PIPES_SCENES.TITLE,
	scenes: [PipesTitleScene, PipesGameScene, PipesRoundEndScene, PipesConfigScene],
};
