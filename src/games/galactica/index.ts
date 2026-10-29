import type { GameDefinition } from '../../core/gameCatalog';
import { GalacticaGameScene } from './scenes/GalacticaGameScene';
import { GalacticaPediaScene } from './scenes/GalacticaPediaScene';
import { GalacticaResultScene } from './scenes/GalacticaResultScene';
import { GalacticaTitleScene } from './scenes/GalacticaTitleScene';
import { GALACTICA_SCENES } from './sceneKeys';

/**
 * Manifiesto público de Galáctica.
 * Éste es el único archivo que el catálogo general necesita importar.
 */
export const galacticaGame: GameDefinition = {
	id: 'galactica',
	titleKey: 'galactica.catalog.title',
	descriptionKey: 'galactica.catalog.description',
	controlsKey: 'galactica.catalog.controls',
	accentColor: 0x7fe0ff,
	coverType: 'galactica',
	entrySceneKey: GALACTICA_SCENES.TITLE,
	scenes: [GalacticaTitleScene, GalacticaPediaScene, GalacticaGameScene, GalacticaResultScene],
};
