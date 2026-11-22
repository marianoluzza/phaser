import type { GameDefinition } from '../../core/gameCatalog';
import { SocavonGameScene } from './scenes/SocavonGameScene';
import { SocavonResultScene } from './scenes/SocavonResultScene';
import { SocavonTitleScene } from './scenes/SocavonTitleScene';
import { SOCAVON_SCENES } from './sceneKeys';

/**
 * Manifiesto público de Socavón.
 * Éste es el único archivo que el catálogo general necesita importar.
 */
export const socavonGame: GameDefinition = {
	id: 'socavon',
	titleKey: 'socavon.catalog.title',
	descriptionKey: 'socavon.catalog.description',
	controlsKey: 'socavon.catalog.controls',
	accentColor: 0xf2bd36,
	coverType: 'socavon',
	entrySceneKey: SOCAVON_SCENES.TITLE,
	scenes: [SocavonTitleScene, SocavonGameScene, SocavonResultScene],
};
