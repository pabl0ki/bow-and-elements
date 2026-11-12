// ===================== Картинки =====================
const img = new Image();
img.src = 'img/back2.jpg';
img.onload = () => { GAME.background = img; };

const enemy1img = new Image();
enemy1img.src = 'img/enemy1.png';
const enemy2img = new Image();
enemy2img.src = 'img/enemy2.png';
const heroimg = new Image();
heroimg.src = 'img/лучник.png';

function imgReady(image) {
    if (image instanceof HTMLCanvasElement) return true;
    return image.complete && image.naturalWidth > 0;
}
function imgSize(image) {
    return { w: image.naturalWidth || image.width, h: image.naturalHeight || image.height };
}

// ===================== Спрайты, нарисованные кодом (стрелок и боссы) =====================
// Рисуются один раз при загрузке в стиле остальных врагов — глянцевые стихийные сферы.
// R — радиус сферы; начало координат в её центре.
function makeSprite(size, paint) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.translate(size / 2, size / 2);
    paint(g, size * 0.36);
    return c;
}

function paintOrb(g, R, colors) {
    const glow = g.createRadialGradient(0, 0, R * 0.8, 0, 0, R * 1.3);
    glow.addColorStop(0, colors.glow);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow;
    g.beginPath(); g.arc(0, 0, R * 1.3, 0, Math.PI * 2); g.fill();

    const body = g.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.1, 0, 0, R * 1.05);
    body.addColorStop(0, colors.light);
    body.addColorStop(0.55, colors.mid);
    body.addColorStop(1, colors.dark);
    g.fillStyle = body;
    g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
}

function paintGloss(g, R) {
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath(); g.ellipse(-R * 0.4, -R * 0.55, R * 0.3, R * 0.14, -0.6, 0, Math.PI * 2); g.fill();
}

function paintPolygon(g, R, points) {
    g.beginPath();
    points.forEach((pt, i) => (i ? g.lineTo(pt[0] * R, pt[1] * R) : g.moveTo(pt[0] * R, pt[1] * R)));
    g.closePath();
}

// Глазницы; зрачки рисуются в игре и следят за лучником
function paintEyeSockets(g, R, eyes) {
    for (const eye of eyes) {
        g.fillStyle = 'rgba(0,0,0,0.55)';
        g.beginPath(); g.arc(eye[0] * R, eye[1] * R, eye[2] * R * 1.18, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#fffbe8';
        g.beginPath(); g.arc(eye[0] * R, eye[1] * R, eye[2] * R, 0, Math.PI * 2); g.fill();
    }
}

const RANGED_EYES = [[0, -0.02, 0.34]];
const GUARDIAN_EYES = [[-0.36, -0.16, 0.19], [0.36, -0.16, 0.19]];
const LORD_EYES = [[0, -0.05, 0.33], [-0.58, -0.36, 0.13], [0.58, -0.36, 0.13], [-0.46, 0.5, 0.11], [0.46, 0.5, 0.11]];

const SPRITES = {
    // Стрелок — грозовой дух с одним глазом
    ranged: {
        eyes: RANGED_EYES, iris: '#ffc21a',
        orbit: { count: 4, dist: 1.45, size: 0.2, speed: 2.4, shape: 'shard', color: '#cfeeff', edge: '#3b6cff' },
        image: makeSprite(192, (g, R) => {
            paintOrb(g, R, { glow: 'rgba(110,170,255,0.6)', light: '#e6fbff', mid: '#4a8dff', dark: '#1b1670' });
            g.lineCap = 'round';
            g.strokeStyle = 'rgba(210,244,255,0.6)';
            g.lineWidth = R * 0.09;
            for (let i = 0; i < 3; i++) {
                g.beginPath(); g.arc(0, 0, R * (0.55 + i * 0.16), 0.6 + i * 2.1, 2.1 + i * 2.1); g.stroke();
            }
            // Разряды
            g.strokeStyle = '#fff7a8';
            g.lineWidth = R * 0.055;
            g.lineJoin = 'round';
            for (const bolt of [[[-0.85, 0.2], [-0.6, 0.38], [-0.68, 0.52], [-0.4, 0.75]], [[0.5, -0.78], [0.62, -0.52], [0.5, -0.46], [0.8, -0.2]]]) {
                g.beginPath();
                bolt.forEach((pt, i) => (i ? g.lineTo(pt[0] * R, pt[1] * R) : g.moveTo(pt[0] * R, pt[1] * R)));
                g.stroke();
            }
            paintEyeSockets(g, R, RANGED_EYES);
            paintGloss(g, R);
        })
    },
    // Босс "Страж леса" — моховая сфера в каменной броне, с рогами
    guardian: {
        eyes: GUARDIAN_EYES, iris: '#ffb300',
        orbit: { count: 6, dist: 1.5, size: 0.17, speed: 0.9, shape: 'leaf', color: '#9be84f', edge: '#2f6b1c' },
        image: makeSprite(320, (g, R) => {
            // Рога (за сферой)
            for (const side of [-1, 1]) {
                g.fillStyle = '#7a5530';
                g.strokeStyle = '#2c1d10';
                g.lineWidth = R * 0.05;
                g.beginPath();
                g.moveTo(side * R * 0.35, -R * 0.85);
                g.quadraticCurveTo(side * R * 0.5, -R * 1.25, side * R * 1.0, -R * 1.28);
                g.quadraticCurveTo(side * R * 0.75, -R * 1.0, side * R * 0.75, -R * 0.6);
                g.closePath();
                g.fill(); g.stroke();
            }
            paintOrb(g, R, { glow: 'rgba(150,255,90,0.45)', light: '#dcff8f', mid: '#4da32f', dark: '#123d18' });
            // Каменные пластины и светящиеся трещины между ними
            const plates = [
                [[-1.1, 0.12], [-0.6, 0.0], [-0.36, 0.42], [-0.62, 1.05], [-1.1, 0.95]],
                [[0.32, 0.4], [0.74, 0.02], [1.1, 0.16], [1.1, 1.0], [0.48, 1.0]],
                [[-0.26, 0.62], [0.18, 0.54], [0.34, 1.1], [-0.42, 1.1]],
                [[-0.55, -1.1], [0.5, -1.1], [0.34, -0.72], [-0.06, -0.6], [-0.42, -0.74]]
            ];
            g.save();
            g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.clip();
            for (const plate of plates) {
                paintPolygon(g, R, plate);
                g.fillStyle = '#5d4832';
                g.fill();
                g.strokeStyle = '#eaff7a';
                g.lineWidth = R * 0.045;
                g.stroke();
                g.strokeStyle = 'rgba(0,0,0,0.35)';
                g.lineWidth = R * 0.02;
                g.stroke();
            }
            g.restore();
            // Сердитые брови
            g.strokeStyle = '#2c1d10';
            g.lineWidth = R * 0.1;
            g.lineCap = 'round';
            for (const side of [-1, 1]) {
                g.beginPath(); g.moveTo(side * R * 0.6, -R * 0.48); g.lineTo(side * R * 0.16, -R * 0.3); g.stroke();
            }
            // Пасть
            g.strokeStyle = '#eaff7a';
            g.lineWidth = R * 0.06;
            g.lineJoin = 'round';
            g.beginPath();
            [[-0.32, 0.22], [-0.18, 0.32], [-0.06, 0.2], [0.06, 0.32], [0.18, 0.2], [0.32, 0.3]]
                .forEach((pt, i) => (i ? g.lineTo(pt[0] * R, pt[1] * R) : g.moveTo(pt[0] * R, pt[1] * R)));
            g.stroke();
            paintEyeSockets(g, R, GUARDIAN_EYES);
            paintGloss(g, R);
        })
    },
    // Босс "Повелитель роя" — тёмная многоглазая сфера с короной шипов
    lord: {
        eyes: LORD_EYES, iris: '#22e3ff',
        orbit: { count: 7, dist: 1.55, size: 0.13, speed: 1.6, shape: 'orb', color: '#5af0ff', edge: '#1a0733' },
        image: makeSprite(320, (g, R) => {
            // Корона шипов (за сферой)
            for (let i = 0; i < 7; i++) {
                const a = -Math.PI / 2 + (i - 3) * 0.33;
                const tip = i % 2 ? 1.2 : 1.33;
                g.fillStyle = '#2a0845';
                g.strokeStyle = '#5af0ff';
                g.lineWidth = R * 0.03;
                g.beginPath();
                g.moveTo(Math.cos(a - 0.13) * R * 0.9, Math.sin(a - 0.13) * R * 0.9);
                g.lineTo(Math.cos(a) * R * tip, Math.sin(a) * R * tip);
                g.lineTo(Math.cos(a + 0.13) * R * 0.9, Math.sin(a + 0.13) * R * 0.9);
                g.closePath();
                g.fill(); g.stroke();
            }
            paintOrb(g, R, { glow: 'rgba(80,230,255,0.5)', light: '#bd92ff', mid: '#4a1a8a', dark: '#0d0420' });
            // Закрученные полосы, как у обычных врагов
            g.save();
            g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.clip();
            for (let i = 0; i < 4; i++) {
                const y = R * (-0.75 + i * 0.5);
                g.strokeStyle = '#1a0733';
                g.lineWidth = R * 0.15;
                g.beginPath(); g.ellipse(R * 0.1, y, R * 1.15, R * 0.3, -0.4, 0.15, Math.PI - 0.15); g.stroke();
                g.strokeStyle = 'rgba(90,240,255,0.75)';
                g.lineWidth = R * 0.03;
                g.beginPath(); g.ellipse(R * 0.1, y + R * 0.08, R * 1.15, R * 0.3, -0.4, 0.15, Math.PI - 0.15); g.stroke();
            }
            g.restore();
            paintEyeSockets(g, R, LORD_EYES);
            paintGloss(g, R);
        })
    }
};
