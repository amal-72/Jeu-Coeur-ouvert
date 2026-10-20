class BacteriaDNA {
    static geneRanges = {
        maxSpeed: [1, 3.8],
        perceptionRadius: [75, 300],
        nutrientAttraction: [0.2, 2.2],
        toxinRepulsion: [0.2, 2.5],
        playerFlee: [0, 2],
        aggression: [0.2, 2.4]
    };

    constructor(genes = {}) {
        this.genes = {};
        for (const [name, [min, max]] of Object.entries(BacteriaDNA.geneRanges)) {
            const value = Number.isFinite(genes[name])
                ? genes[name]
                : (min + max) * 0.5;
            this.genes[name] = constrain(value, min, max);
        }
    }

    static random() {
        const genes = {};
        for (const [name, [min, max]] of Object.entries(BacteriaDNA.geneRanges)) {
            genes[name] = random(min, max);
        }
        return new BacteriaDNA(genes);
    }

    static crossover(first, second) {
        const genes = {};
        for (const name of Object.keys(BacteriaDNA.geneRanges)) {
            genes[name] = random() < 0.5 ? first.genes[name] : second.genes[name];
        }
        return new BacteriaDNA(genes);
    }

    clone() {
        return new BacteriaDNA(this.genes);
    }

    mutate(rate = 0.18, strength = 0.12) {
        const genes = { ...this.genes };
        for (const [name, [min, max]] of Object.entries(BacteriaDNA.geneRanges)) {
            if (random() < rate) {
                genes[name] += random(-1, 1) * (max - min) * strength;
            }
        }
        return new BacteriaDNA(genes);
    }
}
