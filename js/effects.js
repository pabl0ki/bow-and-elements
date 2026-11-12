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
