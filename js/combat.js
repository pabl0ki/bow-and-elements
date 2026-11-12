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
