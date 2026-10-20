class RedCell extends Vehicle {
    constructor(path) {
        const start = path[0];
        super(start.x, start.y);
        this.path = path;
        this.r = 13;
        this.maxSpeed = 2.4;
        this.maxForce = 0.12;
        this.lookAheadDistance = 72;
        this.avoidanceSides = new Map();
        this.lastPathProjection = this.pos.copy();
        this.lastPathTarget = this.pos.copy();
        this.lastPathSegmentIndex = 0;
        this.lastPathDistance = 0;
        this.pathSteering = createVector(0, 0);
        this.avoidanceSteering = createVector(0, 0);
    }

    followPath(obstacles) {
        if (!this.path || this.path.length < 2) {
            this.pathSteering = createVector(0, 0);
            return this.pathSteering.copy();
        }

        let nearestDistanceSq = Infinity;
        let projection = null;
        let segmentIndex = 0;

        for (let i = 0; i < this.path.length; i++) {
            const start = this.path[i];
            const end = this.path[(i + 1) % this.path.length];
            const candidate = this.closestPointOnSegment(this.pos, start, end);
            const distanceSq = p5.Vector.sub(this.pos, candidate).magSq();
            if (distanceSq < nearestDistanceSq) {
                nearestDistanceSq = distanceSq;
                projection = candidate;
                segmentIndex = i;
            }
        }

        let remaining = this.lookAheadDistance;
        let cursor = projection.copy();
        let target = projection.copy();
        let index = segmentIndex;
        for (let visited = 0; visited < this.path.length; visited++) {
            const end = this.path[(index + 1) % this.path.length];
            const segmentRemaining = cursor.dist(end);
            if (remaining <= segmentRemaining || segmentRemaining < 1e-6) {
                if (segmentRemaining >= 1e-6) {
                    target = p5.Vector.add(
                        cursor,
                        p5.Vector.sub(end, cursor).mult(remaining / segmentRemaining)
                    );
                } else {
                    target = end.copy();
                }
                break;
            }
            remaining -= segmentRemaining;
            cursor = end.copy();
            index = (index + 1) % this.path.length;
            target = cursor.copy();
        }

        this.lastPathProjection = projection.copy();
        this.lastPathTarget = target.copy();
        this.lastPathSegmentIndex = segmentIndex;
        this.lastPathDistance = Math.sqrt(nearestDistanceSq);

        const desired = p5.Vector.sub(target, this.pos);
        if (desired.magSq() > 1e-6) {
            desired.setMag(this.maxSpeed);
        }
        this.pathSteering = p5.Vector.sub(desired, this.vel).limit(this.maxForce);

        this.avoidanceSteering = calculateObstacleAvoidance(
            this,
            obstacles,
            this.detectionRadius,
            this.avoidanceSides
        );
        const combinedSteering = this.debugThreat
            ? combineSteeringWithObstaclePriority(this, this.avoidanceSteering, [
                this.pathSteering.copy().mult(0.2)
            ])
            : this.pathSteering.copy()
                .add(this.avoidanceSteering.mult(1.8))
                .limit(this.maxForce);
        this.lastSteer = combinedSteering.copy();
        this.applyForce(combinedSteering);
        return combinedSteering;
    }

    update(elapsedMs = deltaTime) {
        super.update(elapsedMs);
        const margin = this.r + 4;
        this.pos.x = constrain(this.pos.x, margin, width - margin);
        this.pos.y = constrain(this.pos.y, margin, height - margin);
    }

    show() {
        const pulse = 1.8 + 1.2 * sin(frameCount * 0.05);
        push();
        if (visualEffectsEnabled) {
            noStroke();
            fill(235, 42, 85, 30);
            circle(this.pos.x, this.pos.y, this.r * 2.3 + pulse * 2);
        }
        translate(this.pos.x, this.pos.y);
        rotate(this.vel.magSq() < 1e-4 ? 0 : this.vel.heading());

        // 1. Bord externe épais et bombé du disque biconcave (bourrelet torique)
        fill(205, 28, 62, 248);
        stroke(255, 140, 168, 220);
        strokeWeight(1.8);
        ellipse(0, 0, this.r * 2.05, this.r * 1.55);

        // 2. Anneau intermédiaire en relief (pente vers la concavité)
        noStroke();
        fill(175, 20, 50, 235);
        ellipse(0, 0, this.r * 1.55, this.r * 1.15);

        // 3. Dépression centrale caractéristique du globule rouge (zone biconcave plus sombre et fine)
        fill(95, 10, 30, 245);
        stroke(145, 16, 42, 180);
        strokeWeight(1.2);
        ellipse(0, 0, this.r * 0.85, this.r * 0.65);

        // 4. Reflet spéculaire sur le bord torique supérieur
        noStroke();
        fill(255, 210, 225, 130);
        ellipse(-this.r * 0.28, -this.r * 0.35, this.r * 0.65, this.r * 0.22);
        pop();
    }

    showPathDebug() {
        push();
        stroke(255, 255, 255, 170);
        strokeWeight(1.5);
        line(this.pos.x, this.pos.y, this.lastPathProjection.x, this.lastPathProjection.y);
        noStroke();
        fill(255, 255, 255, 210);
        circle(this.lastPathProjection.x, this.lastPathProjection.y, 7);

        stroke(255, 230, 110, 220);
        strokeWeight(2);
        line(this.lastPathProjection.x, this.lastPathProjection.y,
            this.lastPathTarget.x, this.lastPathTarget.y);
        noStroke();
        fill(255, 225, 90, 240);
        circle(this.lastPathTarget.x, this.lastPathTarget.y, 10);

        this.drawVector(this.pos, this.pathSteering.copy().mult(90), color(255, 100, 210));
        this.drawVector(this.pos, this.avoidanceSteering.copy().mult(90), color(255, 190, 80));
        this.drawVector(this.pos, this.lastSteer.copy().mult(90), color(110, 235, 255));
        pop();
    }
}
