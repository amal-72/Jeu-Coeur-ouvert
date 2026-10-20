class LeaderFollowingAgent extends Vehicle {
    constructor(x, y, role, index = 0) {
        super(x, y);
        this.role = role;
        this.index = index;
        this.r = role === 'leader' ? 19 : 14;
        this.maxSpeed = role === 'leader' ? 1.1 : 1.3;
        this.maxForce = 0.25;
        this.displaceRange = 0.05;
        this.detectionRadius = 280;
        this.separationRadius = 190;
        this.obstacleSafetyMargin = 10;
        this.rayonZoneDeFreinage = 90;
        this.displaceRange = 0.08;
        this.avoidanceSides = new Map();
        this.active = true;
        this.headingColor = role === 'leader'
            ? color(255, 207, 101)
            : color(117, 225, 244);
    }

    show() {
        push();
        translate(this.pos.x, this.pos.y);
        const heading = this.vel.magSq() < 1e-4
            ? this.lastHeading
            : this.vel.heading();
        rotate(heading);
        noStroke();
        if (visualEffectsEnabled) {
            fill(this.role === 'leader' ? color(255, 207, 101, 45) : color(117, 225, 244, 38));
            circle(0, 0, this.r * 2 + 12);
        }
        fill(this.role === 'leader' ? color(238, 157, 65) : color(83, 181, 205));
        stroke(this.role === 'leader' ? color(255, 235, 170) : color(177, 246, 255));
        strokeWeight(2);
        ellipse(0, 0, this.r * 2, this.r * 1.55);
        noStroke();
        fill(this.role === 'leader' ? color(120, 63, 44) : color(35, 95, 116));
        ellipse(1, 0, this.r * 0.8, this.r * 0.64);
        fill(255, 255, 255, 220);
        triangle(this.r * 0.72, -4, this.r * 1.25, 0, this.r * 0.72, 4);
        pop();

        noStroke();
        fill(this.role === 'leader' ? color(255, 229, 161) : color(197, 246, 255));
        textSize(10);
        textAlign(CENTER, BOTTOM);
        text(this.role === 'leader' ? 'LEADER' : `SUIVEUR ${this.index}`, this.pos.x, this.pos.y - this.r - 5);
    }
}

class LeaderFollowingDemo {
    constructor(settings) {
        this.settings = settings;
        this.enabled = false;
        this.leader = null;
        this.followers = [];
        this.status = '';
        this.lastLeaderId = null;
    }

    setEnabled(enabled, obstacles, avoidEntities = []) {
        if (!enabled) {
            if (this.leader) {
                this.leader.active = false;
            }
            for (const follower of this.followers) {
                follower.active = false;
            }
            this.enabled = false;
            this.leader = null;
            this.followers = [];
            this.status = 'Démonstration Leader Following désactivée.';
            return true;
        }

        if (this.enabled && this.leader && this.leader.active !== false) {
            return true;
        }

        const formation = this.createFormation(obstacles, avoidEntities);
        if (!formation) {
            this.enabled = false;
            this.leader = null;
            this.followers = [];
            this.status = 'Espace insuffisant pour placer la formation.';
            return false;
        }

        this.leader = formation.leader;
        this.followers = formation.followers;
        this.lastLeaderId = this.leader.steeringId;
        this.enabled = true;
        this.status = 'Leader actif · 3 suiveurs';
        return true;
    }

    createFormation(obstacles, avoidEntities) {
        const leader = new LeaderFollowingAgent(0, 0, 'leader');
        const followers = Array.from(
            { length: 3 },
            (_, index) => new LeaderFollowingAgent(0, 0, 'follower', index + 1)
        );
        const formation = [leader, ...followers];
        const tries = 800;
        const centerX = width * 0.62;
        const centerY = height * 0.66;
        const panel = document.getElementById('ui');
        const panelLeft = panel ? panel.getBoundingClientRect().left : width;
        const rightBoundary = Math.min(width, panelLeft - 130);

        for (let attempt = 0; attempt < tries; attempt++) {
            const angle = random(TWO_PI);
            const forward = p5.Vector.fromAngle(angle);
            const right = p5.Vector.fromAngle(angle + HALF_PI);
            const anchor = attempt < 500
                ? createVector(
                    random(width * 0.15, width * 0.85),
                    random(height * 0.38, height * 0.88)
                )
                : createVector(
                    centerX + random(-width * 0.3, width * 0.3),
                    centerY + random(-height * 0.25, height * 0.25)
                );
            const followDistance = this.settings.followDistance;
            const offsets = [
                createVector(0, 0),
                forward.copy().mult(-(followDistance + 23)).add(right.copy().mult(29)),
                forward.copy().mult(-(followDistance + 23)).sub(right.copy().mult(29)),
                forward.copy().mult(-(followDistance + 70))
            ];
            const positions = offsets.map(offset => p5.Vector.add(anchor, offset));

            if (!this.isFormationPositionSafe(
                positions,
                formation,
                obstacles,
                avoidEntities,
                rightBoundary
            )) {
                continue;
            }

            for (let i = 0; i < formation.length; i++) {
                formation[i].pos.set(positions[i]);
                formation[i].vel.set(forward.copy().mult(i === 0 ? 1.2 : 0));
                formation[i].lastHeading = angle;
                formation[i].arenaRightBoundary = rightBoundary;
            }
            return { leader, followers };
        }

        return null;
    }

    isFormationPositionSafe(positions, formation, obstacles, avoidEntities, rightBoundary) {
        for (let i = 0; i < positions.length; i++) {
            const position = positions[i];
            const vehicle = formation[i];
            if (position.x < vehicle.r + 12 || position.x > rightBoundary - vehicle.r - 12
                || position.y < vehicle.r + 12 || position.y > height - vehicle.r - 12) {
                return false;
            }

            for (const obstacle of obstacles) {
                if (position.dist(obstacle.pos) < vehicle.r + obstacle.r + 24) {
                    return false;
                }
            }
            for (const entity of avoidEntities) {
                if (entity && entity.active !== false
                    && position.dist(entity.pos) < vehicle.r + entity.r + 28) {
                    return false;
                }
            }
            for (let otherIndex = 0; otherIndex < i; otherIndex++) {
                if (position.dist(positions[otherIndex])
                    < vehicle.r + formation[otherIndex].r + 14) {
                    return false;
                }
            }
        }
        return true;
    }

    update(obstacles, elapsedMs = deltaTime) {
        if (!this.enabled) {
            return;
        }
        this.ensureLeader();
        if (!this.leader) {
            this.status = 'Aucun véhicule actif pour reprendre le rôle de leader.';
            return;
        }

        const avoidance = this.leader.calculateBufferedObstacleAvoidance(
            obstacles,
            this.leader.obstacleSafetyMargin
        );
        const boundary = this.leader.steerFromArenaBounds(
            this.leader.arenaRightBoundary || width
        );
        const wander = this.leader.wander();
        let leaderSteering;
        if (this.leader.debugThreat && boundary.magSq() > 1e-6) {
            leaderSteering = avoidance.copy().mult(3)
                .add(boundary.mult(2.5));
        } else if (this.leader.debugThreat) {
            leaderSteering = avoidance.copy().mult(3);
        } else if (boundary.magSq() > 1e-6) {
            leaderSteering = boundary.copy().mult(3)
                .add(avoidance.mult(2.5))
                .add(wander.mult(0.15));
        } else {
            leaderSteering = wander
                .add(avoidance.mult(2.5))
                .add(boundary.mult(2));
        }
        this.leader.lastSteer = leaderSteering.limit(this.leader.maxForce).copy();
        this.leader.applyForce(this.leader.lastSteer);

        for (const follower of this.followers) {
            const steering = follower.leaderFollowing(
                this.leader,
                this.followers,
                obstacles,
                this.settings
            );
            follower.applyForce(steering);
        }

        this.leader.update(elapsedMs);
        for (const follower of this.followers) {
            follower.update(elapsedMs);
        }
    }

    ensureLeader() {
        if (this.leader && this.leader.active !== false) {
            this.followers = this.followers.filter(follower => follower.active !== false);
            return;
        }

        const nextLeader = this.followers.find(follower => follower.active !== false);
        if (!nextLeader) {
            this.leader = null;
            this.followers = [];
            this.enabled = false;
            return;
        }

        this.followers = this.followers.filter(follower =>
            follower !== nextLeader && follower.active !== false
        );
        nextLeader.role = 'leader';
        nextLeader.index = 0;
        nextLeader.r = 19;
        nextLeader.maxSpeed = 1.1;
        nextLeader.detectionRadius = 280;
        this.leader = nextLeader;
        this.lastLeaderId = nextLeader.steeringId;
        this.status = `Nouveau leader choisi · ${this.followers.length} suiveurs`;
    }

    show(debugEnabled = false) {
        if (!this.enabled) {
            return;
        }

        if (this.leader && this.leader.active !== false) {
            this.leader.show();
            push();
            noFill();
            stroke(255, 212, 113, 220);
            strokeWeight(2);
            circle(this.leader.pos.x, this.leader.pos.y, this.leader.r * 2 + 12);
            noStroke();
            fill(255, 222, 141);
            textAlign(CENTER, CENTER);
            textSize(10);
            text('LEADER', this.leader.pos.x, this.leader.pos.y - this.leader.r - 15);
            pop();
        }
        for (const follower of this.followers) {
            follower.show();
        }

        if (!debugEnabled || !this.leader || this.followers.length === 0) {
            return;
        }
        this.followers.forEach((follower, index) => {
            follower.showLeaderFollowingDebug(this.leader, {
                enabled: true,
                showLeaderGeometry: index === 0,
                frontZoneLength: this.settings.frontZoneLength,
                frontZoneRadius: this.settings.frontZoneRadius
            });
        });
    }
}
