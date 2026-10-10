import Phaser from 'phaser';
import { audioManager } from '../../../core/audio/AudioManager';
import { i18n } from '../../../core/i18n/i18n';
import { loadTetrisAudio, TETRIS_AUDIO } from '../audio';
import { Piece } from '../objects/Piece';
import type { PieceType } from '../constants/tetrominoes';
import { TETRIS_SCENES } from '../sceneKeys';

/**
 * Escena completa del Tetris.
 *
 * La lógica mantiene dos representaciones del juego:
 * - `board` es el estado real (una matriz de 20 x 10).
 * - los Rectangle de Phaser son solamente su representación visual.
 *
 * Separarlas hace que colisiones, puntaje y reglas no dependan del dibujo.
 */
export class TetrisGameScene extends Phaser.Scene {
	// Estado de la partida.
	private score = 0;
	private lines = 0;
	private level = 1;
	private levelText!: Phaser.GameObjects.Text;

	private readonly linesPerLevel = 10;
	private readonly minGravityInterval = 80;

	// Textos y objetos visuales que luego actualizamos durante la partida.
	private scoreText!: Phaser.GameObjects.Text;
	private linesText!: Phaser.GameObjects.Text;

	private pieceBag: PieceType[] = [];
	private ghostBlocks: Phaser.GameObjects.Rectangle[] = [];
	private currentPiece!: Piece;
	private currentPieceBlocks: Phaser.GameObjects.Rectangle[] = [];
	private nextPiece!: Piece;
	private nextPieceBlocks: Phaser.GameObjects.Rectangle[] = [];
	private board: number[][] = [];
	private boardBlocks: Phaser.GameObjects.Rectangle[] = [];

	// Medidas del tablero expresadas en celdas y en píxeles.
	private readonly cols = 10;
	private readonly rows = 20;
	private readonly cell = 24;
	private readonly offsetX = 280;
	private readonly offsetY = 40;

	private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
	private spaceKey!: Phaser.Input.Keyboard.Key;
	private escapeKey!: Phaser.Input.Keyboard.Key;
	private pauseKey!: Phaser.Input.Keyboard.Key;
	private paused = false;
	private pauseOverlay!: Phaser.GameObjects.Container;
	private pauseButtonLabel!: Phaser.GameObjects.Text;

	// Acumuladores en milisegundos. `delta` indica lo que duró cada frame.
	private gravityTimer = 0;
	private gravityInterval = 500;
	private lockTimer = 0;
	private lockDelay = 500;

	private softDropTimer = 0;
	private softDropInterval = 50;

	private horizontalTimer = 0;
	private horizontalInitialDelay = 170;
	private horizontalRepeatInterval = 70;
	private horizontalDirection: -1 | 0 | 1 = 0;
	private horizontalRepeating = false;

	constructor() {
		super(TETRIS_SCENES.GAME);
	}

	preload() {
		loadTetrisAudio(
			this,
			TETRIS_AUDIO.gameMusic,
			TETRIS_AUDIO.confirm,
			TETRIS_AUDIO.lineClear,
			TETRIS_AUDIO.multiLineClear,
			TETRIS_AUDIO.levelUp,
			TETRIS_AUDIO.pauseToggle
		);
	}

	/** Phaser llama a `create` al comenzar o reiniciar una partida. */
	create() {
		this.resetGameState();
		this.cameras.main.setBackgroundColor('#080d1a');
		this.drawGrid();
		this.drawInterface();
		audioManager.playMusic(this, TETRIS_AUDIO.gameMusic.cacheKey);

		// La siguiente escena decide su propio ambiente sonoro.
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audioManager.stopMusic());

		this.scoreText = this.add.text(40, 78, `${i18n.t('tetris.game.score')}: 0`, {
			fontSize: '24px',
			color: '#ffffff',
		});
		this.linesText = this.add.text(40, 113, `${i18n.t('tetris.game.lines')}: 0`, {
			fontSize: '24px',
			color: '#ffffff',
		});
		this.levelText = this.add.text(40, 148, `${i18n.t('tetris.game.level')}: 1`, {
			fontSize: '24px',
			color: '#ffffff',
		});
		this.add.text(580, 40, i18n.t('tetris.game.next'), {
			fontSize: '24px',
			color: '#8fa0c7',
		});
		this.cursors = this.input.keyboard!.createCursorKeys();
		this.spaceKey = this.input.keyboard!.addKey(
			Phaser.Input.Keyboard.KeyCodes.SPACE
		);
		this.escapeKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
		this.pauseKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.P);

		this.nextPiece = this.createRandomPiece();
		this.spawnPiece();
	}

	/** Phaser llama a `update` en cada frame mientras esta escena está activa. */
	update(_time: number, delta: number) {
		if (Phaser.Input.Keyboard.JustDown(this.pauseKey)) {
			this.togglePause();
			return;
		}

		// La partida vuelve a la pantalla de inicio propia de Tetris.
		if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
			this.returnToTitle();
			return;
		}

		// No llamamos scene.pause: así esta misma escena puede escuchar P para reanudar.
		if (this.paused) {
			return;
		}

		this.handleHorizontalInput(delta);
		this.handleRotationInput();
		this.handleHardDropInput();
		this.handleSoftDrop(delta);
		this.handleGravity(delta);
	}

	/**
	 * Las instancias de Scene se reutilizan. Por eso reiniciamos explícitamente
	 * los datos antes de comenzar una nueva partida.
	 */
	private resetGameState() {
		this.score = 0;
		this.lines = 0;
		this.level = 1;
		this.gravityTimer = 0;
		this.gravityInterval = 500;
		this.lockTimer = 0;
		this.softDropTimer = 0;
		this.horizontalTimer = 0;
		this.horizontalDirection = 0;
		this.horizontalRepeating = false;
		this.paused = false;
		audioManager.setMusicDucked(false);
		this.pieceBag = [];
		this.ghostBlocks = [];
		this.currentPieceBlocks = [];
		this.nextPieceBlocks = [];
		this.boardBlocks = [];

		// Cada 0 representa una celda vacía; luego guardaremos el color de la pieza.
		this.board = Array.from({ length: this.rows }, () => Array(this.cols).fill(0));
	}

	private drawInterface() {
		this.add.text(40, 28, 'TETRIS', {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: '28px',
			color: '#46d9ff',
			letterSpacing: 3,
		});

		this.add.text(40, 230, i18n.t('tetris.game.controlsTitle'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '13px',
			color: '#7384aa',
			letterSpacing: 2,
		});
		this.add.text(40, 260, i18n.t('tetris.game.controls'), {
			fontFamily: 'Courier New, monospace',
			fontSize: '15px',
			color: '#c6d1ed',
			lineSpacing: 8,
		});

		const menuButton = this.add.rectangle(40, 530, 185, 38, 0x182541)
			.setOrigin(0)
			.setStrokeStyle(1, 0x40577f)
			.setInteractive({ useHandCursor: true });
		this.add.text(55, 540, i18n.t('tetris.game.backToTitle'), {
			fontFamily: 'Courier New, monospace',
			fontSize: '12px',
			color: '#d9e2ff',
		});
		menuButton.on('pointerdown', () => this.returnToTitle());

		const pauseButton = this.add.rectangle(40, 480, 185, 38, 0x182541)
			.setOrigin(0)
			.setStrokeStyle(1, 0x40577f)
			.setInteractive({ useHandCursor: true });
		this.pauseButtonLabel = this.add.text(55, 490, i18n.t('tetris.game.pause'), {
			fontFamily: 'Courier New, monospace',
			fontSize: '12px',
			color: '#d9e2ff',
		});
		pauseButton.on('pointerdown', () => this.togglePause());

		this.createPauseOverlay();
	}

	private createPauseOverlay() {
		// El Container permite mostrar u ocultar toda la capa sin tocar el tablero.
		this.pauseOverlay = this.add.container(0, 0).setDepth(20).setVisible(false);
		this.pauseOverlay.add(this.add.rectangle(400, 300, 800, 600, 0x050812, 0.72));
		this.pauseOverlay.add(this.add.text(400, 265, i18n.t('tetris.game.paused'), {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: '46px',
			color: '#f5f7ff',
			letterSpacing: 5,
		}).setOrigin(0.5));
		this.pauseOverlay.add(this.add.text(400, 330, i18n.t('tetris.game.pausedHint'), {
			fontFamily: 'Courier New, monospace',
			fontSize: '14px',
			color: '#aebde1',
		}).setOrigin(0.5));
	}

	private handleHorizontalInput(delta: number) {
		const leftDown = this.cursors.left!.isDown;
		const rightDown = this.cursors.right!.isDown;

		let direction: -1 | 0 | 1 = 0;

		if (leftDown && !rightDown) {
			direction = -1;
		} else if (rightDown && !leftDown) {
			direction = 1;
		}

		if (direction === 0) {
			this.horizontalDirection = 0;
			this.horizontalTimer = 0;
			this.horizontalRepeating = false;
			return;
		}

		if (direction !== this.horizontalDirection) {
			// El primer movimiento ocurre al instante para que el control responda bien.
			this.horizontalDirection = direction;
			this.horizontalTimer = 0;
			this.horizontalRepeating = false;
			this.tryMove(direction, 0);
			return;
		}

		this.horizontalTimer += delta;

		// Si se mantiene la tecla, esperamos y luego repetimos más rápidamente.
		// La demora inicial debe superar lo que dura un toque normal (~100 ms);
		// si no, un solo toque mueve la pieza dos celdas.
		const requiredDelay = this.horizontalRepeating
			? this.horizontalRepeatInterval
			: this.horizontalInitialDelay;

		if (this.horizontalTimer >= requiredDelay) {
			this.tryMove(direction, 0);
			this.horizontalTimer = 0;
			this.horizontalRepeating = true;
		}
	}

	private handleRotationInput() {
		if (!Phaser.Input.Keyboard.JustDown(this.cursors.up!)) {
			return;
		}

		const rotatedShape = this.currentPiece.getRotatedShape();

		if (this.canMoveTo(this.currentPiece.x, this.currentPiece.y, rotatedShape)) {
			this.currentPiece.rotate();
			this.renderPiece();
			if (this.isCurrentPieceGrounded()) {
				this.lockTimer = 0;
			}
		}
	}

	private handleHardDropInput() {
		if (!Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
			return;
		}

		// Avanzamos en una sola actualización hasta la última fila válida.
		while (this.canMoveTo(this.currentPiece.x, this.currentPiece.y + 1)) {
			this.currentPiece.moveDown();
		}

		this.renderPiece();
		this.lockAndSpawnNextPiece();

		this.gravityTimer = 0;
		this.softDropTimer = 0;
	}

	private handleSoftDrop(delta: number) {
		if (!this.cursors.down!.isDown) {
			this.softDropTimer = 0;
			return;
		}

		this.softDropTimer += delta;

		if (this.softDropTimer < this.softDropInterval) {
			return;
		}

		if (!this.tryMove(0, 1)) {
			this.lockAndSpawnNextPiece();
		}

		this.softDropTimer = 0;
		this.gravityTimer = 0;
	}

	private handleGravity(delta: number) {
		// La gravedad no depende de los FPS: acumula tiempo real entre frames.
		this.gravityTimer += delta;

		if (this.gravityTimer < this.gravityInterval) {
			return;
		}

		if (this.tryMove(0, 1)) {
			this.lockTimer = 0;
		} else {
			this.lockTimer += this.gravityTimer;

			if (this.lockTimer >= this.lockDelay) {
				this.lockAndSpawnNextPiece();
				this.lockTimer = 0;
			}
		}

		this.gravityTimer = 0;
	}

	private addScore(clearedLines: number) {
		if (clearedLines === 0) {
			return;
		}

		const pointsByLines: Record<number, number> = {
			1: 100,
			2: 300,
			3: 500,
			4: 800,
		};

		const previousLevel = this.level;
		this.score += pointsByLines[clearedLines] * this.level;
		this.lines += clearedLines;
		const clearSound = clearedLines >= 4
			? TETRIS_AUDIO.multiLineClear
			: TETRIS_AUDIO.lineClear;
		// Un único efecto por limpieza evita que dos o cuatro líneas sean estridentes.
		audioManager.playSfx(this, clearSound.cacheKey);

		this.updateLevel();
		if (this.level > previousLevel) {
			audioManager.playSfx(this, TETRIS_AUDIO.levelUp.cacheKey);
		}

		this.scoreText.setText(`${i18n.t('tetris.game.score')}: ${this.score}`);
		this.linesText.setText(`${i18n.t('tetris.game.lines')}: ${this.lines}`);
		this.levelText.setText(`${i18n.t('tetris.game.level')}: ${this.level}`);
	}

	private updateLevel() {
		this.level = Math.floor(this.lines / this.linesPerLevel) + 1;

		// Cada nivel reduce el intervalo, pero el mínimo mantiene el juego jugable.
		this.gravityInterval = Math.max(
			this.minGravityInterval,
			500 - (this.level - 1) * 40
		);
	}

	private refillPieceBag() {
		// El sistema "7-bag" garantiza una de cada pieza antes de repetir la bolsa.
		this.pieceBag = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

		Phaser.Utils.Array.Shuffle(this.pieceBag);
	}
	private createRandomPiece(): Piece {
		if (this.pieceBag.length === 0) {
			this.refillPieceBag();
		}
		const type = this.pieceBag.pop()!;
		return new Piece(type);
	}

	private spawnPiece() {
		// La pieza que se veía en NEXT pasa a ser la actual.
		this.currentPiece = this.nextPiece;
		this.currentPiece.x = 3;
		this.currentPiece.y = 0;

		this.nextPiece = this.createRandomPiece();

		this.renderNextPiece();

		if (!this.canMoveTo(this.currentPiece.x, this.currentPiece.y)) {
			this.clearGhostPieceRender();

			// Las estadísticas viajan como datos hacia la escena final.
			this.scene.start(TETRIS_SCENES.GAME_OVER, {
				score: this.score,
				lines: this.lines,
				level: this.level,
			});

			return;
		}

		this.createPieceObjects();
		this.renderPiece();
	}

	private returnToTitle() {
		audioManager.playSfx(this, TETRIS_AUDIO.confirm.cacheKey);
		this.scene.start(TETRIS_SCENES.TITLE);
	}

	private togglePause() {
		this.paused = !this.paused;
		audioManager.playSfx(this, TETRIS_AUDIO.pauseToggle.cacheKey);
		audioManager.setMusicDucked(this.paused);
		this.pauseOverlay.setVisible(this.paused);
		this.pauseButtonLabel.setText(
			i18n.t(this.paused ? 'tetris.game.resume' : 'tetris.game.pause')
		);
	}

	private drawGrid() {
		const graphics = this.add.graphics();
		graphics.lineStyle(1, 0x555555);

		for (let x = 0; x <= this.cols; x++) {
			graphics.lineBetween(
				this.offsetX + x * this.cell,
				this.offsetY,
				this.offsetX + x * this.cell,
				this.offsetY + this.rows * this.cell
			);
		}

		for (let y = 0; y <= this.rows; y++) {
			graphics.lineBetween(
				this.offsetX,
				this.offsetY + y * this.cell,
				this.offsetX + this.cols * this.cell,
				this.offsetY + y * this.cell
			);
		}
	}

	private canMoveTo(
		x: number,
		y: number,
		shape = this.currentPiece.shape
	): boolean {
		// Probar primero y mutar después evita tener que deshacer movimientos.
		const blocks = shape.map(([blockX, blockY]) => ({
			x: x + blockX,
			y: y + blockY,
		}));

		return blocks.every((block) => {
			const insideBoard =
				block.x >= 0 &&
				block.x < this.cols &&
				block.y >= 0 &&
				block.y < this.rows;

			if (!insideBoard) {
				return false;
			}

			return this.board[block.y][block.x] === 0;
		});
	}

	private tryMove(dx: number, dy: number): boolean {
		if (!this.canMoveTo(this.currentPiece.x + dx, this.currentPiece.y + dy)) {
			return false;
		}

		if (dx < 0) {
			this.currentPiece.moveLeft();
		} else if (dx > 0) {
			this.currentPiece.moveRight();
		}

		if (dy > 0) {
			this.currentPiece.moveDown();
		}

		this.renderPiece();
		if (this.isCurrentPieceGrounded()) {
			this.lockTimer = 0;
		}
		return true;
	}

	private isCurrentPieceGrounded(): boolean {
		return !this.canMoveTo(this.currentPiece.x, this.currentPiece.y + 1);
	}

	private lockAndSpawnNextPiece() {
		// Orden importante: fijar, limpiar, puntuar, redibujar y recién ahí crear.
		this.lockPiece();

		const clearedLines = this.clearCompletedLines();
		this.addScore(clearedLines);

		this.renderBoard();
		this.spawnPiece();
	}

	private lockPiece() {
		const blocks = this.currentPiece.getBlocksAt();

		for (const block of blocks) {
			// Guardamos el color: 0 significa vacío y cualquier color, ocupado.
			this.board[block.y][block.x] = this.currentPiece.color;
		}
	}

	private createPieceObjects() {
		this.clearPieceRender();

		for (let i = 0; i < this.currentPiece.shape.length; i++) {
			const rect = this.add.rectangle(
				0,
				0,
				this.cell - 2,
				this.cell - 2,
				this.currentPiece.color
			);

			this.currentPieceBlocks.push(rect);
		}
	}

	private renderPiece() {
  	this.renderGhostPiece();
		this.currentPiece.shape.forEach((block, index) => {
			const bx = this.currentPiece.x + block[0];
			const by = this.currentPiece.y + block[1];

			const rect = this.currentPieceBlocks[index];

			rect.setPosition(
				this.offsetX + bx * this.cell + this.cell / 2,
				this.offsetY + by * this.cell + this.cell / 2
			);
		});
	}

	private renderGhostPiece() {
		this.clearGhostPieceRender();

		let ghostY = this.currentPiece.y;

		// Simulamos la caída sin cambiar la posición real de la pieza.
		while (this.canMoveTo(this.currentPiece.x, ghostY + 1)) {
			ghostY++;
		}

		for (const [blockX, blockY] of this.currentPiece.shape) {
			const bx = this.currentPiece.x + blockX;
			const by = ghostY + blockY;

			const rect = this.add.rectangle(
				this.offsetX + bx * this.cell + this.cell / 2,
				this.offsetY + by * this.cell + this.cell / 2,
				this.cell - 2,
				this.cell - 2,
				this.currentPiece.color
			);

			rect.setAlpha(0.25);

			this.ghostBlocks.push(rect);
		}
	}

	private clearGhostPieceRender() {
		for (const block of this.ghostBlocks) {
			block.destroy();
		}

		this.ghostBlocks = [];
	}

	private renderNextPiece() {
		this.clearNextPieceRender();

		const previewCell = 20;
		const previewX = 600;
		const previewY = 100;

		for (const [x, y] of this.nextPiece.shape) {
			const rect = this.add.rectangle(
				previewX + x * previewCell,
				previewY + y * previewCell,
				previewCell - 2,
				previewCell - 2,
				this.nextPiece.color
			);

			this.nextPieceBlocks.push(rect);
		}
	}

	private clearPieceRender() {
		for (const block of this.currentPieceBlocks) {
			block.destroy();
		}

		this.currentPieceBlocks = [];
	}

	private clearNextPieceRender() {
		for (const block of this.nextPieceBlocks) {
			block.destroy();
		}

		this.nextPieceBlocks = [];
	}

	private clearCompletedLines() {
		// Conservamos sólo las filas que tengan al menos una celda libre.
		const newBoard = this.board.filter((row) => {
			return row.some((cell) => cell === 0);
		});

		const clearedLines = this.rows - newBoard.length;

		for (let i = 0; i < clearedLines; i++) {
			// Por cada fila eliminada agregamos una vacía arriba del tablero.
			newBoard.unshift(Array(this.cols).fill(0));
		}

		this.board = newBoard;

  	return clearedLines;
	}

	private renderBoard() {
		this.clearBoardRender();

		for (let y = 0; y < this.rows; y++) {
			for (let x = 0; x < this.cols; x++) {
				if (this.board[y][x]) {
					const rect = this.add.rectangle(
						this.offsetX + x * this.cell + this.cell / 2,
						this.offsetY + y * this.cell + this.cell / 2,
						this.cell - 2,
						this.cell - 2,
						this.board[y][x]
					);

					this.boardBlocks.push(rect);
				}
			}
		}
	}

	private clearBoardRender() {
		for (const block of this.boardBlocks) {
			block.destroy();
		}

		this.boardBlocks = [];
	}
}
