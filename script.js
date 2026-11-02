// ===================== Настройки =====================
var GAME = {
    width: 1900,
    height: 1050,
    background: null,
    winTime: 120,          // секунд до победы
    maxEnemies: 15,        // стартовый лимит врагов
    maxEnemiesCap: 40,     // лимит врагов к концу игры
    spawnInterval: 1.2,    // секунд между спавнами в начале
    spawnIntervalMin: 0.35 // минимальный интервал спавна
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

// ===================== Опыт (сохраняется между играми) =====================
function loadXP() {
    try { return Number(localStorage.getItem('bae_xp')) || 0; } catch (e) { return 0; }
}
function saveXP(value) {
    try { localStorage.setItem('bae_xp', String(value)); } catch (e) { }
}
var totalXP = loadXP();

// ===================== Улучшения (покупаются за опыт в меню) =====================
const UPGRADES = [
    { id: 'health',   key: '1', name: 'Здоровье',        desc: '+20 к макс. хп',      maxLevel: 5, baseCost: 40 },
    { id: 'damage',   key: '2', name: 'Урон',            desc: '+10 к урону стрел',   maxLevel: 5, baseCost: 50 },
    { id: 'fireRate', key: '3', name: 'Скорострельность', desc: '-8% к перезарядке',   maxLevel: 5, baseCost: 50 },
    { id: 'speed',    key: '4', name: 'Скорость',        desc: '+8% к скорости бега', maxLevel: 5, baseCost: 30 }
];

function loadUpgrades() {
    const levels = { health: 0, damage: 0, fireRate: 0, speed: 0 };
    try {
        const saved = JSON.parse(localStorage.getItem('bae_upgrades') || '{}');
        for (const u of UPGRADES) levels[u.id] = Math.min(u.maxLevel, Math.max(0, Number(saved[u.id]) || 0));
    } catch (e) { }
    return levels;
}
function saveUpgrades() {
    try { localStorage.setItem('bae_upgrades', JSON.stringify(upgradeLevels)); } catch (e) { }
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
        saveUpgrades();
        shopMessage = '«' + u.name + '» — теперь ур. ' + upgradeLevels[u.id];
    }
    shopMessageTimer = 2;
}

// ===================== Состояние игры =====================
// screen: 'menu' | 'playing' | 'gameover' | 'win'
var screen = 'menu';
var gameState;

function newGame() {
    const maxHealth = 120 + 20 * upgradeLevels.health;
    gameState = {
        player: {
            x: GAME.width / 2 - 60,
            y: GAME.height / 2 - 90,
            width: 120,
            height: 180,
            speed: 300 * (1 + 0.08 * upgradeLevels.speed),        // пикселей в секунду
            health: maxHealth,
            maxHealth: maxHealth,
            damage: 50 + 10 * upgradeLevels.damage,
            bulletSpeed: 900,                                      // пикселей в секунду
            fireRate: 0.5 * Math.pow(0.92, upgradeLevels.fireRate), // секунд между выстрелами
            invulnerableTime: 0                                    // секунд
        },
        bullets: [],
        enemies: [],
        pickups: [],
        time: 0,
        spawnTimer: 0,
        shotTimer: 0,
        pickupTimer: 5,
        kills: 0,
        xp: 0,
        popups: []   // всплывающие надписи ("+30 HP" и т.п.)
    };
}
newGame();

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

window.addEventListener('keydown', (event) => {
    if (setKey(event, true)) event.preventDefault(); // стрелки не прокручивают страницу
    if (screen === 'playing') return;
    if (event.code === 'Enter' || event.code === 'Space') {
        event.preventDefault();
        newGame();
        screen = 'playing';
    } else if (screen === 'menu' && /^(Digit|Numpad)[1-4]$/.test(event.code)) {
        buyUpgrade(Number(event.code.slice(-1)) - 1);
    } else if (screen !== 'menu' && (event.code === 'Escape' || event.code === 'KeyM')) {
        screen = 'menu';
    }
});

// Клик мышью по карточкам магазина в меню
function shopCardRect(index) {
    const w = 380, h = 170, gap = 30;
    const total = UPGRADES.length * w + (UPGRADES.length - 1) * gap;
    return { x: (GAME.width - total) / 2 + index * (w + gap), y: 560, w: w, h: h };
}
canvas.addEventListener('click', (event) => {
    if (screen !== 'menu') return;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (GAME.width / rect.width);
    const y = (event.clientY - rect.top) * (GAME.height / rect.height);
    for (let i = 0; i < UPGRADES.length; i++) {
        const r = shopCardRect(i);
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) buyUpgrade(i);
    }
});
window.addEventListener('keyup', (event) => { setKey(event, false); });
// Если окно потеряло фокус, клавиши не "залипают"
window.addEventListener('blur', () => {
    keys.up = keys.down = keys.left = keys.right = false;
});

// ===================== Враги =====================
function spawnEnemy() {
    // Случайная точка за пределами экрана
    const margin = 80;
    const side = Math.floor(Math.random() * 4);
    let x, y;
    switch (side) {
        case 0: x = -margin; y = Math.random() * GAME.height; break;              // слева
        case 1: x = GAME.width + margin; y = Math.random() * GAME.height; break;  // справа
        case 2: x = Math.random() * GAME.width; y = -margin; break;               // сверху
        default: x = Math.random() * GAME.width; y = GAME.height + margin; break; // снизу
    }

    // Стрелки появляются не сразу, а через 15 секунд после начала
    const rangedChance = gameState.time > 15 ? 0.2 : 0;
    const roll = Math.random();
    let enemy;
    if (roll < rangedChance) {
        // Дальний бой, мало хп: держит дистанцию и стреляет
        enemy = {
            health: 60, maxHealth: 60, radius: 24, damage: 10, color: 'purple', enemy_x: x, enemy_y: y, speed: 120,
            ranged: true, range: 420, shotDamage: 12, shotSpeed: 420, fireRate: 2, shotTimer: 1 + Math.random()
        };
    } else if (roll < rangedChance + (1 - rangedChance) * 0.45) {
        // Ближний бой, больше хп, медленный
        enemy = { health: 150, maxHealth: 150, radius: 32, damage: 20, color: 'green', enemy_x: x, enemy_y: y, speed: 80 };
    } else {
        // Ближний бой, мало хп, быстрый
        enemy = { health: 100, maxHealth: 100, radius: 28, damage: 15, color: 'red', enemy_x: x, enemy_y: y, speed: 165 };
    }
    gameState.enemies.push(enemy);
}

function updateSpawning(dt) {
    // Сложность растёт со временем
    const progress = Math.min(gameState.time / GAME.winTime, 1);
    const interval = GAME.spawnInterval - (GAME.spawnInterval - GAME.spawnIntervalMin) * progress;
    const limit = Math.round(GAME.maxEnemies + (GAME.maxEnemiesCap - GAME.maxEnemies) * progress);

    gameState.spawnTimer -= dt;
    if (gameState.spawnTimer <= 0) {
        if (gameState.enemies.length < limit) spawnEnemy();
        gameState.spawnTimer = interval;
    }
}

function updateEnemies(dt) {
    const player = gameState.player;
    const px = player.x + player.width / 2;
    const py = player.y + player.height / 2;
    const enemies = gameState.enemies;

    // Движение к игроку
    for (const enemy of enemies) {
        const dx = px - enemy.enemy_x;
        const dy = py - enemy.enemy_y;
        const distance = Math.hypot(dx, dy);
        if (distance <= 1) continue;
        const nx = dx / distance, ny = dy / distance;

        if (enemy.ranged) {
            // Стрелок подходит на дистанцию выстрела, а если игрок слишком близко — отходит
            let dir = 0;
            if (distance > enemy.range) dir = 1;
            else if (distance < enemy.range * 0.6) dir = -0.7;
            if (dir !== 0) {
                enemy.enemy_x += nx * enemy.speed * dir * dt;
                enemy.enemy_y += ny * enemy.speed * dir * dt;
                // Не убегает за экран, если уже на нём
                if (isOnScreen(enemy)) {
                    enemy.enemy_x = Math.max(enemy.radius, Math.min(enemy.enemy_x, GAME.width - enemy.radius));
                    enemy.enemy_y = Math.max(enemy.radius, Math.min(enemy.enemy_y, GAME.height - enemy.radius));
                }
            }
            // Стреляет, только когда виден на экране и в радиусе
            enemy.shotTimer -= dt;
            if (enemy.shotTimer <= 0 && isOnScreen(enemy) && distance <= enemy.range * 1.2) {
                gameState.bullets.push({
                    x: enemy.enemy_x,
                    y: enemy.enemy_y,
                    dx: nx * enemy.shotSpeed,
                    dy: ny * enemy.shotSpeed,
                    damage: enemy.shotDamage,
                    isEnemy: true
                });
                enemy.shotTimer = enemy.fireRate;
            }
        } else {
            enemy.enemy_x += nx * enemy.speed * dt;
            enemy.enemy_y += ny * enemy.speed * dt;
        }
    }

    // Враги расталкивают друг друга, чтобы не стакаться
    for (let i = 0; i < enemies.length; i++) {
        for (let j = i + 1; j < enemies.length; j++) {
            const a = enemies[i], b = enemies[j];
            let dx = b.enemy_x - a.enemy_x;
            let dy = b.enemy_y - a.enemy_y;
            let dist = Math.hypot(dx, dy);
            const minDist = a.radius + b.radius;
            if (dist < minDist) {
                if (dist < 0.01) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; dist = Math.hypot(dx, dy); }
                const push = (minDist - dist) / 2;
                const nx = dx / dist, ny = dy / dist;
                a.enemy_x -= nx * push; a.enemy_y -= ny * push;
                b.enemy_x += nx * push; b.enemy_y += ny * push;
            }
        }
    }

    // Урон игроку при касании (игрок проходит сквозь мобов)
    for (const enemy of enemies) {
        const closestX = Math.max(player.x, Math.min(enemy.enemy_x, player.x + player.width));
        const closestY = Math.max(player.y, Math.min(enemy.enemy_y, player.y + player.height));
        const touching = Math.hypot(enemy.enemy_x - closestX, enemy.enemy_y - closestY) < enemy.radius;
        if (touching && damagePlayer(enemy.damage)) return;
    }
}

// Наносит урон игроку с учётом неуязвимости. Возвращает true, если игрок умер.
function damagePlayer(amount) {
    const player = gameState.player;
    if (player.invulnerableTime > 0 || screen !== 'playing') return false;
    player.health = Math.max(0, player.health - amount);
    player.invulnerableTime = 1; // 1 секунда неуязвимости
    if (player.health <= 0) {
        endGame(false);
        return true;
    }
    return false;
}

function drawEnemy(enemy) {
    const image = enemy.color === 'green' ? enemy1img : enemy2img;
    const size = enemy.radius * 2.8;
    if (enemy.ranged) {
        // У стрелка нет своей картинки: перекрашенный спрайт + фиолетовая аура
        canvasContext.fillStyle = 'rgba(160, 60, 255, 0.35)';
        canvasContext.beginPath();
        canvasContext.arc(enemy.enemy_x, enemy.enemy_y, enemy.radius + 8, 0, Math.PI * 2);
        canvasContext.fill();
    }
    if (imgReady(image)) {
        // Сохраняем пропорции картинки
        const ratio = image.naturalHeight / image.naturalWidth;
        const w = size, h = size * ratio;
        if (enemy.ranged) canvasContext.filter = 'hue-rotate(220deg) saturate(1.5)';
        canvasContext.drawImage(image, enemy.enemy_x - w / 2, enemy.enemy_y - h / 2, w, h);
        canvasContext.filter = 'none';
    } else {
        canvasContext.fillStyle = enemy.color;
        canvasContext.beginPath();
        canvasContext.arc(enemy.enemy_x, enemy.enemy_y, enemy.radius, 0, Math.PI * 2);
        canvasContext.fill();
    }
    // Полоска хп врага, если он ранен
    if (enemy.health < enemy.maxHealth) {
        const w = enemy.radius * 2;
        const y = enemy.enemy_y - size / 2 - 10;
        canvasContext.fillStyle = 'rgba(0,0,0,0.6)';
        canvasContext.fillRect(enemy.enemy_x - w / 2, y, w, 6);
        canvasContext.fillStyle = '#e33';
        canvasContext.fillRect(enemy.enemy_x - w / 2, y, w * (enemy.health / enemy.maxHealth), 6);
    }
}

// ===================== Стрельба =====================
function isOnScreen(enemy) {
    return enemy.enemy_x > 0 && enemy.enemy_x < GAME.width && enemy.enemy_y > 0 && enemy.enemy_y < GAME.height;
}

function findClosestEnemy() {
    const player = gameState.player;
    const px = player.x + player.width / 2;
    const py = player.y + player.height / 2;
    let closestEnemy = null;
    let closestDistance = Infinity;
    for (const enemy of gameState.enemies) {
        if (!isOnScreen(enemy)) continue; // не тратим стрелы на врагов за экраном
        const distance = Math.hypot(px - enemy.enemy_x, py - enemy.enemy_y);
        if (distance < closestDistance) {
            closestDistance = distance;
            closestEnemy = enemy;
        }
    }
    return closestEnemy;
}

function shootBullet(target) {
    const player = gameState.player;
    const sx = player.x + player.width / 2;
    const sy = player.y + player.height / 2;
    const dx = target.enemy_x - sx;
    const dy = target.enemy_y - sy;
    const distance = Math.hypot(dx, dy) || 1;
    gameState.bullets.push({
        x: sx,
        y: sy,
        dx: (dx / distance) * player.bulletSpeed,
        dy: (dy / distance) * player.bulletSpeed,
        isEnemy: false
    });
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

function updateBullets(dt) {
    const bullets = gameState.bullets;
    const enemies = gameState.enemies;
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        bullet.x += bullet.dx * dt;
        bullet.y += bullet.dy * dt;

        if (bullet.x < 0 || bullet.x > GAME.width || bullet.y < 0 || bullet.y > GAME.height) {
            bullets.splice(i, 1);
            continue;
        }
        if (bullet.isEnemy) {
            // Вражеский снаряд попадает в игрока (хитбокс чуть уже спрайта)
            const p = gameState.player;
            if (bullet.x > p.x + 20 && bullet.x < p.x + p.width - 20 && bullet.y > p.y + 10 && bullet.y < p.y + p.height - 10) {
                bullets.splice(i, 1);
                if (damagePlayer(bullet.damage)) return;
            }
            continue;
        }

        for (let j = 0; j < enemies.length; j++) {
            const enemy = enemies[j];
            if (Math.hypot(bullet.x - enemy.enemy_x, bullet.y - enemy.enemy_y) < enemy.radius + 5) {
                enemy.health -= gameState.player.damage;
                if (enemy.health <= 0) {
                    enemies.splice(j, 1);
                    gameState.kills++;
                    gameState.xp += enemy.color === 'green' ? 15 : enemy.ranged ? 12 : 10;
                }
                bullets.splice(i, 1);
                break;
            }
        }
    }
}

function drawBullets() {
    for (const bullet of gameState.bullets) {
        // Стрела: линия по направлению полёта
        const len = Math.hypot(bullet.dx, bullet.dy) || 1;
        const nx = bullet.dx / len, ny = bullet.dy / len;
        canvasContext.strokeStyle = bullet.isEnemy ? 'yellow' : '#8b4513';
        canvasContext.lineWidth = 4;
        canvasContext.beginPath();
        canvasContext.moveTo(bullet.x - nx * 24, bullet.y - ny * 24);
        canvasContext.lineTo(bullet.x, bullet.y);
        canvasContext.stroke();
        canvasContext.fillStyle = bullet.isEnemy ? 'yellow' : 'red';
        canvasContext.beginPath();
        canvasContext.arc(bullet.x, bullet.y, 5, 0, Math.PI * 2);
        canvasContext.fill();
    }
}

// ===================== Игрок =====================
function updatePlayer(dt) {
    const player = gameState.player;
    let mx = 0, my = 0;
    if (keys.up) my -= 1;
    if (keys.down) my += 1;
    if (keys.left) mx -= 1;
    if (keys.right) mx += 1;
    const len = Math.hypot(mx, my);
    if (len > 0) {
        // По диагонали не быстрее, чем по прямой
        player.x += (mx / len) * player.speed * dt;
        player.y += (my / len) * player.speed * dt;
    }
    player.x = Math.max(0, Math.min(player.x, GAME.width - player.width));
    player.y = Math.max(0, Math.min(player.y, GAME.height - player.height));

    if (player.invulnerableTime > 0) player.invulnerableTime -= dt;
}

function drawPlayer() {
    const player = gameState.player;
    // Мигание во время неуязвимости
    if (player.invulnerableTime > 0 && Math.floor(player.invulnerableTime * 10) % 2 === 0) return;
    if (imgReady(heroimg)) {
        canvasContext.drawImage(heroimg, player.x, player.y, player.width, player.height);
    } else {
        canvasContext.fillStyle = 'blue';
        canvasContext.fillRect(player.x, player.y, player.width, player.height);
    }
}

function drawHealthBarPlayer() {
    const player = gameState.player;
    const part = Math.max(0, player.health / player.maxHealth);
    canvasContext.fillStyle = 'red';
    canvasContext.fillRect(player.x, player.y - 40, player.width, 25);
    canvasContext.fillStyle = 'green';
    canvasContext.fillRect(player.x, player.y - 40, player.width * part, 25);
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
    const player = gameState.player;
    let x, y, tries = 0;
    // Не прямо под игроком
    do {
        x = 80 + Math.random() * (GAME.width - 160);
        y = 140 + Math.random() * (GAME.height - 220);
        tries++;
    } while (tries < 20 && Math.hypot(x - (player.x + player.width / 2), y - (player.y + player.height / 2)) < 250);
    gameState.pickups.push({ type: types[Math.floor(Math.random() * types.length)], x: x, y: y, life: PICKUP_LIFETIME });
}

function applyPickup(pickup) {
    const player = gameState.player;
    if (pickup.type === 'heal') {
        player.health = Math.min(player.maxHealth, player.health + 30);
    } else if (pickup.type === 'damage') {
        player.damage += 10;
    } else if (pickup.type === 'fireRate') {
        player.fireRate = Math.max(0.12, player.fireRate * 0.9);
    }
    gameState.popups.push({ text: PICKUP_TYPES[pickup.type].label, x: pickup.x, y: pickup.y, life: 1.2, color: PICKUP_TYPES[pickup.type].color });
}

function updatePickups(dt) {
    gameState.pickupTimer -= dt;
    if (gameState.pickupTimer <= 0) {
        if (gameState.pickups.length < MAX_PICKUPS) spawnPickup();
        gameState.pickupTimer = 6 + Math.random() * 4;
    }
    const p = gameState.player;
    for (let i = gameState.pickups.length - 1; i >= 0; i--) {
        const pickup = gameState.pickups[i];
        pickup.life -= dt;
        const closestX = Math.max(p.x, Math.min(pickup.x, p.x + p.width));
        const closestY = Math.max(p.y, Math.min(pickup.y, p.y + p.height));
        if (Math.hypot(pickup.x - closestX, pickup.y - closestY) < PICKUP_RADIUS) {
            applyPickup(pickup);
            gameState.pickups.splice(i, 1);
        } else if (pickup.life <= 0) {
            gameState.pickups.splice(i, 1);
        }
    }
    for (let i = gameState.popups.length - 1; i >= 0; i--) {
        const popup = gameState.popups[i];
        popup.life -= dt;
        popup.y -= 40 * dt;
        if (popup.life <= 0) gameState.popups.splice(i, 1);
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

function drawPopups() {
    for (const popup of gameState.popups) {
        canvasContext.globalAlpha = Math.min(1, popup.life * 2);
        drawText(popup.text, popup.x, popup.y - 30, 30, 'center');
        canvasContext.globalAlpha = 1;
    }
}

// ===================== Интерфейс =====================
function formatTime(sec) {
    sec = Math.floor(sec);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
}

function drawBack() {
    if (GAME.background) {
        canvasContext.drawImage(GAME.background, 0, 0, GAME.width, GAME.height);
    } else {
        canvasContext.fillStyle = '#2d5a27';
        canvasContext.fillRect(0, 0, GAME.width, GAME.height);
    }
}

function drawText(text, x, y, size, align) {
    canvasContext.font = size + 'px Arial';
    canvasContext.textAlign = align || 'left';
    canvasContext.lineWidth = Math.max(3, size / 12);
    canvasContext.strokeStyle = 'black';
    canvasContext.strokeText(text, x, y);
    canvasContext.fillStyle = 'white';
    canvasContext.fillText(text, x, y);
    canvasContext.textAlign = 'left';
}

function drawHUD() {
    const left = Math.max(0, GAME.winTime - gameState.time);
    drawText('Time: ' + formatTime(gameState.time) + '  (до победы ' + formatTime(left) + ')', 20, 50, 40);
    drawText('Kills: ' + gameState.kills + '   XP: ' + gameState.xp, 20, 100, 36);
    const p = gameState.player;
    drawText('Урон: ' + p.damage + '   Выстрелов/сек: ' + (1 / p.fireRate).toFixed(1), 20, 145, 30);
}

function drawMenu(dt) {
    drawBack();
    canvasContext.fillStyle = 'rgba(0,0,0,0.5)';
    canvasContext.fillRect(0, 0, GAME.width, GAME.height);
    drawText('Bow and Elementals', GAME.width / 2, 170, 110, 'center');
    drawText('Продержись ' + formatTime(GAME.winTime) + '. Лучник стреляет сам. Собирай бонусы на карте.', GAME.width / 2, 260, 40, 'center');
    drawText('Движение: стрелки или WASD', GAME.width / 2, 315, 36, 'center');
    drawText('Нажми Enter, чтобы начать', GAME.width / 2, 420, 56, 'center');

    // Магазин улучшений
    drawText('Улучшения — опыт: ' + totalXP, GAME.width / 2, 525, 44, 'center');
    for (let i = 0; i < UPGRADES.length; i++) {
        const u = UPGRADES[i];
        const r = shopCardRect(i);
        const level = upgradeLevels[u.id];
        const maxed = level >= u.maxLevel;
        const affordable = !maxed && totalXP >= upgradeCost(u);
        canvasContext.fillStyle = maxed ? 'rgba(60,60,60,0.85)' : affordable ? 'rgba(30,90,40,0.9)' : 'rgba(40,40,40,0.85)';
        canvasContext.fillRect(r.x, r.y, r.w, r.h);
        canvasContext.strokeStyle = affordable ? '#7fff7f' : '#888';
        canvasContext.lineWidth = 3;
        canvasContext.strokeRect(r.x, r.y, r.w, r.h);
        const cx = r.x + r.w / 2;
        drawText('[' + u.key + '] ' + u.name, cx, r.y + 45, 34, 'center');
        drawText(u.desc, cx, r.y + 85, 26, 'center');
        drawText('Ур. ' + level + ' / ' + u.maxLevel, cx, r.y + 120, 26, 'center');
        drawText(maxed ? 'МАКС' : 'Цена: ' + upgradeCost(u) + ' XP', cx, r.y + 155, 28, 'center');
    }
    drawText('Нажми 1–4 или кликни по карточке, чтобы купить', GAME.width / 2, 790, 30, 'center');

    if (shopMessageTimer > 0) {
        shopMessageTimer -= dt;
        drawText(shopMessage, GAME.width / 2, 860, 40, 'center');
    }
}

function drawEndScreen(isWin) {
    drawBack();
    canvasContext.fillStyle = 'rgba(0,0,0,0.5)';
    canvasContext.fillRect(0, 0, GAME.width, GAME.height);
    drawText(isWin ? 'YOU WIN' : 'YOU LOSE', GAME.width / 2, GAME.height / 2 - 60, isWin ? 200 : 140, 'center');
    drawText('Time: ' + formatTime(gameState.time) + '   Kills: ' + gameState.kills + '   +' + gameState.xp + ' XP',
        GAME.width / 2, GAME.height / 2 + 50, 44, 'center');
    drawText('Всего опыта: ' + totalXP, GAME.width / 2, GAME.height / 2 + 110, 36, 'center');
    drawText('Enter — сыграть ещё', GAME.width / 2, GAME.height / 2 + 200, 50, 'center');
    drawText('M или Esc — в меню (потратить опыт)', GAME.width / 2, GAME.height / 2 + 260, 40, 'center');
}

function endGame(isWin) {
    if (screen !== 'playing') return;
    screen = isWin ? 'win' : 'gameover';
    totalXP += gameState.xp;
    saveXP(totalXP);
}

// ===================== Главный цикл =====================
function update(dt) {
    gameState.time += dt;
    if (gameState.time >= GAME.winTime) {
        gameState.time = GAME.winTime;
        endGame(true);
        return;
    }
    updatePlayer(dt);
    updateSpawning(dt);
    updateEnemies(dt);
    if (screen !== 'playing') return; // игрок умер в этом кадре
    updatePickups(dt);
    updateShooting(dt);
    updateBullets(dt);
}

function draw() {
    drawBack();
    drawPickups();
    for (const enemy of gameState.enemies) drawEnemy(enemy);
    drawBullets();
    drawPlayer();
    drawHealthBarPlayer();
    drawPopups();
    drawHUD();
}

let lastTime = performance.now();
function play(now) {
    // Время кадра в секундах; ограничиваем, чтобы после сворачивания вкладки не было рывка
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    canvasContext.clearRect(0, 0, GAME.width, GAME.height);
    if (screen === 'playing') {
        update(dt);
    }
    if (screen === 'playing') draw();
    else if (screen === 'menu') drawMenu(dt);
    else drawEndScreen(screen === 'win');

    requestAnimationFrame(play);
}

requestAnimationFrame(play);
