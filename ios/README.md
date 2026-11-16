# Snake on iPhone

This folder is an iPhone app that runs the Snake game full screen, with its own
icon, short vibrations when you eat or crash, and no internet needed to play.
Scores and the leaderboard still use the internet, like the web version.

It's for trying the game on **your own iPhone**. A free Apple ID is enough.

## What's in here

| File | What it is |
|---|---|
| `Snake.xcodeproj` | The Xcode project. Double-click it to open |
| `Snake/SnakeApp.swift` | The app itself: a full-screen web view that runs the game, plus vibrations |
| `Snake/game.html` | The whole game packed into one file (made by `build_web.py`) |
| `Snake/supabase.js` | The leaderboard library, so the app doesn't download it at launch |
| `Snake/Assets.xcassets` | The app icon |
| `build_web.py` | Packs the game from the main folder into `Snake/game.html` |
| `vendor/` | The original copy of the leaderboard library |

## First time: put the app on your iPhone

You need a Mac with **Xcode** (free in the Mac App Store), your **iPhone**, and
a **cable**.

### 1. Get the code onto your Mac
- On GitHub, open the repository, choose the branch the app is on, then
  **Code → Download ZIP**, and unzip it.
- (Or, if you use git: `git clone` the repository.)

### 2. Open the project
- In the unzipped folder, open `ios` and double-click **`Snake.xcodeproj`**.
  Xcode opens.

### 3. Sign in with your Apple ID (once)
- Xcode menu → **Settings… → Accounts** → **+** → **Apple ID**, and sign in.

### 4. Choose your "team"
- In the left sidebar, click the blue **Snake** project at the top.
- Under **TARGETS**, click **Snake**, then the **Signing & Capabilities** tab.
- Make sure **Automatically manage signing** is ticked.
- **Team**: choose your name, e.g. "Your Name (Personal Team)".
- If you see a red error about the **Bundle Identifier** (it has to be unique
  in the world), change `com.naveedsafdar.snake` to something only you would
  use, e.g. `com.yourname.snakegame`.

### 5. Try it on the computer first (optional, no iPhone needed)
- At the top of Xcode, next to the ▶︎ button, click the device name and pick
  any **iPhone simulator** (e.g. "iPhone 16").
- Press **▶︎** (or ⌘R). A virtual iPhone opens and runs the game.
  Use the mouse to swipe. (There's no vibration in the simulator.)

### 6. Run it on your iPhone
1. Plug the iPhone into the Mac. On the iPhone tap **Trust** and enter your passcode.
2. In Xcode, click the device name next to ▶︎ and pick **your iPhone**.
3. The first time, Xcode may say the iPhone needs **Developer Mode**:
   on the iPhone go to **Settings → Privacy & Security → Developer Mode**,
   turn it on, and let the iPhone restart.
4. Press **▶︎**. Xcode builds the app and installs it.
5. The first time, the iPhone may refuse to open it ("Untrusted Developer"):
   on the iPhone go to **Settings → General → VPN & Device Management**,
   tap your Apple ID, then **Trust**. Open the Snake app again.

The **Snake** app is now on your home screen with the cobra icon. 🐍

### Good to know
- **Free Apple ID: the app stops opening after 7 days.** Plug the iPhone in
  and press ▶︎ in Xcode again; that renews it for another 7 days.
  (A paid Apple Developer account removes this limit.)
- After the first time you can unplug the cable: Xcode can install over
  Wi-Fi when the iPhone and Mac are on the same network
  (Window → Devices and Simulators → tick "Connect via network").

## After changing the game

The app uses its own copy of the game (`Snake/game.html`). After a change to
the game (`index.html`, `css/`, `js/` in the main folder):

1. In Terminal, in the repository folder, run:
   ```
   python3 ios/build_web.py
   ```
2. Press **▶︎** in Xcode again.

## How it works

- `SnakeApp.swift` opens `game.html` in a full-screen web view (the same engine
  Safari uses, without any browser buttons), portrait only, with no zoom or
  bounce. The page keeps clear of the notch and home bar.
- The game asks for vibrations with
  `window.webkit.messageHandlers.haptic.postMessage("eat" | "shrink" | "crash")`
  (see `buzz()` in `js/game.js`). The app turns them into a light tap (eating),
  a medium tap (cactus or pill) and an error buzz (crash). In a normal web
  browser `buzz()` does nothing.
- The leaderboard talks to the same Supabase database as the web version.

## If something goes wrong

- **"No account for team" / "Signing requires a development team"**: do step 4.
- **"Failed to register bundle identifier"**: change the Bundle Identifier (step 4).
- **"iPhone is not available" / "Developer Mode disabled"**: step 6.3.
- **"Untrusted Developer" on the iPhone**: step 6.5.
- **The leaderboard says "Couldn't load the leaderboard."**: the iPhone has no
  internet, or the database can't be reached. The game still plays; scores just
  aren't saved. If it happens even with internet, tell Claude what you see.
- Anything else: copy the red error from Xcode (click it in the left sidebar's
  ⚠︎ tab) and ask Claude.
