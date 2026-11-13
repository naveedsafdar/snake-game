# Snake Game: Project Notes

A summary of what's been built so far, how it fits together, and ideas for
next time. Last updated: 2026-11-13.

## What it is

A browser Snake game in plain HTML, CSS and JavaScript (no build step, no
framework). Open `index.html` to play. Scores and players are stored in a
Supabase database and shown as a live leaderboard.

## What we built, step by step

| Commit | What changed |
|---|---|
| `01ac425` Add Snake game | The core game: a cobra-style snake (hood, scales, flicking tongue, slit-pupil eyes), random emoji food, crash splash with blood stains and red flash, eat confetti and floating "+1". Split into `index.html`, `css/style.css`, `js/game.js`. |
| `3090e49` Player names, leaderboard and stats | New home screen where players enter a name. Finished games are saved to Supabase. The home screen shows the Top 5 (best score + date set) and total games played. Added `js/config.js`, `js/db.js`, `supabase/schema.sql`. |
| `d0280d1` Swipe controls for phones | Swipe to turn, tap to replay after game over. Touch devices see touch-specific hints; page no longer scrolls/zooms while swiping; home screen fits small screens. |
| `f24a03d` Keep player totals in sync | A database trigger recalculates each player's best score, its date and game count whenever a game row is inserted, edited or deleted, including hand edits in the Supabase dashboard. |

## How it works

### Files

| File | Role |
|---|---|
| `index.html` | Page layout: header (title, player, score), canvas board, and overlays (home, start, game over) |
| `css/style.css` | Colors, layout, animations (score pop, board shake, game-over fade), mobile layout |
| `js/game.js` | All game logic and drawing (~730 lines) |
| `js/db.js` | Small wrapper around Supabase RPC calls |
| `js/config.js` | Supabase project URL and **publishable** key |
| `supabase/schema.sql` | Tables, security, functions and trigger; run once in the Supabase SQL Editor (safe to re-run) |

### Game (`js/game.js`)

- Grid: 20×20 cells of 20px (400×400 canvas). Speed: `STEP_MS = 110` (lower = faster).
- State flow: `home → ready → playing → crashing → over`.
- `loop()` runs every animation frame; the snake moves only every `STEP_MS`,
  while effects (particles, splats, popups, flash) animate every frame.
- Input: arrow keys or swipe (`SWIPE_MIN = 24px`); a long swipe can make
  several turns. Reversing into the body is blocked. Space or tap replays.
- The player's name is remembered in the browser (`saveName` / `loadSavedName`).
- Max score is 397 (a full board minus the starting snake).

### Database (Supabase)

- **Tables:** `players` (name, case/space-insensitive unique `name_key`,
  best score + date, games played) and `games` (one row per finished game).
- **Security:** Row Level Security is on with **no policies**, so the public
  key can't touch tables directly. The page can only call four
  `security definer` functions:
  - `register_player(name)` → player id (creates or finds the player)
  - `submit_score(player_id, score)` → true if new personal best
  - `get_leaderboard(limit)` → top players (ties go to whoever got there first)
  - `get_stats()` → total games and players
- **Trigger:** `games_changed` calls `refresh_player_stats()` after any
  insert/update/delete on `games`, so `games` is the source of truth.
  These two internal functions are revoked from the public roles.
- If the database isn't configured or reachable, every `Database.*` call
  returns `null` and the game still plays, just without saving.

### Key facts to remember

- The key in `js/config.js` is the publishable key, which is meant to be
  public. Never commit the secret / `service_role` key.
- After changing `supabase/schema.sql`, re-run the whole file in the
  Supabase SQL Editor for it to take effect.
- Supabase JS is loaded from jsDelivr, pinned to `@supabase/supabase-js@2.45.4`.

## Ideas for next time

- Difficulty levels or gradual speed-up as the score rises
- Pause (P key / tap button)
- Sound effects with a mute toggle
- Show the player's own rank / personal best on the home screen
- Host it (e.g. GitHub Pages) so others can play from a link
- Basic anti-cheat: scores are currently trusted from the browser (only range-checked)
