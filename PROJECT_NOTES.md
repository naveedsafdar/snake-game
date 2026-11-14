# Snake Game: Project Notes

A summary of what's been built so far, how it fits together, and ideas for
next time. Last updated: 2026-11-14.

## What it is

A browser Snake game in plain HTML, CSS and JavaScript (no build step, no
framework). Open `index.html` to play. Scores and players are stored in a
Supabase database and shown as a live leaderboard.

- **Live game:** https://naveedsafdar.github.io/snake-game/ (GitHub Pages,
  published automatically from the `main` branch in about a minute)
- **Repository:** `naveedsafdar/snake-game`

## What we built, step by step

| Commit | What changed |
|---|---|
| `01ac425` Add Snake game | The core game: a cobra-style snake (hood, scales, flicking tongue, slit-pupil eyes), random emoji food, crash splash with blood stains and red flash, eat confetti and floating "+1". Split into `index.html`, `css/style.css`, `js/game.js`. |
| `3090e49` Player names, leaderboard and stats | New home screen where players enter a name. Finished games are saved to Supabase. The home screen shows the Top 5 (best score + date set) and total games played. Added `js/config.js`, `js/db.js`, `supabase/schema.sql`. |
| `d0280d1` Swipe controls for phones | Swipe to turn, tap to replay after game over. Touch devices see touch-specific hints; page no longer scrolls/zooms while swiping; home screen fits small screens. |
| `f24a03d` Keep player totals in sync | A database trigger recalculates each player's best score, its date and game count whenever a game row is inserted, edited or deleted, including hand edits in the Supabase dashboard. |
| `e80dea7` Top 5 scores | Leaderboard tried as top 5 single games (later changed back to one row per player, see "Simpler database"). |
| `f672ddc` Two foods and a cactus | One junk food (+1) and one healthy food (+2) are always on the board, each with a bright colored ring; banana removed for visibility. A cactus (−5) appears for 8 seconds each time the score passes a multiple of 5. |
| `ff02965` Fresh pair of foods | Eating either food replaces both with a fresh pair (cactus stays). |
| `254d909` Grow by points | The snake grows/shrinks by the points: healthy +2, junk +1, cactus −5. |
| `13a2506`, `ede86d6` Live-site fixes | Leaderboard code worked with both database versions during the switch; `?v=` added to CSS/JS links so browsers load new files after an update. |
| `e81a059` Simpler database | Leaderboard stays one row per player, but each player's best is now worked out from `games`. Removed from `players`: `best_score`, `best_score_at`, `games_played`, `first_seen_at`, `last_played_at`; removed the sync trigger, its 2 helper functions and the old index. One new index. Score limit stays 397. Applied in Supabase on 2026-11-14. |
| `4af21e1` Pill power-up | A blinking 💊 (blue ring) appears for 5 seconds each time the score passes a multiple of 20, on its own schedule alongside foods and cactus. Eating it shrinks the snake by 5 and keeps the score. Database score cap raised from 397 to 9999 (applied in Supabase on 2026-11-14). |
| Swallow and dissolve animations | Eaten food and cactus show as a lump with a mini emoji that the snake slides over (fades after 5 squares). Squares lost to a cactus or pill dissolve one by one from the tail tip, red or blue. |
| Flowing food, slow shrink, pill −10 | Swallowed food travels down the body to the tail and is absorbed (fades if the tail is cut off). Cactus and pill now shrink the snake for real, one square at a time over 3 seconds, with the tail glowing red/blue. Pill shrinks by 10 instead of 5. |
| Red shrink for the pill | The pill's shrink glow and sparkles are now red, the same as the cactus (its ring and popup stay blue). |

## How it works

### Files

| File | Role |
|---|---|
| `index.html` | Page layout: header (title, player, score), canvas board, and overlays (home, start, game over) |
| `css/style.css` | Colors, layout, animations (score pop, board shake, game-over fade), mobile layout |
| `js/game.js` | All game logic and drawing (~840 lines) |
| `js/db.js` | Small wrapper around Supabase RPC calls |
| `js/config.js` | Supabase project URL and **publishable** key |
| `supabase/schema.sql` | Tables, security and functions; run once in the Supabase SQL Editor (safe to re-run) |

### Game logic (`js/game.js`)

#### 1. Screens and game states

`state` moves through: `home → ready → playing → crashing → over`.

| State | What the player sees | How it moves on |
|---|---|---|
| `home` | Name box, 🏆 Top 5 leaderboard, "Games played · Players" line | Type a name (1–20 chars) and press Play / Enter → the player is registered in the database (`register_player`) and the name is remembered in the browser (`localStorage` key `snakePlayerName`) |
| `ready` | Board with the snake and foods, "Press an arrow key to start" / "Swipe to start" | The first arrow key or swipe starts the game in that direction |
| `playing` | Snake moving, live score in the header | Hitting a wall or its own body → `crashing` |
| `crashing` | Blood splash, red flash, board shake (1.2 seconds); the score is saved in the background | Automatically → `over` |
| `over` | "Game Over", final score, save status, "Press space / Tap to play again", "Back to home" | Space or tap → new game for the same player (`ready`). "Back to home" → `home` (leaderboard reloads) |

#### 2. Board and timing

- 20 × 20 squares, 20px each (400 × 400 canvas).
- The snake moves one square every `STEP_MS` (110 ms, about 9 moves a second).
  Speed never changes during a game.
- `loop()` runs every animation frame (~60 fps): it moves the snake when
  `STEP_MS` has passed, counts down the cactus timer, animates effects and redraws.
  If the browser tab is hidden the loop pauses, so the cactus timer pauses too.

#### 3. The snake

- Starts 3 squares long in the middle (head at column 10, row 10), facing right.
- Each move adds a new head in the current direction; the tail is dropped unless
  the snake is growing (see 6).
- Turning: the last arrow/swipe before a move is used for that move. Turning
  straight back into the body (e.g. right → left) is ignored.
- Crash (game over): head goes off the board, or onto any part of its own body.

#### 4. Food (always exactly 2 on the board)

| Kind | Emoji (picked at random) | Ring | Points | Snake |
|---|---|---|---|---|
| Healthy | 🍎 🍓 🍒 🍉 🍇 🍊 🥝 🍑 | Green | +2 | Grows 2 squares |
| Junk | 🍔 🍕 🍟 🌭 🍩 | Orange | +1 | Grows 1 square |

- One healthy and one junk food are on the board at all times.
- Eating **either** one replaces **both** with a fresh pair in new random spots.
- Eating shows confetti and a floating green "+2 🍎" / "+1 🍔"; the score number pops.
- **Swallow animation:** the eaten food travels down the body as a bulge with the
  emoji inside, sliding smoothly from head to tail at `FLOW_SPEED` (25 squares a
  second, so about 1 second for a 25-square snake). At the tail it's absorbed
  with a small puff. Several foods can travel at once. If the tail is shrinking
  when a food reaches it (cactus or pill), that food fades out instead.

#### 5. Cactus 🌵

- Appears when the score **passes a multiple of 5** (5, 10, 15, …). Because
  healthy food is worth 2, the score can jump past (e.g. 4 → 6); that counts.
  It's checked after eating food: `floor(score / 5)` went up → spawn a cactus.
- Only one cactus at a time. Never placed within 2 squares of the snake's head.
- Stays **8 seconds** (`CACTUS_SECONDS`), blinking during the last 2, then vanishes.
- It does **not** move when food is eaten.
- Eating it: **−5 points** at once, and the snake **shrinks 5 squares over
  3 seconds** (see 6); green prickle
  burst, red floating "−5 🌵", small board jolt. The game continues.
- The cactus travels down the body like food (a 🌵 in a bulge), and the tail
  glows **red** while it shrinks.
- If the score drops (e.g. 10 → 5), passing 10 again spawns another cactus.

#### 5b. Pill 💊

- Appears when the score **passes a multiple of 20** (20, 40, 60, …), on its own
  schedule: it comes **in addition** to the foods and the cactus, which carry on
  as normal. At 20, 40, … a cactus and a pill can both appear.
- Only one pill at a time. Never placed within 2 squares of the snake's head.
- **Blinks the whole time** it's on the board, on a blue ring. Stays **5 seconds**
  (`PILL_SECONDS`), then vanishes. It does not move when food is eaten.
- Eating it: the snake **shrinks 10 squares over 3 seconds** (`PILL_SHRINK`,
  see 6), the **score stays the same**; blue sparkle burst and a blue floating
  "−10 🐍 💊". The tail glows **red** while it shrinks (same effect as the cactus).
- If the score drops below a multiple of 20 (via a cactus) and passes it again,
  another pill appears.

#### 6. Growing and shrinking

- Food grows the snake by its points: healthy +2, junk +1. A cactus shrinks it
  by 5 (and takes 5 points); a pill shrinks it by 10 with no change to the score.
- `growPending` holds squares still to grow: each move with `growPending > 0`
  keeps the tail (length +1) instead of dropping it, so +2 shows over 2 moves.
- **Shrinking is real and gradual** (`shrink`, `startShrink`, `updateTimers`):
  the squares come off the tail one at a time, evenly over `SHRINK_SECONDS`
  (3 seconds). Pill: one every 0.3s; cactus: one every 0.6s. The tail you see
  is the real snake, so you can still crash into it until it's gone.
- **Shrink animation** (same for cactus and pill): while shrinking, the end of
  the tail glows and pulses red, the tip slides
  in smoothly toward the next square, and a few sparkles pop as each square goes.
- Growing and shrinking are independent: food eaten during a shrink still grows
  the snake, and a second cactus/pill adds to the shrink (the remaining squares
  are spread over a fresh 3 seconds).
- The snake never gets shorter than 3 squares (`MIN_LENGTH`).

#### 7. Score

- Starts at 0, never goes below 0 (a cactus at 3 points → 0).
- No fixed maximum: the pill shrinks the snake without lowering the score, so
  the board size no longer limits the score. The database accepts 0–9999
  (a safety cap against bad data).

#### 8. Where things are placed

- Foods, the cactus and the pill go on a random **empty** square: not on the snake and
  not on another item.
- If there's no empty square, a food is skipped and tried again after the
  next move; a cactus or pill is simply skipped.

#### 9. Saving the score (game over)

- On a crash, `submit_score` saves the game. The game-over screen shows:
  "Saving score…" → "Score saved ✓", or "🎉 New personal best!" (higher than all
  of the player's earlier games; a first game always counts), or
  "Couldn't save your score." if the database can't be reached.
- With no database configured, the game plays normally and nothing is shown.

#### 10. Controls

| Action | Keyboard | Phone / tablet |
|---|---|---|
| Start and turn | Arrow keys | Swipe anywhere (24px minimum; one long swipe can make several turns) |
| Play again | Space | Tap |
| Back to home | "Back to home" button | Same |

On touch screens the hints change to "Swipe to start" / "Tap to play again",
the page doesn't scroll or zoom while swiping, and the name box doesn't
auto-focus (so the keyboard doesn't cover the leaderboard).

#### 11. Settings at the top of `js/game.js`

| Setting | Value | Meaning |
|---|---|---|
| `CELL`, `COLS`, `ROWS` | 20, 20, 20 | Square size in px, board size |
| `STEP_MS` | 110 | Time between moves (lower = faster) |
| `ITEMS` | — | Each kind's emojis, points (= growth) and ring color |
| `CACTUS_EVERY` | 5 | Cactus appears each time the score passes a multiple of this |
| `CACTUS_SECONDS` | 8 | How long a cactus stays |
| `PILL_EVERY` | 20 | Pill appears each time the score passes a multiple of this |
| `PILL_SECONDS` | 5 | How long a pill stays |
| `PILL_SHRINK` | 10 | Squares the snake loses when it eats a pill |
| `MIN_LENGTH` | 3 | Shortest the snake can get |
| `SHRINK_SECONDS` | 3 | A cactus or pill shrinks the snake gradually over this long |
| `FLOW_SPEED` | 25 | Squares per second a swallowed food travels down the body |
| `FLOW_FADE` | 0.3 | Seconds a swallowed food takes to fade if the tail is cut off |
| `SWIPE_MIN` | 24 | Pixels a finger must move to count as a swipe |

The database score cap (9999) is in `supabase/schema.sql`, in two places:
the `games_score_check` rule and `submit_score`.

#### 12. Main functions (where to look)

| Function | Does |
|---|---|
| `resetGame()` | New snake, score 0, fresh foods, no cactus or pill, state `ready` |
| `step()` | One move: crash check, eating, growing/shrinking, cactus/pill spawn, refill foods |
| `placeItem(kind)` / `refillFoods()` | Random empty square for a food, cactus or pill |
| `changeScore(points)` | Adds points, floors at 0, updates the header |
| `passed(before, after, every)` | Did the score pass a multiple of 5 / 20? |
| `updateTimers(dt)` | Cactus and pill countdowns |
| `crash()` / `showGameOver()` | Splash effects, save score, game-over screen |
| `celebrate()` / `ouch()` / `healed()` | Effects for eating food / a cactus / a pill |
| `startShrink(squares, color)` | Starts a gradual 3-second shrink |
| `showHome()` / `loadLeaderboard()` | Home screen and Top 5 table |
| `saveScore()` / `updateSaveStatus()` | Save to the database and show the result |
| `loop()` / `draw()` / `drawItem()` / `drawSnake()` | Animation and drawing (`drawSnake` also draws the travelling food and the shrink glow) |
| `turn()` + key/touch handlers | Controls |

### Database (Supabase)

- **Tables:** `players` (`id`, `name`, and `name_key`: the name lowercased and
  trimmed, unique) and `games` (`id`, `player_id`, `score`, `played_at`; the
  only place scores are kept). No triggers.
- **Security:** Row Level Security is on with **no policies**, so the public
  key can't touch tables directly. The page can only call four
  `security definer` functions:
  - `register_player(name)` → player id (creates or finds the player)
  - `submit_score(player_id, score)` → true if new personal best (checked against the player's past games)
  - `get_leaderboard(limit)` → top players, one row each: best score and the date it was set, worked out from `games` (ties go to whoever got there first)
  - `get_stats()` → total games and players
- **Index:** `games_player_best_idx` on `games (player_id, score desc, played_at)`
  serves both the leaderboard and the personal-best check.
- If the database isn't configured or reachable, every `Database.*` call
  returns `null` and the game still plays, just without saving.

### Versions (how to go back)

| Version | Commit | What it is |
|---|---|---|
| `v1.0` | `6ff09e7` | Two foods, cactus, pill (−5), swallow lump and tail dissolve animations (before flowing food and slow shrink) |

- To look at an old version: on GitHub open the commit (e.g. `6ff09e7`) and
  click "Browse files".
- To put the live game back to a version: ask Claude to **revert** `main` to
  that commit (adds an "undo" commit, keeps history). GitHub Pages republishes
  within a minute.
- The `v1.0` git tag couldn't be pushed from the cloud session. To add it on
  GitHub: Releases → "Draft a new release" → tag `v1.0`, target commit `6ff09e7`.
- Database changes (SQL run in Supabase) are not undone by going back in git.

### Key facts to remember

- The key in `js/config.js` is the publishable key, which is meant to be
  public. Never commit the secret / `service_role` key.
- After changing `supabase/schema.sql`, re-run the whole file in the
  Supabase SQL Editor for it to take effect.
- After changing any CSS/JS file, bump the `?v=` number on the links in
  `index.html`, or browsers may keep running the old cached files.
- Supabase JS is loaded from jsDelivr, pinned to `@supabase/supabase-js@2.45.4`.

## Ideas for next time

- Difficulty levels or gradual speed-up as the score rises
- Pause (P key / tap button)
- Sound effects with a mute toggle
- Show the player's own rank / personal best on the home screen
- Basic anti-cheat: scores are currently trusted from the browser (only range-checked)
