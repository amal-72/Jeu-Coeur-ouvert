class WhiteCell extends Vehicle {
    constructor(x, y, isAlly = false) {
        super(x, y);
        this.isAlly = isAlly;
        this.allyRole = 0;
        this.targetBacterium = null;
        this.allyState = 'En attente';
        this.r = 22;
        this.maxSpeed = 4;
        this.maxForce = 0.25;
        if (isAlly) {
            this.displaceRange = 0.05;
        }
        this.rayonZoneDeFreinage = 100;
        this.mouseMovementTarget = this.pos.copy();
        this.pulse = 0;
        this.energy = 100;
        this.maxEnergy = 100;
        this.energyDrainPerSecond = 0.55;
        this.energyPerNutrient = 35;
        this.avoidanceSides = new Map();
        this.damageCooldown = 0;
        this.attackCooldown = 0;
        this.damageCooldownDuration = 1500;
        this.attackCooldownDuration = 950;
        this.attackDamage = 1;
        this.health = isAlly ? 120 : 100;
        this.maxHealth = this.health;
        this.trail = [];
        this.activeObstacles = [];
        this.shieldRemainingMs = 0;
        this.specialCooldownRemainingMs = 0;
        this.specialDurationMs = 1800;
        this.specialCooldownDurationMs = 9000;
    }

    applyBehaviors(target, obstacles, companions = []) {
        if (!this.isAlly) {
            this.applyMouseControl(target, obstacles);
            return;
        }

        if (target && this.vel.magSq() <= 1e-4) {
            const initialDirection = p5.Vector.sub(target, this.pos);
            if (initialDirection.magSq() > 1e-4) {
                this.lastHeading = initialDirection.heading();
            }
        }
        const arriveForce = this.arriveWithBraking(target);
        const avoidForce = calculateObstacleAvoidance(
            this,
            obstacles,
            this.detectionRadius,
            this.avoidanceSides
        );
        const separationForce = this.separateFrom(companions);
        const boundaryForce = this.steerFromBoundaries();

        const combinedForce = this.debugThreat
            ? combineSteeringWithObstaclePriority(this, avoidForce, [
                arriveForce.copy().mult(0.25),
                separationForce.copy().mult(1.8),
                boundaryForce.copy().mult(3)
            ])
            : arriveForce
                .add(avoidForce.mult(2.2))
                .add(separationForce.mult(1.8))
                .add(boundaryForce.mult(3))
                .limit(this.maxForce);
        this.lastSteer = combinedForce.copy();
        this.applyForce(combinedForce);
    }

    applyPlayerControl(direction, obstacles = []) {
        if (this.isAlly) {
            return;
        }

        this.activeObstacles = obstacles;
        const input = direction ? direction.copy().limit(1) : createVector(0, 0);
        const hasInput = input.magSq() > 0.01;

        if (hasInput) {
            const desiredVelocity = input.copy().mult(this.maxSpeed);
            const steering = p5.Vector.sub(desiredVelocity, this.vel);
            const steerLimit = Math.max(this.maxForce * 1.6, 0.45);
            const movementForce = steering.limit(steerLimit);
            movementForce.add(this.steerFromBoundaries().mult(1.5));
            this.lastSteer = movementForce.limit(this.maxForce * 1.8);
        } else {
            const desiredVelocity = createVector(0, 0);
            const braking = p5.Vector.sub(desiredVelocity, this.vel);
            const brakeLimit = Math.max(this.maxForce * 2.8, 0.75);
            this.lastSteer = braking.limit(brakeLimit);
            if (this.vel.magSq() < 0.04) {
                this.vel.set(0, 0);
                this.lastSteer.set(0, 0);
            }
        }

        this.applyForce(this.lastSteer);
    }

    applyMouseControl(target, obstacles) {
        this.acc.set(0, 0);
        const safeTarget = target || this.pos;
        const offset = p5.Vector.sub(safeTarget, this.pos);
        if (offset.magSq() > 1e-6) {
            this.lastHeading = offset.heading();
            this.vel.set(p5.Vector.fromAngle(this.lastHeading).mult(this.maxSpeed));
        } else {
            this.vel.set(0, 0);
        }

        const avoidForce = calculateObstacleAvoidance(
            this,
            obstacles,
            this.detectionRadius,
            this.avoidanceSides
        );
        const avoidanceState = this.debugThreat
            ? this.avoidanceSides.get(this.debugThreat)
            : null;
        const bypass = avoidanceState ? avoidanceState.waypoint : null;
        this.mouseMovementTarget = (bypass || safeTarget).copy();
        this.mouseMovementTarget.x = constrain(
            this.mouseMovementTarget.x,
            this.r,
            Math.max(this.r, width - this.r)
        );
        this.mouseMovementTarget.y = constrain(
            this.mouseMovementTarget.y,
            this.r,
            Math.max(this.r, height - this.r)
        );
        this.lastSteer = avoidForce.copy();
        this.acc.set(0, 0);
    }

    arriveWithBraking(target, arrivalRadius = this.rayonZoneDeFreinage) {
        if (!target) {
            return createVector(0, 0);
        }

        const desired = p5.Vector.sub(target, this.pos);
        const distance = desired.mag();
        if (distance <= 2) {
            return p5.Vector.sub(createVector(0, 0), this.vel).limit(this.maxForce);
        }

        const brakingSpeed = Math.sqrt(2 * this.maxForce * distance);
        const radiusLimitedSpeed = this.maxSpeed * Math.min(
            1,
            distance / Math.max(1, arrivalRadius)
        );
        const desiredSpeed = Math.min(
            this.maxSpeed,
            brakingSpeed,
            radiusLimitedSpeed
        );
        desired.setMag(desiredSpeed);
        return p5.Vector.sub(desired, this.vel).limit(this.maxForce);
    }

    applyAllyBehaviors(mode, target, obstacles, companions = []) {
        let behaviorForce = createVector(0, 0);
        if (mode === 'leader' && target) {
            this.allyState = 'Formation';
            behaviorForce = this.leaderFollowing(
                target,
                companions,
                obstacles,
                leaderFollowingOptions
            );
            this.lastSteer = behaviorForce.copy();
            this.applyForce(behaviorForce);
            return;
        }
        if ((mode === 'pursue' || mode === 'command') && target) {
            const targetPosition = target.pos;
            const targetVelocity = target.vel || createVector(0, 0);
            const targetDistance = this.pos.dist(targetPosition);
            const prediction = constrain(
                targetDistance / Math.max(this.maxSpeed, 0.1) * 0.25,
                0,
                5
            );
            const predictedTarget = p5.Vector.add(
                targetPosition,
                targetVelocity.copy().mult(prediction)
            );
            const approachAngle = (
                target.steeringId * 0.7548776662466927
                + (this.allyRole - 1) * TWO_PI / 4
            ) % TWO_PI;
            const fromTarget = p5.Vector.fromAngle(approachAngle);
            const attackRange = this.r + (target.r || 0) + (this.isAlly ? 8 : 0);
            const attackStandoff = Math.max(
                this.r + (target.r || 0) + 2,
                attackRange - 4
            );
            const approachPoint = predictedTarget.add(fromTarget.mult(attackStandoff));
            behaviorForce = this.arriveWithBraking(approachPoint, 48);
            this.allyState = targetDistance <= attackRange
                ? 'Attaque'
                : mode === 'command' ? 'Ordre' : 'Poursuite';
        } else if (mode === 'arrive' && target) {
            behaviorForce = this.arriveWithBraking(target);
            this.allyState = 'Ressource';
        } else {
            behaviorForce = this.wander();
            this.allyState = 'En attente';
        }

        const avoidForce = calculateObstacleAvoidance(
            this,
            obstacles,
            this.detectionRadius,
            this.avoidanceSides
        );
        const separationForce = this.separateFrom(companions);
        const boundaryForce = this.steerFromBoundaries();

        this.lastSteer = this.debugThreat
            ? combineSteeringWithObstaclePriority(this, avoidForce, [
                behaviorForce.copy().mult(0.25),
                separationForce.copy().mult(1.6),
                boundaryForce.copy().mult(2.5)
            ])
            : behaviorForce
                .add(avoidForce.mult(2.2))
                .add(separationForce.mult(1.6))
                .add(boundaryForce.mult(2.5))
                .limit(this.maxForce);
        this.applyForce(this.lastSteer);
    }

    steerFromBoundaries() {
        const margin = Math.max(90, this.vel.magSq() / (2 * Math.max(this.maxForce, 1e-4)) + this.r + 12);
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
            return desired;
        }
        const urgency = Math.min(1, desired.mag());
        desired.setMag(this.maxSpeed * urgency);
        return p5.Vector.sub(desired, this.vel).limit(this.maxForce * urgency);
    }

    separateFrom(companions) {
        const separation = createVector(0, 0);
        let neighbors = 0;
        for (const companion of companions) {
            if (companion === this) {
                continue;
            }
            const away = p5.Vector.sub(this.pos, companion.pos);
            const distance = away.mag();
            const desiredDistance = this.r + companion.r + 4;
            if (distance < desiredDistance) {
                if (distance < 1e-6) {
                    const idDifference = this.steeringId - companion.steeringId;
                    away.set(p5.Vector.fromAngle(idDifference * 2.399963229728653));
                } else {
                    away.normalize();
                }
                away.mult(constrain((desiredDistance - distance) / desiredDistance, 0, 1));
                separation.add(away);
                neighbors++;
            }
        }
        if (neighbors === 0) {
            return separation;
        }
        separation.div(neighbors);
        const strength = Math.min(1, separation.mag());
        if (strength < 1e-4) {
            return createVector(0, 0);
        }
        separation.setMag(this.maxSpeed * strength);
        return p5.Vector.sub(separation, this.vel).limit(this.maxForce);
    }

    update(elapsedMs = deltaTime) {
        super.update(elapsedMs);
        if (!this.isAlly) {
            this.resolvePlayerCollisions();
        }
        const elapsedSeconds = Math.max(0, elapsedMs) / 1000;
        this.energy = Math.max(0, this.energy - this.energyDrainPerSecond * elapsedSeconds);
        this.damageCooldown = Math.max(0, this.damageCooldown - Math.max(0, elapsedMs));
        this.attackCooldown = Math.max(0, this.attackCooldown - Math.max(0, elapsedMs));
        this.shieldRemainingMs = Math.max(0, this.shieldRemainingMs - Math.max(0, elapsedMs));
        this.specialCooldownRemainingMs = Math.max(
            0,
            this.specialCooldownRemainingMs - Math.max(0, elapsedMs)
        );
        this.pulse += Math.max(0, elapsedMs) * 0.0024;
        if (visualEffectsEnabled && !this.isAlly) {
            this.trail.push(this.pos.copy());
            if (this.trail.length > 10) {
                this.trail.shift();
            }
        }
    }

    resolvePlayerCollisions(obstacles = this.activeObstacles) {
        const minX = this.r;
        const maxX = Math.max(this.r, width - this.r);
        const minY = this.r;
        const maxY = Math.max(this.r, height - this.r);
        if (this.pos.x < minX || this.pos.x > maxX) {
            this.pos.x = constrain(this.pos.x, minX, maxX);
            this.vel.x = 0;
        }
        if (this.pos.y < minY || this.pos.y > maxY) {
            this.pos.y = constrain(this.pos.y, minY, maxY);
            this.vel.y = 0;
        }

        const obstacleList = obstacles || this.activeObstacles;
        if (!obstacleList || obstacleList.length === 0) {
            return;
        }

        for (const obstacle of obstacleList) {
            const offset = p5.Vector.sub(this.pos, obstacle.pos);
            const minimumDistance = this.r + obstacle.r;
            const distance = offset.mag();
            if (distance >= minimumDistance) {
                continue;
            }

            const normal = distance > 1e-6
                ? offset.div(distance)
                : p5.Vector.fromAngle(this.lastHeading || 0);
            this.pos.add(normal.copy().mult(minimumDistance - distance));
            const velocityIntoObstacle = this.vel.dot(normal);
            if (velocityIntoObstacle < 0) {
                this.vel.sub(normal.copy().mult(velocityIntoObstacle));
            }
        }
    }

    takeDamage(amount) {
        if (!this.isAlly && this.shieldRemainingMs > 0) {
            return false;
        }
        if (this.isAlly) {
            this.health = Math.max(0, this.health - amount);
        } else {
            this.energy = Math.max(0, this.energy - amount);
        }
        this.damageCooldown = this.damageCooldownDuration;
        return true;
    }

    activateSpecial() {
        if (this.isAlly || this.specialCooldownRemainingMs > 0) {
            return false;
        }
        this.shieldRemainingMs = this.specialDurationMs;
        this.specialCooldownRemainingMs = this.specialCooldownDurationMs;
        return true;
    }

    attackBacteria(bacteria, preferredTarget = null) {
        if (this.attackCooldown > 0) {
            return -1;
        }
        let targetIndex = -1;
        const attackReach = this.isAlly ? 14 : 26;
        if (preferredTarget) {
            targetIndex = bacteria.findIndex(bacterium =>
                bacterium === preferredTarget
                && bacterium.health > 0
                && this.pos.dist(bacterium.pos) <= this.r + bacterium.r + attackReach
            );
        } else {
            let nearestDistance = Infinity;
            for (let i = 0; i < bacteria.length; i++) {
                if (bacteria[i].health <= 0) {
                    continue;
                }
                const distance = this.pos.dist(bacteria[i].pos);
                if (distance <= this.r + bacteria[i].r + attackReach
                    && distance < nearestDistance) {
                    targetIndex = i;
                    nearestDistance = distance;
                }
            }
        }
        if (targetIndex < 0) {
            return -1;
        }
        this.attackCooldown = this.attackCooldownDuration;
        bacteria[targetIndex].health = Math.max(
            0,
            bacteria[targetIndex].health - this.attackDamage
        );
        return targetIndex;
    }

    absorbNutrient() {
        this.energy = Math.min(this.maxEnergy, this.energy + this.energyPerNutrient);
    }

    show() {
        if (!this.isAlly && visualEffectsEnabled && this.trail.length > 1) {
            push();
            noFill();
            for (let i = 1; i < this.trail.length; i++) {
                const fade = i / this.trail.length;
                stroke(86, 235, 255, 92 * fade);
                strokeWeight(2 + 5 * fade);
                line(
                    this.trail[i - 1].x, this.trail[i - 1].y,
                    this.trail[i].x, this.trail[i].y
                );
            }
            pop();
        }

        if (visualEffectsEnabled) {
            const glow = 10 + 4 * sin(this.pulse);
            push();
            noStroke();
            if (!this.isAlly && this.shieldRemainingMs > 0) {
                // Bouclier énergétique protecteur avec aura hexagonale pulsante
                fill(99, 236, 190, 45);
                circle(this.pos.x, this.pos.y, this.r * 2.8 + 8 * sin(this.pulse * 1.5));
                stroke(120, 255, 220, 190);
                strokeWeight(1.8);
                noFill();
                beginShape();
                for (let i = 0; i < 6; i++) {
                    const a = (TWO_PI * i) / 6 + this.pulse * 0.4;
                    vertex(this.pos.x + cos(a) * (this.r + 15), this.pos.y + sin(a) * (this.r + 15));
                }
                endShape(CLOSE);
            }
            noStroke();
            fill(this.isAlly ? 105 : 72, this.isAlly ? 198 : 225, 255, 30);
            circle(this.pos.x, this.pos.y, this.r * 2 + glow * 4);
            fill(this.isAlly ? 116 : 105, this.isAlly ? 220 : 238, 255, 55);
            circle(this.pos.x, this.pos.y, this.r * 2 + glow);
            pop();
        }

        push();
        translate(this.pos.x, this.pos.y);
        const heading = this.vel.magSq() < 0.04 ? 0 : this.vel.heading();
        rotate(heading);

        const allyFill = this.allyRole === 1
            ? color(111, 242, 197, 238)
            : color(164, 160, 255, 238);
        const allyStroke = this.allyRole === 1
            ? color(68, 232, 180)
            : color(157, 142, 255);

        // 1. Membrane amiboïde avec pseudopodes vivants
        fill(this.isAlly ? allyFill : color(228, 251, 255, 245));
        stroke(this.isAlly ? allyStroke : color(105, 235, 255));
        strokeWeight(2.4);
        beginShape();
        const pseudopodCount = 16;
        for (let i = 0; i < pseudopodCount; i++) {
            const angle = (TWO_PI * i) / pseudopodCount;
            const pseudopod = 1 + 0.09 * sin(angle * 3 + this.pulse * 1.2) + 0.05 * cos(angle * 5 - this.pulse);
            const rx = this.r * pseudopod * 1.05;
            const ry = this.r * pseudopod * 0.92;
            vertex(cos(angle) * rx, sin(angle) * ry);
        }
        endShape(CLOSE);

        // 2. Cytoplasme granulaire et noyau leucocytaire polylobé
        noStroke();
        fill(this.isAlly
            ? (this.allyRole === 1 ? color(25, 142, 125, 220) : color(97, 83, 175, 220))
            : color(78, 128, 218, 210));

        // Lobes du noyau (caractéristique d'un polynucléaire neutrophile/leucocyte)
        circle(-this.r * 0.22, -this.r * 0.14, this.r * 0.62);
        circle(this.r * 0.18, -this.r * 0.08, this.r * 0.54);
        circle(-this.r * 0.04, this.r * 0.22, this.r * 0.58);
        // Ponts nucléaires reliant les lobes
        stroke(this.isAlly ? color(20, 110, 95, 180) : color(65, 105, 195, 180));
        strokeWeight(this.r * 0.18);
        line(-this.r * 0.22, -this.r * 0.14, this.r * 0.18, -this.r * 0.08);
        line(this.r * 0.18, -this.r * 0.08, -this.r * 0.04, this.r * 0.22);
        noStroke();

        // 3. Vésicules cytoplasmiques et reflets spéculaires
        fill(255, 255, 255, 190);
        circle(-this.r * 0.38, -this.r * 0.28, this.r * 0.24);
        circle(this.r * 0.32, this.r * 0.22, Math.max(2, this.r * 0.14));
        circle(-this.r * 0.15, -this.r * 0.42, Math.max(2, this.r * 0.12));

        // 4. Identifiant visuel pour les alliés ou halo joueur
        if (this.isAlly) {
            fill(255, 255, 255, 240);
            textAlign(CENTER, CENTER);
            textSize(10);
            text(`A${this.allyRole}`, 0, 1);
        } else {
            // Repère discret de capteur joueur vers l'avant
            fill(120, 245, 255, 200);
            circle(this.r * 0.72, 0, 3.5);
        }
        pop();

        if (this.isAlly) {
            const barWidth = this.r * 2;
            const barY = this.pos.y - this.r - 10;
            const healthRatio = constrain(this.health / Math.max(1, this.maxHealth), 0, 1);
            push();
            noStroke();
            fill(4, 12, 28, 210);
            rect(this.pos.x - this.r, barY, barWidth, 5, 2);
            fill(healthRatio > 0.5 ? color(86, 235, 174) : color(255, 143, 111));
            rect(this.pos.x - this.r, barY, barWidth * healthRatio, 5, 2);
            fill(225, 247, 255, 230);
            textAlign(CENTER, BOTTOM);
            textSize(10);
            text(this.allyState, this.pos.x, barY - 3);
            pop();
        }

        if (Vehicle.debug) {
            push();
            noFill();
            stroke(180, 230, 255, 90);
            strokeWeight(1);
            circle(this.pos.x, this.pos.y, this.rayonZoneDeFreinage * 2);
            pop();
            this.drawDebugVectors();
        }
    }
}
