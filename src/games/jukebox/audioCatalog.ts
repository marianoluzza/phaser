export type AudioKind = 'music' | 'sfx';

export type AudioAssetDefinition = {
	id: string;
	name: string;
	url: string;
	source: string;
	collection: string;
	license: string;
};

export type AudioCatalog = Record<AudioKind, AudioAssetDefinition[]>;

export const AUDIO_CATALOG_CACHE_KEY = 'jukebox:catalog';
export const AUDIO_CATALOG_URL = '/assets/audio/catalog.json';
