/**
 * Obstacle.js — Obstacles biologiques et masses tissulaires de l'arène
 * Projet CŒUR OUVERT
 *
 * Règles :
 * - Étend impérativement Vehicle (Craig Reynolds)
 * - Physique statique (maxSpeed = 0, maxForce = 0)
 * - Géométrie de collision rigoureusement cohérente avec la membrane visible
 * - Rendu biologique immersif en relief : teintes violettes, magenta, bordeaux, rose foncé
 * - Textures fibreuses, striations myocardiques, ombres volumétriques et reflets humides
 */

class Obstacle extends Vehicle {
    constructor(x, y, r, type = 'myocardium') {
        super(x, y);
        this.r = r;
        this.type = type;
        this.maxSpeed = 0;
        this.maxForce = 0;
        this.vel.set(0, 0);
        this.pulse = random(TWO_PI);
        this.seed = random(1000);

        // Contour organique irrégulier finement calibré (oscillation bornée dans ±5% du rayon r)
        // pour garantir une cohérence parfaite entre membrane visible et volume de collision
        this.lobes = 24;
        this.lobeOffsets = [];
        for (let i = 0; i < this.lobes; i++) {
            const angle = (TWO_PI * i) / this.lobes;
            const variance = 1.0 + 0.042 * sin(angle * 3 + this.seed) + 0.022 * cos(angle * 5 + this.seed * 0.7);
            this.lobeOffsets.push(variance);
        }
    }

    applyBehaviors() {
        return createVector(0, 0);
    }

    update() {
        this.acc.set(0, 0);
        this.vel.set(0, 0);
        this.pulse += 0.016;
    }

    show() {
        // 1. Ombre portée volumétrique profonde pour détacher la masse tissulaire du fond
        push();
        noStroke();
        fill(2, 0, 4, 175);
        ellipse(this.pos.x + 12, this.pos.y + 16, this.r * 2.15, this.r * 2.0);
        pop();

        // 2. Halo bioluminescent respirant
        if (visualEffectsEnabled) {
            const glow = 3 + 2.5 * sin(this.pulse);
            push();
            noStroke();
            if (this.type === 'fibrous') {
                fill(215, 45, 120, 16);
            } else if (this.type === 'lipid') {
                fill(195, 60, 45, 16);
            } else {
                fill(175, 25, 95, 18);
            }
            circle(this.pos.x, this.pos.y, this.r * 2.25 + glow * 3);
            pop();
        }

        // 3. Corps tissulaire organique principal (bordeaux, violet, magenta, rose foncé)
        push();
        translate(this.pos.x, this.pos.y);

        const isFibrous = this.type === 'fibrous';
        const isLipid = this.type === 'lipid';
        const isSeptum = this.type === 'septum';

        // Palette organique riche
        let fillColor, strokeColor, innerColor, striationColor;
        if (isFibrous) {
            // Tissu conjonctif / membrane fibreuse magenta & rose foncé
            fillColor = color(48, 12, 34, 252);
            strokeColor = color(255, 75, 150, 240);
            innerColor = color(74, 18, 52, 230);
            striationColor = color(255, 130, 185, 110);
        } else if (isLipid) {
            // Nodule lipidique / stéatome bordeaux profond & ambre
            fillColor = color(42, 10, 24, 252);
            strokeColor = color(245, 115, 65, 235);
            innerColor = color(68, 16, 36, 230);
            striationColor = color(255, 175, 105, 95);
        } else if (isSeptum) {
            // Septum interventriculaire / pilier dense violet sombre
            fillColor = color(36, 8, 38, 252);
            strokeColor = color(195, 60, 235, 240);
            innerColor = color(58, 14, 62, 230);
            striationColor = color(225, 120, 255, 100);
        } else {
            // Masse myocardique classique (bordeaux profond, pourpre et rose foncé)
            fillColor = color(42, 8, 28, 252);
            strokeColor = color(245, 50, 105, 245);
            innerColor = color(70, 14, 46, 235);
            striationColor = color(235, 90, 145, 105);
        }

        // Membrane externe solide texturée & contour biologique
        fill(fillColor);
        stroke(strokeColor);
        strokeWeight(3.4);
        strokeJoin(ROUND);

        beginShape();
        for (let i = 0; i < this.lobes; i++) {
            const angle = (TWO_PI * i) / this.lobes;
            const wobble = this.lobeOffsets[i] * (1 + 0.015 * sin(this.pulse + i));
            vertex(cos(angle) * this.r * wobble, sin(angle) * this.r * wobble);
        }
        endShape(CLOSE);

        // Sous-couche cytoplasmique intermédiaire
        noStroke();
        fill(innerColor);
        beginShape();
        for (let i = 0; i < this.lobes; i++) {
            const angle = (TWO_PI * i) / this.lobes;
            const wobble = this.lobeOffsets[i] * 0.82;
            vertex(cos(angle) * this.r * wobble + this.r * 0.04, sin(angle) * this.r * wobble + this.r * 0.03);
        }
        endShape(CLOSE);

        // Striations musculaires myocardiques et fibres conjonctives
        noFill();
        stroke(striationColor);
        strokeWeight(1.4);
        ellipse(this.r * 0.02, this.r * 0.02, this.r * 1.25, this.r * 0.95);
        ellipse(this.r * 0.06, this.r * 0.05, this.r * 0.80, this.r * 0.62);

        // Cœur / noyau dense de la structure
        noStroke();
        if (isFibrous) {
            fill(175, 45, 95, 160);
            ellipse(-this.r * 0.08, -this.r * 0.06, this.r * 0.48, this.r * 0.38);
        } else if (isLipid) {
            fill(185, 75, 40, 150);
            circle(-this.r * 0.10, -this.r * 0.08, this.r * 0.45);
            fill(245, 160, 70, 130);
            circle(this.r * 0.18, this.r * 0.14, this.r * 0.28);
        } else {
            fill(145, 25, 75, 170);
            ellipse(-this.r * 0.08, -this.r * 0.06, this.r * 0.50, this.r * 0.40);
            fill(95, 16, 52, 180);
            circle(-this.r * 0.12, -this.r * 0.10, this.r * 0.26);
        }

        // Reflet spéculaire humide de surface (donne le volume et le relief 3D)
        fill(255, 225, 240, 95);
        ellipse(-this.r * 0.30, -this.r * 0.34, this.r * 0.46, this.r * 0.22);

        // Micro-nodules secondaires périphériques
        fill(strokeColor);
        circle(this.r * 0.28, -this.r * 0.18, Math.max(3.5, this.r * 0.09));
        circle(-this.r * 0.15, this.r * 0.35, Math.max(3.0, this.r * 0.07));
        circle(this.r * 0.44, this.r * 0.16, Math.max(2.5, this.r * 0.06));

        pop();
    }
}
