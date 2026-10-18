import type { GameDefinition } from '../../core/gameCatalog';
import { TrafficGameOverScene } from './scenes/TrafficGameOverScene';
import { TrafficGameScene } from './scenes/TrafficGameScene';
import { TrafficTitleScene } from './scenes/TrafficTitleScene';
import { TRAFFIC_SCENES } from './sceneKeys';

/**
 * Manifiesto público de Semáforos.
 * Éste es el único archivo que el catálogo general necesita importar.
 */
export const trafficGame: GameDefinition = {
	id: 'traffic',
	titleKey: 'traffic.catalog.title',
	descriptionKey: 'traffic.catalog.description',
	controlsKey: 'traffic.catalog.controls',
	accentColor: 0x3ddc84,
	coverType: 'traffic',
	entrySceneKey: TRAFFIC_SCENES.TITLE,
	scenes: [TrafficTitleScene, TrafficGameScene, TrafficGameOverScene],
};
