/**
 * game/main.js
 * 
 * What it Does:
 *   This file is the main game class
 *   Important parts are the load, create, and play functions
 *   
 *   Load: is where images, sounds, and fonts are loaded
 *   
 *   Create: is where game elements and characters are created
 *   
 *   Play: is where game characters are updated according to game play
 *   before drawing a new frame to the screen, and calling play again
 *   this creates an animation just like the pages of a flip book
 * 
 *   Other parts include boilerplate for requesting and canceling new frames
 *   handling input events, pausing, muting, etc.
 * 
 * What to Change:
 *   Most things to change will be in the play function
 */

import Koji from 'koji-tools';

import {
    requestAnimationFrame,
    cancelAnimationFrame
} from './helpers/animationFrame.js';

import {
    loadList,
    loadImage,
    loadSound,
    loadFont
} from './helpers/assetLoaders.js';

import {
    hashCode,
    randomBetween,
    throttled
} from './utils/baseUtils.js';

import {
    resize
} from './utils/imageUtils.js';

import {
    getDistance
} from './utils/spriteUtils.js';

import {
    canvasInputPosition
} from './utils/inputUtils.js';

import {
    Burst,
    BlastWave,
    StarStream
} from './objects/effects.js';

import Player from './characters/player.js';
import Obstacle from './characters/obstacle.js';
import { collideDistance } from './utils/spriteUtils.js';

class Game {

    constructor(canvas, overlay, topbar, config) {
        this.config = config; // customization
        this.overlay = overlay;
        this.topbar = topbar;
        this.topbar.active = config.settings.gameTopBar;
        this.maxWidth = parseInt(config.settings.maxWidth);

        this.prefix = hashCode(this.config.settings.name); // set prefix for local-storage keys

        this.canvas = canvas; // game screen
        this.ctx = canvas.getContext("2d"); // game screen context

        // setup throttled functions
        this.decrementLife = throttled(1200, () => this.state.lives -= 1);
        this.throttledBlastWave = throttled(600, (bw) => new BlastWave(bw));
        this.throttledBurst = throttled(300, (br) => new Burst(br));

        // setup event listeners
        // handle keyboard events
        document.addEventListener('keydown', ({ code }) => this.handleKeyboardInput('keydown', code));
        document.addEventListener('keyup', ({ code }) => this.handleKeyboardInput('keyup', code));

        // handle taps
        document.addEventListener('touchstart', (e) => this.handleTap(e));

        // handle overlay clicks
        this.overlay.root.addEventListener('click', (e) => this.handleClicks(e));

        // handle resize events
        window.addEventListener('resize', () => this.handleResize());
        window.addEventListener("orientationchange", (e) => this.handleResize(e));

        // restart game loop after tab unfocused
        // window.addEventListener('blur', () => this.requestFrame(() => this.play()));
        
        // handle koji config changes
        Koji.on('change', (scope, key, value) => {
            this.config[scope][key] = value;
            this.cancelFrame(this.frame.count - 1);
            this.load();
        });

    }

    init() {
        // set canvas
        // this.canvas.width = window.innerWidth; // set game screen width
        this.canvas.width = Math.min(window.innerWidth, this.maxWidth); // set game screen width
        this.canvas.height = this.topbar.active ? window.innerHeight - this.topbar.clientHeight : window.innerHeight; // set game screen height

        // frame count, rate, and time
        // this is just a place to keep track of frame rate (not set it)
        this.frame = {
            count: 0,
            time: Date.now(),
            rate: null,
            scale: null
        };

        // game settings
        this.state = {
            current: 'loading',
            prev: '',
            lanes: parseInt(this.config.settings.lanes),
            playerLane: parseInt(this.config.settings.lanes) /  2 >> 0,
            laneSize: Math.floor(this.canvas.width / parseInt(this.config.settings.lanes)),
            gameSpeed: parseInt(this.config.settings.gameSpeed),
            score: 0,
            lives: parseInt(this.config.settings.lives),
            paused: false,
            muted: localStorage.getItem(this.prefix.concat('muted')) === 'true'
        };

        this.input = {
            active: 'keyboard',
            keyboard: { up: false, right: false, left: false, down: false },
            mouse: { x: 0, y: 0, click: false },
            touch: { x: 0, y: 0 },
        };

        this.images = {}; // place to keep images
        this.sounds = {}; // place to keep sounds
        this.fonts = {}; // place to keep fonts

        this.lanes = []; // lanes
        this.effects = []; // effects
        this.entities = []; // entities (obstacles, powerups)
        this.player = {}; // player

        // set topbar and topbar color
        this.topbar.active = this.config.settings.gameTopBar;
        this.topbar.style.display = this.topbar.active ? 'block' : 'none';
        this.topbar.style.backgroundColor = this.config.colors.primaryColor;


        // set screen
        this.screen = {
            top: 0,
            bottom: this.canvas.height,
            left: 0,
            right: this.canvas.width,
            centerX: this.canvas.width / 2,
            centerY: this.canvas.height / 2,
            scale: ((this.canvas.width + this.canvas.height) / 2) * 0.003
        };

        // set document body to backgroundColor
        document.body.style.backgroundColor = this.config.colors.backgroundColor;

        // set loading indicator to textColor
        document.querySelector('#loading').style.color = this.config.colors.textColor;

    }

    load() {
        // load pictures, sounds, and fonts
    
        if (this.sounds && this.sounds.backgroundMusic) { this.sounds.backgroundMusic.pause(); } // stop background music when re-loading

        this.init();

        // make a list of assets
        const gameAssets = [
            loadImage('playerImage', this.config.images.playerImage),
            loadImage('obstacleImage', this.config.images.obstacleImage),
            loadImage('backgroundImage', this.config.images.backgroundImage),
            loadSound('backgroundMusic', this.config.sounds.backgroundMusic),
            loadSound('powerUpSound', this.config.sounds.powerUpSound),
            loadSound('turnSound', this.config.sounds.turnSound),
            loadSound('hitSound', this.config.sounds.hitSound),
            loadSound('gameOverSound', this.config.sounds.gameOverSound),
            loadFont('gameFont', this.config.settings.fontFamily)
        ];

        // put the loaded assets the respective containers
        loadList(gameAssets)
        .then((assets) => {

            this.images = assets.image;
            this.sounds = assets.sound;

        })
        .then(() => this.create());
    }

    create() {
        // create game characters

        const { top } = this.screen;
        const { playerImage } = this.images;

        let playerSize = resize({ image: playerImage, width: this.state.laneSize });

        this.player = new Player({
            ctx: this.ctx,
            image: playerImage,
            x: this.state.playerLane * this.state.laneSize,
            y: top,
            width: playerSize.width,
            height: playerSize.height,
            speed: 70,
            bounds: this.screen
        });


        // set overlay styles
        this.overlay.setStyles({...this.config.colors, ...this.config.settings});

        this.setState({ current: 'ready' });
        this.play();
    }

    play() {
        // update game characters

        // clear the screen of the last picture
        this.ctx.fillStyle = this.config.colors.backgroundColor; 
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // draw and do stuff that you need to do
        // no matter the game state
        this.ctx.drawImage(this.images.backgroundImage, 0, 0, this.canvas.width, this.canvas.height);

        // update score and lives
        this.overlay.setLives(this.state.lives);
        this.overlay.setScore(this.state.score);

        // ready to play
        if (this.state.current === 'ready') {

            // dispaly menu after loading or game over
            if (this.state.prev.match(/loading|over/)) {
                this.overlay.hide('loading');
                this.canvas.style.opacity = 1;

                this.overlay.setBanner(this.config.settings.name);
                this.overlay.setButton(this.config.settings.startText);
                this.overlay.setInstructions({
                    desktop: this.config.settings.instructionsDesktop,
                    mobile: this.config.settings.instructionsMobile
                });

                this.overlay.show('stats');

                this.overlay.setMute(this.state.muted);
                this.overlay.setPause(this.state.paused);

                this.setState({ current: 'ready' });
            }

        }

        // game play
        if (this.state.current === 'play') {

            // if last state was 'ready'
            // hide overlay items
            if (this.state.prev === 'ready') {
                this.overlay.hide(['banner', 'button', 'instructions'])

                // start star stream
                this.effects.push(new StarStream({
                    ctx: this.ctx,
                    n: 200,
                    x: [0, this.canvas.width],
                    y: 0,
                    vx: 0,
                    vy: this.state.gameSpeed, // game background speed
                    rd: [2, 7],
                    hue: [0, 70]
                }))

                // power up sound
                this.sounds.powerUpSound.play();
                this.setState({ current: 'play' });
            }

            if (!this.state.muted) { this.sounds.backgroundMusic.play(); }

            // add an obstacle
            if (this.frame.count % 120 === 0 || this.entities.length < 5) {
                // pick a random lane/location
                let obstacleLane = randomBetween(0, this.state.lanes, true);
                let location = { x: this.state.laneSize * obstacleLane, y: -200 };

                // ignore crowded locations
                let inValidLocation = this.entities.some((ent) => {
                    return getDistance(ent, location) < this.state.laneSize * 2;
                });

                if (!inValidLocation) {
                    // add new obstacle
                    let { obstacleImage } = this.images;
                    let obstacleSize = resize({ image: obstacleImage, width: this.state.laneSize });

                    this.entities.push(new Obstacle({
                        ctx: this.ctx,
                        image: obstacleImage,
                        lane: obstacleLane,
                        x: location.x,
                        y: location.y,
                        width: obstacleSize.width,
                        height: obstacleSize.height,
                        speed: this.state.gameSpeed,
                        bounds: this.screen
                    }))
                }
            }

            // update and draw effects
            for (let i = 0; i < this.effects.length; i++) {
                let effect = this.effects[i];

                // run effect tick
                effect.tick();

                // remove in-active effects
                if (!effect.active) {
                    this.effects.splice(i, 1);
                }
                
            }

            for (let i = 0; i < this.entities.length; i++) {
                let entity = this.entities[i];

                entity.move(0, 1, this.frame.scale);
                entity.draw();

                // check for player collisions
                if (entity.lane === this.state.playerLane && collideDistance(entity, this.player)) {
                    // handle collision

                    // decrement life
                    this.decrementLife();

                    // let collisionLocation = 0;
                    // burst effect
                    let burst = this.throttledBurst({
                        ctx: this.ctx,
                        n: 50,
                        x: this.player.cx,
                        y: this.player.cy,
                        vx: [-50, 50],
                        vy: [-5, 50],
                        burnRate: 0.1
                    });

                    burst && this.effects.push(burst);

                    // blast effect
                    let blastWave = this.throttledBlastWave({
                        ctx: this.ctx,
                        x: this.player.cx,
                        y: this.player.cy
                    });

                    if (blastWave) {
                      this.effects.push(blastWave);

                        this.sounds.hitSound.currentTime = 0;
                        this.sounds.hitSound.play();
                    }
                }

                // remove in-active entity
                if (entity.y > this.canvas.height) {
                    this.entities.splice(i, 1);

                    // add points
                    // increase game speed
                    this.setState({
                        score: Math.floor(this.state.score + (this.state.gameSpeed / 20)),
                        gameSpeed: this.state.gameSpeed + 0.1 
                    });
                }
                
            }


            // check for game over
            if (this.state.lives < 1) {
                // big explosion
                this.effects.push(
                    new BlastWave({
                        ctx: this.ctx,
                        x: this.player.cx,
                        y: this.player.cy,
                        width: 300,
                        hue: 360,
                        burnRate: [200, 300]
                    }),
                    new BlastWave({
                        ctx: this.ctx,
                        x: this.player.cx,
                        y: this.player.cy,
                        width: 150,
                        burnRate: [100, 200]
                    }),
                    new BlastWave({
                        ctx: this.ctx,
                        x: this.player.cx,
                        y: this.player.cy,
                        width: 20,
                        burnRate: [50, 100]
                    }),
                    new Burst({
                        ctx: this.ctx,
                        n: 100,
                        x: this.player.cx,
                        y: this.player.cy,
                        vx: [-50, 50],
                        vy: [-5, 5],
                        burnRate: 0.05
                    }),
                    new Burst({
                        ctx: this.ctx,
                        n: 25,
                        x: this.player.cx,
                        y: this.player.cy,
                        vx: [-6, 6],
                        vy: [-60, 60],
                        burnRate: 0.025
                    })
                );

                this.sounds.gameOverSound.play();

                // game over
                this.setState({ current: 'over' });
            }

            // player bounce
            let dy = Math.cos(this.frame.count / 5) / 30;

            this.player.move(0, dy, this.frame.scale);
            this.player.moveTo(this.state.playerLane * this.state.laneSize, this.screen.bottom - this.player.height); 
            this.player.draw();
        }

        // game over
        if (this.state.current === 'over') {
            // game over code

            // update and draw effects
            for (let i = 0; i < this.effects.length; i++) {
                let effect = this.effects[i];

                // run effect tick
                effect.tick();

                // remove in-active effects
                if (!effect.active) {
                    this.effects.splice(i, 1);
                }
                
            }

            if (this.effects.length === 1) {
                setTimeout(this.load(), 2000);
            }

        }

        // draw the next screen
        this.requestFrame(() => this.play());
    }

    shiftRight() {
        // right
        this.setState({
            playerLane: Math.min(this.state.playerLane + 1, this.state.lanes - 1)
        });

        this.sounds.turnSound.currentTime = 0;
        this.sounds.turnSound.play();
    }

    shiftLeft() {
        // left
        this.setState({
            playerLane: Math.max(this.state.playerLane - 1, 0)
        });

        this.sounds.turnSound.currentTime = 0;
        this.sounds.turnSound.play();
    }

    // event listeners
    handleClicks(e) {
        if (this.state.current === 'loading') { return; }

        let { target } = e;

        // mute
        if (target.id === 'mute') {
            this.mute();
        }

        // pause
        if (target.id === 'pause') {
            this.pause();
        }

        // button
        if ( target.id === 'button') {
            // if defaulting to have sound on by default
            // double mute() to warmup iphone audio here
            this.mute();
            this.mute();

            this.setState({ current: 'play' });
        }

        /*
        console.log('----- snapshot -----');
        console.log(this.effects);
        console.log(this.entities);
        console.log(this.player);
        */
    }

    handleKeyboardInput(type, code) {
        this.input.active = 'keyboard';

        if (type === 'keydown' && this.state.current === 'play') {
            if (code === 'ArrowRight') {
                this.input.keyboard.right = true;
            }
            if (code === 'ArrowLeft') {
                this.input.keyboard.left = true;
            }
        }

        if (type === 'keyup' && this.state.current === 'play') {
            if (code === 'ArrowRight') {
                this.input.keyboard.right = false;
                this.shiftRight();
            }
            if (code === 'ArrowLeft') {
                this.input.keyboard.left = false;
                this.shiftLeft();
            }

            if (code === 'Space') {

                this.pause(); // pause
            }
        }

        // start game on read
        if (type === 'keydown' && this.state.current === 'ready') {
            this.setState({ current: 'play' });
        }

        // reload on game over
        if (type === 'keydown' && this.state.current === 'over') {
            this.effects.length === 1 && this.load();
        }

    }

    handleTap(e) {
        // ignore for first 1 second
        if (this.frame.count < 60) { return; }

        // shift right for right of player taps
        // shift left for left of player taps
        let location = canvasInputPosition(this.canvas, e.touches[0]);

        if (location.x > this.player.x) {
            this.shiftRight();
        }

        if (location.x < this.player.x) {
            this.shiftLeft();
        }
    }

    handleResize() {

        document.location.reload();
    }

    // pause game
    pause() {
        if (this.state.current != 'play') { return; }

        this.state.paused = !this.state.paused;
        this.overlay.setPause(this.state.paused);

        if (this.state.paused) {
            // pause game loop
            this.cancelFrame(this.frame.count - 1);

            // mute all game sounds
            Object.keys(this.sounds).forEach((key) => {
                this.sounds[key].muted = true;
                this.sounds[key].pause();
            });

            this.overlay.setBanner('Paused');
        } else {
            // resume game loop
            this.requestFrame(() => this.play(), true);

            // resume game sounds if game not muted
            if (!this.state.muted) {
                Object.keys(this.sounds).forEach((key) => {
                    this.sounds[key].muted = false;
                    this.sounds.backgroundMusic.play();
                });
            }

            this.overlay.hide('banner');
        }
    }

    // mute game
    mute() {
        let key = this.prefix.concat('muted');
        localStorage.setItem(
            key,
            localStorage.getItem(key) === 'true' ? 'false' : 'true'
        );
        this.state.muted = localStorage.getItem(key) === 'true';

        this.overlay.setMute(this.state.muted);

        if (this.state.muted) {
            // mute all game sounds
            Object.keys(this.sounds).forEach((key) => {
                this.sounds[key].muted = true;
                this.sounds[key].pause();
            });
        } else {
            // unmute all game sounds
            // and play background music
            // if game not paused
            if (!this.state.paused) {
                Object.keys(this.sounds).forEach((key) => {
                    this.sounds[key].muted = false;
                    this.sounds.backgroundMusic.play();
                });
            }
        }
    }

    // reset game
    reset() {
        document.location.reload();
    }

    // update game state
    setState(state) {
        this.state = {
            ...this.state,
            ...{ prev: this.state.current },
            ...state,
        };
    }

    // request new frame
    // wraps requestAnimationFrame.
    // see game/helpers/animationframe.js for more information
    requestFrame(next, resumed) {
        let now = Date.now();
        this.frame = {
            count: requestAnimationFrame(next),
            time: now,
            rate: resumed ? 0 : now - this.frame.time,
            scale: this.screen.scale * this.frame.rate * 0.01
        };
    }

    // cancel frame
    // wraps cancelAnimationFrame.
    // see game/helpers/animationframe.js for more information
    cancelFrame() {
        cancelAnimationFrame(this.frame.count);
    }
}

export default Game;