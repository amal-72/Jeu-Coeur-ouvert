class Nutrient extends Vehicle {
    constructor() {
        super(0, 0);
        this.r = 9;
        this.maxSpeed = 0;
        this.maxForce = 0;
        this.active = false;
        this.pulse = random(TWO_PI);
        this.respawnDelay = 4000;
        this.respawnTimer = 0;
        this.retryDelay = 500;
    }

    trySpawn(obstacles, otherNutrients, avoidPosition) {
        const minX = this.r + 8;
        const maxX = width - this.r - 8;
        const minY = this.r + 8;
        const maxY = height - this.r - 8;
        if (maxX < minX || maxY < minY) {
            return false;
        }

        const isSafe = (x, y) => {
            const candidate = createVector(x, y);
            if (avoidPosition && candidate.dist(avoidPosition) < this.r + 22 + 35) {
                return false;
            }
            for (const obstacle of obstacles) {
                if (candidate.dist(obstacle.pos) < this.r + obstacle.r + 10) {
                    return false;
                }
            }
            for (const other of otherNutrients) {
                if (other !== this && other.active
                    && candidate.dist(other.pos) < this.r + other.r + 12) {
                    return false;
                }
            }
            return true;
        };

        for (let attempt = 0; attempt < 100; attempt++) {
            const x = random(minX, maxX);
            const y = random(minY, maxY);
            if (isSafe(x, y)) {
                this.pos.set(x, y);
                this.active = true;
                this.respawnTimer = 0;
                return true;
            }
        }

        const step = Math.max(24, this.r * 2 + 12);
        for (let y = minY; y <= maxY; y += step) {
            for (let x = minX; x <= maxX; x += step) {
                if (isSafe(x, y)) {
                    this.pos.set(x, y);
                    this.active = true;
                    this.respawnTimer = 0;
                    return true;
                }
            }
        }

        return false;
    }

    consume() {
        if (!this.active) {
            return false;
        }
        this.active = false;
        this.respawnTimer = this.respawnDelay;
        spawnVisualEffect(this.pos, [94, 255, 202], 10, 44);
        return true;
    }

    updateRespawn(elapsedMs, obstacles, otherNutrients, avoidPosition) {
        if (this.active) {
            return;
        }
        this.respawnTimer -= Math.max(0, elapsedMs);
        if (this.respawnTimer <= 0
            && !this.trySpawn(obstacles, otherNutrients, avoidPosition)) {
            this.respawnTimer = this.retryDelay;
        }
    }

    update() {
        this.pulse += 0.06;
    }

    show() {
        if (!this.active) {
            return;
        }
        push();
        translate(this.pos.x, this.pos.y);
        if (visualEffectsEnabled) {
            noStroke();
            fill(49, 248, 203, 44);
            circle(0, 0, this.r * 2 + 6 + 4 * sin(this.pulse));
        }
        fill(67, 246, 206, 238);
        stroke(187, 255, 239, 235);
        strokeWeight(1.5);
        rotate(this.pulse * 0.3);
        beginShape();
        for (let i = 0; i < 6; i++) {
            const angle = TWO_PI * i / 6;
            vertex(
                cos(angle) * this.r,
                sin(angle) * this.r
            );
        }
        endShape(CLOSE);
        noStroke();
        fill(238, 255, 251, 225);
        circle(-this.r * 0.25, -this.r * 0.25, this.r * 0.55);
        pop();
    }
}
