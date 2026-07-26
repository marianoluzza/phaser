import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const audioConfig = JSON.parse(
	await readFile(path.join(projectRoot, 'cloudflare', 'audio-assets.json'), 'utf8'),
);
const audioRoot = path.resolve(projectRoot, audioConfig.sourceDirectory);
const bucketName = process.env.R2_AUDIO_BUCKET ?? audioConfig.bucketName;
const concurrency = 3;
const maxAttempts = 3;
const uploadTimeoutMs = 60_000;

async function findOggFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const nestedFiles = await Promise.all(
		entries.map(async (entry) => {
			const entryPath = path.join(directory, entry.name);
			if (entry.isDirectory()) {
				return findOggFiles(entryPath);
			}

			return entry.isFile()
				&& entry.name.toLowerCase().endsWith('.ogg')
				&& entry.name.toLowerCase() !== 'preview.ogg'
				? [entryPath]
				: [];
		}),
	);

	return nestedFiles.flat();
}

function runWranglerUpload(filePath, relativePath, objectPath) {
	// Ejecutar el módulo de Wrangler con el mismo Node evita depender del shell
	// y funciona también cuando la ruta del proyecto contiene espacios.
	const executable = process.execPath;
	const args = [
		path.join(projectRoot, 'node_modules', 'wrangler', 'bin', 'wrangler.js'),
		'r2',
		'object',
		'put',
		objectPath,
		'--file',
		filePath,
		'--content-type',
		'audio/ogg',
		'--cache-control',
		'public, max-age=31536000, immutable',
		'--remote',
		'--force',
	];

	return new Promise((resolve, reject) => {
		const child = spawn(executable, args, {
			cwd: projectRoot,
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		let commandOutput = '';
		let settled = false;
		const timeout = setTimeout(() => {
			if (settled) {
				return;
			}

			settled = true;
			child.kill();
			reject(new Error(`Timeout al subir ${relativePath}.`));
		}, uploadTimeoutMs);

		child.stdout.on('data', (chunk) => {
			commandOutput += chunk.toString();
		});
		child.stderr.on('data', (chunk) => {
			commandOutput += chunk.toString();
		});
		child.on('error', (error) => {
			if (settled) {
				return;
			}

			settled = true;
			clearTimeout(timeout);
			reject(error);
		});
		child.on('close', (exitCode) => {
			if (settled) {
				return;
			}

			settled = true;
			clearTimeout(timeout);
			if (exitCode === 0) {
				resolve(relativePath);
				return;
			}

			reject(new Error(`No se pudo subir ${relativePath}:\n${commandOutput}`));
		});
	});
}

async function uploadFile(filePath) {
	const relativePath = path.relative(audioRoot, filePath).split(path.sep).join('/');
	const objectPath = `${bucketName}/audio/${relativePath}`;

	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		try {
			return await runWranglerUpload(filePath, relativePath, objectPath);
		} catch (error) {
			if (attempt === maxAttempts) {
				throw error;
			}

			console.warn(`Reintento ${attempt}/${maxAttempts - 1}: ${relativePath}`);
			await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
		}
	}

	throw new Error(`No se pudo subir ${relativePath}.`);
}

const files = (await findOggFiles(audioRoot)).sort((left, right) =>
	left.localeCompare(right, 'en'),
);
let nextFileIndex = 0;
let uploadedCount = 0;
const failedUploads = [];

async function worker() {
	while (nextFileIndex < files.length) {
		const fileIndex = nextFileIndex;
		nextFileIndex += 1;
		try {
			const relativePath = await uploadFile(files[fileIndex]);
			uploadedCount += 1;
			console.log(`[${uploadedCount}/${files.length}] ${relativePath}`);
		} catch (error) {
			failedUploads.push(error);
			console.error(error instanceof Error ? error.message : error);
		}
	}
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

if (failedUploads.length > 0) {
	throw new Error(`${failedUploads.length} archivos no pudieron subirse.`);
}

console.log(`Carga completa: ${uploadedCount} archivos en ${bucketName}.`);
