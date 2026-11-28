import Phaser from 'phaser';
import { audioManager } from '../../../core/audio/AudioManager';
import { Controls } from '../../../core/input/controls';
import { i18n, type TranslationKey } from '../../../core/i18n/i18n';
import { GALACTICA_AUDIO, loadGalacticaAudio } from '../audio';
import { SHOTS, type Maneuver, type ShotKind } from '../constants/attacks';
import { BOSSES, ENEMIES, FAMILIES, FAMILY_FRAME, SHARD, type EnemySpec, type Family, type Rank } from '../constants/families';
import { FREIGHTER, PASSAGE_IDS, PASSAGE_SECONDS, STORM, type PassageId } from '../constants/passages';
import { SHIP_IDS, SHIPS, shipFrame } from '../constants/ships';
import { DAMAGE, EVOLUTION_CORES, FIELD_W, PLAYER_RADIUS, PLAYER_Y, SHIELD_CHARGE } from '../constants/tuning';
import { ZONES, type EventKind } from '../constants/zones';
import { addShip, BOSSES_ATLAS, loadGalacticaArt, sharpenGalacticaArt, SHIPS_ATLAS } from '../objects/art';
import {
	BOSS_LABELS,
	BOSS_MOVE_LABELS,
	EVENT_LABELS,
	FAMILY_LABELS,
	FAMILY_TEXTS,
	MANEUVER_LABELS,
	PASSAGE_LABELS,
	PICKUP_LABELS,
	RANK_LABELS,
	SHIP_LABELS,
	SHOT_LABELS,
	TEXT,
} from '../objects/labels';
import { PediaDemo, type DemoScript, type DemoSetup } from '../objects/PediaDemo';
import { PICKUP_KINDS, type Enemy } from '../state/Battle';
import { readHangar } from '../state/hangar';
import { hatchLead, nextGap } from '../state/Passage';
import { GALACTICA_SCENES } from '../sceneKeys';

type Page = 'basics' | 'ships' | 'enemies' | 'attacks' | 'events';
const PAGES: Page[] = ['basics', 'ships', 'enemies', 'attacks', 'events'];

/** Una fila de la lista: lo que se ve en ella, el ejemplo vivo y lo que se lee al lado. */
type Entry = {
	name: string;
	icon?: { atlas: string; frame: string; scale?: number };
	/** Título de grupo que se escribe arriba de la fila cuando cambia. */
	group?: string;
	demo: DemoSetup;
	facts: Array<[string, string]>;
	text: string;
	/** Algo del ejemplo que cambia mientras corre, como la etapa de la nave. */
	caption?: (demo: PediaDemo) => string;
	extra?: (scene: GalacticaPediaScene) => void;
};

const LIST = { x: 30, y: 74, width: 262, bottom: 548 };
const DEMO = { x: 306, y: 70, size: 300 };
const FACTS = { x: 622, width: 150 };
const TEXT_AREA = { x: 306, y: 384, width: 464 };

const MANEUVERS: Maneuver[] = ['swoop', 'dive', 'diveReturn', 'planted'];
const SHOT_KINDS: ShotKind[] = ['single', 'double', 'helix', 'fan3', 'fan5', 'split'];
const EVENTS: EventKind[] = ['pod', 'asteroids', 'comets'];
const ENEMY_ROSTER: Array<[Family, Rank | 0]> = [
	...FAMILIES.flatMap((family) => ([1, 2, 3] as Rank[]).map((rank): [Family, Rank] => [family, rank])),
	['crystal', 0],
];

/** Dónde quedó el lector la última vez, mientras el arcade siga abierto. */
const remembered: Record<Page, number> & { page: Page } = { page: 'basics', basics: 0, ships: 0, enemies: 0, attacks: 0, events: 0 };

type PediaData = { page?: Page; keepMusic?: boolean };

const zoneOf = (family: Family) => FAMILIES.indexOf(family) + 1;
const enemyFrame = (family: Family, rank: Rank | 0) => (rank === 0 ? 'shard' : `${FAMILY_FRAME[family]}_${rank}`);
const specOf = (family: Family, rank: Rank | 0): EnemySpec => (rank === 0 ? SHARD : ENEMIES[family][rank]);
const enemyName = (family: Family, rank: Rank | 0) =>
	rank === 0 ? i18n.t(RANK_LABELS[0]) : `${i18n.t(FAMILY_LABELS[family])} · ${i18n.t(RANK_LABELS[rank])}`;
const percent = (value: number) => `${Math.round(value * 100)} %`;
const bottom = (text: Phaser.GameObjects.Text) => text.y + text.height;

// ── Guiones de los ejemplos ──────────────────────────────────────────────────

type Memo = { enemy?: Enemy; ready?: number; index?: number; next?: number };

/** Una nave en su casillero que repite sus maniobras de a una, y reaparece si se va. */
function cycleManeuvers(family: Family, rank: Rank | 0, maneuvers: Maneuver[]): DemoScript {
	return (demo) => {
		const memo = demo.memo as Memo;
		const battle = demo.battle;
		if (!memo.enemy || !battle.enemies.includes(memo.enemy)) {
			memo.ready ??= demo.time + 0.8;
			if (demo.time >= memo.ready) {
				memo.enemy = battle.placeEnemy(family, rank, 3.5, 1);
				memo.ready = demo.time + 0.9;
			}
			return;
		}
		if (memo.enemy.state !== 'formation') {
			memo.ready = demo.time + 0.9;
			return;
		}
		if (demo.time >= (memo.ready ?? 0)) {
			const index = memo.index ?? 0;
			battle.startManeuver(memo.enemy, maneuvers[index % maneuvers.length]);
			memo.index = index + 1;
		}
	};
}

/** Una nave quieta que dispara el mismo patrón cada tanto. */
function repeatShot(kind: ShotKind, family: Family, rank: Rank): DemoScript {
	return (demo) => {
		const memo = demo.memo as Memo;
		if (!memo.enemy || !demo.battle.enemies.includes(memo.enemy)) {
			memo.enemy = demo.battle.placeEnemy(family, rank, 3.5, 0);
			memo.next = demo.time + 0.6;
		}
		if (demo.time >= (memo.next ?? 0)) {
			demo.battle.fireEnemy(kind, memo.enemy.x, memo.enemy.y + 14);
			memo.next = demo.time + 1.4;
		}
	};
}

/** La nave del hangar dispara contra una fila de blancos y pasa por sus tres etapas. */
function shipShowcase(): DemoScript {
	return (demo) => {
		const memo = demo.memo as Memo;
		const battle = demo.battle;
		demo.fire = true;
		battle.stage = Math.floor(demo.time / 3.5) % 3;
		if (battle.enemies.length < 3 && demo.time >= (memo.next ?? 0)) {
			for (let col = 1; col <= 6; col += 1) {
				battle.placeEnemy('terran', 1, col, 1);
			}
			memo.next = demo.time + 1.5;
		}
	};
}

/** Un evento que se repite: cuando termina el anterior, arranca otro. */
function repeatEvent(kind: EventKind): DemoScript {
	return (demo) => {
		const memo = demo.memo as Memo;
		const battle = demo.battle;
		const busy = kind === 'pod'
			? battle.pods.length > 0 || battle.enemies.length > 0
			: kind === 'asteroids' ? battle.rocks.length > 0 : battle.comets.length + battle.cometWarnings.length > 0;
		// Contra el pod y las rocas, la nave dispara: se ve qué sueltan al romperse.
		demo.fire = kind !== 'comets';
		if (kind === 'pod') {
			demo.target = () => battle.pods[0]?.x ?? battle.pickups[0]?.x ?? FIELD_W / 2;
		}
		if (busy) {
			memo.next = demo.time + 1.2;
			return;
		}
		if (demo.time >= (memo.next ?? 0.3)) {
			battle.startEvent(kind);
			memo.next = Infinity;
		}
	};
}

/** Un tramo entero que se repite, con una nave que hace lo que pide cada uno. */
function repeatPassage(id: PassageId): DemoScript {
	return (demo) => {
		const battle = demo.battle;
		const { player, ship } = battle;
		if (!battle.passage) {
			battle.startPassage(id);
		}
		player.shield = SHIELD_CHARGE;
		const gap = nextGap(battle.rocks, player);
		const freighter = battle.freighters.find((one) => one.x > 20 && one.x < FIELD_W - 20);
		const lead = freighter && hatchLead(freighter, player, ship.bulletSpeed);
		// El hueco manda: a la bodega le apunta cuando no tiene una fila encima.
		const x = gap?.axis === 'x' ? gap.at : lead ?? FIELD_W / 2;
		const y = gap?.axis === 'y' ? gap.at : PLAYER_Y;
		demo.target = () => x;
		demo.targetY = () => y;
		demo.fire = lead !== undefined && Math.abs(lead - player.x) < FREIGHTER.hatch;
		demo.shield = battle.strikes.some((strike) => {
			const at = strike.axis === 'x' ? player.x : player.y;
			return strike.timer < 0.12 && at > strike.from - PLAYER_RADIUS && at < strike.to + PLAYER_RADIUS;
		});
	};
}

function bossFight(): DemoScript {
	return (demo) => {
		const battle = demo.battle;
		if (!battle.boss && battle.phase !== 'clear') {
			battle.startBoss();
		}
	};
}

/**
 * La Galactopedia: todo lo que hay que saber, en cinco páginas.
 *
 * La primera es texto y dibujos; las otras cuatro son listas con un ejemplo
 * vivo al costado (`PediaDemo`), que corre la batalla real. Cambiar de página
 * reinicia la escena, como la ayuda de Astro Chess: es la forma más simple de
 * que todo lo de la página anterior desaparezca entero. La música no se corta
 * en esos reinicios.
 */
export class GalacticaPediaScene extends Phaser.Scene {
	private page: Page = 'basics';
	private choice = 0;
	private controls!: Controls;
	private flipping = false;
	private entries: Entry[] = [];
	private demo: PediaDemo | null = null;
	private rows: Array<{ highlight: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }> = [];
	private detail!: Phaser.GameObjects.Container;
	private caption: Phaser.GameObjects.Text | null = null;

	constructor() {
		super(GALACTICA_SCENES.PEDIA);
	}

	preload() {
		loadGalacticaArt(this);
		loadGalacticaAudio(this, GALACTICA_AUDIO.titleMusic, GALACTICA_AUDIO.select, GALACTICA_AUDIO.confirm);
	}

	create(data: PediaData = {}) {
		sharpenGalacticaArt(this);
		this.page = data.page ?? remembered.page;
		remembered.page = this.page;
		this.flipping = false;
		this.demo = null;
		this.caption = null;
		this.rows = [];

		this.cameras.main.setBackgroundColor('#05060d');
		this.drawFrame();
		this.detail = this.add.container(0, 0);

		if (this.page === 'basics') {
			this.createBasics();
		} else {
			this.entries = this.buildEntries(this.page);
			this.choice = Math.min(remembered[this.page], this.entries.length - 1);
			this.createList();
			this.demo = new PediaDemo(this, DEMO);
			this.refresh();
		}

		if (!data.keepMusic) {
			audioManager.playMusic(this, GALACTICA_AUDIO.titleMusic.cacheKey);
		}
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
			if (!this.flipping) {
				audioManager.stopMusic();
			}
		});

		this.controls = new Controls(this);
	}

	update(_time: number, delta: number) {
		const { controls } = this;
		if (controls.justDown('back')) {
			this.back();
			return;
		}
		if (controls.justDown('left')) this.turnPage(-1);
		else if (controls.justDown('right')) this.turnPage(1);
		else if (controls.justDown('up')) this.moveChoice(-1);
		else if (controls.justDown('down')) this.moveChoice(1);

		if (!this.demo) {
			return;
		}
		this.demo.update(Math.min(delta, 100) / 1000);
		const caption = this.entries[this.choice].caption;
		this.caption?.setText(caption ? caption(this.demo) : '');
	}

	// ── Marco ────────────────────────────────────────────────────────────────

	private drawFrame() {
		this.add.text(30, 22, i18n.t('galactica.pedia.title'), {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: '16px',
			color: '#7fe0ff',
			letterSpacing: 1,
		});

		PAGES.forEach((page, index) => {
			const x = 268 + index * 106;
			const current = page === this.page;
			this.add.rectangle(x, 32, 102, 28, current ? 0x18365b : 0x0d1428)
				.setStrokeStyle(current ? 2 : 1, current ? 0x7fe0ff : 0x29416f)
				.setInteractive({ useHandCursor: true })
				.on('pointerdown', () => this.goToPage(page));
			this.add.text(x, 32, i18n.t(`galactica.pedia.tab.${page}` as TranslationKey), {
				fontFamily: 'Courier New, monospace',
				fontSize: '10px',
				color: current ? '#ffffff' : '#8290b3',
			}).setOrigin(0.5);
		});

		this.add.text(30, 574, i18n.t('galactica.pedia.hint'), { ...TEXT.mono, fontSize: '12px', color: '#64759f' }).setOrigin(0, 0.5);
		const back = this.add.rectangle(690, 574, 160, 26, 0x111a31)
			.setStrokeStyle(1, 0x40577f)
			.setInteractive({ useHandCursor: true })
			.on('pointerdown', () => this.back());
		this.add.text(back.x, back.y, i18n.t('galactica.pedia.back'), { ...TEXT.mono, fontSize: '12px', color: '#9eacd0' }).setOrigin(0.5);
	}

	private turnPage(direction: -1 | 1) {
		const index = PAGES.indexOf(this.page) + direction;
		if (index >= 0 && index < PAGES.length) {
			this.goToPage(PAGES[index]);
		}
	}

	private goToPage(page: Page) {
		if (page === this.page) {
			return;
		}
		audioManager.playSfx(this, GALACTICA_AUDIO.select.cacheKey);
		this.flipping = true;
		remembered.page = page;
		this.scene.restart({ page, keepMusic: true } satisfies PediaData);
	}

	private back() {
		audioManager.playSfx(this, GALACTICA_AUDIO.confirm.cacheKey);
		this.scene.start(GALACTICA_SCENES.TITLE);
	}

	private moveChoice(direction: -1 | 1) {
		if (this.page !== 'basics') {
			this.select((this.choice + direction + this.entries.length) % this.entries.length);
		}
	}

	private select(index: number) {
		if (index === this.choice) {
			return;
		}
		this.choice = index;
		remembered[this.page] = index;
		audioManager.playSfx(this, GALACTICA_AUDIO.select.cacheKey);
		this.refresh();
	}

	// ── Piezas sueltas ───────────────────────────────────────────────────────

	heading(x: number, y: number, label: string, container?: Phaser.GameObjects.Container) {
		const text = this.add.text(x, y, label, TEXT.label);
		container?.add(text);
		return text;
	}

	body(x: number, y: number, text: string, width: number, container?: Phaser.GameObjects.Container) {
		const object = this.add.text(x, y, text, { ...TEXT.small, fontSize: '13px', color: '#d9e2ff', lineSpacing: 4, wordWrap: { width } });
		container?.add(object);
		return object;
	}

	// ── Cómo jugar ───────────────────────────────────────────────────────────

	private createBasics() {
		const left = 30;
		const right = 420;
		let y = 74;
		for (const [title, text] of [
			['galactica.pedia.lifeEnergy', 'galactica.pedia.lifeEnergyText'],
			['galactica.pedia.betweenZones', 'galactica.pedia.betweenZonesText'],
			['galactica.pedia.points', 'galactica.pedia.pointsText'],
		] as const) {
			this.heading(left, y, i18n.t(title));
			y = bottom(this.body(left, y + 18, i18n.t(text), 360)) + 18;
		}
		this.heading(left, y, i18n.t('galactica.pedia.controls'));
		this.add.text(left, y + 18, i18n.t('galactica.pedia.controlsText'), { ...TEXT.mono, fontSize: '13px', lineSpacing: 5 });

		this.heading(right, 74, i18n.t('galactica.pedia.pickups'));
		PICKUP_KINDS.forEach((kind, index) => {
			const x = right + 12 + (index % 2) * 180;
			const iy = 108 + Math.floor(index / 2) * 36;
			addShip(this, x, iy, `pick_${kind}`, 2);
			this.add.text(x + 20, iy - 12, i18n.t(PICKUP_LABELS[kind].name), { ...TEXT.mono, fontSize: '12px', fontStyle: 'bold' });
			this.add.text(x + 20, iy + 2, i18n.t(PICKUP_LABELS[kind].hint), { ...TEXT.small, fontSize: '11px', color: '#7384aa' });
		});

		this.heading(right, 228, i18n.t('galactica.pedia.evolution'));
		const evolution = this.body(right, 246, i18n.t('galactica.pedia.evolutionText'), 350);
		const stagesY = bottom(evolution) + 40;
		[0, 1, 2].forEach((stage) => {
			const x = right + 50 + stage * 120;
			addShip(this, x, stagesY, shipFrame('halcon', stage), 3);
			this.add.text(x, stagesY + 32, `MK ${stage + 1}`, { ...TEXT.mono, fontStyle: 'bold', color: '#7fe0ff' }).setOrigin(0.5, 0);
			if (stage > 0) {
				addShip(this, x - 60, stagesY, 'pick_core', 1.5);
				this.add.text(x - 60, stagesY + 14, `${EVOLUTION_CORES[stage]}`, { ...TEXT.mono, fontSize: '11px' }).setOrigin(0.5, 0);
			}
		});

		const zonesY = stagesY + 78;
		this.heading(right, zonesY, i18n.t('galactica.pedia.zones'));
		FAMILIES.forEach((family, index) => {
			const x = right + 40 + index * 90;
			addShip(this, x, zonesY + 40, enemyFrame(family, 1), 2);
			this.add.text(x, zonesY + 62, `${index + 1}  ${i18n.t(FAMILY_LABELS[family])}`, { ...TEXT.label, fontSize: '9px', letterSpacing: 1 })
				.setOrigin(0.5, 0);
		});
	}

	// ── Listas con ejemplo ───────────────────────────────────────────────────

	private createList() {
		const groups = this.entries.filter((entry, index) => entry.group && entry.group !== this.entries[index - 1]?.group).length;
		const rowHeight = Math.min(46, (LIST.bottom - LIST.y - groups * 22) / this.entries.length);
		let y = LIST.y;

		this.entries.forEach((entry, index) => {
			if (entry.group && entry.group !== this.entries[index - 1]?.group) {
				this.add.text(LIST.x, y + 4, entry.group, TEXT.label);
				y += 22;
			}
			const highlight = this.add.rectangle(LIST.x, y, LIST.width, rowHeight - 3, 0x18365b)
				.setOrigin(0)
				.setStrokeStyle(1, 0x7fe0ff)
				.setInteractive({ useHandCursor: true })
				.on('pointerdown', () => this.select(index));
			const middle = y + (rowHeight - 3) / 2;
			if (entry.icon) {
				this.add.image(LIST.x + 22, middle, entry.icon.atlas, entry.icon.frame).setScale(entry.icon.scale ?? (entry.icon.atlas === BOSSES_ATLAS ? 1 : 2));
			}
			const label = this.add.text(LIST.x + (entry.icon ? 46 : 12), middle, entry.name, {
				...TEXT.mono,
				fontSize: '12px',
				fontStyle: 'bold',
			}).setOrigin(0, 0.5);
			this.rows.push({ highlight, label });
			y += rowHeight;
		});

		this.add.rectangle(DEMO.x - 1, DEMO.y - 1, DEMO.size + 2, DEMO.size + 2).setOrigin(0).setStrokeStyle(2, 0x29416f);
		// Fuera del recuadro: la cámara del ejemplo se dibuja encima de todo lo que quede adentro.
		this.caption = this.add.text(FACTS.x, DEMO.y + DEMO.size, '', { ...TEXT.value, color: '#7fe0ff' }).setOrigin(0, 1);
	}

	private refresh() {
		const entry = this.entries[this.choice];
		this.rows.forEach((row, index) => {
			const selected = index === this.choice;
			row.highlight.setFillStyle(0x18365b, selected ? 1 : 0).setStrokeStyle(1, 0x7fe0ff, selected ? 1 : 0);
			row.label.setColor(selected ? '#ffffff' : '#9eacd0');
		});

		this.demo!.show(entry.demo);

		this.detail.removeAll(true);
		let y = DEMO.y;
		for (const [label, value] of entry.facts) {
			this.heading(FACTS.x, y, label, this.detail);
			const text = this.add.text(FACTS.x, y + 14, value, { ...TEXT.mono, fontStyle: 'bold', wordWrap: { width: FACTS.width } });
			this.detail.add(text);
			y = bottom(text) + 12;
		}
		this.body(TEXT_AREA.x, TEXT_AREA.y, entry.text, TEXT_AREA.width, this.detail);
		entry.extra?.(this);
	}

	/** Lo que la página agrega debajo del texto (como las etapas de una nave) va al mismo contenedor. */
	addDetail(...objects: Phaser.GameObjects.GameObject[]) {
		this.detail.add(objects);
	}

	private buildEntries(page: Page): Entry[] {
		if (page === 'ships') {
			const hangar = readHangar();
			return SHIP_IDS.map((id) => {
				const ship = SHIPS[id];
				const labels = SHIP_LABELS[id];
				const status = hangar.has(id)
					? i18n.t('galactica.pedia.ready')
					: i18n.t('galactica.title.locked');
				return {
					name: i18n.t(labels.name),
					icon: { atlas: SHIPS_ATLAS, frame: shipFrame(id, 0) },
					demo: { zone: 1, shipId: id, script: shipShowcase() },
					facts: [
						[i18n.t('galactica.stat.speed'), String(ship.speed)],
						[i18n.t('galactica.stat.armor'), `× ${ship.armor.toFixed(2)}`],
						[i18n.t('galactica.stat.fire'), `${(1 / ship.cooldown).toFixed(1)} / s`],
						[status, ship.unlockZone === 0
							? i18n.t('galactica.pedia.fromStart')
							: i18n.t('galactica.title.unlockHint').replace('{zone}', String(ship.unlockZone))],
					],
					text: i18n.t(labels.text),
					caption: (demo) => `MK ${demo.battle.stage + 1}`,
					extra: (scene) => {
						scene.addDetail(scene.heading(TEXT_AREA.x, 470, i18n.t('galactica.pedia.salvo')));
						[0, 1, 2].forEach((stage) => {
							const x = TEXT_AREA.x + 24 + stage * 156;
							scene.addDetail(
								addShip(scene, x, 516, shipFrame(id, stage), 2),
								scene.add.text(x + 22, 508, `MK ${stage + 1}`, { ...TEXT.mono, fontStyle: 'bold', color: '#7fe0ff' }),
								scene.add.text(x + 22, 524, i18n.t(labels.stages[stage]), { ...TEXT.small, fontSize: '11px' }),
							);
						});
					},
				};
			});
		}

		if (page === 'enemies') {
			return ENEMY_ROSTER.map(([family, rank]) => {
				const spec = specOf(family, rank);
				const maneuvers = spec.maneuvers.map(([maneuver]) => maneuver);
				const notes = [rank === 0 ? i18n.t('galactica.shard.text') : i18n.t(FAMILY_TEXTS[family])];
				if (spec.shards) {
					notes.push(i18n.t('galactica.pedia.shards').replace('{count}', String(spec.shards)));
				}
				notes.push(i18n.t('galactica.pedia.double'));
				return {
					name: enemyName(family, rank),
					icon: { atlas: SHIPS_ATLAS, frame: enemyFrame(family, rank) },
					demo: { zone: zoneOf(family), script: cycleManeuvers(family, rank, maneuvers) },
					facts: [
						[i18n.t('galactica.pedia.hp'), String(spec.hp)],
						[i18n.t('galactica.pedia.pointsLabel'), String(spec.points)],
						[i18n.t('galactica.pedia.shoots'), spec.shot ? i18n.t(SHOT_LABELS[spec.shot].name) : i18n.t('galactica.pedia.noShot')],
						[i18n.t('galactica.pedia.maneuvers'), maneuvers.map((maneuver) => i18n.t(MANEUVER_LABELS[maneuver].name)).join('\n')],
						[i18n.t('galactica.pedia.drops'), percent(spec.drop)],
					],
					text: notes.join('\n\n'),
				};
			});
		}

		if (page === 'attacks') {
			const shots: Entry[] = SHOT_KINDS.map((kind) => {
				const [family, rank] = this.firstUser((spec) => spec.shot === kind);
				const style = SHOTS[kind].style;
				const damage = style === 'helix' ? DAMAGE.helix : style === 'fan' ? DAMAGE.fan : DAMAGE.bolt;
				return {
					name: i18n.t(SHOT_LABELS[kind].name),
					group: i18n.t('galactica.pedia.shots'),
					demo: { zone: zoneOf(family), script: repeatShot(kind, family, rank) },
					facts: [[i18n.t('galactica.pedia.damage'), `${damage} %`]],
					text: this.attackText(i18n.t(SHOT_LABELS[kind].text), (spec) => spec.shot === kind),
				};
			});
			const maneuvers: Entry[] = MANEUVERS.map((maneuver) => {
				const used = (spec: EnemySpec) => spec.maneuvers.some(([option]) => option === maneuver);
				const [family, rank] = this.firstUser(used);
				const damage = maneuver === 'planted'
					? `${i18n.t('galactica.pedia.blast')} ${DAMAGE.blast} %`
					: `${i18n.t('galactica.pedia.collision')} ${DAMAGE.ram} %`;
				return {
					name: i18n.t(MANEUVER_LABELS[maneuver].name),
					group: i18n.t('galactica.pedia.maneuvers'),
					demo: { zone: zoneOf(family), script: cycleManeuvers(family, rank, [maneuver]) },
					facts: [[i18n.t('galactica.pedia.damage'), damage]],
					text: this.attackText(i18n.t(MANEUVER_LABELS[maneuver].text), used),
				};
			});
			return [...shots, ...maneuvers];
		}

		const events: Entry[] = EVENTS.map((kind) => {
			const zones = ZONES.map((zone, index) => (zone.events.some(([event]) => event === kind) ? index + 1 : 0)).filter(Boolean);
			const facts: Array<[string, string]> = [[i18n.t('galactica.pedia.zone'), zones.join(' · ')]];
			if (kind !== 'pod') {
				facts.push([i18n.t('galactica.pedia.damage'), `${kind === 'comets' ? DAMAGE.comet : DAMAGE.rock} %`]);
			}
			const zone = zones[0];
			return {
				name: i18n.t(EVENT_LABELS[kind].name),
				// La lluvia de cometas no tiene sprite: es un trazo.
				icon: kind === 'comets' ? undefined : { atlas: SHIPS_ATLAS, frame: kind === 'pod' ? 'pod' : 'rock_1' },
				group: i18n.t('galactica.pedia.events'),
				demo: { zone, script: repeatEvent(kind) },
				facts,
				text: i18n.t(EVENT_LABELS[kind].text),
			};
		});

		const bosses: Entry[] = FAMILIES.map((family) => {
			const boss = BOSSES[family];
			return {
				name: i18n.t(BOSS_LABELS[family].name),
				icon: { atlas: BOSSES_ATLAS, frame: boss.frame },
				group: i18n.t('galactica.pedia.bosses'),
				demo: { zone: zoneOf(family), script: bossFight() },
				facts: [
					[i18n.t('galactica.pedia.zone'), String(zoneOf(family))],
					[i18n.t('galactica.pedia.hp'), String(boss.hp)],
					[i18n.t('galactica.pedia.pointsLabel'), String(boss.points)],
					[i18n.t('galactica.pedia.cycle'), boss.cycle.map((move) => i18n.t(BOSS_MOVE_LABELS[move])).join('\n')],
				],
				text: `${i18n.t(BOSS_LABELS[family].text)}\n\n${i18n.t('galactica.pedia.enraged')}`,
			};
		});
		const passages: Entry[] = PASSAGE_IDS.map((id) => {
			const zone = ZONES.findIndex((def) => def.passage === id) + 1;
			const facts: Array<[string, string]> = [
				[i18n.t('galactica.pedia.zone'), String(zone)],
				[i18n.t('galactica.pedia.duration'), `${PASSAGE_SECONDS} s`],
			];
			const damage: string[] = [];
			const energy: string[] = [];
			if (id === 'crossing' || id === 'combined') {
				damage.push(`${i18n.t('galactica.damage.rock')} ${DAMAGE.rock} %`);
			}
			if (id === 'convoy' || id === 'combined') {
				energy.push(`${i18n.t('galactica.pedia.hatch')} +${FREIGHTER.energy} %`);
			}
			if (id === 'storm' || id === 'combined') {
				damage.push(`${i18n.t('galactica.damage.storm')} ${DAMAGE.storm} %`);
				energy.push(`${i18n.t('galactica.pedia.block')} +${STORM.gain} %`);
			}
			if (damage.length) {
				facts.push([i18n.t('galactica.pedia.damage'), damage.join('\n')]);
			}
			if (energy.length) {
				facts.push([i18n.t('galactica.game.energy'), energy.join('\n')]);
			}
			const icons: Record<PassageId, Entry['icon']> = {
				crossing: { atlas: SHIPS_ATLAS, frame: 'rock_2' },
				convoy: { atlas: SHIPS_ATLAS, frame: 'freighter', scale: 1 },
				storm: { atlas: SHIPS_ATLAS, frame: 'pick_shield' },
				combined: undefined,
			};
			return {
				name: i18n.t(PASSAGE_LABELS[id].name),
				icon: icons[id],
				group: i18n.t('galactica.pedia.passages'),
				demo: { zone, script: repeatPassage(id) },
				facts,
				text: `${i18n.t(PASSAGE_LABELS[id].text)}\n\n${i18n.t('galactica.pedia.passageNote')}`,
			};
		});
		return [...events, ...passages, ...bosses];
	}

	/** El primer enemigo que cumple algo: el que protagoniza el ejemplo del ataque. */
	private firstUser(test: (spec: EnemySpec) => boolean): [Family, Rank] {
		for (const [family, rank] of ENEMY_ROSTER) {
			if (rank !== 0 && test(specOf(family, rank))) {
				return [family, rank];
			}
		}
		return ['terran', 1];
	}

	/** La descripción del ataque, quién lo usa y la aclaración del blindaje. */
	private attackText(description: string, test: (spec: EnemySpec) => boolean) {
		const users = ENEMY_ROSTER
			.filter(([family, rank]) => test(specOf(family, rank)))
			.map(([family, rank]) => enemyName(family, rank).toLowerCase())
			.join(', ');
		return `${description}\n\n${i18n.t('galactica.pedia.usedBy')}: ${users}.\n${i18n.t('galactica.pedia.damageNote')}`;
	}
}
