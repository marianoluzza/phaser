import Phaser from 'phaser';
import { i18n } from '../../../core/i18n/i18n';
import type { TranslationKey } from '../../../core/i18n/translations';
import { CORE_SCENES } from '../../../core/sceneKeys';
import { TRUCO_AI_PROFILES } from '../ai/aiCatalog';
import { getTrucoAiChoice, setTrucoAiChoice, TRUCO_AI_CHOICES } from '../ai/aiSelection';
import type { TrucoAiChoice } from '../ai/aiSelection';
import { TRUCO_SCENES } from '../sceneKeys';

const RANDOM_LABELS: { nameKey: TranslationKey; descriptionKey: TranslationKey } = {
	nameKey: 'truco.ai.random.name',
	descriptionKey: 'truco.ai.random.description',
};

/** Pantalla de inicio del Truco: reglas y elección del rival. */
export class TrucoTitleScene extends Phaser.Scene {
	private enterKey!: Phaser.Input.Keyboard.Key;
	private escapeKey!: Phaser.Input.Keyboard.Key;
	private leftKey!: Phaser.Input.Keyboard.Key;
	private rightKey!: Phaser.Input.Keyboard.Key;
	private choiceIndex = 0;
	private choiceName!: Phaser.GameObjects.Text;
	private choiceDescription!: Phaser.GameObjects.Text;

	constructor() {
		super(TRUCO_SCENES.TITLE);
	}

	create() {
		// La escena se reutiliza: la elección se relee de lo guardado en cada entrada.
		this.choiceIndex = Math.max(0, TRUCO_AI_CHOICES.indexOf(getTrucoAiChoice()));

		this.cameras.main.setBackgroundColor('#17120d');
		this.add.text(400, 95, i18n.t('truco.title.title'), {
			fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '64px', color: '#fff4d6', letterSpacing: 8,
		}).setOrigin(0.5);
		this.add.text(400, 160, i18n.t('truco.title.subtitle'), {
			fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#d5b979', letterSpacing: 3,
		}).setOrigin(0.5);
		this.add.text(400, 245, i18n.t('truco.title.rules'), {
			fontFamily: 'Courier New, monospace', fontSize: '16px', color: '#f4e7c5', align: 'center', lineSpacing: 12,
		}).setOrigin(0.5);
		this.createOpponentSelector();
		this.createButton(400, 465, i18n.t('truco.title.play'), () => this.startMatch());
		this.createButton(400, 530, i18n.t('truco.title.backToArcade'), () => this.scene.start(CORE_SCENES.LAUNCHER));

		const keyboard = this.input.keyboard!;
		this.enterKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
		this.escapeKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
		this.leftKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
		this.rightKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
	}

	update() {
		if (Phaser.Input.Keyboard.JustDown(this.leftKey)) this.moveChoice(-1);
		if (Phaser.Input.Keyboard.JustDown(this.rightKey)) this.moveChoice(1);
		if (Phaser.Input.Keyboard.JustDown(this.enterKey)) this.startMatch();
		if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) this.scene.start(CORE_SCENES.LAUNCHER);
	}

	private createOpponentSelector() {
		this.add.rectangle(400, 370, 420, 104, 0x241a11).setStrokeStyle(1, 0x6a512d);
		this.add.text(400, 335, i18n.t('truco.title.opponent'), {
			fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#d8a542', letterSpacing: 3,
		}).setOrigin(0.5);
		this.choiceName = this.add.text(400, 365, '', {
			fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '22px', color: '#fff4d6',
		}).setOrigin(0.5);
		this.choiceDescription = this.add.text(400, 398, '', {
			fontFamily: 'Courier New, monospace', fontSize: '13px', color: '#cdb88f', align: 'center',
		}).setOrigin(0.5);
		this.createArrow(222, '◀', -1);
		this.createArrow(578, '▶', 1);
		this.refreshChoice();
	}

	private createArrow(x: number, label: string, direction: -1 | 1) {
		this.add.text(x, 365, label, {
			fontFamily: '"Segoe UI Symbol", Arial, sans-serif', fontSize: '20px', color: '#f2b84b',
		}).setOrigin(0.5)
			.setPadding(10)
			.setInteractive({ useHandCursor: true })
			.on('pointerdown', () => this.moveChoice(direction));
	}

	private moveChoice(direction: -1 | 1) {
		const count = TRUCO_AI_CHOICES.length;
		this.choiceIndex = (this.choiceIndex + direction + count) % count;
		setTrucoAiChoice(TRUCO_AI_CHOICES[this.choiceIndex]);
		this.refreshChoice();
	}

	private refreshChoice() {
		const { nameKey, descriptionKey } = this.labelsFor(TRUCO_AI_CHOICES[this.choiceIndex]);
		this.choiceName.setText(i18n.t(nameKey));
		this.choiceDescription.setText(i18n.t(descriptionKey));
	}

	private labelsFor(choice: TrucoAiChoice) {
		return TRUCO_AI_PROFILES.find(({ id }) => id === choice) ?? RANDOM_LABELS;
	}

	private startMatch() {
		this.scene.start(TRUCO_SCENES.GAME);
	}

	private createButton(x: number, y: number, label: string, action: () => void) {
		const button = this.add.rectangle(x, y, 300, 50, 0x3a2815).setStrokeStyle(1, 0xf2b84b).setInteractive({ useHandCursor: true });
		this.add.text(x, y, label, { fontFamily: 'Courier New, monospace', fontSize: '15px', color: '#fff4d6' }).setOrigin(0.5);
		button.on('pointerdown', action);
	}
}
