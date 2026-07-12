import Phaser from 'phaser';
import { Piece } from '../objects/Piece';
import type { PieceType } from '../constants/tetrominoes';

export class GameScene extends Phaser.Scene {
	private score = 0;
	private lines = 0;
	private isGameOver = false;
	private level = 1;
	private levelText!: Phaser.GameObjects.Text;

	private readonly linesPerLevel = 10;
	private readonly minGravityInterval = 80;

	private gameOverText!: Phaser.GameObjects.Text;
	private nextText!: Phaser.GameObjects.Text;
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

	private readonly cols = 10;
	private readonly rows = 20;
	private readonly cell = 24;
	private readonly offsetX = 280;
	private readonly offsetY = 40;

	private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
	private spaceKey!: Phaser.Input.Keyboard.Key;

	private gravityTimer = 0;
	private gravityInterval = 500;
	private lockTimer = 0;
	private lockDelay = 500;

	private softDropTimer = 0;
	private softDropInterval = 50;

	private horizontalTimer = 0;
	private horizontalInitialDelay = 140;
	private horizontalRepeatInterval = 70;
	private horizontalDirection: -1 | 0 | 1 = 0;

	constructor() {
		super('GameScene');
	}

	create() {
		this.drawGrid();

		this.scoreText = this.add.text(40, 40, 'Score: 0', {
			fontSize: '24px',
			color: '#ffffff',
		});
		this.linesText = this.add.text(40, 75, 'Lines: 0', {
			fontSize: '24px',
			color: '#ffffff',
		});
		this.levelText = this.add.text(40, 110, 'Level: 1', {
			fontSize: '24px',
			color: '#ffffff',
		});
		this.nextText = this.add.text(580, 40, 'Next', {
			fontSize: '24px',
			color: '#ffffff',
		});
		this.cursors = this.input.keyboard!.createCursorKeys();
		this.spaceKey = this.input.keyboard!.addKey(
			Phaser.Input.Keyboard.KeyCodes.SPACE
		);
		for (let y = 0; y < this.rows; y++) {
			this.board[y] = [];

			for (let x = 0; x < this.cols; x++) {
				this.board[y][x] = 0;
			}
		}
		this.nextPiece = this.createRandomPiece();
		this.spawnPiece();
	}

	update(_time: number, delta: number) {
		if (this.isGameOver) {
			return;
		}

		this.handleHorizontalInput(delta);
		this.handleRotationInput();
		this.handleHardDropInput();
		this.handleSoftDrop(delta);
		this.handleGravity(delta);
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
			return;
		}

		if (direction !== this.horizontalDirection) {
			this.horizontalDirection = direction;
			this.horizontalTimer = 0;
			this.tryMove(direction, 0);
			return;
		}

		this.horizontalTimer += delta;

		const requiredDelay =
			this.horizontalTimer === delta // first frame
				? this.horizontalInitialDelay
				: this.horizontalRepeatInterval;

		if (this.horizontalTimer >= requiredDelay) {
			this.tryMove(direction, 0);
			this.horizontalTimer = 0;
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

		this.score += pointsByLines[clearedLines] * this.level;
		this.lines += clearedLines;

		this.updateLevel();

		this.scoreText.setText(`Score: ${this.score}`);
		this.linesText.setText(`Lines: ${this.lines}`);
		this.levelText.setText(`Level: ${this.level}`);
	}

	private updateLevel() {
		this.level = Math.floor(this.lines / this.linesPerLevel) + 1;

		this.gravityInterval = Math.max(
			this.minGravityInterval,
			500 - (this.level - 1) * 40
		);
	}

	private refillPieceBag() {
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
		this.currentPiece = this.nextPiece;
		this.currentPiece.x = 3;
		this.currentPiece.y = 0;

		this.nextPiece = this.createRandomPiece();

		this.renderNextPiece();

		if (!this.canMoveTo(this.currentPiece.x, this.currentPiece.y)) {
			this.isGameOver = true;

			this.gameOverText = this.add.text(400, 300, 'GAME OVER', {
				fontSize: '48px',
				color: '#ff0000',
			}).setOrigin(0.5);

			this.clearGhostPieceRender();

			return;
		}

		this.createPieceObjects();
		this.renderPiece();
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
		this.lockPiece();

		const clearedLines = this.clearCompletedLines();
		this.addScore(clearedLines);

		this.renderBoard();
		this.spawnPiece();
	}

	private lockPiece() {
		const blocks = this.currentPiece.getBlocksAt();

		for (const block of blocks) {
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
		const newBoard = this.board.filter((row) => {
			return row.some((cell) => cell === 0);//fila incompleta
		});

		const clearedLines = this.rows - newBoard.length;

		for (let i = 0; i < clearedLines; i++) {
			newBoard.unshift(Array(this.cols).fill(0));//rellenar con filas vacias
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