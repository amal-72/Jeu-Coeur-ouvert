class BacteriaEvolution {
    static MIN_POPULATION = 4;
    static MAX_POPULATION = 12;
    static INITIAL_POPULATION = 8;
    static GENERATION_DURATION = 16000;
    static MUTATION_RATE = 0.2;

    constructor(obstacles = []) {
        this.enabled = false;
        this.obstacles = obstacles;
        this.generation = 0;
        this.elapsed = 0;
        this.bestFitness = 0;
        this.population = [];
        this.resources = [];
        this.toxins = [];
        this.resetPopulation();
    }

    get arenaRight() {
        return width >= 650 ? width - 320 : Math.max(170, width - 24);
    }

    setEnabled(enabled) {
        this.enabled = Boolean(enabled);
        if (this.enabled && this.generation === 0) {
            this.generation = 1;
        }
    }

    resetPopulation(count = BacteriaEvolution.INITIAL_POPULATION) {
        const size = constrain(
            Math.floor(Number.isFinite(count) ? count : BacteriaEvolution.INITIAL_POPULATION),
            BacteriaEvolution.MIN_POPULATION,
            BacteriaEvolution.MAX_POPULATION
        );
        this.generation = 1;
        this.elapsed = 0;
        this.bestFitness = 0;
        this.population = [];
        this.createToxins();
        this.createResources();
        for (let i = 0; i < size; i++) {
            const bacterium = this.createBacterium(BacteriaDNA.random());
            if (bacterium) {
                this.population.push(bacterium);
            }
        }
        this.updatePanel();
        return this.population.length;
    }

    createToxins() {
        this.toxins = [];
        const right = this.arenaRight;
        for (let i = 0; i < 3; i++) {
            const toxin = { pos: createVector(0, 0), r: 18, dangerRadius: 100 };
            if (this.findSafePosition(toxin.r + 12, [], this.toxins, toxin.pos, toxin.dangerRadius)) {
                toxin.pos.set(this._lastSpawnPosition);
                this.toxins.push(toxin);
            }
        }
        if (right < 180) {
            this.toxins = [];
        }
    }

    createResources() {
        this.resources = [];
        for (let i = 0; i < 5; i++) {
            const resource = new Nutrient();
            this.spawnResource(resource);
            this.resources.push(resource);
        }
    }

    createBacterium(dna) {
        const bacterium = new Bacteria(0, 0, dna);
        bacterium.geneticDemo = true;
        if (!this.findSafePosition(bacterium.r + 12, this.population, this.toxins, null, 45)) {
            return null;
        }
        bacterium.pos.set(this._lastSpawnPosition);
        bacterium.lifeSeconds = 0;
        bacterium.resourcesCollected = 0;
        bacterium.offspringCount = 0;
        bacterium.toxinHits = 0;
        bacterium.reproductionTimer = random(3500, 6500);
        return bacterium;
    }

    findSafePosition(margin, agents = [], toxins = [], excludedPosition = null, toxinClearance = 0) {
        const right = this.arenaRight;
        const minX = margin + 8;
        const maxX = right - margin - 8;
        const minY = margin + 8;
        const maxY = height - margin - 8;
        if (maxX <= minX || maxY <= minY) {
            return false;
        }

        const safe = candidate => {
            if (excludedPosition && candidate.dist(excludedPosition) < margin * 2) {
                return false;
            }
            if (this.obstacles.some(obstacle =>
                candidate.dist(obstacle.pos) < margin + obstacle.r + 8
            )) {
                return false;
            }
            if (agents.some(agent => agent.active !== false
                && candidate.dist(agent.pos) < margin + agent.r + 10)) {
                return false;
            }
            return toxins.every(toxin =>
                candidate.dist(toxin.pos) >= margin + toxin.r + toxinClearance
            );
        };

        for (let attempt = 0; attempt < 120; attempt++) {
            const candidate = createVector(random(minX, maxX), random(minY, maxY));
            if (safe(candidate)) {
                this._lastSpawnPosition = candidate;
                return true;
            }
        }
        for (let y = minY; y <= maxY; y += Math.max(24, margin * 1.5)) {
            for (let x = minX; x <= maxX; x += Math.max(24, margin * 1.5)) {
                const candidate = createVector(x, y);
                if (safe(candidate)) {
                    this._lastSpawnPosition = candidate;
                    return true;
                }
            }
        }
        return false;
    }

    spawnResource(resource) {
        const margin = resource.r + 8;
        const right = this.arenaRight;
        if (right <= margin * 2 || height <= margin * 2) {
            resource.active = false;
            return false;
        }
        for (let attempt = 0; attempt < 100; attempt++) {
            const candidate = createVector(
                random(margin, right - margin),
                random(margin, height - margin)
            );
            const clear = this.obstacles.every(obstacle =>
                candidate.dist(obstacle.pos) >= resource.r + obstacle.r + 10
            ) && this.toxins.every(toxin =>
                candidate.dist(toxin.pos) >= toxin.r + resource.r + toxin.dangerRadius * 0.35
            ) && this.resources.every(other => other === resource || !other.active
                || candidate.dist(other.pos) >= resource.r + other.r + 14);
            if (clear) {
                resource.pos.set(candidate);
                resource.active = true;
                resource.respawnTimer = 0;
                return true;
            }
        }
        resource.active = false;
        resource.respawnTimer = 700;
        return false;
    }

    update(deltaMs, obstacles, target) {
        if (!this.enabled) {
            return;
        }
        this.obstacles = obstacles || [];
        const elapsed = Math.max(0, deltaMs);
        this.elapsed += elapsed;
        while (this.elapsed >= BacteriaEvolution.GENERATION_DURATION) {
            this.elapsed -= BacteriaEvolution.GENERATION_DURATION;
            this.advanceGeneration();
        }

        this.updateResources(elapsed);
        for (const bacterium of this.population) {
            if (bacterium.active === false) {
                continue;
            }
            bacterium.lifeSeconds += elapsed / 1000;
            bacterium.applyEvolutionBehaviors(
                this.obstacles,
                this.resources,
                this.toxins,
                this.population,
                target,
                this.arenaRight
            );
            bacterium.update(elapsed);
            bacterium.reproductionTimer -= elapsed;
            if (bacterium.reproductionTimer <= 0
                && bacterium.resourcesCollected > 0
                && this.population.length < BacteriaEvolution.MAX_POPULATION) {
                const child = this.createBacterium(
                    bacterium.dna.mutate(BacteriaEvolution.MUTATION_RATE)
                );
                if (child) {
                    bacterium.resourcesCollected--;
                    bacterium.offspringCount++;
                    this.population.push(child);
                }
                bacterium.reproductionTimer = 5000;
            }
            for (const toxin of this.toxins) {
                if (bacterium.pos.dist(toxin.pos) <= bacterium.r + toxin.r) {
                    bacterium.toxinHits++;
                    bacterium.active = false;
                    break;
                }
            }
        }
        this.updatePanel();
    }

    updateResources(elapsed) {
        for (const resource of this.resources) {
            if (!resource.active) {
                resource.respawnTimer -= elapsed;
                if (resource.respawnTimer <= 0) {
                    this.spawnResource(resource);
                }
                continue;
            }
            resource.update();
            const collector = this.population.find(agent =>
                agent.active !== false
                && agent.pos.dist(resource.pos) <= agent.r + resource.r
            );
            if (collector && resource.consume()) {
                collector.resourcesCollected++;
            }
        }
    }

    fitnessOf(bacterium) {
        return Math.max(
            0,
            bacterium.lifeSeconds
            + bacterium.resourcesCollected * 8
            + bacterium.offspringCount * 12
            - bacterium.toxinHits * 3
        );
    }

    selectParent(population) {
        if (population.length === 0) {
            return null;
        }
        let best = null;
        const rounds = Math.min(3, population.length);
        for (let i = 0; i < rounds; i++) {
            const candidate = random(population);
            if (!best || this.fitnessOf(candidate) > this.fitnessOf(best)) {
                best = candidate;
            }
        }
        return best;
    }

    advanceGeneration() {
        const previous = this.population.slice();
        const ranked = previous.slice().sort((a, b) =>
            this.fitnessOf(b) - this.fitnessOf(a)
        );
        if (ranked.length > 0) {
            this.bestFitness = Math.max(this.bestFitness, this.fitnessOf(ranked[0]));
        }
        const nextSize = constrain(
            previous.length || BacteriaEvolution.INITIAL_POPULATION,
            BacteriaEvolution.MIN_POPULATION,
            BacteriaEvolution.MAX_POPULATION
        );
        this.population = [];
        for (let i = 0; i < nextSize; i++) {
            const parent = i % 5 === 4 ? null : this.selectParent(previous);
            const secondParent = parent ? this.selectParent(previous) : null;
            const dna = parent
                ? BacteriaDNA.crossover(parent.dna, secondParent.dna)
                    .mutate(BacteriaEvolution.MUTATION_RATE)
                : BacteriaDNA.random();
            const child = this.createBacterium(dna);
            if (child) {
                this.population.push(child);
            }
        }
        while (this.population.length < BacteriaEvolution.MIN_POPULATION) {
            const child = this.createBacterium(BacteriaDNA.random());
            if (!child) {
                break;
            }
            this.population.push(child);
        }
        this.generation++;
    }

    resize(obstacles) {
        const genomes = this.population.length > 0
            ? this.population.map(agent => agent.dna.clone())
            : Array.from(
                { length: BacteriaEvolution.INITIAL_POPULATION },
                () => BacteriaDNA.random()
            );
        this.obstacles = obstacles || [];
        this.createToxins();
        this.createResources();
        this.population = [];
        for (const dna of genomes.slice(0, BacteriaEvolution.MAX_POPULATION)) {
            const bacterium = this.createBacterium(dna);
            if (bacterium) {
                this.population.push(bacterium);
            }
        }
        while (this.population.length < BacteriaEvolution.MIN_POPULATION) {
            const bacterium = this.createBacterium(BacteriaDNA.random());
            if (!bacterium) {
                break;
            }
            this.population.push(bacterium);
        }
        this.elapsed = 0;
        this.updatePanel();
    }

    show() {
        if (!this.enabled) {
            return;
        }
        push();
        noStroke();
        fill(4, 12, 28, 75);
        rect(0, 0, this.arenaRight, height);
        for (const toxin of this.toxins) {
            noFill();
            stroke(255, 65, 111, 48);
            circle(toxin.pos.x, toxin.pos.y, toxin.dangerRadius * 2);
            fill(244, 66, 106, 190);
            noStroke();
            beginShape();
            for (let i = 0; i < 6; i++) {
                const angle = TWO_PI * i / 6;
                vertex(
                    toxin.pos.x + cos(angle) * toxin.r,
                    toxin.pos.y + sin(angle) * toxin.r
                );
            }
            endShape(CLOSE);
        }
        for (const resource of this.resources) {
            resource.show();
        }
        for (const bacterium of this.population) {
            if (bacterium.active !== false) {
                bacterium.show();
            }
        }
        fill(185, 242, 249, 230);
        textSize(12);
        textAlign(LEFT, TOP);
        text(`ÉVOLUTION · G${this.generation}`, 14, 12);
        pop();
    }

    updatePanel() {
        const generation = document.getElementById('evolutionGeneration');
        const population = document.getElementById('evolutionPopulation');
        const fitness = document.getElementById('evolutionFitness');
        const genes = document.getElementById('evolutionGenes');
        const best = this.population
            .filter(agent => agent.active !== false)
            .sort((a, b) => this.fitnessOf(b) - this.fitnessOf(a))[0];
        if (best) {
            this.bestFitness = Math.max(this.bestFitness, this.fitnessOf(best));
        }
        if (generation) {
            generation.textContent = String(this.generation);
        }
        if (population) {
            const alive = this.population.filter(agent => agent.active !== false).length;
            population.textContent = `${alive} / ${this.population.length}`;
        }
        if (fitness) {
            fitness.textContent = this.bestFitness.toFixed(1);
        }
        if (genes) {
            genes.textContent = best
                ? `V ${best.dna.genes.maxSpeed.toFixed(1)} · Perception ${Math.round(best.dna.genes.perceptionRadius)} · Nutriments ${best.dna.genes.nutrientAttraction.toFixed(2)} · Toxines ${best.dna.genes.toxinRepulsion.toFixed(2)} · Fuite ${best.dna.genes.playerFlee.toFixed(2)} · Agression ${best.dna.genes.aggression.toFixed(2)}`
                : 'Aucune bactérie vivante';
        }
    }
}
