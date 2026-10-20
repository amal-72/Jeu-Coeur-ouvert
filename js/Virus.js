/**
 * Virus.js — Prédateur viral autonome de l'arène
 * Projet CŒUR OUVERT
 *
 * Règles :
 * - Étend impérativement Vehicle (Craig Reynolds)
 * - Navigation par forces vectorielles (applyForce)
 * - Comportement de poursuite prédictive (Pursue)
 * - Ciblage multi-cibles adaptatif : peut cibler le joueur ou les globules blancs alliés
 * - Sélection par distance et accessibilité (obstacles masquants) avec hystérésis anti-oscillation
 */

class Virus extends Vehicle {
    constructor(x, y, speed = 2.65) {
        super(x, y);
        this.r = 19;
        this.maxSpeed = speed;
        this.maxForce = 0.11;
        this.vel = p5.Vector.fromAngle(random(TWO_PI)).setMag(this.maxSpeed * 0.45);
        this.velocity = this.vel;
        this.avoidanceSides = new Map();
        this.pulse = random(TWO_PI);
        this.target = null;
        this.targetSwitchCooldown = 0; // Hystérésis temporelle pour éviter tout sautillement de cible
    }

    /**
     * Sélectionne la cible la plus pertinente parmi les globules blancs (joueur et alliés vivants).
     * Prend en compte la distance euclidienne, l'accessibilité topologique (obstacles intermédiaires)
     * et applique une hystérésis (seuil de gain + délai de rétention) pour une trajectoire stable.
     */
    selectTarget(candidateTargets = [], obstacles = [], deltaMs = 16) {
        this.targetSwitchCooldown = Math.max(0, this.targetSwitchCooldown - Math.max(0, deltaMs));

        // Filtrer les globules blancs vivants et valides
        const aliveTargets = (candidateTargets || []).filter(t => t && (t.health === undefined || t.health > 0));
        if (aliveTargets.length === 0) {
            this.target = null;
            return null;
        }

        // Si la cible actuelle a été éliminée ou n'est plus dans la liste, réinitialisation immédiate
        if (this.target && !aliveTargets.includes(this.target)) {
            this.target = null;
        }

        // Évaluation du coût d'approche pour chaque cible
        let bestTarget = null;
        let bestCost = Infinity;

        for (const candidate of aliveTargets) {
            const dist = this.pos.dist(candidate.pos);
            let obstaclePenalty = 0;

            // Détection d'obstacles masquants sur le segment de visée directe
            if (obstacles && obstacles.length > 0) {
                for (const obs of obstacles) {
                    const closest = this.closestPointOnSegment(obs.pos, this.pos, candidate.pos);
                    const distToObstacle = p5.Vector.dist(closest, obs.pos);
                    if (distToObstacle < obs.r + 14) {
                        obstaclePenalty += 110; // Pénalité pour contournement nécessaire
                    }
                }
            }

            const totalCost = dist + obstaclePenalty;
            if (totalCost < bestCost) {
                bestCost = totalCost;
                bestTarget = candidate;
            }
        }

        // Hystérésis anti-oscillation : si une cible est déjà suivie,
        // ne basculer vers une autre que si le gain est net (> 75px) et le cooldown expiré
        if (this.target && bestTarget && bestTarget !== this.target) {
            const currentDist = this.pos.dist(this.target.pos);
            const HYSTERESIS_THRESHOLD = 75;
            if (bestCost < currentDist - HYSTERESIS_THRESHOLD && this.targetSwitchCooldown <= 0) {
                this.target = bestTarget;
                this.targetSwitchCooldown = 1200; // Verrouillage de 1,2 s pour éviter l'oscillation
            }
        } else if (!this.target) {
            this.target = bestTarget;
            this.targetSwitchCooldown = 800;
        }

        return this.target;
    }

    /**
     * Poursuit la cible selon la loi de Craig Reynolds (Pursue)
     * combinée à l'évitement prioritaire des obstacles de l'arène.
     */
    pursue(target, obstacles = []) {
        if (!target) {
            // Dérive douce en l'absence de cible
            const forward = this.vel.magSq() > 1e-4 ? this.vel.copy().normalize() : p5.Vector.fromAngle(this.pulse);
            const driftDesired = forward.mult(this.maxSpeed * 0.5);
            const driftSteer = p5.Vector.sub(driftDesired, this.vel).limit(this.maxForce);
            const avoidForce = calculateObstacleAvoidance(this, obstacles, this.detectionRadius, this.avoidanceSides);
            this.lastSteer = avoidForce.magSq() > 1e-8 ? avoidForce : driftSteer;
            this.applyForce(this.lastSteer);
            return;
        }

        const distance = this.pos.dist(target.pos);
        const prediction = constrain(distance / Math.max(this.maxSpeed, 0.1), 0, 24);
        const targetVel = (target.vel && typeof target.vel.copy === 'function') ? target.vel.copy() : createVector(0, 0);
        const predictedPosition = p5.Vector.add(
            target.pos,
            targetVel.mult(prediction)
        );
        const desired = p5.Vector.sub(predictedPosition, this.pos);
        if (desired.magSq() > 1e-6) {
            desired.setMag(this.maxSpeed);
        }
        const pursuitForce = p5.Vector.sub(desired, this.vel).limit(this.maxForce);
        const avoidanceForce = calculateObstacleAvoidance(
            this,
            obstacles,
            this.detectionRadius,
            this.avoidanceSides
        );
        this.lastSteer = avoidanceForce.magSq() > 1e-8
            ? combineSteeringWithObstaclePriority(this, avoidanceForce, [pursuitForce])
            : pursuitForce;
        this.applyForce(this.lastSteer);
    }

    // Alias rétro-compatible
    pursuePlayer(player, obstacles) {
        this.pursue(player, obstacles);
    }

    update(elapsedMs = deltaTime, obstacles = []) {
        super.update(elapsedMs);
        const margin = this.r;
        if (this.pos.x < margin || this.pos.x > width - margin) {
            this.pos.x = constrain(this.pos.x, margin, Math.max(margin, width - margin));
            this.vel.x = 0;
        }
        if (this.pos.y < margin || this.pos.y > height - margin) {
            this.pos.y = constrain(this.pos.y, margin, Math.max(margin, height - margin));
            this.vel.y = 0;
        }

        for (const obstacle of obstacles) {
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
        this.pulse += Math.max(0, elapsedMs) * 0.003;
    }

    show() {
        push();
        if (visualEffectsEnabled) {
            noStroke();
            fill(255, 52, 115, 38 + 14 * sin(this.pulse));
            circle(this.pos.x, this.pos.y, this.r * 3.3);
        }
        translate(this.pos.x, this.pos.y);
        rotate(this.vel.magSq() < 1e-4 ? 0 : this.vel.heading());

        // 1. Double aura pulsante toxique
        noStroke();
        fill(255, 42, 108, 55 + 20 * sin(this.pulse * 2));
        circle(0, 0, this.r * 2.7);
        fill(180, 20, 75, 75);
        circle(0, 0, this.r * 2.2);

        // 2. Spicules et capside virale
        fill(75, 12, 52, 250);
        stroke(255, 95, 155, 245);
        strokeWeight(2.2);
        beginShape();
        const spikeCount = 12;
        for (let i = 0; i < spikeCount; i++) {
            const angle = TWO_PI * i / spikeCount;
            const isSpike = i % 2 === 0;
            const spike = isSpike ? (1.35 + 0.08 * sin(this.pulse * 2 + i)) : 0.90;
            vertex(cos(angle) * this.r * spike, sin(angle) * this.r * spike);
        }
        endShape(CLOSE);

        // 3. Bulbes glycoprotéiques au sommet des spicules
        fill(255, 70, 135, 240);
        noStroke();
        for (let i = 0; i < spikeCount; i += 2) {
            const angle = TWO_PI * i / spikeCount;
            const dist = this.r * (1.35 + 0.08 * sin(this.pulse * 2 + i));
            circle(cos(angle) * dist, sin(angle) * dist, 5.5);
        }

        // 4. Cœur viral et génome ARN dense
        fill(255, 65, 130, 230);
        circle(0, 0, this.r * 1.05);
        fill(32, 6, 24, 240);
        circle(0, 0, this.r * 0.75);

        // Filament d'acide nucléique viral spiralé
        stroke(255, 175, 215, 230);
        strokeWeight(1.8);
        noFill();
        beginShape();
        for (let a = 0; a < TWO_PI * 1.8; a += 0.5) {
            const rad = (this.r * 0.35 * a) / (TWO_PI * 1.8);
            vertex(cos(a + this.pulse) * rad, sin(a + this.pulse) * rad);
        }
        endShape();
        pop();

        push();
        noStroke();
        fill(255, 157, 192, 235);
        textAlign(CENTER, BOTTOM);
        textSize(11);
        const label = (this.target && this.target.isAlly) ? 'VIRUS [ALLIÉ]' : (this.target ? 'VIRUS [JOUEUR]' : 'VIRUS');
        text(label, this.pos.x, this.pos.y - this.r - 7);
        pop();
    }
}
