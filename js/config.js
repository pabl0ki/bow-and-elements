// ===================== Настройки =====================
var GAME = {
    width: 1900,            // размер экрана (то, что видит камера)
    height: 1050,
    worldWidth: 3600,       // размер всей карты
    worldHeight: 3600,
    background: null,
    winTime: 120,           // секунд до победы
    maxEnemies: 15,         // стартовый лимит врагов
    maxEnemiesCap: 55,      // лимит врагов к 2:00 (в бесконечном режиме растёт дальше)
    spawnInterval: 1.1,     // секунд между спавнами в начале
    spawnIntervalMin: 0.25  // интервал спавна к 2:00
};

// Цифры баланса в одном месте, чтобы их было удобно крутить
const BALANCE = {
    hpGrowth: 0.9,              // на сколько вырастает хп врагов к 2:00 (0.9 = +90%)
    rangedChanceStart: 0.2,     // доля стрелков с 0:15
    rangedChanceEnd: 0.3,       // доля стрелков к 2:00
    minFireRate: 0.14,          // быстрее этого лучник не стреляет, сколько бы бонусов ни набрал
    // Бесконечный режим (после 2:00)
    endlessHpMulPerMin: 2.0,    // хп врагов умножается на это каждую минуту
    endlessDamagePerMin: 0.4,   // прибавка к урону врагов за минуту
    endlessSpeedPerMin: 0.12,   // прибавка к скорости врагов за минуту
    endlessSpeedMax: 0.8,
    endlessBossHp: 1.7,         // множитель хп каждого следующего босса
    endlessMaxEnemies: 110,     // потолок числа врагов
    endlessXpShare: 0.1         // какая доля опыта, собранного после 2:00, идёт в общий опыт
};

var canvas = document.getElementById('canvas');
var canvasContext = canvas.getContext('2d');
canvas.width = GAME.width;
canvas.height = GAME.height;
