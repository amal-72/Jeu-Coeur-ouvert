class Bacteria extends Vehicle {
    constructor(x, y, dna = BacteriaDNA.random()) {
        super(x, y);
        this.r = 15;
        this.maxForce = 0.12;
        this.displaceRange = 0.05;
        this.separationRadius = this.r * 2 + 60;
        this.flockWeights = { separation: 2.5, alignment: 0.6, cohesion: 0.4 };
        this.dna = dna.clone();
        this.applyDNA();
        this.wanderTheta = random(TWO_PI);
        this.vel = p5.Vector.fromAngle(random(TWO_PI)).setMag(this.maxSpeed * 0.6);
        this.velocity = this.vel;
        this.avoidanceSides = new Map();
        this.active = true;
        this.pulse = random(TWO_PI);
        this.damageCooldown = 0;
        this.damageCooldownDuration = 1500;
        this.maxHealth = 2;
        this.health = this.maxHealth;
        this.difficultySpeedMultiplier = 1;
        this.difficultyAggressionMultiplier = 1;
        this.resourcesCollected = 0;
        this.geneticDemo = false;
    }

    applyDNA() {
        const genes = this.dna.genes;
        this.baseMaxSpeed = genes.maxSpeed;
        this.maxSpeed = this.baseMaxSpeed;
        this.detectionRadius = genes.perceptionRadius;
        this.flockRadius = constrain(genes.perceptionRadius * 0.55, 60, 150);
        this.playerFleeRadius = genes.perceptionRadius;
    }

    trySpawn(obstacles, otherBacteria, avoidPosition) {
        const minX = this.r + 8;
        const maxX = width - this.r - 8;
        const minY = this.r + 8;
        const maxY = height - this.r - 8;
        if (maxX < minX || maxY < minY) {
            return false;
        }

        const isSafe = (x, y) => {
            const candidate = createVector(x, y);
            if (avoidPosition && candidate.dist(avoidPosition) < this.r + 22 + 24) {
                return false;
            }
            for (const obstacle of obstacles) {
                if (candidate.dist(obstacle.pos) < this.r + obstacle.r + 8) {
                    return false;
                }
            }
            for (const other of otherBacteria) {
                if (candidate.dist(other.pos) < this.r + other.r + 10) {
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
                return true;
            }
        }

        const step = this.r * 2 + 12;
        for (let y = minY; y <= maxY; y += step) {
            for (let x = minX; x <= maxX; x += step) {
                if (isSafe(x, y)) {
                    this.pos.set(x, y);
                    return true;
                }
            }
        }
        return false;
    }

    pursue(target) {
        if (!target) {
            return createVector(0, 0);
        }
        const distance = this.pos.dist(target.pos || target);
        const prediction = constrain(distance / Math.max(this.maxSpeed, 0.1), 0, 45);
        const targetPosition = target.pos || target;
        const targetVelocity = target.vel || createVector(0, 0);
        const predictedPosition = p5.Vector.add(
            targetPosition,
            targetVelocity.copy().mult(prediction)
        );
        return this.seek(predictedPosition);
    }

    evade(target) {
        if (!target) {
            return createVector(0, 0);
        }
        const distance = this.pos.dist(target.pos || target);
        const prediction = constrain(distance / Math.max(this.maxSpeed, 0.1), 0, 45);
        const targetPosition = target.pos || target;
        const targetVelocity = target.vel || createVector(0, 0);
        const predictedPosition = p5.Vector.add(
            targetPosition,
            targetVelocity.copy().mult(prediction)
        );
        return this.flee(predictedPosition);
    }

    applyBehaviors(
        obstacles,
        target,
        allies = [],
        neighbors = [],
        player = target,
        nutrients = [],
        toxins = []
    ) {
        const flockForce = this.flock(neighbors);
        const playerDistance = player ? this.pos.dist(player.pos || player) : Infinity;
        const fleeingPlayer = playerDistance < this.playerFleeRadius;
        const fleeUrgency = fleeingPlayer
            ? 1 - playerDistance / this.playerFleeRadius
            : 0;
        const pursueForce = fleeingPlayer
            ? createVector(0, 0)
            : this.pursue(target).mult(
                this.dna.genes.aggression
                * this.difficultyAggressionMultiplier
                * 0.8
            );
        const evadeForce = fleeingPlayer
            ? this.evade(player).mult(fleeUrgency * this.dna.genes.playerFlee)
            : createVector(0, 0);
        const nutrientForce = this.resourceAttraction(nutrients);
        const toxinForce = this.toxinRepulsion(toxins);
        const avoidForce = calculateObstacleAvoidance(
            this,
            obstacles,
            this.detectionRadius,
            this.avoidanceSides
        );
        const boundaryForce = this.steerFromBoundaries();
        const repelForce = this.repelAllies(allies);

        if (this.debugThreat) {
            this.lastSteer = combineSteeringWithObstaclePriority(this, avoidForce, [
                boundaryForce.copy().mult(1.5),
                flockForce.copy().mult(0.4),
                pursueForce.copy().mult(0.2),
                evadeForce.copy().mult(0.5),
                nutrientForce.copy().mult(0.3),
                toxinForce,
                repelForce
            ]);
            this.applyForce(this.lastSteer);
            return;
        }

        if (boundaryForce.magSq() > 1e-6) {
            const inwardAvoidance = avoidForce.dot(boundaryForce) > 0
                ? avoidForce
                : createVector(0, 0);
            const boundaryPriority = boundaryForce
                .add(inwardAvoidance.mult(1.5))
                .add(flockForce.mult(0.4))
                .add(pursueForce.mult(0.2))
                .add(evadeForce.mult(0.5))
                .add(nutrientForce.mult(0.3))
                .add(toxinForce)
                .add(repelForce);
            this.lastSteer = boundaryPriority.limit(this.maxForce).copy();
            this.applyForce(this.lastSteer);
            return;
        }

        const combinedForce = flockForce
            .add(pursueForce)
            .add(evadeForce)
            .add(nutrientForce)
            .add(toxinForce)
            .add(avoidForce.mult(2.2))
            .add(repelForce.mult(2));
        this.lastSteer = combinedForce.limit(this.maxForce).copy();
        this.applyForce(this.lastSteer);
    }

    resourceAttraction(resources = []) {
        let target = null;
        let nearest = this.dna.genes.perceptionRadius;
        for (const resource of resources) {
            if (!resource || resource.active === false) {
                continue;
            }
            const distance = this.pos.dist(resource.pos);
            if (distance < nearest) {
                target = resource;
                nearest = distance;
            }
        }
        if (!target) {
            return createVector(0, 0);
        }
        const urgency = 1 - nearest / this.dna.genes.perceptionRadius;
        return this.seek(target.pos).mult(
            this.dna.genes.nutrientAttraction * constrain(urgency + 0.25, 0.25, 1)
        );
    }

    toxinRepulsion(toxins = []) {
        let force = createVector(0, 0);
        for (const toxin of toxins) {
            if (!toxin || toxin.active === false) {
                continue;
            }
            const distance = this.pos.dist(toxin.pos);
            const radius = toxin.dangerRadius || this.dna.genes.perceptionRadius * 0.5;
            if (distance >= radius || distance < 1e-6) {
                continue;
            }
            const urgency = 1 - distance / radius;
            force.add(this.flee(toxin.pos).mult(
                this.dna.genes.toxinRepulsion * urgency
            ));
        }
        return force.limit(this.maxForce * 3);
    }

    applyEvolutionBehaviors(obstacles, resources, toxins, neighbors, target, arenaRight) {
        const flockForce = this.flock(neighbors).mult(0.35);
        const nutrientForce = this.resourceAttraction(resources);
        const toxinForce = this.toxinRepulsion(toxins);
        const targetDistance = target ? this.pos.dist(target.pos) : Infinity;
        const evadingTarget = target && targetDistance < this.playerFleeRadius;
        const pursuit = target && !evadingTarget
            && targetDistance < this.dna.genes.perceptionRadius
            ? this.pursue(target).mult(this.dna.genes.aggression)
            : createVector(0, 0);
        const evade = evadingTarget
            ? this.evade(target).mult(
                this.dna.genes.playerFlee
                * (1 - targetDistance / this.playerFleeRadius)
            )
            : createVector(0, 0);
        const wander = this.wander().mult(0.25);
        const avoid = calculateObstacleAvoidance(
            this,
            obstacles,
            this.detectionRadius,
            this.avoidanceSides
        ).mult(2.2);
        const boundary = this.steerFromEvolutionBounds(arenaRight);
        const steering = this.debugThreat
            ? combineSteeringWithObstaclePriority(this, avoid, [
                flockForce,
                nutrientForce,
                toxinForce,
                pursuit,
                evade,
                wander,
                boundary.copy().mult(3)
            ])
            : flockForce
                .add(nutrientForce)
                .add(toxinForce)
                .add(pursuit)
                .add(evade)
                .add(wander)
                .add(avoid)
                .add(boundary.mult(3))
                .limit(this.maxForce);
        this.lastSteer = steering.copy();
        this.applyForce(steering);
    }

    steerFromEvolutionBounds(arenaRight) {
        const margin = Math.max(55, this.vel.magSq() / (2 * this.maxForce) + this.r + 10);
        const desired = createVector(0, 0);
        if (this.pos.x < margin) {
            desired.x = 1;
        } else if (this.pos.x > arenaRight - margin) {
            desired.x = -1;
        }
        if (this.pos.y < margin) {
            desired.y = 1;
        } else if (this.pos.y > height - margin) {
            desired.y = -1;
        }
        if (desired.magSq() === 0) {
            return desired;
        }
        return p5.Vector.sub(desired.setMag(this.maxSpeed), this.vel).limit(this.maxForce);
    }

    repelAllies(allies) {
        const repel = createVector(0, 0);
        let count = 0;
        for (const ally of allies) {
            const offset = p5.Vector.sub(this.pos, ally.pos);
            const distance = offset.mag();
            const range = this.r + ally.r + 5;
            if (distance < range) {
                if (distance < 1e-6) {
                    offset.set(p5.Vector.fromAngle(
                        (this.steeringId - ally.steeringId) * 2.399963229728653
                    ));
                } else {
                    offset.normalize();
                }
                offset.mult(constrain((range - distance) / range, 0, 1));
                repel.add(offset);
                count++;
            }
        }
        if (count === 0) {
            return repel;
        }

        repel.div(count);
        const strength = Math.min(1, repel.mag());
        if (strength < 1e-4) {
            return createVector(0, 0);
        }
        repel.setMag(this.maxSpeed * strength);
        return p5.Vector.sub(repel, this.vel).limit(this.maxForce);
    }

    setDifficulty(speedMultiplier, aggressionMultiplier, damageCooldown) {
        this.difficultySpeedMultiplier = speedMultiplier;
        this.difficultyAggressionMultiplier = aggressionMultiplier;
        this.damageCooldownDuration = damageCooldown;
        this.maxSpeed = this.baseMaxSpeed * speedMultiplier;
    }

    steerFromBoundaries() {
        const brakingDistance = this.vel.magSq() / (2 * Math.max(this.maxForce, 1e-4));
        const margin = Math.max(100, brakingDistance * 3 + this.r + 12);
        const desired = createVector(0, 0);

        if (this.pos.x < margin) {
            desired.x = 1 - constrain(this.pos.x / margin, 0, 1);
        } else if (this.pos.x > width - margin) {
            desired.x = -constrain((this.pos.x - (width - margin)) / margin, 0, 1);
        }
        if (this.pos.y < margin) {
            desired.y = 1 - constrain(this.pos.y / margin, 0, 1);
        } else if (this.pos.y > height - margin) {
            desired.y = -constrain((this.pos.y - (height - margin)) / margin, 0, 1);
        }

        if (desired.magSq() === 0) {
            return createVector(0, 0);
        }

        const urgency = Math.min(1, desired.mag());
        desired.setMag(this.maxSpeed * urgency);
        return p5.Vector.sub(desired, this.vel).limit(this.maxForce * urgency);
    }

    update(elapsedMs = deltaTime, obstacles = []) {
        super.update();
        this.damageCooldown = Math.max(0, this.damageCooldown - Math.max(0, elapsedMs));
        this.pulse += Math.max(0, elapsedMs) * 0.002;
        if (obstacles && obstacles.length > 0) {
            for (const obstacle of obstacles) {
                const offset = p5.Vector.sub(this.pos, obstacle.pos);
                const minimumDistance = this.r + obstacle.r;
                const distance = offset.mag();
                if (distance >= minimumDistance) {
                    continue;
                }
                const normal = distance > 1e-6
                    ? offset.div(distance)
                    : p5.Vector.fromAngle(this.vel.magSq() > 1e-4 ? this.vel.heading() : 0);
                this.pos.add(normal.copy().mult(minimumDistance - distance));
                const velocityIntoObstacle = this.vel.dot(normal);
                if (velocityIntoObstacle < 0) {
                    this.vel.sub(normal.copy().mult(velocityIntoObstacle));
                }
            }
        }
    }

    show() {
        const healthRatio = constrain(this.health / Math.max(1, this.maxHealth), 0, 1);
        const healthyColor = this.geneticDemo
            ? color(166, 135, 242, 238)
            : color(235, 88 + 90 * healthRatio, 131 + 90 * healthRatio, 238);
        const outlineColor = this.geneticDemo
            ? color(217, 179, 255, 235)
            : color(255, 123 + 95 * healthRatio, 155 + 85 * healthRatio, 235);
        push();
        if (visualEffectsEnabled) {
            noStroke();
            fill(234, 58, 134, 34);
            circle(this.pos.x, this.pos.y, this.r * 2 + 8 + 4 * sin(this.pulse));
        }
        push();
        translate(this.pos.x, this.pos.y);
        const heading = this.vel.magSq() < 0.04 ? 0 : this.vel.heading();
        rotate(heading);

        // 1. Flagelles bactériens ondulants à l'arrière
        stroke(outlineColor);
        strokeWeight(1.4);
        noFill();
        const tailLen = this.r * 1.5;
        for (let f = -1; f <= 1; f += 2) {
            beginShape();
            const startY = f * this.r * 0.35;
            vertex(-this.r * 0.95, startY);
            for (let seg = 1; seg <= 4; seg++) {
                const segX = -this.r * 0.95 - (tailLen * seg) / 4;
                const segY = startY + sin(this.pulse * 2.5 + seg * 0.8 + f) * (4 + seg * 2);
                vertex(segX, segY);
            }
            endShape();
        }

        // 2. Capsule bactérienne vivante et membrane hérissée
        fill(healthyColor);
        stroke(outlineColor);
        strokeWeight(1.8);
        beginShape();
        for (let i = 0; i < 12; i++) {
            const angle = TWO_PI * i / 12;
            const wobble = 1 + 0.12 * sin(angle * 3 + this.pulse);
            vertex(
                cos(angle) * this.r * wobble * 1.15,
                sin(angle) * this.r * wobble * 0.88
            );
        }
        endShape(CLOSE);

        // 3. Vacuoles et granulations toxiques internes
        noStroke();
        fill(255, 230, 240, 195);
        circle(-this.r * 0.28, -this.r * 0.2, 4.5);
        circle(this.r * 0.14, this.r * 0.22, 3.8);
        circle(this.r * 0.36, -this.r * 0.14, 3.2);

        // Nodule cytoplasmique central
        fill(75, 12, 45, 160);
        ellipse(0, 0, this.r * 0.65, this.r * 0.45);
        pop();

        if (!this.geneticDemo) {
            const barWidth = this.r * 2.2;
            const barY = this.pos.y - this.r - 10;
            push();
            noStroke();
            fill(3, 9, 22, 210);
            rect(this.pos.x - barWidth / 2, barY, barWidth, 4.5, 2);
            fill(healthRatio > 0.5 ? color(67, 230, 191) : color(255, 105, 110));
            rect(this.pos.x - barWidth / 2, barY, barWidth * healthRatio, 4.5, 2);
            pop();
        }

    }

}
