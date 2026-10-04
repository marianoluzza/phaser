import Phaser from 'phaser';
import { i18n } from '../../../core/i18n/i18n';
import { PIECES } from '../constants/pieces';
import { ROOM_IDS, ROOMS, type RoomId } from '../constants/rooms';
import { COMBAT_TUNING } from '../constants/tuning';
import { drawPiece } from './pieceRenderer';
import {
	drawHull,
	drawRoomShell,
	drawSlotBox,
	planX,
	planY,
	roomRect,
	slotCenter,
	SLOT_SIZE,
	type PlanTransform,
} from './shipRenderer';
import { fill } from './text';
import { FONTS } from './ui';
import { effectiveAptitude, type Crew, type CrewMember } from '../state/Crew';
import type { Ship, SlotRef } from '../state/Ship';

/** Colores con los que se lee una aptitud de un vistazo. */
const APTITUDE_COLORS = ['#ff647c', '#d9e2ff', '#5ee48a'];
const APTITUDE_TINTS = [0xff647c, 0x8290b3, 0x5ee48a];

/** Lo que el puntero tiene que recorrer para que un click pase a ser arrastre. */
const DRAG_THRESHOLD = 8;
const TOOLTIP_WIDTH = 230;

/** Algo que se puede tocar en el tablero: un puesto o un lugar de la reserva. */
type Target = { kind: 'slot'; ref: SlotRef } | { kind: 'reserve'; index: number };

/** Sala resaltada: la que el enemigo amenaza esta ronda. */
export type RoomAlert = { room: RoomId; color: number; label: string };

export type CrewBoardOptions = {
	crew: Crew;
	ship: Ship;
	transform: PlanTransform;
	/** Fila donde esperan los tripulantes sin puesto. */
	reserve: { x: number; y: number; spacing: number; size: number };
	/** Se llama después de cada cambio de puestos. */
	onChange?: () => void;
	/** Permite bloquear a quien ya se movió esta ronda. */
	canMove?: (memberId: string) => boolean;
	/** Avisa que una pieza cambió de lugar, para contar el movimiento. */
	onMove?: (memberId: string) => void;
	/** Avisa que se intentó mover a alguien bloqueado, para explicar por qué. */
	onBlocked?: (memberId: string) => void;
	/** Sonidos, opcionales: la pantalla de puestos y el combate usan los mismos. */
	sounds?: { select: () => void; confirm: () => void; blocked: () => void };
};

/**
 * El plano de la nave con su tripulación, y el reparto.
 *
 * Lo comparten la pantalla de puestos y la de combate: las dos muestran la
 * misma nave y reparten la misma gente, sólo que a distinto tamaño y con
 * distintas restricciones. La escena pone el marco; esto pone la nave.
 *
 * Se reparte de tres maneras que terminan en el mismo lugar: click y click,
 * arrastrar y soltar, o flechas y espacio. Todas llaman a `activate`, así que
 * las reglas de quién puede moverse se escriben una sola vez.
 */
export class CrewBoard {
	selectedMemberId: string | null = null;

	private readonly stateGraphics: Phaser.GameObjects.Graphics;
	/** Todo lo que se reescribe en cada cambio vive acá adentro. */
	private readonly dynamicLayer: Phaser.GameObjects.Container;
	private readonly alertGraphics: Phaser.GameObjects.Graphics;
	private readonly alertLabel: Phaser.GameObjects.Text;
	private readonly focusGraphics: Phaser.GameObjects.Graphics;
	private readonly ghostGraphics: Phaser.GameObjects.Graphics;
	private tooltip: Phaser.GameObjects.Container | null = null;

	private enabled = true;
	private pointer = { x: 0, y: 0 };
	private dragStart: { x: number; y: number } | null = null;
	/** El foco del teclado sólo se dibuja si el jugador está usando el teclado. */
	private keyboardMode = false;
	private focus: Target | null = null;
	private hoveredRoom: RoomId | null = null;

	private readonly scene: Phaser.Scene;
	private readonly options: CrewBoardOptions;

	constructor(scene: Phaser.Scene, options: CrewBoardOptions) {
		this.scene = scene;
		this.options = options;
		this.drawStaticPlan();
		this.stateGraphics = scene.add.graphics();
		this.dynamicLayer = scene.add.container(0, 0);
		this.alertGraphics = scene.add.graphics();
		this.alertLabel = scene.add
			.text(0, 0, '', {
				fontFamily: FONTS.mono,
				fontSize: '11px',
				color: '#050914',
				fontStyle: 'bold',
				padding: { x: 4, y: 1 },
			})
			.setOrigin(1, 1)
			.setVisible(false);
		this.focusGraphics = scene.add.graphics();
		this.ghostGraphics = scene.add.graphics().setDepth(9);

		// Late todo el tiempo: una amenaza quieta se confunde con el decorado.
		scene.tweens.add({
			targets: [this.alertGraphics, this.alertLabel],
			alpha: { from: 1, to: 0.35 },
			duration: 600,
			yoyo: true,
			repeat: -1,
		});

		this.createCursorZones();
		this.bindPointer();
		this.bindKeyboard();
		this.refresh();
	}

	/** Vuelve a dibujar todo lo que depende del estado. */
	refresh() {
		this.stateGraphics.clear();
		this.dynamicLayer.removeAll(true);

		this.clampFocus();
		this.drawRoomReadouts();
		this.drawSlots();
		this.drawReserve();
		this.drawFocus();
		this.drawGhost();
	}

	/** Suelta la pieza que el jugador tenga en la mano. */
	clearSelection() {
		this.selectedMemberId = null;
		this.refresh();
	}

	/** Esc suelta la pieza antes de salir de la pantalla. Devuelve si había una. */
	cancelSelection(): boolean {
		if (!this.selectedMemberId) return false;

		this.selectedMemberId = null;
		this.options.sounds?.select();
		this.changed();
		return true;
	}

	/** Mientras se cuenta una ronda, el tablero se mira pero no se toca. */
	setEnabled(enabled: boolean) {
		this.enabled = enabled;
		this.dragStart = null;
		if (!enabled) this.setHoveredRoom(null);
		this.refresh();
	}

	setAlert(alert: RoomAlert | null) {
		this.alertGraphics.clear();
		this.alertLabel.setVisible(Boolean(alert));
		if (!alert) return;

		const rect = roomRect(alert.room, this.options.transform);
		this.alertGraphics.fillStyle(alert.color, 0.12);
		this.alertGraphics.fillRect(rect.x, rect.y, rect.width, rect.height);
		this.alertGraphics.lineStyle(3, alert.color, 1);
		this.alertGraphics.strokeRect(rect.x - 2, rect.y - 2, rect.width + 4, rect.height + 4);

		this.alertLabel
			.setText(alert.label)
			.setBackgroundColor(`#${alert.color.toString(16).padStart(6, '0')}`)
			.setPosition(rect.right + 2, rect.y - 3);
	}

	/** Un destello sobre la sala: para mostrar dónde pegó algo. */
	flashRoom(room: RoomId, color: number) {
		const rect = roomRect(room, this.options.transform);
		const flash = this.scene.add
			.rectangle(rect.centerX, rect.centerY, rect.width, rect.height, color, 0.55)
			.setDepth(8);

		this.scene.tweens.add({
			targets: flash,
			alpha: 0,
			duration: 450,
			onComplete: () => flash.destroy(),
		});
	}

	roomCenter(room: RoomId): { x: number; y: number } {
		const rect = roomRect(room, this.options.transform);
		return { x: rect.centerX, y: rect.centerY };
	}

	private get scale() {
		return this.options.transform.scale;
	}

	private get slotSize() {
		return SLOT_SIZE * this.scale;
	}

	private font(size: number) {
		return `${Math.max(10, Math.round(size * this.scale))}px`;
	}

	private drawStaticPlan() {
		const graphics = this.scene.add.graphics();
		const { transform } = this.options;

		drawHull(graphics, transform);
		for (const id of ROOM_IDS) {
			const profile = ROOMS[id];
			drawRoomShell(graphics, profile, transform);
			this.scene.add.text(
				planX(transform, profile.plan.x + 9),
				planY(transform, profile.plan.y + 9),
				i18n.t(profile.nameKey),
				{
					fontFamily: FONTS.mono,
					fontSize: this.font(12),
					color: '#ffffff',
				}
			);
		}
	}

	/**
	 * Zonas que sólo cambian el cursor.
	 *
	 * Los clicks se resuelven por posición en `targetAt`: así click, arrastre y
	 * teclado comparten la misma geometría y no hay dos fuentes de verdad.
	 */
	private createCursorZones() {
		for (const target of this.allTargets(this.options.crew.size)) {
			const { x, y } = this.targetCenter(target);
			const { width, height } = this.targetSize(target);
			this.scene.add.rectangle(x, y, width, height, 0x000000, 0).setInteractive({ useHandCursor: true });
		}
	}

	private bindPointer() {
		const input = this.scene.input;

		input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
			this.pointer = { x: pointer.x, y: pointer.y };
			this.keyboardMode = false;
			this.drawFocus();
			this.drawGhost();
			this.setHoveredRoom(this.roomAt(pointer.x, pointer.y));
		});

		input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
			if (!this.enabled) return;

			this.pointer = { x: pointer.x, y: pointer.y };
			this.keyboardMode = false;
			const target = this.targetAt(pointer.x, pointer.y);
			if (!target) return;

			// Sólo puede empezar un arrastre quien llegó con la mano vacía: si ya
			// tenía una pieza, este click la está dejando.
			const emptyHanded = !this.selectedMemberId;
			this.activate(target);
			if (emptyHanded && this.selectedMemberId) this.dragStart = { x: pointer.x, y: pointer.y };
		});

		input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
			const start = this.dragStart;
			this.dragStart = null;
			if (!start || !this.enabled || !this.selectedMemberId) return;

			// Soltar casi donde se apretó es un click: la pieza queda en la mano.
			if (Phaser.Math.Distance.Between(start.x, start.y, pointer.x, pointer.y) < DRAG_THRESHOLD) return;

			const target = this.targetAt(pointer.x, pointer.y);
			if (target) this.activate(target);
		});
	}

	private bindKeyboard() {
		const keyboard = this.scene.input.keyboard;
		if (!keyboard) return;

		keyboard.addCapture('LEFT,RIGHT,UP,DOWN,SPACE');
		keyboard.on('keydown-LEFT', () => this.moveFocus(-1, 0));
		keyboard.on('keydown-RIGHT', () => this.moveFocus(1, 0));
		keyboard.on('keydown-UP', () => this.moveFocus(0, -1));
		keyboard.on('keydown-DOWN', () => this.moveFocus(0, 1));
		keyboard.on('keydown-SPACE', () => {
			if (!this.enabled) return;

			this.keyboardMode = true;
			this.focus ??= this.defaultFocus();
			this.activate(this.focus);
		});
	}

	/**
	 * Mueve el foco hacia el objetivo más cercano en esa dirección.
	 *
	 * El plano no es una grilla, así que no hay "la casilla de al lado": se
	 * elige lo que esté más adelante en la dirección pedida, castigando lo que
	 * quede muy corrido hacia el costado.
	 */
	private moveFocus(dx: number, dy: number) {
		if (!this.enabled) return;

		this.keyboardMode = true;
		if (!this.focus) {
			this.focus = this.defaultFocus();
		} else {
			const from = this.targetCenter(this.focus);
			let best: Target | null = null;
			let bestScore = Infinity;

			for (const candidate of this.focusTargets()) {
				const to = this.targetCenter(candidate);
				const along = (to.x - from.x) * dx + (to.y - from.y) * dy;
				if (along <= 4) continue;

				const across = Math.abs((to.x - from.x) * dy - (to.y - from.y) * dx);
				const score = along + across * 2;
				if (score < bestScore) {
					best = candidate;
					bestScore = score;
				}
			}

			if (best) this.focus = best;
		}

		this.options.sounds?.select();
		this.setHoveredRoom(this.focus.kind === 'slot' ? this.focus.ref.room : null);
		this.drawFocus();
		this.drawGhost();
	}

	private defaultFocus(): Target {
		const { ship, crew } = this.options;
		if (ship.unassigned(crew).length) return { kind: 'reserve', index: 0 };

		return { kind: 'slot', ref: { room: ROOM_IDS[0], slot: 0 } };
	}

	/** La reserva se achica a medida que la gente toma puesto: el foco no puede quedar en un hueco. */
	private clampFocus() {
		if (this.focus?.kind !== 'reserve') return;

		const last = this.reserveCount() - 1;
		if (this.focus.index > last) this.focus = { kind: 'reserve', index: Math.max(0, last) };
	}

	private reserveCount(): number {
		// Siempre queda un lugar en la reserva: es adonde se suelta una pieza.
		return Math.max(1, this.options.ship.unassigned(this.options.crew).length);
	}

	private focusTargets(): Target[] {
		return this.allTargets(this.reserveCount());
	}

	private allTargets(reserveCount: number): Target[] {
		const targets: Target[] = [];
		for (const room of ROOM_IDS) {
			for (let slot = 0; slot < ROOMS[room].slots; slot += 1) {
				targets.push({ kind: 'slot', ref: { room, slot } });
			}
		}
		for (let index = 0; index < reserveCount; index += 1) targets.push({ kind: 'reserve', index });

		return targets;
	}

	private targetCenter(target: Target): { x: number; y: number } {
		if (target.kind === 'slot') return slotCenter(target.ref.room, target.ref.slot, this.options.transform);

		return { x: this.reserveX(target.index), y: this.options.reserve.y - 6 };
	}

	private targetSize(target: Target): { width: number; height: number } {
		if (target.kind === 'slot') return { width: this.slotSize, height: this.slotSize };

		const { size } = this.options.reserve;
		return { width: size + 18, height: size + 32 };
	}

	private targetAt(x: number, y: number): Target | null {
		return (
			this.allTargets(this.options.crew.size).find((target) => {
				const center = this.targetCenter(target);
				const { width, height } = this.targetSize(target);
				return Math.abs(x - center.x) <= width / 2 + 3 && Math.abs(y - center.y) <= height / 2 + 3;
			}) ?? null
		);
	}

	private roomAt(x: number, y: number): RoomId | null {
		return ROOM_IDS.find((room) => roomRect(room, this.options.transform).contains(x, y)) ?? null;
	}

	private reserveX(index: number) {
		return this.options.reserve.x + index * this.options.reserve.spacing;
	}

	private activate(target: Target) {
		if (target.kind === 'slot') this.onSlotClick(target.ref);
		else this.onReserveClick(target.index);
	}

	/**
	 * Levantar y dejar.
	 *
	 * Tocar un puesto ocupado levanta a quien esté ahí en vez de devolverlo a la
	 * reserva: mover a alguien de una sala a otra es lo que más se hace, y
	 * hacerlo en dos clicks sin pasar por el banco es lo natural.
	 */
	private onSlotClick(ref: SlotRef) {
		const { ship, sounds } = this.options;

		if (this.selectedMemberId) {
			const displaced = ship.memberIdAt(ref);
			const moving = this.selectedMemberId;
			// Quien venía del banco recién ahora deja su lugar; a quien se
			// levantó de un puesto ya se le contó el movimiento al levantarlo.
			const fromReserve = !ship.slotOf(moving);

			ship.assign(ref, moving);
			if (fromReserve) this.options.onMove?.(moving);
			this.selectedMemberId = displaced && displaced !== moving ? displaced : null;
			sounds?.confirm();
			this.changed();
			return;
		}

		const occupant = ship.memberIdAt(ref);
		if (!occupant) return;

		if (!this.allowed(occupant)) {
			this.refuse(occupant, slotCenter(ref.room, ref.slot, this.options.transform));
			return;
		}

		ship.clear(ref);
		this.options.onMove?.(occupant);
		this.selectedMemberId = occupant;
		sounds?.select();
		this.changed();
	}

	private onReserveClick(index: number) {
		const { ship, crew, sounds } = this.options;

		// Con alguien en la mano, tocar la reserva es soltarlo sin darle puesto.
		if (this.selectedMemberId) {
			this.selectedMemberId = null;
			sounds?.select();
			this.changed();
			return;
		}

		const member = ship.unassigned(crew)[index];
		if (!member) return;

		if (!this.allowed(member.id)) {
			this.refuse(member.id, this.targetCenter({ kind: 'reserve', index }));
			return;
		}

		this.selectedMemberId = member.id;
		sounds?.select();
		this.changed();
	}

	/** Un "no" tiene que verse y sonar distinto a un "sí", y decir por qué. */
	private refuse(memberId: string, at: { x: number; y: number }) {
		this.options.sounds?.blocked();
		this.options.onBlocked?.(memberId);

		const size = this.slotSize + 6;
		const flash = this.scene.add.rectangle(at.x, at.y, size, size).setStrokeStyle(2, 0xff647c).setDepth(8);
		this.scene.tweens.add({
			targets: flash,
			x: at.x + 4,
			duration: 50,
			yoyo: true,
			repeat: 3,
			onComplete: () => flash.destroy(),
		});
	}

	private allowed(memberId: string): boolean {
		return this.options.canMove ? this.options.canMove(memberId) : true;
	}

	private locked(memberId: string): boolean {
		return this.enabled && !this.allowed(memberId);
	}

	private changed() {
		// Con una pieza en la mano la ayuda se esconde: taparía los puestos a
		// los que se está apuntando, y el "0→4" de cada sala ya dice lo que importa.
		if (this.selectedMemberId) this.setHoveredRoom(null);
		this.refresh();
		this.options.onChange?.();
	}

	private selectedMember(): CrewMember | undefined {
		return this.selectedMemberId ? this.options.crew.byId(this.selectedMemberId) : undefined;
	}

	/**
	 * Lo que produce cada sala y, con una pieza en la mano, en cuánto quedaría.
	 *
	 * El multiplicador del puesto dice cuánto sabe la pieza; el "0→4" dice qué
	 * le pasa a la nave, que es lo que el jugador está decidiendo.
	 */
	private drawRoomReadouts() {
		const { ship, crew, transform } = this.options;
		const selected = this.selectedMember();

		for (const room of ROOM_IDS) {
			const profile = ROOMS[room];
			const output = ship.output(room, crew);
			let text = `${i18n.t(profile.effectKey)} ${output}`;
			// Una sala que no produce nada tiene que verse apagada.
			let color = output > 0 ? '#5ee48a' : '#5d6790';

			if (selected) {
				let best = 0;
				for (let slot = 0; slot < profile.slots; slot += 1) {
					best = Math.max(best, ship.output(room, crew, { slot, memberId: selected.id }));
				}
				text = `${i18n.t(profile.effectKey)} ${output}→${best}`;
				color = best > output ? '#5ee48a' : best < output ? '#ff647c' : '#9eacd0';
			}

			this.addText(planX(transform, profile.plan.x + 9), planY(transform, profile.plan.y + 28), text, {
				fontFamily: FONTS.mono,
				fontSize: this.font(13),
				color,
			});
		}
	}

	private drawSlots() {
		const { crew, ship, transform } = this.options;
		const selected = this.selectedMember();
		const size = this.slotSize;

		for (const room of ROOM_IDS) {
			for (let slot = 0; slot < ROOMS[room].slots; slot += 1) {
				const { x, y } = slotCenter(room, slot, transform);
				const memberId = ship.memberIdAt({ room, slot });
				const member = memberId ? crew.byId(memberId) : undefined;

				// Con una pieza en la mano, cada puesto anticipa cuánto rendiría.
				const preview = selected ? effectiveAptitude(selected, room) : null;
				drawSlotBox(this.stateGraphics, x, y, size, {
					occupied: Boolean(member),
					tint: preview === null ? undefined : APTITUDE_TINTS[preview],
				});

				if (member) {
					const locked = this.locked(member.id);
					drawPiece(this.stateGraphics, x, y, size * 0.76, member.type, locked ? 0.35 : 1);
					if (locked) this.drawLock(x + size / 2 - 7 * this.scale, y + size / 2 - 7 * this.scale);
					this.drawWounds(x, y, size, member.wounds);
				}

				if (preview !== null) this.drawPreview(x, y, size, preview, Boolean(member));
			}
		}
	}

	/**
	 * El multiplicador va adentro del puesto, no encima.
	 *
	 * Encima se pisaba con el rendimiento de las salas bajas, como el Puente.
	 * En un puesto vacío ocupa el centro; en uno ocupado, la esquina, para no
	 * tapar a la pieza que ya está ahí.
	 */
	private drawPreview(x: number, y: number, size: number, preview: number, occupied: boolean) {
		const text = preview === 0 ? '—' : `×${preview}`;

		if (!occupied) {
			this.addText(x, y, text, {
				fontFamily: FONTS.mono,
				fontSize: this.font(15),
				color: APTITUDE_COLORS[preview],
				fontStyle: 'bold',
			}).setOrigin(0.5);
			return;
		}

		this.addText(x + size / 2 - 1, y - size / 2 + 1, text, {
			fontFamily: FONTS.mono,
			fontSize: this.font(11),
			color: APTITUDE_COLORS[preview],
			backgroundColor: '#050914',
		}).setOrigin(1, 0);
	}

	/** Una marca por herida, sobre las que lo sacan de combate: se ve cuánto le queda. */
	private drawWounds(x: number, y: number, size: number, wounds: number) {
		if (wounds === 0) return;

		const radius = Math.max(2.5, 3.5 * this.scale);
		const left = x - size / 2 + radius + 3;
		const top = y - size / 2 + radius + 3;

		for (let index = 0; index < COMBAT_TUNING.woundsToDrop; index += 1) {
			const cx = left + index * (radius * 2 + 2);
			if (index < wounds) {
				this.stateGraphics.fillStyle(0xff647c, 1);
				this.stateGraphics.fillCircle(cx, top, radius);
			} else {
				this.stateGraphics.lineStyle(1, 0xff647c, 0.7);
				this.stateGraphics.strokeCircle(cx, top, radius);
			}
		}
	}

	/** Candado chico: esta pieza ya no puede dejar su lugar en esta ronda. */
	private drawLock(x: number, y: number) {
		const g = this.stateGraphics;
		g.fillStyle(0xaab4d6, 1);
		g.fillRect(x - 4, y - 1, 8, 6);
		g.lineStyle(1.5, 0xaab4d6, 1);
		g.beginPath();
		g.arc(x, y - 1, 2.6, Math.PI, 0);
		g.strokePath();
	}

	private drawReserve() {
		const { ship, crew, reserve } = this.options;

		ship.unassigned(crew).forEach((member, index) => {
			const x = this.reserveX(index);
			const selected = member.id === this.selectedMemberId;
			const locked = this.locked(member.id);
			const color = PIECES[member.type].color;
			const { width, height } = this.targetSize({ kind: 'reserve', index });

			if (selected) {
				this.stateGraphics.fillStyle(color, 0.12);
				this.stateGraphics.fillRect(x - width / 2, reserve.y - reserve.size / 2 - 16, width, height);
				this.stateGraphics.lineStyle(1, color, 0.8);
				this.stateGraphics.strokeRect(x - width / 2, reserve.y - reserve.size / 2 - 16, width, height);
			}

			const alpha = selected ? 1 : locked ? 0.3 : 0.75;
			drawPiece(this.stateGraphics, x, reserve.y - 6, reserve.size, member.type, alpha);
			if (locked) this.drawLock(x + reserve.size / 2, reserve.y + reserve.size / 2 - 10);
			this.drawWounds(x, reserve.y - 6, reserve.size, member.wounds);

			this.addText(x, reserve.y + reserve.size / 2 + 10, i18n.t(PIECES[member.type].nameKey), {
				fontFamily: FONTS.mono,
				fontSize: '10px',
				color: selected ? '#ffffff' : '#8290b3',
			}).setOrigin(0.5);
		});
	}

	/** Corchetes en las esquinas: marcan sin tapar lo que hay adentro. */
	private drawFocus() {
		this.focusGraphics.clear();
		if (!this.keyboardMode || !this.focus || !this.enabled) return;

		const { x, y } = this.targetCenter(this.focus);
		const { width, height } = this.targetSize(this.focus);
		const left = x - width / 2 - 4;
		const right = x + width / 2 + 4;
		const top = y - height / 2 - 4;
		const bottom = y + height / 2 + 4;
		const arm = 8;

		this.focusGraphics.lineStyle(2, 0xffffff, 0.95);
		for (const [cx, cy, sx, sy] of [
			[left, top, 1, 1],
			[right, top, -1, 1],
			[left, bottom, 1, -1],
			[right, bottom, -1, -1],
		]) {
			this.focusGraphics.lineBetween(cx, cy, cx + arm * sx, cy);
			this.focusGraphics.lineBetween(cx, cy, cx, cy + arm * sy);
		}
	}

	/**
	 * La pieza en la mano acompaña al cursor.
	 *
	 * Va abajo a la derecha del puntero o del puesto enfocado: encima tapaba
	 * el rendimiento de la sala, y sobre el puesto, su multiplicador.
	 */
	private drawGhost() {
		this.ghostGraphics.clear();
		const selected = this.selectedMember();
		if (!selected || !this.enabled) return;

		const size = 30;
		let { x, y } = { x: this.pointer.x + 20, y: this.pointer.y + 20 };
		if (this.keyboardMode && this.focus) {
			const center = this.targetCenter(this.focus);
			const { width, height } = this.targetSize(this.focus);
			x = center.x + width / 2 + 10;
			y = center.y + height / 2 - 4;
		}

		this.ghostGraphics.fillStyle(0x050914, 0.7);
		this.ghostGraphics.fillCircle(x, y, size * 0.62);
		drawPiece(this.ghostGraphics, x, y, size, selected.type, 0.9);
	}

	/**
	 * Qué hace cada sala, al pasarle por encima.
	 *
	 * "ÓRDENES" no dice nada hasta que alguien explica que son los movimientos
	 * del combate. La ayuda va al costado de la sala para no tapar sus puestos.
	 */
	private setHoveredRoom(room: RoomId | null) {
		if (room === this.hoveredRoom) return;

		this.hoveredRoom = room;
		this.tooltip?.destroy();
		this.tooltip = null;
		if (!room || !this.enabled || this.selectedMemberId) return;

		const profile = ROOMS[room];
		const square = i18n.t(
			profile.squareColor === 'light' ? 'astro.room.square.light' : 'astro.room.square.dark'
		);
		const title = this.scene.add.text(10, 8, `${i18n.t(profile.nameKey)}  ·  ${square}`, {
			fontFamily: FONTS.mono,
			fontSize: '11px',
			color: '#ffffff',
		});
		const body = this.scene.add.text(10, 26, fill(`astro.room.${room}.help` as const, {
			percent: COMBAT_TUNING.evasionPerPoint,
		}), {
			fontFamily: FONTS.sans,
			fontSize: '11px',
			color: '#bfc8e8',
			lineSpacing: 3,
			wordWrap: { width: TOOLTIP_WIDTH - 20 },
		});
		const height = body.y + body.height + 10;
		const background = this.scene.add
			.rectangle(0, 0, TOOLTIP_WIDTH, height, 0x0a0e26, 0.96)
			.setOrigin(0)
			.setStrokeStyle(1, 0x8f86c8);

		const rect = roomRect(room, this.options.transform);
		let x = rect.right + 8;
		if (x + TOOLTIP_WIDTH > 792) x = rect.x - 8 - TOOLTIP_WIDTH;
		const y = Phaser.Math.Clamp(rect.y, 8, 592 - height);

		this.tooltip = this.scene.add
			.container(Math.max(8, x), y, [background, title, body])
			.setDepth(12);
	}

	private addText(
		x: number,
		y: number,
		text: string,
		style: Phaser.Types.GameObjects.Text.TextStyle
	) {
		const label = this.scene.add.text(x, y, text, style);
		this.dynamicLayer.add(label);
		return label;
	}
}
