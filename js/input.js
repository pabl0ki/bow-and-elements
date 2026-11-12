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

function digitKey(code, max) {
    const m = /^(Digit|Numpad)([1-9])$/.exec(code);
    if (!m) return -1;
    const n = Number(m[2]);
    return n <= max ? n - 1 : -1;
}

window.addEventListener('keydown', (event) => {
    const code = event.code;
    if (setKey(event, true) || code === 'Space') event.preventDefault(); // стрелки и пробел не прокручивают страницу
    if (event.repeat) return;

    if (code === 'F2') {
        event.preventDefault();
        debug.on = !debug.on;
        if (!debug.on) { debug.god = false; debug.hitboxes = false; }
        return;
    }

    switch (screen) {
        case 'playing':
            if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'Space') tryDash();
            else if (code === 'Escape' || code === 'KeyP') screen = 'paused';
            else if (debug.on && digitKey(code, 9) >= 0) debugAction(String(digitKey(code, 9) + 1));
            else if (debug.on && (code === 'Digit0' || code === 'Numpad0')) debugAction('0');
            break;
        case 'paused':
            if (code === 'Escape' || code === 'KeyP' || code === 'Enter') screen = 'playing';
            else if (code === 'KeyM') { finishRun(); screen = 'menu'; }
            break;
        case 'levelup': {
            const i = digitKey(code, 3);
            if (i >= 0) chooseLevelOption(i);
            break;
        }
        case 'menu': {
            const i = digitKey(code, 4);
            if (code === 'Enter' || code === 'Space') startGame();
            else if (i >= 0) buyUpgrade(i);
            else if (code === 'KeyQ' || code === 'ArrowLeft') selectElement(selectedElement - 1);
            else if (code === 'KeyE' || code === 'ArrowRight') selectElement(selectedElement + 1);
            else if (debug.on && code === 'KeyX') {
                totalXP += 1000;
                saveXP(totalXP);
                shopMessage = 'Отладка: +1000 опыта';
                shopMessageTimer = 2;
            } else if (debug.on && code === 'KeyR') debugResetProgress();
            break;
        }
        case 'win':
            if (code === 'KeyC') {
                gameState.endless = true;
                screen = 'playing';
                showBanner('Бесконечный режим', 'Сколько ещё продержишься?', '#ffd54a');
            } else if (code === 'Enter' || code === 'Space') startGame();
            else if (code === 'Escape' || code === 'KeyM') screen = 'menu';
            break;
        case 'gameover':
            if (code === 'Enter' || code === 'Space') startGame();
            else if (code === 'Escape' || code === 'KeyM') screen = 'menu';
            break;
    }
});
window.addEventListener('keyup', (event) => { setKey(event, false); });

// Окно потеряло фокус: клавиши не "залипают", игра встаёт на паузу
window.addEventListener('blur', () => {
    keys.up = keys.down = keys.left = keys.right = false;
    if (screen === 'playing') screen = 'paused';
});

// Клики мышью по карточкам
function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (event.clientX - rect.left) * (GAME.width / rect.width),
        y: (event.clientY - rect.top) * (GAME.height / rect.height)
    };
}
function inRect(pt, r) {
    return pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h;
}
function shopCardRect(index) {
    const w = 380, h = 170, gap = 30;
    const total = UPGRADES.length * w + (UPGRADES.length - 1) * gap;
    return { x: (GAME.width - total) / 2 + index * (w + gap), y: 625, w: w, h: h };
}
function elementCardRect(index) {
    const w = 340, h = 110, gap = 30;
    const total = ELEMENTS.length * w + (ELEMENTS.length - 1) * gap;
    return { x: (GAME.width - total) / 2 + index * (w + gap), y: 330, w: w, h: h };
}
function levelCardRect(index) {
    const w = 460, h = 300, gap = 40;
    const total = 3 * w + 2 * gap;
    return { x: (GAME.width - total) / 2 + index * (w + gap), y: 380, w: w, h: h };
}

canvas.addEventListener('click', (event) => {
    const pt = canvasPoint(event);
    if (screen === 'menu') {
        for (let i = 0; i < UPGRADES.length; i++) if (inRect(pt, shopCardRect(i))) buyUpgrade(i);
        for (let i = 0; i < ELEMENTS.length; i++) if (inRect(pt, elementCardRect(i))) selectElement(i);
    } else if (screen === 'levelup') {
        for (let i = 0; i < gameState.levelChoices.length; i++) if (inRect(pt, levelCardRect(i))) chooseLevelOption(i);
    }
});
