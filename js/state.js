// ===================== Состояние игры =====================
// screen: 'menu' | 'playing' | 'paused' | 'levelup' | 'dying' | 'gameover' | 'win'
var screen = 'menu';
var gameState;

function newGame() {
    const maxHealth = 120 + 20 * upgradeLevels.health;
    const player = {
        x: GAME.worldWidth / 2 - 60,
        y: GAME.worldHeight / 2 - 90,
        width: 120,
        height: 180,
        speed: 300 * (1 + 0.08 * upgradeLevels.speed),          // пикселей в секунду
        health: maxHealth,
        maxHealth: maxHealth,
        damage: 50 + 10 * upgradeLevels.damage,
        bulletSpeed: 900,                                        // пикселей в секунду
        fireRate: 0.5 * Math.pow(0.92, upgradeLevels.fireRate),  // секунд между выстрелами
        multishot: 1,          // стрел за выстрел
        pierce: 0,             // сколько врагов стрела пробивает насквозь
        magnet: 140,           // радиус притяжения кристаллов
        regen: 0,              // хп в секунду
        element: ELEMENTS[selectedElement].id,
        elementLevel: 1,
        dashCooldownMax: 1.5,
        dashCooldown: 0,
        dashTime: 0,
        dashDirX: 0, dashDirY: 0,
        ghostTimer: 0,
        invulnerableTime: 0,   // секунд
        picks: {},             // сколько раз взято каждое улучшение в этом забеге
        // Состояние анимации
        anim: {
            facing: -1,        // -1 смотрит влево (как на картинке), 1 вправо
            moveX: 0, moveY: 0,
            walkPhase: 0,
            tilt: 0,
            breath: 0,
            shootTimer: 0,
            shootDirX: 0, shootDirY: 0,
            sinceShot: 99,
            hitFlash: 0,
            auraTimer: 0, auraColor: '#fff',
            dustTimer: 0,
            deathTime: 0
        }
    };
    gameState = {
        player: player,
        camera: { x: 0, y: 0 },
        particles: [],
        bullets: [],
        enemies: [],
        pickups: [],
        gems: [],
        corpses: [],
        bolts: [],
        ghosts: [],
        popups: [],
        time: 0,
        spawnTimer: 0,
        shotTimer: 0,
        pickupTimer: 5,
        kills: 0,
        xp: 0,
        xpEndless: 0,         // сколько из этого опыта собрано в бесконечном режиме
        xpBanked: 0,          // сколько опыта этого забега уже добавлено в общий
        level: 1,
        levelXp: 0,
        pendingLevelUps: 0,
        levelChoices: [],
        bossIndex: 0,
        banner: null,
        shake: 0,
        endless: false,
        newRecords: []
    };
    snapCamera();
}

function startGame() {
    newGame();
    gameState.debugUsed = debug.on && debug.god;
    screen = 'playing';
}

// Сколько опыта забега идёт в общий (для магазина).
// Опыт, собранный в бесконечном режиме, засчитывается частично — иначе магазин обесценивается.
function metaXP(g) {
    return (g.xp - g.xpEndless) + Math.round(g.xpEndless * BALANCE.endlessXpShare);
}

// Добавляет опыт забега в общий и обновляет рекорды
function finishRun() {
    const g = gameState;
    if (g.debugUsed) {
        // Забег с читами в зачёт не идёт
        g.newRecords = [];
        return;
    }
    totalXP += metaXP(g) - g.xpBanked;
    g.xpBanked = metaXP(g);
    saveXP(totalXP);
    g.newRecords = updateRecords();
}

function endGame(isWin) {
    if (screen !== 'playing') return;
    finishRun();
    if (isWin) {
        screen = 'win';
    } else {
        // Сначала анимация падения, потом экран "YOU LOSE"
        screen = 'dying';
        gameState.player.anim.deathTime = 0;
    }
}

// ===================== Камера =====================
function clampCamera(cam) {
    cam.x = Math.max(0, Math.min(cam.x, GAME.worldWidth - GAME.width));
    cam.y = Math.max(0, Math.min(cam.y, GAME.worldHeight - GAME.height));
}

function cameraTarget() {
    const p = gameState.player;
    return { x: p.x + p.width / 2 - GAME.width / 2, y: p.y + p.height / 2 - GAME.height / 2 };
}

function snapCamera() {
    const t = cameraTarget();
    gameState.camera.x = t.x;
    gameState.camera.y = t.y;
    clampCamera(gameState.camera);
}

function updateCamera(dt) {
    const cam = gameState.camera;
    const t = cameraTarget();
    const k = Math.min(1, dt * 8);
    cam.x += (t.x - cam.x) * k;
    cam.y += (t.y - cam.y) * k;
    clampCamera(cam);
}

function isInView(x, y, margin) {
    const cam = gameState.camera;
    margin = margin || 0;
    return x > cam.x - margin && x < cam.x + GAME.width + margin &&
           y > cam.y - margin && y < cam.y + GAME.height + margin;
}
