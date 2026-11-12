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
    if (debug.on) {
        drawText('ОТЛАДКА: X — +1000 опыта · R — сбросить прогресс · в игре цифры 0–9 · F2 — выключить',
            GAME.width / 2, 955, 26, 'center', '#ff4dff');
    }
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
    drawText('Время: ' + formatTime(g.time) + '   Убийств: ' + g.kills + '   Уровень: ' + g.level + '   +' + (g.debugUsed ? 0 : metaXP(g)) + ' опыта',
        GAME.width / 2, 420, 40, 'center');
    drawText('Всего опыта: ' + totalXP, GAME.width / 2, 475, 34, 'center');
    if (g.debugUsed) drawText('Режим отладки: опыт и рекорды этого забега не сохранены', GAME.width / 2, 540, 34, 'center', '#ff4dff');
    else if (g.newRecords.length) drawText('Новый рекорд: ' + g.newRecords.join(', ') + '!', GAME.width / 2, 540, 40, 'center', '#ffd54a');
    if (isWin) drawText('C — продолжить в бесконечном режиме', GAME.width / 2, 650, 46, 'center', '#ffd54a');
    drawText('Enter — новая игра', GAME.width / 2, 720, 44, 'center');
    drawText('M или Esc — в меню (потратить опыт)', GAME.width / 2, 775, 36, 'center');
    drawText(recordsText(), GAME.width / 2, 1010, 30, 'center');
}
