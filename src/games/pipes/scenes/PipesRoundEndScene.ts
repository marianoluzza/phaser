import Phaser from 'phaser';
import { audioManager } from '../../../core/audio/AudioManager';
import { i18n } from '../../../core/i18n/i18n';
import { CORE_SCENES } from '../../../core/sceneKeys';
import { loadPipesAudio, PIPES_AUDIO } from '../audio';
import { FIRST_LEVEL } from '../constants/levels';
import { PIPES_SCENES } from '../sceneKeys';

/** Resultado que la escena de partida entrega al terminar un nivel. */
export type PipesRoundResult = {
	level: number;
	score: number;
	segments: number;
	goal: number;
	/** El agua siempre termina derramándose; lo que cambia es si llegó a la meta. */
	cleared: boolean;
	/** Cruces atravesados dos veces y el premio por juntar varios. */
	doubleCrossings: number;
	crossBonus: number;
	/** Piezas secas pisadas y lo que costaron. */
	replacements: number;
	replacePenalty: number;
	/** Piezas colocadas que el agua nunca usó, y lo que costaron. */
	loosePieces: number;
	loosePenalty: number;
};

/**
 * Cierre de nivel.
 *
 * Una sola pantalla para los dos finales posibles: el agua se derrama siempre,
 * así que lo único que cambia es si el recorrido alcanzó la meta. Si la alcanzó,
 * se sigue al nivel siguiente conservando el puntaje.
 */
export class PipesRoundEndScene extends Phaser.Scene {
	private result: PipesRoundResult = {
		level: FIRST_LEVEL,
		score: 0,
		segments: 0,
		goal: 0,
		cleared: false,
		doubleCrossings: 0,
		crossBonus: 0,
		replacements: 0,
		replacePenalty: 0,
		loosePieces: 0,
		loosePenalty: 0,
	};

	private continueKey!: Phaser.Input.Keyboard.Key;
	private menuKey!: Phaser.Input.Keyboard.Key;
	private escapeKey!: Phaser.Input.Keyboard.Key;

	constructor() {
		super(PIPES_SCENES.ROUND_END);
	}

	preload() {
		loadPipesAudio(this, PIPES_AUDIO.confirm);
	}

	/** `init` recibe los datos enviados mediante `scene.start(key, data)`. */
	init(data: Partial<PipesRoundResult>) {
		this.result = {
			level: data.level ?? FIRST_LEVEL,
			score: data.score ?? 0,
			segments: data.segments ?? 0,
			goal: data.goal ?? 0,
			cleared: data.cleared ?? false,
			doubleCrossings: data.doubleCrossings ?? 0,
			crossBonus: data.crossBonus ?? 0,
			replacements: data.replacements ?? 0,
			replacePenalty: data.replacePenalty ?? 0,
			loosePieces: data.loosePieces ?? 0,
			loosePenalty: data.loosePenalty ?? 0,
		};
	}

	create() {
		this.cameras.main.setBackgroundColor('#080d1a');
		this.drawBackground();
		this.drawResult();
		this.createButtons();

		const keyboard = this.input.keyboard!;
		// La tecla de continuar cambia de nombre según el final, no de función.
		this.continueKey = keyboard.addKey(
			this.result.cleared ? Phaser.Input.Keyboard.KeyCodes.ENTER : Phaser.Input.Keyboard.KeyCodes.R
		);
		this.menuKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
		this.escapeKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
	}

	update() {
		if (Phaser.Input.Keyboard.JustDown(this.continueKey)) {
			this.continuePlaying();
			return;
		}

		if (Phaser.Input.Keyboard.JustDown(this.menuKey)) {
			this.goToTitle();
			return;
		}

		if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
			this.goToLauncher();
		}
	}

	private drawBackground() {
		const cleared = this.result.cleared;
		const graphics = this.add.graphics();
		graphics.fillStyle(cleared ? 0x123a2a : 0x13314a, 0.75);
		graphics.fillCircle(400, 300, 290);
		graphics.lineStyle(1, cleared ? 0x2f7e5a : 0x2f5f7e, 0.22);
		for (let x = 0; x <= 800; x += 40) {
			graphics.lineBetween(x, 0, x, 600);
		}
		for (let y = 0; y <= 600; y += 40) {
			graphics.lineBetween(0, y, 800, y);
		}
	}

	private drawResult() {
		const cleared = this.result.cleared;

		this.add.text(400, 88, i18n.t(cleared ? 'pipes.roundEnd.cleared' : 'pipes.roundEnd.failed'), {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: cleared ? '52px' : '46px',
			color: cleared ? '#5ee48a' : '#46d9ff',
			letterSpacing: 4,
		}).setOrigin(0.5);

		this.add.text(400, 150, i18n.t(cleared ? 'pipes.roundEnd.clearedHint' : 'pipes.roundEnd.failedHint'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '13px',
			color: cleared ? '#7fbd9c' : '#7fa3bd',
			letterSpacing: 2,
			align: 'center',
			wordWrap: { width: 520 },
		}).setOrigin(0.5);

		this.add.rectangle(400, 270, 420, 180, 0x11131f, 0.96)
			.setStrokeStyle(2, cleared ? 0x2f7e5a : 0x2f5f7e)
			.setOrigin(0.5);

		// El desglose importa tanto como el total: es lo que muestra si el balance
		// que se está probando premia lo que se quería premiar.
		const rows: Array<[string, string]> = [
			[i18n.t('pipes.roundEnd.level'), String(this.result.level)],
			[i18n.t('pipes.roundEnd.segments'), `${this.result.segments} / ${this.result.goal}`],
			[
				i18n.t('pipes.roundEnd.doubleCrossings'),
				this.withPoints(this.result.doubleCrossings, this.result.crossBonus, '+'),
			],
			[
				i18n.t('pipes.roundEnd.replacements'),
				this.withPoints(this.result.replacements, this.result.replacePenalty, '−'),
			],
			[
				i18n.t('pipes.roundEnd.loosePieces'),
				this.withPoints(this.result.loosePieces, this.result.loosePenalty, '−'),
			],
			[i18n.t('pipes.roundEnd.score'), String(this.result.score)],
		];

		this.add.text(210, 194, rows.map(([label]) => label).join('\n'), {
			fontFamily: 'Courier New, monospace',
			fontSize: '14px',
			color: '#8d91a8',
			lineSpacing: 6,
		});

		this.add.text(590, 194, rows.map(([, value]) => value).join('\n'), {
			fontFamily: 'Courier New, monospace',
			fontSize: '14px',
			color: '#ffffff',
			align: 'right',
			lineSpacing: 6,
		}).setOrigin(1, 0);
	}

	/** "2   +100": la cantidad y, si los hubo, los puntos que movió. */
	private withPoints(count: number, points: number, sign: '+' | '−'): string {
		return points > 0 ? `${count}   ${sign}${points}` : String(count);
	}

	private createButtons() {
		const cleared = this.result.cleared;

		this.createActionButton(
			400,
			400,
			i18n.t(cleared ? 'pipes.roundEnd.nextLevel' : 'pipes.roundEnd.retry'),
			cleared ? 0x17402d : 0x1b3348,
			cleared ? 0x5ee48a : 0x46d9ff,
			() => this.continuePlaying()
		);
		this.createActionButton(400, 458, i18n.t('pipes.roundEnd.backToTitle'), 0x171d30, 0x52658e, () => {
			this.goToTitle();
		});
		this.createActionButton(400, 516, i18n.t('pipes.roundEnd.backToArcade'), 0x111522, 0x3d4968, () => {
			this.goToLauncher();
		});
	}

	private createActionButton(
		x: number,
		y: number,
		label: string,
		fillColor: number,
		borderColor: number,
		onClick: () => void
	) {
		const button = this.add.rectangle(x, y, 320, 44, fillColor)
			.setStrokeStyle(1, borderColor)
			.setInteractive({ useHandCursor: true });
		this.add.text(x, y, label, {
			fontFamily: 'Courier New, monospace',
			fontSize: '14px',
			color: '#ffffff',
		}).setOrigin(0.5);
		button.on('pointerdown', onClick);
	}

	/**
	 * Superar el nivel continúa la partida con el puntaje acumulado.
	 * Perderlo la reinicia desde el primer nivel.
	 */
	private continuePlaying() {
		audioManager.playSfx(this, PIPES_AUDIO.confirm.cacheKey);

		if (this.result.cleared) {
			this.scene.start(PIPES_SCENES.GAME, {
				level: this.result.level + 1,
				score: this.result.score,
			});
			return;
		}

		this.scene.start(PIPES_SCENES.GAME, { level: FIRST_LEVEL, score: 0 });
	}

	private goToTitle() {
		audioManager.playSfx(this, PIPES_AUDIO.confirm.cacheKey);
		this.scene.start(PIPES_SCENES.TITLE);
	}

	private goToLauncher() {
		audioManager.playSfx(this, PIPES_AUDIO.confirm.cacheKey);
		this.scene.start(CORE_SCENES.LAUNCHER);
	}
}
