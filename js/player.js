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
    if (debug.on && debug.god) return false;
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

// Спрайт лучника разрезан на корпус и две ноги, чтобы ноги при беге двигались отдельно.
// Все числа — в пикселях исходной картинки (703x1024).
const HERO_CUT = {
    belt: 540,                        // высота пояса
    splitTop: 300, splitBottom: 217,  // линия между левой ногой и плащом: от (300, пояс) до (217, низ)
    hipLeft: { x: 285, y: 545 },      // вокруг этих точек качаются ноги
    hipRight: { x: 400, y: 545 },
    waist: { x: 330, y: 540 }         // вокруг этой точки покачивается корпус
};

function cutHeroPart(source, polygon) {
    const c = document.createElement('canvas');
    c.width = source.width || source.naturalWidth;
    c.height = source.height || source.naturalHeight;
    const g = c.getContext('2d');
    g.beginPath();
    polygon.forEach((pt, i) => (i ? g.lineTo(pt[0], pt[1]) : g.moveTo(pt[0], pt[1])));
    g.closePath();
    g.clip();
    g.drawImage(source, 0, 0);
    return c;
}

function cutHero(source) {
    const w = source.width || source.naturalWidth, h = source.height || source.naturalHeight;
    const cut = HERO_CUT, overlap = 14; // части немного заходят друг на друга, чтобы не было щелей
    return {
        upper: cutHeroPart(source, [[0, 0], [w, 0], [w, cut.belt + overlap], [0, cut.belt + overlap]]),
        legLeft: cutHeroPart(source, [[0, cut.belt - overlap], [cut.splitTop, cut.belt - overlap], [cut.splitBottom, h], [0, h]]),
        legRight: cutHeroPart(source, [[cut.splitTop, cut.belt - overlap], [w, cut.belt - overlap], [w, h], [cut.splitBottom, h]])
    };
}

let heroParts = null; // { normal: {...}, hit: {...} }
function getHeroParts() {
    if (heroParts || !imgReady(heroimg)) return heroParts;
    heroParts = { normal: cutHero(heroimg), hit: cutHero(getHeroHitImg()) };
    return heroParts;
}

// Рисует лучника по частям. Начало координат — у ног, по центру; картинка занимает (-w/2, -h)...(w/2, 0).
function drawHeroParts(parts, w, h, legAngle, torsoAngle) {
    const kx = w / 703, ky = h / 1024;
    const drawPart = (image, pivot, angle) => {
        const px = -w / 2 + pivot.x * kx, py = -h + pivot.y * ky;
        canvasContext.save();
        canvasContext.translate(px, py);
        canvasContext.rotate(angle);
        canvasContext.translate(-px, -py);
        canvasContext.drawImage(image, -w / 2, -h, w, h);
        canvasContext.restore();
    };
    // Ноги качаются в противоход, корпус слегка покачивается навстречу
    drawPart(parts.legRight, HERO_CUT.hipRight, -legAngle * 0.7);
    drawPart(parts.legLeft, HERO_CUT.hipLeft, legAngle);
    drawPart(parts.upper, HERO_CUT.waist, torsoAngle);
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
    let legAngle = 0, torsoAngle = 0;

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
            // Шаг: ноги качаются, корпус подпрыгивает и слегка сжимается на приземлении
            const swing = Math.sin(a.walkPhase);
            const step = Math.abs(swing);
            legAngle = swing * 0.24;
            torsoAngle = -swing * 0.035;
            offsetY = -(1 - step) * 7;
            scaleY = 1 - step * 0.03;
            scaleX = 1 + step * 0.02;
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
    const parts = getHeroParts();
    if (parts) {
        drawHeroParts(parts.normal, player.width, player.height, legAngle, torsoAngle);
        if (a.hitFlash > 0 || dying) {
            canvasContext.globalAlpha = alpha * (dying ? Math.max(0, 0.7 - a.deathTime) : Math.min(1, a.hitFlash / 0.12) * 0.85);
            drawHeroParts(parts.hit, player.width, player.height, legAngle, torsoAngle);
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
