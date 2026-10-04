import Phaser from 'phaser';
import { audioManager } from '../../../core/audio/AudioManager';
import { i18n, type TranslationKey } from '../../../core/i18n/i18n';
import { ASTRO_AUDIO, loadAstroAudio } from '../audio';
import { ROOM_IDS, ROOMS, TOTAL_SLOTS } from '../constants/rooms';
import { CrewBoard } from '../objects/CrewBoard';
import { FULL_PLAN } from '../objects/shipRenderer';
import { addButton, FONTS, type Button } from '../objects/ui';
import { ASTRO_SCENES } from '../sceneKeys';
import { Crew } from '../state/Crew';
import { Ship, type ShipLayout } from '../state/Ship';

const RESERVE = { x: 96, y: 494, spacing: 74, size: 44 };

type ShipData = { layout?: ShipLayout };

/**
 * Reparto de la tripulación por los puestos de la nave, antes de combatir.
 *
 * Es la decisión central del juego: hay siete puestos y cinco tripulantes, así
 * que elegir dónde va cada uno es elegir qué parte de la nave queda floja.
 */
export class AstroChessShipScene extends Phaser.Scene {
	private crew!: Crew;
	private ship!: Ship;
	private board!: CrewBoard;
	private layout: ShipLayout = [];
	private slotsLabel!: Phaser.GameObjects.Text;
	private warningLabel!: Phaser.GameObjects.Text;
	private combatButton!: Button;
	/** Sin armería no se gana: el primer Enter avisa y el segundo confirma. */
	private confirmedNoWeapons = false;
	private escapeKey!: Phaser.Input.Keyboard.Key;
	private enterKey!: Phaser.Input.Keyboard.Key;

	constructor() {
		super(ASTRO_SCENES.SHIP);
	}

	/** Al reintentar un combate se vuelve con el reparto con el que se peleó. */
	init(data: ShipData) {
		this.layout = data.layout ?? [];
	}

	preload() {
		loadAstroAudio(this, ASTRO_AUDIO.introMusic, ASTRO_AUDIO.select, ASTRO_AUDIO.confirm, ASTRO_AUDIO.blocked);
	}

	create() {
		// Las escenas se reutilizan: cada entrada arma una tripulación nueva.
		this.crew = Crew.starting();
		this.ship = new Ship();
		this.ship.restore(this.layout);
		this.confirmedNoWeapons = false;

		this.cameras.main.setBackgroundColor('#050914');
		this.drawHeader();
		this.board = new CrewBoard(this, {
			crew: this.crew,
			ship: this.ship,
			transform: FULL_PLAN,
			reserve: RESERVE,
			onChange: () => this.refreshLabels(),
			sounds: {
				select: () => audioManager.playSfx(this, ASTRO_AUDIO.select.cacheKey),
				confirm: () => audioManager.playSfx(this, ASTRO_AUDIO.confirm.cacheKey),
				blocked: () => audioManager.playSfx(this, ASTRO_AUDIO.blocked.cacheKey),
			},
		});
		this.createFooter();
		this.refreshLabels();

		audioManager.playMusic(this, ASTRO_AUDIO.introMusic.cacheKey);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audioManager.stopMusic());

		const keyboard = this.input.keyboard!;
		this.escapeKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
		this.enterKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
	}

	update() {
		if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
			this.startCombat();
			return;
		}

		// Esc primero suelta la pieza que haya en la mano; recién después sale.
		if (Phaser.Input.Keyboard.JustDown(this.escapeKey) && !this.board.cancelSelection()) {
			this.goToTitle();
		}
	}

	private drawHeader() {
		const graphics = this.add.graphics();
		graphics.fillStyle(0x101431, 1);
		graphics.fillCircle(700, 40, 200);

		this.add.text(400, 34, i18n.t('astro.ship.title'), {
			fontFamily: FONTS.display,
			fontSize: '26px',
			color: '#f5f7ff',
			letterSpacing: 4,
		}).setOrigin(0.5);

		this.add.text(400, 66, i18n.t('astro.ship.subtitle'), {
			fontFamily: FONTS.sans,
			fontSize: '12px',
			color: '#8f86c8',
			letterSpacing: 2,
		}).setOrigin(0.5);

		this.slotsLabel = this.add.text(760, 34, '', {
			fontFamily: FONTS.mono,
			fontSize: '20px',
			color: '#46d9ff',
		}).setOrigin(1, 0.5);

		this.add.text(760, 58, i18n.t('astro.ship.slots'), {
			fontFamily: FONTS.sans,
			fontSize: '10px',
			color: '#6d7da8',
			letterSpacing: 1,
		}).setOrigin(1, 0.5);

		// Por encima del recuadro con el que se marca la pieza elegida.
		this.add.text(40, RESERVE.y - 54, i18n.t('astro.ship.reserve'), {
			fontFamily: FONTS.sans,
			fontSize: '11px',
			color: '#6d7da8',
			letterSpacing: 2,
		});
	}

	private createFooter() {
		this.add.text(40, 546, i18n.t('astro.ship.hint'), {
			fontFamily: FONTS.mono,
			fontSize: '11px',
			color: '#7384aa',
		}).setOrigin(0, 0.5);

		// El aviso va al lado del botón de combate: es lo último que se mira
		// antes de apretarlo.
		this.warningLabel = this.add.text(40, 578, '', {
			fontFamily: FONTS.sans,
			fontSize: '12px',
			color: '#ffca4b',
			wordWrap: { width: 440 },
		}).setOrigin(0, 0.5);

		this.combatButton = addButton(this, 580, 578, 160, 32, i18n.t('astro.ship.toCombat'), () =>
			this.startCombat()
		);
		addButton(this, 720, 578, 110, 32, i18n.t('astro.ship.back'), () => this.goToTitle(), 'secondary');
	}

	private refreshLabels() {
		const occupied = ROOM_IDS.reduce((total, room) => {
			for (let slot = 0; slot < ROOMS[room].slots; slot += 1) {
				if (this.ship.memberIdAt({ room, slot })) total += 1;
			}
			return total;
		}, 0);

		this.slotsLabel.setText(`${occupied}/${TOTAL_SLOTS}`);

		// Cualquier cambio de reparto vuelve a pedir confirmación.
		this.confirmedNoWeapons = false;
		this.combatButton.label.setText(i18n.t('astro.ship.toCombat'));

		const warning = this.warning();
		this.warningLabel
			.setText(warning ? i18n.t(warning.key) : '')
			.setColor(warning?.severe ? '#ff647c' : '#ffca4b');
	}

	/**
	 * El error más caro del reparto, si hay alguno.
	 *
	 * Las simulaciones son tajantes con la armería: vacía, se pierde el cien
	 * por ciento de las veces. Las otras dos salas no condenan la partida, pero
	 * cambian tanto el combate que conviene saberlo antes de empezarlo.
	 */
	private warning(): { key: TranslationKey; severe: boolean } | null {
		if (this.ship.output('weapons', this.crew) === 0) return { key: 'astro.ship.warn.noWeapons', severe: true };
		if (this.ship.output('bridge', this.crew) === 0) return { key: 'astro.ship.warn.noBridge', severe: false };
		if (this.ship.output('shields', this.crew) === 0) return { key: 'astro.ship.warn.noShields', severe: false };

		return null;
	}

	/** La tripulación repartida viaja al combate como dato de la escena. */
	private startCombat() {
		if (this.ship.output('weapons', this.crew) === 0 && !this.confirmedNoWeapons) {
			this.confirmedNoWeapons = true;
			this.combatButton.label.setText(i18n.t('astro.ship.fightAnyway'));
			audioManager.playSfx(this, ASTRO_AUDIO.blocked.cacheKey);
			this.tweens.add({ targets: this.warningLabel, alpha: { from: 0.2, to: 1 }, duration: 120, repeat: 2 });
			return;
		}

		audioManager.playSfx(this, ASTRO_AUDIO.confirm.cacheKey);
		this.scene.start(ASTRO_SCENES.COMBAT, {
			crew: this.crew,
			ship: this.ship,
			layout: this.ship.layout(),
		});
	}

	private goToTitle() {
		audioManager.playSfx(this, ASTRO_AUDIO.confirm.cacheKey);
		this.scene.start(ASTRO_SCENES.TITLE);
	}
}
