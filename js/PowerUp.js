class PowerUp extends Vehicle {
    constructor(type) {
        super(0, 0);
        this.type = type;
        this.r = 13;
        this.maxSpeed = 0;
        this.maxForce = 0;
        this.active = false;
        this.pulse = random(TWO_PI);
        this.respawnDelay = 18000;
        this.respawnTimer = 0;
        this.retryDelay = 750;
    }

    trySpawn(obstacles, otherPowerUps, avoidPosition) {
        const minX = this.r + 20;
        const maxX = width - this.r - 20;
        const minY = this.r + 20;
        const maxY = height - this.r - 20;
        if (maxX <= minX || maxY <= minY) {
            return false;
        }

        const avoidRadius = Math.min(190, Math.min(width, height) * 0.35);
        const isSafe = candidate =>
            (!avoidPosition || candidate.dist(avoidPosition) >= avoidRadius)
            && obstacles.every(obstacle =>
                candidate.dist(obstacle.pos) >= this.r + obstacle.r + 18
            )
            && otherPowerUps.every(other => other === this || !other.active
                || candidate.dist(other.pos) >= this.r + other.r + 36);

        for (let attempt = 0; attempt < 120; attempt++) {
            const candidate = createVector(random(minX, maxX), random(minY, maxY));
            if (isSafe(candidate)) {
                this.pos.set(candidate);
                this.active = true;
                this.respawnTimer = 0;
                return true;
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
        return true;
    }

    updateRespawn(elapsedMs, obstacles, otherPowerUps, avoidPosition) {
        if (this.active) {
            return;
        }
        this.respawnTimer -= Math.max(0, elapsedMs);
        if (this.respawnTimer <= 0
            && !this.trySpawn(obstacles, otherPowerUps, avoidPosition)) {
            this.respawnTimer = this.retryDelay;
        }
    }

    update(elapsedMs = deltaTime) {
        this.pulse += Math.max(0, elapsedMs) * 0.003;
    }

    show() {
        if (!this.active) {
            return;
        }
        const isShield = this.type === 'shield';
        const accent = isShield ? color(91, 231, 255) : color(255, 185, 91);
        push();
        translate(this.pos.x, this.pos.y);
        if (visualEffectsEnabled) {
            noStroke();
            fill(red(accent), green(accent), blue(accent), 38 + 12 * sin(this.pulse));
            circle(0, 0, this.r * 3 + 6 * sin(this.pulse));
        }
        rotate(this.pulse * 0.25);
        fill(isShield ? color(29, 117, 157, 245) : color(157, 88, 28, 245));
        stroke(accent);
        strokeWeight(2);
        if (isShield) {
            beginShape();
            vertex(0, -this.r);
            vertex(this.r * 0.82, -this.r * 0.45);
            vertex(this.r * 0.68, this.r * 0.55);
            vertex(0, this.r);
            vertex(-this.r * 0.68, this.r * 0.55);
            vertex(-this.r * 0.82, -this.r * 0.45);
            endShape(CLOSE);
        } else {
            beginShape();
            vertex(-this.r * 0.75, this.r * 0.7);
            vertex(0, -this.r);
            vertex(this.r * 0.75, this.r * 0.7);
            endShape(CLOSE);
        }
        pop();

        push();
        noStroke();
        fill(245, 250, 255, 235);
        textAlign(CENTER, BOTTOM);
        textSize(9);
        text(isShield ? 'BOUCLIER' : 'VITESSE', this.pos.x, this.pos.y - this.r - 4);
        pop();
    }
}
