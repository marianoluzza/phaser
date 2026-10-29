/**
 * Regenera las hojas de sprites a partir de las fuentes de pxl.
 *
 *   npm run art              # todos los juegos con carpeta en art/
 *   npm run art -- galactica # sólo uno
 *
 * Cada `art/<juego>/*.px.js` que declare un `sheet()` produce un PNG y un JSON
 * (formato de TexturePacker, el que Phaser carga con `load.atlas`). Las hojas
 * se copian a `public/assets/<juego>/` y se versionan: así el build y el deploy
 * no dependen de pxl, que vive en las skills de Claude y no en el repositorio.
 *
 * Si pxl está en otro lugar, se indica con la variable PXL.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PXL = process.env.PXL ?? join(homedir(), '.claude', 'skills', 'pxl-pixel-art', 'bin', 'pxl.js');
const ART_DIR = 'art';
const CACHE_DIR = join('node_modules', '.cache', 'pxl');

if (!existsSync(PXL)) {
	console.error(`No se encontró pxl en ${PXL}. Indicá dónde está con PXL=/ruta/a/pxl.js.`);
	process.exit(1);
}

const requested = process.argv.slice(2);
const games = readdirSync(ART_DIR, { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name)
	.filter((name) => requested.length === 0 || requested.includes(name));

for (const game of games) {
	const sources = readdirSync(join(ART_DIR, game)).filter((file) => file.endsWith('.px.js'));
	const target = join('public', 'assets', game);
	mkdirSync(target, { recursive: true });

	for (const source of sources) {
		const out = join(CACHE_DIR, game, source.replace('.px.js', ''));
		rmSync(out, { recursive: true, force: true });
		execFileSync(process.execPath, [PXL, 'build', join(ART_DIR, game, source), '--out', out, '--no-preview'], {
			stdio: ['ignore', 'ignore', 'inherit'],
		});

		// Un archivo que sólo define la paleta o piezas compartidas no escribe nada.
		if (!existsSync(out)) {
			continue;
		}
		// Las hojas quedan en la raíz de la salida; los sprites sueltos, en subcarpetas.
		const sheets = readdirSync(out).filter((file) => file.endsWith('.json'));
		for (const json of sheets) {
			const name = json.replace('.json', '');
			copyFileSync(join(out, json), join(target, json));
			copyFileSync(join(out, `${name}.png`), join(target, `${name}.png`));
			console.log(`${game}/${name}  ←  ${source}`);
		}
	}
}
