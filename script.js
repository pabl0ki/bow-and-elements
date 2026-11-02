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

// ===================== Состояние игры =====================
// screen: 'menu' | 'playing' | 'gameover' | 'win'
var screen = 'menu';
var gameState;

function newGame() {
    gameState = {
        player: {
            x: GAME.width / 2 - 60,
            y: GAME.height / 2 - 90,
            width: 120,
            height: 180,
            speed: 300,          // пикселей в секунду
            health: 120,
            maxHealth: 120,
            damage: 50,
            bulletSpeed: 900,    // пикселей в секунду
            fireRate: 0.5,       // секунд между выстрелами
            invulnerableTime: 0  // секунд
        },
        bullets: [],
        enemies: [],
        time: 0,
        spawnTimer: 0,
        shotTimer: 0,
        kills: 0,
        xp: 0
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
    if ((event.code === 'Enter' || event.code === 'Space') && screen !== 'playing') {
        event.preventDefault();
        newGame();
        screen = 'playing';
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

    let enemy;
    if (Math.random() <= 0.45) {
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
        if (distance > 1) {
            enemy.enemy_x += (dx / distance) * enemy.speed * dt;
            enemy.enemy_y += (dy / distance) * enemy.speed * dt;
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
        if (touching && player.invulnerableTime <= 0) {
            player.health = Math.max(0, player.health - enemy.damage);
            player.invulnerableTime = 1; // 1 секунда неуязвимости
            if (player.health <= 0) {
                endGame(false);
                return;
            }
        }
    }
}

function drawEnemy(enemy) {
    const image = enemy.color === 'green' ? enemy1img : enemy2img;
    const size = enemy.radius * 2.8;
    if (imgReady(image)) {
        // Сохраняем пропорции картинки
        const ratio = image.naturalHeight / image.naturalWidth;
        const w = size, h = size * ratio;
        canvasContext.drawImage(image, enemy.enemy_x - w / 2, enemy.enemy_y - h / 2, w, h);
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
        if (bullet.isEnemy) continue;

        for (let j = 0; j < enemies.length; j++) {
            const enemy = enemies[j];
            if (Math.hypot(bullet.x - enemy.enemy_x, bullet.y - enemy.enemy_y) < enemy.radius + 5) {
                enemy.health -= gameState.player.damage;
                if (enemy.health <= 0) {
                    enemies.splice(j, 1);
                    gameState.kills++;
                    gameState.xp += enemy.color === 'green' ? 15 : 10;
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
}

function drawMenu() {
    drawBack();
    canvasContext.fillStyle = 'rgba(0,0,0,0.45)';
    canvasContext.fillRect(0, 0, GAME.width, GAME.height);
    drawText('Bow and Elementals', GAME.width / 2, GAME.height / 2 - 120, 110, 'center');
    drawText('Продержись ' + formatTime(GAME.winTime) + '. Лучник стреляет сам.', GAME.width / 2, GAME.height / 2, 44, 'center');
    drawText('Движение: стрелки или WASD', GAME.width / 2, GAME.height / 2 + 60, 40, 'center');
    drawText('Нажми Enter, чтобы начать', GAME.width / 2, GAME.height / 2 + 160, 56, 'center');
    drawText('Всего опыта: ' + totalXP, GAME.width / 2, GAME.height - 60, 36, 'center');
}

function drawEndScreen(isWin) {
    drawBack();
    canvasContext.fillStyle = 'rgba(0,0,0,0.5)';
    canvasContext.fillRect(0, 0, GAME.width, GAME.height);
    drawText(isWin ? 'YOU WIN' : 'YOU LOSE', GAME.width / 2, GAME.height / 2 - 60, isWin ? 200 : 140, 'center');
    drawText('Time: ' + formatTime(gameState.time) + '   Kills: ' + gameState.kills + '   +' + gameState.xp + ' XP',
        GAME.width / 2, GAME.height / 2 + 50, 44, 'center');
    drawText('Всего опыта: ' + totalXP, GAME.width / 2, GAME.height / 2 + 110, 36, 'center');
    drawText('Нажми Enter, чтобы сыграть ещё', GAME.width / 2, GAME.height / 2 + 200, 50, 'center');
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
    updateShooting(dt);
    updateBullets(dt);
}

function draw() {
    drawBack();
    for (const enemy of gameState.enemies) drawEnemy(enemy);
    drawBullets();
    drawPlayer();
    drawHealthBarPlayer();
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
    else if (screen === 'menu') drawMenu();
    else drawEndScreen(screen === 'win');

    requestAnimationFrame(play);
}

requestAnimationFrame(play);
