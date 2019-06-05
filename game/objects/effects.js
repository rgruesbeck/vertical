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

import { randomBetween } from '../utils/baseUtils.js';
import { getDistance } from '../utils/spriteUtils.js';

const emitParticles = (n = 10, x = 0, y = 0, vx, vy, { rMin = 2, rMax = 7, hueMin = 0, hueMax = 60 }) => {
    return Array.apply(null, {length: n})
    .map(() => { return {
        x: x,
        y: y,
        vx: randomBetween(-10, 10, true),
        vy: randomBetween(-10, 10, true),
        r: randomBetween(rMin, rMax, true),
        hue: randomBetween(hueMin, hueMax, true),
    }; });
}

const drawParticle = (ctx, p) => {
    ctx.beginPath();
    ctx.arc(p.x >> 0, p.y >> 0, p.r >> 0, 0, 2 * Math.PI, false);
    ctx.fillStyle = `hsla(${p.hue}, 100%, 50%, 1)`;
    ctx.fill();
}

function Burst(ctx, n = 10, x, y, radius, options) {
    this.ctx = ctx;
    this.center = { x, y };
    this.radius = radius;
    this.shards = emitParticles(n, x, y, 0, 0, { ...options });
    this.active = true;

    this.tick = () => {
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
            shard.r = Math.abs(shard.r - 0.1);
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

export {
    emitParticles,
    drawParticle,
    Burst
};
