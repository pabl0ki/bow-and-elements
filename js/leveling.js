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
    if (g.endless) g.xpEndless += gem.value;
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
