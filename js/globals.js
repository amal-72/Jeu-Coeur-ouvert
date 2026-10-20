// Variables Globales partagées
// Utilisation de 'var' pour garantir l'accès via 'window' ou portée globale simple

var TOTAL_POP = 50;
var NB_ASSETS = 6;
var SIGHT_DIST = 150;
var FOV = Math.PI / 1.5;

var cars = [];
var savedCars = [];
var walls = [];
var checkpoints = [];
var currentTrackPath = [];
var currentTiles = [];

var startX = 115;
var startY = 115;
var generation = 0;
var bestCar = null;

var MUTATION_RATE = 0.15;
var GAME_SPEED_LIMIT = 6;
var TRACK_DIFFICULTY = 5;
var TRACK_WIDTH = 100;
var trainingFinished = false;

var whiteCell = null;
var playerMouseTarget = null;
var obstacles = [];
var nutrients = [];
var bacteria = [];
var allies = [];
var viruses = [];
var allyCount = 2;
var selectedBacterium = null;
var redBloodCell = null;
var vesselPath = [];
var pathDebug = false;
var flockDebug = {
    neighbors: false,
    separation: false,
    alignment: false,
    cohesion: false,
    weights: false
};
var flockWeights = { separation: 2.5, alignment: 0.6, cohesion: 0.4 };
var leaderFollowingDemo = null;
var leaderFollowingDebug = false;
var leaderFollowingOptions = {
    followDistance: 70,
    separationRadius: 190,
    frontZoneLength: 100,
    frontZoneRadius: 70,
    arriveWeight: 1,
    separationWeight: 3,
    obstacleWeight: 3,
    leaderAvoidanceWeight: 3,
    collisionAvoidanceHorizon: 28,
    collisionAvoidanceWeight: 3
};
var evolutionDemo = null;
var superVirusDemo = null;
var score = 0;
var gameOver = false;
var bacteriaDefeated = 0;
var gameElapsedMs = 0;
var gameEndedAt = 0;
var gameResult = '';
var difficultyLevel = 'normal';
var ARENA_COLOR = [7, 14, 28];
var bioTexture = null;
var ambientParticles = [];
var visualEffects = [];
var visualEffectsEnabled = true;
var gamePaused = false;
var simulationAccumulatorMs = 0;
