import Phaser from 'phaser';
import { audioManager } from '../../../core/audio/AudioManager';
import { i18n } from '../../../core/i18n/i18n';
import { CORE_SCENES } from '../../../core/sceneKeys';
import { GALACTICA_AUDIO, loadGalacticaAudio } from '../audio';
import { shipFrame, type ShipId } from '../constants/ships';
import type { DamageSource } from '../constants/tuning';
import { ZONES } from '../constants/zones';
import { addShip, loadGalacticaArt, sharpenGalacticaArt } from '../objects/art';
import { DAMAGE_LABELS, FAMILY_LABELS, SHIP_LABELS, TEXT } from '../objects/labels';
import { Starfield } from '../objects/Starfield';
import { newRun, type BattleStats, type RunState } from '../state/Battle';
import { readHighScore, submitHighScore, unlockAfterZone } from '../state/hangar';
import { GALACTICA_SCENES } from '../sceneKeys';

/** Lo que la partida le entrega a esta pantalla al decidirse la zona. */
export type GalacticaResult = {
	outcome: 'zoneClear' | 'victory' | 'gameOver';
	zone: number;
	shipId: ShipId;
	stage: number;
	score: number;
	hp: number;
	energy: number;
	stats: BattleStats;
	bonus: number;
	/** Con qué se arranca la zona siguiente, si la hay. */
	next: RunState;
};

const ROW_DELAY = 220;

/** Balance de la zona: tiempo, derribos, daño por fuente, puntaje y naves nuevas. */
export class GalacticaResultScene extends Phaser.Scene {
	private result!: GalacticaResult;
	private enterKey!: Phaser.Input.Keyboard.Key;
	private menuKey!: Phaser.Input.Keyboard.Key;
	private escapeKey!: Phaser.Input.Keyboard.Key;
	private starfield!: Starfield;

	constructor() {
		super(GALACTICA_SCENES.RESULT);
	}

	init(data: GalacticaResult) {
		this.result = data;
	}

	preload() {
		loadGalacticaArt(this);
		loadGalacticaAudio(this, GALACTICA_AUDIO.confirm, GALACTICA_AUDIO.select, GALACTICA_AUDIO.unlock);
	}

	create() {
		sharpenGalacticaArt(this);
		const { result } = this;
		const won = result.outcome !== 'gameOver';
		const previousRecord = readHighScore();
		const newRecord = submitHighScore(result.score);
		// Vencer al jefe de la zona es lo que desbloquea naves; perder no le saca nada al hangar.
		const unlocked = won ? unlockAfterZone(result.zone) : [];

		this.cameras.main.setBackgroundColor('#05060d');
		const zone = ZONES[result.zone - 1];
		this.starfield = new Starfield(this, { x: 0, y: 0, w: 800, h: 600 }, zone.sky, 90);

		this.drawHeader(won);
		this.drawTally();
		this.drawScore(newRecord ? result.score : previousRecord, newRecord);
		if (unlocked.length) {
			this.drawUnlocked(unlocked);
		}
		this.createButtons();

		const keyboard = this.input.keyboard!;
		this.enterKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
		this.menuKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
		this.escapeKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
	}

	update(time: number) {
		this.starfield.draw(time / 1000);
		if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
			this.continueRun();
			return;
		}
		if (Phaser.Input.Keyboard.JustDown(this.menuKey)) {
			this.goTo(GALACTICA_SCENES.TITLE);
			return;
		}
		if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
			this.goTo(CORE_SCENES.LAUNCHER);
		}
	}

	private drawHeader(won: boolean) {
		const { result } = this;
		const title = result.outcome === 'victory'
			? 'galactica.result.victory'
			: result.outcome === 'zoneClear' ? 'galactica.result.zoneClear' : 'galactica.result.gameOver';
		const hint = result.outcome === 'victory'
			? 'galactica.result.victoryHint'
			: result.outcome === 'zoneClear' ? 'galactica.result.clearHint' : 'galactica.result.lostHint';

		this.add.text(400, 54, i18n.t(title), {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: '44px',
			color: won ? '#7fe0ff' : '#ff647c',
			letterSpacing: 4,
			stroke: '#05070d',
			strokeThickness: 6,
		}).setOrigin(0.5);
		this.add.text(400, 100, i18n.t(hint), { ...TEXT.small, fontSize: '14px' }).setOrigin(0.5);

		const family = i18n.t(FAMILY_LABELS[ZONES[result.zone - 1].family]);
		this.add.text(400, 130, `${i18n.t('galactica.game.zone')} ${result.zone}  ·  ${family}`, {
			...TEXT.mono,
			fontSize: '16px',
			fontStyle: 'bold',
		}).setOrigin(0.5);
	}

	/** Las filas aparecen de a una, como una planilla que se va llenando. */
	private drawTally() {
		const { result } = this;
		this.add.rectangle(400, 232, 520, 156, 0x0d1428, 0.92).setStrokeStyle(2, 0x29416f);

		addShip(this, 196, 214, shipFrame(result.shipId, result.stage), 4);
		this.add.text(196, 262, `${i18n.t(SHIP_LABELS[result.shipId].name)}  MK ${result.stage + 1}`, {
			...TEXT.mono,
			fontSize: '12px',
			fontStyle: 'bold',
		}).setOrigin(0.5);

		const next = result.outcome === 'zoneClear' ? result.next : null;
		const minutes = Math.floor(result.stats.time / 60);
		const seconds = String(Math.floor(result.stats.time % 60)).padStart(2, '0');
		const rows: Array<[string, string]> = [
			[i18n.t('galactica.result.time'), `${minutes}:${seconds}`],
			[i18n.t('galactica.result.kills'), String(result.stats.kills)],
			// Si sigue otra zona, se muestra con qué se entra: la vida se arrastra con
			// una curación y la energía se llena.
			[i18n.t('galactica.game.life'), next ? `${Math.ceil(result.hp)}% → ${next.hp}%` : `${Math.ceil(result.hp)}%`],
			[i18n.t('galactica.game.energy'), next ? `${Math.ceil(result.energy)}% → 100%` : `${Math.ceil(result.energy)}%`],
		];
		if (result.bonus > 0) {
			rows.push([i18n.t('galactica.result.bonus'), `+${result.bonus}`]);
		}

		rows.forEach(([label, value], index) => {
			const y = 176 + index * 26;
			const texts = [
				this.add.text(270, y, label, { ...TEXT.small, fontSize: '13px' }).setOrigin(0, 0.5),
				this.add.text(450, y, value, { ...TEXT.mono, fontSize: '16px', fontStyle: 'bold' }).setOrigin(1, 0.5),
			];
			this.reveal(texts, index);
		});

		// El daño, de la fuente que más sacó a la que menos: dice qué hay que aprender a esquivar.
		const damage = (Object.entries(result.stats.damage) as Array<[DamageSource, number]>)
			.filter(([, amount]) => amount >= 1)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5);
		this.add.text(478, 164, i18n.t('galactica.result.damage'), TEXT.label);
		if (damage.length === 0) {
			this.add.text(478, 186, i18n.t('galactica.result.noDamage'), { ...TEXT.small, color: '#9be15d' });
		}
		damage.forEach(([source, amount], index) => {
			const y = 194 + index * 22;
			this.reveal([
				this.add.text(478, y, i18n.t(DAMAGE_LABELS[source]), TEXT.small).setOrigin(0, 0.5),
				this.add.text(648, y, `${Math.round(amount)}`, { ...TEXT.mono, color: '#ff9aa8', fontStyle: 'bold' }).setOrigin(1, 0.5),
			], index + rows.length);
		});
	}

	private reveal(texts: Phaser.GameObjects.Text[], index: number) {
		texts.forEach((text) => text.setAlpha(0));
		this.time.delayedCall(ROW_DELAY * (index + 1), () => {
			texts.forEach((text) => text.setAlpha(1));
			audioManager.playSfx(this, GALACTICA_AUDIO.select.cacheKey);
		});
	}

	private drawScore(highScore: number, newRecord: boolean) {
		this.add.text(250, 346, i18n.t('galactica.result.score'), { ...TEXT.small, fontSize: '13px' }).setOrigin(0, 0.5);
		this.add.text(550, 346, String(this.result.score), { ...TEXT.value, fontSize: '24px' }).setOrigin(1, 0.5);
		this.add.text(250, 374, i18n.t('galactica.result.highScore'), { ...TEXT.small, fontSize: '13px' }).setOrigin(0, 0.5);
		this.add.text(550, 374, String(highScore), { ...TEXT.mono, fontSize: '16px', color: '#9eacd0' }).setOrigin(1, 0.5);

		if (newRecord) {
			// Entre la planilla y el puntaje, donde no pisa ninguna fila.
			const label = this.add.text(400, 327, i18n.t('galactica.result.newRecord'), {
				fontFamily: 'Arial Black, Arial, sans-serif',
				fontSize: '13px',
				color: '#9be15d',
				letterSpacing: 3,
			}).setOrigin(0.5);
			this.tweens.add({ targets: label, alpha: 0.25, duration: 420, yoyo: true, repeat: -1 });
		}
	}

	private drawUnlocked(ships: ShipId[]) {
		this.time.delayedCall(ROW_DELAY * 8, () => {
			audioManager.playSfx(this, GALACTICA_AUDIO.unlock.cacheKey);
			const label = this.add.text(400, 426, i18n.t('galactica.result.unlocked'), {
				fontFamily: 'Arial Black, Arial, sans-serif',
				fontSize: '15px',
				color: '#ffd860',
				letterSpacing: 2,
			}).setOrigin(1, 0.5);
			ships.forEach((id, index) => {
				const x = 430 + index * 120;
				addShip(this, x, 426, shipFrame(id, 0), 2);
				this.add.text(x + 20, 426, i18n.t(SHIP_LABELS[id].name), { ...TEXT.mono, fontStyle: 'bold', color: '#ffd860' })
					.setOrigin(0, 0.5);
			});
			this.tweens.add({ targets: label, alpha: 0.4, duration: 500, yoyo: true, repeat: -1 });
		});
	}

	private createButtons() {
		const primary = this.result.outcome === 'zoneClear' ? 'galactica.result.next' : 'galactica.result.retry';
		this.createButton(400, 498, 320, 42, i18n.t(primary), true, () => this.continueRun());
		this.createButton(272, 552, 250, 36, i18n.t('galactica.result.backToTitle'), false, () => this.goTo(GALACTICA_SCENES.TITLE));
		this.createButton(528, 552, 250, 36, i18n.t('galactica.result.backToArcade'), false, () => this.goTo(CORE_SCENES.LAUNCHER));
	}

	private createButton(x: number, y: number, width: number, height: number, label: string, primary: boolean, onClick: () => void) {
		const button = this.add.rectangle(x, y, width, height, primary ? 0x18365b : 0x111a31)
			.setStrokeStyle(primary ? 2 : 1, primary ? 0x7fe0ff : 0x40577f)
			.setInteractive({ useHandCursor: true });
		this.add.text(x, y, label, {
			fontFamily: 'Courier New, monospace',
			fontSize: primary ? '16px' : '12px',
			color: primary ? '#ffffff' : '#9eacd0',
		}).setOrigin(0.5);
		button.on('pointerdown', onClick);
	}

	/** Pasar de zona sigue con lo acumulado; ganar todo o perder empiezan otra partida con la misma nave. */
	private continueRun() {
		const next = this.result.outcome === 'zoneClear' ? this.result.next : newRun(this.result.shipId);
		audioManager.playSfx(this, GALACTICA_AUDIO.confirm.cacheKey);
		this.scene.start(GALACTICA_SCENES.GAME, next);
	}

	private goTo(sceneKey: string) {
		audioManager.playSfx(this, GALACTICA_AUDIO.confirm.cacheKey);
		this.scene.start(sceneKey);
	}
}
