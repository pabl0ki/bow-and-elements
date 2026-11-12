// ===================== Режим отладки =====================
// Включается клавишей F2 или адресом с ?debug. Нужен, чтобы быстро проверять новые вещи.
// Если в забеге использовались читы, его опыт и рекорды не сохраняются.
var debug = {
    on: /[?&]debug\b/.test(location.search),
    god: false,
    hitboxes: false,
    fps: 0, frames: 0, fpsTimer: 0,
    bossCounter: 0
};

const DEBUG_ACTIONS = [
    { key: '1', name: '+1 уровень', run: g => collectGem({ value: xpForLevel(g.level) - g.levelXp }) },
    { key: '2', name: '+15 секунд', run: g => { g.time += 15; } },
    { key: '3', name: 'призвать босса', run: () => spawnBoss(debug.bossCounter++ % BOSS_TYPES.length) },
    { key: '4', name: 'убить всех врагов', run: g => { for (const e of g.enemies) hitEnemy(e, Math.max(1, e.health)); } },
    { key: '5', name: 'полное лечение', run: g => { g.player.health = g.player.maxHealth; } },
    { key: '6', name: 'бессмертие', run: () => { debug.god = !debug.god; }, state: () => debug.god },
    { key: '7', name: '+10 врагов', run: () => { for (let i = 0; i < 10; i++) spawnEnemy(); } },
    { key: '8', name: 'случайный бонус', run: () => spawnPickup() },
    { key: '9', name: 'сменить стихию', run: g => {
        const i = ELEMENTS.findIndex(el => el.id === g.player.element);
        g.player.element = ELEMENTS[(i + 1) % ELEMENTS.length].id;
    } },
    { key: '0', name: 'показать хитбоксы', run: () => { debug.hitboxes = !debug.hitboxes; }, state: () => debug.hitboxes, cosmetic: true }
];

function debugAction(digit) {
    const action = DEBUG_ACTIONS.find(a => a.key === digit);
    if (!action) return;
    action.run(gameState);
    if (!action.cosmetic) gameState.debugUsed = true;
}

function debugResetProgress() {
    totalXP = 0;
    for (const u of UPGRADES) upgradeLevels[u.id] = 0;
    records = { time: 0, kills: 0, level: 0 };
    saveXP(totalXP);
    saveJSON('bae_upgrades', upgradeLevels);
    saveJSON('bae_records', records);
    shopMessage = 'Отладка: прогресс сброшен';
    shopMessageTimer = 2;
}

function drawDebugPanel() {
    const g = gameState;
    const lines = [
        'ОТЛАДКА (F2 — выключить)',
        'FPS ' + debug.fps + ' · врагов ' + g.enemies.length + ' · снарядов ' + g.bullets.length,
        'частиц ' + g.particles.length + ' · кристаллов ' + g.gems.length + ' · хп врагов x' + difficultyMul().toFixed(2)
    ];
    for (const a of DEBUG_ACTIONS) lines.push('[' + a.key + '] ' + a.name + (a.state ? (a.state() ? ' — ВКЛ' : ' — выкл') : ''));
    const w = 400, lineH = 24, x = GAME.width - w - 20, y = 80;
    drawPanel({ x: x, y: y, w: w, h: lines.length * lineH + 16 }, 'rgba(0,0,0,0.6)', '#ff4dff', 2);
    lines.forEach((line, i) => drawText(line, x + 12, y + 26 + i * lineH, 18, 'left', i === 0 ? '#ff4dff' : '#ffffff'));
}

function drawDebugHitboxes() {
    const g = gameState;
    canvasContext.lineWidth = 2;
    canvasContext.strokeStyle = '#ff4dff';
    for (const e of g.enemies) {
        if (e.dead) continue;
        canvasContext.beginPath(); canvasContext.arc(e.x, e.y, e.radius, 0, Math.PI * 2); canvasContext.stroke();
    }
    for (const b of g.bullets) {
        canvasContext.beginPath(); canvasContext.arc(b.x, b.y, b.isEnemy ? b.radius : 6, 0, Math.PI * 2); canvasContext.stroke();
    }
    const hb = playerHitbox();
    canvasContext.strokeStyle = '#00ffff';
    canvasContext.strokeRect(hb.x, hb.y, hb.w, hb.h);
}
