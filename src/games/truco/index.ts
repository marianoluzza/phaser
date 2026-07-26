import type { GameDefinition } from '../../core/gameCatalog';
import { TrucoGameOverScene } from './scenes/TrucoGameOverScene';
import { TrucoGameScene } from './scenes/TrucoGameScene';
import { TrucoTitleScene } from './scenes/TrucoTitleScene';
import { TRUCO_SCENES } from './sceneKeys';

/** Manifiesto público del juego de Truco. */
export const trucoGame: GameDefinition = {
	id: 'truco',
	titleKey: 'truco.catalog.title',
	descriptionKey: 'truco.catalog.description',
	controlsKey: 'truco.catalog.controls',
	accentColor: 0xf2b84b,
	coverType: 'truco',
	entrySceneKey: TRUCO_SCENES.TITLE,
	scenes: [TrucoTitleScene, TrucoGameScene, TrucoGameOverScene],
};
