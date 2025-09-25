// Corrida de Carrinho - multi (Jessika)
// Controles:
// J1: ArrowLeft / ArrowRight
// J2: A / D

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const GAME_W = 400;
const GAME_H = 600;
// ensure crisp on high-DPI
function fixCanvas(){
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = GAME_W + 'px';
  canvas.style.height = GAME_H + 'px';
  canvas.width = Math.floor(GAME_W * dpr);
  canvas.height = Math.floor(GAME_H * dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
fixCanvas();
window.addEventListener('resize', fixCanvas);

// UI elements
const uiOverlay = document.getElementById('uiOverlay');
const startBtn = document.getElementById('startBtn');
const modeSelect = document.getElementById('modeSelect');
const difficultySelect = document.getElementById('difficultySelect');
const modeLabel = document.getElementById('modeLabel');
const bestLabel = document.getElementById('bestLabel');

const menuPanel = document.querySelector('.panel.menu');
const gameoverPanel = document.getElementById('gameoverPanel');
const finalScore = document.getElementById('finalScore');
const restartBtn = document.getElementById('restartBtn');
const menuBtn = document.getElementById('menuBtn');

const instrBtn = document.getElementById('instructionsBtn');
const instrPanel = document.getElementById('instrPanel');
const backInstr = document.getElementById('backInstr');

const timeLabel = document.getElementById('timeLabel');
const score1El = document.getElementById('score1');
const score2El = document.getElementById('score2');
const p2ScoreWrap = document.getElementById('p2ScoreWrap');

let state = 'menu'; // menu | playing | gameover

// Scores and record
let score1 = 0;
let score2 = 0;
let best = parseInt(localStorage.getItem('corrida_best') || '0', 10) || 0;
bestLabel.textContent = best;

// players
const player1 = { w:44, h:70, x: (GAME_W/2)-70, y: GAME_H-110, color: '#ff4d4d', speed:6 };
const player2 = { w:44, h:70, x: (GAME_W/2)+26, y: GAME_H-110, color: '#4dd0e1', speed:5.5 };

// keys
const keys = { left:false, right:false, a:false, d:false };

// obstacles array: will hold car obstacles
let obstacles = [];
let spawnTimer = 0;
let spawnInterval = 1200;
let baseSpeed = 2.2;
let elapsed = 0;

// difficulty presets
const difficulties = {
  easy: { spawn: 1400, baseSpeed: 1.6, accel: 0.004 },
  medium: { spawn: 1100, baseSpeed: 2.2, accel: 0.006 },
  hard: { spawn: 800, baseSpeed: 2.8, accel: 0.009 }
};

// car types for obstacles (visual varieties)
const obstacleTypes = [
  { w: 48, h: 26, color: '#4a90e2' },
  { w: 60, h: 30, color: '#f5a623' },
  { w: 40, h: 24, color: '#50e3c2' },
  { w: 52, h: 28, color: '#b78cff' },
  { w: 36, h: 22, color: '#ffd166' }
];

function rand(min, max){ return Math.random()*(max-min)+min }

// input
document.addEventListener('keydown', e => {
  if(e.key === 'ArrowLeft') keys.left = true;
  if(e.key === 'ArrowRight') keys.right = true;
  if(e.key.toLowerCase() === 'a') keys.a = true;
  if(e.key.toLowerCase() === 'd') keys.d = true;
  if(e.key === 'Enter' && state === 'menu') startGame();
  if(e.key === 'Enter' && state === 'gameover') restartGame();
});
document.addEventListener('keyup', e => {
  if(e.key === 'ArrowLeft') keys.left = false;
  if(e.key === 'ArrowRight') keys.right = false;
  if(e.key.toLowerCase() === 'a') keys.a = false;
  if(e.key.toLowerCase() === 'd') keys.d = false;
});

// UI interactions
modeSelect.addEventListener('change', () => {
  const m = modeSelect.value;
  modeLabel.textContent = m === '1' ? '1 Jogador' : '2 Jogadores';
  p2ScoreWrap.classList.toggle('hidden', m === '1');
});
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', restartGame);
menuBtn.addEventListener('click', toMenu);
instrBtn.addEventListener('click', () => {
  menuPanel.classList.add('hidden');
  instrPanel.classList.remove('hidden');
});
backInstr.addEventListener('click', () => {
  instrPanel.classList.add('hidden');
  menuPanel.classList.remove('hidden');
});

// game functions
function resetVars(){
  obstacles = [];
  spawnTimer = 0;
  elapsed = 0;
  score1 = 0;
  score2 = 0;
  score1El.textContent = score1;
  score2El.textContent = score2;
  // difficulty
  const diff = difficultySelect.value;
  spawnInterval = difficulties[diff].spawn;
  baseSpeed = difficulties[diff].baseSpeed;
}

function startGame(){
  resetVars();
  state = 'playing';
  menuPanel.classList.add('hidden');
  gameoverPanel.classList.add('hidden');
  instrPanel.classList.add('hidden');
  lastTime = performance.now();
}

function restartGame(){
  resetVars();
  state = 'playing';
  gameoverPanel.classList.add('hidden');
  lastTime = performance.now();
}

function toMenu(){
  state = 'menu';
  menuPanel.classList.remove('hidden');
  gameoverPanel.classList.add('hidden');
}

// spawn obstacle (car)
function spawnObstacle(){
  const type = obstacleTypes[Math.floor(Math.random()*obstacleTypes.length)];
  // spawn at random x within road (leave 16px padding)
  const x = rand(16, GAME_W - 16 - type.w);
  const y = - (20 + rand(0,80));
  // a little horizontal drift optionally
  const speed = baseSpeed + rand(0.4, 1.8);
  obstacles.push({ x, y, w: type.w, h: type.h, color: type.color, speed, drift: rand(-0.3,0.3) });
}

// AABB collision
function rectsIntersect(a,b){
  return !(a.x + a.w < b.x || a.x > b.x + b.w || a.y + a.h < b.y || a.y > b.y + b.h);
}

// update game logic
function updateGame(dt){
  const diff = difficultySelect.value;
  const accel = difficulties[diff].accel;

  elapsed += dt;
  // increase difficulty over time
  baseSpeed += accel * (dt/16); // scaled by frame
  // reduce spawn interval gradually but not below some minimum
  spawnInterval = Math.max(350, spawnInterval - 0.002 * dt);

  // player movements
  if(keys.left) player1.x -= player1.speed;
  if(keys.right) player1.x += player1.speed;
  if(modeSelect.value === '2'){ // player 2 controls
    if(keys.a) player2.x -= player2.speed;
    if(keys.d) player2.x += player2.speed;
  }

  // keep inside bounds
  player1.x = Math.max(12, Math.min(GAME_W - 12 - player1.w, player1.x));
  player2.x = Math.max(12, Math.min(GAME_W - 12 - player2.w, player2.x));

  // spawn logic
  spawnTimer += dt;
  if(spawnTimer > spawnInterval){
    spawnObstacle();
    spawnTimer = 0;
  }

  // move obstacles
  for(let i = obstacles.length-1; i>=0; i--){
    let o = obstacles[i];
    o.y += o.speed + baseSpeed*0.12;
    o.x += o.drift;
    // clamp x to road
    if(o.x < 10) o.x = 10;
    if(o.x + o.w > GAME_W - 10) o.x = GAME_W - 10 - o.w;

    // passed bottom -> give points, remove
    if(o.y > GAME_H + 40){
      obstacles.splice(i,1);
      // award points (differ by mode)
      score1 += 5;
      if(modeSelect.value === '2') score2 += 5; // in coop give both for simplicity
      score1El.textContent = score1;
      score2El.textContent = score2;
    }
    // collision check with players
    const p1Box = { x: player1.x, y: player1.y, w: player1.w, h: player1.h };
    if(rectsIntersect(p1Box, o)){
      endGame(1);
      return;
    }
    if(modeSelect.value === '2'){
      const p2Box = { x: player2.x, y: player2.y, w: player2.w, h: player2.h };
      if(rectsIntersect(p2Box, o)){
        endGame(2);
        return;
      }
    }
  }

  // time-based points (small)
  const tickPoints = Math.floor(dt * 0.003);
  if(tickPoints){
    score1 += tickPoints;
    if(modeSelect.value === '2') score2 += tickPoints;
    score1El.textContent = score1;
    score2El.textContent = score2;
  }

  // update HUD time
  timeLabel.textContent = Math.floor(elapsed/1000);
}

// end game routine (which player collided or single)
function endGame(playerHit){
  state = 'gameover';
  finalScore.textContent = modeSelect.value === '1' ? score1 : `${score1} / ${score2}`;
  gameoverPanel.classList.remove('hidden');

  // best logic: for single player, compare score1
  if(modeSelect.value === '1'){
    if(score1 > best){
      best = score1;
      localStorage.setItem('corrida_best', String(best));
      bestLabel.textContent = best;
    }
  } else {
    // for 2 players, store highest combined as best
    const combined = score1 + score2;
    if(combined > best){
      best = combined;
      localStorage.setItem('corrida_best', String(best));
      bestLabel.textContent = best;
    }
  }
}

// drawing functions
function drawBackground(){
  ctx.fillStyle = '#111';
  ctx.fillRect(0,0,GAME_W,GAME_H);

  // road
  const roadX = 16;
  const roadW = GAME_W - roadX*2;
  ctx.fillStyle = '#2b2b2b';
  roundRect(ctx, roadX, 0, roadW, GAME_H, 12);
  ctx.fill();

  // borders
  ctx.fillStyle = '#1b1b1b';
  ctx.fillRect(roadX-6,0,6,GAME_H);
  ctx.fillRect(roadX+roadW,0,6,GAME_H);

  // center dashed line
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 6;
  ctx.setLineDash([28,18]);
  ctx.beginPath();
  ctx.moveTo(GAME_W/2, -40);
  ctx.lineTo(GAME_W/2, GAME_H+40);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawPlayer(p){
  ctx.fillStyle = p.color;
  roundRect(ctx, p.x, p.y, p.w, p.h, 8);
  ctx.fill();
  // window
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  roundRect(ctx, p.x+6, p.y+10, p.w-12, p.h/3, 4);
  ctx.fill();
}

function drawObstacles(){
  obstacles.forEach(o=>{
    ctx.fillStyle = o.color;
    roundRect(ctx, o.x, o.y, o.w, o.h, 6);
    ctx.fill();
    // small highlight
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(o.x + 6, o.y + 4, Math.max(6, o.w * 0.2), Math.max(3, o.h * 0.28));
  });
}

function drawHUD(){}
function roundRect(ctx,x,y,w,h,r){
  const radius = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

let lastTime = performance.now();
function loop(now){
  const dt = now - lastTime;
  lastTime = now;

  if(state === 'playing'){
    updateGame(dt);
  }

  // draw
  drawBackground();
  drawObstacles();
  drawPlayer(player1);
  if(modeSelect.value === '2') drawPlayer(player2);
  drawHUD();

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
