export default class Bootloader extends Phaser.Scene {
	cursorKeys;
 
	constructor() {
		super({key: 'Bootloader'});
	}

	preload() {
		console.log('preload Bootloader');
		//this.load.on('progress', (value) => {
		this.load.on('complete', (value) => {
			this.scene.start("Pong");
		})
		this.load.image('bola', 'assets/bola.png');
		this.load.image('pong1', 'assets/barra-1.png');
		this.load.image('pong2', 'assets/barra-2.png');
		this.load.image('separador', 'assets/red.png');
		this.load.image('ave', 'assets/ave-2.png');
	}

	create() {
		console.log('create Bootloader');
	}

	update(time, delta) {
	}
}