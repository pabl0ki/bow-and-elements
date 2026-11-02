// ===================== Настройки =====================
var GAME = {
    width: 1900,            // размер экрана (то, что видит камера)
    height: 1050,
    worldWidth: 3600,       // размер всей карты
    worldHeight: 3600,
    background: null,
    winTime: 120,           // секунд до победы
    maxEnemies: 15,         // стартовый лимит врагов
    maxEnemiesCap: 45,      // лимит врагов к 2:00 (в бесконечном режиме растёт дальше)
    spawnInterval: 1.1,     // секунд между спавнами в начале
    spawnIntervalMin: 0.3   // интервал спавна к 2:00
};

var canvas = document.getElementById('canvas');
var canvasContext = canvas.getContext('2d');
canvas.width = GAME.width;
canvas.height = GAME.height;

// ===================== Картинки =====================
const img = new Image();
img.src = './back2.jpg';
img.onload = () => { GAME.background = img; };

const enemy1img = new Image();
enemy1img.src = 'enemy1.png';
const enemy2img = new Image();
enemy2img.src = 'enemy2.png';
const heroimg = new Image();
heroimg.src = './лучник.png';

function imgReady(image) {
    return image.complete && image.naturalWidth > 0;
}

// ===================== Сохранения =====================
function loadJSON(key, fallback) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
    } catch (e) { return fallback; }
}
function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { }
}

// Опыт копится между играми и тратится в меню
var totalXP = Number(loadJSON('bae_xp', 0)) || 0;
function saveXP(value) { saveJSON('bae_xp', value); }

// Рекорды
var records = (function () {
    const r = loadJSON('bae_records', {}) || {};
    return { time: Number(r.time) || 0, kills: Number(r.kills) || 0, level: Number(r.level) || 0 };
})();

function updateRecords() {
    const g = gameState;
    const broken = [];
    if (g.time > records.time) { records.time = g.time; broken.push('время'); }
    if (g.kills > records.kills) { records.kills = g.kills; broken.push('убийства'); }
    if (g.level > records.level) { records.level = g.level; broken.push('уровень'); }
    if (broken.length) saveJSON('bae_records', records);
    return broken;
}

// ===================== Улучшения (покупаются за опыт в меню) =====================
const UPGRADES = [
    { id: 'health',   key: '1', name: 'Здоровье',         desc: '+20 к макс. хп',      maxLevel: 5, baseCost: 40 },
    { id: 'damage',   key: '2', name: 'Урон',             desc: '+10 к урону стрел',   maxLevel: 5, baseCost: 50 },
    { id: 'fireRate', key: '3', name: 'Скорострельность', desc: '-8% к перезарядке',   maxLevel: 5, baseCost: 50 },
    { id: 'speed',    key: '4', name: 'Скорость',         desc: '+8% к скорости бега', maxLevel: 5, baseCost: 30 }
];

function loadUpgrades() {
    const levels = { health: 0, damage: 0, fireRate: 0, speed: 0 };
    const saved = loadJSON('bae_upgrades', {}) || {};
    for (const u of UPGRADES) levels[u.id] = Math.min(u.maxLevel, Math.max(0, Number(saved[u.id]) || 0));
    return levels;
}
var upgradeLevels = loadUpgrades();
var shopMessage = '';
var shopMessageTimer = 0;

function upgradeCost(u) {
    return u.baseCost * (upgradeLevels[u.id] + 1);
}

function buyUpgrade(index) {
    const u = UPGRADES[index];
    if (!u) return;
    if (upgradeLevels[u.id] >= u.maxLevel) {
        shopMessage = u.name + ': уже максимум';
    } else if (totalXP < upgradeCost(u)) {
        shopMessage = 'Не хватает опыта на «' + u.name + '»';
    } else {
        totalXP -= upgradeCost(u);
        upgradeLevels[u.id]++;
        saveXP(totalXP);
        saveJSON('bae_upgrades', upgradeLevels);
        shopMessage = '«' + u.name + '» — теперь ур. ' + upgradeLevels[u.id];
    }
    shopMessageTimer = 2;
}

// ===================== Стихии стрел =====================
const ELEMENTS = [
    { id: 'fire',      name: 'Огонь',  color: '#ff7a1a', rgb: '255, 122, 26',  desc: 'Поджигает: урон со временем', levelDesc: 'Горение сильнее' },
    { id: 'ice',       name: 'Лёд',    color: '#7fd8ff', rgb: '127, 216, 255', desc: 'Замедляет врагов',            levelDesc: 'Замедление сильнее' },
    { id: 'lightning', name: 'Молния', color: '#ffe95c', rgb: '255, 233, 92',  desc: 'Бьёт по соседним врагам',     levelDesc: 'Молния бьёт больше целей' }
];
const ELEMENT_BY_ID = {};
for (const el of ELEMENTS) ELEMENT_BY_ID[el.id] = el;

var selectedElement = Math.min(ELEMENTS.length - 1, Math.max(0, Number(loadJSON('bae_element', 0)) || 0));
function selectElement(index) {
    selectedElement = (index + ELEMENTS.length) % ELEMENTS.length;
    saveJSON('bae_element', selectedElement);
}

// ===================== Улучшения внутри забега (выбор при новом уровне) =====================
const LEVEL_OPTIONS = [
    { id: 'damage', max: 8, name: () => 'Острые наконечники',
      desc: p => 'Урон стрел +20% (' + p.damage + ' → ' + Math.round(p.damage * 1.2) + ')',
      apply: p => { p.damage = Math.round(p.damage * 1.2); } },
    { id: 'fireRate', max: 6, name: () => 'Быстрая тетива',
      desc: p => 'Выстрелов в секунду: ' + (1 / p.fireRate).toFixed(1) + ' → ' + (1 / (p.fireRate * 0.88)).toFixed(1),
      apply: p => { p.fireRate *= 0.88; } },
    { id: 'multishot', max: 4, name: () => 'Ещё одна стрела',
      desc: p => 'Стрел за выстрел: ' + p.multishot + ' → ' + (p.multishot + 1),
      apply: p => { p.multishot++; } },
    { id: 'pierce', max: 3, name: () => 'Пробивание',
      desc: p => 'Стрела пробивает врагов насквозь: ' + p.pierce + ' → ' + (p.pierce + 1),
      apply: p => { p.pierce++; } },
    { id: 'health', max: 5, name: () => 'Крепкое здоровье',
      desc: () => 'Макс. хп +25 и полное лечение',
      apply: p => { p.maxHealth += 25; p.health = p.maxHealth; } },
    { id: 'speed', max: 4, name: () => 'Лёгкие сапоги',
      desc: () => 'Скорость бега +10%',
      apply: p => { p.speed *= 1.1; } },
    { id: 'magnet', max: 3, name: () => 'Магнит',
      desc: () => 'Кристаллы опыта притягиваются на 50% дальше',
      apply: p => { p.magnet *= 1.5; } },
    { id: 'element', max: 4, name: p => 'Сила стихии: ' + ELEMENT_BY_ID[p.element].name,
      desc: p => ELEMENT_BY_ID[p.element].levelDesc + ' (ур. ' + p.elementLevel + ' → ' + (p.elementLevel + 1) + ')',
      apply: p => { p.elementLevel++; } },
    { id: 'dash', max: 3, name: () => 'Ловкость',
      desc: p => 'Перезарядка рывка: ' + p.dashCooldownMax.toFixed(1) + 'с → ' + (p.dashCooldownMax * 0.75).toFixed(1) + 'с',
      apply: p => { p.dashCooldownMax *= 0.75; } },
    { id: 'arrowSpeed', max: 3, name: () => 'Тугой лук',
      desc: () => 'Стрелы летят быстрее и дальше (+20%)',
      apply: p => { p.bulletSpeed *= 1.2; } },
    { id: 'regen', max: 4, name: () => 'Регенерация',
      desc: p => 'Восстановление хп в секунду: ' + p.regen + ' → ' + (p.regen + 1),
      apply: p => { p.regen += 1; } }
];

function xpForLevel(level) {
    return 20 + (level - 1) * 15;
}

// ===================== Боссы =====================
const BOSS_TYPES = [
    { name: 'Страж леса', image: enemy1img, filter: 'hue-rotate(-70deg) saturate(1.6)', radius: 70, health: 3000, speed: 75, damage: 30, attacks: ['ring', 'charge'] },
    { name: 'Повелитель роя', image: enemy2img, filter: 'hue-rotate(110deg) saturate(1.5)', radius: 64, health: 5000, speed: 95, damage: 30, attacks: ['ring2', 'fan', 'charge'] }
];

// Когда появляется i-й босс: 0:45, 1:30, дальше (в бесконечном режиме) каждую минуту с 2:30
function bossTime(index) {
    return index < 2 ? [45, 90][index] : 150 + (index - 2) * 60;
}

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
    screen = 'playing';
}

// Добавляет опыт забега в общий и обновляет рекорды
function finishRun() {
    const g = gameState;
    totalXP += g.xp - g.xpBanked;
    g.xpBanked = g.xp;
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

// ===================== Управление =====================
const keys = { up: false, down: false, left: false, right: false };

function setKey(event, value) {
    switch (event.code) {
        case 'ArrowUp': case 'KeyW': keys.up = value; break;
        case 'ArrowDown': case 'KeyS': keys.down = value; break;
        case 'ArrowLeft': case 'KeyA': keys.left = value; break;
        case 'ArrowRight': case 'KeyD': keys.right = value; break;
        default: return false;
    }
    return true;
}

function digitKey(code, max) {
    const m = /^(Digit|Numpad)([1-9])$/.exec(code);
    if (!m) return -1;
    const n = Number(m[2]);
    return n <= max ? n - 1 : -1;
}

window.addEventListener('keydown', (event) => {
    const code = event.code;
    if (setKey(event, true) || code === 'Space') event.preventDefault(); // стрелки и пробел не прокручивают страницу
    if (event.repeat) return;

    switch (screen) {
        case 'playing':
            if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'Space') tryDash();
            else if (code === 'Escape' || code === 'KeyP') screen = 'paused';
            break;
        case 'paused':
            if (code === 'Escape' || code === 'KeyP' || code === 'Enter') screen = 'playing';
            else if (code === 'KeyM') { finishRun(); screen = 'menu'; }
            break;
        case 'levelup': {
            const i = digitKey(code, 3);
            if (i >= 0) chooseLevelOption(i);
            break;
        }
        case 'menu': {
            const i = digitKey(code, 4);
            if (code === 'Enter' || code === 'Space') startGame();
            else if (i >= 0) buyUpgrade(i);
            else if (code === 'KeyQ' || code === 'ArrowLeft') selectElement(selectedElement - 1);
            else if (code === 'KeyE' || code === 'ArrowRight') selectElement(selectedElement + 1);
            break;
        }
        case 'win':
            if (code === 'KeyC') {
                gameState.endless = true;
                screen = 'playing';
                showBanner('Бесконечный режим', 'Сколько ещё продержишься?', '#ffd54a');
            } else if (code === 'Enter' || code === 'Space') startGame();
            else if (code === 'Escape' || code === 'KeyM') screen = 'menu';
            break;
        case 'gameover':
            if (code === 'Enter' || code === 'Space') startGame();
            else if (code === 'Escape' || code === 'KeyM') screen = 'menu';
            break;
    }
});
window.addEventListener('keyup', (event) => { setKey(event, false); });

// Окно потеряло фокус: клавиши не "залипают", игра встаёт на паузу
window.addEventListener('blur', () => {
    keys.up = keys.down = keys.left = keys.right = false;
    if (screen === 'playing') screen = 'paused';
});

// Клики мышью по карточкам
function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (event.clientX - rect.left) * (GAME.width / rect.width),
        y: (event.clientY - rect.top) * (GAME.height / rect.height)
    };
}
function inRect(pt, r) {
    return pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h;
}
function shopCardRect(index) {
    const w = 380, h = 170, gap = 30;
    const total = UPGRADES.length * w + (UPGRADES.length - 1) * gap;
    return { x: (GAME.width - total) / 2 + index * (w + gap), y: 625, w: w, h: h };
}
function elementCardRect(index) {
    const w = 340, h = 110, gap = 30;
    const total = ELEMENTS.length * w + (ELEMENTS.length - 1) * gap;
    return { x: (GAME.width - total) / 2 + index * (w + gap), y: 330, w: w, h: h };
}
function levelCardRect(index) {
    const w = 460, h = 300, gap = 40;
    const total = 3 * w + 2 * gap;
    return { x: (GAME.width - total) / 2 + index * (w + gap), y: 380, w: w, h: h };
}

canvas.addEventListener('click', (event) => {
    const pt = canvasPoint(event);
    if (screen === 'menu') {
        for (let i = 0; i < UPGRADES.length; i++) if (inRect(pt, shopCardRect(i))) buyUpgrade(i);
        for (let i = 0; i < ELEMENTS.length; i++) if (inRect(pt, elementCardRect(i))) selectElement(i);
    } else if (screen === 'levelup') {
        for (let i = 0; i < gameState.levelChoices.length; i++) if (inRect(pt, levelCardRect(i))) chooseLevelOption(i);
    }
});

// ===================== Эффекты: частицы, надписи, тряска =====================
function spawnParticles(x, y, count, color, speed, life, size, options) {
    const list = gameState.particles;
    options = options || {};
    for (let i = 0; i < count && list.length < 700; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = speed * (0.4 + Math.random() * 0.6);
        list.push({
            x: x, y: y,
            vx: Math.cos(a) * s + (options.vx || 0),
            vy: Math.sin(a) * s + (options.vy || 0),
            life: life, maxLife: life,
            size: size * (0.6 + Math.random() * 0.6),
            color: color,
            alpha: options.alpha || 0.9,
            gravity: options.gravity || 0,
            grow: options.grow || 0
        });
    }
}

function updateParticles(dt) {
    const list = gameState.particles;
    for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.life -= dt;
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.life <= 0) list.splice(i, 1);
    }
}

function drawParticles() {
    for (const p of gameState.particles) {
        const k = p.life / p.maxLife;
        canvasContext.fillStyle = 'rgba(' + p.color + ',' + (p.alpha * k) + ')';
        canvasContext.beginPath();
        canvasContext.arc(p.x, p.y, p.size * (1 + (1 - k) * p.grow), 0, Math.PI * 2);
        canvasContext.fill();
    }
}

function addPopup(text, x, y, color, size, life) {
    if (gameState.popups.length > 150) gameState.popups.shift();
    gameState.popups.push({ text: text, x: x, y: y, color: color || 'white', size: size || 28, life: life || 0.8, maxLife: life || 0.8 });
}

function drawPopups() {
    for (const popup of gameState.popups) {
        canvasContext.globalAlpha = Math.min(1, (popup.life / popup.maxLife) * 2.5);
        drawText(popup.text, popup.x, popup.y, popup.size, 'center', popup.color);
    }
    canvasContext.globalAlpha = 1;
}

function showBanner(text, sub, color) {
    gameState.banner = { text: text, sub: sub, color: color, life: 3, maxLife: 3 };
}

function addShake(amount) {
    gameState.shake = Math.max(gameState.shake, amount);
}

function addBolt(x1, y1, x2, y2) {
    const points = [{ x: x1, y: y1 }];
    const segments = 7;
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
    for (let i = 1; i < segments; i++) {
        const t = i / segments;
        const off = (Math.random() - 0.5) * 36;
        points.push({ x: x1 + (x2 - x1) * t + nx * off, y: y1 + (y2 - y1) * t + ny * off });
    }
    points.push({ x: x2, y: y2 });
    gameState.bolts.push({ points: points, life: 0.18, maxLife: 0.18 });
}

function drawBolts() {
    for (const bolt of gameState.bolts) {
        const k = bolt.life / bolt.maxLife;
        for (const pass of [{ w: 10, c: 'rgba(255, 233, 92,' + 0.35 * k + ')' }, { w: 3, c: 'rgba(255, 255, 230,' + k + ')' }]) {
            canvasContext.strokeStyle = pass.c;
            canvasContext.lineWidth = pass.w;
            canvasContext.beginPath();
            canvasContext.moveTo(bolt.points[0].x, bolt.points[0].y);
            for (const pt of bolt.points) canvasContext.lineTo(pt.x, pt.y);
            canvasContext.stroke();
        }
    }
}

// Уменьшает life у всех элементов списка и убирает закончившиеся
function ageList(list, dt) {
    for (let i = list.length - 1; i >= 0; i--) {
        list[i].life -= dt;
        if (list[i].life <= 0) list.splice(i, 1);
    }
}

function updateEffects(dt) {
    const g = gameState;
    updateParticles(dt);
    for (const popup of g.popups) popup.y -= 55 * dt;
    ageList(g.popups, dt);
    ageList(g.corpses, dt);
    ageList(g.bolts, dt);
    ageList(g.ghosts, dt);
    if (g.banner) {
        g.banner.life -= dt;
        if (g.banner.life <= 0) g.banner = null;
    }
    g.shake = g.shake > 0.3 ? g.shake * Math.exp(-dt * 9) : 0;
}

// ===================== Враги =====================
// Случайная точка сразу за краем экрана, но внутри карты
function randomSpawnPoint(margin) {
    const cam = gameState.camera;
    const W = GAME.worldWidth, H = GAME.worldHeight, edge = 40;
    for (let attempt = 0; attempt < 12; attempt++) {
        let x, y;
        switch (Math.floor(Math.random() * 4)) {
            case 0: x = cam.x - margin; y = cam.y + Math.random() * GAME.height; break;
            case 1: x = cam.x + GAME.width + margin; y = cam.y + Math.random() * GAME.height; break;
            case 2: x = cam.x + Math.random() * GAME.width; y = cam.y - margin; break;
            default: x = cam.x + Math.random() * GAME.width; y = cam.y + GAME.height + margin; break;
        }
        if (x > edge && y > edge && x < W - edge && y < H - edge) return { x: x, y: y };
    }
    // Запасной вариант: с той стороны, где больше места
    return {
        x: cam.x > W / 2 ? cam.x - margin : cam.x + GAME.width + margin,
        y: cam.y + GAME.height / 2
    };
}

// Враги становятся крепче со временем
function difficultyMul() {
    const t = gameState.time;
    return 1 + Math.min(t, GAME.winTime) / GAME.winTime * 0.5 + Math.max(0, t - GAME.winTime) / 60 * 0.5;
}

function makeEnemy(base, x, y) {
    const enemy = Object.assign({
        x: x, y: y,
        kbx: 0, kby: 0,   // отбрасывание
        flash: 0,         // белая вспышка при попадании
        burn: null,       // горение
        slow: null,       // замедление
        dead: false
    }, base);
    enemy.maxHealth = enemy.health;
    return enemy;
}

function spawnEnemy() {
    const pos = randomSpawnPoint(90);
    const hpMul = difficultyMul();
    // Стрелки появляются не сразу, а через 15 секунд после начала
    const rangedChance = gameState.time > 15 ? 0.2 : 0;
    const roll = Math.random();
    let base;
    if (roll < rangedChance) {
        // Дальний бой, мало хп: держит дистанцию и стреляет
        base = {
            kind: 'ranged', health: 60, radius: 24, damage: 10, speed: 120, xp: 12,
            range: 420, shotDamage: 12, shotSpeed: 420, fireRate: 2, shotTimer: 1 + Math.random()
        };
    } else if (roll < rangedChance + (1 - rangedChance) * 0.45) {
        // Ближний бой, больше хп, медленный
        base = { kind: 'green', health: 150, radius: 32, damage: 20, speed: 80, xp: 15 };
    } else {
        // Ближний бой, мало хп, быстрый
        base = { kind: 'red', health: 100, radius: 28, damage: 15, speed: 165, xp: 10 };
    }
    base.health = Math.round(base.health * hpMul);
    gameState.enemies.push(makeEnemy(base, pos.x, pos.y));
}

function spawnBoss(index) {
    const type = BOSS_TYPES[index % BOSS_TYPES.length];
    const tier = Math.floor(index / BOSS_TYPES.length);
    const pos = randomSpawnPoint(160);
    gameState.enemies.push(makeEnemy({
        kind: 'boss', boss: true, type: type,
        health: Math.round(type.health * (1 + 0.7 * tier)),
        radius: type.radius, damage: type.damage, speed: type.speed,
        xp: 200 * (1 + tier),
        state: 'walk', stateTime: 0, attackTimer: 3, attackIndex: 0,
        chargeDirX: 0, chargeDirY: 0, pendingRing: 0
    }, pos.x, pos.y));
    showBanner('БОСС: ' + type.name, 'Победи его, чтобы получить много опыта', '#ff5252');
    addShake(12);
}

function updateSpawning(dt) {
    const g = gameState;
    // В бесконечном режиме progress становится больше 1 и сложность растёт дальше
    const progress = g.time / GAME.winTime;
    const interval = Math.max(0.15, GAME.spawnInterval - (GAME.spawnInterval - GAME.spawnIntervalMin) * progress);
    const limit = Math.min(80, Math.round(GAME.maxEnemies + (GAME.maxEnemiesCap - GAME.maxEnemies) * progress));

    g.spawnTimer -= dt;
    if (g.spawnTimer <= 0) {
        if (g.enemies.length < limit) spawnEnemy();
        g.spawnTimer = interval;
    }
    if (g.time >= bossTime(g.bossIndex)) {
        spawnBoss(g.bossIndex);
        g.bossIndex++;
    }
}

function slowMul(enemy) {
    if (!enemy.slow) return 1;
    return 1 - enemy.slow.factor * (enemy.boss ? 0.5 : 1); // боссы замедляются вдвое слабее
}

function enemyBullet(x, y, angle, speed, damage, radius, color) {
    gameState.bullets.push({
        x: x, y: y,
        dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed,
        damage: damage, radius: radius, color: color,
        life: 4, isEnemy: true
    });
}

function fireRing(boss, count, speed, offset) {
    for (let i = 0; i < count; i++) {
        enemyBullet(boss.x, boss.y, offset + i * Math.PI * 2 / count, speed, 15, 11, '255, 157, 60');
    }
}

function fireFan(boss, nx, ny, count, spread, speed) {
    const base = Math.atan2(ny, nx);
    for (let i = 0; i < count; i++) {
        enemyBullet(boss.x, boss.y, base + (i - (count - 1) / 2) * spread, speed, 15, 11, '255, 157, 60');
    }
}

function updateBoss(boss, dt, nx, ny) {
    if (boss.pendingRing > 0) {
        boss.pendingRing -= dt;
        if (boss.pendingRing <= 0) fireRing(boss, 16, 300, Math.PI / 16);
    }
    if (boss.state === 'walk') {
        const speed = boss.speed * slowMul(boss);
        boss.x += nx * speed * dt;
        boss.y += ny * speed * dt;
        boss.attackTimer -= dt;
        // Атакует, только когда хорошо виден на экране
        if (boss.attackTimer <= 0 && isInView(boss.x, boss.y, -40)) {
            const attacks = boss.type.attacks;
            const attack = attacks[boss.attackIndex % attacks.length];
            boss.attackIndex++;
            boss.attackTimer = 3;
            if (attack === 'ring') fireRing(boss, 14, 320, 0);
            else if (attack === 'ring2') { fireRing(boss, 16, 300, 0); boss.pendingRing = 0.4; }
            else if (attack === 'fan') fireFan(boss, nx, ny, 5, 0.18, 420);
            else if (attack === 'charge') {
                // Сначала предупреждение (красная полоса), потом рывок
                boss.state = 'telegraph';
                boss.stateTime = 0.7;
                boss.chargeDirX = nx;
                boss.chargeDirY = ny;
            }
        }
    } else if (boss.state === 'telegraph') {
        boss.stateTime -= dt;
        if (boss.stateTime <= 0) {
            boss.state = 'charge';
            boss.stateTime = 0.55;
            addShake(6);
        }
    } else if (boss.state === 'charge') {
        boss.x += boss.chargeDirX * 650 * dt;
        boss.y += boss.chargeDirY * 650 * dt;
        boss.stateTime -= dt;
        if (Math.random() < 0.6) spawnParticles(boss.x, boss.y + boss.radius, 1, '120, 100, 70', 40, 0.5, 12, { alpha: 0.5, grow: 1 });
        if (boss.stateTime <= 0) boss.state = 'walk';
    }
}

function updateEnemies(dt) {
    const g = gameState;
    const player = g.player;
    const px = player.x + player.width / 2;
    const py = player.y + player.height / 2;
    const enemies = g.enemies;

    for (const enemy of enemies) {
        if (enemy.dead) continue;

        // Эффекты стихий
        if (enemy.flash > 0) enemy.flash -= dt;
        if (enemy.slow) {
            enemy.slow.time -= dt;
            if (Math.random() < 0.08) spawnParticles(enemy.x, enemy.y, 1, '200, 240, 255', 20, 0.6, 4, { vy: 20 });
            if (enemy.slow.time <= 0) enemy.slow = null;
        }
        if (enemy.burn) {
            enemy.burn.time -= dt;
            enemy.burn.tick -= dt;
            if (Math.random() < 0.35) spawnParticles(enemy.x + (Math.random() - 0.5) * enemy.radius, enemy.y, 1, '255, 140, 40', 30, 0.5, 6, { vy: -60 });
            if (enemy.burn.tick <= 0) {
                enemy.burn.tick += 0.5;
                hitEnemy(enemy, Math.round(enemy.burn.dps * 0.5), { color: '#ff9a3c', small: true });
            }
            if (enemy.burn && enemy.burn.time <= 0) enemy.burn = null;
        }
        if (enemy.dead) continue;

        // Отбрасывание от попаданий (плавно затухает)
        enemy.x += enemy.kbx * dt;
        enemy.y += enemy.kby * dt;
        const decay = Math.exp(-10 * dt);
        enemy.kbx *= decay;
        enemy.kby *= decay;

        const dx = px - enemy.x;
        const dy = py - enemy.y;
        const distance = Math.hypot(dx, dy);
        if (distance <= 1) continue;
        const nx = dx / distance, ny = dy / distance;
        const speed = enemy.speed * slowMul(enemy);

        if (enemy.boss) {
            updateBoss(enemy, dt, nx, ny);
        } else if (enemy.kind === 'ranged') {
            // Стрелок подходит на дистанцию выстрела, а если игрок слишком близко — отходит
            let dir = 0;
            if (distance > enemy.range) dir = 1;
            else if (distance < enemy.range * 0.6) dir = -0.7;
            enemy.x += nx * speed * dir * dt;
            enemy.y += ny * speed * dir * dt;
            // Стреляет, только когда виден на экране и в радиусе
            enemy.shotTimer -= dt;
            if (enemy.shotTimer <= 0 && isInView(enemy.x, enemy.y, 0) && distance <= enemy.range * 1.2) {
                enemyBullet(enemy.x, enemy.y, Math.atan2(ny, nx), enemy.shotSpeed, enemy.shotDamage, 6, '208, 112, 255');
                enemy.shotTimer = enemy.fireRate;
            }
        } else {
            enemy.x += nx * speed * dt;
            enemy.y += ny * speed * dt;
        }
    }

    // Враги расталкивают друг друга, чтобы не стакаться (босса почти не сдвинуть)
    for (let i = 0; i < enemies.length; i++) {
        const a = enemies[i];
        if (a.dead) continue;
        for (let j = i + 1; j < enemies.length; j++) {
            const b = enemies[j];
            if (b.dead) continue;
            let dx = b.x - a.x;
            let dy = b.y - a.y;
            let dist = Math.hypot(dx, dy);
            const minDist = a.radius + b.radius;
            if (dist < minDist) {
                if (dist < 0.01) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; dist = Math.hypot(dx, dy); }
                const massA = a.boss ? 30 : 1, massB = b.boss ? 30 : 1;
                const overlap = minDist - dist;
                const nx = dx / dist, ny = dy / dist;
                const shareA = massB / (massA + massB), shareB = massA / (massA + massB);
                a.x -= nx * overlap * shareA; a.y -= ny * overlap * shareA;
                b.x += nx * overlap * shareB; b.y += ny * overlap * shareB;
            }
        }
    }

    // Не выходят за карту
    for (const enemy of enemies) {
        enemy.x = Math.max(enemy.radius, Math.min(enemy.x, GAME.worldWidth - enemy.radius));
        enemy.y = Math.max(enemy.radius, Math.min(enemy.y, GAME.worldHeight - enemy.radius));
    }

    // Урон игроку при касании (игрок проходит сквозь мобов)
    const hb = playerHitbox();
    for (const enemy of enemies) {
        if (enemy.dead) continue;
        const closestX = Math.max(hb.x, Math.min(enemy.x, hb.x + hb.w));
        const closestY = Math.max(hb.y, Math.min(enemy.y, hb.y + hb.h));
        const touching = Math.hypot(enemy.x - closestX, enemy.y - closestY) < enemy.radius * 0.85;
        if (touching && damagePlayer(enemy.damage)) return;
    }
}

function removeDeadEnemies() {
    gameState.enemies = gameState.enemies.filter(e => !e.dead);
}

// Попадание по врагу: урон, вспышка, цифра урона, отбрасывание
function hitEnemy(enemy, damage, opts) {
    if (enemy.dead) return;
    opts = opts || {};
    enemy.health -= damage;
    enemy.flash = 0.08;
    if (opts.kbx !== undefined) {
        const resist = enemy.boss ? 0.05 : enemy.kind === 'green' ? 0.6 : 1;
        enemy.kbx += opts.kbx * resist;
        enemy.kby += opts.kby * resist;
    }
    addPopup(String(damage), enemy.x + (Math.random() - 0.5) * 24, enemy.y - enemy.radius - 10,
        opts.color || '#ffffff', opts.small ? 22 : 28, 0.6);
    if (!opts.small) spawnParticles(enemy.x, enemy.y, 4, '255, 240, 200', 220, 0.25, 4);
    if (enemy.health <= 0) killEnemy(enemy);
}

function enemyImage(enemy) {
    if (enemy.boss) return enemy.type.image;
    return enemy.kind === 'green' ? enemy1img : enemy2img;
}

function enemyFilter(enemy) {
    const parts = [];
    if (enemy.kind === 'ranged') parts.push('hue-rotate(220deg) saturate(1.5)');
    if (enemy.boss) parts.push(enemy.type.filter);
    if (enemy.slow) parts.push('saturate(0.5) brightness(1.2)');
    if (enemy.flash > 0) parts.push('brightness(2.2)');
    return parts.length ? parts.join(' ') : 'none';
}

function killEnemy(enemy) {
    const g = gameState;
    enemy.dead = true;
    g.kills++;
    dropGems(enemy.x, enemy.y, enemy.xp, enemy.boss ? 10 : 1);
    const color = enemy.boss ? '255, 120, 60' : enemy.kind === 'green' ? '120, 200, 80' : enemy.kind === 'ranged' ? '170, 90, 255' : '255, 90, 60';
    spawnParticles(enemy.x, enemy.y, enemy.boss ? 40 : 12, color, enemy.boss ? 420 : 240, 0.5, enemy.boss ? 9 : 6);
    // "Труп" — спрайт, который сжимается и исчезает
    g.corpses.push({
        image: enemyImage(enemy), filter: enemyFilter(Object.assign({}, enemy, { flash: 0, slow: null })),
        x: enemy.x, y: enemy.y, size: enemy.radius * 2.8, life: 0.35, maxLife: 0.35,
        spin: (Math.random() < 0.5 ? -1 : 1) * 2.5
    });
    if (enemy.boss) {
        addShake(18);
        showBanner('Босс повержен!', '+' + enemy.xp + ' опыта', '#7CFC00');
        g.pickups.push({ type: 'heal', x: enemy.x, y: enemy.y, life: PICKUP_LIFETIME });
    }
}

function drawEnemy(enemy) {
    const image = enemyImage(enemy);
    const size = enemy.radius * 2.8;

    // Предупреждение перед рывком босса
    if (enemy.boss && enemy.state === 'telegraph') {
        const pulse = 0.35 + 0.25 * Math.sin(enemy.stateTime * 30);
        canvasContext.strokeStyle = 'rgba(255, 40, 40,' + pulse + ')';
        canvasContext.lineWidth = enemy.radius * 1.4;
        canvasContext.lineCap = 'round';
        canvasContext.beginPath();
        canvasContext.moveTo(enemy.x, enemy.y);
        canvasContext.lineTo(enemy.x + enemy.chargeDirX * 380, enemy.y + enemy.chargeDirY * 380);
        canvasContext.stroke();
        canvasContext.lineCap = 'butt';
    }

    // Тень
    canvasContext.fillStyle = 'rgba(0,0,0,0.25)';
    canvasContext.beginPath();
    canvasContext.ellipse(enemy.x, enemy.y + size * 0.36, enemy.radius * 0.9, enemy.radius * 0.3, 0, 0, Math.PI * 2);
    canvasContext.fill();

    // Ауры: стрелок, горение, лёд
    const auras = [];
    if (enemy.kind === 'ranged') auras.push('rgba(160, 60, 255, 0.35)');
    if (enemy.burn) auras.push('rgba(255, 120, 30, 0.35)');
    if (enemy.slow) auras.push('rgba(127, 216, 255, 0.4)');
    for (const aura of auras) {
        canvasContext.fillStyle = aura;
        canvasContext.beginPath();
        canvasContext.arc(enemy.x, enemy.y, enemy.radius + 8, 0, Math.PI * 2);
        canvasContext.fill();
    }

    if (imgReady(image)) {
        // Сохраняем пропорции картинки
        const ratio = image.naturalHeight / image.naturalWidth;
        const w = size, h = size * ratio;
        canvasContext.filter = enemyFilter(enemy);
        canvasContext.drawImage(image, enemy.x - w / 2, enemy.y - h / 2, w, h);
        canvasContext.filter = 'none';
    } else {
        canvasContext.fillStyle = enemy.kind === 'green' ? 'green' : 'red';
        canvasContext.beginPath();
        canvasContext.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
        canvasContext.fill();
    }

    // Полоска хп обычного врага, если он ранен (у босса — большая полоса сверху экрана)
    if (!enemy.boss && enemy.health < enemy.maxHealth) {
        const w = enemy.radius * 2;
        const y = enemy.y - size / 2 - 10;
        canvasContext.fillStyle = 'rgba(0,0,0,0.6)';
        canvasContext.fillRect(enemy.x - w / 2, y, w, 6);
        canvasContext.fillStyle = '#e33';
        canvasContext.fillRect(enemy.x - w / 2, y, w * Math.max(0, enemy.health / enemy.maxHealth), 6);
    }
}

function drawCorpses() {
    for (const c of gameState.corpses) {
        if (!imgReady(c.image)) continue;
        const k = c.life / c.maxLife;
        const ratio = c.image.naturalHeight / c.image.naturalWidth;
        const w = c.size * (0.4 + 0.6 * k), h = w * ratio;
        canvasContext.save();
        canvasContext.globalAlpha = k;
        canvasContext.filter = c.filter + ' brightness(' + (1 + (1 - k) * 2) + ')';
        canvasContext.translate(c.x, c.y);
        canvasContext.rotate((1 - k) * c.spin);
        canvasContext.drawImage(c.image, -w / 2, -h / 2, w, h);
        canvasContext.restore();
    }
}

// ===================== Кристаллы опыта =====================
function dropGems(x, y, total, count) {
    const per = Math.max(1, Math.round(total / count));
    for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = count > 1 ? 150 + Math.random() * 250 : 60;
        gameState.gems.push({ x: x, y: y, value: per, vx: Math.cos(a) * s, vy: Math.sin(a) * s, attracted: false, speed: 300 });
    }
    // Если кристаллов слишком много, самый старый вливается в новый
    const gems = gameState.gems;
    while (gems.length > 250) {
        const old = gems.shift();
        gems[gems.length - 1].value += old.value;
    }
}

function collectGem(gem) {
    const g = gameState;
    g.xp += gem.value;
    g.levelXp += gem.value;
    while (g.levelXp >= xpForLevel(g.level)) {
        g.levelXp -= xpForLevel(g.level);
        g.level++;
        g.pendingLevelUps++;
    }
}

function updateGems(dt) {
    const g = gameState, p = g.player;
    const px = p.x + p.width / 2, py = p.y + p.height / 2;
    for (let i = g.gems.length - 1; i >= 0; i--) {
        const gem = g.gems[i];
        gem.x += gem.vx * dt;
        gem.y += gem.vy * dt;
        const decay = Math.exp(-6 * dt);
        gem.vx *= decay;
        gem.vy *= decay;
        const dx = px - gem.x, dy = py - gem.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 45) {
            collectGem(gem);
            g.gems.splice(i, 1);
            continue;
        }
        if (!gem.attracted && dist < p.magnet) gem.attracted = true;
        if (gem.attracted) {
            // Летит к игроку всё быстрее
            gem.speed = Math.min(1400, gem.speed + 1800 * dt);
            gem.x += (dx / dist) * gem.speed * dt;
            gem.y += (dy / dist) * gem.speed * dt;
        }
    }
}

function drawGems() {
    const t = gameState.time;
    for (const gem of gameState.gems) {
        if (!isInView(gem.x, gem.y, 30)) continue;
        const big = gem.value >= 50, mid = gem.value >= 13;
        const size = big ? 15 : mid ? 11 : 8;
        const color = big ? '#c86bff' : mid ? '#4cff8f' : '#4fc3ff';
        const bob = Math.sin(t * 5 + gem.x * 0.05) * 2;
        canvasContext.fillStyle = 'rgba(255,255,255,0.18)';
        canvasContext.beginPath();
        canvasContext.arc(gem.x, gem.y + bob, size * 1.6, 0, Math.PI * 2);
        canvasContext.fill();
        canvasContext.fillStyle = color;
        canvasContext.strokeStyle = 'rgba(255,255,255,0.9)';
        canvasContext.lineWidth = 2;
        canvasContext.beginPath();
        canvasContext.moveTo(gem.x, gem.y + bob - size * 1.3);
        canvasContext.lineTo(gem.x + size, gem.y + bob);
        canvasContext.lineTo(gem.x, gem.y + bob + size * 1.3);
        canvasContext.lineTo(gem.x - size, gem.y + bob);
        canvasContext.closePath();
        canvasContext.fill();
        canvasContext.stroke();
    }
}

// ===================== Новый уровень в забеге =====================
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
}

// Открывает выбор улучшения. Возвращает false, если выбирать уже нечего.
function openLevelUp() {
    const g = gameState, p = g.player;
    const available = LEVEL_OPTIONS.filter(o => (p.picks[o.id] || 0) < o.max);
    if (!available.length) {
        g.pendingLevelUps = 0;
        return false;
    }
    g.levelChoices = shuffle(available).slice(0, 3);
    screen = 'levelup';
    return true;
}

function chooseLevelOption(index) {
    const g = gameState, p = g.player;
    const option = g.levelChoices[index];
    if (!option) return;
    option.apply(p);
    p.picks[option.id] = (p.picks[option.id] || 0) + 1;
    g.pendingLevelUps--;
    p.anim.auraTimer = 0.5;
    p.anim.auraColor = '#4fc3ff';
    p.invulnerableTime = Math.max(p.invulnerableTime, 0.5); // чтобы не получить удар сразу после выбора
    if (!(g.pendingLevelUps > 0 && openLevelUp())) screen = 'playing';
}

// ===================== Стрельба =====================
function findClosestEnemy() {
    const player = gameState.player;
    const px = player.x + player.width / 2;
    const py = player.y + player.height / 2;
    let closestEnemy = null;
    let closestDistance = Infinity;
    for (const enemy of gameState.enemies) {
        if (enemy.dead || !isInView(enemy.x, enemy.y, 0)) continue; // не тратим стрелы на врагов за экраном
        const distance = Math.hypot(px - enemy.x, py - enemy.y);
        if (distance < closestDistance) {
            closestDistance = distance;
            closestEnemy = enemy;
        }
    }
    return closestEnemy;
}

// Где на картинке лук (доли ширины/высоты спрайта, когда лучник смотрит влево)
const BOW_POS = { x: 0.07, y: 0.36 };

function bowPosition(player) {
    const rx = player.anim.facing === -1 ? BOW_POS.x : 1 - BOW_POS.x;
    return { x: player.x + rx * player.width, y: player.y + BOW_POS.y * player.height };
}

function shootBullet(target) {
    const player = gameState.player;
    const anim = player.anim;
    // Разворачиваемся к цели, потом стреляем из лука
    const cx = player.x + player.width / 2;
    if (Math.abs(target.x - cx) > 10) anim.facing = target.x < cx ? -1 : 1;
    const bow = bowPosition(player);
    const dx = target.x - bow.x;
    const dy = target.y - bow.y;
    const distance = Math.hypot(dx, dy) || 1;
    anim.shootTimer = 0.15;
    anim.sinceShot = 0;
    anim.shootDirX = dx / distance;
    anim.shootDirY = dy / distance;

    // Несколько стрел веером
    const baseAngle = Math.atan2(dy, dx);
    for (let k = 0; k < player.multishot; k++) {
        const angle = baseAngle + (k - (player.multishot - 1) / 2) * 0.13;
        gameState.bullets.push({
            x: bow.x,
            y: bow.y,
            dx: Math.cos(angle) * player.bulletSpeed,
            dy: Math.sin(angle) * player.bulletSpeed,
            damage: player.damage,
            pierce: player.pierce,
            element: player.element,
            hitSet: new Set(),   // в кого эта стрела уже попала
            life: 1.5,
            isEnemy: false
        });
    }
}

function updateShooting(dt) {
    gameState.shotTimer -= dt;
    if (gameState.shotTimer <= 0) {
        const target = findClosestEnemy();
        if (target) {
            shootBullet(target);
            gameState.shotTimer = gameState.player.fireRate;
        }
    }
}

// Эффект стихии при попадании стрелы
function applyElement(enemy, bullet) {
    const lvl = gameState.player.elementLevel;
    if (bullet.element === 'fire') {
        enemy.burn = { time: 3, tick: enemy.burn ? enemy.burn.tick : 0.5, dps: 12 + 8 * lvl };
    } else if (bullet.element === 'ice') {
        enemy.slow = { time: 2, factor: Math.min(0.7, 0.3 + 0.1 * (lvl - 1)) };
        spawnParticles(enemy.x, enemy.y, 5, '200, 240, 255', 160, 0.4, 5);
    } else if (bullet.element === 'lightning') {
        chainLightning(enemy, Math.round(bullet.damage * (0.4 + 0.1 * lvl)), 1 + lvl);
    }
}

// Молния перескакивает от врага к ближайшим соседям
function chainLightning(from, damage, count) {
    const hit = new Set([from]);
    let current = from;
    for (let k = 0; k < count; k++) {
        let best = null, bestDist = 280;
        for (const enemy of gameState.enemies) {
            if (enemy.dead || hit.has(enemy)) continue;
            const d = Math.hypot(enemy.x - current.x, enemy.y - current.y);
            if (d < bestDist) { bestDist = d; best = enemy; }
        }
        if (!best) break;
        addBolt(current.x, current.y, best.x, best.y);
        hit.add(best);
        hitEnemy(best, damage, { color: '#ffe95c' });
        current = best;
    }
}

function playerHitbox() {
    const p = gameState.player;
    return { x: p.x + 25, y: p.y + 25, w: p.width - 50, h: p.height - 35 };
}

function bulletHitsPlayer(bullet) {
    const hb = playerHitbox();
    const cx = Math.max(hb.x, Math.min(bullet.x, hb.x + hb.w));
    const cy = Math.max(hb.y, Math.min(bullet.y, hb.y + hb.h));
    return Math.hypot(bullet.x - cx, bullet.y - cy) < bullet.radius;
}

function updateBullets(dt) {
    const g = gameState;
    const bullets = g.bullets;
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        bullet.x += bullet.dx * dt;
        bullet.y += bullet.dy * dt;
        bullet.life -= dt;

        if (bullet.life <= 0 || bullet.x < 0 || bullet.x > GAME.worldWidth || bullet.y < 0 || bullet.y > GAME.worldHeight) {
            bullets.splice(i, 1);
            continue;
        }
        if (bullet.isEnemy) {
            if (bulletHitsPlayer(bullet)) {
                bullets.splice(i, 1);
                if (damagePlayer(bullet.damage)) return;
            }
            continue;
        }

        // След от огненных стрел
        if (bullet.element === 'fire' && Math.random() < 0.5) {
            spawnParticles(bullet.x, bullet.y, 1, '255, 140, 40', 20, 0.3, 5);
        }

        for (const enemy of g.enemies) {
            if (enemy.dead || bullet.hitSet.has(enemy)) continue;
            if (Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) < enemy.radius + 6) {
                bullet.hitSet.add(enemy);
                const speed = Math.hypot(bullet.dx, bullet.dy) || 1;
                hitEnemy(enemy, bullet.damage, { kbx: bullet.dx / speed * 260, kby: bullet.dy / speed * 260 });
                applyElement(enemy, bullet);
                if (bullet.pierce > 0) {
                    bullet.pierce--;
                } else {
                    bullets.splice(i, 1);
                    break;
                }
            }
        }
    }
}

function drawBullets() {
    for (const bullet of gameState.bullets) {
        if (!isInView(bullet.x, bullet.y, 40)) continue;
        if (bullet.isEnemy) {
            // Вражеский снаряд: светящийся шар
            canvasContext.fillStyle = 'rgba(' + bullet.color + ', 0.3)';
            canvasContext.beginPath();
            canvasContext.arc(bullet.x, bullet.y, bullet.radius * 2, 0, Math.PI * 2);
            canvasContext.fill();
            canvasContext.fillStyle = 'rgb(' + bullet.color + ')';
            canvasContext.beginPath();
            canvasContext.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
            canvasContext.fill();
            continue;
        }
        // Стрела: древко по направлению полёта, наконечник цвета стихии
        const element = ELEMENT_BY_ID[bullet.element];
        const len = Math.hypot(bullet.dx, bullet.dy) || 1;
        const nx = bullet.dx / len, ny = bullet.dy / len;
        canvasContext.strokeStyle = 'rgba(' + element.rgb + ', 0.35)';
        canvasContext.lineWidth = 10;
        canvasContext.beginPath();
        canvasContext.moveTo(bullet.x - nx * 30, bullet.y - ny * 30);
        canvasContext.lineTo(bullet.x, bullet.y);
        canvasContext.stroke();
        canvasContext.strokeStyle = '#8b4513';
        canvasContext.lineWidth = 4;
        canvasContext.beginPath();
        canvasContext.moveTo(bullet.x - nx * 26, bullet.y - ny * 26);
        canvasContext.lineTo(bullet.x, bullet.y);
        canvasContext.stroke();
        canvasContext.fillStyle = element.color;
        canvasContext.beginPath();
        canvasContext.arc(bullet.x, bullet.y, 6, 0, Math.PI * 2);
        canvasContext.fill();
    }
}

// ===================== Игрок =====================
const DASH_DURATION = 0.18;
const DASH_SPEED = 1150;

function tryDash() {
    const p = gameState.player;
    if (p.dashCooldown > 0 || p.dashTime > 0) return;
    let dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    let dy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    if (!dx && !dy) dx = p.anim.facing; // стоит на месте — рывок туда, куда смотрит
    const len = Math.hypot(dx, dy);
    p.dashDirX = dx / len;
    p.dashDirY = dy / len;
    p.dashTime = DASH_DURATION;
    p.dashCooldown = p.dashCooldownMax;
    p.ghostTimer = 0;
    if (dx) p.anim.facing = dx < 0 ? -1 : 1;
    spawnParticles(p.x + p.width / 2, p.y + p.height - 6, 8, '120, 100, 70', 120, 0.45, 9, { alpha: 0.5, grow: 1 });
}

// Наносит урон игроку с учётом неуязвимости. Возвращает true, если игрок умер.
function damagePlayer(amount) {
    const player = gameState.player;
    if (player.invulnerableTime > 0 || player.dashTime > 0 || screen !== 'playing') return false;
    player.health = Math.max(0, player.health - amount);
    player.invulnerableTime = 1; // 1 секунда неуязвимости
    player.anim.hitFlash = 0.2;
    addShake(10);
    addPopup('-' + amount, player.x + player.width / 2, player.y + 10, '#ff5050', 34, 0.8);
    if (player.health <= 0) {
        endGame(false);
        return true;
    }
    return false;
}

function updatePlayer(dt) {
    const player = gameState.player;
    let mx = 0, my = 0;
    if (keys.up) my -= 1;
    if (keys.down) my += 1;
    if (keys.left) mx -= 1;
    if (keys.right) mx += 1;
    let len = Math.hypot(mx, my);

    if (player.dashTime > 0) {
        // Рывок: быстро летит в одну сторону, урон не получает
        player.dashTime -= dt;
        player.x += player.dashDirX * DASH_SPEED * dt;
        player.y += player.dashDirY * DASH_SPEED * dt;
        player.ghostTimer -= dt;
        if (player.ghostTimer <= 0) {
            gameState.ghosts.push({ x: player.x, y: player.y, facing: player.anim.facing, life: 0.3 });
            player.ghostTimer = 0.03;
        }
        mx = player.dashDirX; my = player.dashDirY; len = 1;
    } else if (len > 0) {
        // По диагонали не быстрее, чем по прямой
        player.x += (mx / len) * player.speed * dt;
        player.y += (my / len) * player.speed * dt;
    }
    player.x = Math.max(0, Math.min(player.x, GAME.worldWidth - player.width));
    player.y = Math.max(0, Math.min(player.y, GAME.worldHeight - player.height));

    player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    if (player.invulnerableTime > 0) player.invulnerableTime -= dt;
    if (player.regen > 0) player.health = Math.min(player.maxHealth, player.health + player.regen * dt);
    updatePlayerAnim(dt, len > 0 ? mx / len : 0, len > 0 ? my / len : 0);
}

// ===================== Анимации лучника =====================
function updatePlayerAnim(dt, moveX, moveY) {
    const player = gameState.player;
    const a = player.anim;
    const moving = moveX !== 0 || moveY !== 0;
    a.moveX = moveX;
    a.moveY = moveY;
    a.sinceShot += dt;

    // Куда смотрит: недавно стрелял — на цель, иначе по направлению бега
    if (a.sinceShot > 0.8 && moveX !== 0) a.facing = moveX < 0 ? -1 : 1;

    a.walkPhase = moving ? a.walkPhase + dt * 11 : 0;
    a.breath += dt * 2.5;

    // Наклон корпуса в сторону бега (плавно)
    const targetTilt = moveX * 0.09;
    a.tilt += (targetTilt - a.tilt) * Math.min(1, dt * 10);

    a.shootTimer = Math.max(0, a.shootTimer - dt);
    a.hitFlash = Math.max(0, a.hitFlash - dt);
    a.auraTimer = Math.max(0, a.auraTimer - dt);

    // Пыль из-под ног при беге
    if (moving) {
        a.dustTimer -= dt;
        if (a.dustTimer <= 0) {
            spawnParticles(player.x + player.width / 2 + (Math.random() - 0.5) * 30, player.y + player.height - 4,
                1, '120, 100, 70', 15, 0.45, 8, { vx: -moveX * 30, vy: -15, alpha: 0.45, grow: 0.6 });
            a.dustTimer = 0.09;
        }
    }
}

// Красная копия спрайта для вспышки при уроне (делается один раз)
let heroHitImg = null;
function getHeroHitImg() {
    if (heroHitImg || !imgReady(heroimg)) return heroHitImg;
    const c = document.createElement('canvas');
    c.width = heroimg.naturalWidth;
    c.height = heroimg.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(heroimg, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgb(255, 50, 50)';
    g.fillRect(0, 0, c.width, c.height);
    heroHitImg = c;
    return c;
}

const DEATH_DURATION = 1.3;

// "Тени" лучника во время рывка
function drawGhosts() {
    if (!imgReady(heroimg)) return;
    const p = gameState.player;
    for (const ghost of gameState.ghosts) {
        canvasContext.save();
        canvasContext.globalAlpha = 0.4 * ghost.life / 0.3;
        canvasContext.filter = 'sepia(1) hue-rotate(170deg) saturate(4)';
        canvasContext.translate(ghost.x + p.width / 2, ghost.y + p.height);
        canvasContext.scale(ghost.facing === 1 ? -1 : 1, 1);
        canvasContext.drawImage(heroimg, -p.width / 2, -p.height, p.width, p.height);
        canvasContext.restore();
    }
}

function drawPlayer() {
    const player = gameState.player;
    const a = player.anim;
    const footX = player.x + player.width / 2;
    const footY = player.y + player.height;
    const dying = screen === 'dying';

    // Тень под ногами
    canvasContext.fillStyle = 'rgba(0,0,0,0.28)';
    canvasContext.beginPath();
    canvasContext.ellipse(footX, footY - 4, player.width * 0.38, 10, 0, 0, Math.PI * 2);
    canvasContext.fill();

    // Радиус магнита (еле заметный круг)
    if (!dying) {
        canvasContext.strokeStyle = 'rgba(79, 195, 255, 0.12)';
        canvasContext.lineWidth = 2;
        canvasContext.beginPath();
        canvasContext.arc(footX, player.y + player.height / 2, player.magnet, 0, Math.PI * 2);
        canvasContext.stroke();
    }

    // Кольцо при подборе бонуса / новом уровне
    if (a.auraTimer > 0) {
        const k = 1 - a.auraTimer / 0.5;
        canvasContext.strokeStyle = a.auraColor;
        canvasContext.globalAlpha = 1 - k;
        canvasContext.lineWidth = 6;
        canvasContext.beginPath();
        canvasContext.arc(footX, player.y + player.height * 0.55, 40 + k * 70, 0, Math.PI * 2);
        canvasContext.stroke();
        canvasContext.globalAlpha = 1;
    }

    let offsetX = 0, offsetY = 0, rotation = a.tilt, scaleX = 1, scaleY = 1, alpha = 1;

    if (dying) {
        // Падает назад (от направления взгляда) и растворяется
        const t = a.deathTime;
        const fall = Math.min(1, t / 0.5);
        rotation = -a.facing * fall * fall * (Math.PI / 2) * 0.95;
        offsetY = -Math.sin(fall * Math.PI) * 12;
        alpha = 1 - Math.max(0, (t - 0.7) / (DEATH_DURATION - 0.7));
    } else {
        const moving = a.moveX !== 0 || a.moveY !== 0;
        if (player.dashTime > 0) {
            // Во время рывка вытягивается вперёд
            scaleX = 1.12;
            scaleY = 0.92;
            rotation = a.moveX * 0.2;
        } else if (moving) {
            // Подпрыгивание при каждом шаге + лёгкое сжатие на приземлении
            const step = Math.abs(Math.sin(a.walkPhase));
            offsetY = -step * 9;
            scaleY = 1 - (1 - step) * 0.05;
            scaleX = 1 + (1 - step) * 0.03;
        } else {
            // Дыхание в покое
            const b = Math.sin(a.breath);
            scaleY = 1 + b * 0.018;
            scaleX = 1 - b * 0.008;
        }
        // Отдача от выстрела: толчок назад и сжатие
        if (a.shootTimer > 0) {
            const k = a.shootTimer / 0.15;
            offsetX -= a.shootDirX * 7 * k;
            offsetY -= a.shootDirY * 4 * k;
            scaleX *= 1 - 0.05 * k;
            scaleY *= 1 + 0.03 * k;
        }
        // После вспышки — мерцание, пока действует неуязвимость
        if (player.invulnerableTime > 0 && a.hitFlash <= 0 && Math.floor(player.invulnerableTime * 12) % 2 === 0) {
            alpha = 0.4;
        }
    }

    canvasContext.save();
    canvasContext.globalAlpha = alpha;
    canvasContext.translate(footX + offsetX, footY + offsetY);
    canvasContext.rotate(rotation);
    // Картинка смотрит влево: отражаем, если лучник смотрит вправо
    canvasContext.scale(scaleX * (a.facing === 1 ? -1 : 1), scaleY);
    if (imgReady(heroimg)) {
        canvasContext.drawImage(heroimg, -player.width / 2, -player.height, player.width, player.height);
        const hitImg = getHeroHitImg();
        if (hitImg && (a.hitFlash > 0 || dying)) {
            canvasContext.globalAlpha = alpha * (dying ? Math.max(0, 0.7 - a.deathTime) : Math.min(1, a.hitFlash / 0.12) * 0.85);
            canvasContext.drawImage(hitImg, -player.width / 2, -player.height, player.width, player.height);
        }
    } else {
        canvasContext.fillStyle = 'blue';
        canvasContext.fillRect(-player.width / 2, -player.height, player.width, player.height);
    }
    canvasContext.restore();

    // Вспышка тетивы при выстреле (цвета стихии)
    if (!dying && a.shootTimer > 0.07) {
        const bow = bowPosition(player);
        canvasContext.fillStyle = 'rgba(' + ELEMENT_BY_ID[player.element].rgb + ',' + (a.shootTimer / 0.15) * 0.8 + ')';
        canvasContext.beginPath();
        canvasContext.arc(bow.x + offsetX, bow.y + offsetY, 12, 0, Math.PI * 2);
        canvasContext.fill();
    }
}

function drawHealthBarPlayer() {
    const player = gameState.player;
    const part = Math.max(0, player.health / player.maxHealth);
    const y = player.y - 8;
    canvasContext.fillStyle = 'rgba(0,0,0,0.6)';
    canvasContext.fillRect(player.x - 2, y - 2, player.width + 4, 18);
    canvasContext.fillStyle = '#a00';
    canvasContext.fillRect(player.x, y, player.width, 14);
    canvasContext.fillStyle = '#2ecc40';
    canvasContext.fillRect(player.x, y, player.width * part, 14);
}

// ===================== Бонусы на карте =====================
const PICKUP_TYPES = {
    heal:     { color: '#2ecc40', icon: '+', label: '+30 HP' },
    damage:   { color: '#ff4136', icon: '⚔', label: '+10 урон' },
    fireRate: { color: '#ffdc00', icon: '»', label: 'скорострельность +10%' }
};
const PICKUP_RADIUS = 22;
const PICKUP_LIFETIME = 12; // секунд лежит на карте
const MAX_PICKUPS = 3;

function spawnPickup() {
    const types = Object.keys(PICKUP_TYPES);
    const p = gameState.player;
    // Где-то рядом с игроком, но не прямо под ним
    const angle = Math.random() * Math.PI * 2;
    const dist = 300 + Math.random() * 450;
    const x = Math.max(80, Math.min(GAME.worldWidth - 80, p.x + p.width / 2 + Math.cos(angle) * dist));
    const y = Math.max(80, Math.min(GAME.worldHeight - 80, p.y + p.height / 2 + Math.sin(angle) * dist));
    gameState.pickups.push({ type: types[Math.floor(Math.random() * types.length)], x: x, y: y, life: PICKUP_LIFETIME });
}

function applyPickup(pickup) {
    const player = gameState.player;
    if (pickup.type === 'heal') {
        player.health = Math.min(player.maxHealth, player.health + 30);
    } else if (pickup.type === 'damage') {
        player.damage += 10;
    } else if (pickup.type === 'fireRate') {
        player.fireRate = Math.max(0.1, player.fireRate * 0.9);
    }
    const t = PICKUP_TYPES[pickup.type];
    player.anim.auraTimer = 0.5;
    player.anim.auraColor = t.color;
    addPopup(t.label, pickup.x, pickup.y - 30, t.color, 30, 1.2);
}

function updatePickups(dt) {
    const g = gameState;
    g.pickupTimer -= dt;
    if (g.pickupTimer <= 0) {
        if (g.pickups.length < MAX_PICKUPS) spawnPickup();
        g.pickupTimer = 6 + Math.random() * 4;
    }
    const p = g.player;
    for (let i = g.pickups.length - 1; i >= 0; i--) {
        const pickup = g.pickups[i];
        pickup.life -= dt;
        const closestX = Math.max(p.x, Math.min(pickup.x, p.x + p.width));
        const closestY = Math.max(p.y, Math.min(pickup.y, p.y + p.height));
        if (Math.hypot(pickup.x - closestX, pickup.y - closestY) < PICKUP_RADIUS) {
            applyPickup(pickup);
            g.pickups.splice(i, 1);
        } else if (pickup.life <= 0) {
            g.pickups.splice(i, 1);
        }
    }
}

function drawPickups() {
    for (const pickup of gameState.pickups) {
        // Мигает последние 3 секунды перед исчезновением
        if (pickup.life < 3 && Math.floor(pickup.life * 6) % 2 === 0) continue;
        const t = PICKUP_TYPES[pickup.type];
        const bob = Math.sin(pickup.life * 4) * 4;
        canvasContext.fillStyle = 'rgba(0,0,0,0.35)';
        canvasContext.beginPath();
        canvasContext.ellipse(pickup.x, pickup.y + PICKUP_RADIUS + 6, PICKUP_RADIUS * 0.8, 6, 0, 0, Math.PI * 2);
        canvasContext.fill();
        canvasContext.fillStyle = t.color;
        canvasContext.strokeStyle = 'white';
        canvasContext.lineWidth = 3;
        canvasContext.beginPath();
        canvasContext.arc(pickup.x, pickup.y + bob, PICKUP_RADIUS, 0, Math.PI * 2);
        canvasContext.fill();
        canvasContext.stroke();
        canvasContext.fillStyle = 'black';
        canvasContext.font = 'bold 26px Arial';
        canvasContext.textAlign = 'center';
        canvasContext.textBaseline = 'middle';
        canvasContext.fillText(t.icon, pickup.x, pickup.y + bob + 1);
        canvasContext.textAlign = 'left';
        canvasContext.textBaseline = 'alphabetic';
    }
}

// ===================== Интерфейс =====================
function formatTime(sec) {
    sec = Math.floor(sec);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
}

function drawText(text, x, y, size, align, color) {
    canvasContext.font = size + 'px Arial';
    canvasContext.textAlign = align || 'left';
    canvasContext.lineWidth = Math.max(3, size / 12);
    canvasContext.strokeStyle = 'black';
    canvasContext.strokeText(text, x, y);
    canvasContext.fillStyle = color || 'white';
    canvasContext.fillText(text, x, y);
    canvasContext.textAlign = 'left';
}

// Текст по центру с переносом строк
function drawWrapped(text, cx, y, maxWidth, size, lineHeight, color) {
    canvasContext.font = size + 'px Arial';
    let line = '';
    for (const word of text.split(' ')) {
        const test = line ? line + ' ' + word : word;
        if (line && canvasContext.measureText(test).width > maxWidth) {
            drawText(line, cx, y, size, 'center', color);
            canvasContext.font = size + 'px Arial';
            line = word;
            y += lineHeight;
        } else {
            line = test;
        }
    }
    if (line) drawText(line, cx, y, size, 'center', color);
}

function drawPanel(r, fill, stroke, lineWidth) {
    canvasContext.fillStyle = fill;
    canvasContext.fillRect(r.x, r.y, r.w, r.h);
    canvasContext.strokeStyle = stroke;
    canvasContext.lineWidth = lineWidth || 3;
    canvasContext.strokeRect(r.x, r.y, r.w, r.h);
}

function dimScreen(alpha) {
    canvasContext.fillStyle = 'rgba(0,0,0,' + alpha + ')';
    canvasContext.fillRect(0, 0, GAME.width, GAME.height);
}

// Фон меню — картинка целиком на экран
function drawBack() {
    if (GAME.background) {
        canvasContext.drawImage(GAME.background, 0, 0, GAME.width, GAME.height);
    } else {
        canvasContext.fillStyle = '#2d5a27';
        canvasContext.fillRect(0, 0, GAME.width, GAME.height);
    }
}

// Фон карты — растянутая на весь мир картинка; рисуем только видимый кусок
function drawWorldBackground() {
    const cam = gameState.camera;
    const W = GAME.worldWidth, H = GAME.worldHeight, m = 40;
    canvasContext.fillStyle = '#1d3a1a';
    canvasContext.fillRect(cam.x - m, cam.y - m, GAME.width + m * 2, GAME.height + m * 2);
    const x0 = Math.max(0, cam.x - m), y0 = Math.max(0, cam.y - m);
    const x1 = Math.min(W, cam.x + GAME.width + m), y1 = Math.min(H, cam.y + GAME.height + m);
    if (x1 > x0 && y1 > y0) {
        if (GAME.background) {
            const bg = GAME.background;
            const kx = bg.naturalWidth / W, ky = bg.naturalHeight / H;
            canvasContext.drawImage(bg, x0 * kx, y0 * ky, (x1 - x0) * kx, (y1 - y0) * ky, x0, y0, x1 - x0, y1 - y0);
        } else {
            canvasContext.fillStyle = '#2d5a27';
            canvasContext.fillRect(x0, y0, x1 - x0, y1 - y0);
        }
    }
    // Граница карты
    canvasContext.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    canvasContext.lineWidth = 16;
    canvasContext.strokeRect(0, 0, W, H);
}

function drawMinimap() {
    const g = gameState;
    const size = 220, x = GAME.width - size - 20, y = GAME.height - size - 20;
    const kx = size / GAME.worldWidth, ky = size / GAME.worldHeight;
    drawPanel({ x: x, y: y, w: size, h: size }, 'rgba(0,0,0,0.45)', 'rgba(255,255,255,0.6)', 2);
    // Видимая область
    canvasContext.strokeStyle = 'rgba(255,255,255,0.35)';
    canvasContext.lineWidth = 1;
    canvasContext.strokeRect(x + g.camera.x * kx, y + g.camera.y * ky, GAME.width * kx, GAME.height * ky);
    for (const pickup of g.pickups) {
        canvasContext.fillStyle = PICKUP_TYPES[pickup.type].color;
        canvasContext.fillRect(x + pickup.x * kx - 2, y + pickup.y * ky - 2, 4, 4);
    }
    for (const enemy of g.enemies) {
        if (enemy.dead) continue;
        const s = enemy.boss ? 8 : 3;
        canvasContext.fillStyle = enemy.boss ? '#ff9d3c' : '#ff4444';
        canvasContext.fillRect(x + enemy.x * kx - s / 2, y + enemy.y * ky - s / 2, s, s);
    }
    const p = g.player;
    canvasContext.fillStyle = 'white';
    canvasContext.beginPath();
    canvasContext.arc(x + (p.x + p.width / 2) * kx, y + (p.y + p.height / 2) * ky, 4, 0, Math.PI * 2);
    canvasContext.fill();
}

function drawHUD() {
    const g = gameState;
    const p = g.player;

    // Полоса опыта уровня вдоль верхнего края
    const need = xpForLevel(g.level);
    canvasContext.fillStyle = 'rgba(0,0,0,0.55)';
    canvasContext.fillRect(0, 0, GAME.width, 16);
    canvasContext.fillStyle = '#4fc3ff';
    canvasContext.fillRect(0, 0, GAME.width * Math.min(1, g.levelXp / need), 16);

    if (g.endless) {
        drawText('Бесконечный режим  ' + formatTime(g.time), 20, 56, 34, 'left', '#ffd54a');
    } else {
        drawText('Время: ' + formatTime(g.time) + '  (до победы ' + formatTime(Math.max(0, GAME.winTime - g.time)) + ')', 20, 56, 34);
    }
    drawText('Ур. ' + g.level + '   Убийств: ' + g.kills + '   Опыт: ' + g.xp, 20, 96, 30);
    const el = ELEMENT_BY_ID[p.element];
    drawText('Урон: ' + p.damage + '   Выстр./сек: ' + (1 / p.fireRate).toFixed(1) + '   Стрел: ' + p.multishot +
        (p.pierce ? '   Пробивание: ' + p.pierce : ''), 20, 132, 24);

    // Полоса здоровья босса
    const boss = g.enemies.find(e => e.boss && !e.dead);
    if (boss) {
        const r = { x: (GAME.width - 760) / 2 + 120, y: 30, w: 760, h: 28 };
        drawPanel(r, 'rgba(0,0,0,0.6)', 'rgba(255,255,255,0.7)', 2);
        canvasContext.fillStyle = '#d32f2f';
        canvasContext.fillRect(r.x + 2, r.y + 2, (r.w - 4) * Math.max(0, boss.health / boss.maxHealth), r.h - 4);
        drawText(boss.type.name, r.x + r.w / 2, r.y + 22, 22, 'center');
    }

    // Стихия и рывок — внизу слева
    drawText('Стихия: ' + el.name + ' (ур. ' + p.elementLevel + ')', 20, GAME.height - 70, 28, 'left', el.color);
    const dashReady = p.dashCooldown <= 0;
    drawText(dashReady ? 'Рывок [Shift] — готов' : 'Рывок [Shift]', 20, GAME.height - 34, 24, 'left', dashReady ? '#9cff9c' : '#cccccc');
    canvasContext.fillStyle = 'rgba(0,0,0,0.6)';
    canvasContext.fillRect(20, GAME.height - 24, 220, 10);
    canvasContext.fillStyle = dashReady ? '#9cff9c' : '#7fd8ff';
    canvasContext.fillRect(20, GAME.height - 24, 220 * (1 - p.dashCooldown / p.dashCooldownMax), 10);

    drawMinimap();

    // Большая надпись по центру (босс, бесконечный режим...) — только во время игры
    if (g.banner && (screen === 'playing' || screen === 'dying')) {
        const b = g.banner;
        canvasContext.globalAlpha = Math.min(1, b.life * 2, (b.maxLife - b.life) * 4);
        drawText(b.text, GAME.width / 2, 280, 80, 'center', b.color);
        if (b.sub) drawText(b.sub, GAME.width / 2, 335, 34, 'center');
        canvasContext.globalAlpha = 1;
    }
}

function recordsText() {
    return 'Рекорды — время: ' + formatTime(records.time) + '   убийств: ' + records.kills + '   уровень: ' + records.level;
}

function drawMenu(dt) {
    drawBack();
    dimScreen(0.5);
    drawText('Bow and Elementals', GAME.width / 2, 125, 100, 'center');
    drawText('Продержись ' + formatTime(GAME.winTime) + '. Лучник стреляет сам. Собирай кристаллы опыта и бонусы.', GAME.width / 2, 195, 34, 'center');
    drawText('Движение: WASD / стрелки   ·   Рывок: Shift / Пробел   ·   Пауза: Esc / P', GAME.width / 2, 245, 28, 'center');

    // Выбор стихии
    drawText('Стихия стрел (Q / E или клик):', GAME.width / 2, 310, 32, 'center');
    for (let i = 0; i < ELEMENTS.length; i++) {
        const el = ELEMENTS[i];
        const r = elementCardRect(i);
        const selected = i === selectedElement;
        drawPanel(r, selected ? 'rgba(' + el.rgb + ', 0.3)' : 'rgba(40,40,40,0.8)', selected ? el.color : '#777', selected ? 5 : 2);
        drawText(el.name, r.x + r.w / 2, r.y + 45, 36, 'center', el.color);
        drawText(el.desc, r.x + r.w / 2, r.y + 85, 24, 'center');
    }

    drawText('Нажми Enter, чтобы начать', GAME.width / 2, 525, 56, 'center');

    // Магазин улучшений
    drawText('Улучшения — опыт: ' + totalXP, GAME.width / 2, 600, 40, 'center');
    for (let i = 0; i < UPGRADES.length; i++) {
        const u = UPGRADES[i];
        const r = shopCardRect(i);
        const level = upgradeLevels[u.id];
        const maxed = level >= u.maxLevel;
        const affordable = !maxed && totalXP >= upgradeCost(u);
        drawPanel(r, maxed ? 'rgba(60,60,60,0.85)' : affordable ? 'rgba(30,90,40,0.9)' : 'rgba(40,40,40,0.85)', affordable ? '#7fff7f' : '#888');
        const cx = r.x + r.w / 2;
        drawText('[' + u.key + '] ' + u.name, cx, r.y + 45, 34, 'center');
        drawText(u.desc, cx, r.y + 85, 26, 'center');
        drawText('Ур. ' + level + ' / ' + u.maxLevel, cx, r.y + 120, 26, 'center');
        drawText(maxed ? 'МАКС' : 'Цена: ' + upgradeCost(u) + ' XP', cx, r.y + 155, 28, 'center');
    }
    drawText('Нажми 1–4 или кликни по карточке, чтобы купить', GAME.width / 2, 840, 30, 'center');

    if (shopMessageTimer > 0) {
        shopMessageTimer -= dt;
        drawText(shopMessage, GAME.width / 2, 895, 38, 'center', '#ffd54a');
    }
    drawText(recordsText(), GAME.width / 2, 1010, 30, 'center');
}

function drawPauseOverlay() {
    const p = gameState.player;
    dimScreen(0.6);
    drawText('ПАУЗА', GAME.width / 2, 360, 130, 'center');
    drawText('Esc / P / Enter — продолжить', GAME.width / 2, 460, 44, 'center');
    drawText('M — выйти в меню (опыт сохранится)', GAME.width / 2, 520, 38, 'center');
    const el = ELEMENT_BY_ID[p.element];
    drawText('Уровень ' + gameState.level + '  ·  хп ' + Math.ceil(p.health) + '/' + p.maxHealth + '  ·  урон ' + p.damage +
        '  ·  стрел ' + p.multishot + '  ·  ' + el.name + ' ур. ' + p.elementLevel, GAME.width / 2, 620, 32, 'center');
}

function drawLevelUpOverlay() {
    const g = gameState;
    const p = g.player;
    dimScreen(0.6);
    drawText('Новый уровень!', GAME.width / 2, 250, 90, 'center', '#4fc3ff');
    drawText('Выбери улучшение' + (g.pendingLevelUps > 1 ? ' (ещё ' + (g.pendingLevelUps - 1) + ' после этого)' : ''), GAME.width / 2, 320, 36, 'center');
    for (let i = 0; i < g.levelChoices.length; i++) {
        const option = g.levelChoices[i];
        const r = levelCardRect(i);
        const cx = r.x + r.w / 2;
        drawPanel(r, 'rgba(20, 40, 70, 0.92)', '#4fc3ff', 3);
        drawText('[' + (i + 1) + ']', cx, r.y + 50, 34, 'center', '#4fc3ff');
        drawWrapped(option.name(p), cx, r.y + 105, r.w - 40, 36, 42, '#ffffff');
        drawWrapped(option.desc(p), cx, r.y + 190, r.w - 50, 26, 32, '#dddddd');
        drawText('Взято: ' + (p.picks[option.id] || 0) + ' / ' + option.max, cx, r.y + r.h - 20, 24, 'center', '#aaaaaa');
    }
    drawText('Нажми 1–3 или кликни по карточке', GAME.width / 2, 740, 32, 'center');
}

function drawEndOverlay(isWin) {
    const g = gameState;
    dimScreen(0.6);
    drawText(isWin ? 'YOU WIN' : 'YOU LOSE', GAME.width / 2, 320, isWin ? 180 : 140, 'center', isWin ? '#ffd54a' : '#ffffff');
    drawText('Время: ' + formatTime(g.time) + '   Убийств: ' + g.kills + '   Уровень: ' + g.level + '   +' + g.xp + ' опыта',
        GAME.width / 2, 420, 40, 'center');
    drawText('Всего опыта: ' + totalXP, GAME.width / 2, 475, 34, 'center');
    if (g.newRecords.length) drawText('Новый рекорд: ' + g.newRecords.join(', ') + '!', GAME.width / 2, 540, 40, 'center', '#ffd54a');
    if (isWin) drawText('C — продолжить в бесконечном режиме', GAME.width / 2, 650, 46, 'center', '#ffd54a');
    drawText('Enter — новая игра', GAME.width / 2, 720, 44, 'center');
    drawText('M или Esc — в меню (потратить опыт)', GAME.width / 2, 775, 36, 'center');
    drawText(recordsText(), GAME.width / 2, 1010, 30, 'center');
}

// ===================== Главный цикл =====================
function update(dt) {
    const g = gameState;
    removeDeadEnemies();
    g.time += dt;
    if (!g.endless && g.time >= GAME.winTime) {
        endGame(true);
        return;
    }
    updatePlayer(dt);
    updateCamera(dt);
    updateSpawning(dt);
    updateEnemies(dt);
    if (screen !== 'playing') return; // игрок умер в этом кадре
    updatePickups(dt);
    updateGems(dt);
    updateShooting(dt);
    updateBullets(dt);
    if (screen !== 'playing') return;
    updateEffects(dt);
    removeDeadEnemies();
    if (g.pendingLevelUps > 0) openLevelUp();
}

function updateDying(dt) {
    const a = gameState.player.anim;
    a.deathTime += dt;
    updateEffects(dt);
    if (a.deathTime >= DEATH_DURATION) screen = 'gameover';
}

function draw() {
    const g = gameState;
    const cam = g.camera;
    const shaking = g.shake > 0 && (screen === 'playing' || screen === 'dying');
    const sx = shaking ? (Math.random() - 0.5) * 2 * g.shake : 0;
    const sy = shaking ? (Math.random() - 0.5) * 2 * g.shake : 0;

    canvasContext.save();
    canvasContext.translate(Math.round(-cam.x + sx), Math.round(-cam.y + sy));
    drawWorldBackground();
    drawPickups();
    drawGems();
    drawCorpses();
    for (const enemy of g.enemies) {
        if (!enemy.dead && isInView(enemy.x, enemy.y, enemy.radius * 3)) drawEnemy(enemy);
    }
    drawParticles();
    drawGhosts();
    if (screen !== 'gameover') drawPlayer(); // после анимации смерти лучника уже нет
    if (screen !== 'dying' && screen !== 'gameover') drawHealthBarPlayer();
    drawBullets();
    drawBolts();
    drawPopups();
    canvasContext.restore();

    drawHUD();
}

let lastTime = performance.now();
function play(now) {
    // Время кадра в секундах; ограничиваем, чтобы после сворачивания вкладки не было рывка
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    if (screen === 'playing') update(dt);
    else if (screen === 'dying') updateDying(dt);

    canvasContext.clearRect(0, 0, GAME.width, GAME.height);
    switch (screen) {
        case 'playing':
        case 'dying': draw(); break;
        case 'paused': draw(); drawPauseOverlay(); break;
        case 'levelup': draw(); drawLevelUpOverlay(); break;
        case 'menu': drawMenu(dt); break;
        default: draw(); drawEndOverlay(screen === 'win'); break;
    }

    requestAnimationFrame(play);
}

newGame();
requestAnimationFrame(play);
