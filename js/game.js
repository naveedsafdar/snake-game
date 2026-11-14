/* =========================================================
   Snake: game logic and drawing
   ========================================================= */
"use strict";

// ----- Settings -----
const CELL = 20;        // size of one grid square in pixels
const COLS = 20;        // squares across
const ROWS = 20;        // squares down
const STEP_MS = 110;    // time between snake moves in ms (lower = faster)

// What can appear on the board: the emoji to pick from, points for eating it,
// and the color of the glowing ring drawn behind it so it stands out
const ITEMS = {
  junk:    { emojis: ["🍔", "🍕", "🍟", "🌭", "🍩"], points: 1, glow: "#ff6d00" },
  healthy: { emojis: ["🍎", "🍓", "🍒", "🍉", "🍇", "🍊", "🥝", "🍑"], points: 2, glow: "#43a047" },
  cactus:  { emojis: ["🌵"], points: -5, glow: "#e53935" }
};
const FOOD_KINDS = ["junk", "healthy"];  // one of each is always on the board

const CACTUS_EVERY = 5;     // a cactus appears each time the score passes a multiple of this
const CACTUS_SECONDS = 8;   // how long a cactus stays if it isn't eaten
const CACTUS_SHRINK = 2;    // squares lost off the tail when a cactus is eaten
const MIN_LENGTH = 3;       // the snake never shrinks below this

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
  confetti: ["#ffb300", "#43a047", "#e53935", "#1e88e5", "#8e24aa"],
  prickles: ["#2e7d32", "#43a047", "#7cb342", "#d32f2f"]
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
const saveStatusEl = document.getElementById("save-status");
const homeButton = document.getElementById("home-button");

// Home screen elements
const homeScreen = document.getElementById("home-screen");
const nameForm = document.getElementById("name-form");
const nameInput = document.getElementById("name-input");
const playButton = document.getElementById("play-button");
const formMessage = document.getElementById("form-message");
const leaderboardBody = document.getElementById("leaderboard-body");
const statsEl = document.getElementById("stats");
const playerLabel = document.getElementById("player-label");
const playerNameEl = document.getElementById("player-name");

// ----- Game state -----
let snake;          // array of {x, y} grid squares; snake[0] is the head
let direction;      // current direction {x, y}
let nextDir;        // direction chosen by the player, used on the next move
let foods;          // [junk, healthy]: each {x, y, kind, emoji} (null if the board is full)
let cactus;         // {x, y, kind, emoji, timeLeft} or null
let score;
let state;          // "home" → "ready" → "playing" → "crashing" → "over"
let player = { id: null, name: "" };  // who is playing (id comes from the database)
let saveResult = "";                  // how saving the last score went (see updateSaveStatus)
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

  foods = [];
  cactus = null;
  refillFoods();
  state = "ready";
  startScreen.classList.remove("hidden");
  gameOverScreen.classList.add("hidden");
}

// Everything that can be eaten right now
function itemsOnBoard() {
  return foods.concat([cactus]).filter(Boolean);
}

// Make sure one junk food and one healthy food are on the board
function refillFoods() {
  FOOD_KINDS.forEach((kind, i) => {
    if (!foods[i]) foods[i] = placeItem(kind);
  });
}

// A new item of this kind on a random empty square (null if there's no room)
function placeItem(kind) {
  const head = snake[0];
  const taken = snake.concat(itemsOnBoard());
  const free = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (taken.some(t => t.x === x && t.y === y)) continue;
      // Don't drop a cactus right in front of the snake's face
      if (kind === "cactus" && Math.abs(x - head.x) + Math.abs(y - head.y) < 3) continue;
      free.push({ x, y });
    }
  }
  if (free.length === 0) return null;

  const cell = pick(free);
  return { x: cell.x, y: cell.y, kind, emoji: pick(ITEMS[kind].emojis), timeLeft: CACTUS_SECONDS };
}

// Add (or take away) points; the score never goes below 0
function changeScore(points) {
  score = Math.max(0, score + points);
  scoreEl.textContent = score;
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

  const eaten = itemsOnBoard().find(item => item.x === head.x && item.y === head.y);

  if (!eaten) {
    // Didn't eat: drop the tail so the length stays the same
    snake.pop();
  } else if (eaten.kind === "cactus") {
    // Ate the cactus: lose points, no growth, and the tail shrinks
    cactus = null;
    snake.pop();
    for (let i = 0; i < CACTUS_SHRINK && snake.length > MIN_LENGTH; i++) snake.pop();
    changeScore(ITEMS.cactus.points);
    ouch(eaten);
  } else {
    // Ate food: keep the tail so the snake grows.
    // Both foods are cleared, and a fresh pair is placed below
    // (the cactus, if any, stays where it is)
    foods = [];
    const before = score;
    changeScore(ITEMS[eaten.kind].points);
    celebrate(eaten);

    // A cactus appears each time the score passes a multiple of CACTUS_EVERY
    // (healthy food is worth 2, so the score can jump past it, e.g. 4 → 6)
    if (!cactus && Math.floor(score / CACTUS_EVERY) > Math.floor(before / CACTUS_EVERY)) {
      cactus = placeItem("cactus");
    }
  }

  // Place new foods where needed (after eating, or if they couldn't fit before)
  refillFoods();
}

// Count down the cactus timer; it disappears when time runs out
function updateCactus(dt) {
  if (!cactus) return;
  cactus.timeLeft -= dt;
  if (cactus.timeLeft <= 0) cactus = null;
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

  // Save the score in the background while the splash plays
  saveScore(score);

  // Show the game-over screen once the splash has played
  setTimeout(showGameOver, 1200);
}

function showGameOver() {
  state = "over";
  finalScoreEl.textContent = score;
  updateSaveStatus();
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

  // Floating "+1" or "+2" showing the eaten food
  const points = ITEMS[eaten.kind].points;
  popups.push({ x, y, age: 0, life: 0.9, text: "+" + points + " " + eaten.emoji, color: "#2e7d32" });

  // Make the score number pop (see style.css)
  restartAnimation(scoreEl, "pop");
}

// The snake ate a cactus: green prickles, a red "−5" and a small shake
function ouch(eaten) {
  const x = (eaten.x + 0.5) * CELL;
  const y = (eaten.y + 0.5) * CELL;

  for (let i = 0; i < 20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 160;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 1.5 + Math.random() * 2,
      age: 0,
      life: 0.5 + Math.random() * 0.3,
      color: pick(COLORS.prickles)
    });
  }

  popups.push({ x, y, age: 0, life: 1.1, text: "−5 " + eaten.emoji, color: "#d32f2f" });
  restartAnimation(board, "nudge");
  restartAnimation(scoreEl, "pop");
}


/* =========================================================
   Home screen, players and scores (uses db.js)
   ========================================================= */

// Show the home screen with a fresh leaderboard
function showHome() {
  resetGame();
  state = "home";
  homeScreen.classList.remove("hidden");
  startScreen.classList.add("hidden");
  gameOverScreen.classList.add("hidden");

  nameInput.value = player.name || loadSavedName();

  // Put the cursor in the name box, except on phones, where that
  // would pop up the keyboard and cover the leaderboard
  if (!window.matchMedia("(pointer: coarse)").matches) nameInput.focus();
  loadLeaderboard();
}

// The player typed their name and pressed Play (or Enter)
nameForm.addEventListener("submit", async event => {
  event.preventDefault();   // don't reload the page

  const name = nameInput.value.trim();
  if (!name) {
    formMessage.textContent = "Please enter your name.";
    return;
  }

  // Save the player in the database (or find them if they've played before)
  playButton.disabled = true;
  formMessage.textContent = "";
  const id = await Database.registerPlayer(name);
  playButton.disabled = false;

  player = { id, name };
  saveName(name);
  playerNameEl.textContent = name;
  playerLabel.classList.remove("hidden");

  // Hide the home screen and wait for the first arrow key
  nameInput.blur();
  homeScreen.classList.add("hidden");
  resetGame();
});

homeButton.addEventListener("click", showHome);

// Fill in the Top 5 scores table and the stats line
async function loadLeaderboard() {
  if (!Database.isReady()) {
    showLeaderboardMessage("Leaderboard isn't connected yet.");
    statsEl.textContent = "";
    return;
  }

  showLeaderboardMessage("Loading…");
  const [rows, stats] = await Promise.all([
    Database.getLeaderboard(5),
    Database.getStats()
  ]);

  if (rows === null) {
    showLeaderboardMessage("Couldn't load the leaderboard.");
  } else if (rows.length === 0) {
    showLeaderboardMessage("No scores yet. Be the first!");
  } else {
    // Older databases return best_score / best_score_at (one row per player);
    // the current schema.sql returns score / played_at (one row per game)
    leaderboardBody.replaceChildren(...rows.map((row, i) =>
      tableRow([i + 1, row.name, row.score ?? row.best_score,
                formatDate(row.played_at ?? row.best_score_at)])
    ));
  }

  statsEl.textContent = stats
    ? `Games played: ${stats.total_games}  ·  Players: ${stats.total_players}`
    : "";
}

// One table row. textContent (not innerHTML) so a name can't inject HTML.
function tableRow(values) {
  const tr = document.createElement("tr");
  values.forEach(value => {
    const td = document.createElement("td");
    td.textContent = value;
    tr.appendChild(td);
  });
  return tr;
}

// A single full-width row such as "Loading…"
function showLeaderboardMessage(text) {
  const tr = document.createElement("tr");
  tr.className = "message-row";
  const td = document.createElement("td");
  td.colSpan = 4;
  td.textContent = text;
  tr.appendChild(td);
  leaderboardBody.replaceChildren(tr);
}

// e.g. "13 Nov 2026"
function formatDate(isoDate) {
  if (!isoDate) return "";
  return new Date(isoDate).toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric"
  });
}

// Save the finished game's score
async function saveScore(finalScore) {
  if (!player.id) {
    saveResult = Database.isReady() ? "failed" : "offline";
    updateSaveStatus();
    return;
  }
  saveResult = "saving";
  updateSaveStatus();

  const isNewBest = await Database.submitScore(player.id, finalScore);
  if (isNewBest === null) saveResult = "failed";
  else saveResult = isNewBest ? "best" : "saved";
  updateSaveStatus();
}

// Show how saving went on the game-over screen
function updateSaveStatus() {
  const messages = {
    saving: "Saving score…",
    saved: "Score saved ✓",
    best: "🎉 New personal best!",
    failed: "Couldn't save your score.",
    offline: ""   // no database set up: say nothing
  };
  saveStatusEl.textContent = messages[saveResult] || "";
  saveStatusEl.classList.toggle("best", saveResult === "best");
}

// Remember the last name typed on this computer, so it's filled in next time.
// (Wrapped in try/catch because some browsers block storage.)
function saveName(name) {
  try { localStorage.setItem("snakePlayerName", name); } catch (e) {}
}

function loadSavedName() {
  try { return localStorage.getItem("snakePlayerName") || ""; } catch (e) { return ""; }
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
  if (state === "playing") updateCactus(dt);

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
  itemsOnBoard().forEach(item => drawItem(item, time));
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

// Food (or a cactus) on a bright glowing ring, gently pulsing so it's easy to spot
function drawItem(item, time) {
  const cx = (item.x + 0.5) * CELL;
  const cy = (item.y + 0.5) * CELL;
  const scale = 1 + 0.08 * Math.sin(time / 200);
  const glow = ITEMS[item.kind].glow;

  ctx.save();

  // A cactus blinks during its last 2 seconds, as a warning it's about to go
  if (item.kind === "cactus" && item.timeLeft < 2 && Math.floor(time / 150) % 2 === 0) {
    ctx.globalAlpha = 0.35;
  }

  // Glowing ring: soft filled halo plus a solid outline
  ctx.fillStyle = glow;
  const halo = ctx.globalAlpha;
  ctx.globalAlpha = halo * 0.45;
  circle(cx, cy, CELL * 0.62 * scale);
  ctx.globalAlpha = halo;
  ctx.strokeStyle = glow;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, CELL * 0.58 * scale, 0, Math.PI * 2);
  ctx.stroke();

  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.font = CELL + "px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#000";   // solid color, so the emoji isn't drawn see-through
  ctx.fillText(item.emoji, 0, 1);
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
    ctx.fillStyle = p.color;
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
  // On the home screen, keys are for typing the name
  if (state === "home") return;

  // Space restarts after game over (same player)
  if (event.code === "Space") {
    event.preventDefault();   // stop the page from scrolling
    if (state === "over") resetGame();
    return;
  }

  const newDir = KEYS[event.key];
  if (!newDir) return;
  event.preventDefault();     // stop arrow keys from scrolling the page

  turn(newDir);
});

// Change direction (used by both the keyboard and swipes)
function turn(newDir) {
  if (state !== "ready" && state !== "playing") return;

  // Don't allow reversing straight back into the body
  if (newDir.x === -direction.x && newDir.y === -direction.y) return;

  nextDir = newDir;

  // The first move starts the game
  if (state === "ready") {
    state = "playing";
    startScreen.classList.add("hidden");
    lastStepTime = performance.now();
  }
}


/* =========================================================
   Touch controls (phones and tablets)
   Swipe anywhere to turn; tap to play again after game over.
   ========================================================= */

const SWIPE_MIN = 24;   // finger must move this many pixels to count as a swipe
let touchStart = null;  // where the current touch started (or last turned)
let touchSwiped = false;

// Touches on buttons and text boxes work normally (e.g. "Back to home", the name box)
function isControl(target) {
  return target.closest("button, input, form, a") !== null;
}

document.addEventListener("touchstart", event => {
  if (state === "home" || isControl(event.target)) {
    touchStart = null;
    return;
  }
  const t = event.touches[0];
  touchStart = { x: t.clientX, y: t.clientY };
  touchSwiped = false;
}, { passive: true });

document.addEventListener("touchmove", event => {
  if (!touchStart) return;

  // Stop the page from scrolling or pulling to refresh while playing
  event.preventDefault();

  const t = event.touches[0];
  const dx = t.clientX - touchStart.x;
  const dy = t.clientY - touchStart.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;

  // Turn the way the finger moved the most
  if (Math.abs(dx) > Math.abs(dy)) {
    turn(dx > 0 ? KEYS.ArrowRight : KEYS.ArrowLeft);
  } else {
    turn(dy > 0 ? KEYS.ArrowDown : KEYS.ArrowUp);
  }

  // Measure the next swipe from here, so one long finger move
  // can make several turns (e.g. right then down)
  touchStart = { x: t.clientX, y: t.clientY };
  touchSwiped = true;
}, { passive: false });

document.addEventListener("touchend", event => {
  if (!touchStart) return;

  // A tap (no swipe) after game over plays again, like the space bar
  if (!touchSwiped && state === "over") {
    event.preventDefault();   // don't also send a "click"
    resetGame();
  }
  touchStart = null;
});


// On touch screens, swap the keyboard hints for touch hints
if (window.matchMedia("(pointer: coarse)").matches) {
  document.getElementById("start-hint").textContent = "Swipe to start";
  document.getElementById("restart-hint").textContent = "Tap to play again";
  document.getElementById("help-text").textContent = "Swipe on the screen to move";
}

// ----- Start on the home screen -----
showHome();
requestAnimationFrame(loop);
