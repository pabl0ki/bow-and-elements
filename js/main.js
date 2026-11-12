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
    if (debug.on && debug.hitboxes) drawDebugHitboxes();
    canvasContext.restore();

    drawHUD();
    if (debug.on) drawDebugPanel();
}

let lastTime = performance.now();
function play(now) {
    // Время кадра в секундах; ограничиваем, чтобы после сворачивания вкладки не было рывка
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    debug.frames++;
    debug.fpsTimer += (now - lastTime) / 1000;
    if (debug.fpsTimer >= 0.5) {
        debug.fps = Math.round(debug.frames / debug.fpsTimer);
        debug.frames = 0;
        debug.fpsTimer = 0;
    }
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
