# Snake

A classic Snake game in plain HTML, CSS and JavaScript. No install or build step needed.

## Play

Open `index.html` in any web browser.

- **Arrow keys** (or **swipe** on a phone) move the snake; the first move starts the game
- Two foods are always on the board; eating either one makes you grow, and
  both are then replaced by a fresh pair in new spots:
  - **Healthy** (🍎 🍓 🍒 🍉 🍇 🍊 🥝 🍑, green ring): **+2 points**, grows 2 squares
  - **Junk** (🍔 🍕 🍟 🌭 🍩, orange ring): **+1 point**, grows 1 square
- Each time your score passes a multiple of 5, a **cactus** 🌵 (red ring)
  appears for 8 seconds. Eating it costs **5 points** and shrinks the snake
  by 5 squares over 3 seconds (the score never goes below 0, the snake never
  below 3 squares)
- Each time your score passes a multiple of 20, a blinking **pill** 💊 (blue
  ring) appears for 5 seconds. Eating it shrinks the snake by 10 squares over 3 seconds and
  **keeps your score** (it comes on its own schedule, on top of the foods and cactus)
- Hitting a wall or yourself ends the game
- **Space** (or **tap** on a phone) plays again after game over

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
| `js/game.js` | Game logic and drawing: the cobra, food, crash splash, eat confetti, food travelling down the body and the shrinking tail; home screen and leaderboard |
| `js/db.js` | Talks to the Supabase database |
| `js/config.js` | Supabase URL and public key |
| `supabase/schema.sql` | Database tables and functions |

To change the speed, edit `STEP_MS` at the top of `js/game.js` (lower is faster).
The foods, their points, and the cactus and pill rules (`CACTUS_*`, `PILL_*`)
are set just below it. Food and the cactus grow or shrink the snake by the same
number as their points.
