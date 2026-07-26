import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const publicDirectory = path.join(projectRoot, 'public');
const catalogDirectory = path.join(publicDirectory, 'assets', 'audio');
const audioConfig = JSON.parse(
	await readFile(path.join(projectRoot, 'cloudflare', 'audio-assets.json'), 'utf8'),
);
const audioSourceDirectory = path.resolve(projectRoot, audioConfig.sourceDirectory);
const publicBaseUrl = (
	process.env.AUDIO_PUBLIC_BASE_URL ?? audioConfig.publicBaseUrl
).replace(/\/$/, '');

/**
 * Las colecciones guardan metadatos que no pueden deducirse del nombre del
 * archivo. Mantener esta lista explícita también obliga a revisar la licencia
 * antes de incorporar un pack nuevo al catálogo público.
 */
const collections = [
	{
		kind: 'music',
		directory: path.join(audioSourceDirectory, 'music', 'abstraction', '2026-q1'),
		source: 'Abstraction / Tallbeard Studios',
		collection: '2026 Q1',
		license: 'CC0',
	},
	{
		kind: 'music',
		directory: path.join(audioSourceDirectory, 'music', 'abstraction', '2026-q2'),
		source: 'Abstraction / Tallbeard Studios',
		collection: '2026 Q2',
		license: 'CC0',
	},
	{
		kind: 'sfx',
		directory: path.join(
			audioSourceDirectory,
			'sfx',
			'kenney',
			'interface-sounds',
			'Audio',
		),
		source: 'Kenney',
		collection: 'Interface Sounds',
		license: 'CC0',
	},
	{
		kind: 'sfx',
		directory: path.join(audioSourceDirectory, 'sfx', 'kenney', 'ui-audio', 'Audio'),
		source: 'Kenney',
		collection: 'UI Audio',
		license: 'CC0',
	},
];

function toPublicUrl(filePath) {
	const relativePath = path
		.relative(audioSourceDirectory, filePath)
		.split(path.sep)
		.join('/');
	return `${publicBaseUrl}/${relativePath}`;
}

function createAssetId(kind, url) {
	// La ruta forma un ID estable y evita colisiones entre dos archivos iguales.
	const hash = createHash('sha256').update(url).digest('hex').slice(0, 16);
	return `jukebox:${kind}:${hash}`;
}

async function createContentVersion(filePath) {
	// La versión viaja en la URL: si cambia un byte, navegador y CDN ven un
	// recurso nuevo aunque el objeto mantenga su ruta legible dentro de R2.
	const content = await readFile(filePath);
	return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

async function readCollection(definition) {
	const directoryEntries = await readdir(definition.directory, {
		withFileTypes: true,
	});

	const entries = directoryEntries
		.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.ogg'))
		.sort((left, right) => left.name.localeCompare(right.name, 'en'));

	return Promise.all(
		entries.map(async (entry) => {
			const filePath = path.join(definition.directory, entry.name);
			const version = await createContentVersion(filePath);
			const url = `${toPublicUrl(filePath)}?v=${version}`;

			return {
				id: createAssetId(definition.kind, url),
				name: path.parse(entry.name).name,
				url,
				source: definition.source,
				collection: definition.collection,
				license: definition.license,
			};
		}),
	);
}

const catalog = { music: [], sfx: [] };

for (const collection of collections) {
	const assets = await readCollection(collection);
	if (collection.kind === 'music') {
		catalog.music.push(...assets);
	} else {
		catalog.sfx.push(...assets);
	}
}

const catalogPath = path.join(catalogDirectory, 'catalog.json');
await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');

console.log(
	`Catálogo generado: ${catalog.music.length} músicas y ${catalog.sfx.length} efectos.`,
);
