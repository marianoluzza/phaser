import type { GameDefinition } from '../../core/gameCatalog';
import { JukeboxScene } from './scenes/JukeboxScene';
import { JUKEBOX_SCENES } from './sceneKeys';

/** Manifiesto público del laboratorio de audio. */
export const jukeboxGame: GameDefinition = {
	id: 'jukebox',
	titleKey: 'jukebox.catalog.title',
	descriptionKey: 'jukebox.catalog.description',
	controlsKey: 'jukebox.catalog.controls',
	accentColor: 0xff5fb7,
	coverType: 'jukebox',
	entrySceneKey: JUKEBOX_SCENES.MAIN,
	scenes: [JukeboxScene],
};
