
const img = new Image();
img.src = "./back2.jpg";

img.onload = () => {
    GAME.background = img
}

var menus = {

}



var GAME = {
    width: 1900,
    height: 1050,
    background: ''
}
var arrChars = [];
var canvas = document.getElementById('canvas');
var canvasContext = canvas.getContext('2d');

const enemy1img = new Image();
enemy1img.src = 'enemy1.png'
const enemy2img = new Image();
enemy2img.src = 'enemy2.png'

canvas.width = GAME.width;
canvas.height = GAME.height

gameState = {
    player: {
        x: canvas.width / 2,
        y: canvas.height / 2,
        width: 120,
        height: 180,
        speed: 5,
        health: 120,
        bulletSpeed: 1,
        invulnerableTime: 0,

    },
    bullets: [],
    enemies: [],
    enemySpawnCount: 0,
    startTime: Date.now(),
    lastShotTime: 0,
};

const fireRate = 500;

var Spawners = {
    spawn0_x: -50,
    spawn0_y: 0,

    spawn1_x: 850,
    spawn1_y: -100,

    spawn2_x: 2000,
    spawn2_y: 500,

    spawn3_x: 850,
    spawn3_y: 2000,
}
function drawenemy(color, x, y, radius) {
    canvasContext.fillStyle = 'rgba(0,0,0,0.0)';
    canvasContext.lineWidth = 10;
    canvasContext.beginPath();
    canvasContext.arc(x, y, radius, 0, 2 * Math.PI);
    canvasContext.closePath();
    canvasContext.fill();
    if (color == 'green') {
        canvasContext.fillStyle = 'rgba(0,0,0,0.0)'
        canvasContext.drawImage(enemy1img, x - 45, y - 35, radius * 2 + 37, radius * 2 + 37)
    }
    if (color == 'red') {
        canvasContext.fillStyle = 'rgba(0,0,0,0.0)'
        canvasContext.drawImage(enemy2img, x - 35, y - 30, radius * 2 + 40, radius * 2 + 40)
    }
}
function spawnEnemy() {
    side = Math.floor(Math.random() * 4);

    let x, y;
    switch (side) {
        case 0:
            x = Spawners.spawn0_x;
            y = Spawners.spawn0_y;
            break;
        case 1:
            x = Spawners.spawn1_x;
            y = Spawners.spawn1_y;
            break;
        case 2:
            x = Spawners.spawn2_x;
            y = Spawners.spawn2_y;
            break;
        case 3:
            x = Spawners.spawn3_x;
            y = Spawners.spawn3_y;
            break;
    }
    var enemytype = Math.random();
    let enemy;
    if (enemytype <= 0.45) {
        enemy = {
            health: 150,
            Attack_range: 'Melee',
            radius: 25,
            damage: 20,
            color: 'green',
            enemy_x: x,
            enemy_y: y,
            speed: 1.3
        };
    }
    else {
        enemy = {
            health: 100,
            Attack_range: 'Melee',
            radius: 20,
            damage: 15,
            color: 'red',
            enemy_x: x,
            enemy_y: y,
            speed: 2.8
        };
    }

    if ((gameState.enemies).length < 15) {

        gameState.enemies.push(enemy)

    }

    /* drawenemy(enemy.color, enemy.enemy_x, enemy.enemy_y, enemy.radius) */



}
function updateEnemies() {
    const player = gameState.player;
    spawnEnemy()
    for (let i = 0; i < gameState.enemies.length; i++) {
        const enemy = gameState.enemies[i];
        const dx = gameState.player.x + (gameState.player.width / 2) - enemy.enemy_x;
        const dy = gameState.player.y + (gameState.player.height / 2) - enemy.enemy_y;
        const distance = Math.sqrt(dx * dx + dy * dy);


        let newX = enemy.enemy_x + (dx / distance) * enemy.speed;
        let newY = enemy.enemy_y + (dy / distance) * enemy.speed;



        drawenemy(enemy.color, newX, newY, enemy.radius)
        enemy.enemy_x = newX;
        enemy.enemy_y = newY;
        if (enemy.color == 'green') {

        }
        var playerTopLineCollision = enemy.enemy_y + enemy.radius > gameState.player.y;
        var playerleftLineCollision = enemy.enemy_x + enemy.radius > gameState.player.x;
        var playerRTLineCollision = enemy.enemy_x - enemy.radius < gameState.player.x + gameState.player.width;
        var playerBottomLineCollision = enemy.enemy_y - enemy.radius < gameState.player.y + gameState.player.height;

        if (playerTopLineCollision && playerleftLineCollision && playerRTLineCollision && playerBottomLineCollision && gameState.player.invulnerableTime <= 0) {
            gameState.player.health -= enemy.damage;
            console.log(gameState.player.health)
            player.invulnerableTime = 60;
            if (player.health <= 0) {
                GameOver()




            }
        }
        for (let j = gameState.bullets.length - 1; j >= 0; j--) {
            const bullet = gameState.bullets[j];
            if (!bullet.isEnemy) {
                const bulletDistance = Math.sqrt((bullet.x - enemy.enemy_x) ** 2 + (bullet.y - enemy.enemy_y) ** 2);

                if (bulletDistance < enemy.radius + 5) {
                    if (enemy.health) {
                        enemy.health -= gameState.player.damage;

                        if (enemy.health <= 0) {
                            gameState.enemies.splice(i, 1);
                            i--;
                        }
                    } else {
                        gameState.enemies.splice(i, 1);
                        i--;
                    }
                    gameState.bullets.splice(j, 1);
                    break;
                }
            }
            updateBullets()
        }
    }

}
const heroimg = new Image();
heroimg.src = "./лучник.png";
function drawxitbox() {
    canvasContext.fillStyle = 'rgba(0,0,0,0.0)';
    canvasContext.fillRect(gameState.player.x, gameState.player.y, gameState.player.width, gameState.player.height);

    canvasContext.drawImage(heroimg, gameState.player.x, gameState.player.y, gameState.player.width, gameState.player.height)

}




const keys = {
    up: false,
    down: false,
    left: false,
    right: false
};

window.addEventListener('keydown', (event) => {

    switch (event.key) {
        case 'ArrowUp':
            keys.up = true;
            break;
        case 'ArrowDown':
            keys.down = true;
            break;
        case 'ArrowLeft':
            keys.left = true;
            break;
        case 'ArrowRight':
            keys.right = true;
            break;
    }
});


window.addEventListener('keyup', (event) => {
    switch (event.key) {
        case 'ArrowUp':
            keys.up = false;
            break;
        case 'ArrowDown':
            keys.down = false;
            break;
        case 'ArrowLeft':
            keys.left = false;
            break;
        case 'ArrowRight':
            keys.right = false;
            break;
    }
});

function drawBack() {
    if (GAME.background) {
        canvasContext.drawImage(GAME.background, 0, 0, GAME.width, GAME.height);
    }

}
function drawhealtbarplayer() {
    canvasContext.fillStyle = "red";
    canvasContext.fillRect(gameState.player.x, gameState.player.y - 40, gameState.player.width, 25);
    canvasContext.fillStyle = "green";
    canvasContext.fillRect(gameState.player.x, gameState.player.y - 40, gameState.player.health, 25);


}



function updatePosition() {
    if (keys.up) gameState.player.y -= gameState.player.speed;
    if (keys.down) gameState.player.y += gameState.player.speed;
    if (keys.left) gameState.player.x -= gameState.player.speed;
    if (keys.right) gameState.player.x += gameState.player.speed;
    if (gameState.player.x <= 0) {
        gameState.player.x = 0
    }
    if (gameState.player.x + gameState.player.width >= GAME.width) {
        gameState.player.x = GAME.width - gameState.player.width
    }
    if (gameState.player.y + gameState.player.height >= GAME.height) {
        gameState.player.y = GAME.height - gameState.player.height
    }
    if (gameState.player.y <= 0) {
        gameState.player.y = 0
    }
    if (gameState.player.invulnerableTime > 0) {
        gameState.player.invulnerableTime--;
    }
    if (Date.now() - gameState.lastShotTime >= fireRate) {
        const closestEnemy = findClosestEnemy();
        if (closestEnemy) {
            shootBullet(closestEnemy);
            gameState.lastShotTime = Date.now();


        }
    }
}

function findClosestEnemy() {
    let closestEnemy = null;
    let closestDistance = Infinity;
    const player = gameState.player;

    for (const enemy of gameState.enemies) {
        const dx = player.x + player.width / 2 - enemy.enemy_x;
        const dy = player.y + player.height / 2 - enemy.enemy_y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < closestDistance) {
            closestDistance = distance;
            closestEnemy = enemy;
        }


    }


    return closestEnemy;
}
function shootBullet(closestEnemy) {
    const player = gameState.player;
    const dx = closestEnemy.enemy_x - player.x - player.width / 2;
    const dy = closestEnemy.enemy_y - player.y - player.height / 2;
    const distance = Math.sqrt(dx * dx + dy * dy);

    gameState.bullets.push({
        x: player.x + player.width / 2,
        y: player.y + player.height / 2,
        dx: (dx / distance) * player.bulletSpeed,
        dy: (dy / distance) * player.bulletSpeed,
        isEnemy: false
    });
}

function updateBullets() {
    for (let i = gameState.bullets.length - 1; i >= 0; i--) {
        const bullet = gameState.bullets[i];
        bullet.x += bullet.dx;
        bullet.y += bullet.dy;

        if (bullet.x < 0 || bullet.x > canvas.width || bullet.y < 0 || bullet.y > canvas.height) {
            gameState.bullets.splice(i, 1);
            continue;
        }

        canvasContext.beginPath();
        canvasContext.arc(bullet.x, bullet.y, 5, 0, Math.PI * 2);
        canvasContext.fillStyle = bullet.isEnemy ? 'yellow' : 'red';
        canvasContext.fill();
    }
}

function div(val, by) {
    return (val - val % by) / by;
}

var sec = 0
function drawtimer() {
    canvasContext.font = "40px serif";
    canvasContext.fillStyle = 'white'
    if (sec >= 60) {
        canvasContext.fillText('Time: ' + Math.floor(sec / 60) + ' minuts ' + (sec - Math.floor(sec / 60) * 60) + ' seconds', 0, GAME.height / 2);
    }
    else {
        canvasContext.fillText('Time:' + sec, 0, GAME.height / 2);
    }
    if (sec / 60 >= 2) {
        won()
    }
}





setInterval(() => sec += 1, 1000);

function drawFrame() {
    canvasContext.clearRect(0, 0, GAME.width, GAME.height)
    drawBack()
    drawenemy()
    updatePosition()
    drawxitbox()
    
    updateEnemies()
    drawhealtbarplayer()
    drawtimer()
}
let isgameover = false;
let isgamewin = false;

function play() {
    updatePosition()
    drawFrame()
    if (!isgameover)
        requestAnimationFrame(play)
    else {
        if (isgameover){
        canvasContext.clearRect(0, 0, GAME.width, GAME.height)
        GameOver()
        }
    }

}



function GameOver() {
    if (gameState.player.health <= 0) {
        isgameover = true;
        if (!isgamewin) {
            drawgameoverskin()
            setTimeout(() => {
                window.location.reload();
            }, 10000);
        }
        else {
            drawwinscreene()
        }
    }
}

function won() {
    
    isgamewin = true;
    drawwinscreene()
    
    
}
function drawwinscreene() {
    canvasContext.clearRect(0, 0, GAME.width, GAME.height)
    drawBack()
    canvasContext.fillStyle = 'white';
    canvasContext.font = "200px Arial";
    canvasContext.fillText('YOU WIN', GAME.width / 2-460, GAME.height / 2 + 50 );

}
function drawgameoverskin() {
    drawBack()
    if (sec < 60) {
        canvasContext.fillStyle = 'white';
        canvasContext.font = "40px Arial";
        canvasContext.fillText('Time: ' + sec + ' seconds ', 0, GAME.height / 2);
    }

    else {
        canvasContext.fillStyle = 'white';
        canvasContext.font = "40px Arial";
        canvasContext.fillText('Time: ' + Math.floor(sec / 60) + ' minuts ' +( sec - Math.floor(sec / 60) * 60) + ' seconds', 0, GAME.height / 2);
        console.log(Math.floor(sec / 60))
    }
    canvasContext.fillStyle='white'
    canvasContext.font = "70px Arial";
    canvasContext.fillText('YOU LOSE',GAME.width/2-250 ,GAME.height / 2);
}




play()

