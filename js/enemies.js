// ===================== Боссы =====================
const BOSS_TYPES = [
    { name: 'Страж леса', sprite: SPRITES.guardian, radius: 70, health: 2400, speed: 75, damage: 30, attacks: ['ring', 'charge'] },
    { name: 'Повелитель роя', sprite: SPRITES.lord, radius: 64, health: 3600, speed: 95, damage: 30, attacks: ['ring2', 'fan', 'charge'] }
];

// Когда появляется i-й босс: 0:40, 1:20, дальше (в бесконечном режиме) каждые 45 секунд с 2:30
function bossTime(index) {
    return index < 2 ? [40, 80][index] : 150 + (index - 2) * 45;
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
    return (1 + Math.min(t, GAME.winTime) / GAME.winTime * BALANCE.hpGrowth) * Math.pow(BALANCE.endlessHpMulPerMin, endlessMinutes());
}

// Сколько минут прошло в бесконечном режиме (0 до победы)
function endlessMinutes() {
    return Math.max(0, gameState.time - GAME.winTime) / 60;
}
function enemyDamageMul() {
    return 1 + endlessMinutes() * BALANCE.endlessDamagePerMin;
}
function enemySpeedMul() {
    return 1 + Math.min(BALANCE.endlessSpeedMax, endlessMinutes() * BALANCE.endlessSpeedPerMin);
}

function makeEnemy(base, x, y) {
    const enemy = Object.assign({
        x: x, y: y,
        seed: Math.random() * 100, // чтобы враги "дышали" не в такт
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
    // Стрелки появляются не сразу, а через 15 секунд после начала; со временем их доля растёт
    const progress = Math.min(1, gameState.time / GAME.winTime);
    const rangedChance = gameState.time > 15
        ? BALANCE.rangedChanceStart + (BALANCE.rangedChanceEnd - BALANCE.rangedChanceStart) * progress
        : 0;
    const roll = Math.random();
    let base;
    if (roll < rangedChance) {
        // Дальний бой, мало хп: держит дистанцию и стреляет
        base = {
            kind: 'ranged', sprite: SPRITES.ranged, health: 60, radius: 24, damage: 10, speed: 120, xp: 12,
            range: 420, shotDamage: Math.round(12 * enemyDamageMul()), shotSpeed: 420, fireRate: 2, shotTimer: 1 + Math.random()
        };
    } else if (roll < rangedChance + (1 - rangedChance) * 0.45) {
        // Ближний бой, больше хп, медленный
        base = { kind: 'green', health: 150, radius: 32, damage: 20, speed: 80, xp: 15 };
    } else {
        // Ближний бой, мало хп, быстрый
        base = { kind: 'red', health: 100, radius: 28, damage: 15, speed: 165, xp: 10 };
    }
    base.health = Math.round(base.health * hpMul);
    base.damage = Math.round(base.damage * enemyDamageMul());
    base.speed *= enemySpeedMul();
    gameState.enemies.push(makeEnemy(base, pos.x, pos.y));
}

function spawnBoss(index) {
    const type = BOSS_TYPES[index % BOSS_TYPES.length];
    // Первые два босса обычные, каждый следующий (бесконечный режим) заметно крепче
    const tier = Math.max(0, index - 1);
    const pos = randomSpawnPoint(160);
    gameState.enemies.push(makeEnemy({
        kind: 'boss', boss: true, type: type, sprite: type.sprite,
        health: Math.round(type.health * Math.pow(BALANCE.endlessBossHp, tier)),
        radius: type.radius, damage: Math.round(type.damage * enemyDamageMul()), speed: type.speed,
        shotDamage: Math.round(15 * enemyDamageMul()),
        xp: 200 + 100 * tier,
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
    const interval = Math.max(0.1, GAME.spawnInterval - (GAME.spawnInterval - GAME.spawnIntervalMin) * progress);
    const limit = Math.min(BALANCE.endlessMaxEnemies, Math.round(GAME.maxEnemies + (GAME.maxEnemiesCap - GAME.maxEnemies) * progress));

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
        enemyBullet(boss.x, boss.y, offset + i * Math.PI * 2 / count, speed, boss.shotDamage, 11, '255, 157, 60');
    }
}

function fireFan(boss, nx, ny, count, spread, speed) {
    const base = Math.atan2(ny, nx);
    for (let i = 0; i < count; i++) {
        enemyBullet(boss.x, boss.y, base + (i - (count - 1) / 2) * spread, speed, boss.shotDamage, 11, '255, 157, 60');
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
    if (enemy.sprite) return enemy.sprite.image;
    return enemy.kind === 'green' ? enemy1img : enemy2img;
}

// Размер картинки врага на экране (у нарисованных кодом спрайтов поля шире — под рога и шипы)
function enemyDrawSize(enemy) {
    return enemy.sprite ? enemy.radius * 3.05 : enemy.radius * 2.8;
}

function enemyFilter(enemy) {
    const parts = [];
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
        image: enemyImage(enemy), filter: 'none',
        x: enemy.x, y: enemy.y, size: enemyDrawSize(enemy), life: 0.35, maxLife: 0.35,
        spin: (Math.random() < 0.5 ? -1 : 1) * 2.5
    });
    if (enemy.boss) {
        addShake(18);
        showBanner('Босс повержен!', '+' + enemy.xp + ' опыта', '#7CFC00');
        g.pickups.push({ type: 'heal', x: enemy.x, y: enemy.y, life: PICKUP_LIFETIME });
    }
}

// Спутники вокруг нарисованных кодом врагов: осколки, листья, шарики.
// front = false рисует дальнюю половину орбиты (за врагом), true — ближнюю.
function drawOrbiters(enemy, front) {
    const orbit = enemy.sprite.orbit;
    const R = enemy.radius * 1.1;
    const t = gameState.time * orbit.speed + enemy.seed;
    for (let i = 0; i < orbit.count; i++) {
        const a = t + i * Math.PI * 2 / orbit.count;
        if ((Math.sin(a) > 0) !== front) continue;
        const x = enemy.x + Math.cos(a) * R * orbit.dist;
        const y = enemy.y + Math.sin(a) * R * orbit.dist * 0.42;
        const s = R * orbit.size * (0.85 + 0.25 * Math.sin(a)); // ближние чуть крупнее
        canvasContext.save();
        canvasContext.translate(x, y);
        canvasContext.fillStyle = orbit.color;
        canvasContext.strokeStyle = orbit.edge;
        canvasContext.lineWidth = 2;
        canvasContext.beginPath();
        if (orbit.shape === 'shard') {
            canvasContext.rotate(a * 2);
            canvasContext.moveTo(0, -s * 1.5);
            canvasContext.lineTo(s * 0.6, 0);
            canvasContext.lineTo(0, s * 1.5);
            canvasContext.lineTo(-s * 0.6, 0);
            canvasContext.closePath();
        } else if (orbit.shape === 'leaf') {
            canvasContext.rotate(a + 0.8);
            canvasContext.moveTo(-s * 1.4, 0);
            canvasContext.quadraticCurveTo(0, -s * 1.1, s * 1.4, 0);
            canvasContext.quadraticCurveTo(0, s * 1.1, -s * 1.4, 0);
        } else {
            canvasContext.arc(0, 0, s, 0, Math.PI * 2);
        }
        canvasContext.fill();
        canvasContext.stroke();
        canvasContext.restore();
    }
}

// Зрачки, которые следят за лучником
function drawPupils(enemy, scale) {
    const p = gameState.player;
    const R = enemy.radius * 1.1 * scale;
    const dx = p.x + p.width / 2 - enemy.x, dy = p.y + p.height / 2 - enemy.y;
    const d = Math.hypot(dx, dy) || 1;
    for (const eye of enemy.sprite.eyes) {
        const r = eye[2] * R;
        const ex = enemy.x + eye[0] * R + dx / d * r * 0.34;
        const ey = enemy.y + eye[1] * R + dy / d * r * 0.34;
        canvasContext.fillStyle = enemy.sprite.iris;
        canvasContext.beginPath(); canvasContext.arc(ex, ey, r * 0.62, 0, Math.PI * 2); canvasContext.fill();
        canvasContext.fillStyle = '#12061c';
        canvasContext.beginPath(); canvasContext.arc(ex, ey, r * 0.32, 0, Math.PI * 2); canvasContext.fill();
        canvasContext.fillStyle = 'rgba(255,255,255,0.9)';
        canvasContext.beginPath(); canvasContext.arc(ex - r * 0.18, ey - r * 0.2, r * 0.12, 0, Math.PI * 2); canvasContext.fill();
    }
}

function drawEnemy(enemy) {
    const image = enemyImage(enemy);
    // Враги слегка "дышат": размер плавно пульсирует
    const pulse = 1 + 0.035 * Math.sin(gameState.time * 5 + enemy.seed);
    const size = enemyDrawSize(enemy) * pulse;

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

    // Ауры: горение, лёд
    const auras = [];
    if (enemy.burn) auras.push('rgba(255, 120, 30, 0.35)');
    if (enemy.slow) auras.push('rgba(127, 216, 255, 0.4)');
    for (const aura of auras) {
        canvasContext.fillStyle = aura;
        canvasContext.beginPath();
        canvasContext.arc(enemy.x, enemy.y, enemy.radius + 8, 0, Math.PI * 2);
        canvasContext.fill();
    }

    if (enemy.sprite) drawOrbiters(enemy, false);
    if (imgReady(image)) {
        // Сохраняем пропорции картинки
        const dim = imgSize(image);
        const w = size, h = size * dim.h / dim.w;
        canvasContext.filter = enemyFilter(enemy);
        canvasContext.drawImage(image, enemy.x - w / 2, enemy.y - h / 2, w, h);
        canvasContext.filter = 'none';
        if (enemy.sprite) {
            drawPupils(enemy, pulse);
            drawOrbiters(enemy, true);
        }
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
        const dim = imgSize(c.image);
        const w = c.size * (0.4 + 0.6 * k), h = w * dim.h / dim.w;
        canvasContext.save();
        canvasContext.globalAlpha = k;
        canvasContext.filter = 'brightness(' + (1 + (1 - k) * 2) + ')';
        canvasContext.translate(c.x, c.y);
        canvasContext.rotate((1 - k) * c.spin);
        canvasContext.drawImage(c.image, -w / 2, -h / 2, w, h);
        canvasContext.restore();
    }
}
