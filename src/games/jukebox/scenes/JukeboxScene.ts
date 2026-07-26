import Phaser from 'phaser';
import { audioManager } from '../../../core/audio/AudioManager';
import { i18n } from '../../../core/i18n/i18n';
import { CORE_SCENES } from '../../../core/sceneKeys';
import {
	AUDIO_CATALOG_CACHE_KEY,
	AUDIO_CATALOG_URL,
	type AudioAssetDefinition,
	type AudioCatalog,
	type AudioKind,
} from '../audioCatalog';
import { JUKEBOX_SCENES } from '../sceneKeys';

/**
 * Laboratorio para escuchar assets y obtener la ruta que usarán otros juegos.
 * Sólo carga el archivo elegido para evitar descargar toda la biblioteca.
 */
export class JukeboxScene extends Phaser.Scene {
	private readonly pageSize = 7;

	private catalog: AudioCatalog = { music: [], sfx: [] };
	private activeKind: AudioKind = 'music';
	private selectedIndex = 0;
	private currentPage = 0;
	private isLoading = false;

	private rowContainers: Phaser.GameObjects.Container[] = [];
	private musicTab!: Phaser.GameObjects.Rectangle;
	private sfxTab!: Phaser.GameObjects.Rectangle;
	private pageText!: Phaser.GameObjects.Text;
	private nameText!: Phaser.GameObjects.Text;
	private metadataText!: Phaser.GameObjects.Text;
	private pathText!: Phaser.GameObjects.Text;
	private statusText!: Phaser.GameObjects.Text;
	private musicVolumeText!: Phaser.GameObjects.Text;
	private sfxVolumeText!: Phaser.GameObjects.Text;

	private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
	private enterKey!: Phaser.Input.Keyboard.Key;
	private escapeKey!: Phaser.Input.Keyboard.Key;
	private tabKey!: Phaser.Input.Keyboard.Key;
	private stopKey!: Phaser.Input.Keyboard.Key;

	constructor() {
		super(JUKEBOX_SCENES.MAIN);
	}

	preload() {
		this.load.json(AUDIO_CATALOG_CACHE_KEY, AUDIO_CATALOG_URL);
	}

	create() {
		const loadedCatalog = this.cache.json.get(AUDIO_CATALOG_CACHE_KEY) as AudioCatalog | undefined;
		this.catalog = loadedCatalog?.music && loadedCatalog?.sfx
			? loadedCatalog
			: { music: [], sfx: [] };
		this.activeKind = 'music';
		this.selectedIndex = 0;
		this.currentPage = 0;
		this.isLoading = false;
		this.rowContainers = [];

		this.cameras.main.setBackgroundColor('#080d1a');
		this.drawBackground();
		this.drawHeader();
		this.createTabs();
		this.drawPanels();
		this.createActionButtons();
		this.createVolumeControls();
		this.configureKeyboard();
		this.renderList();
		document.addEventListener('copy', this.handleDocumentCopy);
		window.addEventListener('keydown', this.handleWindowKeyDown);

		// Al salir del laboratorio no dejamos música sonando sobre otros juegos.
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
			audioManager.stopMusic();
			document.removeEventListener('copy', this.handleDocumentCopy);
			window.removeEventListener('keydown', this.handleWindowKeyDown);
		});
	}

	update() {
		if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
			this.scene.start(CORE_SCENES.LAUNCHER);
			return;
		}

		if (Phaser.Input.Keyboard.JustDown(this.tabKey)) {
			this.switchKind(this.activeKind === 'music' ? 'sfx' : 'music');
		}

		if (Phaser.Input.Keyboard.JustDown(this.cursors.up!)) {
			this.moveSelection(-1);
		}

		if (Phaser.Input.Keyboard.JustDown(this.cursors.down!)) {
			this.moveSelection(1);
		}

		if (Phaser.Input.Keyboard.JustDown(this.cursors.left!)) {
			this.changePage(-1);
		}

		if (Phaser.Input.Keyboard.JustDown(this.cursors.right!)) {
			this.changePage(1);
		}

		if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
			this.playSelectedAsset();
		}

		if (Phaser.Input.Keyboard.JustDown(this.stopKey)) {
			this.stopMusic();
		}

	}

	private drawBackground() {
		const graphics = this.add.graphics();
		graphics.fillStyle(0x25112f, 0.78);
		graphics.fillCircle(740, 35, 245);
		graphics.fillStyle(0x10223d, 0.65);
		graphics.fillCircle(40, 580, 190);
		graphics.lineStyle(1, 0x4c2d62, 0.18);
		for (let x = 0; x <= 800; x += 40) {
			graphics.lineBetween(x, 0, x, 600);
		}
		for (let y = 0; y <= 600; y += 40) {
			graphics.lineBetween(0, y, 800, y);
		}
	}

	private drawHeader() {
		this.add.text(38, 28, 'JUKEBOX', {
			fontFamily: 'Arial Black, Arial, sans-serif',
			fontSize: '34px',
			color: '#ff78c8',
			letterSpacing: 4,
		});
		this.add.text(40, 72, i18n.t('jukebox.subtitle'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '12px',
			color: '#9b83b2',
			letterSpacing: 2,
		});
	}

	private createTabs() {
		this.musicTab = this.createTabButton(480, 55, 'jukebox.tab.music', 'music');
		this.sfxTab = this.createTabButton(650, 55, 'jukebox.tab.sfx', 'sfx');
		this.refreshTabs();
	}

	private createTabButton(
		x: number,
		y: number,
		translationKey: 'jukebox.tab.music' | 'jukebox.tab.sfx',
		kind: AudioKind
	) {
		const count = this.catalog[kind].length;
		const button = this.add.rectangle(x, y, 150, 42, 0x15172a)
			.setInteractive({ useHandCursor: true });
		this.add.text(x, y, `${i18n.t(translationKey)}  ${count}`, {
			fontFamily: 'Courier New, monospace',
			fontSize: '13px',
			color: '#ffffff',
		}).setOrigin(0.5);
		button.on('pointerdown', () => this.switchKind(kind));
		return button;
	}

	private drawPanels() {
		this.add.rectangle(38, 112, 500, 350, 0x0d1324, 0.94)
			.setOrigin(0)
			.setStrokeStyle(1, 0x3f4262);
		this.add.rectangle(555, 112, 210, 350, 0x121426, 0.96)
			.setOrigin(0)
			.setStrokeStyle(1, 0x5c3b69);

		this.pageText = this.add.text(288, 478, '', {
			fontFamily: 'Courier New, monospace',
			fontSize: '12px',
			color: '#7f89a8',
		}).setOrigin(0.5);

		this.add.text(572, 128, i18n.t('jukebox.selected'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '10px',
			color: '#9b83b2',
			letterSpacing: 2,
		});
		this.nameText = this.add.text(572, 152, '', {
			fontFamily: 'Arial, sans-serif',
			fontSize: '15px',
			color: '#ffffff',
			wordWrap: { width: 176 },
		});
		this.metadataText = this.add.text(572, 214, '', {
			fontFamily: 'Courier New, monospace',
			fontSize: '10px',
			color: '#9aa5c4',
			wordWrap: { width: 176 },
			lineSpacing: 3,
		});
		this.add.text(572, 274, i18n.t('jukebox.path'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '10px',
			color: '#9b83b2',
			letterSpacing: 2,
		});
		this.pathText = this.add.text(572, 296, '', {
			fontFamily: 'Courier New, monospace',
			fontSize: '9px',
			color: '#c4cce2',
			wordWrap: { width: 176, useAdvancedWrap: true },
			lineSpacing: 2,
		});
		this.statusText = this.add.text(400, 505, i18n.t('jukebox.status.ready'), {
			fontFamily: 'Courier New, monospace',
			fontSize: '11px',
			color: '#77d9c3',
		}).setOrigin(0.5);
	}

	private createActionButtons() {
		this.createButton(590, 425, 64, i18n.t('jukebox.play'), 0x224a46, 0x61d7c0, () => {
			this.playSelectedAsset();
		});
		this.createButton(660, 425, 64, i18n.t('jukebox.copy'), 0x3c274e, 0xb873dd, () => {
			void this.copySelectedPath();
		});
		this.createButton(730, 425, 54, i18n.t('jukebox.stop'), 0x4a2133, 0xe96d9d, () => {
			this.stopMusic();
		});
	}

	private createVolumeControls() {
		this.add.text(45, 535, i18n.t('jukebox.musicVolume'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '11px',
			color: '#8793b2',
		});
		this.musicVolumeText = this.add.text(163, 535, '', {
			fontFamily: 'Courier New, monospace',
			fontSize: '12px',
			color: '#ffffff',
		});
		this.createVolumeButtons(230, 540, 'music');

		this.add.text(335, 535, i18n.t('jukebox.sfxVolume'), {
			fontFamily: 'Arial, sans-serif',
			fontSize: '11px',
			color: '#8793b2',
		});
		this.sfxVolumeText = this.add.text(430, 535, '', {
			fontFamily: 'Courier New, monospace',
			fontSize: '12px',
			color: '#ffffff',
		});
		this.createVolumeButtons(500, 540, 'sfx');
		this.refreshVolumeTexts();

		this.add.text(40, 575, i18n.t('jukebox.footer'), {
			fontFamily: 'Courier New, monospace',
			fontSize: '11px',
			color: '#7783a3',
		});
	}

	private createVolumeButtons(x: number, y: number, kind: AudioKind) {
		this.createButton(x, y, 30, '−', 0x171c30, 0x46516f, () => {
			this.adjustVolume(kind, -0.1);
		}, 24);
		this.createButton(x + 38, y, 30, '+', 0x171c30, 0x46516f, () => {
			this.adjustVolume(kind, 0.1);
		}, 24);
	}

	private createButton(
		x: number,
		y: number,
		width: number,
		label: string,
		fillColor: number,
		borderColor: number,
		onClick: () => void,
		height = 34
	) {
		const button = this.add.rectangle(x, y, width, height, fillColor)
			.setStrokeStyle(1, borderColor)
			.setInteractive({ useHandCursor: true });
		this.add.text(x, y, label, {
			fontFamily: 'Courier New, monospace',
			fontSize: '11px',
			color: '#ffffff',
		}).setOrigin(0.5);
		button.on('pointerdown', onClick);
		return button;
	}

	private configureKeyboard() {
		const keyboard = this.input.keyboard!;
		this.cursors = keyboard.createCursorKeys();
		this.enterKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
		this.escapeKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
		this.tabKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
		this.stopKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
	}

	/** El evento copy es el estándar del navegador detrás de Ctrl/Cmd+C. */
	private handleDocumentCopy = (event: ClipboardEvent) => {
		const asset = this.getSelectedAsset();
		if (!asset || !event.clipboardData) {
			return;
		}

		event.clipboardData.setData('text/plain', asset.url);
		event.preventDefault();
		this.statusText.setText(i18n.t('jukebox.status.copied'));
	};

	/** Respaldo para navegadores que no emiten `copy` sobre un canvas. */
	private handleWindowKeyDown = (event: KeyboardEvent) => {
		if ((!event.ctrlKey && !event.metaKey) || event.key.toLowerCase() !== 'c') {
			return;
		}

		event.preventDefault();
		void this.copySelectedPath();
	};

	private renderList() {
		for (const container of this.rowContainers) {
			container.destroy();
		}
		this.rowContainers = [];

		const assets = this.getActiveAssets();
		const startIndex = this.currentPage * this.pageSize;
		const pageAssets = assets.slice(startIndex, startIndex + this.pageSize);

		pageAssets.forEach((asset, rowIndex) => {
			const absoluteIndex = startIndex + rowIndex;
			const y = 121 + rowIndex * 48;
			const selected = absoluteIndex === this.selectedIndex;
			const container = this.add.container(46, y);
			const surface = this.add.rectangle(0, 0, 484, 40, selected ? 0x263651 : 0x121a2d)
				.setOrigin(0)
				.setStrokeStyle(1, selected ? 0xff78c8 : 0x28334e)
				.setInteractive({ useHandCursor: true });
			const indexLabel = `${(absoluteIndex + 1).toString().padStart(3, '0')}`;
			const name = this.truncate(asset.name, 54);
			const label = this.add.text(12, 11, `${indexLabel}  ${name}`, {
				fontFamily: 'Courier New, monospace',
				fontSize: '12px',
				color: selected ? '#ffffff' : '#aeb9d5',
			});
			surface.on('pointerdown', () => {
				this.selectedIndex = absoluteIndex;
				this.renderList();
			});
			container.add([surface, label]);
			this.rowContainers.push(container);
		});

		const pageCount = Math.max(1, Math.ceil(assets.length / this.pageSize));
		this.pageText.setText(
			`${i18n.t('jukebox.page')} ${this.currentPage + 1}/${pageCount}   ←  →`
		);
		this.refreshTabs();
		this.refreshDetails();
	}

	private refreshTabs() {
		const musicSelected = this.activeKind === 'music';
		this.musicTab
			.setFillStyle(musicSelected ? 0x47305d : 0x15172a)
			.setStrokeStyle(1, musicSelected ? 0xff78c8 : 0x3f4262);
		this.sfxTab
			.setFillStyle(musicSelected ? 0x15172a : 0x47305d)
			.setStrokeStyle(1, musicSelected ? 0x3f4262 : 0xff78c8);
	}

	private refreshDetails() {
		const asset = this.getSelectedAsset();
		if (!asset) {
			return;
		}

		this.nameText.setText(asset.name);
		this.metadataText.setText(
			`${asset.source}\n${asset.collection}  ·  ${asset.license}`
		);
		this.pathText.setText(asset.url);
	}

	private switchKind(kind: AudioKind) {
		if (this.activeKind === kind) {
			return;
		}

		this.activeKind = kind;
		this.selectedIndex = 0;
		this.currentPage = 0;
		this.renderList();
	}

	private moveSelection(direction: -1 | 1) {
		const assets = this.getActiveAssets();
		if (assets.length === 0) {
			return;
		}
		this.selectedIndex = Phaser.Math.Clamp(
			this.selectedIndex + direction,
			0,
			assets.length - 1
		);
		this.currentPage = Math.floor(this.selectedIndex / this.pageSize);
		this.renderList();
	}

	private changePage(direction: -1 | 1) {
		const assets = this.getActiveAssets();
		const pageCount = Math.max(1, Math.ceil(assets.length / this.pageSize));
		this.currentPage = (this.currentPage + direction + pageCount) % pageCount;
		this.selectedIndex = this.currentPage * this.pageSize;
		this.renderList();
	}

	private playSelectedAsset() {
		if (this.isLoading) {
			return;
		}

		const asset = this.getSelectedAsset();
		if (!asset) {
			return;
		}

		if (this.cache.audio.exists(asset.id)) {
			this.playLoadedAsset(asset);
			return;
		}

		this.isLoading = true;
		this.statusText.setText(`${i18n.t('jukebox.status.loading')}: ${asset.name}`);
		this.load.once(Phaser.Loader.Events.COMPLETE, () => {
			this.isLoading = false;
			if (this.cache.audio.exists(asset.id)) {
				this.playLoadedAsset(asset);
			} else {
				this.statusText.setText(i18n.t('jukebox.status.loadError'));
			}
		});
		this.load.audio(asset.id, asset.url);
		this.load.start();
	}

	private playLoadedAsset(asset: AudioAssetDefinition) {
		if (this.activeKind === 'music') {
			audioManager.playMusic(this, asset.id);
		} else {
			audioManager.playSfx(this, asset.id);
		}

		this.statusText.setText(`${i18n.t('jukebox.status.playing')}: ${asset.name}`);
	}

	private stopMusic() {
		audioManager.stopMusic();
		this.statusText.setText(i18n.t('jukebox.status.stopped'));
	}

	private adjustVolume(kind: AudioKind, delta: number) {
		if (kind === 'music') {
			audioManager.setMusicVolume(audioManager.getMusicVolume() + delta);
		} else {
			audioManager.setSfxVolume(audioManager.getSfxVolume() + delta);
		}
		this.refreshVolumeTexts();
	}

	private refreshVolumeTexts() {
		this.musicVolumeText.setText(`${Math.round(audioManager.getMusicVolume() * 100)}%`);
		this.sfxVolumeText.setText(`${Math.round(audioManager.getSfxVolume() * 100)}%`);
	}

	private async copySelectedPath() {
		const asset = this.getSelectedAsset();
		if (!asset) {
			return;
		}

		try {
			await navigator.clipboard.writeText(asset.url);
			this.statusText.setText(i18n.t('jukebox.status.copied'));
		} catch {
			this.statusText.setText(i18n.t('jukebox.status.copyError'));
		}
	}

	private getActiveAssets() {
		return this.catalog[this.activeKind];
	}

	private getSelectedAsset() {
		return this.getActiveAssets()[this.selectedIndex];
	}

	private truncate(value: string, maxLength: number) {
		return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
	}
}
