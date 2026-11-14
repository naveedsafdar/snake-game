/* =========================================================
   Snake: game logic and drawing
   ========================================================= */
"use strict";

// ----- Settings -----
const CELL = 20;        // size of one grid square in pixels
const COLS = 20;        // squares across
const ROWS = 20;        // squares down
const STEP_MS = 110;    // time between snake moves in ms (lower = faster)

// What can appear on the board: the emoji to pick from, points for eating it
// (for food and the cactus, the snake also grows or shrinks by that many
// squares), and the color of the glowing ring drawn behind it so it stands out
const ITEMS = {
  junk:    { emojis: ["🍔", "🍕", "🍟", "🌭", "🍩"], points: 1, glow: "#ff6d00" },
  healthy: { emojis: ["🍎", "🍓", "🍒", "🍉", "🍇", "🍊", "🥝", "🍑"], points: 2, glow: "#43a047" },
  cactus:  { emojis: ["🌵"], points: -5, glow: "#e53935" },
  pill:    { emojis: ["💊"], points: 0, glow: "#1e88e5" }   // shrinks the snake, score unchanged
};
const FOOD_KINDS = ["junk", "healthy"];  // one of each is always on the board

const CACTUS_EVERY = 5;     // a cactus appears each time the score passes a multiple of this
const CACTUS_SECONDS = 8;   // how long a cactus stays if it isn't eaten
const PILL_EVERY = 20;      // a pill appears each time the score passes a multiple of this
const PILL_SECONDS = 5;     // how long a pill stays if it isn't eaten
const PILL_SHRINK = 10;     // squares the snake loses when it eats a pill
const MIN_LENGTH = 3;       // the snake never shrinks below this
const LEADERBOARD_LIMIT = 1000;   // players shown on the home screen (all of them, scrollable)

const SHRINK_SECONDS = 3;   // a cactus or pill shrinks the snake gradually over this long
const FLOW_SPEED = 25;      // swallowed food travels down the body this many squares a second
const FLOW_FADE = 0.3;      // seconds a swallowed food takes to fade if the tail is cut off

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
  prickles: ["#2e7d32", "#43a047", "#7cb342", "#d32f2f"],
  sparkles: ["#1e88e5", "#64b5f6", "#ffffff", "#e53935"]
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
const podiumEl = document.getElementById("podium");
const rankingEl = document.getElementById("ranking");
const statsEl = document.getElementById("stats");
const playerLabel = document.getElementById("player-label");
const playerNameEl = document.getElementById("player-name");

// ----- Game state -----
let snake;          // array of {x, y} grid squares; snake[0] is the head
let direction;      // current direction {x, y}
let nextDir;        // direction chosen by the player, used on the next move
let foods;          // [junk, healthy]: each {x, y, kind, emoji} (null if the board is full)
let cactus;         // {x, y, kind, emoji, timeLeft} or null
let pill;           // {x, y, kind, emoji, timeLeft} or null
let score;
let growPending;    // squares still to grow (one is added per move, from the tail)
let state;          // "home" → "ready" → "playing" → "crashing" → "over"
let player = { id: null, name: "" };  // who is playing (id comes from the database)
let saveResult = "";                  // how saving the last score went (see updateSaveStatus)
let lastStepTime = 0;
let lastFrameTime = 0;

// ----- Visual effects -----
let particles = []; // small flying dots (eat confetti and crash splash)
let splats = [];    // red stains left on the board after a crash
let flows = [];     // swallowed food travelling down the body: {emoji, age, fading}
let shrink;         // gradual shrinking: {left: squares still to lose, every: seconds per square, clock, color}
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
  growPending = 0;
  scoreEl.textContent = "0";

  particles = [];
  splats = [];
  flows = [];
  shrink = { left: 0, every: 0, clock: 0, color: "" };
  popups = [];
  flash = 0;

  foods = [];
  cactus = null;
  pill = null;
  refillFoods();
  state = "ready";
  startScreen.classList.remove("hidden");
  gameOverScreen.classList.add("hidden");
}

// Everything that can be eaten right now
function itemsOnBoard() {
  return foods.concat([cactus, pill]).filter(Boolean);
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
      // Don't drop a cactus or pill right in front of the snake's face
      const special = kind === "cactus" || kind === "pill";
      if (special && Math.abs(x - head.x) + Math.abs(y - head.y) < 3) continue;
      free.push({ x, y });
    }
  }
  if (free.length === 0) return null;

  const cell = pick(free);
  const timeLeft = kind === "pill" ? PILL_SECONDS : CACTUS_SECONDS;   // foods don't use it
  return { x: cell.x, y: cell.y, kind, emoji: pick(ITEMS[kind].emojis), timeLeft };
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

  if (eaten && eaten.kind === "cactus") {
    // Ate the cactus: lose points now, and the snake shrinks by the same
    // amount over the next few seconds
    cactus = null;
    changeScore(ITEMS.cactus.points);
    startShrink(-ITEMS.cactus.points, ITEMS.cactus.glow);
    ouch(eaten);
    flows.push({ emoji: eaten.emoji, age: 0 });
  } else if (eaten && eaten.kind === "pill") {
    // Ate the pill: the snake shrinks over the next few seconds, the score stays the same
    pill = null;
    startShrink(PILL_SHRINK, ITEMS.cactus.glow);   // same red shrink effect as the cactus
    healed(eaten);
  } else if (eaten) {
    // Ate food: the snake grows by as many squares as the points (+1 or +2).
    // Both foods are cleared, and a fresh pair is placed below
    // (the cactus, if any, stays where it is)
    growPending += ITEMS[eaten.kind].points;
    foods = [];
    const before = score;
    changeScore(ITEMS[eaten.kind].points);
    celebrate(eaten);
    flows.push({ emoji: eaten.emoji, age: 0 });

    // A cactus appears each time the score passes a multiple of CACTUS_EVERY,
    // and a pill each time it passes a multiple of PILL_EVERY, each on its own
    // schedule (healthy food is worth 2, so the score can jump past, e.g. 4 → 6)
    if (!cactus && passed(before, score, CACTUS_EVERY)) cactus = placeItem("cactus");
    if (!pill && passed(before, score, PILL_EVERY)) pill = placeItem("pill");
  }

  // Grow by keeping the tail (one square per move), otherwise drop it so
  // the length stays the same. (Shrinking happens over time, in updateTimers.)
  if (growPending > 0) {
    growPending--;
  } else {
    snake.pop();
  }

  // Place new foods where needed (after eating, or if they couldn't fit before)
  refillFoods();
}

// true when the score went past a multiple of `every` (e.g. 18 → 20 or 19 → 21 for 20)
function passed(before, after, every) {
  return Math.floor(after / every) > Math.floor(before / every);
}

// Start (or add to) a gradual shrink: the snake loses `squares` off its tail,
// evenly spread over SHRINK_SECONDS, with the tail glowing in `color`
function startShrink(squares, color) {
  shrink.left += squares;
  shrink.every = SHRINK_SECONDS / shrink.left;
  shrink.clock = 0;
  shrink.color = color;
}

// Count down the cactus and pill timers, and shrink the snake a square at a time
function updateTimers(dt) {
  if (shrink.left > 0) {
    shrink.clock += dt;
    while (shrink.left > 0 && shrink.clock >= shrink.every) {
      shrink.clock -= shrink.every;
      shrink.left--;
      if (snake.length > MIN_LENGTH) {
        const tail = snake.pop();
        burst((tail.x + 0.5) * CELL, (tail.y + 0.5) * CELL, [shrink.color, "#ffffff"], 6);
      }
    }
    if (snake.length <= MIN_LENGTH) shrink.left = 0;   // never shorter than MIN_LENGTH
  }

  if (cactus) {
    cactus.timeLeft -= dt;
    if (cactus.timeLeft <= 0) cactus = null;
  }
  if (pill) {
    pill.timeLeft -= dt;
    if (pill.timeLeft <= 0) pill = null;
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

// A small burst of colored dots flying out from (x, y)
function burst(x, y, colors, count = 20) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 160;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 1.5 + Math.random() * 2,
      age: 0,
      life: 0.5 + Math.random() * 0.3,
      color: pick(colors)
    });
  }
}

// The snake ate a pill: blue sparkles and a blue "−10 🐍" (the score doesn't change)
function healed(eaten) {
  const x = (eaten.x + 0.5) * CELL;
  const y = (eaten.y + 0.5) * CELL;
  burst(x, y, COLORS.sparkles);
  popups.push({ x, y, age: 0, life: 1.1, text: "−" + PILL_SHRINK + " 🐍 " + eaten.emoji, color: "#1565c0" });
}

// The snake ate a cactus: green prickles, a red "−5" and a small shake
function ouch(eaten) {
  const x = (eaten.x + 0.5) * CELL;
  const y = (eaten.y + 0.5) * CELL;
  burst(x, y, COLORS.prickles);

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

// Fill in the leaderboard (podium + list of everyone else) and the stats line
async function loadLeaderboard() {
  if (!Database.isReady()) {
    showLeaderboardMessage("Leaderboard isn't connected yet.");
    statsEl.textContent = "";
    return;
  }

  showLeaderboardMessage("Loading…");
  const [rows, stats] = await Promise.all([
    Database.getLeaderboard(LEADERBOARD_LIMIT),
    Database.getStats()
  ]);

  if (rows === null) {
    showLeaderboardMessage("Couldn't load the leaderboard.");
  } else if (rows.length === 0) {
    showLeaderboardMessage("No scores yet. Be the first!");
  } else {
    showPodium(rows.slice(0, 3));
    rankingEl.replaceChildren(...rows.slice(3).map((row, i) => rankingRow(i + 4, row)));
  }

  statsEl.textContent = stats
    ? `Games played: ${stats.total_games}  ·  Players: ${stats.total_players}`
    : "";
}

// Top 3 on the podium, arranged 2nd · 1st · 3rd, each with a dancing snake
function showPodium(top) {
  const places = [
    { rank: 2, metal: "silver", dance: "sway" },
    { rank: 1, metal: "gold", dance: "jump" },
    { rank: 3, metal: "bronze", dance: "wiggle" }
  ];
  podiumEl.replaceChildren(...places.map(place => {
    const row = top[place.rank - 1];
    const spot = document.createElement("div");
    spot.className = `spot place-${place.rank} ${place.metal}`;
    if (!row) {
      spot.classList.add("empty");   // fewer than 3 players so far
    } else {
      const dancer = document.createElement("div");
      dancer.className = "dancer";
      dancer.innerHTML = dancingSnake(place.metal, place.dance);   // fixed markup, no player data

      const name = document.createElement("div");
      name.className = "podium-name";
      name.textContent = row.name;   // textContent, so a name can't inject HTML
      name.title = row.name;

      const score = document.createElement("div");
      score.className = "podium-score";
      score.textContent = row.best_score;
      score.title = formatDate(row.best_score_at);

      spot.append(dancer, name, score);
    }
    const block = document.createElement("div");
    block.className = "podium-block";
    block.textContent = place.rank;
    spot.append(block);
    return spot;
  }));
  podiumEl.classList.remove("hidden");
}

// A little coiled snake in gold, silver or bronze, with a party hat.
// The CSS classes on it (see style.css) make it dance.
function dancingSnake(metal, dance) {
  const id = "metal-" + metal;
  return `<svg viewBox="0 0 60 64" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" class="m1"/><stop offset=".5" class="m2"/><stop offset="1" class="m3"/>
    </linearGradient></defs>
    <g class="dance ${dance}">
      <ellipse cx="30" cy="55" rx="17" ry="6.5" fill="none" stroke="url(#${id})" stroke-width="7"/>
      <ellipse cx="30" cy="55" rx="17" ry="6.5" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="1"/>
      <path d="M30 52 C 16 44, 44 34, 30 22" fill="none" stroke="url(#${id})" stroke-width="8" stroke-linecap="round"/>
      <path d="M30 52 C 16 44, 44 34, 30 22" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="1" stroke-dasharray="2 4"/>
      <g class="nod">
        <ellipse cx="30" cy="17" rx="10.5" ry="9" fill="url(#${id})" stroke="rgba(0,0,0,.25)"/>
        <circle cx="26" cy="15" r="3.2" fill="#fff"/><circle cx="34" cy="15" r="3.2" fill="#fff"/>
        <circle cx="26.6" cy="15.4" r="1.8" fill="#1c1e20"/><circle cx="34.6" cy="15.4" r="1.8" fill="#1c1e20"/>
        <path d="M26 21 Q30 24 34 21" stroke="#5a3a1a" stroke-width="1.4" fill="none" stroke-linecap="round"/>
        <path class="tongue" d="M30 25 L30 29 M30 29 L28 31.5 M30 29 L32 31.5" stroke="#d32f2f" stroke-width="1.3" stroke-linecap="round"/>
        <path d="M24 9 L30 1 L36 9 Z" fill="#e53935"/><circle cx="30" cy="1.5" r="1.8" fill="#ffeb3b"/>
      </g>
    </g>
  </svg>`;
}

// One row of the list: rank, name, best score, date. The current player's
// row is highlighted. textContent (not innerHTML) so a name can't inject HTML.
function rankingRow(rank, row) {
  const div = document.createElement("div");
  div.className = "ranking-row";
  div.style.setProperty("--i", rank - 4);   // rows slide in one after another
  if (player.name && row.name.trim().toLowerCase() === player.name.trim().toLowerCase()) {
    div.classList.add("me");
  }
  [rank, row.name, row.best_score, formatShortDate(row.best_score_at)].forEach((value, i) => {
    const span = document.createElement("span");
    span.textContent = value;
    if (i === 1) span.title = row.name;
    if (i === 3) span.title = formatDate(row.best_score_at);
    div.appendChild(span);
  });
  return div;
}

// A message such as "Loading…" in place of the leaderboard
function showLeaderboardMessage(text) {
  podiumEl.classList.add("hidden");
  podiumEl.replaceChildren();
  const p = document.createElement("p");
  p.className = "ranking-message";
  p.textContent = text;
  rankingEl.replaceChildren(p);
}

// e.g. "14 Nov" (the list is narrow; the full date shows on hover)
function formatShortDate(isoDate) {
  if (!isoDate) return "";
  return new Date(isoDate).toLocaleDateString(undefined, { day: "numeric", month: "short" });
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
  if (state === "playing") updateTimers(dt);

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

  // Swallowed food travels down the body. At the tail it's absorbed with a
  // small puff, or, if the tail is being cut off by a shrink, it fades out.
  const last = snake.length - 1;
  flows.forEach(f => {
    if (f.fading !== undefined) { f.fading += dt; return; }
    f.age += dt;
    if (f.age * FLOW_SPEED >= last) {
      if (shrink.left > 0) {
        f.fading = 0;
      } else {
        f.done = true;
        const tail = snake[last];
        burst((tail.x + 0.5) * CELL, (tail.y + 0.5) * CELL, [COLORS.snakeScales, "#ffffff"], 8);
      }
    }
  });
  flows = flows.filter(f => !f.done && !(f.fading >= FLOW_FADE));

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

// Food (or a cactus or pill) on a bright glowing ring, gently pulsing so it's easy to spot
function drawItem(item, time) {
  const cx = (item.x + 0.5) * CELL;
  const cy = (item.y + 0.5) * CELL;
  const scale = 1 + 0.08 * Math.sin(time / 200);
  const glow = ITEMS[item.kind].glow;

  ctx.save();

  // The pill blinks the whole time it's on the board; a cactus blinks
  // during its last 2 seconds, as a warning it's about to go
  const blinking = item.kind === "pill" || (item.kind === "cactus" && item.timeLeft < 2);
  if (blinking && Math.floor(time / 150) % 2 === 0) {
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

  // While shrinking, the tip of the tail slides in smoothly toward the next square
  if (shrink.left > 0 && last > 0) {
    const t = Math.min(1, shrink.clock / shrink.every);
    points[last] = {
      x: points[last].x + (points[last - 1].x - points[last].x) * t,
      y: points[last].y + (points[last - 1].y - points[last].y) * t
    };
  }

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

  // 4) While shrinking, the end of the tail glows and pulses red (cactus or
  //    pill), strongest at the tip
  if (shrink.left > 0) {
    const glowSquares = Math.min(last, shrink.left + 2);
    const pulse = 0.45 + 0.3 * Math.sin(time / 80);
    ctx.strokeStyle = shrink.color;
    for (let i = last; i > last - glowSquares; i--) {
      ctx.globalAlpha = pulse * (1 - (last - i) / glowSquares);
      ctx.lineWidth = widthAt(i) - 2;
      ctx.beginPath();
      ctx.moveTo(points[i].x, points[i].y);
      ctx.lineTo(points[i - 1].x, points[i - 1].y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // 5) Swallowed food: a bulge with the food inside, sliding down the body
  //    toward the tail (and fading out if the tail is cut off)
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  flows.forEach(f => {
    const pos = f.fading !== undefined ? last : Math.min(f.age * FLOW_SPEED, last);
    if (pos < 1) return;   // still under the head
    const i = Math.floor(pos), frac = pos - i;
    const a = points[i], b = points[Math.min(i + 1, last)];
    const x = a.x + (b.x - a.x) * frac;
    const y = a.y + (b.y - a.y) * frac;
    const radius = Math.max(widthAt(i) / 2, CELL * 0.3) * 1.6;
    ctx.globalAlpha = f.fading !== undefined ? Math.max(0, 1 - f.fading / FLOW_FADE) : 1;
    ctx.fillStyle = COLORS.snakeOutline;
    circle(x, y, radius + 1.5);
    ctx.fillStyle = COLORS.snakeBody;
    circle(x, y, radius);
    ctx.font = CELL * 0.75 + "px serif";
    ctx.fillStyle = "#000";
    ctx.fillText(f.emoji, x, y + 1);
    ctx.globalAlpha = 1;
  });

  // 6) Head: drawn facing right, then rotated to the direction of travel
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
