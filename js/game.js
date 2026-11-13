/* =========================================================
   Snake: game logic and drawing
   ========================================================= */
"use strict";

// ----- Settings -----
const CELL = 20;        // size of one grid square in pixels
const COLS = 20;        // squares across
const ROWS = 20;        // squares down
const STEP_MS = 110;    // time between snake moves in ms (lower = faster)

// The foods that can appear. One is picked at random each time.
const FOODS = ["🍎", "🍊", "🍔", "🍌", "🍇", "🍓", "🍕", "🍒", "🍉", "🍩"];

const COLORS = {
  tileLight: "#fffdf6",   // board checkerboard
  tileDark: "#f6f3e8",
  snakeOutline: "#1c1e20", // cobra colors: dark grays
  snakeBody: "#3d4145",
  snakeHead: "#33373a",
  snakeScales: "#5c6166",
  eye: "#f2b705",
  tongue: "#d32f2f",
  blood: ["#8e0000", "#b71c1c", "#d32f2f", "#e53935"],
  confetti: ["#ffb300", "#43a047", "#e53935", "#1e88e5", "#8e24aa"]
};

// Arrow keys → direction of movement
const KEYS = {
  ArrowUp:    { x: 0,  y: -1 },
  ArrowDown:  { x: 0,  y: 1 },
  ArrowLeft:  { x: -1, y: 0 },
  ArrowRight: { x: 1,  y: 0 }
};

// ----- Page elements -----
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const board = document.getElementById("board");
const scoreEl = document.getElementById("score");
const finalScoreEl = document.getElementById("final-score");
const startScreen = document.getElementById("start-screen");
const gameOverScreen = document.getElementById("game-over-screen");

// ----- Game state -----
let snake;          // array of {x, y} grid squares; snake[0] is the head
let direction;      // current direction {x, y}
let nextDir;        // direction chosen by the player, used on the next move
let food;           // {x, y, emoji}
let score;
let state;          // "ready" → "playing" → "crashing" → "over"
let lastStepTime = 0;
let lastFrameTime = 0;

// ----- Visual effects -----
let particles = []; // small flying dots (eat confetti and crash splash)
let splats = [];    // red stains left on the board after a crash
let popups = [];    // floating "+1" texts
let flash = 0;      // strength of the red flash after a crash (1 fades to 0)


/* =========================================================
   Game flow
   ========================================================= */

// Set everything up for a new game
function resetGame() {
  snake = [
    { x: 10, y: 10 },
    { x: 9,  y: 10 },
    { x: 8,  y: 10 }
  ];
  direction = { x: 1, y: 0 };
  nextDir = direction;
  score = 0;
  scoreEl.textContent = "0";

  particles = [];
  splats = [];
  popups = [];
  flash = 0;

  placeFood();
  state = "ready";
  startScreen.classList.remove("hidden");
  gameOverScreen.classList.add("hidden");
}

// Put a random food on a random empty square
function placeFood() {
  do {
    food = {
      x: Math.floor(Math.random() * COLS),
      y: Math.floor(Math.random() * ROWS),
      emoji: pick(FOODS)
    };
  } while (snake.some(part => part.x === food.x && part.y === food.y));
}

// Move the snake one square
function step() {
  direction = nextDir;

  const head = {
    x: snake[0].x + direction.x,
    y: snake[0].y + direction.y
  };

  const hitWall = head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS;
  const hitSelf = snake.some(part => part.x === head.x && part.y === head.y);

  if (hitWall) {
    // Splash where the head meets the wall (half a square ahead of the head)
    crash((snake[0].x + 0.5 + direction.x * 0.5) * CELL,
          (snake[0].y + 0.5 + direction.y * 0.5) * CELL);
    return;
  }
  if (hitSelf) {
    // Splash on the body square the head ran into
    crash((head.x + 0.5) * CELL, (head.y + 0.5) * CELL);
    return;
  }

  // Add the new head to the front
  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    // Ate the food: keep the tail so the snake grows
    score++;
    scoreEl.textContent = score;
    celebrate(food);
    placeFood();
  } else {
    // Didn't eat: drop the tail so the length stays the same
    snake.pop();
  }
}

// The snake crashed at pixel position (x, y)
function crash(x, y) {
  state = "crashing";

  // Red droplets flying out from the impact point
  for (let i = 0; i < 70; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 320;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 2 + Math.random() * 5,
      age: 0,
      life: 0.8 + Math.random() * 0.8,
      color: pick(COLORS.blood)
    });
  }

  // Red stains that stay on the board
  for (let i = 0; i < 16; i++) {
    splats.push({
      x: x + (Math.random() - 0.5) * 70,
      y: y + (Math.random() - 0.5) * 70,
      radius: 4 + Math.random() * 14,
      grow: 0,              // grows from 0 to 1 so the stain "spreads"
      color: pick(COLORS.blood)
    });
  }

  flash = 1;                       // red flash over the board
  restartAnimation(board, "shake"); // shake the board (see style.css)

  // Show the game-over screen once the splash has played
  setTimeout(showGameOver, 1200);
}

function showGameOver() {
  state = "over";
  finalScoreEl.textContent = score;
  gameOverScreen.classList.remove("hidden");
}

// Small party when food is eaten
function celebrate(eaten) {
  const x = (eaten.x + 0.5) * CELL;
  const y = (eaten.y + 0.5) * CELL;

  // Confetti burst
  for (let i = 0; i < 16; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 140;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 1.5 + Math.random() * 2.5,
      age: 0,
      life: 0.5 + Math.random() * 0.3,
      color: pick(COLORS.confetti)
    });
  }

  // Floating "+1" showing the eaten food
  popups.push({ x, y, age: 0, life: 0.9, text: "+1 " + eaten.emoji });

  // Make the score number pop (see style.css)
  restartAnimation(scoreEl, "pop");
}


/* =========================================================
   Animation loop: runs every frame (about 60 times a second)
   ========================================================= */

function loop(time) {
  // Seconds since the last frame (capped so a paused tab doesn't jump)
  const dt = Math.min(0.05, (time - lastFrameTime) / 1000);
  lastFrameTime = time;

  // Move the snake only every STEP_MS; effects animate every frame
  if (state === "playing" && time - lastStepTime >= STEP_MS) {
    lastStepTime = time;
    step();
  }

  updateEffects(dt);
  draw(time);
  requestAnimationFrame(loop);
}

// Move particles, grow stains, float popups, fade the flash
function updateEffects(dt) {
  const drag = Math.max(0, 1 - 3 * dt); // slows particles down over time

  particles.forEach(p => {
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= drag;
    p.vy *= drag;
  });
  particles = particles.filter(p => p.age < p.life);

  splats.forEach(s => { s.grow = Math.min(1, s.grow + dt * 6); });

  popups.forEach(p => {
    p.age += dt;
    p.y -= 35 * dt;   // float upward
  });
  popups = popups.filter(p => p.age < p.life);

  flash = Math.max(0, flash - dt * 2);
}


/* =========================================================
   Drawing
   ========================================================= */

function draw(time) {
  drawBoard();
  drawSplats();
  drawFood(time);
  drawSnake(time);
  drawParticles();
  drawPopups();

  // Red flash right after a crash
  if (flash > 0) {
    ctx.fillStyle = `rgba(211, 47, 47, ${flash * 0.35})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

// Light checkerboard background
function drawBoard() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? COLORS.tileLight : COLORS.tileDark;
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  }
}

function drawSplats() {
  splats.forEach(s => {
    ctx.fillStyle = s.color;
    ctx.globalAlpha = 0.85;
    circle(s.x, s.y, s.radius * s.grow);
  });
  ctx.globalAlpha = 1;
}

// Food gently pulses so it's easy to spot
function drawFood(time) {
  const cx = (food.x + 0.5) * CELL;
  const cy = (food.y + 0.5) * CELL;
  const scale = 1 + 0.08 * Math.sin(time / 200);

  // Soft shadow under the food
  ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
  ellipse(cx, cy + CELL * 0.4, CELL * 0.35, CELL * 0.12);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.font = CELL + "px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#000";   // solid color, so the emoji isn't drawn see-through
  ctx.fillText(food.emoji, 0, 1);
  ctx.restore();
}

// Draw the snake as a dark gray cobra: a tapering body, a wide hood,
// yellow eyes and a flicking forked tongue
function drawSnake(time) {
  // Pixel center of every segment
  const points = snake.map(p => ({ x: (p.x + 0.5) * CELL, y: (p.y + 0.5) * CELL }));
  const last = points.length - 1;

  // Body width: thick at the neck, thin at the tail
  const widthAt = i => CELL * (0.75 - 0.4 * (i / last));

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // 1) Dark outline, then 2) the body on top, tail to head
  [[COLORS.snakeOutline, 3], [COLORS.snakeBody, 0]].forEach(([color, extra]) => {
    ctx.strokeStyle = color;
    for (let i = last; i > 0; i--) {
      ctx.lineWidth = widthAt(i) + extra;
      ctx.beginPath();
      ctx.moveTo(points[i].x, points[i].y);
      ctx.lineTo(points[i - 1].x, points[i - 1].y);
      ctx.stroke();
    }
  });

  // 3) Scale pattern: lighter dots down the back
  ctx.fillStyle = COLORS.snakeScales;
  for (let i = last; i > 0; i--) {
    circle(points[i].x, points[i].y, widthAt(i) * 0.2);
    const midX = (points[i].x + points[i - 1].x) / 2;
    const midY = (points[i].y + points[i - 1].y) / 2;
    circle(midX, midY, widthAt(i) * 0.14);
  }

  // 4) Head: drawn facing right, then rotated to the direction of travel
  const head = points[0];
  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(Math.atan2(direction.y, direction.x));

  // Forked tongue flicks in and out while alive
  const alive = state === "ready" || state === "playing";
  if (alive && Math.sin(time / 90) > 0.3) {
    ctx.strokeStyle = COLORS.tongue;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(CELL * 0.45, 0);
    ctx.lineTo(CELL * 0.8, 0);
    ctx.moveTo(CELL * 0.8, 0);
    ctx.lineTo(CELL * 0.98, -3);
    ctx.moveTo(CELL * 0.8, 0);
    ctx.lineTo(CELL * 0.98, 3);
    ctx.stroke();
  }

  // Hood: the wide, flat shape behind a cobra's head
  ctx.fillStyle = COLORS.snakeOutline;
  ellipse(-3, 0, CELL * 0.42 + 1.5, CELL * 0.62 + 1.5);
  ctx.fillStyle = COLORS.snakeBody;
  ellipse(-3, 0, CELL * 0.42, CELL * 0.62);

  // Light markings on the hood
  ctx.fillStyle = COLORS.snakeScales;
  ellipse(-4, -CELL * 0.3, 2.5, 3.5);
  ellipse(-4, CELL * 0.3, 2.5, 3.5);

  // Head
  ctx.fillStyle = COLORS.snakeOutline;
  ellipse(4, 0, CELL * 0.45 + 1.5, CELL * 0.34 + 1.5);
  ctx.fillStyle = COLORS.snakeHead;
  ellipse(4, 0, CELL * 0.45, CELL * 0.34);

  // Yellow eyes with dark slit pupils
  [-4.5, 4.5].forEach(eyeY => {
    ctx.fillStyle = COLORS.eye;
    circle(7, eyeY, 2.3);
    ctx.fillStyle = "#000";
    ellipse(7, eyeY, 0.8, 1.8);
  });

  ctx.restore();
}

function drawParticles() {
  particles.forEach(p => {
    ctx.globalAlpha = 1 - p.age / p.life;   // fade out as it ages
    ctx.fillStyle = p.color;
    circle(p.x, p.y, p.size);
  });
  ctx.globalAlpha = 1;
}

function drawPopups() {
  ctx.font = "bold 16px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 3;
  popups.forEach(p => {
    ctx.globalAlpha = 1 - p.age / p.life;
    ctx.strokeStyle = "#fff";
    ctx.strokeText(p.text, p.x, p.y - 12);
    ctx.fillStyle = "#2e7d32";
    ctx.fillText(p.text, p.x, p.y - 12);
  });
  ctx.globalAlpha = 1;
}


/* =========================================================
   Small helpers
   ========================================================= */

function circle(x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
  ctx.fill();
}

function ellipse(x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Random item from a list
function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// Re-trigger a CSS animation by removing and re-adding its class
function restartAnimation(element, className) {
  element.classList.remove(className);
  void element.offsetWidth;   // forces the browser to notice the removal
  element.classList.add(className);
}


/* =========================================================
   Keyboard controls
   ========================================================= */

document.addEventListener("keydown", event => {
  // Space restarts after game over
  if (event.code === "Space") {
    event.preventDefault();   // stop the page from scrolling
    if (state === "over") resetGame();
    return;
  }

  const newDir = KEYS[event.key];
  if (!newDir) return;
  event.preventDefault();     // stop arrow keys from scrolling the page

  if (state === "crashing" || state === "over") return;

  // Don't allow reversing straight back into the body
  if (newDir.x === -direction.x && newDir.y === -direction.y) return;

  nextDir = newDir;

  // The first arrow key starts the game
  if (state === "ready") {
    state = "playing";
    startScreen.classList.add("hidden");
    lastStepTime = performance.now();
  }
});


// ----- Start -----
resetGame();
requestAnimationFrame(loop);
