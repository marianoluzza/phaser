import Pala from "../GameObjects/Pala.js";
export default class Pong extends Phaser.Scene {
	cursorKeys;
	j1 = null;
 
	constructor() {
		super({key: 'Pong'});
	}

	preload() {
		console.log('preload');
	}

	create() {
		console.log('create');
		this.altura_media = this.sys.game.config.height/2;
		this.ancho_media = this.sys.game.config.width/2;
		this.separador = this.add.image(this.ancho_media, this.altura_media, 'separador');//carga imagen
		this.bola = this.physics.add.image(this.ancho_media, this.altura_media, 'bola');
		this.j1 = new Pala(this, 25, this.altura_media, 'pong1');
		this.j2 = new Pala(this, this.sys.game.config.width-25, this.altura_media, 'pong2');
		//
		//Física
		this.bola.setCollideWorldBounds(true);
		this.bola.setBounce(1);
		this.bola.setVelocityX(-200);
		this.physics.world.setBoundsCollision(false, false, true, true);
		this.physics.add.collider(this.bola, this.j1, this.chocaPala);
		this.physics.add.collider(this.bola, this.j2, this.chocaPala);
		//
		//Inputs
		//J1
		this.cursorKeys = this.input.keyboard.createCursorKeys();
		//J2
		this.up = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
		this.down = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
	}

	update(time, delta) {
		if(this.up.isDown){
			this.j1.body.setVelocityY(-200);
		} else if(this.down.isDown){
			this.j1.body.setVelocityY(200);
		} else {
			this.j1.body.setVelocityY(0);
		}
		if(this.cursorKeys.up.isDown) {
			this.j2.body.setVelocityY(-200);
		} else if(this.cursorKeys.down.isDown) {
			this.j2.body.setVelocityY(200);
		} else {
			this.j2.body.setVelocityY(0);
		}
		let delta_colision = 0, altura_media = 0;
		// Assuming you have two sprites named 'player' and 'enemy'
		const bolaBounds = this.bola.getBounds();
		const j1Bounds = this.j1.getBounds(), j2Bounds = this.j2.getBounds();
		// Check for collision between the two sprites
		if (Phaser.Geom.Intersects.RectangleToRectangle(bolaBounds, j1Bounds)) {
			// Get the intersection rectangle
			const intersection = Phaser.Geom.Rectangle.Intersection(bolaBounds, j1Bounds);
			let centro_j1 = this.j1.y;
			let centro_colision = intersection.y;
			delta_colision = centro_colision - centro_j1;
			altura_media = this.j1.height/2;
		} else if (Phaser.Geom.Intersects.RectangleToRectangle(bolaBounds, j2Bounds)) {
			// Get the intersection rectangle
			const intersection = Phaser.Geom.Rectangle.Intersection(bolaBounds, j2Bounds);
			//console.log("Intersection: ",intersection);
			//console.log("Relative: ",{x: intersection.x - this.j2.x, y: intersection.y - this.j2.y});
			let centro_j2 = this.j2.y;
			let centro_colision = intersection.y;
			delta_colision = centro_colision - centro_j2;
			altura_media = this.j2.height/2;
		}
		if(delta_colision > 0){
			console.log("Pegó arriba");
		} else if(delta_colision < 0) {
			console.log("Pegó abajo");
		}
		//
		//BOLA
		if(this.bola.x < 0) {
			this.bola.x = this.ancho_media;
		} else if(this.bola.x > this.sys.game.config.width) {
			this.bola.x = this.ancho_media;
		} else if(delta_colision != 0) {
			this.bola.setVelocityY(200 * (delta_colision / altura_media));
		}
	}
	
	chocaPala(bola, pala) {
		
	}
}