import type { GameDefinition } from '../../core/gameCatalog';
import { TetrisGameOverScene } from './scenes/TetrisGameOverScene';
import { TetrisGameScene } from './scenes/TetrisGameScene';
import { TetrisTitleScene } from './scenes/TetrisTitleScene';
import { TETRIS_SCENES } from './sceneKeys';

/**
 * Manifiesto público de Tetris.
 * Éste es el único archivo que el catálogo general necesita importar.
 */
export const tetrisGame: GameDefinition = {
	id: 'tetris',
	titleKey: 'tetris.catalog.title',
	descriptionKey: 'tetris.catalog.description',
	controlsKey: 'tetris.catalog.controls',
	accentColor: 0x46d9ff,
	coverType: 'tetris',
	entrySceneKey: TETRIS_SCENES.TITLE,
	scenes: [TetrisTitleScene, TetrisGameScene, TetrisGameOverScene],
};
