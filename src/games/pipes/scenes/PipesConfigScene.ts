import Phaser from 'phaser';
import { audioManager } from '../../../core/audio/AudioManager';
import { i18n } from '../../../core/i18n/i18n';
import { RENDER_SCALE } from '../../../core/renderScale';
import { loadPipesAudio, PIPES_AUDIO } from '../audio';
import { PIPE_TYPES, type PipeType } from '../constants/pipeTypes';
import {
	bagTotal,
	formatTuningValue,
	PIECE_LABEL_KEYS,
	TUNING_GROUPS,
	type TuningField,
} from '../constants/tuning';
import { drawPipe } from '../objects/pipeRenderer';
import { pipesTuning, PROFILE_SLOTS } from '../tuningStore';
import { PIPES_SCENES } from '../sceneKeys';

/** Zona con scroll donde vive la lista de parámetros. */
const VIEWPORT = { x: 40, y: 96, width: 720, height: 342 } as const;

/** Alto de cada fila y de cada título de grupo dentro de la lista. */
const ROW_HEIGHT = 26;
const GROUP_HEIGHT = 32;

/** Cuánto desplaza una vuelta de rueda, y cuántos píxeles por segundo una flecha. */
const WHEEL_STEP = 0.6;
const KEY_STEP = 420;

/** Con Shift, un click mueve diez pasos en vez de uno. */
const SHIFT_MULTIPLIER = 10;

/** Qué hace tocar una ranura de perfil. */
type ProfileAction = 'load' | 'save' | 'clear';

/** Botón simple: su rectángulo y su texto se retocan juntos. */
type Button = {
	rect: Phaser.GameObjects.Rectangle;
	label: Phaser.GameObjects.Text;
};

/**
 * Pantalla de configuración de Pipes.
 *
 * Existe para poder probar balances sin recompilar: cada número que define la
 * dificultad, el puntaje o la bolsa se puede mover acá y queda guardado. Los
 * cambios se aplican al empezar el próximo nivel, no en la partida en curso.
 *
 * La lista no entra en pantalla y va a seguir creciendo, así que se dibuja con
 * una segunda cámara recortada al visor y se desplaza con la rueda, las flechas
 * o la barra lateral. Sólo se dibuja: el estado real lo guarda `pipesTuning`.
 */
export class PipesConfigScene extends Phaser.Scene {
	private content!: Phaser.GameObjects.Container;
	/**
	 * Cámara que dibuja la lista.
	 *
	 * Una máscara recortaría el dibujo pero no las zonas sensibles al mouse: los
	 * botones scrolleados fuera del visor seguirían respondiendo. Una cámara con
	 * viewport recorta las dos cosas, porque Phaser sólo prueba los objetos que
	 * la cámara bajo el puntero puede dibujar.
	 */
	private listCamera!: Phaser.Cameras.Scene2D.Camera;
	private contentHeight = 0;
	private scrollY = 0;

	private scrollTrack!: Phaser.GameObjects.Rectangle;
	private scrollThumb!: Phaser.GameObjects.Rectangle;
	private draggingThumb = false;

	/** La bolsa es un submenú: mismo visor, otra lista. */
	private view: 'main' | 'bag' = 'main';
	private profileAction: ProfileAction = 'load';

	private slotButtons: Button[] = [];
	private actionButtons: Partial<Record<ProfileAction, Button>> = {};
	private statusText!: Phaser.GameObjects.Text;

	/** Cada fila registra cómo repintar su valor cuando cambia. */
	private valueUpdaters: Array<() => void> = [];

	private escapeKey!: Phaser.Input.Keyboard.Key;
	private upKey!: Phaser.Input.Keyboard.Key;
	private downKey!: Phaser.Input.Keyboard.Key;

	constructor() {
		super(PIPES_SCENES.CONFIG);
	}

	preload() {
		loadPipesAudio(
			this,
			PIPES_AUDIO.introMusic,
			PIPES_AUDIO.confirm,
			PIPES_AUDIO.place,
			PIPES_AUDIO.blocked
		);
	}

	create() {
		this.view = 'main';
		this.profileAction = 'load';
		this.scrollY = 0;

		this.cameras.main.setBackgroundColor('#080d1a');
		this.drawBackground();
		this.drawHeader();
		this.createViewport();
		this.createFooter();
		this.buildContent();
		this.configureInput();

		// La configuración se abre desde el título y comparte su música.
		audioManager.playMusic(this, PIPES_AUDIO.introMusic.cacheKey);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audioManager.stopMusic());
	}

	update() {
		if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
			this.goBack();
			return;
		}

		// Las flechas mantenidas desplazan la lista de forma continua.
		if (this.upKey.isDown) this.scrollBy(-KEY_STEP * (this.game.loop.delta / 1000));
		if (this.downKey.isDown) this.scrollBy(KEY_STEP * (this.game.loop.delta / 1000));
	}

	// --- Estructura de la pantalla -------------------------------------------

	private drawBackground() {
		const graphics = this.add.graphics();
		graphics.fillStyle(0x101b36, 1);
		graphics.fillCircle(700, 20, 240);
		graphics.fillStyle(0x17234a, 0.5);
		graphics.fillCircle(70, 590, 190);
	}

	private drawHeader() {
		this.add.text(400, 38, i18n.t('pipes.config.title'), {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: '28px',
			color: '#f5f7ff',
			letterSpacing: 5,
		}).setOrigin(0.5);

		this.add.text(400, 70, i18n.t('pipes.config.subtitle'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '11px',
			color: '#7384aa',
			letterSpacing: 1,
		}).setOrigin(0.5);
	}

	/** Visor recortado, su cámara y la barra de desplazamiento. */
	private createViewport() {
		this.add.rectangle(VIEWPORT.x, VIEWPORT.y, VIEWPORT.width, VIEWPORT.height, 0x0b1224, 0.85)
			.setOrigin(0)
			.setStrokeStyle(1, 0x24365c);

		// El scroll de la cámara arranca en la esquina del visor, así que las
		// coordenadas de la lista se escriben igual que las del resto de la escena.
		// El viewport se mide en píxeles reales del canvas y el zoom acompaña a la
		// cámara principal (ver core/renderScale.ts).
		this.listCamera = this.cameras.add(
			VIEWPORT.x * RENDER_SCALE,
			VIEWPORT.y * RENDER_SCALE,
			VIEWPORT.width * RENDER_SCALE,
			VIEWPORT.height * RENDER_SCALE
		);
		this.listCamera.setOrigin(0).setZoom(RENDER_SCALE).setScroll(VIEWPORT.x, VIEWPORT.y);

		const trackX = VIEWPORT.x + VIEWPORT.width - 10;
		this.scrollTrack = this.add.rectangle(trackX, VIEWPORT.y + 4, 6, VIEWPORT.height - 8, 0x172343)
			.setOrigin(0);
		this.scrollThumb = this.add.rectangle(trackX, VIEWPORT.y + 4, 6, 40, 0x40577f)
			.setOrigin(0)
			.setInteractive({ useHandCursor: true });

		this.scrollThumb.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
			this.draggingThumb = true;
		});
	}

	private createFooter() {
		this.add.text(42, 448, i18n.t('pipes.config.profiles'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '11px',
			color: '#6d7da8',
			letterSpacing: 2,
		});

		this.slotButtons = Array.from({ length: PROFILE_SLOTS }, (_, slot) =>
			this.createButton(127 + slot * 182, 482, 170, 32, '', () => this.useSlot(slot))
		);

		this.add.text(42, 518, i18n.t('pipes.config.onTouch'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '10px',
			color: '#6d7da8',
			letterSpacing: 1,
		}).setOrigin(0, 0.5);

		this.actionButtons = {
			load: this.createButton(180, 518, 96, 26, i18n.t('pipes.config.load'), () => {
				this.setProfileAction('load');
			}),
			save: this.createButton(282, 518, 96, 26, i18n.t('pipes.config.save'), () => {
				this.setProfileAction('save');
			}),
			clear: this.createButton(384, 518, 96, 26, i18n.t('pipes.config.clear'), () => {
				this.setProfileAction('clear');
			}),
		};

		this.createButton(534, 518, 160, 26, i18n.t('pipes.config.reset'), () => this.resetDefaults());
		this.createButton(688, 518, 130, 26, i18n.t('pipes.config.back'), () => this.goBack());

		this.statusText = this.add.text(400, 548, '', {
			fontFamily: 'Courier New, monospace',
			fontSize: '11px',
			color: '#5ee48a',
		}).setOrigin(0.5);

		this.add.text(400, 572, i18n.t('pipes.config.hint'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '10px',
			color: '#64759f',
		}).setOrigin(0.5);

		this.refreshFooter();
	}

	private configureInput() {
		const keyboard = this.input.keyboard!;
		this.escapeKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
		this.upKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
		this.downKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);

		this.input.on(
			Phaser.Input.Events.POINTER_WHEEL,
			(_pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
				this.scrollBy(dy * WHEEL_STEP);
			}
		);

		// Arrastrar la barra mueve la lista en proporción a lo que sobra de alto.
		this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
			if (!this.draggingThumb) return;

			const usable = VIEWPORT.height - 8 - this.scrollThumb.height;
			if (usable <= 0) return;

			// `pointer.y` está en píxeles del canvas y `worldY` dependería de la
			// cámara bajo el puntero, que puede ser la de la lista desplazada.
			const offset = pointer.y / RENDER_SCALE - VIEWPORT.y - 4 - this.scrollThumb.height / 2;
			this.scrollTo((offset / usable) * this.maxScroll);
		});

		this.input.on(Phaser.Input.Events.POINTER_UP, () => {
			this.draggingThumb = false;
		});
	}

	// --- Contenido del visor --------------------------------------------------

	/** Rearma la lista completa; se llama al entrar y al cambiar de submenú. */
	private buildContent() {
		// Sin argumentos: el contenedor se saca de la lista de dibujo y arrastra a
		// sus hijos. Pasarle `true` significaría "se está cerrando la escena" y lo
		// dejaría colgado ahí.
		this.content?.destroy();
		this.valueUpdaters = [];

		this.content = this.add.container(0, VIEWPORT.y);

		this.contentHeight = this.view === 'main' ? this.buildMainList() : this.buildBagList();
		this.splitCameras();
		this.scrollTo(0);
		this.refreshValues();
	}

	/**
	 * Reparte los objetos entre las dos cámaras.
	 *
	 * Cada cámara dibuja todo lo que no ignora, así que hay que decirle a la
	 * principal que se saltee la lista y a la del visor que se saltee el resto.
	 * `ignore` marca al objeto, no a la cámara: repetirlo no acumula nada.
	 */
	private splitCameras() {
		this.cameras.main.ignore(this.content);
		this.listCamera.ignore(this.children.list.filter((child) => child !== this.content));
	}

	private buildMainList(): number {
		let y = 12;

		for (const group of TUNING_GROUPS) {
			this.addGroupTitle(y, i18n.t(group.titleKey));
			y += GROUP_HEIGHT;

			for (const field of group.fields) {
				this.addFieldRow(y, field);
				y += ROW_HEIGHT;
			}

			y += 10;
		}

		// La bolsa tiene su propia lista: son siete piezas con su propio total.
		this.addGroupTitle(y, i18n.t('pipes.config.group.bag'));
		y += GROUP_HEIGHT;
		this.addSubmenuRow(y, i18n.t('pipes.config.openBag'), () => this.showView('bag'));

		return y + 44;
	}

	private buildBagList(): number {
		let y = 12;

		this.addSubmenuRow(y, i18n.t('pipes.config.closeBag'), () => this.showView('main'));
		y += 44;

		this.addGroupTitle(y, i18n.t('pipes.config.group.bag'));
		y += GROUP_HEIGHT;

		for (const type of PIPE_TYPES) {
			this.addBagRow(y, type);
			y += ROW_HEIGHT + 8;
		}

		y += 4;
		this.addTotalRow(y);
		y += ROW_HEIGHT;

		const hint = this.add.text(64, y + 6, i18n.t('pipes.config.bagHint'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '11px',
			color: '#7384aa',
			wordWrap: { width: 620 },
			lineSpacing: 4,
		});
		this.content.add(hint);

		return y + hint.height + 20;
	}

	private addGroupTitle(y: number, text: string) {
		const title = this.add.text(56, y + 8, text, {
			fontFamily: 'Arial, sans-serif',
			fontSize: '11px',
			color: '#5ee48a',
			letterSpacing: 3,
		});
		const line = this.add.rectangle(56, y + 26, VIEWPORT.width - 40, 1, 0x24365c).setOrigin(0);

		this.content.add([title, line]);
	}

	/** Fila de un número: etiqueta, valor y los dos botones que lo mueven. */
	private addFieldRow(y: number, field: TuningField) {
		const label = this.add.text(64, y + ROW_HEIGHT / 2, i18n.t(field.labelKey), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '12px',
			color: '#9eacd0',
		}).setOrigin(0, 0.5);

		const value = this.add.text(600, y + ROW_HEIGHT / 2, '', {
			fontFamily: 'Courier New, monospace',
			fontSize: '13px',
			color: '#ffffff',
		}).setOrigin(1, 0.5);

		this.content.add([label, value]);
		this.addStepper(y, 640, '−', (multiplier) => this.stepField(field, -multiplier));
		this.addStepper(y, 686, '+', (multiplier) => this.stepField(field, multiplier));

		this.valueUpdaters.push(() => {
			value.setText(formatTuningValue(pipesTuning.current[field.key], field.format));
		});
	}

	/** Fila de una pieza de la bolsa: se dibuja la pieza además de nombrarla. */
	private addBagRow(y: number, type: PipeType) {
		const preview = this.add.graphics();
		drawPipe(preview, 78, y + ROW_HEIGHT / 2, 26, type);

		const label = this.add.text(104, y + ROW_HEIGHT / 2, i18n.t(PIECE_LABEL_KEYS[type]), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '12px',
			color: '#9eacd0',
		}).setOrigin(0, 0.5);

		const value = this.add.text(600, y + ROW_HEIGHT / 2, '', {
			fontFamily: 'Courier New, monospace',
			fontSize: '13px',
			color: '#ffffff',
		}).setOrigin(1, 0.5);

		this.content.add([preview, label, value]);
		this.addStepper(y, 640, '−', (multiplier) => this.stepBag(type, -multiplier));
		this.addStepper(y, 686, '+', (multiplier) => this.stepBag(type, multiplier));

		this.valueUpdaters.push(() => {
			const count = pipesTuning.current.bag[type];
			const total = bagTotal(pipesTuning.current.bag);
			const share = total > 0 ? Math.round((count / total) * 100) : 0;
			value.setText(`${count}   ${share} %`);
			value.setColor(count === 0 ? '#64759f' : '#ffffff');
		});
	}

	private addTotalRow(y: number) {
		const label = this.add.text(64, y + ROW_HEIGHT / 2, i18n.t('pipes.config.bagTotal'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '12px',
			color: '#ffca4b',
		}).setOrigin(0, 0.5);

		const value = this.add.text(600, y + ROW_HEIGHT / 2, '', {
			fontFamily: 'Courier New, monospace',
			fontSize: '13px',
			color: '#ffca4b',
		}).setOrigin(1, 0.5);

		this.content.add([label, value]);
		this.valueUpdaters.push(() => value.setText(String(bagTotal(pipesTuning.current.bag))));
	}

	private addSubmenuRow(y: number, text: string, onClick: () => void) {
		const rect = this.add.rectangle(56, y, VIEWPORT.width - 40, 34, 0x142445)
			.setOrigin(0)
			.setStrokeStyle(1, 0x40577f)
			.setInteractive({ useHandCursor: true });
		const label = this.add.text(72, y + 17, text, {
			fontFamily: 'Courier New, monospace',
			fontSize: '13px',
			color: '#d9e2ff',
		}).setOrigin(0, 0.5);

		rect.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
			audioManager.playSfx(this, PIPES_AUDIO.confirm.cacheKey);
			onClick();
		});

		this.content.add([rect, label]);
	}

	/** Botón − o + de una fila. */
	private addStepper(y: number, x: number, text: string, onClick: (multiplier: number) => void) {
		const rect = this.add.rectangle(x, y + ROW_HEIGHT / 2, 32, 22, 0x1b2947)
			.setStrokeStyle(1, 0x40577f)
			.setInteractive({ useHandCursor: true });
		const label = this.add.text(x, y + ROW_HEIGHT / 2, text, {
			fontFamily: 'Courier New, monospace',
			fontSize: '14px',
			color: '#d9e2ff',
		}).setOrigin(0.5);

		rect.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
			const event = pointer.event as MouseEvent | undefined;
			onClick(event?.shiftKey ? SHIFT_MULTIPLIER : 1);
		});

		this.content.add([rect, label]);
	}

	// --- Cambios de valor -----------------------------------------------------

	private stepField(field: TuningField, steps: number) {
		const previous = pipesTuning.current[field.key];
		pipesTuning.setValue(field.key, previous + steps * field.step);
		this.reportChange(pipesTuning.current[field.key] !== previous);
	}

	private stepBag(type: PipeType, steps: number) {
		const previous = pipesTuning.current.bag[type];
		pipesTuning.setBagCount(type, previous + steps);
		this.reportChange(pipesTuning.current.bag[type] !== previous);
	}

	/** Un cambio real suena y repinta; uno rechazado por el tope, sólo avisa. */
	private reportChange(changed: boolean) {
		audioManager.playSfx(
			this,
			changed ? PIPES_AUDIO.place.cacheKey : PIPES_AUDIO.blocked.cacheKey
		);
		if (changed) this.refreshValues();
	}

	private refreshValues() {
		for (const update of this.valueUpdaters) update();
	}

	// --- Perfiles -------------------------------------------------------------

	private setProfileAction(action: ProfileAction) {
		this.profileAction = action;
		audioManager.playSfx(this, PIPES_AUDIO.confirm.cacheKey);
		this.refreshFooter();
	}

	private useSlot(slot: number) {
		const name = `${i18n.t('pipes.config.slot')} ${slot + 1}`;

		if (this.profileAction === 'save') {
			pipesTuning.saveProfile(slot);
			this.showStatus(`${name} · ${i18n.t('pipes.config.status.saved')}`);
		} else if (this.profileAction === 'clear') {
			pipesTuning.clearProfile(slot);
			this.showStatus(`${name} · ${i18n.t('pipes.config.status.cleared')}`);
		} else if (pipesTuning.loadProfile(slot)) {
			this.refreshValues();
			this.showStatus(`${name} · ${i18n.t('pipes.config.status.loaded')}`);
		} else {
			audioManager.playSfx(this, PIPES_AUDIO.blocked.cacheKey);
			this.showStatus(`${name} · ${i18n.t('pipes.config.status.empty')}`, false);
			return;
		}

		audioManager.playSfx(this, PIPES_AUDIO.confirm.cacheKey);
		this.refreshFooter();
	}

	private resetDefaults() {
		pipesTuning.resetToDefaults();
		this.refreshValues();
		this.refreshFooter();
		audioManager.playSfx(this, PIPES_AUDIO.confirm.cacheKey);
		this.showStatus(i18n.t('pipes.config.status.reset'));
	}

	private showStatus(message: string, positive = true) {
		this.statusText.setText(message);
		this.statusText.setColor(positive ? '#5ee48a' : '#ff9f43');
	}

	/** Repinta el estado de las ranuras y cuál acción está elegida. */
	private refreshFooter() {
		this.slotButtons.forEach((button, slot) => {
			const filled = pipesTuning.profileAt(slot) !== null;
			const state = i18n.t(filled ? 'pipes.config.slotFilled' : 'pipes.config.slotEmpty');

			button.label.setText(`${i18n.t('pipes.config.slot')} ${slot + 1}  ·  ${state}`);
			button.label.setColor(filled ? '#d9e2ff' : '#64759f');
			button.rect.setFillStyle(filled ? 0x142445 : 0x101a31);
			button.rect.setStrokeStyle(1, filled ? 0x40577f : 0x2a3a5c);
		});

		const colors: Record<ProfileAction, number> = {
			load: 0x5ee48a,
			save: 0x46d9ff,
			clear: 0xff9f43,
		};

		for (const action of Object.keys(this.actionButtons) as ProfileAction[]) {
			const button = this.actionButtons[action]!;
			const active = this.profileAction === action;

			button.rect.setFillStyle(active ? 0x1b2947 : 0x101a31);
			button.rect.setStrokeStyle(1, active ? colors[action] : 0x2a3a5c);
			button.label.setColor(active ? '#ffffff' : '#64759f');
		}
	}

	// --- Navegación y scroll ---------------------------------------------------

	private showView(view: 'main' | 'bag') {
		this.view = view;
		this.buildContent();
	}

	private get maxScroll(): number {
		return Math.max(0, this.contentHeight - VIEWPORT.height);
	}

	private scrollBy(delta: number) {
		this.scrollTo(this.scrollY + delta);
	}

	/** Desplazar es mover la cámara, no la lista: el contenido queda quieto. */
	private scrollTo(value: number) {
		this.scrollY = Phaser.Math.Clamp(value, 0, this.maxScroll);
		this.listCamera.setScroll(VIEWPORT.x, VIEWPORT.y + this.scrollY);
		this.refreshScrollbar();
	}

	/** La barra sólo aparece cuando hay algo fuera de pantalla. */
	private refreshScrollbar() {
		const scrollable = this.maxScroll > 0;
		this.scrollTrack.setVisible(scrollable);
		this.scrollThumb.setVisible(scrollable);
		if (!scrollable) return;

		const trackHeight = VIEWPORT.height - 8;
		const thumbHeight = Math.max(30, (VIEWPORT.height / this.contentHeight) * trackHeight);
		const progress = this.scrollY / this.maxScroll;

		this.scrollThumb.setSize(6, thumbHeight);
		// El área sensible se fija al crear el objeto: sin esto, arrastrar la barra
		// respondería sobre el alto viejo.
		const hitArea = this.scrollThumb.input?.hitArea as Phaser.Geom.Rectangle | undefined;
		hitArea?.setSize(6, thumbHeight);

		this.scrollThumb.setY(VIEWPORT.y + 4 + progress * (trackHeight - thumbHeight));
	}

	private createButton(
		x: number,
		y: number,
		width: number,
		height: number,
		label: string,
		onClick: () => void
	): Button {
		const rect = this.add.rectangle(x, y, width, height, 0x101a31)
			.setStrokeStyle(1, 0x2a3a5c)
			.setInteractive({ useHandCursor: true });
		const text = this.add.text(x, y, label, {
			fontFamily: 'Courier New, monospace',
			fontSize: '11px',
			color: '#9eacd0',
		}).setOrigin(0.5);

		rect.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, onClick);

		return { rect, label: text };
	}

	private goBack() {
		audioManager.playSfx(this, PIPES_AUDIO.confirm.cacheKey);
		this.scene.start(PIPES_SCENES.TITLE);
	}
}
