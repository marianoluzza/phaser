import type { GameDefinition } from '../../core/gameCatalog';
import { TanksGameScene } from './scenes/TanksGameScene';
import { TanksResultScene } from './scenes/TanksResultScene';
import { TanksTitleScene } from './scenes/TanksTitleScene';
import { TANKS_SCENES } from './sceneKeys';

/**
 * Manifiesto público de Tanques.
 * Éste es el único archivo que el catálogo general necesita importar.
 */
export const tanksGame: GameDefinition = {
	id: 'tanks',
	titleKey: 'tanks.catalog.title',
	descriptionKey: 'tanks.catalog.description',
	controlsKey: 'tanks.catalog.controls',
	accentColor: 0xf2c14e,
	coverType: 'tanks',
	entrySceneKey: TANKS_SCENES.TITLE,
	scenes: [TanksTitleScene, TanksGameScene, TanksResultScene],
};
