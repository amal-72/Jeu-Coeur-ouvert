const GAME_DIFFICULTY = {
    easy: {
        bacteriaCount: 10,
        contactDamage: 6,
        contactCooldown: 2200,
        playerAttackCooldown: 1300,
        allyAttackCooldown: 4400,
        energyDrain: 0.3,
        nutrientEnergy: 35,
        enemyStartSpeed: 0.7,
        enemyEndSpeed: 0.92,
        enemyStartAggression: 0.5,
        enemyEndAggression: 0.78
    },
    normal: {
        bacteriaCount: 12,
        contactDamage: 8,
        contactCooldown: 2000,
        playerAttackCooldown: 1300,
        allyAttackCooldown: 4600,
        energyDrain: 0.45,
        nutrientEnergy: 35,
        enemyStartSpeed: 0.76,
        enemyEndSpeed: 1,
        enemyStartAggression: 0.65,
        enemyEndAggression: 1
    },
    hard: {
        bacteriaCount: 14,
        contactDamage: 10,
        contactCooldown: 1700,
        playerAttackCooldown: 1200,
        allyAttackCooldown: 4200,
        energyDrain: 0.65,
        nutrientEnergy: 32,
        enemyStartSpeed: 0.86,
        enemyEndSpeed: 1.12,
        enemyStartAggression: 0.82,
        enemyEndAggression: 1.25
    }
};

const SIMULATION_STEP_MS = 1000 / 60;
const MAX_SIMULATION_STEPS_PER_FRAME = 6;
// Calendrier d'apparition des virus (en ms depuis le début de la partie)
// Chaque entrée est { spawnMs, warningMs } — les virus apparaissent progressivement
const VIRUS_SPAWN_SCHEDULE = [
    { spawnMs: 25000, warningMs: 20000 },  // Virus 1 : 25 secondes
    { spawnMs: 60000, warningMs: 55000 },  // Virus 2 : 60 secondes (mode normal/hard)
    { spawnMs: 100000, warningMs: 95000 }  // Virus 3 : 100 secondes (mode hard uniquement)
];
const VIRUS_SPAWN_TIME_MS = 25000;  // Compatibilité — premier virus
const VIRUS_WARNING_LEAD_MS = 5000;
const NUTRIENT_OBJECTIVE_GOAL = 5;
let lastPointerClientX = null;
let lastPointerClientY = null;
const playerKeys = new Set();
let playerAttackRequested = false;
viruses = [];              // Tableau de tous les virus actifs
let virusSpawnIndex = 0;       // Prochain virus à faire apparaître dans VIRUS_SPAWN_SCHEDULE
let virusWarningShown = false;
let virusNearWarningActive = false;
let virusAlertRemainingMs = 0;
let gameNoticeRemainingMs = 0;
let powerUps = [];
let playerSpeedBoostRemainingMs = 0;
let nutrientsCollected = 0;
let nutrientObjectiveComplete = false;
let audioContext = null;
let soundEnabled = true;
let gameVolume = 0.25;
let audioUnsupportedWarningShown = false;
let mainMenuOpen = false;

const PLAYER_MOVEMENT_KEYS = new Set([
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyZ', 'KeyQ'
]);
const PLAYER_ACTION_KEYS = new Set(['Space', 'KeyE']);

function isUiControl(target) {
    return Boolean(target && target.closest
        && target.closest('input, select, textarea, button, summary, a'));
}

function handlePlayerKeyDown(event) {
    if (isUiControl(event.target)) {
        return;
    }
    if (event.code === 'Escape') {
        event.preventDefault();
        if (!gameOver && !mainMenuOpen) {
            setGamePaused(!gamePaused);
        }
        return;
    }
    if (!PLAYER_MOVEMENT_KEYS.has(event.code) && !PLAYER_ACTION_KEYS.has(event.code)) {
        return;
    }

    event.preventDefault();
    if (soundEnabled) {
        ensureGameAudio();
    }
    if (gameOver || gamePaused) {
        return;
    }

    if (PLAYER_MOVEMENT_KEYS.has(event.code)) {
        playerKeys.add(event.code);
    }
    if (event.repeat) {
        return;
    }
    if (event.code === 'Space') {
        playerAttackRequested = true;
        playGameTone(390, 90, 'triangle', 520);
    } else if (event.code === 'KeyE' && whiteCell && whiteCell.activateSpecial()) {
        spawnVisualEffect(whiteCell.pos, [99, 236, 190], 22, 96);
        playGameTone(620, 180, 'sine', 880);
    }
}

function handlePlayerKeyUp(event) {
    playerKeys.delete(event.code);
}

function getPlayerMovementInput() {
    const horizontal = Number(
        playerKeys.has('ArrowRight') || playerKeys.has('KeyD')
    ) - Number(playerKeys.has('ArrowLeft') || playerKeys.has('KeyA') || playerKeys.has('KeyQ'));
    const vertical = Number(
        playerKeys.has('ArrowDown') || playerKeys.has('KeyS')
    ) - Number(playerKeys.has('ArrowUp') || playerKeys.has('KeyW') || playerKeys.has('KeyZ'));
    return createVector(horizontal, vertical).limit(1);
}

function ensureGameAudio() {
    const AudioContextType = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextType) {
        if (!audioUnsupportedWarningShown) {
            console.warn('AudioContext indisponible : les sons du jeu sont désactivés.');
            audioUnsupportedWarningShown = true;
        }
        return null;
    }
    if (!audioContext) {
        audioContext = new AudioContextType();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume().catch(error => {
            console.warn('Impossible d’activer le son du jeu.', error);
        });
    }
    return audioContext;
}

function playGameTone(startFrequency, durationMs, type = 'sine', endFrequency = startFrequency) {
    if (!soundEnabled || gameVolume <= 0) {
        return;
    }
    const context = ensureGameAudio();
    if (!context) {
        return;
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const startTime = context.currentTime;
    const endTime = startTime + Math.max(0.03, durationMs / 1000);
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(1, endFrequency),
        endTime
    );
    gain.gain.setValueAtTime(Math.max(0.001, gameVolume * 0.16), startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, endTime);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startTime);
    oscillator.stop(endTime);
}

function showVirusAlert(message, durationMs = 4000) {
    const alert = document.getElementById('virusAlert');
    if (!alert) {
        return;
    }
    alert.textContent = message;
    alert.hidden = false;
    virusAlertRemainingMs = durationMs;
}

function updatePlayerMouseTarget(event) {
    const canvas = document.querySelector('#canvas-container canvas');
    if (!canvas || !playerMouseTarget) {
        return;
    }

    const bounds = canvas.getBoundingClientRect();
    lastPointerClientX = event.clientX;
    lastPointerClientY = event.clientY;
    playerMouseTarget.set(
        constrain(
            (event.clientX - bounds.left) * width / Math.max(1, bounds.width),
            0,
            width
        ),
        constrain(
            (event.clientY - bounds.top) * height / Math.max(1, bounds.height),
            0,
            height
        )
    );
}

function setup() {
    const canvas = createCanvas(windowWidth, windowHeight);
    canvas.parent('canvas-container');
    canvas.elt.tabIndex = 0;
    canvas.elt.setAttribute('aria-label', 'Arène CŒUR OUVERT. Cliquer ici active les commandes clavier.');
    frameRate(60);
    playerMouseTarget = createVector(width / 2, height / 2);
    window.addEventListener('pointermove', updatePlayerMouseTarget, { passive: true });
    window.addEventListener('keydown', handlePlayerKeyDown);
    window.addEventListener('keyup', handlePlayerKeyUp);
    window.addEventListener('blur', () => playerKeys.clear());

    const restartButton = document.getElementById('restartButton');
    if (restartButton) {
        restartButton.addEventListener('click', restartGame);
    }
    const restartButtonInline = document.getElementById('restartButtonInline');
    if (restartButtonInline) {
        restartButtonInline.addEventListener('click', restartGame);
    }
    resetGame();
    bindUi();
    mainMenuOpen = true;
    setGamePaused(true);
    const hud = document.getElementById('gameHudTopLeft');
    if (hud) {
        hud.hidden = true;
    }
    draw();
    if (window.HeartIntro) {
        window.HeartIntro.init({
            // onShowMainMenu : déclenché après l'animation du cœur → affiche le menu sans démarrer la partie
            onShowMainMenu: function () {
                mainMenuOpen = true;
                const menuOverlay = document.getElementById('mainMenuOverlay');
                if (menuOverlay) {
                    menuOverlay.hidden = false;
                    menuOverlay.removeAttribute('hidden');
                }
                setGamePaused(true);
            },
            // onStartGame : utilisé uniquement comme fallback
            onStartGame: startGame,
            ensureAudio: ensureGameAudio,
            playTone: playGameTone
        });
    }
}

function applyGameDifficulty(elapsedMs) {
    const settings = GAME_DIFFICULTY[difficultyLevel] || GAME_DIFFICULTY.normal;
    const progression = constrain(Math.max(0, elapsedMs) / 90000, 0, 1);
    const speedMultiplier = lerp(
        settings.enemyStartSpeed,
        settings.enemyEndSpeed,
        progression
    );
    const aggressionMultiplier = lerp(
        settings.enemyStartAggression,
        settings.enemyEndAggression,
        progression
    );

    whiteCell.energyDrainPerSecond = settings.energyDrain;
    whiteCell.energyPerNutrient = settings.nutrientEnergy;
    whiteCell.damageCooldownDuration = settings.contactCooldown;
    whiteCell.attackCooldownDuration = settings.playerAttackCooldown;
    for (const ally of allies) {
        ally.damageCooldownDuration = settings.contactCooldown;
        ally.attackCooldownDuration = settings.allyAttackCooldown;
    }
    for (const bacterium of bacteria) {
        bacterium.setDifficulty(
            speedMultiplier,
            aggressionMultiplier,
            settings.contactCooldown
        );
    }
}

function resetGame() {
    const difficultySelect = document.getElementById('difficultySelect');
    difficultyLevel = difficultySelect && GAME_DIFFICULTY[difficultySelect.value]
        ? difficultySelect.value
        : 'normal';
    const allyCountSlider = document.getElementById('allyCountSlider');
    allyCount = allyCountSlider
        ? constrain(parseInt(allyCountSlider.value, 10) || 2, 2, 4)
        : 2;
    selectedBacterium = null;
    playerKeys.clear();
    playerAttackRequested = false;
    viruses = [];
    virusSpawnIndex = 0;
    virusWarningShown = false;
    virusNearWarningActive = false;
    virusAlertRemainingMs = 0;
    gameNoticeRemainingMs = 0;
    playerSpeedBoostRemainingMs = 0;
    nutrientsCollected = 0;
    nutrientObjectiveComplete = false;
    gameOver = false;
    gamePaused = false;
    gameResult = '';
    visualEffects = [];
    simulationAccumulatorMs = 0;
    gameElapsedMs = 0;
    playerMouseTarget = createVector(width / 2, height / 2);
    score = 0;
    bacteriaDefeated = 0;
    gameEndedAt = 0;

    whiteCell = new WhiteCell(width / 2, height / 2);
    if (lastPointerClientX !== null && lastPointerClientY !== null) {
        updatePlayerMouseTarget({
            clientX: lastPointerClientX,
            clientY: lastPointerClientY
        });
    }
    const speedSlider = document.getElementById('speedSlider');
    const forceSlider = document.getElementById('forceSlider');
    const arriveSlider = document.getElementById('arriveSlider');
    const detectSlider = document.getElementById('detectSlider');
    if (speedSlider) {
        whiteCell.maxSpeed = parseFloat(speedSlider.value);
    }
    if (forceSlider) {
        whiteCell.maxForce = parseFloat(forceSlider.value);
    }
    if (arriveSlider) {
        whiteCell.rayonZoneDeFreinage = parseFloat(arriveSlider.value);
    }
    if (detectSlider) {
        whiteCell.detectionRadius = parseFloat(detectSlider.value);
    }
    createObstacles();
    createVesselPath();
    redBloodCell = new RedCell(vesselPath);
    createAllies();
    createNutrients();
    createPowerUps();
    createBacteria();
    createViruses();
    applyGameDifficulty(0);
    evolutionDemo = new BacteriaEvolution(obstacles);
    const evolutionToggle = document.getElementById('evolutionToggle');
    evolutionDemo.setEnabled(Boolean(evolutionToggle && evolutionToggle.checked));
    superVirusDemo = new SuperVirusNeuroEvolution(obstacles);
    const neuroToggle = document.getElementById('neuroToggle');
    superVirusDemo.setEnabled(Boolean(neuroToggle && neuroToggle.checked));
    const neuroDebugToggle = document.getElementById('neuroDebugToggle');
    superVirusDemo.debug = Boolean(neuroDebugToggle && neuroDebugToggle.checked);
    createBioBackground();
    leaderFollowingDemo = new LeaderFollowingDemo(leaderFollowingOptions);
    const leaderFollowingToggle = document.getElementById('leaderFollowingToggle');
    if (leaderFollowingToggle && leaderFollowingToggle.checked) {
        leaderFollowingDemo.setEnabled(true, obstacles, leaderFollowingAvoidEntities());
    }
    updateLeaderFollowingStatus();
    const overlay = document.getElementById('defeatOverlay');
    if (overlay) {
        overlay.hidden = true;
    }
    const virusAlert = document.getElementById('virusAlert');
    if (virusAlert) {
        virusAlert.hidden = true;
        virusAlert.textContent = '';
    }
    const gameNotice = document.getElementById('gameNotice');
    if (gameNotice) {
        gameNotice.hidden = true;
        gameNotice.textContent = '';
    }
    updateStats();
    updateAllyCommandStatus();
    updatePauseButton();
    loop();
}

function createVesselPath() {
    const points = [
        [0.08, 0.30], [0.17, 0.19], [0.32, 0.16], [0.43, 0.25],
        [0.50, 0.38], [0.65, 0.39], [0.78, 0.27], [0.90, 0.31],
        [0.92, 0.49], [0.82, 0.63], [0.68, 0.67], [0.57, 0.79],
        [0.42, 0.82], [0.31, 0.71], [0.19, 0.69], [0.10, 0.57]
    ];
    const margin = 38;
    vesselPath = points.map(([x, y]) => createVector(
        constrain(width * x, margin, width - margin),
        constrain(height * y, margin, height - margin)
    ));
}

function drawVesselPath() {
    if (vesselPath.length < 3) {
        return;
    }

    push();
    noFill();
    stroke(112, 34, 58, 115);
    strokeWeight(34);
    strokeJoin(ROUND);
    beginShape();
    curveVertex(vesselPath[vesselPath.length - 2].x, vesselPath[vesselPath.length - 2].y);
    curveVertex(vesselPath[vesselPath.length - 1].x, vesselPath[vesselPath.length - 1].y);
    for (const point of vesselPath) {
        curveVertex(point.x, point.y);
    }
    for (let i = 0; i < 2; i++) {
        const point = vesselPath[i];
        curveVertex(point.x, point.y);
    }
    endShape();

    stroke(204, 81, 112, 85);
    strokeWeight(2);
    beginShape();
    curveVertex(vesselPath[vesselPath.length - 2].x, vesselPath[vesselPath.length - 2].y);
    curveVertex(vesselPath[vesselPath.length - 1].x, vesselPath[vesselPath.length - 1].y);
    for (const point of vesselPath) {
        curveVertex(point.x, point.y);
    }
    for (let i = 0; i < 2; i++) {
        const point = vesselPath[i];
        curveVertex(point.x, point.y);
    }
    endShape();
    pop();
}

function createObstacles() {
    const scale = constrain(Math.min(width, height) / 780, 0.70, 1.35);

    // Arène biologique immersive (Cavité ventriculaire / Chambre vasculaire) :
    // - Grandes masses tissulaires d'angle (parois myocardiques et piliers trabéculaires)
    // - Éperons latéraux et chicanes valvulaires créant des défilés et corridors naturels
    // - Espace central ouvert de plus de 380px de diamètre pour les combats
    // - Passages et corridors périphériques garantis d'au moins 135-160px de largeur libre
    if (width < 600) {
        obstacles = [
            new Obstacle(width * 0.18, height * 0.18, 56 * scale, 'myocardium'),
            new Obstacle(width * 0.82, height * 0.18, 54 * scale, 'fibrous'),
            new Obstacle(width * 0.18, height * 0.82, 54 * scale, 'lipid'),
            new Obstacle(width * 0.82, height * 0.82, 56 * scale, 'septum'),
            new Obstacle(width * 0.50, height * 0.10, 44 * scale, 'fibrous'),
            new Obstacle(width * 0.50, height * 0.90, 44 * scale, 'lipid')
        ];
        return;
    }

    obstacles = [
        // ── 1. Coin supérieur gauche : amas myocardique antéro-supérieur (grande masse)
        new Obstacle(width * 0.15, height * 0.13, 105 * scale, 'myocardium'),

        // ── 2. Coin supérieur droit : paroi fibreuse postéro-supérieure (grande masse)
        new Obstacle(width * 0.85, height * 0.13, 105 * scale, 'fibrous'),

        // ── 3. Coin inférieur gauche : pilier trabéculaire antéro-inférieur (grande masse)
        new Obstacle(width * 0.15, height * 0.87, 105 * scale, 'lipid'),

        // ── 4. Coin inférieur droit : nodule septal postéro-inférieur (grande masse)
        new Obstacle(width * 0.85, height * 0.87, 105 * scale, 'septum'),

        // ── 5. Flanc ouest : promontoire musculaire latéral gauche
        new Obstacle(width * 0.07, height * 0.50, 68 * scale, 'myocardium'),

        // ── 6. Flanc est : promontoire fibreux latéral droit
        new Obstacle(width * 0.93, height * 0.50, 68 * scale, 'fibrous'),

        // ── 7. Sommet central : valve septale supérieure (chicane nord)
        new Obstacle(width * 0.50, height * 0.07, 68 * scale, 'septum'),

        // ── 8. Base centrale : crête myocardique inférieure (chicane sud)
        new Obstacle(width * 0.50, height * 0.93, 68 * scale, 'myocardium')
    ];
}

function createAllies(count = allyCount) {
    allies = [];
    for (let role = 1; role <= count; role++) {
        spawnAlly(role);
    }
}

function spawnAlly(role) {
    const ally = new WhiteCell(width / 2, height / 2, true);
    ally.allyRole = role;
    ally.maxSpeed = 3.2;
    ally.maxForce = 0.22;
    let placed = false;

    for (let attempt = 0; attempt < 120; attempt++) {
        const candidate = createVector(
            random(ally.r + 8, width - ally.r - 8),
            random(ally.r + 8, height - ally.r - 8)
        );
        const clearOfPlayer = candidate.dist(whiteCell.pos) >= whiteCell.r + ally.r + 42;
        const clearOfAllies = allies.every(other =>
            candidate.dist(other.pos) >= ally.r + other.r + 24
        );
        const clearOfObstacles = obstacles.every(obstacle =>
            candidate.dist(obstacle.pos) >= ally.r + obstacle.r + 12
        );
        if (clearOfPlayer && clearOfAllies && clearOfObstacles) {
            ally.pos.set(candidate);
            placed = true;
            break;
        }
    }

    if (!placed) {
        const step = ally.r * 2 + 16;
        for (let y = ally.r + 8; y <= height - ally.r - 8 && !placed; y += step) {
            for (let x = ally.r + 8; x <= width - ally.r - 8; x += step) {
                const candidate = createVector(x, y);
                if (candidate.dist(whiteCell.pos) >= whiteCell.r + ally.r + 42
                    && allies.every(other => candidate.dist(other.pos) >= ally.r + other.r + 24)
                    && obstacles.every(obstacle => candidate.dist(obstacle.pos) >= ally.r + obstacle.r + 12)) {
                    ally.pos.set(candidate);
                    placed = true;
                    break;
                }
            }
        }
    }

    if (placed) {
        allies.push(ally);
    }
    return placed;
}

function resizeAllyTeam(count) {
    allyCount = constrain(count, 2, 4);
    while (allies.length > allyCount) {
        allies.pop();
    }
    for (let role = allies.length + 1; role <= allyCount; role++) {
        spawnAlly(role);
    }
    updateStats();
    updateAllyCommandStatus();
}

function createNutrients() {
    nutrients = [];
    const initialCount = 7;
    for (let i = 0; i < initialCount; i++) {
        const nutrient = new Nutrient();
        nutrient.trySpawn(obstacles, nutrients, whiteCell.pos);
        nutrients.push(nutrient);
    }
}

function createPowerUps() {
    powerUps = [new PowerUp('shield'), new PowerUp('speed')];
    for (const powerUp of powerUps) {
        powerUp.trySpawn(obstacles, powerUps, whiteCell.pos);
    }
}

function applyConfiguredPlayerSpeed() {
    if (!whiteCell) {
        return;
    }
    const speedSlider = document.getElementById('speedSlider');
    const baseSpeed = speedSlider ? parseFloat(speedSlider.value) : 4;
    whiteCell.maxSpeed = baseSpeed * (playerSpeedBoostRemainingMs > 0 ? 1.35 : 1);
}

function createBacteria() {
    bacteria = [];
    const initialCount = GAME_DIFFICULTY[difficultyLevel].bacteriaCount;
    let attempts = 0;
    while (bacteria.length < initialCount && attempts < 200) {
        attempts++;
        const bacterium = new Bacteria(width / 2, height / 2);
        bacterium.flockWeights = { ...flockWeights };
        bacterium.health = 3;
        bacterium.maxHealth = 3;
        if (bacterium.trySpawn(obstacles, bacteria, whiteCell.pos)
            && allies.every(ally => bacterium.pos.dist(ally.pos) >= bacterium.r + ally.r + 20)) {
            bacteria.push(bacterium);
        }
    }
}

function createViruses() {
    viruses = [];
    const count = difficultyLevel === 'easy' ? 1 : (difficultyLevel === 'normal' ? 2 : 3);
    for (let i = 0; i < count; i++) {
        try {
            const v = spawnVirus(viruses);
            viruses.push(v);
        } catch (err) {
            console.warn('Spawn initial virus fallback:', err);
        }
    }
}

function spawnVirus(existingViruses = viruses) {
    const margin = 32;
    const minimumDistance = Math.min(
        320,
        Math.max(180, Math.min(width, height) * 0.36)
    );
    let safestPosition = null;
    let safestScore = -Infinity;

    for (let attempt = 0; attempt < 140; attempt++) {
        const side = Math.floor(random(4));
        const candidate = side === 0
            ? createVector(margin, random(margin, height - margin))
            : side === 1
                ? createVector(width - margin, random(margin, height - margin))
                : side === 2
                    ? createVector(random(margin, width - margin), margin)
                    : createVector(random(margin, width - margin), height - margin);

        const playerDistance = candidate.dist(whiteCell.pos);

        // Distance minimale avec les alliés pour éviter d'apparaître sur eux
        let alliesPenalty = 0;
        if (allies && allies.length > 0) {
            for (const ally of allies) {
                if (ally && (ally.health === undefined || ally.health > 0)) {
                    const distToAlly = candidate.dist(ally.pos);
                    if (distToAlly < 160) {
                        alliesPenalty += (160 - distToAlly);
                    }
                }
            }
        }

        // Distance de sécurité avec les obstacles
        let clearancePenalty = 0;
        for (const obstacle of obstacles) {
            const clearance = candidate.dist(obstacle.pos) - obstacle.r - 22;
            if (clearance < 16) {
                clearancePenalty += (16 - clearance);
            }
        }

        // Espacement mutuel avec les autres virus en jeu pour éviter toute superposition
        let separationPenalty = 0;
        for (const otherV of existingViruses) {
            const distToOther = candidate.dist(otherV.pos);
            if (distToOther < 220) {
                separationPenalty += (220 - distToOther);
            }
        }

        const score = playerDistance - clearancePenalty * 5 - separationPenalty * 4 - alliesPenalty * 3;
        if (score > safestScore) {
            safestPosition = candidate;
            safestScore = score;
        }

        if (playerDistance >= minimumDistance
            && alliesPenalty === 0
            && clearancePenalty === 0
            && separationPenalty === 0) {
            return new Virus(candidate.x, candidate.y);
        }
    }

    if (!safestPosition) {
        safestPosition = createVector(margin + 20, margin + 20);
    }
    return new Virus(safestPosition.x, safestPosition.y);
}

function leaderFollowingAvoidEntities() {
    return [whiteCell, ...allies, ...bacteria, ...nutrients, redBloodCell]
        .filter(entity => entity && entity.active !== false);
}

function updateLeaderFollowingStatus() {
    const status = document.getElementById('leaderFollowingStatus');
    if (status) {
        status.textContent = leaderFollowingDemo
            ? leaderFollowingDemo.status
            : 'Démonstration désactivée.';
    }
}

function closestEntity(origin, entities) {
    let closest = null;
    let closestDistance = Infinity;
    for (const entity of entities) {
        if (entity.active === false) {
            continue;
        }
        const distance = origin.pos.dist(entity.pos);
        if (distance < closestDistance) {
            closest = entity;
            closestDistance = distance;
        }
    }
    return { entity: closest, distance: closestDistance };
}

function applyAllyDecision(ally) {
    const companions = [whiteCell, ...allies];
    const commanded = selectedBacterium
        && bacteria.includes(selectedBacterium)
        && selectedBacterium.health > 0;
    const maxTargetDistance = Math.hypot(width, height) * 0.75;
    const isAccessibleTarget = bacterium =>
        bacterium
        && bacteria.includes(bacterium)
        && bacterium.health > 0
        && ally.pos.dist(bacterium.pos) <= maxTargetDistance;
    const assignmentPenalty = Math.max(180, ally.r * 8);
    const targetScore = bacterium => {
        const assignedAllies = allies.filter(other =>
            other !== ally && other.targetBacterium === bacterium
        ).length;
        return ally.pos.dist(bacterium.pos) + assignedAllies * assignmentPenalty;
    };

    let target = commanded ? selectedBacterium : ally.targetBacterium;
    if (!commanded) {
        if (!isAccessibleTarget(target)) {
            target = null;
        }

        let bestTarget = null;
        let bestScore = Infinity;
        for (const bacterium of bacteria) {
            if (!isAccessibleTarget(bacterium)) {
                continue;
            }
            const score = targetScore(bacterium);
            if (score < bestScore) {
                bestTarget = bacterium;
                bestScore = score;
            }
        }

        if (!target || (bestTarget && bestTarget !== target
            && bestScore + 90 < targetScore(target))) {
            target = bestTarget;
        }
    }

    ally.targetBacterium = target;
    updateAllyCommandStatus();
    if (target) {
        ally.applyAllyBehaviors(commanded ? 'command' : 'pursue', target, obstacles, companions);
        return;
    }

    if (ally.allyRole === 1) {
        ally.applyAllyBehaviors('leader', whiteCell, obstacles, companions);
        return;
    }
    const nutrientTarget = closestEntity(ally, nutrients);
    const mode = nutrientTarget.entity ? 'arrive' : 'wander';
    ally.applyAllyBehaviors(
        mode,
        nutrientTarget.entity ? nutrientTarget.entity.pos : null,
        obstacles,
        companions
    );
}

function removeBacterium(index) {
    if (index < 0 || index >= bacteria.length) {
        return false;
    }
    const removed = bacteria[index];
    spawnVisualEffect(removed.pos, [255, 91, 145], 18, 78);
    bacteria.splice(index, 1);
    if (selectedBacterium === removed) {
        selectedBacterium = null;
        updateAllyCommandStatus();
    }
    for (const ally of allies) {
        if (ally.targetBacterium === removed) {
            ally.targetBacterium = null;
        }
    }
    bacteriaDefeated++;
    score += 10;
    playGameTone(720, 170, 'sine', 980);
    return true;
}

function resolveAttacks(attacker, preferredTarget = null) {
    const targetIndex = attacker.attackBacteria(bacteria, preferredTarget);
    if (targetIndex >= 0) {
        const target = bacteria[targetIndex];
        spawnVisualEffect(target.pos, [255, 165, 123], 7, 36);
        playGameTone(attacker.isAlly ? 330 : 420, 75, 'triangle', 250);
        if (target.health <= 0) {
            removeBacterium(targetIndex);
        }
    }
}

function resolveBacteriaContacts() {
    const settings = GAME_DIFFICULTY[difficultyLevel] || GAME_DIFFICULTY.normal;
    for (const bacterium of bacteria) {
        if (bacterium.damageCooldown > 0) {
            continue;
        }
        const targets = [whiteCell, ...allies];
        let victim = null;
        let nearestDistance = Infinity;
        for (const target of targets) {
            const distance = target.pos.dist(bacterium.pos);
            if (distance <= target.r + bacterium.r
                && distance < nearestDistance
                && target.damageCooldown <= 0
                && (!target.isAlly || target.health > 0)) {
                victim = target;
                nearestDistance = distance;
            }
        }
        if (victim) {
            const damageApplied = victim.takeDamage(settings.contactDamage);
            bacterium.damageCooldown = settings.contactCooldown;
            if (damageApplied) {
                spawnVisualEffect(victim.pos, [255, 82, 132], 8, 42);
                playGameTone(190, 120, 'triangle', 105);
            }
        }
    }
}

function collectNutrientAt(cell, nutrient) {
    if (!nutrient.active
        || cell.pos.dist(nutrient.pos) > cell.r + nutrient.r
        || !nutrient.consume()) {
        return false;
    }
    score++;
    whiteCell.absorbNutrient();
    if (cell === whiteCell) {
        nutrientsCollected++;
        playGameTone(540, 110, 'sine', 760);
        if (!nutrientObjectiveComplete && nutrientsCollected >= NUTRIENT_OBJECTIVE_GOAL) {
            nutrientObjectiveComplete = true;
            score += 25;
            showGameNotice('Objectif accompli · bonus de 25 points.');
            playGameTone(680, 280, 'sine', 1040);
        }
    }
    return true;
}

function collectPowerUpAt(powerUp) {
    if (!powerUp.active
        || whiteCell.pos.dist(powerUp.pos) > whiteCell.r + powerUp.r
        || !powerUp.consume()) {
        return false;
    }

    if (powerUp.type === 'shield') {
        whiteCell.shieldRemainingMs = Math.max(whiteCell.shieldRemainingMs, 7000);
        showGameNotice('Bouclier activé · protection pendant 7 s.');
        playGameTone(700, 240, 'sine', 980);
    } else {
        playerSpeedBoostRemainingMs = Math.max(playerSpeedBoostRemainingMs, 8000);
        applyConfiguredPlayerSpeed();
        showGameNotice('Accélération activée · vitesse +35 % pendant 8 s.');
        playGameTone(510, 240, 'triangle', 910);
    }
    score += 5;
    return true;
}

function showGameNotice(message, durationMs = 2600) {
    const notice = document.getElementById('gameNotice');
    if (!notice) {
        return;
    }
    notice.textContent = message;
    notice.hidden = false;
    gameNoticeRemainingMs = durationMs;
}

function updateGameNotice(elapsedMs) {
    gameNoticeRemainingMs = Math.max(0, gameNoticeRemainingMs - elapsedMs);
    if (gameNoticeRemainingMs === 0) {
        const notice = document.getElementById('gameNotice');
        if (notice) {
            notice.hidden = true;
        }
    }
}

function createBioBackground() {
    // Délègue entièrement au module BioArena (js/BioArena.js)
    // → couche statique haute fidélité (vaisseaux, capillaires, tissu, cellules secondaires)
    // → particules animées (globules rouges décoratifs, plasma, lymphe, plaquettes)
    // Aucun impact sur le gameplay, les collisions ou l'IA.
    _bio.build(width, height);
    // bioTexture conservé à null : drawStatic() utilise le graphique interne de _bio
    bioTexture = null;
    ambientParticles = []; // vidé ; les particules sont gérées par _bio
}

function setGamePaused(paused) {
    const nextPaused = Boolean(paused);
    if (nextPaused === gamePaused) {
        return;
    }
    gamePaused = nextPaused;
    if (gamePaused) {
        playerKeys.clear();
        playerAttackRequested = false;
    }
    simulationAccumulatorMs = 0;
    updatePauseButton();
    const pauseOverlay = document.getElementById('pauseOverlay');
    if (pauseOverlay) {
        pauseOverlay.hidden = !gamePaused || mainMenuOpen || gameOver;
    }
    if (gamePaused) {
        noLoop();
    } else if (!gameOver || (superVirusDemo && superVirusDemo.enabled)) {
        loop();
    }
}

function startGame() {
    if (!mainMenuOpen && !gamePaused) {
        return; // Protection contre les démarrages multiples répétés
    }
    mainMenuOpen = false;
    const controlsModal = document.getElementById('heartControlsModal');
    if (controlsModal) {
        controlsModal.hidden = true;
    }
    const heartOverlay = document.getElementById('heartIntroOverlay');
    if (heartOverlay) {
        heartOverlay.hidden = true;
        heartOverlay.style.display = 'none';
    }
    const hud = document.getElementById('gameHudTopLeft');
    if (hud) {
        hud.hidden = false;
    }
    const menuOverlay = document.getElementById('mainMenuOverlay');
    const pauseOverlay = document.getElementById('pauseOverlay');
    const resultOverlay = document.getElementById('defeatOverlay');
    const settingsReturnButton = document.getElementById('settingsMenuReturnButton');
    if (menuOverlay) {
        menuOverlay.hidden = true;
    }
    if (pauseOverlay) {
        pauseOverlay.hidden = true;
    }
    if (resultOverlay) {
        resultOverlay.hidden = true;
    }
    if (settingsReturnButton) {
        settingsReturnButton.hidden = true;
    }
    resetGame();
    gamePaused = false;
    updatePauseButton();
    loop();
}

/**
 * restartGame — Redémarre une partie depuis l'écran de fin de partie.
 * startGame() est bloquée par sa garde (!mainMenuOpen && !gamePaused) lorsque
 * la partie se termine via endGame() : ni mainMenuOpen ni gamePaused ne sont
 * positionnés à true. On réinitialise ces deux drapeaux avant de déléguer
 * intégralement à startGame(), qui gère déjà overlays, resetGame() et loop().
 */
function restartGame() {
    gameOver = false;
    mainMenuOpen = true;
    startGame();
}

function returnToMainMenu() {
    mainMenuOpen = true;
    gamePaused = true;
    playerKeys.clear();
    playerAttackRequested = false;
    const menuOverlay = document.getElementById('mainMenuOverlay');
    const pauseOverlay = document.getElementById('pauseOverlay');
    const resultOverlay = document.getElementById('defeatOverlay');
    if (menuOverlay) {
        menuOverlay.hidden = false;
    }
    if (pauseOverlay) {
        pauseOverlay.hidden = true;
    }
    if (resultOverlay) {
        resultOverlay.hidden = true;
    }
    updatePauseButton();
    noLoop();
    draw();
}

function updatePauseButton() {
    const button = document.getElementById('pauseButton');
    if (!button) {
        return;
    }
    button.textContent = gamePaused ? 'Reprendre' : 'Pause';
    button.setAttribute('aria-pressed', String(gamePaused));
}

function spawnVisualEffect(position, rgb, count = 9, speed = 48) {
    if (!visualEffectsEnabled || !position) {
        return;
    }
    for (let i = 0; i < count && visualEffects.length < 180; i++) {
        const angle = random(TWO_PI);
        const magnitude = random(speed * 0.35, speed);
        visualEffects.push({
            x: position.x,
            y: position.y,
            vx: Math.cos(angle) * magnitude,
            vy: Math.sin(angle) * magnitude,
            radius: random(1.5, 3.5),
            life: random(0.35, 0.7),
            maxLife: 0.7,
            rgb
        });
    }
}

function updateVisualEffects(elapsedMs) {
    if (!visualEffectsEnabled) {
        visualEffects = [];
        return;
    }
    const seconds = Math.max(0, elapsedMs) / 1000;
    for (let i = visualEffects.length - 1; i >= 0; i--) {
        const particle = visualEffects[i];
        particle.x += particle.vx * seconds;
        particle.y += particle.vy * seconds;
        particle.vx *= Math.pow(0.08, seconds);
        particle.vy *= Math.pow(0.08, seconds);
        particle.life -= seconds;
        if (particle.life <= 0) {
            visualEffects.splice(i, 1);
        }
    }
}

function drawVisualEffects() {
    if (!visualEffectsEnabled) {
        return;
    }
    noStroke();
    for (const particle of visualEffects) {
        const alpha = 210 * constrain(particle.life / particle.maxLife, 0, 1);
        fill(particle.rgb[0], particle.rgb[1], particle.rgb[2], alpha);
        circle(particle.x, particle.y, particle.radius * 2);
    }
}

function bindUi() {
    const settingsToggle = document.getElementById('settingsToggle');
    const settingsPanel = document.getElementById('ui');
    if (settingsToggle && settingsPanel) {
        settingsToggle.addEventListener('click', () => {
            const isHidden = settingsPanel.classList.toggle('is-hidden');
            settingsToggle.setAttribute('aria-expanded', String(!isHidden));
            settingsToggle.textContent = isHidden
                ? 'Afficher les paramètres'
                : 'Masquer les paramètres';
        });
    }

    const playButton = document.getElementById('playButton');
    if (playButton) {
        playButton.addEventListener('click', startGame);
    }

    const menuControlsBtn = document.getElementById('menuControlsButton');
    const controlsModal = document.getElementById('heartControlsModal');
    const closeControlsBtn = document.getElementById('closeControlsModalBtn');
    const modalReturnBtn = document.getElementById('modalReturnBtn');
    const modalStartBtn = document.getElementById('modalStartBtn');

    if (menuControlsBtn && controlsModal) {
        menuControlsBtn.addEventListener('click', () => {
            controlsModal.hidden = false;
        });
    }
    if (closeControlsBtn && controlsModal) {
        closeControlsBtn.addEventListener('click', () => {
            controlsModal.hidden = true;
        });
    }
    if (modalReturnBtn && controlsModal) {
        modalReturnBtn.addEventListener('click', () => {
            controlsModal.hidden = true;
        });
    }
    if (modalStartBtn) {
        modalStartBtn.addEventListener('click', () => {
            if (controlsModal) controlsModal.hidden = true;
            startGame();
        });
    }
    if (controlsModal) {
        controlsModal.addEventListener('click', (e) => {
            if (e.target === controlsModal) {
                controlsModal.hidden = true;
            }
        });
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Escape' && !controlsModal.hidden) {
                controlsModal.hidden = true;
            }
        });
    }
    const menuSettingsButton = document.getElementById('menuSettingsButton');
    const menuOverlay = document.getElementById('mainMenuOverlay');
    const settingsReturnButton = document.getElementById('settingsMenuReturnButton');
    if (menuSettingsButton && settingsPanel && settingsToggle) {
        menuSettingsButton.addEventListener('click', () => {
            if (menuOverlay) {
                menuOverlay.hidden = true;
            }
            settingsPanel.classList.remove('is-hidden');
            settingsToggle.setAttribute('aria-expanded', 'true');
            settingsToggle.textContent = 'Masquer les paramètres';
            if (settingsReturnButton) {
                settingsReturnButton.hidden = false;
                settingsReturnButton.focus();
            }
        });
    }
    if (settingsReturnButton && menuOverlay) {
        settingsReturnButton.addEventListener('click', () => {
            settingsReturnButton.hidden = true;
            menuOverlay.hidden = false;
            mainMenuOpen = true;
            noLoop();
            draw();
        });
    }
    const resumeButton = document.getElementById('resumeButton');
    if (resumeButton) {
        resumeButton.addEventListener('click', () => setGamePaused(false));
    }
    const pauseMenuButton = document.getElementById('pauseMenuButton');
    const resultMenuButton = document.getElementById('resultMenuButton');
    if (pauseMenuButton) {
        pauseMenuButton.addEventListener('click', returnToMainMenu);
    }
    if (resultMenuButton) {
        resultMenuButton.addEventListener('click', returnToMainMenu);
    }

    const pauseButton = document.getElementById('pauseButton');
    if (pauseButton) {
        pauseButton.addEventListener('click', () => setGamePaused(!gamePaused));
    }
    const reducedEffectsToggle = document.getElementById('reducedEffectsToggle');
    if (reducedEffectsToggle) {
        visualEffectsEnabled = !reducedEffectsToggle.checked;
        reducedEffectsToggle.addEventListener('change', () => {
            visualEffectsEnabled = !reducedEffectsToggle.checked;
            if (!visualEffectsEnabled) {
                visualEffects = [];
                ambientParticles = [];
            } else {
                // Reconstruire le fond biologique si les effets sont réactivés
                createBioBackground();
            }
        });
    }

    const soundToggle = document.getElementById('soundToggle');
    if (soundToggle) {
        soundEnabled = soundToggle.checked;
        soundToggle.addEventListener('change', () => {
            soundEnabled = soundToggle.checked;
            if (soundEnabled) {
                ensureGameAudio();
                playGameTone(520, 80, 'sine', 620);
            }
        });
    }
    const volumeSlider = document.getElementById('volumeSlider');
    const volumeDisplay = document.getElementById('volumeVal');
    if (volumeSlider && volumeDisplay) {
        gameVolume = parseFloat(volumeSlider.value) / 100;
        volumeDisplay.textContent = `${volumeSlider.value}%`;
        volumeSlider.addEventListener('input', () => {
            gameVolume = parseFloat(volumeSlider.value) / 100;
            volumeDisplay.textContent = `${volumeSlider.value}%`;
        });
    }

    const difficultySelect = document.getElementById('difficultySelect');
    if (difficultySelect) {
        difficultySelect.value = difficultyLevel;
        difficultySelect.addEventListener('change', () => {
            if (!GAME_DIFFICULTY[difficultySelect.value]) {
                return;
            }
            difficultyLevel = difficultySelect.value;
            applyGameDifficulty(gameElapsedMs);
        });
    }

    const allyCountSlider = document.getElementById('allyCountSlider');
    const allyCountDisplay = document.getElementById('allyCountVal');
    if (allyCountSlider && allyCountDisplay) {
        allyCountSlider.value = String(allyCount);
        allyCountDisplay.textContent = String(allyCount);
        allyCountSlider.addEventListener('input', () => {
            const requestedCount = parseInt(allyCountSlider.value, 10);
            allyCountDisplay.textContent = String(requestedCount);
            resizeAllyTeam(requestedCount);
        });
    }

    const neuroToggle = document.getElementById('neuroToggle');
    if (neuroToggle) {
        neuroToggle.addEventListener('change', () => {
            superVirusDemo.setEnabled(neuroToggle.checked);
            if (gameOver) {
                if (neuroToggle.checked && !gamePaused) {
                    loop();
                } else {
                    noLoop();
                }
            }
        });
    }
    const neuroDebugToggle = document.getElementById('neuroDebugToggle');
    if (neuroDebugToggle) {
        neuroDebugToggle.addEventListener('change', () => {
            superVirusDemo.debug = neuroDebugToggle.checked;
        });
    }
    const neuroResetButton = document.getElementById('neuroResetButton');
    if (neuroResetButton) {
        neuroResetButton.addEventListener('click', () => {
            superVirusDemo.reset();
            if (neuroToggle) {
                neuroToggle.checked = true;
            }
            superVirusDemo.setEnabled(true);
        });
    }

    const evolutionToggle = document.getElementById('evolutionToggle');
    if (evolutionToggle) {
        evolutionToggle.addEventListener('change', () => {
            evolutionDemo.setEnabled(evolutionToggle.checked);
        });
    }
    const evolutionResetButton = document.getElementById('evolutionResetButton');
    if (evolutionResetButton) {
        evolutionResetButton.addEventListener('click', () => {
            evolutionDemo.resetPopulation();
            if (evolutionToggle) {
                evolutionToggle.checked = true;
            }
            evolutionDemo.setEnabled(true);
        });
    }

    const speedSlider = document.getElementById('speedSlider');
    const speedDisplay = document.getElementById('speedVal');
    if (speedSlider && speedDisplay) {
        speedSlider.addEventListener('input', () => {
            applyConfiguredPlayerSpeed();
            speedDisplay.innerText = speedSlider.value;
        });
        applyConfiguredPlayerSpeed();
        speedDisplay.innerText = speedSlider.value;
    }

    const forceSlider = document.getElementById('forceSlider');
    const forceDisplay = document.getElementById('forceVal');
    if (forceSlider && forceDisplay) {
        forceSlider.addEventListener('input', () => {
            whiteCell.maxForce = parseFloat(forceSlider.value);
            forceDisplay.innerText = whiteCell.maxForce;
        });
        whiteCell.maxForce = parseFloat(forceSlider.value);
    }

    const arriveSlider = document.getElementById('arriveSlider');
    const arriveDisplay = document.getElementById('arriveVal');
    if (arriveSlider && arriveDisplay) {
        arriveSlider.addEventListener('input', () => {
            whiteCell.rayonZoneDeFreinage = parseFloat(arriveSlider.value);
            arriveDisplay.innerText = whiteCell.rayonZoneDeFreinage;
        });
        whiteCell.rayonZoneDeFreinage = parseFloat(arriveSlider.value);
    }

    const detectSlider = document.getElementById('detectSlider');
    const detectDisplay = document.getElementById('detectVal');
    if (detectSlider && detectDisplay) {
        detectSlider.addEventListener('input', () => {
            whiteCell.detectionRadius = parseFloat(detectSlider.value);
            detectDisplay.innerText = whiteCell.detectionRadius;
        });
        whiteCell.detectionRadius = parseFloat(detectSlider.value);
    }

    const flockWeightControls = {
        separation: ['separationWeight', 'separationWeightVal'],
        alignment: ['alignmentWeight', 'alignmentWeightVal'],
        cohesion: ['cohesionWeight', 'cohesionWeightVal']
    };
    for (const [behavior, [inputId, valueId]] of Object.entries(flockWeightControls)) {
        const input = document.getElementById(inputId);
        const display = document.getElementById(valueId);
        if (!input || !display) {
            continue;
        }
        flockWeights[behavior] = parseFloat(input.value);
        display.textContent = flockWeights[behavior].toFixed(1);
        input.addEventListener('input', () => {
            flockWeights[behavior] = parseFloat(input.value);
            display.textContent = flockWeights[behavior].toFixed(1);
            for (const bacterium of bacteria) {
                bacterium.flockWeights = { ...flockWeights };
            }
        });
    }

    const debugToggle = document.getElementById('debugToggle');
    if (debugToggle) {
        Vehicle.debug = debugToggle.checked;
        debugToggle.addEventListener('change', () => {
            Vehicle.debug = debugToggle.checked;
        });
    }

    const pathDebugToggle = document.getElementById('pathDebugToggle');
    if (pathDebugToggle) {
        pathDebug = pathDebugToggle.checked;
        pathDebugToggle.addEventListener('change', () => {
            pathDebug = pathDebugToggle.checked;
        });
    }

    const flockDebugToggles = {
        neighbors: 'flockNeighborsToggle',
        separation: 'separationToggle',
        alignment: 'alignmentToggle',
        cohesion: 'cohesionToggle',
        weights: 'flockWeightsToggle'
    };
    for (const [option, id] of Object.entries(flockDebugToggles)) {
        const toggle = document.getElementById(id);
        if (!toggle) {
            continue;
        }
        flockDebug[option] = toggle.checked;
        toggle.addEventListener('change', () => {
            flockDebug[option] = toggle.checked;
        });
    }

    const leaderFollowingToggle = document.getElementById('leaderFollowingToggle');
    if (leaderFollowingToggle) {
        leaderFollowingToggle.addEventListener('change', () => {
            leaderFollowingDemo.setEnabled(
                leaderFollowingToggle.checked,
                obstacles,
                leaderFollowingAvoidEntities()
            );
            updateLeaderFollowingStatus();
        });
        if (leaderFollowingToggle.checked) {
            leaderFollowingDemo.setEnabled(true, obstacles, leaderFollowingAvoidEntities());
        }
    }

    const leaderFollowingControls = {
        followDistance: ['followDistanceSlider', 'followDistanceVal', false],
        arriveWeight: ['leaderArriveWeightSlider', 'leaderArriveWeightVal', true],
        separationWeight: ['leaderSeparationWeightSlider', 'leaderSeparationWeightVal', true],
        obstacleWeight: ['leaderObstacleWeightSlider', 'leaderObstacleWeightVal', true]
    };
    for (const [setting, [inputId, valueId, decimal]] of Object.entries(leaderFollowingControls)) {
        const input = document.getElementById(inputId);
        const display = document.getElementById(valueId);
        if (!input || !display) {
            continue;
        }
        leaderFollowingOptions[setting] = parseFloat(input.value);
        display.textContent = decimal
            ? leaderFollowingOptions[setting].toFixed(1)
            : String(leaderFollowingOptions[setting]);
        input.addEventListener('input', () => {
            leaderFollowingOptions[setting] = parseFloat(input.value);
            display.textContent = decimal
                ? leaderFollowingOptions[setting].toFixed(1)
                : String(leaderFollowingOptions[setting]);
        });
    }

    const leaderFollowingDebugToggle = document.getElementById('leaderFollowingDebugToggle');
    if (leaderFollowingDebugToggle) {
        leaderFollowingDebug = leaderFollowingDebugToggle.checked;
        leaderFollowingDebugToggle.addEventListener('change', () => {
            leaderFollowingDebug = leaderFollowingDebugToggle.checked;
        });
    }
}

function windowResized() {
    const previousWidth = Math.max(1, width);
    const previousHeight = Math.max(1, height);
    resizeCanvas(window.innerWidth, window.innerHeight);
    if (playerMouseTarget) {
        if (lastPointerClientX !== null && lastPointerClientY !== null) {
            updatePlayerMouseTarget({
                clientX: lastPointerClientX,
                clientY: lastPointerClientY
            });
        } else {
            playerMouseTarget.x *= width / previousWidth;
            playerMouseTarget.y *= height / previousHeight;
        }
    }
    const movingEntities = [whiteCell, ...allies, ...bacteria, redBloodCell, ...viruses]
        .filter(Boolean);
    for (const entity of movingEntities) {
        if (!entity || !entity.pos) {
            continue;
        }
        entity.pos.x = constrain(
            entity.pos.x * width / previousWidth,
            entity.r,
            Math.max(entity.r, width - entity.r)
        );
        entity.pos.y = constrain(
            entity.pos.y * height / previousHeight,
            entity.r,
            Math.max(entity.r, height - entity.r)
        );
    }
    createObstacles();
    createVesselPath();
    redBloodCell.path = vesselPath;
    createBioBackground();
    for (let i = 0; i < nutrients.length; i++) {
        const nutrient = nutrients[i];
        nutrient.active = false;
        nutrient.respawnTimer = 0;
        nutrient.trySpawn(obstacles, nutrients, whiteCell.pos);
    }
    for (const powerUp of powerUps) {
        powerUp.active = false;
        powerUp.respawnTimer = 0;
        powerUp.trySpawn(obstacles, powerUps, whiteCell.pos);
    }
    if (leaderFollowingDemo && leaderFollowingDemo.enabled) {
        leaderFollowingDemo.setEnabled(false, obstacles);
        leaderFollowingDemo.setEnabled(true, obstacles, leaderFollowingAvoidEntities());
        updateLeaderFollowingStatus();
    }
    if (evolutionDemo) {
        evolutionDemo.resize(obstacles);
    }
    if (superVirusDemo) {
        superVirusDemo.resize(obstacles);
    }
}

function updateSimulation(elapsedMs) {
    if (gameOver) {
        if (superVirusDemo && superVirusDemo.enabled) {
            superVirusDemo.update(
                elapsedMs,
                obstacles,
                whiteCell,
                [whiteCell, ...allies.filter(ally => ally.health > 0)],
                nutrients
            );
            updateVisualEffects(elapsedMs);
        }
        return;
    }

    gameElapsedMs += elapsedMs;
    updateAmbientParticles(elapsedMs);
    updateGameNotice(elapsedMs);
    const speedBoostWasActive = playerSpeedBoostRemainingMs > 0;
    playerSpeedBoostRemainingMs = Math.max(
        0,
        playerSpeedBoostRemainingMs - elapsedMs
    );
    applyConfiguredPlayerSpeed();
    if (speedBoostWasActive && playerSpeedBoostRemainingMs === 0) {
        showGameNotice('Accélération terminée.');
    }

    for (let i = 0; i < nutrients.length; i++) {
        const nutrient = nutrients[i];
        nutrient.updateRespawn(elapsedMs, obstacles, nutrients, whiteCell.pos);
        nutrient.update();
        if (collectNutrientAt(whiteCell, nutrient)) {
            continue;
        }
        const collector = allies.find(ally => ally.allyRole === 2);
        if (collector) {
            collectNutrientAt(collector, nutrient);
        }
    }
    for (const powerUp of powerUps) {
        powerUp.updateRespawn(elapsedMs, obstacles, powerUps, whiteCell.pos);
        powerUp.update(elapsedMs);
        collectPowerUpAt(powerUp);
    }

    for (let i = 0; i < obstacles.length; i++) {
        obstacles[i].update();
    }

    redBloodCell.followPath(obstacles);
    redBloodCell.update(elapsedMs);

    applyGameDifficulty(gameElapsedMs);
    for (const bacterium of bacteria) {
        const targets = [whiteCell, ...allies.filter(ally => ally.health > 0)];
        if (!targets.includes(bacterium.combatTarget)) {
            bacterium.combatTarget = closestEntity(bacterium, targets).entity || whiteCell;
        }
        const target = bacterium.combatTarget;
        bacterium.applyBehaviors(obstacles, target, allies, bacteria, whiteCell, nutrients);
    }

    for (const bacterium of bacteria) {
        bacterium.update(elapsedMs, obstacles);
    }
    for (const nutrient of nutrients) {
        if (!nutrient.active) {
            continue;
        }
        const collector = bacteria.find(bacterium =>
            bacterium.pos.dist(nutrient.pos) <= bacterium.r + nutrient.r
        );
        if (collector && nutrient.consume()) {
            collector.resourcesCollected++;
        }
    }

    leaderFollowingDemo.update(obstacles, elapsedMs);

    whiteCell.applyPlayerControl(getPlayerMovementInput(), obstacles);
    whiteCell.update(elapsedMs);

    for (let i = 0; i < allies.length; i++) {
        applyAllyDecision(allies[i]);
        allies[i].update(elapsedMs);
        allies[i].resolvePlayerCollisions(obstacles);
    }
    updateAllyCommandStatus();

    updateVirus(elapsedMs);
    if (gameOver) {
        return;
    }

    resolveBacteriaContacts();
    if (playerAttackRequested) {
        spawnVisualEffect(whiteCell.pos, [120, 240, 255], 12, 55);
        resolveAttacks(whiteCell, selectedBacterium);
        playerAttackRequested = false;
    }
    for (const ally of allies) {
        if (ally.health > 0) {
            resolveAttacks(ally, ally.targetBacterium);
        }
    }

    for (let i = allies.length - 1; i >= 0; i--) {
        const ally = allies[i];
        if (ally.health <= 0) {
            allies.splice(i, 1);
        }
    }
    evolutionDemo.update(elapsedMs, obstacles, whiteCell);
    superVirusDemo.update(
        elapsedMs,
        obstacles,
        whiteCell,
        [whiteCell, ...allies.filter(ally => ally.health > 0)],
        nutrients
    );
    updateVisualEffects(elapsedMs);
    updateStats();
    if (whiteCell.energy <= 0) {
        endGame('defeat');
        return;
    }
    if (bacteria.length === 0) {
        endGame('victory');
    }
}

function advanceSimulationFrame(elapsedMs) {
    if (gamePaused) {
        return 0;
    }
    const frameDelta = Number.isFinite(elapsedMs)
        ? constrain(elapsedMs, 0, SIMULATION_STEP_MS * MAX_SIMULATION_STEPS_PER_FRAME)
        : SIMULATION_STEP_MS;
    simulationAccumulatorMs = Math.min(
        simulationAccumulatorMs + frameDelta,
        SIMULATION_STEP_MS * MAX_SIMULATION_STEPS_PER_FRAME
    );
    let simulationSteps = 0;
    while (simulationAccumulatorMs + 1e-9 >= SIMULATION_STEP_MS
        && simulationSteps < MAX_SIMULATION_STEPS_PER_FRAME) {
        updateSimulation(SIMULATION_STEP_MS);
        simulationAccumulatorMs = Math.max(
            0,
            simulationAccumulatorMs - SIMULATION_STEP_MS
        );
        simulationSteps++;
    }
    return simulationSteps;
}

function draw() {
    if (!gamePaused) {
        advanceSimulationFrame(deltaTime);
    }

    // Couche de fond biologique (BioArena.js — purement cosmétique)
    _bio.drawStatic();
    _bio.updateAndDraw(
        gamePaused ? 0 : SIMULATION_STEP_MS,
        gameElapsedMs,
        visualEffectsEnabled
    );
    drawVesselPath();
    for (const obstacle of obstacles) {
        obstacle.show();
    }
    for (const nutrient of nutrients) {
        nutrient.show();
    }
    for (const powerUp of powerUps) {
        powerUp.show();
    }
    redBloodCell.show();
    if (pathDebug) {
        redBloodCell.showPathDebug();
    }
    for (const v of viruses) {
        v.show();
    }
    for (const bacterium of bacteria) {
        bacterium.show();
        bacterium.showFlockDebug(flockDebug);
    }
    leaderFollowingDemo.show(leaderFollowingDebug);
    updateLeaderFollowingStatus();
    for (const ally of allies) {
        ally.show();
    }
    whiteCell.show();
    drawSelectedBacterium();
    evolutionDemo.show();
    superVirusDemo.show();
    drawVisualEffects();

    const mouseTarget = playerMouseTarget || createVector(mouseX, mouseY);
    if (Vehicle.debug) {
        push();
        noFill();
        stroke(255, 220, 230, 120);
        circle(mouseTarget.x, mouseTarget.y, 10);
        pop();
    }

    // Mini-radar biologique tactique en bas à gauche
    if (_bio && typeof _bio.drawMiniRadar === 'function') {
        _bio.drawMiniRadar(width, height, obstacles, bacteria, allies, viruses, whiteCell);
    }
}

function mousePressed(event) {
    if (gamePaused || gameOver || (event && event.button !== 0)) {
        return;
    }
    const canvas = document.querySelector('#canvas-container canvas');
    if (!canvas || (event && event.target !== canvas)) {
        return;
    }
    canvas.focus();

    let closest = null;
    let closestDistance = Infinity;
    const bounds = canvas.getBoundingClientRect();
    const clickPosition = event
        ? createVector(
            (event.clientX - bounds.left) * width / Math.max(1, bounds.width),
            (event.clientY - bounds.top) * height / Math.max(1, bounds.height)
        )
        : createVector(mouseX, mouseY);
    for (const bacterium of bacteria) {
        const distance = clickPosition.dist(bacterium.pos);
        if (distance <= bacterium.r + 14 && distance < closestDistance) {
            closest = bacterium;
            closestDistance = distance;
        }
    }
    selectedBacterium = closest;
    updateAllyCommandStatus();
}

function drawSelectedBacterium() {
    if (!selectedBacterium || !bacteria.includes(selectedBacterium)) {
        return;
    }
    push();
    noFill();
    stroke(255, 229, 112, 230);
    strokeWeight(3);
    circle(
        selectedBacterium.pos.x,
        selectedBacterium.pos.y,
        (selectedBacterium.r + 12) * 2
    );
    noStroke();
    fill(255, 237, 165, 240);
    textAlign(CENTER, BOTTOM);
    textSize(12);
    text('CIBLE DES ALLIÉS', selectedBacterium.pos.x, selectedBacterium.pos.y - selectedBacterium.r - 15);
    pop();
}

function updateAllyCommandStatus() {
    const status = document.getElementById('allyCommandStatus');
    if (!status) {
        return;
    }
    if (!selectedBacterium || !bacteria.includes(selectedBacterium)) {
        status.textContent = 'Ordre aux alliés : cliquez sur une bactérie pour la désigner comme cible.';
        return;
    }
    const assignedAllies = allies.filter(ally =>
        ally.health > 0 && ally.targetBacterium === selectedBacterium
    ).length;
    status.textContent = `Cible des alliés · Santé ${Math.max(0, selectedBacterium.health)}/${selectedBacterium.maxHealth} · ${assignedAllies} allié(s) en route.`;
}

function drawAmbientParticles() {
    // Particules déléguées à BioArena.js (_bio.updateAndDraw).
    // Conservée pour compatibilité d'appel depuis windowResized / tests.
}

function updateAmbientParticles(elapsedMs) {
    // Mise à jour déléguée à BioArena.js (_bio.updateAndDraw).
    // Conservée pour compatibilité d'appel depuis updateSimulation.
}

function updateVirus(elapsedMs) {
    virusAlertRemainingMs = Math.max(0, virusAlertRemainingMs - elapsedMs);
    if (virusAlertRemainingMs === 0) {
        const alert = document.getElementById('virusAlert');
        if (alert) {
            alert.hidden = true;
        }
    }

    // Nombre maximum de virus selon la difficulté choisie
    const maxViruses = difficultyLevel === 'easy' ? 1 : (difficultyLevel === 'normal' ? 2 : 3);

    // Progression des apparitions selon le calendrier
    if (virusSpawnIndex < maxViruses && virusSpawnIndex < VIRUS_SPAWN_SCHEDULE.length) {
        const nextSchedule = VIRUS_SPAWN_SCHEDULE[virusSpawnIndex];

        // Avertissement d'approche
        if (!virusWarningShown && gameElapsedMs >= nextSchedule.warningMs) {
            virusWarningShown = true;
            const num = virusSpawnIndex + 1;
            showVirusAlert(num === 1
                ? 'Signal viral détecté · apparition imminente.'
                : 'Menace virale accrue · Virus #' + num + ' en approche.');
            playGameTone(310, 460, 'sawtooth', 190);
        }

        // Apparition effective du virus
        if (gameElapsedMs >= nextSchedule.spawnMs) {
            const newVirus = spawnVirus(viruses);
            viruses.push(newVirus);
            virusSpawnIndex++;
            virusWarningShown = false;
            showVirusAlert(viruses.length === 1
                ? 'VIRUS EN APPROCHE · évitez tout contact.'
                : 'NOUVEAU VIRUS ACTIF (' + viruses.length + ' en chasse) · restez vigilants.');
            playGameTone(250, 700, 'sawtooth', 110);
        }
    }

    if (viruses.length === 0) {
        return;
    }

    // Calcul de la distance minimale au joueur pour l'alarme de proximité
    let minDistanceToPlayer = Infinity;
    for (const v of viruses) {
        const d = whiteCell.pos.dist(v.pos);
        if (d < minDistanceToPlayer) {
            minDistanceToPlayer = d;
        }
    }

    if (minDistanceToPlayer < 280 && !virusNearWarningActive) {
        virusNearWarningActive = true;
        showVirusAlert('DANGER · un virus est proche du globule blanc.');
        playGameTone(520, 280, 'square', 260);
    } else if (minDistanceToPlayer > 340) {
        virusNearWarningActive = false;
    }

    // Cibles potentielles : le globule blanc joueur et tous les alliés encore vivants
    const candidateTargets = [whiteCell, ...allies.filter(ally => ally && ally.health > 0)];

    // Mise à jour de la sélection, de la poursuite et des collisions de chaque virus
    for (let i = 0; i < viruses.length; i++) {
        const v = viruses[i];

        // Sélection autonome de cible avec prise en compte des obstacles et hystérésis
        const target = v.selectTarget(candidateTargets, obstacles, elapsedMs);

        // Poursuite vectorielle Reynolds combinée à l'évitement d'obstacles
        v.pursue(target, obstacles);
        v.update(elapsedMs, obstacles);

        // Collision avec le joueur : défaite immédiate
        if (whiteCell.pos.dist(v.pos) <= whiteCell.r + v.r) {
            spawnVisualEffect(whiteCell.pos, [255, 55, 119], 28, 110);
            playGameTone(130, 500, 'sawtooth', 48);
            endGame('virus');
            return;
        }

        // Collision avec les alliés : élimination de l'allié par le virus
        for (const ally of allies) {
            if (ally.health > 0 && ally.pos.dist(v.pos) <= ally.r + v.r) {
                ally.health = 0;
                v.target = null; // Réinitialisation immédiate pour réévaluer sans délai la prochaine cible
                spawnVisualEffect(ally.pos, [255, 60, 120], 24, 90);
                playGameTone(160, 300, 'sawtooth', 75);
                showVirusAlert('Un globule allié a été détruit par un virus !', 2500);
            }
        }
    }
}


function formatSurvivalTime(elapsedMs) {
    const totalSeconds = Math.floor(Math.max(0, elapsedMs) / 1000);
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
}

function endGame(result) {
    if (gameOver) {
        return;
    }
    gameOver = true;
    gameResult = result;
    gameEndedAt = gameElapsedMs;
    const title = document.getElementById('defeatTitle');
    const message = document.getElementById('resultMessage');
    const finalScore = document.getElementById('finalScore');
    const survivalTime = document.getElementById('survivalTime');
    const defeatedCount = document.getElementById('defeatedCount');
    if (title) {
        title.textContent = result === 'victory' ? 'Victoire !' : 'Défaite';
    }
    if (message) {
        message.textContent = result === 'victory'
            ? 'Toutes les bactéries de la vague ont été éliminées.'
            : result === 'virus'
                ? 'Contact direct avec le virus : infection létale et défaite immédiate.'
                : `Le globule blanc a épuisé son énergie (${difficultyLabel()}).`;
    }
    if (finalScore) {
        finalScore.textContent = String(score);
    }
    if (survivalTime) {
        survivalTime.textContent = formatSurvivalTime(gameEndedAt);
    }
    if (defeatedCount) {
        defeatedCount.textContent = String(bacteriaDefeated);
    }
    updateStats();
    const overlay = document.getElementById('defeatOverlay');
    if (overlay) {
        overlay.hidden = false;
    }
    if (!superVirusDemo || !superVirusDemo.enabled) {
        noLoop();
    }
}

function updateStats() {
    const scoreDisplay = document.getElementById('scoreVal');
    const bacteriaDisplay = document.getElementById('bacteriaVal');
    const energyDisplay = document.getElementById('energyVal');
    const energyMeter = document.getElementById('energyMeter');
    const elapsedDisplay = document.getElementById('elapsedTime');
    const alliesDisplay = document.getElementById('alliesVal');
    const alliesHealthDisplay = document.getElementById('alliesHealthVal');
    const nutrientsDisplay = document.getElementById('nutrientsVal');
    const difficultyDisplay = document.getElementById('difficultyVal');
    const attackCooldownDisplay = document.getElementById('attackCooldownVal');
    const specialStatusDisplay = document.getElementById('specialStatusVal');
    const virusStatusDisplay = document.getElementById('virusStatusVal');
    const bonusStatusDisplay = document.getElementById('bonusStatusVal');
    const objectiveStatus = document.getElementById('objectiveStatus');
    if (scoreDisplay) {
        scoreDisplay.textContent = String(score);
    }
    if (bacteriaDisplay) {
        bacteriaDisplay.textContent = String(bacteria.length);
    }
    if (alliesDisplay) {
        alliesDisplay.textContent = String(allies.length);
    }
    if (alliesHealthDisplay) {
        const health = allies.reduce((total, ally) => total + ally.health, 0);
        const maximumHealth = allies.reduce((total, ally) => total + ally.maxHealth, 0);
        alliesHealthDisplay.textContent = `${Math.round(health)} / ${Math.round(maximumHealth)}`;
    }
    if (nutrientsDisplay) {
        nutrientsDisplay.textContent = String(nutrients.filter(nutrient => nutrient.active).length);
    }
    if (difficultyDisplay) {
        difficultyDisplay.textContent = difficultyLabel();
    }
    if (energyDisplay) {
        energyDisplay.textContent = `${Math.round(whiteCell.energy)}%`;
    }
    if (energyMeter) {
        energyMeter.value = whiteCell.energy;
        energyMeter.setAttribute('aria-valuenow', String(Math.round(whiteCell.energy)));
    }
    if (elapsedDisplay) {
        const elapsed = gameOver ? gameEndedAt : gameElapsedMs;
        elapsedDisplay.textContent = formatSurvivalTime(elapsed);
    }
    if (attackCooldownDisplay) {
        attackCooldownDisplay.textContent = whiteCell.attackCooldown > 0
            ? `${(whiteCell.attackCooldown / 1000).toFixed(1)} s`
            : 'Prête';
    }
    if (specialStatusDisplay) {
        specialStatusDisplay.textContent = whiteCell.shieldRemainingMs > 0
            ? `Bouclier ${(whiteCell.shieldRemainingMs / 1000).toFixed(1)} s`
            : whiteCell.specialCooldownRemainingMs > 0
                ? `${(whiteCell.specialCooldownRemainingMs / 1000).toFixed(1)} s`
                : 'Prête';
    }
    if (virusStatusDisplay) {
        if (viruses.length > 0) {
            virusStatusDisplay.textContent = viruses.length === 1 ? '1 actif (en chasse)' : viruses.length + ' actifs (en meute)';
        } else if (virusWarningShown) {
            virusStatusDisplay.textContent = 'Apparition imminente';
        } else {
            const nextSched = VIRUS_SPAWN_SCHEDULE[virusSpawnIndex] || VIRUS_SPAWN_SCHEDULE[0];
            const remainingSec = Math.ceil(Math.max(0, nextSched.spawnMs - gameElapsedMs) / 1000);
            virusStatusDisplay.textContent = 'Signal dans ' + remainingSec + ' s';
        }
    }
    if (bonusStatusDisplay) {
        const activeBonuses = [];
        if (whiteCell.shieldRemainingMs > 0) {
            activeBonuses.push(`Bouclier ${(whiteCell.shieldRemainingMs / 1000).toFixed(1)} s`);
        }
        if (playerSpeedBoostRemainingMs > 0) {
            activeBonuses.push(`Vitesse ${(playerSpeedBoostRemainingMs / 1000).toFixed(1)} s`);
        }
        bonusStatusDisplay.textContent = activeBonuses.join(' · ') || 'Aucun';
    }
    if (objectiveStatus) {
        objectiveStatus.textContent = nutrientObjectiveComplete
            ? `Objectif accompli · nutriments collectés : ${nutrientsCollected}.`
            : `Objectif secondaire : collecter ${NUTRIENT_OBJECTIVE_GOAL} nutriments (${Math.min(
                nutrientsCollected,
                NUTRIENT_OBJECTIVE_GOAL
            )}/${NUTRIENT_OBJECTIVE_GOAL}).`;
    }

    // ── Mise à jour du HUD Permanent du Joueur (Haut Gauche) ──
    const hudEnergyBar = document.getElementById('hudEnergyBar');
    const hudEnergyText = document.getElementById('hudEnergyText');
    const hudAttackBadge = document.getElementById('hudAttackBadge');
    const hudSpecialBadge = document.getElementById('hudSpecialBadge');
    const hudBacteriaVal = document.getElementById('hudBacteriaVal');
    const hudVirusVal = document.getElementById('hudVirusVal');
    const hudScoreVal = document.getElementById('hudScoreVal');
    const hudTimeVal = document.getElementById('hudTimeVal');

    if (whiteCell && hudEnergyBar && hudEnergyText) {
        const energyPct = Math.max(0, Math.min(100, Math.round(whiteCell.energy)));
        hudEnergyBar.style.width = `${energyPct}%`;
        hudEnergyText.textContent = `${energyPct}%`;

        const energyCard = hudEnergyBar.closest('.hud-energy-card');
        if (energyCard) {
            energyCard.classList.toggle('is-critical', energyPct <= 25);
            energyCard.classList.toggle('is-warning', energyPct > 25 && energyPct <= 50);
        }
    }

    if (hudAttackBadge && whiteCell) {
        const ready = whiteCell.attackCooldown <= 0;
        hudAttackBadge.textContent = ready ? 'Attaque : Prête' : `Attaque : ${(whiteCell.attackCooldown / 1000).toFixed(1)}s`;
        hudAttackBadge.className = `hud-status-badge ${ready ? 'badge-ready' : 'badge-cooldown'}`;
    }

    if (hudSpecialBadge && whiteCell) {
        const isShieldActive = whiteCell.shieldRemainingMs > 0;
        const isReady = !isShieldActive && whiteCell.specialCooldownRemainingMs <= 0;
        if (isShieldActive) {
            hudSpecialBadge.textContent = `Bouclier ACTIF (${(whiteCell.shieldRemainingMs / 1000).toFixed(1)}s)`;
            hudSpecialBadge.className = 'hud-status-badge badge-active';
        } else if (isReady) {
            hudSpecialBadge.textContent = 'Bouclier (E) : Prêt';
            hudSpecialBadge.className = 'hud-status-badge badge-ready';
        } else {
            hudSpecialBadge.textContent = `Bouclier : ${(whiteCell.specialCooldownRemainingMs / 1000).toFixed(1)}s`;
            hudSpecialBadge.className = 'hud-status-badge badge-cooldown';
        }
    }

    if (hudBacteriaVal) hudBacteriaVal.textContent = String(bacteria.length);
    if (hudVirusVal) {
        if (viruses.length > 0) {
            hudVirusVal.textContent = viruses.length === 1 ? 'PRÉDATEUR ACTIF' : 'PRÉDATEURS (' + viruses.length + ')';
            hudVirusVal.className = 'hud-stat-threat is-active';
        } else if (virusWarningShown) {
            hudVirusVal.textContent = 'EN APPROCHE';
            hudVirusVal.className = 'hud-stat-threat is-warning';
        } else {
            hudVirusVal.textContent = 'Non détecté';
            hudVirusVal.className = 'hud-stat-threat';
        }
    }
    if (hudScoreVal) hudScoreVal.textContent = String(score);
    if (hudTimeVal) {
        const elapsed = gameOver ? gameEndedAt : gameElapsedMs;
        hudTimeVal.textContent = formatSurvivalTime(elapsed);
    }
}

function difficultyLabel() {
    const labels = { easy: 'Facile', normal: 'Normal', hard: 'Difficile' };
    return labels[difficultyLevel] || labels.normal;
}
