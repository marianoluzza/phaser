export default class Tetris extends Phaser.Scene {
	cursorKeys;
	ave = null;
 
	constructor() {
		super({key: 'Tetris'});
	}

	preload() {
		console.log('preload');
		//this.load.setBaseURL('https://labs.phaser.io');

		this.load.image('ave', 'assets/ave-1.png');
		this.load.image('ave', 'assets/ave-2.png');
		//this.load.image('logo', 'assets/sprites/phaser3-logo.png');
		//this.load.image('red', 'assets/particles/red.png');
	}

	create() {
		console.log('create');
		//this.ave = this.add.image(50, 100, 'ave');//carga imagen
		this.ave = this.physics.add.image(50, 100, 'ave');//carga imagen c/física
		this.ave.setScale(0.1);
		//this.ave.setOrigin(0.5, 0.5);//es en % del ancho y del alto
		//
		//Física
		this.ave.setCollideWorldBounds(true);
		//this.ave.setBounce(0.2);
		//this.ave.setAcceleration(0);
		//this.ave.setVelocity(0);
		//
		//Input
		//this.input.keyboard.on('keydown-RIGHT', this.mover(this.ave, 'x', 100), this);
		//this.input.keyboard.on('keyup-RIGHT', this.detener(this.ave), this);
		//this.input.keyboard.on('keydown-RIGHT', () => {
		//	this.ave.setAcceleration(100, 0);
		//});
		this.cursorKeys = this.input.keyboard.createCursorKeys();
		//this.right = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
		//this.left = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
		//con esto se pregunta if(this.right.isDown)
	}

	update(time, delta) {
		//this.ave.angle += 1;
		//this.ave.flipX = !this.ave.flipX;
		//this.ave.x += 1;
		//this.ave.y += 1;
		let vel = this.ave.body.velocity.x;
		let acc = this.ave.body.acceleration.x;
		//console.log("Vel:", vel)
		let enMovimiento = false;
		if(this.cursorKeys.right.isDown) {
			this.ave.flipX = false;
			this.ave.setAcceleration(100, 0);
			enMovimiento = true;
		}
		if(this.cursorKeys.left.isDown) {
			this.ave.flipX = true;
			this.ave.setAcceleration(-100, 0);
			enMovimiento = true;
		}
		if(!enMovimiento) {
			this.ave.setAcceleration(0, 0);
			if(vel > 0)
				this.ave.setVelocity(Math.max(vel - 1, 0), 0);
			else if(vel < 0)
				this.ave.setVelocity(Math.min(vel + 1, 0), 0);
		}
	}

	mover(obj, eje, vel) {
		return function() {
			obj.setAcceleration(eje == 'x' ? vel : 0, eje == 'y' ? vel : 0);
		}
	}

	detener(obj) {
		return function() {
			obj.setAcceleration(0, 0);
			obj.setVelocity(0, 0);
		}
	}
}