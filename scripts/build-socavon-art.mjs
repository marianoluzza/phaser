/**
 * Regenera el atlas de Socavón a partir de los specs de spritekiln.
 *
 *   npm run art:socavon
 *
 * Los specs viven en arte/spritekiln/art/specs y el atlas en
 * public/assets/socavon, que se versiona: el build y el deploy no necesitan
 * spritekiln. Se instala con `pipx install "spritekiln[mcp,fast]"`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const PROJECT = resolve('arte', 'spritekiln');
const SPECS = join(PROJECT, 'art', 'specs');
const ASSETS = [
	'characters/minero/minero.yaml',
	'characters/sereno/sereno.yaml',
	'props/objetos/objetos.yaml',
	'props/grandes/grandes.yaml',
	'props/tiles/tiles.yaml',
];
/** Un tile llena su cuadro a propósito, y spritekiln lo informa como corte. */
const EXPECTED_QA = { tiles: /clipped at the edge/ };

for (const asset of ASSETS) {
	const spec = join(SPECS, asset);
	const name = asset.split('/').at(-2);
	console.log(`spritekiln: ${name}`);
	execFileSync('spritekiln', ['render', spec], { cwd: PROJECT, stdio: ['ignore', 'ignore', 'inherit'] });

	const qa = JSON.parse(readFileSync(join(dirname(spec), 'out', name, 'qa.json'), 'utf8'));
	const errors = qa.errors.filter((error) => !EXPECTED_QA[name]?.test(error));
	if (errors.length) {
		console.error(`QA de ${name}:\n  ${errors.join('\n  ')}`);
		process.exit(1);
	}
}

// El empaquetador usa el Pillow que ya trae el venv de spritekiln.
const venvs = execFileSync('pipx', ['environment', '--value', 'PIPX_LOCAL_VENVS'], { encoding: 'utf8' }).trim();
const python = [
	join(venvs, 'spritekiln', 'Scripts', 'python.exe'),
	join(venvs, 'spritekiln', 'bin', 'python'),
].find(existsSync);
if (!python) {
	console.error(`No se encontró el Python de spritekiln en ${venvs}.`);
	process.exit(1);
}

execFileSync(
	python,
	['-I', resolve('scripts', 'pack-socavon-art.py'), SPECS, resolve('public', 'assets', 'socavon', 'mine'), ...ASSETS],
	{ stdio: 'inherit' }
);
