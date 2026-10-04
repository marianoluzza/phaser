import type { GameDefinition } from '../../core/gameCatalog';
import { AstroChessCombatScene } from './scenes/AstroChessCombatScene';
import { AstroChessShipScene } from './scenes/AstroChessShipScene';
import { AstroChessTitleScene } from './scenes/AstroChessTitleScene';
import { ASTRO_SCENES } from './sceneKeys';

/**
 * Manifiesto público de Astro Chess.
 * Éste es el único archivo que el catálogo general necesita importar.
 */
export const astroChessGame: GameDefinition = {
	id: 'astro-chess',
	titleKey: 'astro.catalog.title',
	descriptionKey: 'astro.catalog.description',
	controlsKey: 'astro.catalog.controls',
	accentColor: 0xc66cff,
	coverType: 'astro-chess',
	entrySceneKey: ASTRO_SCENES.TITLE,
	scenes: [AstroChessTitleScene, AstroChessShipScene, AstroChessCombatScene],
};
