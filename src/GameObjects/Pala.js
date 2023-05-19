export default class Pala extends Phaser.GameObjects.Sprite {
	constructor(scene, x, y, type) {
		super(scene, x, y, type);
		this.scene = scene
		this.scene.add.existing(this);
		this.scene.physics.world.enable(this);
		this.body.immovable = true;
		this.body.setCollideWorldBounds(true);
	}

}