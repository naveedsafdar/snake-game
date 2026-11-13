# Snake

A classic Snake game in plain HTML, CSS and JavaScript. No install or build step needed.

## Play

Open `index.html` in any web browser.

- **Arrow keys** move the snake (the first key press starts the game)
- Eat the food (🍎 🍊 🍔 🍕 …) to grow and score points
- Hitting a wall or yourself ends the game
- **Space** restarts after game over

## Leaderboard

Players enter a name on the home screen. Every finished game is saved to a
[Supabase](https://supabase.com) database, and the home screen shows the top 5
players (best score and the date it was set) plus the total games played.

- `supabase/schema.sql` creates the tables and functions (run it once in the Supabase SQL Editor)
- `js/config.js` holds the project URL and the public (publishable) key

## Files

| File | What it does |
|---|---|
| `index.html` | Page structure: title, score, board and messages |
| `css/style.css` | Colors, layout and animations (score pop, board shake, game-over fade) |
| `js/game.js` | Game logic and drawing: the cobra, food, crash splash and eat confetti; home screen and leaderboard |
| `js/db.js` | Talks to the Supabase database |
| `js/config.js` | Supabase URL and public key |
| `supabase/schema.sql` | Database tables and functions |

To change the speed, edit `STEP_MS` at the top of `js/game.js` (lower is faster).
