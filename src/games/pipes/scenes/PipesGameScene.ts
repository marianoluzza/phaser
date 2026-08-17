import Phaser from 'phaser';
import { audioManager } from '../../../core/audio/AudioManager';
import { i18n } from '../../../core/i18n/i18n';
import { loadPipesAudio, PIPES_AUDIO } from '../audio';
import { BOARD_COLUMNS, BOARD_ROWS, PipeBoard } from '../objects/PipeBoard';
import { PipeQueue } from '../objects/PipeQueue';
import { drawPipe, drawPipeFill, drawSource, PIPE_COLORS } from '../objects/pipeRenderer';
import { WaterFlow } from '../objects/WaterFlow';
import { FIRST_LEVEL, levelSetup, type LevelSetup } from '../constants/levels';
import type { PipesTuning } from '../constants/tuning';
import { pipesTuning } from '../tuningStore';
import { PIPES_SCENES } from '../sceneKeys';

/** Pausa entre el derrame y el cierre del nivel, para ver dónde se cortó. */
const SPILL_DELAY = 900;

/** Datos con los que se entra a un nivel; el primero llega sin nada. */
type PipesGameData = {
	level?: number;
	/** Puntaje acumulado en los niveles anteriores. */
	score?: number;
};

/**
 * Partida de Pipes.
 *
 * La escena coordina tres piezas de estado que no saben nada de Phaser:
 * `PipeBoard` (qué hay en cada celda), `PipeQueue` (qué toca colocar) y
 * `WaterFlow` (por dónde va el agua). Acá sólo se dibuja, se lee la entrada y
 * se decide cuándo empieza y termina el nivel.
 */
export class PipesGameScene extends Phaser.Scene {
	// Estado de la partida.
	private board!: PipeBoard;
	private queue!: PipeQueue;
	private flow!: WaterFlow;
	private tuning: PipesTuning = pipesTuning.current;
	private setup: LevelSetup = levelSetup(FIRST_LEVEL, this.tuning);
	private carriedScore = 0;
	/** Piezas secas pisadas en este nivel; cada una descuenta puntos. */
	private replacements = 0;
	private phase: 'countdown' | 'flowing' | 'over' = 'countdown';
	/** Con F el agua corre acelerada; se puede volver atrás con la misma tecla. */
	private fastForward = false;
	private countdownRemaining = 0;
	private cursorColumn = 0;
	private cursorRow = 0;

	// Medidas del tablero en celdas y en píxeles.
	private readonly cell = 40;
	private readonly offsetX = 360;
	private readonly offsetY = 118;

	// Capas visuales que se repintan a partir del estado.
	private pipeLayer!: Phaser.GameObjects.Graphics;
	private queueLayer!: Phaser.GameObjects.Graphics;
	private cursorHighlight!: Phaser.GameObjects.Rectangle;
	private scoreValue!: Phaser.GameObjects.Text;
	private segmentsValue!: Phaser.GameObjects.Text;
	private crossValue!: Phaser.GameObjects.Text;
	private replaceValue!: Phaser.GameObjects.Text;
	private bagValue!: Phaser.GameObjects.Text;
	private timerLabel!: Phaser.GameObjects.Text;
	private timerValue!: Phaser.GameObjects.Text;
	private timerBar!: Phaser.GameObjects.Rectangle;

	private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
	private enterKey!: Phaser.Input.Keyboard.Key;
	private fastForwardKey!: Phaser.Input.Keyboard.Key;
	private restartKey!: Phaser.Input.Keyboard.Key;
	private escapeKey!: Phaser.Input.Keyboard.Key;

	private readonly timerBarWidth = 170;

	constructor() {
		super(PIPES_SCENES.GAME);
	}

	/**
	 * Nivel y puntaje acumulado llegan desde el cierre del nivel anterior.
	 * Entrar sin datos, desde el título, arranca una partida nueva.
	 *
	 * La configuración se lee acá y no en cada uso: cambiarla a mitad de una
	 * partida haría que el nivel se juegue con reglas distintas a las que
	 * empezó.
	 */
	init(data: PipesGameData) {
		this.tuning = pipesTuning.current;
		this.setup = levelSetup(data.level ?? FIRST_LEVEL, this.tuning);
		this.carriedScore = data.score ?? 0;
	}

	preload() {
		loadPipesAudio(
			this,
			PIPES_AUDIO.gameMusic,
			PIPES_AUDIO.confirm,
			PIPES_AUDIO.place,
			PIPES_AUDIO.replace,
			PIPES_AUDIO.blocked,
			PIPES_AUDIO.flowStart,
			PIPES_AUDIO.spill
		);
	}

	create() {
		this.resetGameState();

		this.cameras.main.setBackgroundColor('#080d1a');
		this.drawBackground();
		this.drawBoardGrid();
		this.drawSidePanel();

		this.pipeLayer = this.add.graphics();
		this.queueLayer = this.add.graphics();
		this.cursorHighlight = this.add.rectangle(0, 0, this.cell, this.cell)
			.setOrigin(0)
			.setStrokeStyle(2, 0x5ee48a);

		this.configureInput();
		this.render();

		audioManager.playMusic(this, PIPES_AUDIO.gameMusic.cacheKey);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audioManager.stopMusic());
	}

	update(_time: number, delta: number) {
		if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
			this.returnToTitle();
			return;
		}

		if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
			this.restartGame();
			return;
		}

		if (Phaser.Input.Keyboard.JustDown(this.fastForwardKey)) {
			this.toggleFastForward();
		}

		this.readCursorKeys();

		if (this.phase === 'countdown') {
			this.updateCountdown(delta);
			return;
		}

		if (this.phase === 'flowing') {
			this.updateFlow(delta);
		}
	}

	/** Las escenas se reutilizan: cada partida arranca desde un estado limpio. */
	private resetGameState() {
		this.board = new PipeBoard();
		this.queue = new PipeQueue(this.tuning.bag);
		this.flow = new WaterFlow(this.board, this.setup.msPerSegment);
		this.replacements = 0;
		this.fastForward = false;
		this.phase = 'countdown';
		this.countdownRemaining = this.setup.countdown;
		this.cursorColumn = Math.floor(BOARD_COLUMNS / 2);
		this.cursorRow = Math.floor(BOARD_ROWS / 2);
	}

	private readCursorKeys() {
		if (Phaser.Input.Keyboard.JustDown(this.cursors.left)) this.moveCursor(-1, 0);
		if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) this.moveCursor(1, 0);
		if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) this.moveCursor(0, -1);
		if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) this.moveCursor(0, 1);

		if (
			Phaser.Input.Keyboard.JustDown(this.cursors.space) ||
			Phaser.Input.Keyboard.JustDown(this.enterKey)
		) {
			this.placeCurrentPiece();
		}
	}

	private updateCountdown(delta: number) {
		this.countdownRemaining -= delta;
		if (this.countdownRemaining > 0) {
			this.renderTimer();
			return;
		}

		this.countdownRemaining = 0;
		this.phase = 'flowing';
		this.flow.start();
		audioManager.playSfx(this, PIPES_AUDIO.flowStart.cacheKey);

		// El recorrido puede estar cortado desde el arranque mismo.
		if (this.flow.hasSpilled) {
			this.finishGame();
			return;
		}

		this.render();
	}

	private updateFlow(delta: number) {
		// Acelerar es entregarle más tiempo al caudal, no cambiarle la velocidad:
		// el recorrido y el puntaje salen exactamente iguales, sólo se ven antes.
		const step = this.flow.update(delta * (this.fastForward ? this.tuning.fastForwardFactor : 1));
		this.render();

		if (step === 'spilled') {
			this.finishGame();
		}
	}

	/**
	 * F: dejar de esperar.
	 *
	 * Durante la cuenta regresiva larga el agua directamente; con el agua ya
	 * corriendo la acelera. En los dos casos es la misma intención: ya no queda
	 * nada por construir y sólo falta ver cómo termina.
	 */
	private toggleFastForward() {
		if (this.phase === 'over') return;

		if (this.phase === 'countdown') {
			this.countdownRemaining = 0;
			audioManager.playSfx(this, PIPES_AUDIO.confirm.cacheKey);
			return;
		}

		this.fastForward = !this.fastForward;
		audioManager.playSfx(this, PIPES_AUDIO.confirm.cacheKey);
		this.renderTimer();
	}

	/**
	 * El agua siempre termina derramándose: el nivel se supera si llegó a la
	 * meta antes de cortarse.
	 */
	private finishGame() {
		this.phase = 'over';
		const cleared = this.flow.filledSegments >= this.setup.goal;
		audioManager.playSfx(this, cleared ? PIPES_AUDIO.flowStart.cacheKey : PIPES_AUDIO.spill.cacheKey);
		this.render();

		// Recién con el agua cortada se sabe qué piezas quedaron sin usar.
		const loosePieces = this.board.placedCount - this.board.floodedCount;
		const doubleCrossings = this.flow.doubleCrossings;

		this.time.delayedCall(SPILL_DELAY, () => {
			this.scene.start(PIPES_SCENES.ROUND_END, {
				level: this.setup.level,
				score: Math.max(0, this.carriedScore + this.levelPoints - loosePieces * this.tuning.loosePenalty),
				segments: this.flow.filledSegments,
				goal: this.setup.goal,
				cleared,
				doubleCrossings,
				crossBonus: this.crossBonus,
				replacements: this.replacements,
				replacePenalty: this.replacements * this.tuning.replacePenalty,
				loosePieces,
				loosePenalty: loosePieces * this.tuning.loosePenalty,
			});
		});
	}

	/**
	 * Puntos del nivel en curso, sin la multa por piezas sueltas.
	 *
	 * Esa multa depende de todo lo que quedó en el tablero, así que sólo se puede
	 * calcular al cortarse el agua: durante la partida una pieza todavía no usada
	 * no está suelta, está esperando.
	 */
	private get levelPoints(): number {
		return (
			this.flow.filledSegments * this.tuning.pointsPerSegment +
			this.flow.doubleCrossings * this.tuning.crossDoubleBonus +
			this.crossBonus -
			this.replacements * this.tuning.replacePenalty
		);
	}

	/** Premio por juntar varios cruces dobles en el mismo nivel. */
	private get crossBonus(): number {
		const threshold = this.tuning.crossBonusThreshold;
		if (threshold <= 0 || this.flow.doubleCrossings < threshold) return 0;

		return this.tuning.crossBonusPoints;
	}

	/** Puntaje visible: lo acumulado en los niveles anteriores más este nivel. */
	private get score(): number {
		return Math.max(0, this.carriedScore + this.levelPoints);
	}

	private configureInput() {
		const keyboard = this.input.keyboard!;
		this.cursors = keyboard.createCursorKeys();
		this.enterKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
		this.fastForwardKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
		this.restartKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
		this.escapeKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

		// Un solo listener para toda la grilla: 100 celdas interactivas serían
		// 100 objetos escuchando lo mismo.
		this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
			const cell = this.cellFromPointer(pointer);
			if (!cell) return;

			this.cursorColumn = cell.column;
			this.cursorRow = cell.row;
			this.render();
		});

		this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
			const cell = this.cellFromPointer(pointer);
			if (!cell) return;

			this.cursorColumn = cell.column;
			this.cursorRow = cell.row;
			this.placeCurrentPiece();
		});
	}

	/** Traduce un punto del canvas a coordenadas de la grilla. */
	private cellFromPointer(pointer: Phaser.Input.Pointer) {
		const column = Math.floor((pointer.worldX - this.offsetX) / this.cell);
		const row = Math.floor((pointer.worldY - this.offsetY) / this.cell);

		return this.board.contains(column, row) ? { column, row } : null;
	}

	private moveCursor(deltaColumn: number, deltaRow: number) {
		this.cursorColumn = Phaser.Math.Clamp(this.cursorColumn + deltaColumn, 0, BOARD_COLUMNS - 1);
		this.cursorRow = Phaser.Math.Clamp(this.cursorRow + deltaRow, 0, BOARD_ROWS - 1);
		this.render();
	}

	private placeCurrentPiece() {
		if (this.phase === 'over') return;

		const result = this.board.place(this.cursorColumn, this.cursorRow, this.queue.current);
		if (result === 'outside') return;

		// Una celda mojada no se toca: el intento no gasta la pieza de la cola.
		if (result === 'blocked') {
			audioManager.playSfx(this, PIPES_AUDIO.blocked.cacheKey);
			return;
		}

		this.queue.shift();
		if (result === 'replaced') this.replacements += 1;

		audioManager.playSfx(
			this,
			result === 'replaced' ? PIPES_AUDIO.replace.cacheKey : PIPES_AUDIO.place.cacheKey
		);
		this.render();
	}

	/** Reinicia el nivel actual conservando lo acumulado en los anteriores. */
	private restartGame() {
		audioManager.playSfx(this, PIPES_AUDIO.confirm.cacheKey);
		this.scene.restart({ level: this.setup.level, score: this.carriedScore });
	}

	/** Repinta todo lo que depende del estado. */
	private render() {
		this.renderBoard();
		this.renderQueue();
		this.renderTimer();
		this.cursorHighlight.setPosition(
			this.offsetX + this.cursorColumn * this.cell,
			this.offsetY + this.cursorRow * this.cell
		);
		this.cursorHighlight.setVisible(!this.board.isBlocked(this.cursorColumn, this.cursorRow));
		this.scoreValue.setText(String(this.score));

		// Los tramos se muestran contra la meta: es la información que decide
		// si conviene seguir estirando el recorrido o cerrarlo.
		const segments = this.flow.filledSegments;
		const goalReached = segments >= this.setup.goal;
		this.segmentsValue.setText(`${segments} / ${this.setup.goal}`);
		this.segmentsValue.setColor(goalReached ? '#5ee48a' : '#d9e2ff');

		// Las dos jugadas que mueven el puntaje fuera de los tramos, a la vista.
		const doubles = this.flow.doubleCrossings;
		this.crossValue.setText(
			this.tuning.crossBonusThreshold > 0
				? `${doubles} / ${this.tuning.crossBonusThreshold}`
				: String(doubles)
		);
		this.crossValue.setColor(this.crossBonus > 0 ? '#ffca4b' : '#8290b3');
		this.replaceValue.setText(
			this.replacements > 0 ? `${this.replacements}  −${this.replacements * this.tuning.replacePenalty}` : '0'
		);
		this.bagValue.setText(`${this.queue.remainingInBag} / ${this.queue.bagSize}`);
	}

	private renderBoard() {
		this.pipeLayer.clear();

		const source = this.board.source;
		drawSource(
			this.pipeLayer,
			this.centerXOf(source.column),
			this.centerYOf(source.row),
			this.cell,
			source.direction
		);

		this.board.forEachPipe((column, row, type) => {
			drawPipe(this.pipeLayer, this.centerXOf(column), this.centerYOf(row), this.cell, type);
		});

		// El agua se dibuja después para que quede por encima de la cañería seca.
		// Un cruce atravesado dos veces tiene dos caminos mojados, así que se
		// dibuja uno por cada borde de entrada que registró el tablero.
		const head = this.flow.currentHead;
		this.board.forEachPipe((column, row, type) => {
			for (const entry of this.board.floodEntriesAt(column, row)) {
				// El camino que el agua está recorriendo se dibuja a medio llenar.
				const isHead = head !== null && head.column === column && head.row === row
					&& head.entry === entry;

				drawPipeFill(
					this.pipeLayer,
					this.centerXOf(column),
					this.centerYOf(row),
					this.cell,
					type,
					entry,
					isHead ? head.progress : 1
				);
			}
		});

		// Vista previa translúcida: muestra cómo quedaría la pieza actual.
		if (!this.board.isBlocked(this.cursorColumn, this.cursorRow)) {
			drawPipe(
				this.pipeLayer,
				this.centerXOf(this.cursorColumn),
				this.centerYOf(this.cursorRow),
				this.cell,
				this.queue.current,
				{ alpha: 0.35 }
			);
		}
	}

	private renderQueue() {
		this.queueLayer.clear();

		const [current, ...upcoming] = this.queue.preview;
		drawPipe(this.queueLayer, 94, 192, 60, current);

		upcoming.forEach((type, index) => {
			drawPipe(this.queueLayer, 94, 288 + index * 48, 34, type);
		});
	}

	private renderTimer() {
		if (this.phase === 'countdown') {
			const seconds = Math.ceil(this.countdownRemaining / 1000);
			this.timerLabel.setText(i18n.t('pipes.game.countdown'));
			this.timerValue.setText(`${seconds}s`);
			this.timerBar.setFillStyle(PIPE_COLORS.source);
			this.timerBar.setDisplaySize(
				(this.countdownRemaining / this.setup.countdown) * this.timerBarWidth,
				10
			);
			return;
		}

		this.timerLabel.setText(i18n.t(this.fastForward ? 'pipes.game.flowingFast' : 'pipes.game.flowing'));
		this.timerValue.setText(this.fastForward ? `×${this.tuning.fastForwardFactor}` : '');
		this.timerBar.setFillStyle(this.fastForward ? PIPE_COLORS.crossInterior : PIPE_COLORS.water);
		this.timerBar.setDisplaySize(this.timerBarWidth, 10);
	}

	private centerXOf(column: number) {
		return this.offsetX + column * this.cell + this.cell / 2;
	}

	private centerYOf(row: number) {
		return this.offsetY + row * this.cell + this.cell / 2;
	}

	private drawBackground() {
		const graphics = this.add.graphics();
		graphics.fillStyle(0x101b36, 1);
		graphics.fillCircle(720, 30, 230);
		graphics.fillStyle(0x17234a, 0.5);
		graphics.fillCircle(60, 580, 180);
	}

	private drawBoardGrid() {
		const width = BOARD_COLUMNS * this.cell;
		const height = BOARD_ROWS * this.cell;
		const graphics = this.add.graphics();

		graphics.fillStyle(0x0b1224, 1);
		graphics.fillRect(this.offsetX, this.offsetY, width, height);

		// Un damero muy sutil ayuda a contar celdas sin competir con las piezas.
		graphics.fillStyle(0x0e1730, 1);
		for (let row = 0; row < BOARD_ROWS; row += 1) {
			for (let column = 0; column < BOARD_COLUMNS; column += 1) {
				if ((column + row) % 2 === 0) continue;
				graphics.fillRect(
					this.offsetX + column * this.cell,
					this.offsetY + row * this.cell,
					this.cell,
					this.cell
				);
			}
		}

		graphics.lineStyle(1, 0x24365c, 0.9);
		for (let column = 0; column <= BOARD_COLUMNS; column += 1) {
			const x = this.offsetX + column * this.cell;
			graphics.lineBetween(x, this.offsetY, x, this.offsetY + height);
		}
		for (let row = 0; row <= BOARD_ROWS; row += 1) {
			const y = this.offsetY + row * this.cell;
			graphics.lineBetween(this.offsetX, y, this.offsetX + width, y);
		}

		// Un marco marcado separa el tablero del fondo de la escena.
		graphics.lineStyle(2, 0x3d5487, 1);
		graphics.strokeRect(this.offsetX, this.offsetY, width, height);
	}

	private drawSidePanel() {
		this.add.text(40, 40, 'PIPES', {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: '40px',
			color: '#f5f7ff',
			letterSpacing: 6,
		});
		this.add.text(42, 90, `${i18n.t('pipes.game.level')} ${this.setup.level}`, {
			fontFamily: 'Courier New, monospace',
			fontSize: '13px',
			color: '#ff9f43',
			letterSpacing: 3,
		});

		this.drawQueuePanel();
		this.drawStatsPanel();
		this.createButtons();

		// Dos renglones centrados bajo el tablero: en uno solo la lista de teclas
		// se pasaba del borde del canvas.
		const boardCenterX = this.offsetX + (BOARD_COLUMNS * this.cell) / 2;
		this.add.text(boardCenterX, 534, i18n.t('pipes.game.footer'), {
			fontFamily: 'Courier New, monospace',
			fontSize: '11px',
			color: '#64759f',
			align: 'center',
			lineSpacing: 6,
		}).setOrigin(0.5, 0);
	}

	private drawQueuePanel() {
		this.add.text(40, 132, i18n.t('pipes.game.current'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '11px',
			color: '#6d7da8',
			letterSpacing: 2,
		});
		this.add.rectangle(94, 192, 78, 78, 0x0b1224)
			.setStrokeStyle(2, 0x5ee48a);

		this.add.text(40, 244, i18n.t('pipes.game.next'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '11px',
			color: '#6d7da8',
			letterSpacing: 2,
		});
		for (let index = 0; index < this.queue.size - 1; index += 1) {
			this.add.rectangle(94, 288 + index * 48, 42, 42, 0x0b1224)
				.setStrokeStyle(1, 0x34486f);
		}
	}

	private drawStatsPanel() {
		this.add.text(160, 132, i18n.t('pipes.game.score'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '11px',
			color: '#6d7da8',
			letterSpacing: 2,
		});
		this.scoreValue = this.add.text(160, 152, '0', {
			fontFamily: 'Courier New, monospace',
			fontSize: '32px',
			color: '#5ee48a',
		});

		this.add.text(160, 200, i18n.t('pipes.game.segments'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '11px',
			color: '#6d7da8',
			letterSpacing: 2,
		});
		this.segmentsValue = this.add.text(160, 220, `0 / ${this.setup.goal}`, {
			fontFamily: 'Courier New, monospace',
			fontSize: '22px',
			color: '#d9e2ff',
		});

		this.timerLabel = this.add.text(160, 268, '', {
			fontFamily: 'Arial, sans-serif',
			fontSize: '11px',
			color: '#6d7da8',
			letterSpacing: 2,
		});
		this.timerValue = this.add.text(330, 268, '', {
			fontFamily: 'Courier New, monospace',
			fontSize: '12px',
			color: '#ff9f43',
		}).setOrigin(1, 0);

		// La barra vacía queda de fondo para que se vea cuánto falta.
		this.add.rectangle(160, 296, this.timerBarWidth, 10, 0x1a2440).setOrigin(0, 0.5);
		this.timerBar = this.add.rectangle(160, 296, this.timerBarWidth, 10, PIPE_COLORS.source)
			.setOrigin(0, 0.5);

		this.add.text(160, 320, i18n.t('pipes.game.hint'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '11px',
			color: '#8290b3',
			wordWrap: { width: 172 },
			lineSpacing: 4,
		});

		this.crossValue = this.drawCounter(390, i18n.t('pipes.game.doubleCrossings'));
		this.replaceValue = this.drawCounter(408, i18n.t('pipes.game.replacements'));
		// Lo que queda en la bolsa: hace visible que las piezas no salen de la nada.
		this.bagValue = this.drawCounter(426, i18n.t('pipes.game.bag'));
	}

	/** Fila chica del panel: etiqueta a la izquierda y valor pegado a la derecha. */
	private drawCounter(y: number, label: string): Phaser.GameObjects.Text {
		// Sin espaciado extra entre letras: la columna mide 172 px y las etiquetas
		// más largas llegaban a tocar su propio valor.
		this.add.text(160, y, label, {
			fontFamily: 'Arial, sans-serif',
			fontSize: '10px',
			color: '#6d7da8',
			letterSpacing: 1,
		});

		return this.add.text(332, y, '', {
			fontFamily: 'Courier New, monospace',
			fontSize: '12px',
			color: '#8290b3',
		}).setOrigin(1, 0);
	}

	private createButtons() {
		const restartButton = this.add.rectangle(110, 486, 140, 36, 0x111a31)
			.setStrokeStyle(1, 0x40577f)
			.setInteractive({ useHandCursor: true });
		this.add.text(110, 486, i18n.t('pipes.game.restart'), {
			fontFamily: 'Courier New, monospace',
			fontSize: '12px',
			color: '#9eacd0',
		}).setOrigin(0.5);
		restartButton.on('pointerdown', () => this.restartGame());

		const menuButton = this.add.rectangle(262, 486, 140, 36, 0x111a31)
			.setStrokeStyle(1, 0x40577f)
			.setInteractive({ useHandCursor: true });
		this.add.text(262, 486, i18n.t('pipes.game.backToTitle'), {
			fontFamily: 'Courier New, monospace',
			fontSize: '12px',
			color: '#9eacd0',
		}).setOrigin(0.5);
		menuButton.on('pointerdown', () => this.returnToTitle());
	}

	private returnToTitle() {
		audioManager.playSfx(this, PIPES_AUDIO.confirm.cacheKey);
		this.scene.start(PIPES_SCENES.TITLE);
	}
}
