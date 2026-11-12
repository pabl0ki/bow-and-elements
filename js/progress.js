// ===================== Сохранения =====================
function loadJSON(key, fallback) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
    } catch (e) { return fallback; }
}
function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { }
}

// Опыт копится между играми и тратится в меню
var totalXP = Number(loadJSON('bae_xp', 0)) || 0;
function saveXP(value) { saveJSON('bae_xp', value); }

// Рекорды
var records = (function () {
    const r = loadJSON('bae_records', {}) || {};
    return { time: Number(r.time) || 0, kills: Number(r.kills) || 0, level: Number(r.level) || 0 };
})();

function updateRecords() {
    const g = gameState;
    const broken = [];
    if (g.time > records.time) { records.time = g.time; broken.push('время'); }
    if (g.kills > records.kills) { records.kills = g.kills; broken.push('убийства'); }
    if (g.level > records.level) { records.level = g.level; broken.push('уровень'); }
    if (broken.length) saveJSON('bae_records', records);
    return broken;
}

// ===================== Улучшения (покупаются за опыт в меню) =====================
const UPGRADES = [
    { id: 'health',   key: '1', name: 'Здоровье',         desc: '+20 к макс. хп',      maxLevel: 5, baseCost: 100 },
    { id: 'damage',   key: '2', name: 'Урон',             desc: '+10 к урону стрел',   maxLevel: 5, baseCost: 150 },
    { id: 'fireRate', key: '3', name: 'Скорострельность', desc: '-8% к перезарядке',   maxLevel: 5, baseCost: 150 },
    { id: 'speed',    key: '4', name: 'Скорость',         desc: '+8% к скорости бега', maxLevel: 5, baseCost: 80 }
];
// Во сколько раз дороже базовой цены каждый следующий уровень.
// Весь магазин стоит 12 000 опыта — это примерно 10 победных раундов.
const UPGRADE_COST_MUL = [1, 2, 4, 7, 11];

function loadUpgrades() {
    const levels = { health: 0, damage: 0, fireRate: 0, speed: 0 };
    const saved = loadJSON('bae_upgrades', {}) || {};
    for (const u of UPGRADES) levels[u.id] = Math.min(u.maxLevel, Math.max(0, Number(saved[u.id]) || 0));
    return levels;
}
var upgradeLevels = loadUpgrades();
var shopMessage = '';
var shopMessageTimer = 0;

function upgradeCost(u) {
    return u.baseCost * UPGRADE_COST_MUL[Math.min(upgradeLevels[u.id], UPGRADE_COST_MUL.length - 1)];
}

function buyUpgrade(index) {
    const u = UPGRADES[index];
    if (!u) return;
    if (upgradeLevels[u.id] >= u.maxLevel) {
        shopMessage = u.name + ': уже максимум';
    } else if (totalXP < upgradeCost(u)) {
        shopMessage = 'Не хватает опыта на «' + u.name + '»';
    } else {
        totalXP -= upgradeCost(u);
        upgradeLevels[u.id]++;
        saveXP(totalXP);
        saveJSON('bae_upgrades', upgradeLevels);
        shopMessage = '«' + u.name + '» — теперь ур. ' + upgradeLevels[u.id];
    }
    shopMessageTimer = 2;
}

// ===================== Стихии стрел =====================
const ELEMENTS = [
    { id: 'fire',      name: 'Огонь',  color: '#ff7a1a', rgb: '255, 122, 26',  desc: 'Поджигает: урон со временем', levelDesc: 'Горение сильнее' },
    { id: 'ice',       name: 'Лёд',    color: '#7fd8ff', rgb: '127, 216, 255', desc: 'Замедляет врагов',            levelDesc: 'Замедление сильнее' },
    { id: 'lightning', name: 'Молния', color: '#ffe95c', rgb: '255, 233, 92',  desc: 'Бьёт по соседним врагам',     levelDesc: 'Молния бьёт больше целей' }
];
const ELEMENT_BY_ID = {};
for (const el of ELEMENTS) ELEMENT_BY_ID[el.id] = el;

var selectedElement = Math.min(ELEMENTS.length - 1, Math.max(0, Number(loadJSON('bae_element', 0)) || 0));
function selectElement(index) {
    selectedElement = (index + ELEMENTS.length) % ELEMENTS.length;
    saveJSON('bae_element', selectedElement);
}

// ===================== Улучшения внутри забега (выбор при новом уровне) =====================
const LEVEL_OPTIONS = [
    { id: 'damage', max: 8, name: () => 'Острые наконечники',
      desc: p => 'Урон стрел +20% (' + p.damage + ' → ' + Math.round(p.damage * 1.2) + ')',
      apply: p => { p.damage = Math.round(p.damage * 1.2); } },
    { id: 'fireRate', max: 6, name: () => 'Быстрая тетива',
      desc: p => 'Выстрелов в секунду: ' + (1 / p.fireRate).toFixed(1) + ' → ' + (1 / (p.fireRate * 0.88)).toFixed(1),
      apply: p => { p.fireRate = Math.max(BALANCE.minFireRate, p.fireRate * 0.88); } },
    { id: 'multishot', max: 4, name: () => 'Ещё одна стрела',
      desc: p => 'Стрел за выстрел: ' + p.multishot + ' → ' + (p.multishot + 1),
      apply: p => { p.multishot++; } },
    { id: 'pierce', max: 3, name: () => 'Пробивание',
      desc: p => 'Стрела пробивает врагов насквозь: ' + p.pierce + ' → ' + (p.pierce + 1),
      apply: p => { p.pierce++; } },
    { id: 'health', max: 5, name: () => 'Крепкое здоровье',
      desc: () => 'Макс. хп +25 и полное лечение',
      apply: p => { p.maxHealth += 25; p.health = p.maxHealth; } },
    { id: 'speed', max: 4, name: () => 'Лёгкие сапоги',
      desc: () => 'Скорость бега +10%',
      apply: p => { p.speed *= 1.1; } },
    { id: 'magnet', max: 3, name: () => 'Магнит',
      desc: () => 'Кристаллы опыта притягиваются на 50% дальше',
      apply: p => { p.magnet *= 1.5; } },
    { id: 'element', max: 4, name: p => 'Сила стихии: ' + ELEMENT_BY_ID[p.element].name,
      desc: p => ELEMENT_BY_ID[p.element].levelDesc + ' (ур. ' + p.elementLevel + ' → ' + (p.elementLevel + 1) + ')',
      apply: p => { p.elementLevel++; } },
    { id: 'dash', max: 3, name: () => 'Ловкость',
      desc: p => 'Перезарядка рывка: ' + p.dashCooldownMax.toFixed(1) + 'с → ' + (p.dashCooldownMax * 0.75).toFixed(1) + 'с',
      apply: p => { p.dashCooldownMax *= 0.75; } },
    { id: 'arrowSpeed', max: 3, name: () => 'Тугой лук',
      desc: () => 'Стрелы летят быстрее и дальше (+20%)',
      apply: p => { p.bulletSpeed *= 1.2; } },
    { id: 'regen', max: 4, name: () => 'Регенерация',
      desc: p => 'Восстановление хп в секунду: ' + p.regen + ' → ' + (p.regen + 1),
      apply: p => { p.regen += 1; } }
];

function xpForLevel(level) {
    return 25 + (level - 1) * 20;
}
