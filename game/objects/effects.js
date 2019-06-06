/**
 * game/objects/effects.js
 * 
 * What it Does:
 *   This file contains effects for the game
 * 
 *   burst: get a particle burst
 * 
 * What to Change:
 *   Add any new methods that don't fit anywhere else
 *   eg. 
 * 
 */

import {
    randomBetween,
    valueOrRange
} from '../utils/baseUtils.js';
import {
    getDistance
} from '../utils/spriteUtils.js';

const emitParticles = ({ n = 1, x = 0, y = 0, vx = 1, vy = 1, rd = 2, hue = 0 }) => {
    return Array.apply(null, {length: n})
    .map(() => { return {
        x: valueOrRange(x),
        y: valueOrRange(y),
        vx: valueOrRange(vx),
        vy: valueOrRange(vy),
        rd: valueOrRange(rd),
        hue: valueOrRange(hue)
    }; });
}

const drawParticle = (ctx, p) => {
    ctx.beginPath();
    ctx.arc(p.x >> 0, p.y >> 0, p.rd >> 0, 0, 2 * Math.PI, false);
    ctx.fillStyle = `hsla(${p.hue}, 100%, 50%, 1)`;
    ctx.fill();
}

function StarStream({ ctx, n, x, y, vx, vy, rd, hue }) {
    this.active = true;
    this.ctx = ctx;
    this.n = n;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.rd = rd;
    this.hue = hue;
    this.stream = [];

    // create new star
    this.createStar = (n) => {
        return emitParticles({
            n: n,
            x: this.x,
            y: this.y,
            vx: this.vx,
            vy: this.vy,
            rd: this.rd,
            hue: this.hue
        });
    }

    this.tick = () => {
        // only tick if active
        if (!this.active) { return; }

        // loop through stars
        for (let i = 0; i < this.stream.length; i++) {
            let star = this.stream[i];

            // update position
            star.x += star.vx;
            star.y += star.vy;

            // update size and color
            star.rd = Math.abs(star.rd - 0.1);
            star.hue -= 0.5;

            // remove offscreen stars
            if (star.y > this.ctx.height) {
                this.stream.splice(i, 1);
            }

            // draw shard
            drawParticle(this.ctx, star);
        }

        // add new stars if less than n
        if (this.stream.length < this.n + 1) {
            // add new stars to the stream
            this.stream.push(this.createStar(1));
        }
    }
}

function Burst(ctx, n = 10, x, y, radius) {
    this.ctx = ctx;
    this.center = { x, y };
    this.radius = radius;
    this.active = true;
    this.shards = emitParticles({
        n: n,
        x: x,
        y: y,
        vx: [-10, 10],
        vy: [-10, 10],
        rd: [2, 4],
        hue: [200, 300]
    });

    this.tick = () => {
        // only tick if active
        if (!this.active) { return; }

        // flag as in-active when no more shards
        if (this.shards.length === 0) {
            this.active = false;
            return;
        }

        // loop through burst shards
        for (let i = 0; i < this.shards.length; i++) {
            let shard = this.shards[i];

            // update position
            shard.x += shard.vx;
            shard.y += shard.vy;

            // update size and color
            shard.rd = Math.abs(shard.rd - 0.1);
            shard.hue -= 0.5;

            // update distance from burst center
            shard.distance = getDistance(this.center, shard);

            // remove out of radius or slow shards
            let slow = Math.abs(shard.vx * shard.vy) < 1;
            if (shard.distance > this.radius || slow) {
                this.shards.splice(i, 1);
            }

            // draw shard
            drawParticle(this.ctx, shard);
        }
    }
}

function BlastWave({ ctx, x, y, radius }) {
    this.active = true;
    this.ctx = ctx;
    this.center = { x, y };
    this.radius = radius;
    this.waves = [{
        x: x,
        y: y,
        r: randomBetween(1, 10, true),
        width: 50,
        hue: randomBetween(300, 350, true)
    }];

    this.tick = () => {
        // only tick if active
        if (!this.active) { return; }

        // flag as in-active when no more waves
        if (this.waves.length === 0) {
            this.active = false;
            return;
        }

        // loop through waves 
        for (let i = 0; i < this.waves.length; i++) {
            let wave = this.waves[i];

            // draw waves
            wave.r += 7;
            wave.hue -= 1;
            wave.width -= 0.5;
            
            this.ctx.beginPath();
            this.ctx.arc(wave.x, wave.y, wave.r, 0, 2 * Math.PI);
            this.ctx.lineWidth = wave.width;
            this.ctx.strokeStyle = `hsla(${wave.hue}, 100%, 50%, 1)`;
            this.ctx.stroke();

            // remove wave when larger than blast radius
            if (wave.width < 1) {
                this.waves.splice(i, 1);
            }
        }

    }
}

export {
    emitParticles,
    drawParticle,
    Burst,
    BlastWave,
    StarStream
};
