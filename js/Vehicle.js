class Vehicle {
    static debug = false;
    static nextSteeringId = 0;

    constructor(x, y) {
        this.steeringId = Vehicle.nextSteeringId++;
        this.pos = createVector(x, y);
        this.vel = createVector(0, 0);
        this.acc = createVector(0, 0);
        this.position = this.pos;
        this.velocity = this.vel;
        this.acceleration = this.acc;

        this.maxSpeed = 4;
        this.maxForce = 0.2;
        this.r = 16;
        this.rayonZoneDeFreinage = 100;
        this.lastSteer = createVector(0, 0);

        this.distanceCercle = 80;
        this.wanderRadius = 40;
        this.wanderTheta = 0;
        this.displaceRange = 0.3;

        this.detectionRadius = 120;
        this.lastHeading = 0;
        this._avoidSmoothed = createVector(0, 0);
        this.lastAvoidForce = createVector(0, 0);
        this.debugAhead = null;
        this.debugAheadMid = null;
        this.debugThreat = null;
        this.flockRadius = 100;
        this.separationRadius = this.r * 2 + 20;
        this.flockWeights = { separation: 1.5, alignment: 1, cohesion: 1 };
        this.flockNeighbors = [];
        this.separationSteering = createVector(0, 0);
        this.alignmentSteering = createVector(0, 0);
        this.cohesionSteering = createVector(0, 0);
        this.weightedFlockForces = {
            separation: createVector(0, 0),
            alignment: createVector(0, 0),
            cohesion: createVector(0, 0)
        };
        this.leaderFollowingDebug = {
            target: this.pos.copy(),
            arrive: createVector(0, 0),
            separation: createVector(0, 0),
            leaderAvoidance: createVector(0, 0),
            collisionAvoidance: createVector(0, 0),
            obstacleAvoidance: createVector(0, 0),
            boundary: createVector(0, 0),
            weights: { arrive: 1, separation: 1.5, obstacle: 2.5, leaderAvoidance: 2 }
        };
    }

    applyForce(force) {
        if (!force) {
            return;
        }
        this.acc.add(force);
    }

    update() {
        this.vel.add(this.acc);
        this.vel.limit(this.maxSpeed);
        this.pos.add(this.vel);
        this.acc.set(0, 0);
        this.edges();
    }

    edges() {
        const m = this.r;
        if (this.pos.x > width + m) {
            this.pos.x = -m;
        } else if (this.pos.x < -m) {
            this.pos.x = width + m;
        }
        if (this.pos.y > height + m) {
            this.pos.y = -m;
        } else if (this.pos.y < -m) {
            this.pos.y = height + m;
        }
    }

    seek(target) {
        if (!target) {
            return createVector(0, 0);
        }

        const desired = p5.Vector.sub(target, this.pos);
        if (desired.magSq() < 1e-6) {
            return createVector(0, 0);
        }

        desired.setMag(this.maxSpeed);
        const steer = p5.Vector.sub(desired, this.vel);
        steer.limit(this.maxForce);
        return steer;
    }

    flee(target) {
        const force = this.seek(target);
        force.mult(-1);
        return force;
    }

    arrive(target) {
        if (!target) {
            return createVector(0, 0);
        }

        const desired = p5.Vector.sub(target, this.pos);
        const distance = desired.mag();
        if (distance < 1e-6) {
            return createVector(0, 0);
        }

        let speed = this.maxSpeed;
        if (distance < this.rayonZoneDeFreinage) {
            speed = map(distance, 0, this.rayonZoneDeFreinage, 0, this.maxSpeed);
        }

        desired.setMag(speed);
        const steer = p5.Vector.sub(desired, this.vel);
        steer.limit(this.maxForce);
        return steer;
    }

    wander() {
        const heading = this.vel.magSq() < 1e-6 ? 0 : this.vel.heading();
        const circleCenter = p5.Vector.fromAngle(heading);
        circleCenter.setMag(this.distanceCercle);
        circleCenter.add(this.pos);

        const theta = this.wanderTheta + heading;
        const wanderTarget = createVector(
            this.wanderRadius * cos(theta),
            this.wanderRadius * sin(theta)
        );
        wanderTarget.add(circleCenter);

        this.wanderTheta += random(-this.displaceRange, this.displaceRange);

        return this.seek(wanderTarget);
    }

    separation(neighbors = [], perceptionRadius = this.flockRadius) {
        const steering = createVector(0, 0);
        let count = 0;
        const separationRadius = Math.min(
            perceptionRadius,
            this.separationRadius || this.r * 2 + 20
        );

        for (const neighbor of neighbors) {
            if (!neighbor || neighbor === this || neighbor.active === false) {
                continue;
            }

            const offset = p5.Vector.sub(this.pos, neighbor.pos);
            const distance = offset.mag();
            if (distance >= separationRadius) {
                continue;
            }

            if (distance < 1e-6) {
                const idDifference = this.steeringId - (neighbor.steeringId || 0);
                offset.set(p5.Vector.fromAngle(idDifference * 2.399963229728653));
            } else {
                offset.div(distance * distance);
            }
            steering.add(offset);
            count++;
        }

        if (count === 0 || steering.magSq() < 1e-8) {
            return createVector(0, 0);
        }

        steering.div(count).setMag(this.maxSpeed);
        return p5.Vector.sub(steering, this.vel).limit(this.maxForce);
    }

    alignment(neighbors = [], perceptionRadius = this.flockRadius) {
        const averageVelocity = createVector(0, 0);
        let count = 0;

        for (const neighbor of neighbors) {
            if (!neighbor || neighbor === this || neighbor.active === false
                || this.pos.dist(neighbor.pos) > perceptionRadius) {
                continue;
            }
            averageVelocity.add(neighbor.vel);
            count++;
        }

        if (count === 0 || averageVelocity.magSq() < 1e-8) {
            return createVector(0, 0);
        }

        averageVelocity.div(count).setMag(this.maxSpeed);
        return p5.Vector.sub(averageVelocity, this.vel).limit(this.maxForce);
    }

    cohesion(neighbors = [], perceptionRadius = this.flockRadius) {
        const center = createVector(0, 0);
        let count = 0;

        for (const neighbor of neighbors) {
            if (!neighbor || neighbor === this || neighbor.active === false
                || this.pos.dist(neighbor.pos) > perceptionRadius) {
                continue;
            }
            center.add(neighbor.pos);
            count++;
        }

        if (count === 0) {
            return createVector(0, 0);
        }

        center.div(count);
        return this.seek(center);
    }

    flock(neighbors = [], weights = this.flockWeights, perceptionRadius = this.flockRadius) {
        this.flockNeighbors = neighbors.filter(neighbor =>
            neighbor && neighbor !== this && neighbor.active !== false
            && this.pos.dist(neighbor.pos) <= perceptionRadius
        );
        this.separationSteering = this.separation(this.flockNeighbors, perceptionRadius);
        this.alignmentSteering = this.alignment(this.flockNeighbors, perceptionRadius);
        this.cohesionSteering = this.cohesion(this.flockNeighbors, perceptionRadius);
        this.flockWeights = {
            separation: weights.separation,
            alignment: weights.alignment,
            cohesion: weights.cohesion
        };
        this.weightedFlockForces = {
            separation: this.separationSteering.copy().mult(this.flockWeights.separation),
            alignment: this.alignmentSteering.copy().mult(this.flockWeights.alignment),
            cohesion: this.cohesionSteering.copy().mult(this.flockWeights.cohesion)
        };

        return this.weightedFlockForces.separation.copy()
            .add(this.weightedFlockForces.alignment)
            .add(this.weightedFlockForces.cohesion)
            .limit(this.maxForce);
    }

    showFlockDebug(options = {}) {
        if (!options.neighbors && !options.separation && !options.alignment
            && !options.cohesion && !options.weights) {
            return;
        }

        push();
        if (options.neighbors) {
            noFill();
            stroke(255, 255, 255, 70);
            circle(this.pos.x, this.pos.y, this.flockRadius * 2);
            for (const neighbor of this.flockNeighbors) {
                stroke(255, 255, 255, 90);
                line(this.pos.x, this.pos.y, neighbor.pos.x, neighbor.pos.y);
                noStroke();
                fill(255, 255, 255, 100);
                circle(neighbor.pos.x, neighbor.pos.y, 5);
            }
        }
        if (options.separation) {
            this.drawVector(this.pos, this.separationSteering.copy().mult(75), color(255, 90, 90));
        }
        if (options.alignment) {
            this.drawVector(this.pos, this.alignmentSteering.copy().mult(75), color(100, 220, 255));
        }
        if (options.cohesion) {
            this.drawVector(this.pos, this.cohesionSteering.copy().mult(75), color(150, 255, 140));
        }
        if (options.weights) {
            noStroke();
            fill(255, 245, 220, 220);
            textSize(10);
            textAlign(CENTER, BOTTOM);
            text(
                `S ${this.flockWeights.separation.toFixed(1)} · A ${this.flockWeights.alignment.toFixed(1)} · C ${this.flockWeights.cohesion.toFixed(1)}`,
                this.pos.x,
                this.pos.y - this.r - 5
            );
        }
        pop();
    }

    leaderFollowing(leader, followers = [], obstacles = [], options = {}) {
        if (!leader || leader.active === false) {
            this.lastSteer.set(0, 0);
            return this.lastSteer.copy();
        }

        const settings = {
            followDistance: 70,
            separationRadius: this.separationRadius,
            frontZoneLength: 55,
            frontZoneRadius: 46,
            arriveWeight: 1,
            separationWeight: 1.5,
            obstacleWeight: 2.5,
            leaderAvoidanceWeight: 2,
            collisionAvoidanceWeight: 2.5,
            ...options
        };
        const forward = leader.vel.magSq() > 1e-4
            ? leader.vel.copy().normalize()
            : p5.Vector.fromAngle(leader.lastHeading || 0);
        if (leader.vel.magSq() > 1e-4) {
            leader.lastHeading = forward.heading();
        }

        const target = leader.pos.copy().sub(
            forward.copy().mult(settings.followDistance + leader.r + this.r * 0.35)
        );
        const arriveForce = this.arrive(target).mult(settings.arriveWeight);
        const nearbyVehicles = followers.includes(leader)
            ? followers
            : [leader, ...followers];
        const separationForce = this.separation(nearbyVehicles, settings.separationRadius)
            .mult(settings.separationWeight);
        const leaderAvoidanceForce = this.avoidLeaderFrontZone(
            leader,
            forward,
            settings.frontZoneLength,
            settings.frontZoneRadius
        );
        const collisionAvoidanceForce = this.avoidPredictedFormationCollisions(
            nearbyVehicles,
            settings.collisionAvoidanceHorizon || 48
        );
        const obstacleAvoidanceForce = this.calculateBufferedObstacleAvoidance(
            obstacles,
            this.obstacleSafetyMargin || 0
        );
        const boundaryForce = this.steerFromArenaBounds(
            this.arenaRightBoundary || width
        );

        this.leaderFollowingDebug = {
            target: target.copy(),
            arrive: arriveForce.copy(),
            separation: separationForce.copy(),
            leaderAvoidance: leaderAvoidanceForce.copy(),
            collisionAvoidance: collisionAvoidanceForce.copy(),
            obstacleAvoidance: obstacleAvoidanceForce.copy(),
            boundary: boundaryForce.copy(),
            weights: {
                arrive: settings.arriveWeight,
                separation: settings.separationWeight,
                obstacle: settings.obstacleWeight,
                leaderAvoidance: settings.leaderAvoidanceWeight,
                collisionAvoidance: settings.collisionAvoidanceWeight
            }
        };

        let combinedForce;
        if (this.debugThreat) {
            combinedForce = obstacleAvoidanceForce.copy()
                .mult(settings.obstacleWeight * 1.5)
                .add(boundaryForce.copy().mult(2.5))
                .add(collisionAvoidanceForce.copy().mult(settings.collisionAvoidanceWeight))
                .add(separationForce);
        } else if (boundaryForce.magSq() > 1e-6) {
            combinedForce = boundaryForce.copy()
                .mult(3)
                .add(obstacleAvoidanceForce.copy().mult(settings.obstacleWeight))
                .add(separationForce)
                .add(collisionAvoidanceForce.copy().mult(settings.collisionAvoidanceWeight))
                .add(arriveForce.mult(0.15));
        } else if (leaderAvoidanceForce.magSq() > 1e-6) {
            combinedForce = leaderAvoidanceForce.copy()
                .mult(settings.leaderAvoidanceWeight)
                .add(arriveForce.mult(0.25))
                .add(separationForce)
                .add(collisionAvoidanceForce.copy().mult(settings.collisionAvoidanceWeight))
                .add(boundaryForce.copy().mult(1.5));
        } else if (collisionAvoidanceForce.magSq() > 1e-6) {
            combinedForce = collisionAvoidanceForce.copy()
                .mult(settings.collisionAvoidanceWeight)
                .add(separationForce)
                .add(arriveForce.mult(0.2))
                .add(boundaryForce.copy().mult(1.5));
        } else {
            combinedForce = arriveForce
                .add(separationForce)
                .add(obstacleAvoidanceForce.copy().mult(settings.obstacleWeight))
                .add(boundaryForce.copy().mult(2));
        }

        this.lastSteer = combinedForce.limit(this.maxForce).copy();
        return this.lastSteer.copy();
    }

    calculateBufferedObstacleAvoidance(obstacles, safetyMargin = 0) {
        if (safetyMargin <= 0) {
            return calculateObstacleAvoidance(
                this,
                obstacles,
                this.detectionRadius,
                this.avoidanceSides || (this.avoidanceSides = new Map())
            );
        }

        const bufferedVehicle = Object.create(this);
        bufferedVehicle.r = this.r + safetyMargin;
        bufferedVehicle.avoidanceSides = this.avoidanceSides || (this.avoidanceSides = new Map());
        const steering = calculateObstacleAvoidance(
            bufferedVehicle,
            obstacles,
            this.detectionRadius,
            bufferedVehicle.avoidanceSides
        );
        let nearestObstacle = null;
        let nearestDistance = Infinity;
        for (const obstacle of obstacles || []) {
            const distance = this.pos.dist(obstacle.pos);
            const safeDistance = this.r + obstacle.r + safetyMargin;
            const detectionDistance = safeDistance + 70;
            if (distance >= detectionDistance || distance >= nearestDistance) {
                continue;
            }

            nearestObstacle = obstacle;
            nearestDistance = distance;
        }

        if (nearestObstacle) {
            const safeDistance = this.r + nearestObstacle.r + safetyMargin;
            const detectionDistance = safeDistance + 70;
            const away = p5.Vector.sub(this.pos, nearestObstacle.pos);
            if (away.magSq() < 1e-6) {
                away.set(p5.Vector.fromAngle(this.steeringId * 2.399963229728653));
            } else {
                away.normalize();
            }
            const desired = away.setMag(this.maxSpeed);
            const urgency = constrain(
                (detectionDistance - nearestDistance) / 70,
                0,
                1
            );
            const proximitySteering = p5.Vector.sub(desired, this.vel)
                .limit(this.maxForce * urgency);
            steering.add(proximitySteering).limit(this.maxForce);
            if (!bufferedVehicle.debugThreat) {
                bufferedVehicle.debugThreat = nearestObstacle;
            }
        }

        bufferedVehicle.lastAvoidForce = steering.copy();
        this.debugAhead = bufferedVehicle.debugAhead;
        this.debugAheadMid = bufferedVehicle.debugAheadMid;
        this.debugThreat = bufferedVehicle.debugThreat;
        this.lastHeading = bufferedVehicle.lastHeading;
        this.lastAvoidForce = bufferedVehicle.lastAvoidForce;
        return steering;
    }

    avoidLeaderFrontZone(leader, forward, zoneLength, zoneRadius) {
        const offset = p5.Vector.sub(this.pos, leader.pos);
        const along = offset.dot(forward);
        const right = p5.Vector.fromAngle(forward.heading() + HALF_PI);
        const lateral = offset.dot(right);
        const zoneStart = Math.max(this.r, leader.r * 0.5);

        if (along <= zoneStart || along >= zoneStart + zoneLength
            || Math.abs(lateral) >= zoneRadius + this.r) {
            return createVector(0, 0);
        }

        const side = Math.abs(lateral) > 1
            ? Math.sign(lateral)
            : (this.steeringId % 2 === 0 ? 1 : -1);
        const desired = forward.copy().mult(0.25).add(right.mult(side));
        desired.setMag(this.maxSpeed);
        const urgency = constrain(
            1 - (along - zoneStart) / zoneLength,
            0.35,
            1
        );
        return p5.Vector.sub(desired, this.vel)
            .limit(this.maxForce * urgency);
    }

    avoidPredictedFormationCollisions(neighbors, predictionHorizon) {
        let strongestAvoidance = createVector(0, 0);
        let closestPredictedDistance = Infinity;

        for (const neighbor of neighbors) {
            if (!neighbor || neighbor === this || neighbor.active === false) {
                continue;
            }

            const relativePosition = p5.Vector.sub(this.pos, neighbor.pos);
            const relativeVelocity = p5.Vector.sub(this.vel, neighbor.vel);
            const relativeSpeedSq = relativeVelocity.magSq();
            if (relativeSpeedSq < 1e-6 || relativePosition.dot(relativeVelocity) >= 0) {
                continue;
            }

            const timeToClosest = -relativePosition.dot(relativeVelocity) / relativeSpeedSq;
            if (timeToClosest <= 0 || timeToClosest > predictionHorizon) {
                continue;
            }

            const closestOffset = relativePosition.add(
                relativeVelocity.mult(timeToClosest)
            );
            const predictedDistance = closestOffset.mag();
            const safeDistance = this.r + neighbor.r + 40;
            if (predictedDistance >= safeDistance
                || predictedDistance >= closestPredictedDistance) {
                continue;
            }

            closestPredictedDistance = predictedDistance;
            if (closestOffset.magSq() < 1e-6) {
                const side = this.steeringId < neighbor.steeringId ? 1 : -1;
                closestOffset.set(relativeVelocity.heading() + HALF_PI);
                closestOffset.mult(side);
            } else {
                closestOffset.normalize();
            }

            const desired = closestOffset.setMag(this.maxSpeed);
            const urgency = constrain(
                1 - predictedDistance / safeDistance,
                0.35,
                1
            );
            strongestAvoidance = p5.Vector.sub(desired, this.vel)
                .limit(this.maxForce * urgency);
        }

        return strongestAvoidance;
    }

    steerFromArenaBounds(rightBoundary = width) {
        const brakingDistance = this.vel.magSq() / (2 * Math.max(this.maxForce, 1e-4));
        const margin = Math.min(
            Math.max(110, brakingDistance * 2.5 + this.r + 30),
            Math.max(this.r + 8, Math.min(width, height) * 0.4)
        );
        const desired = createVector(0, 0);

        if (this.pos.x < margin) {
            desired.x = 1;
        } else if (this.pos.x > rightBoundary - margin) {
            desired.x = -1;
        }
        if (this.pos.y < margin) {
            desired.y = 1;
        } else if (this.pos.y > height - margin) {
            desired.y = -1;
        }
        if (desired.magSq() < 1e-6) {
            return createVector(0, 0);
        }

        desired.setMag(this.maxSpeed);
        return p5.Vector.sub(desired, this.vel).limit(this.maxForce);
    }

    showLeaderFollowingDebug(leader, options = {}) {
        if (!leader || leader.active === false || !options.enabled) {
            return;
        }

        if (options.showLeaderGeometry) {
            const forward = leader.vel.magSq() > 1e-4
                ? leader.vel.copy().normalize()
                : p5.Vector.fromAngle(leader.lastHeading || 0);
            const zoneCenter = p5.Vector.add(
                leader.pos,
                forward.copy().mult(leader.r + options.frontZoneLength * 0.5)
            );

            push();
            noFill();
            stroke(255, 205, 95, 120);
            strokeWeight(1.5);
            translate(zoneCenter.x, zoneCenter.y);
            rotate(forward.heading());
            ellipse(0, 0, options.frontZoneLength, options.frontZoneRadius * 2);
            pop();

            this.drawVector(leader.pos, forward.copy().mult(50), color(255, 220, 125));
        }
        stroke(120, 245, 255, 150);
        strokeWeight(1);
        line(this.pos.x, this.pos.y,
            this.leaderFollowingDebug.target.x, this.leaderFollowingDebug.target.y);
        noStroke();
        fill(120, 245, 255, 210);
        circle(this.leaderFollowingDebug.target.x, this.leaderFollowingDebug.target.y, 8);

        this.drawVector(this.pos, this.leaderFollowingDebug.arrive.copy().mult(80), color(115, 230, 255));
        this.drawVector(this.pos, this.leaderFollowingDebug.separation.copy().mult(80), color(255, 100, 115));
        this.drawVector(this.pos, this.leaderFollowingDebug.leaderAvoidance.copy().mult(80), color(255, 220, 100));
        this.drawVector(this.pos, this.leaderFollowingDebug.collisionAvoidance.copy().mult(80), color(220, 135, 255));
        this.drawVector(this.pos, this.leaderFollowingDebug.obstacleAvoidance.copy().mult(80), color(255, 160, 75));
        this.drawVector(this.pos, this.lastSteer.copy().mult(100), color(245, 245, 255));

        noStroke();
        fill(255, 245, 220, 220);
        textSize(10);
        textAlign(CENTER, BOTTOM);
        const { arrive, separation, obstacle, leaderAvoidance, collisionAvoidance } =
            this.leaderFollowingDebug.weights;
        text(
            `A ${arrive.toFixed(1)} · S ${separation.toFixed(1)} · O ${obstacle.toFixed(1)} · L ${leaderAvoidance.toFixed(1)} · P ${collisionAvoidance.toFixed(1)}`,
            this.pos.x,
            this.pos.y - this.r - 5
        );
    }

    closestPointOnSegment(point, a, b) {
        const ab = p5.Vector.sub(b, a);
        const lengthSq = ab.magSq();
        if (lengthSq < 1e-6) {
            return a.copy();
        }
        const t = constrain(p5.Vector.sub(point, a).dot(ab) / lengthSq, 0, 1);
        return p5.Vector.add(a, ab.mult(t));
    }

    avoidObstacles(obstacles) {
        this.debugAhead = null;
        this.debugAheadMid = null;
        this.debugThreat = null;

        if (!this._avoidSmoothed) {
            this._avoidSmoothed = createVector(0, 0);
        }

        if (!obstacles || obstacles.length === 0) {
            this._avoidSmoothed.lerp(createVector(0, 0), 0.3);
            this.lastAvoidForce = this._avoidSmoothed.copy();
            return this.lastAvoidForce.copy();
        }

        if (this.vel.magSq() > 0.04) {
            this.lastHeading = this.vel.heading();
        }

        const heading = this.lastHeading || 0;
        const look = p5.Vector.fromAngle(heading).setMag(this.detectionRadius);
        const aheadEnd = p5.Vector.add(this.pos, look);
        const aheadMid = p5.Vector.add(this.pos, p5.Vector.mult(look, 0.5));
        this.debugAhead = aheadEnd;
        this.debugAheadMid = aheadMid;

        let threat = null;
        let threatPoint = null;
        let threatAlong = Infinity;

        for (let i = 0; i < obstacles.length; i++) {
            const obstacle = obstacles[i];
            const closest = this.closestPointOnSegment(obstacle.pos, this.pos, aheadEnd);
            const dist = p5.Vector.dist(closest, obstacle.pos);
            const clearance = obstacle.r + this.r;
            if (dist < clearance) {
                const along = p5.Vector.dist(this.pos, closest);
                if (along < threatAlong) {
                    threatAlong = along;
                    threat = obstacle;
                    threatPoint = closest;
                }
            }
        }

        this.debugThreat = threat;

        let steer = createVector(0, 0);
        if (threat && threatPoint) {
            let desired = p5.Vector.sub(threatPoint, threat.pos);
            if (desired.magSq() < 1e-6) {
                desired = p5.Vector.fromAngle(heading + HALF_PI);
            }
            desired.setMag(this.maxSpeed);
            steer = p5.Vector.sub(desired, this.vel);
            const range = this.detectionRadius + threat.r;
            const urgency = constrain(
                map(this.pos.dist(threat.pos), threat.r + this.r, range, 1, 0.3),
                0.3,
                1
            );
            steer.limit(this.maxForce * urgency);
        }

        this._avoidSmoothed.lerp(steer, 0.35);
        this._avoidSmoothed.limit(this.maxForce);
        this.lastAvoidForce = this._avoidSmoothed.copy();
        return this.lastAvoidForce.copy();
    }

    show() {
        push();
        translate(this.pos.x, this.pos.y);
        const heading = this.vel.magSq() < 0.04 ? 0 : this.vel.heading();
        rotate(heading);
        fill(220);
        stroke(255);
        strokeWeight(1);
        triangle(-this.r, -this.r / 2, -this.r, this.r / 2, this.r, 0);
        pop();
    }

    drawDebugVectors() {
        if (!Vehicle.debug) {
            return;
        }

        this.drawVector(this.pos, this.vel.copy().mult(12), color(80, 220, 255));
        this.drawVector(this.pos, this.lastSteer.copy().mult(80), color(255, 80, 180));
        this.drawAvoidDebug();
    }

    drawAvoidDebug() {
        if (!Vehicle.debug) {
            return;
        }

        if (this.debugAhead) {
            push();
            stroke(255, 210, 120, 50);
            strokeWeight(this.r * 2);
            strokeCap(ROUND);
            line(this.pos.x, this.pos.y, this.debugAhead.x, this.debugAhead.y);
            pop();

            push();
            stroke(255, 220, 140, 180);
            strokeWeight(2);
            line(this.pos.x, this.pos.y, this.debugAhead.x, this.debugAhead.y);
            fill(255, 90, 90);
            noStroke();
            circle(this.debugAhead.x, this.debugAhead.y, 10);
            if (this.debugAheadMid) {
                fill(140, 210, 255);
                circle(this.debugAheadMid.x, this.debugAheadMid.y, 8);
            }
            pop();
        }

        if (this.debugThreat) {
            push();
            noFill();
            stroke(255, 180, 90, 200);
            strokeWeight(2);
            circle(this.debugThreat.pos.x, this.debugThreat.pos.y, this.debugThreat.r * 2 + 8);
            pop();
        }

        this.drawVector(this.pos, this.lastAvoidForce.copy().mult(90), color(255, 210, 80));
    }

    drawVector(origin, vec, col) {
        if (vec.magSq() < 1e-6) {
            return;
        }
        push();
        stroke(col);
        fill(col);
        strokeWeight(2);
        const end = p5.Vector.add(origin, vec);
        line(origin.x, origin.y, end.x, end.y);
        translate(end.x, end.y);
        rotate(vec.heading());
        const arrow = 6;
        triangle(0, arrow / 2, 0, -arrow / 2, arrow, 0);
        pop();
    }
}
