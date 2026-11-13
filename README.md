# Snake

A classic Snake game in plain HTML, CSS and JavaScript. No install or build step needed.

## Play

Open `index.html` in any web browser.

- **Arrow keys** move the snake (the first key press starts the game)
- Eat the food (🍎 🍊 🍔 🍕 …) to grow and score points
- Hitting a wall or yourself ends the game
- **Space** restarts after game over

## Files

| File | What it does |
|---|---|
| `index.html` | Page structure: title, score, board and messages |
| `css/style.css` | Colors, layout and animations (score pop, board shake, game-over fade) |
| `js/game.js` | Game logic and drawing: the cobra, food, crash splash and eat confetti |

To change the speed, edit `STEP_MS` at the top of `js/game.js` (lower is faster).
