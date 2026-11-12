// ===================== Бонусы на карте =====================
const PICKUP_TYPES = {
    heal:     { color: '#2ecc40', icon: '+', label: '+30 HP' },
    damage:   { color: '#ff4136', icon: '⚔', label: '+10 урон' },
    fireRate: { color: '#ffdc00', icon: '»', label: 'скорострельность +10%' }
};
const PICKUP_RADIUS = 22;
const PICKUP_LIFETIME = 12; // секунд лежит на карте
const MAX_PICKUPS = 3;

function spawnPickup() {
    const types = Object.keys(PICKUP_TYPES);
    const p = gameState.player;
    // Где-то рядом с игроком, но не прямо под ним
    const angle = Math.random() * Math.PI * 2;
    const dist = 300 + Math.random() * 450;
    const x = Math.max(80, Math.min(GAME.worldWidth - 80, p.x + p.width / 2 + Math.cos(angle) * dist));
    const y = Math.max(80, Math.min(GAME.worldHeight - 80, p.y + p.height / 2 + Math.sin(angle) * dist));
    gameState.pickups.push({ type: types[Math.floor(Math.random() * types.length)], x: x, y: y, life: PICKUP_LIFETIME });
}

function applyPickup(pickup) {
    const player = gameState.player;
    if (pickup.type === 'heal') {
        player.health = Math.min(player.maxHealth, player.health + 30);
    } else if (pickup.type === 'damage') {
        player.damage += 10;
    } else if (pickup.type === 'fireRate') {
        player.fireRate = Math.max(BALANCE.minFireRate, player.fireRate * 0.9);
    }
    const t = PICKUP_TYPES[pickup.type];
    player.anim.auraTimer = 0.5;
    player.anim.auraColor = t.color;
    addPopup(t.label, pickup.x, pickup.y - 30, t.color, 30, 1.2);
}

function updatePickups(dt) {
    const g = gameState;
    g.pickupTimer -= dt;
    if (g.pickupTimer <= 0) {
        if (g.pickups.length < MAX_PICKUPS) spawnPickup();
        g.pickupTimer = 6 + Math.random() * 4;
    }
    const p = g.player;
    for (let i = g.pickups.length - 1; i >= 0; i--) {
        const pickup = g.pickups[i];
        pickup.life -= dt;
        const closestX = Math.max(p.x, Math.min(pickup.x, p.x + p.width));
        const closestY = Math.max(p.y, Math.min(pickup.y, p.y + p.height));
        if (Math.hypot(pickup.x - closestX, pickup.y - closestY) < PICKUP_RADIUS) {
            applyPickup(pickup);
            g.pickups.splice(i, 1);
        } else if (pickup.life <= 0) {
            g.pickups.splice(i, 1);
        }
    }
}

function drawPickups() {
    for (const pickup of gameState.pickups) {
        // Мигает последние 3 секунды перед исчезновением
        if (pickup.life < 3 && Math.floor(pickup.life * 6) % 2 === 0) continue;
        const t = PICKUP_TYPES[pickup.type];
        const bob = Math.sin(pickup.life * 4) * 4;
        canvasContext.fillStyle = 'rgba(0,0,0,0.35)';
        canvasContext.beginPath();
        canvasContext.ellipse(pickup.x, pickup.y + PICKUP_RADIUS + 6, PICKUP_RADIUS * 0.8, 6, 0, 0, Math.PI * 2);
        canvasContext.fill();
        canvasContext.fillStyle = t.color;
        canvasContext.strokeStyle = 'white';
        canvasContext.lineWidth = 3;
        canvasContext.beginPath();
        canvasContext.arc(pickup.x, pickup.y + bob, PICKUP_RADIUS, 0, Math.PI * 2);
        canvasContext.fill();
        canvasContext.stroke();
        canvasContext.fillStyle = 'black';
        canvasContext.font = 'bold 26px Arial';
        canvasContext.textAlign = 'center';
        canvasContext.textBaseline = 'middle';
        canvasContext.fillText(t.icon, pickup.x, pickup.y + bob + 1);
        canvasContext.textAlign = 'left';
        canvasContext.textBaseline = 'alphabetic';
    }
}
