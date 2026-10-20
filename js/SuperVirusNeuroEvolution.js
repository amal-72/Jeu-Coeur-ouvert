class SuperVirusNetwork {
    static RAY_ANGLES = [-Math.PI / 2, -Math.PI / 4, 0, Math.PI / 4, Math.PI / 2];
    static RAY_TYPES = ['obstacle', 'cell', 'resource'];
    static INPUT_COUNT = 26;
    static HIDDEN_COUNT = 12;
    static OUTPUT_COUNT = 3;
    static INPUT_LAYOUT = [
        '5 ray angles × obstacle distance',
        '5 ray angles × immune-cell distance',
        '5 ray angles × nutrient distance',
        'local velocity x/y',
        'normalized position x/y',
        'relative target x/y and proximity',
        'left/right/top/bottom boundary proximity'
    ];

    constructor(weights = null) {
        this.inputCount = SuperVirusNetwork.INPUT_COUNT;
        this.hiddenCount = SuperVirusNetwork.HIDDEN_COUNT;
        this.outputCount = SuperVirusNetwork.OUTPUT_COUNT;
        this.weights = weights ? SuperVirusNetwork.copyWeights(weights) : {
            inputHidden: Array.from(
                { length: this.hiddenCount },
                () => Array.from({ length: this.inputCount }, () => this.randomWeight())
            ),
            hiddenBias: Array.from({ length: this.hiddenCount }, () => this.randomWeight()),
            hiddenOutput: Array.from(
                { length: this.outputCount },
                () => Array.from({ length: this.hiddenCount }, () => this.randomWeight())
            ),
            outputBias: Array.from({ length: this.outputCount }, () => this.randomWeight())
        };
    }

    randomWeight() {
        return randomGaussian(0, 0.55);
    }

    static copyWeights(weights) {
        return {
            inputHidden: weights.inputHidden.map(row => row.slice()),
            hiddenBias: weights.hiddenBias.slice(),
            hiddenOutput: weights.hiddenOutput.map(row => row.slice()),
            outputBias: weights.outputBias.slice()
        };
    }

    predict(inputs) {
        if (!Array.isArray(inputs) || inputs.length !== this.inputCount
            || inputs.some(value => !Number.isFinite(value))) {
            throw new Error(`SuperVirusNetwork expects ${this.inputCount} finite inputs.`);
        }
        const hidden = this.weights.inputHidden.map((row, index) => {
            let sum = this.weights.hiddenBias[index];
            for (let i = 0; i < this.inputCount; i++) {
                sum += row[i] * inputs[i];
            }
            return Math.tanh(sum);
        });
        const outputs = this.weights.hiddenOutput.map((row, index) => {
            let sum = this.weights.outputBias[index];
            for (let i = 0; i < this.hiddenCount; i++) {
                sum += row[i] * hidden[i];
            }
            if (index === 0) {
                return Math.tanh(sum);
            }
            return 1 / (1 + Math.exp(-constrain(sum, -30, 30)));
        });
        return outputs;
    }

    copy() {
        return new SuperVirusNetwork(this.weights);
    }

    mutate(rate = 0.08, sigma = 0.18) {
        const result = this.copy();
        const mutateValue = value => Math.random() < rate
            ? constrain(value + randomGaussian(0, sigma), -3, 3)
            : value;
        result.weights.inputHidden = result.weights.inputHidden.map(row =>
            row.map(mutateValue)
        );
        result.weights.hiddenBias = result.weights.hiddenBias.map(mutateValue);
        result.weights.hiddenOutput = result.weights.hiddenOutput.map(row =>
            row.map(mutateValue)
        );
        result.weights.outputBias = result.weights.outputBias.map(mutateValue);
        return result;
    }
}

class SuperVirus extends Vehicle {
    static SENSOR_RANGE = 260;
    static MAX_TURN = Math.PI / 2;

    constructor(x, y, network = new SuperVirusNetwork()) {
        super(x, y);
        this.r = 12;
        this.maxSpeed = 2.4;
        this.maxForce = 0.14;
        this.network = network;
        this.active = true;
        this.age = 0;
        this.travelDistance = 0;
        this.targetProximity = 0;
        this.targetContacts = 0;
        this.previousPosition = this.pos.copy();
        this.sensorValues = [];
        this.sensorHits = [];
        this.outputs = [0, 0.5, 0.5];
        this.debugSensors = false;
        this.vel = p5.Vector.fromAngle(random(TWO_PI)).setMag(this.maxSpeed * 0.55);
        this.velocity = this.vel;
    }

    sense(obstacles, cells, resources, target, arenaRight) {
        const heading = this.vel.magSq() > 1e-5
            ? this.vel.heading()
            : this.lastHeading || 0;
        const categories = { obstacle: obstacles, cell: cells, resource: resources };
        const inputs = [];
        this.sensorHits = [];

        for (const relativeAngle of SuperVirusNetwork.RAY_ANGLES) {
            const direction = p5.Vector.fromAngle(heading + relativeAngle);
            for (const type of SuperVirusNetwork.RAY_TYPES) {
                let nearest = SuperVirus.SENSOR_RANGE;
                let hit = null;
                for (const entity of categories[type]) {
                    if (!entity || entity.active === false) {
                        continue;
                    }
                    const offset = p5.Vector.sub(entity.pos, this.pos);
                    const projection = offset.dot(direction);
                    if (projection < 0 || projection > nearest + entity.r) {
                        continue;
                    }
                    const perpendicularSq = offset.magSq() - projection * projection;
                    const radiusSq = (entity.r + this.r) ** 2;
                    if (perpendicularSq > radiusSq) {
                        continue;
                    }
                    const distance = Math.max(0, projection - Math.sqrt(radiusSq - perpendicularSq));
                    if (distance < nearest) {
                        nearest = distance;
                        hit = entity;
                    }
                }
                inputs.push(hit ? 1 - nearest / SuperVirus.SENSOR_RANGE : 0);
                this.sensorHits.push({
                    type,
                    angle: heading + relativeAngle,
                    distance: nearest,
                    entity: hit
                });
            }
        }

        const speed = Math.max(this.maxSpeed, 1e-5);
        const localVelocity = this.vel.copy().rotate(-heading).div(speed);
        inputs.push(constrain(localVelocity.x, -1, 1), constrain(localVelocity.y, -1, 1));
        inputs.push(constrain(this.pos.x / Math.max(1, arenaRight), 0, 1));
        inputs.push(constrain(this.pos.y / Math.max(1, height), 0, 1));
        if (target) {
            const targetOffset = p5.Vector.sub(target.pos, this.pos);
            const targetDistance = targetOffset.mag();
            targetOffset.rotate(-heading).div(SuperVirus.SENSOR_RANGE);
            inputs.push(
                constrain(targetOffset.x, -1, 1),
                constrain(targetOffset.y, -1, 1),
                1 - constrain(targetDistance / SuperVirus.SENSOR_RANGE, 0, 1)
            );
        } else {
            inputs.push(0, 0, 0);
        }
        const boundaryRange = 150;
        inputs.push(
            1 - constrain(this.pos.x / boundaryRange, 0, 1),
            1 - constrain((arenaRight - this.pos.x) / boundaryRange, 0, 1),
            1 - constrain(this.pos.y / boundaryRange, 0, 1),
            1 - constrain((height - this.pos.y) / boundaryRange, 0, 1)
        );

        if (inputs.length !== SuperVirusNetwork.INPUT_COUNT
            || inputs.some(value => !Number.isFinite(value))) {
            throw new Error('SuperVirus sensor vector has invalid dimensions or values.');
        }
        this.sensorValues = inputs;
        return inputs;
    }

    decideAndMove(deltaMs, obstacles, cells, resources, target, arenaRight) {
        if (!this.active) {
            return;
        }
        const inputs = this.sense(obstacles, cells, resources, target, arenaRight);
        this.outputs = this.network.predict(inputs);
        if (this.outputs.length !== SuperVirusNetwork.OUTPUT_COUNT
            || this.outputs.some(value => !Number.isFinite(value))) {
            throw new Error('SuperVirus network produced invalid outputs.');
        }

        const heading = this.vel.magSq() > 1e-5
            ? this.vel.heading()
            : this.lastHeading || 0;
        const desiredHeading = heading + this.outputs[0] * SuperVirus.MAX_TURN;
        const desiredVelocity = p5.Vector.fromAngle(desiredHeading)
            .setMag(this.maxSpeed * this.outputs[1]);
        const steering = p5.Vector.sub(desiredVelocity, this.vel);
        if (target && this.outputs[2] > 0.5) {
            const targetForce = this.seek(target.pos);
            steering.add(targetForce.mult((this.outputs[2] - 0.5) * 2));
        }

        const boundarySteering = this.steerFromBounds(arenaRight);
        steering.add(boundarySteering.mult(2.5)).limit(this.maxForce);
        this.lastSteer = steering.copy();
        this.applyForce(steering);

        const elapsedSeconds = Math.max(0, deltaMs) / 1000;
        this.age += elapsedSeconds;
        this.pos.add(this.vel.copy().mult(elapsedSeconds * 60));
        this.vel.add(this.acc.copy().mult(elapsedSeconds * 60)).limit(this.maxSpeed);
        this.acc.set(0, 0);
        const previousX = this.pos.x;
        const previousY = this.pos.y;
        this.pos.x = constrain(this.pos.x, this.r, arenaRight - this.r);
        this.pos.y = constrain(this.pos.y, this.r, height - this.r);
        if (this.pos.x !== previousX) {
            this.vel.x *= -0.35;
        }
        if (this.pos.y !== previousY) {
            this.vel.y *= -0.35;
        }
        this.travelDistance += this.pos.dist(this.previousPosition);
        this.previousPosition.set(this.pos);
        if (target) {
            const distance = this.pos.dist(target.pos);
            this.targetProximity += (1 - constrain(distance / SuperVirus.SENSOR_RANGE, 0, 1))
                * elapsedSeconds;
            if (distance <= this.r + target.r && this.targetContacts === 0) {
                this.targetContacts++;
                this.active = false;
            }
        }
    }

    steerFromBounds(arenaRight) {
        const margin = 55;
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
        desired.setMag(this.maxSpeed);
        return p5.Vector.sub(desired, this.vel).limit(this.maxForce);
    }

    show(debug = false) {
        if (!this.active) {
            return;
        }
        if (debug) {
            this.showSensors();
        }
        const heading = this.vel.magSq() > 1e-5 ? this.vel.heading() : 0;
        push();
        translate(this.pos.x, this.pos.y);
        rotate(heading);
        noStroke();
        if (visualEffectsEnabled) {
            fill(189, 67, 255, 44);
            circle(0, 0, this.r * 3.5);
        }
        fill(142, 70, 237, 238);
        stroke(225, 179, 255, 238);
        strokeWeight(1.5);
        beginShape();
        for (let i = 0; i < 8; i++) {
            const angle = TWO_PI * i / 8;
            const radius = this.r * (i % 2 === 0 ? 1.2 : 0.88);
            vertex(cos(angle) * radius, sin(angle) * radius);
        }
        endShape(CLOSE);
        noStroke();
        fill(247, 224, 255, 235);
        circle(this.r * 0.24, -this.r * 0.15, 4);
        pop();
    }

    showSensors() {
        push();
        for (const sensor of this.sensorHits) {
            const endpoint = p5.Vector.add(
                this.pos,
                p5.Vector.fromAngle(sensor.angle).setMag(sensor.distance)
            );
            const hitColor = sensor.type === 'obstacle'
                ? color(255, 205, 90, 155)
                : sensor.type === 'cell'
                    ? color(255, 95, 135, 155)
                    : color(100, 255, 185, 155);
            stroke(hitColor);
            line(this.pos.x, this.pos.y, endpoint.x, endpoint.y);
            if (sensor.entity) {
                noStroke();
                fill(hitColor);
                circle(endpoint.x, endpoint.y, 4);
            }
        }
        pop();
    }
}

class SuperVirusNeuroEvolution {
    static MIN_POPULATION = 4;
    static MAX_POPULATION = 10;
    static POPULATION_SIZE = 8;
    static GENERATION_MS = 18000;
    static MUTATION_RATE = 0.08;
    static ELITE_COUNT = 1;

    constructor(obstacles = []) {
        this.obstacles = obstacles;
        this.population = [];
        this.enabled = false;
        this.debug = false;
        this.generation = 0;
        this.elapsed = 0;
        this.bestFitness = 0;
        this.averageFitness = 0;
        this.reset();
    }

    get arenaRight() {
        return width >= 650 ? width - 320 : Math.max(170, width - 24);
    }

    setEnabled(enabled) {
        this.enabled = Boolean(enabled);
        if (this.enabled && this.generation === 0) {
            this.generation = 1;
        }
        this.updatePanel();
    }

    reset(count = SuperVirusNeuroEvolution.POPULATION_SIZE) {
        const size = constrain(
            Math.floor(Number.isFinite(count) ? count : SuperVirusNeuroEvolution.POPULATION_SIZE),
            SuperVirusNeuroEvolution.MIN_POPULATION,
            SuperVirusNeuroEvolution.MAX_POPULATION
        );
        this.population = [];
        this.generation = 1;
        this.elapsed = 0;
        this.bestFitness = 0;
        this.averageFitness = 0;
        for (let i = 0; i < size; i++) {
            this.population.push(this.createVirus(new SuperVirusNetwork()));
        }
        this.updatePanel();
        return this.population.length;
    }

    createVirus(network) {
        const right = this.arenaRight;
        const margin = 45;
        for (let attempt = 0; attempt < 100; attempt++) {
            const x = random(margin, Math.max(margin + 1, right - margin));
            const y = random(margin, Math.max(margin + 1, height - margin));
            const clear = this.obstacles.every(obstacle =>
                dist(x, y, obstacle.pos.x, obstacle.pos.y) >= obstacle.r + 38
            );
            if (clear) {
                return new SuperVirus(x, y, network);
            }
        }
        return new SuperVirus(
            constrain(right * 0.5, margin, Math.max(margin, right - margin)),
            constrain(height * 0.5, margin, Math.max(margin, height - margin)),
            network
        );
    }

    fitnessOf(virus) {
        return virus.age
            + virus.travelDistance * 0.025
            + virus.targetProximity * 0.35
            + virus.targetContacts * 12;
    }

    selectParent(ranked) {
        const candidates = ranked.slice(0, Math.max(1, Math.ceil(ranked.length * 0.65)));
        let selected = candidates[0];
        for (let i = 0; i < Math.min(3, candidates.length); i++) {
            const candidate = random(candidates);
            if (this.fitnessOf(candidate) > this.fitnessOf(selected)) {
                selected = candidate;
            }
        }
        return selected;
    }

    nextGeneration() {
        const ranked = this.population.slice().sort((a, b) =>
            this.fitnessOf(b) - this.fitnessOf(a)
        );
        if (ranked.length === 0) {
            this.reset();
            return;
        }
        const fitnesses = ranked.map(virus => this.fitnessOf(virus));
        this.bestFitness = Math.max(this.bestFitness, fitnesses[0]);
        this.averageFitness = fitnesses.reduce((sum, value) => sum + value, 0)
            / fitnesses.length;
        const size = constrain(
            ranked.length,
            SuperVirusNeuroEvolution.MIN_POPULATION,
            SuperVirusNeuroEvolution.MAX_POPULATION
        );
        const next = [];
        for (let i = 0; i < size; i++) {
            const network = i < SuperVirusNeuroEvolution.ELITE_COUNT
                ? ranked[i].network.copy()
                : this.selectParent(ranked).network.mutate(
                    SuperVirusNeuroEvolution.MUTATION_RATE
                );
            next.push(this.createVirus(network));
        }
        this.population = next;
        this.generation++;
        this.updatePanel();
    }

    update(deltaMs, obstacles, target, cells, resources) {
        if (!this.enabled) {
            return;
        }
        this.obstacles = obstacles || [];
        const elapsed = constrain(Math.max(0, deltaMs), 0, 100);
        this.elapsed += elapsed;
        while (this.elapsed >= SuperVirusNeuroEvolution.GENERATION_MS) {
            this.elapsed -= SuperVirusNeuroEvolution.GENERATION_MS;
            this.nextGeneration();
        }
        for (const virus of this.population) {
            virus.decideAndMove(
                elapsed,
                this.obstacles,
                cells,
                resources,
                target,
                this.arenaRight
            );
        }
        this.updatePanel();
    }

    resize(obstacles) {
        this.obstacles = obstacles || [];
        this.reset(this.population.length || SuperVirusNeuroEvolution.POPULATION_SIZE);
    }

    updatePanel() {
        const generation = document.getElementById('neuroGeneration');
        const best = document.getElementById('neuroBestFitness');
        const average = document.getElementById('neuroAverageFitness');
        const status = document.getElementById('neuroStatus');
        const topFitness = this.population.length
            ? Math.max(...this.population.map(virus => this.fitnessOf(virus)))
            : 0;
        const meanFitness = this.population.length
            ? this.population.reduce((sum, virus) => sum + this.fitnessOf(virus), 0)
                / this.population.length
            : 0;
        if (generation) {
            generation.textContent = String(this.generation);
        }
        if (best) {
            best.textContent = Math.max(this.bestFitness, topFitness).toFixed(1);
        }
        if (average) {
            average.textContent = meanFitness.toFixed(1);
        }
        if (status) {
            status.textContent = this.enabled
                ? `${this.population.filter(virus => virus.active).length} / ${this.population.length} SuperVirus actifs`
                : 'Démonstration désactivée.';
        }
    }

    show() {
        if (!this.enabled) {
            return;
        }
        const champion = this.population.slice().sort((a, b) =>
            this.fitnessOf(b) - this.fitnessOf(a)
        )[0];
        for (const virus of this.population) {
            virus.show(this.debug && virus === champion);
        }
        if (this.debug && champion) {
            fill(255, 225, 240, 230);
            noStroke();
            textSize(10);
            textAlign(LEFT, BOTTOM);
            text(
                `Tour ${champion.outputs[0].toFixed(2)} · Vitesse ${champion.outputs[1].toFixed(2)} · Cible ${champion.outputs[2].toFixed(2)}`,
                champion.pos.x + 16,
                champion.pos.y - 14
            );
        }
    }
}
