# Snake

A classic Snake game in plain HTML, CSS and JavaScript. No install or build step needed.

## Play

Open `index.html` in any web browser.

- **Arrow keys** (or **swipe** on a phone) move the snake; the first move starts the game
- Two foods are always on the board; eating either one makes you grow:
  - **Healthy** (🍎 🍓 🍒 🍉 🍇 🍊 🥝 🍑, green ring): **+2 points**
  - **Junk** (🍔 🍕 🍟 🌭 🍩, orange ring): **+1 point**
- Each time your score passes a multiple of 5, a **cactus** 🌵 (red ring)
  appears for 8 seconds. Eating it costs **5 points** and shrinks the snake
  by 2 squares (the score never goes below 0)
- Hitting a wall or yourself ends the game
- **Space** (or **tap** on a phone) plays again after game over

## Leaderboard

Players enter a name on the home screen. Every finished game is saved to a
[Supabase](https://supabase.com) database, and the home screen shows the top 5
scores (a player can appear more than once, with the date each was set)
plus the total games played.

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
The foods, their points and the cactus rules (`CACTUS_EVERY`, `CACTUS_SECONDS`,
`CACTUS_SHRINK`) are set just below it.
