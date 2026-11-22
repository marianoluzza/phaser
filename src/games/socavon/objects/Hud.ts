import Phaser from 'phaser';
import { i18n, type TranslationKey } from '../../../core/i18n/i18n';
import { GAME_WIDTH } from '../../../core/renderScale';
import { GRIP } from '../constants/tuning';
import type { Action, Mine } from '../state/Mine';
import { addClip } from './art';
import { addLabel, COLORS, phrase, TITLE_FONT } from './ui';

export const HUD_TOP = 60;
export const HUD_BOTTOM = 34;

const ACTION_KEYS: Record<Action['kind'], TranslationKey> = {
	pocket: 'socavon.action.pocket',
	vault: 'socavon.action.vault',
	silence: 'socavon.action.silence',
	deliver: 'socavon.action.deliver',
	load: 'socavon.action.load',
	hit: 'socavon.action.hit',
	take: 'socavon.action.take',
	push: 'socavon.action.push',
	release: 'socavon.action.release',
	drop: 'socavon.action.drop',
	board: 'socavon.action.board',
	alight: 'socavon.action.alight',
	locked: 'socavon.action.locked',
};

/** Las franjas de arriba y abajo, los avisos y el cartel del centro. */
export class Hud {
	private readonly scene: Phaser.Scene;
	private readonly top: Phaser.GameObjects.Rectangle;
	private readonly bottom: Phaser.GameObjects.Rectangle;
	private readonly score: Phaser.GameObjects.Text;
	private readonly loot: Phaser.GameObjects.Text;
	private readonly keys: Phaser.GameObjects.Text;
	private readonly lives: Phaser.GameObjects.Text;
	private readonly light: Phaser.GameObjects.Text;
	private readonly alarm: Phaser.GameObjects.Text;
	private readonly hint: Phaser.GameObjects.Text;
	private readonly notice: Phaser.GameObjects.Text;
	private readonly bannerBox: Phaser.GameObjects.Rectangle;
	private readonly bannerTitle: Phaser.GameObjects.Text;
	private readonly bannerText: Phaser.GameObjects.Text;
	private readonly bagIcon: Phaser.GameObjects.Image;
	private readonly keyIcon: Phaser.GameObjects.Image;
	private noticeLeft = 0;

	constructor(scene: Phaser.Scene, mineName: string) {
		this.scene = scene;
		this.top = scene.add.rectangle(0, 0, GAME_WIDTH, HUD_TOP, COLORS.ink).setOrigin(0);
		this.bottom = scene.add.rectangle(0, 600, GAME_WIDTH, HUD_BOTTOM, COLORS.ink).setOrigin(0, 1);
		addLabel(scene, 16, 9, mineName, 15, COLORS.gold);
		this.score = addLabel(scene, 16, 32, '', 15);
		this.bagIcon = addClip(scene, 0, 50, 'objetos/bag');
		this.loot = addLabel(scene, 0, 30, '', 19).setOrigin(0, 0.5);
		this.keyIcon = addClip(scene, 0, 50, 'objetos/key');
		this.keys = addLabel(scene, 0, 30, '', 19).setOrigin(0, 0.5);
		this.lives = addLabel(scene, 0, 9, '', 15).setOrigin(1, 0);
		this.light = addLabel(scene, 0, 32, '', 15).setOrigin(1, 0);
		this.alarm = addLabel(scene, 0, 78, '', 17, COLORS.danger)
			.setOrigin(0.5)
			.setBackgroundColor('#120c0e')
			.setPadding(10, 4, 10, 4);
		this.hint = addLabel(scene, 0, 583, '', 14).setOrigin(0.5);
		this.notice = addLabel(scene, 0, 536, '', 16, COLORS.gold)
			.setOrigin(0.5)
			.setBackgroundColor('#120c0e')
			.setPadding(12, 6, 12, 6)
			.setVisible(false);
		this.bannerBox = scene.add.rectangle(0, 300, 540, 170, COLORS.panel, 0.96)
			.setStrokeStyle(3, COLORS.border)
			.setVisible(false);
		this.bannerTitle = scene.add.text(0, 268, '', { fontFamily: TITLE_FONT, fontSize: '32px', color: COLORS.gold })
			.setOrigin(0.5)
			.setVisible(false);
		this.bannerText = addLabel(scene, 0, 328, '', 15).setOrigin(0.5).setAlign('center').setVisible(false);
		this.layout();
	}

	layout() {
		const middle = GAME_WIDTH / 2;
		this.top.setSize(GAME_WIDTH, HUD_TOP);
		this.bottom.setSize(GAME_WIDTH, HUD_BOTTOM);
		this.bagIcon.setX(middle - 100);
		this.loot.setX(middle - 72);
		this.keyIcon.setX(middle + 44);
		this.keys.setX(middle + 70);
		this.lives.setX(GAME_WIDTH - 16);
		this.light.setX(GAME_WIDTH - 16);
		for (const centred of [this.alarm, this.hint, this.notice, this.bannerBox, this.bannerTitle, this.bannerText]) {
			centred.setX(middle);
		}
	}

	update(mine: Mine, dt: number) {
		const { player } = mine;
		this.score.setText(phrase('socavon.hud.score', { score: mine.score }));
		this.loot.setText(`${mine.delivered}/${mine.total}`);
		this.keys.setText(`${player.keys}`);
		this.lives.setText(phrase('socavon.hud.lives', { lives: mine.lives }));
		this.light
			.setText(i18n.t(player.headlamp ? 'socavon.hud.lightOn' : 'socavon.hud.lightOff'))
			.setColor(player.headlamp ? COLORS.gold : COLORS.muted);
		this.alarm
			.setVisible(mine.alarm > 0)
			.setText(phrase('socavon.hud.alarm', { seconds: Math.ceil(mine.alarm) }));
		this.hint.setText(this.hintFor(mine));

		if (this.noticeLeft > 0) {
			this.noticeLeft -= dt;
			if (this.noticeLeft <= 0) this.notice.setVisible(false);
		}
	}

	private hintFor(mine: Mine) {
		const { player, level } = mine;
		if (player.hidden) return i18n.t('socavon.hint.hidden');
		if (player.state === 'hang') return i18n.t('socavon.hint.hang');
		if (player.state === 'grip') return i18n.t('socavon.hint.gripped');
		const action = mine.action();
		if (action) return i18n.t(ACTION_KEYS[action.kind]);
		if (player.state === 'ride') return i18n.t('socavon.hint.ride');
		if (player.state !== 'walk') return '';

		const x = Math.round(player.x);
		if (level.at(x, player.y) === 'A') {
			return i18n.t(player.stamina < GRIP.time ? 'socavon.hint.gripTired' : 'socavon.hint.grip');
		}
		if (level.at(x, player.y) === 'n') return i18n.t('socavon.hint.niche');
		const lamp = mine.lamps.find((other) => other.y === player.y && Math.abs(other.x - player.x) <= 1);
		if (lamp) return i18n.t(lamp.lit ? 'socavon.hint.lampOff' : 'socavon.hint.lampOn');
		return i18n.t('socavon.hint.controls');
	}

	showNotice(key: TranslationKey, seconds = 2.6) {
		this.notice.setText(i18n.t(key)).setVisible(true);
		this.noticeLeft = seconds;
		this.scene.children.bringToTop(this.notice);
	}

	showBanner(title: string | null, text = '') {
		const visible = title !== null;
		this.bannerBox.setVisible(visible);
		this.bannerTitle.setText(title ?? '').setVisible(visible);
		this.bannerText.setText(text).setVisible(visible);
		if (visible) this.notice.setVisible(false);
	}
}
