import Bootloader from "./src/Scenes/Bootloader.js";
import Tetris from "./src/Scenes/Tetris.js";
import Pong from "./src/Scenes/Pong.js";

const config = {
	type: Phaser.AUTO,
	width: 800,
	height: 600,
	parent: 'container',
	physics: {
		default: 'arcade',
		arcade: {
			//gravity: { y: 200 }
		}
	},
	scene: [
		Bootloader,
		//Tetris,
		Pong,
	]
};

const game = new Phaser.Game(config);