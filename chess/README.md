# ♞ Chess Arena: AAA Edition

A chess app built with **React 19, Vite 8 and strict TypeScript**, styled with **Tailwind CSS v4**. Rules come from **chess.js**, the board is **react-chessboard**, and the engine is **Stockfish 19** (WASM in Web Workers). It's built mobile-first and is set up to be wrapped as a native iOS/Android app with **Capacitor**.

- No `any` types.
- No audio files, because every sound is synthesised at runtime.
- Works offline once loaded, apart from the Google Fonts stylesheet.

---

## What's new in 3.0: the mobile update

| Feature | Where | Notes |
|---|---|---|
| **One-handed portrait mode** | Settings → General, or Game menu | The status, your clock, your player bar and the Undo / New / Moves / Menu buttons sit in a **thumb dock** at the bottom. The board takes the largest square the remaining space allows, so it never overlaps the dock, even on an iPhone SE. The mode only applies to phones in portrait. |
| **Swipe gestures** | Player bars, status card and thumb dock | **← Undo · → Flip · ↑ Moves & analysis · ↓ Menu.** Gestures are never read on the board itself, so piece drags stay precise. A tutorial shows on first run, and a confirmation chip plus sound and haptic confirm each gesture. |
| **Haptics on every interaction** | Board, rewards, gestures | Piece pickup (tap-select or drag start), drop, capture and check alerts each fire a haptic. Native builds use `@capacitor/haptics`; the browser falls back to the Vibration API. |
| **Haptics settings panel** | Settings → Haptics | A master switch and **5 channels**: pickup, drop, capture, check and interface. Each can be set to Off / Light / Medium / Heavy, with Test buttons and Subtle / Balanced / Strong presets. |
| **Audio settings panel** | Settings → Audio | A master volume plus **3 tracks** (game effects, ambient soundtrack, interface & rewards), each with its own switch and volume. You can override the piece **sound material** (match theme / wood / marble / metal / synth / soft) and preview the cues. |
| **OLED Deep Black theme** | Shop / Settings → Display (free) | True `#000` surfaces. Blur is replaced with hairline borders, which also saves GPU, and black pieces get a rim light so they stay visible. The status-bar `theme-color` follows the theme. |
| **Notch & Dynamic Island spacing** | Global | `viewport-fit=cover` with `env(safe-area-inset-*)` on the header, dock, bottom nav and sheets, including left/right insets in landscape. Landscape phones get a **side navigation rail**, with the player bars moved next to the board. |
| **Daily quests** | Quests tab | 3 quests a day, chosen the same way on every device from a pool of 16, with no two on the same metric. Examples: "Win a match against the AI", "Solve 2 puzzles", "Capture 5 pieces". Rewards are claimed by tapping, completing all three opens a **daily chest** (+75), and the tab shows a badge for unclaimed rewards. |
| **Blitz Arena: Time Rush** | Rush tab | Arcade mode against a countdown that only runs on your turn. **Score per move = base × quality × speed (up to ×3) × combo (up to ×3) × round.** Strong moves add time, blunders cost time and reset the combo. Checkmating the AI starts the next round (+30 s, stronger opponent). High scores, coins and quests are all tracked. |

New achievements: **Rush Hour** (score 5,000 points in a run), **Arcade Legend** (score 20,000) and **Questor** (complete every daily quest in one day).

---

## Feature overview

### 1. Visuals & aesthetics

**Dynamic themes engine.** Six board themes switch instantly with no reload:

| Theme | Sound set | Price |
|---|---|---|
| Classic Wood | wood | free |
| Minimalist | soft | free |
| OLED Deep Black | soft | free |
| Obsidian Marble | marble | 200 coins |
| Cyberpunk Neon | synth | 400 coins |
| Royal Gold | metal | 750 coins |

Each theme sets the square textures, frame, highlight colours, app accent colours, background, particle colours and sound material.

There are also four piece styles: Staunton, Obsidian, Neon Hologram and Gilded. These are the board's SVG pieces re-coloured and given glow filters.

**Cinematic effects:**
- Canvas confetti bursts with sparkles on victory, checkmate and solved puzzles.
- Holographic "CHECK", "CHECKMATE", "STALEMATE" and "TIME!" text appears over the board.
- Legal moves and last moves get themed glow highlights.
- Engine avatars have a shimmer scan line.

**Advantage (eval) bar.** A live Stockfish evaluation on a separate analysis worker, debounced and cached. It shows `+1.3` or `M3` style scores and follows the time machine.

**Animated avatars.** Each player's avatar reacts to the game:
- **Mood:** calm, confident, dominating, worried, desperate, thinking.
- **Pressure:** in check, time trouble.
- **Result:** victory, defeat, draw.

Moods come from the evaluation, check status and clocks.

**Responsive and safe areas:**
- Uses `viewport-fit=cover` and `env(safe-area-inset-*)`.
- Phones get a bottom tab bar; desktop gets a header nav.
- Dialogs open as bottom sheets on phones.
- Layout uses `dvh` units, so landscape and portrait both work.

### 2. Audio & feedback

- **Procedural sound engine** (`src/audio/`), built on one AudioContext with:
  - SFX and music buses
  - a compressor
  - a synthetic convolution reverb
- **Material-specific piece sounds:**

  | Material | How it's made |
  |---|---|
  | Wood | Filtered noise knock plus a low thump |
  | Marble | Bright stone click plus a ringing partial |
  | Metal | Inharmonic struck-bar partials |
  | Synth | Neon blip |
  | Soft | Minimalist sine click |

  Captures, castling and promotions each have their own sound. Pitch varies slightly from hit to hit so repeats sound natural.
- **Adaptive ambient soundtrack:** generative pad chords and sparse bells. A tension value, driven by the eval swing, checks and low time, switches to a minor progression, opens the filter and adds more bells.
- **Fanfares** for victory, defeat, stalemate/draw and timeout, plus sounds for check, achievements, coins, puzzles and low-time ticks.
- **Haptics:** uses the native Taptic Engine or vibrator through `@capacitor/haptics`, and falls back to the Vibration API on the web.
- **Master volume and toggles:** a master volume slider, and separate SFX, music and haptics switches. A mute button in the header turns off sound effects and music together.

### 3. AI & gameplay

**AI personalities**, each combined with four difficulty levels:
- Balanced
- Aggressive Attacker
- Defensive Wall
- Tactical Master
- Positional Grandmaster

How move choice works:
1. Stockfish returns several candidate lines (MultiPV 4).
2. Every move within a centipawn window of the best (wider at lower levels) is re-scored on style. The style features are:
   - checks and captures
   - pressure on the enemy king and how far pieces advance
   - king shelter and castling
   - trades
   - centre control and development
   - quiet moves and early queen moves
3. Forced mates are never passed up.

The code is in `src/engine/personalities.ts`.

**Post-game analysis and blunder check:**
- Every position is evaluated, then each move is classified as **Brilliant / Best / Excellent / Good / Book / Forced / Inaccuracy / Mistake / Blunder**. This uses Lichess-style win-chance loss and checks whether a Brilliant move was a real sacrifice.
- You get per-side accuracy and an interactive evaluation graph you can click to jump.
- A "key moments" strip lets you jump to the important moves.
- When reviewing a position, an arrow shows the engine's best move, along with "best was …" hints.

**Opening explorer:**
- 189 ECO-coded lines.
- Matched by position, so transpositions are recognised too.
- A notification pops up live when a new opening is reached.
- The current opening is shown in the status card.

**Time machine:**
- A scrubber slider and first / previous / play / next / last controls.
- Auto-replay, plus `← → Home End` keys.
- Click any move or any point on the eval graph to jump there.
- The board, captured pieces and eval all follow the selected move.

**Chess clocks:**
- Presets: Bullet 1+0 and 2+1, Blitz 3+2 and 5+3, Rapid 10+5 and 15+10, Classical 30+20.
- A **custom Fischer** control: 1 to 90 minutes, plus a 0 to 30 s increment.
- The clock doesn't drift, because it measures `performance.now()`.
- Undo restores the clock times.
- Clocks pause when the app is in the background or you switch tabs.
- A flag against a side with no mating material is scored as a draw.

### 4. Progression & meta

- **Elo rating and profile card:**
  - Standard Elo against each difficulty's nominal rating (800 / 1400 / 2000 / 2600). K = 40 for your first 30 games, then 20.
  - Taking a move back makes the game **casual** (unrated).
  - Rank titles, peak rating and an Elo history graph.
  - A win/draw/loss donut chart, streaks and wins per difficulty.
- **Achievements:** 23 trophies in four tiers (bronze to platinum), each paying coins. Examples:
  - First Blood
  - Checkmate in 10
  - Speed Demon
  - Slayer of Expert AI
  - Knightmare
  - Comeback Kid
  - Mind Reader
  - On Fire

  Unlocking one shows a popup with a sound.
- **Cosmetics shop:** spend coins earned from wins (15 to 120 by difficulty), daily puzzles and achievements on board themes and piece styles. Buying something equips it immediately.
- **Daily puzzles:**
  - 3 per day (mate-in-2, mate-in-2, mate-in-3), refreshing at local midnight.
  - Streaks and a practice library.
  - Two-level hints, a step-by-step solution, and a "wrong move" shake.
  - On the final move, any checkmate is accepted.
  - All **120 puzzles are generated and verified by Stockfish** (`scripts/generate-puzzles.mjs`), so every one is a forced mate with a single correct first move.
- **PGN and export:**
  - Full PGN with the Event, Date, players, Result, TimeControl and Opening headers.
  - Saved in match history: the last 60 games, each with Review, Copy and Download.
  - Export uses the native share sheet when available, otherwise it downloads the file.
  - "Share" builds a text summary of the result, opening, accuracy and rating change.

### 5. Mobile & Capacitor readiness

**Touch:** drag-and-drop and tap-to-select both work. The board captures touch gestures, and pull-to-refresh, double-tap zoom and long-press callouts are disabled.

**Performance and battery saver:**
- **Stockfish workers:** two pooled, reference-counted workers (play and analysis). A worker is terminated after it has been idle for a while (45 s, or 10 s in battery saver).
- **Background behaviour:** searches stop and audio is suspended while the app is in the background.
- **Battery saver mode** (manual, or automatic below 20% battery where the Battery API exists):
  - removes backdrop blur, glow filters, particles, holograms and looping animations
  - stops the music
  - slows the clock tick to 250 ms
  - uses shallower engine analysis
- **Idle throttling:** after 45 s without input, decorative animation loops pause.
- **Render loops:** the confetti `requestAnimationFrame` loop only exists while a burst is playing.
- **Code splitting:** the Puzzles, Profile and Shop screens are code-split.

---

## 1. Project structure

```
chess/
├── capacitor.config.ts            # Capacitor native shell config
├── index.html                     # viewport-fit=cover, PWA / iOS meta, fonts
├── package.json
├── scripts/
│   ├── copy-stockfish.mjs         # postinstall: Stockfish WASM → public/stockfish
│   ├── generate-puzzles.mjs       # Stockfish self-play → verified mate puzzles
│   └── validate-data.mjs          # checks every opening line and puzzle solution
├── public/
│   ├── favicon.svg
│   └── stockfish/                 # (generated, git-ignored) engine .js + .wasm
└── src/
    ├── main.tsx · App.tsx         # app shell, navigation, lazy views
    ├── audio/                     # procedural audio engine
    │   ├── AudioEngine.ts         #   context, buses, reverb, unlock/suspend
    │   ├── synth.ts               #   tone / noise voice primitives
    │   ├── pieceSounds.ts         #   wood · marble · metal · synth · soft impacts
    │   ├── fanfares.ts            #   victory, defeat, draw, timeout, check…
    │   ├── ambientMusic.ts        #   adaptive generative soundtrack
    │   ├── haptics.ts             #   per-channel intensities · Capacitor Haptics / Vibration API
    │   └── index.ts               #   high-level `sfx` facade
    ├── engine/                    # Stockfish integration
    │   ├── StockfishEngine.ts     #   serialized UCI client with MultiPV parsing
    │   ├── enginePool.ts          #   ref-counted worker pool (play / analysis)
    │   ├── personalities.ts       #   style-weighted move selection
    │   ├── analysis.ts            #   move classification & accuracy
    │   ├── scoring.ts             #   win chance, eval formatting
    │   └── evalCache.ts           #   shared LRU evaluation cache
    ├── hooks/
    │   ├── useGameController.ts   #   orchestrates game, AI, clock, eval, analysis, rewards
    │   ├── useChessGame.ts        #   chess.js owner exposing immutable snapshots
    │   ├── useAiOpponent.ts · useEngine.ts · useEvaluation.ts · useGameAnalysis.ts
    │   ├── useChessClock.ts · useTimeMachine.ts · usePuzzleSession.ts
    │   ├── useTimeRush.ts         #   Time Rush arcade loop (countdown, grading, rounds)
    │   ├── useSwipeGesture.ts     #   pointer-based swipe recogniser
    │   ├── useLayoutMode.ts · useMediaQuery.ts   # one-handed / desktop / orientation
    │   ├── useAppEnvironment.ts   #   theme vars, audio sync, visibility, idle, battery
    │   └── useStore.ts            #   useSyncExternalStore binding
    ├── stores/                    # persisted state (localStorage, sanitised on load)
    │   ├── settingsStore.ts · profileStore.ts · toastStore.ts
    │   └── questActions.ts        #   feeds game events into daily quests
    ├── components/
    │   ├── board/                 #   ChessBoard, EvalBar, BoardHologram, PromotionDialog
    │   ├── game/                  #   PlayerBar, PlayerAvatar, ChessClock, TimeMachine, MoveHistory,
    │   │                          #   ThumbDock (one-handed), GameMenuSheet
    │   ├── rush/                  #   RushHud, ScorePopups
    │   ├── quests/                #   QuestCard
    │   ├── settings/              #   AudioPanel (mixer), HapticsPanel (channels)
    │   ├── analysis/              #   AnalysisPanel, EvalGraph, ClassificationBadge
    │   ├── modals/                #   NewGame, GameOver, Settings
    │   ├── profile/ · shop/       #   EloChart, AchievementGrid, MatchHistory, ThemeSwatch
    │   ├── effects/               #   ConfettiCanvas
    │   ├── layout/                #   AppHeader, BottomNav
    │   └── ui/                    #   Modal, Button, Toggle, ToastViewport, PieceIcon, GestureGuide, SwipeFeedback…
    ├── views/                     # PlayView · RushView · PuzzlesView · QuestsView · ProfileView · ShopView
    ├── constants/                 # difficulty/personality tuning, themes, achievements, economy, quests, rush
    ├── data/                      # openings.ts (189 lines) · puzzles.ts (120 verified mates)
    ├── types/                     # chess, engine, analysis, theme, profile, settings, puzzle, quest, rush, ui
    ├── utils/                     # chess helpers, progression (Elo/coins/achievements),
    │                              # quests (daily selection/claims), rushScoring, status,
    │                              # openings, puzzles, share/export, store, validation, mood
    └── styles/                    # index.css (Tailwind v4 theme, OLED, `short` landscape variant, battery saver) · animations.css
```

### Architecture notes

- **Single source of truth for the board.** `useChessGame` keeps the mutable chess.js instance in a ref and gives React only immutable snapshots. Every component renders from a FEN.
- **Game events are handled where they happen.** Game end, rewards, Elo and achievements are processed in the callbacks that end a game (a move, a flag, a resign), not in effects. That makes them fire exactly once, even under StrictMode.
- **Global state** (settings, profile, toasts) lives in small external stores read through `useSyncExternalStore`:
  - Changes are saved to localStorage with a short delay, and saved immediately when the app goes to the background (Capacitor can kill it after that).
  - Everything read back from storage is checked and cleaned by type guards, so corrupted data can't crash the app.
- **Progression logic is pure** (`utils/progression.ts`). It is plain input → output functions with no UI, so it's easy to test or move to a server later.
- **AI and evaluation use separate workers**, so the eval bar never slows down the opponent. Engine replies for a position that's no longer on the board are dropped, for example after Undo.

---

## 2. Setup & running locally

**Prerequisites:** Node.js 20.19+ or 22.12+ (required by Vite 8) and npm 10+.

```bash
cd chess
npm install            # also copies Stockfish (lite, single-threaded WASM) into public/stockfish
npm run dev            # http://localhost:5173 — the "Network" URL works on your phone
```

| Script | What it does |
|---|---|
| `npm run build` | Strict type-check + production build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run check` | Typecheck + lint (oxlint) + validate openings & puzzles |
| `npm run validate:data` | Replay every opening line and puzzle solution |
| `npm run generate:puzzles` | Regenerate 120 verified puzzles (takes a few minutes; overwrites `src/data/puzzles.ts`) |

Tailwind v4 needs no `tailwind.config.js`. Runtime theme colours are exposed as `--accent` and `--accent-2` and used through the `accent` utilities (for example `bg-accent/20`).

The Stockfish build is the **lite single-threaded** one (about 1.8 MB). It needs no COOP/COEP headers, so it runs on any static host and inside iOS/Android WebViews unchanged.

### Testing the mobile features locally

**Phone-sized layouts in a desktop browser.** Open Chrome DevTools, turn on the device toolbar and pick an iPhone or Pixel preset. One-handed mode only shows in **portrait** and below 1024 px wide. Rotate the device to check the landscape side rail.

**Gestures.** In device mode the mouse acts as a touch pointer. Press on a player bar, the status card or the thumb dock and flick quickly (at least 48 px within 0.7 s):
- ← undoes your last move
- → flips the board
- ↑ opens the moves sheet
- ↓ toggles the menu

To see the first-run tutorial again, use Settings → General → *Replay gesture tutorial*.

**Real phones over Wi-Fi.** Run `npm run dev` and open the printed `Network:` URL on the phone:
- On **Android Chrome**, haptics use the Vibration API and you can feel them.
- **iOS Safari has no Vibration API**, so on iPhone haptics need the native Capacitor build (see 3.8).

**Logging haptics without a device.** Run this in the console, then reload:

```js
localStorage.setItem('chess-arena:debug-haptics', '1')
```

Every haptic then logs `[haptic] <kind> <intensity>` to the console. Use the *Test* buttons in Settings → Haptics to try each channel.

**Time Rush.** Open the Rush tab and press Start. The countdown only runs on your turn. Score popups show each move's grade, speed tier and combo. Press *Quit* to end a run and see the summary.

**Quests.** Quests change at local midnight. To test claiming, finish a game, solve a puzzle or play a Rush run, then open the **Quests** tab. Progress is stored in `localStorage['chess-arena:profile:v1'].quests`.

---

## 3. Shipping to iOS & Android with Capacitor

The project is already set up for this:
- `base: './'` in `vite.config.ts`
- `capacitor.config.ts` with `webDir: 'dist'`
- `@capacitor/core`, `@capacitor/cli` and `@capacitor/haptics` installed
- the engine's files are plain static assets

### 3.1 Prerequisites

- **Android:** Android Studio (latest stable) with the SDK installed. JDK 21 comes bundled with it.
- **iOS:** a Mac with the current Xcode. A paid Apple Developer account is needed to install on devices or ship to the App Store.

Check the [Capacitor environment setup docs](https://capacitorjs.com/docs/getting-started/environment-setup) for the current minimum versions.

### 3.2 App identity

Set your own bundle ID in `capacitor.config.ts`, for example `appId: 'com.yourcompany.chessarena'`.

### 3.3 Add the native platforms (one time)

```bash
npm install @capacitor/android @capacitor/ios
npm run build
npx cap add android
npx cap add ios
```

Commit the generated `android/` and `ios/` folders. They hold signing settings, icons and permissions.

### 3.4 Build → sync → run

```bash
npm run cap:sync       # build + copy dist/ and native plugins (incl. Haptics) into both projects
npm run cap:android    # sync + open Android Studio → Run ▶ / Build → Generate Signed Bundle (.aab)
npm run cap:ios        # sync + open Xcode → Signing & Capabilities → Run ▶ / Product → Archive
```

For live reload on a device:

```bash
npm run dev
npx cap run android --live-reload --host <LAN-IP> --port 5173
```

### 3.5 What the native build gets for free

| Concern | Handled by |
|---|---|
| Notches and home indicator | `viewport-fit=cover`, the `safe-*` utilities, and the bottom nav / bottom sheets padded with `env(safe-area-inset-bottom)` |
| Zoom and gestures | `user-scalable=no`, `touch-action: manipulation`, and `touch-action: none` on the board |
| Rubber-banding and selection | `overscroll-behavior: none` and `user-select: none` (inputs are excluded) |
| Haptics | `@capacitor/haptics`: `impact` (Light / Medium / Heavy per channel), `notification` for success, warning and error, and `selectionStart` / `selectionChanged` / `selectionEnd` for piece pickup |
| One-handed and gestures | Fixed-height portrait layout using a CSS size container. Swipes are tracked with Pointer Events and released on `window`, so buttons inside the dock keep working |
| OLED | Pure-black `theme-color` and surfaces; the `data-theme="oled-black"` CSS removes blur |
| Audio policy | The AudioContext starts on the first tap and is suspended in the background |
| Backgrounding | Clocks pause, searches stop, and storage is flushed immediately |
| Low-end devices | Battery saver, worker idle termination, code-split screens |
| Offline | Stockfish, sounds, openings and puzzles are all bundled |

### 3.6 Recommended extras

```bash
npm install @capacitor/status-bar @capacitor/splash-screen @capacitor/app
npm install -D @capacitor/assets
npx capacitor-assets generate --iconBackgroundColor '#0b0d12' --splashBackgroundColor '#0b0d12'
npx cap sync
```

- **Status bar:** `StatusBar.setStyle({ style: Style.Dark })`. If an older Android WebView reports zero safe-area insets, also call `StatusBar.setOverlaysWebView({ overlay: false })`.
- **Android back button:** `App.addListener('backButton', …)` to close the top modal, otherwise `App.minimizeApp()`.
- **Fonts:** self-host the Inter, JetBrains Mono and Orbitron fonts so the very first launch works fully offline.

### 3.7 Release checklist

- [ ] Unique `appId`, version code and name, signing configured.
- [ ] Icons and splash screens generated.
- [ ] Tested on a notched iPhone, Android with gesture navigation, a tablet, and in landscape.
- [ ] **Licensing:** Stockfish is **GPL-3.0**. Shipping it inside an app means meeting the GPL's terms, including making the corresponding source available. Review this before publishing to the App Store or Google Play.

### 3.8 Capacitor haptics: configuration & testing

`@capacitor/haptics` is already a dependency. `npx cap sync` registers it in both native projects, and there are no permissions to add.

- **Android:** the plugin adds the `VIBRATE` permission to the merged manifest automatically.
- **iOS:** it uses the Taptic Engine via `UIImpactFeedbackGenerator` / `UINotificationFeedbackGenerator`, which needs no entitlement.

How the app routes haptics (`src/audio/haptics.ts`):

```ts
haptic('pickup')   // → Haptics.selectionStart/Changed/End  (web: navigator.vibrate(8–32ms))
haptic('move')     // → Haptics.impact({ style: Light|Medium|Heavy })  from the "Piece drop" channel
haptic('capture')  // → impact at the "Captures" intensity           (web: double pulse)
haptic('check')    // → impact at the "Check alerts" intensity       (web: [p, 40, p])
haptic('success' | 'warning' | 'error') // → Haptics.notification(...) on the "Interface" channel
```

Each channel's intensity comes from **Settings → Haptics** (saved in `localStorage['chess-arena:settings:v2'].haptics`). The master switch turns them all off.

**Testing on a device:**
1. Run `npm run cap:android` or `npm run cap:ios`, then press **Run ▶** to install on a **physical** device. Simulators and emulators don't vibrate.
2. Open Settings → Haptics. The status line should say *"Native haptics via Capacitor"*.
3. Tap **Test** on each channel and switch between Light, Medium and Heavy to feel the difference.
4. Play a game:
   - selecting a piece gives a selection tick
   - a move gives a light tap
   - a capture gives a medium tap
   - giving check gives a heavy tap
   - swipes and rewards use the interface channel
5. On Android, check the system setting *Touch feedback / Vibration* is enabled. On iOS, check *Settings → Sounds & Haptics → System Haptics* is on, and remember iOS reduces haptics in Low Power Mode.

---

## Credits

- [chess.js](https://github.com/jhlywa/chess.js) (BSD-2)
- [react-chessboard](https://github.com/Clariity/react-chessboard) (MIT)
- [Stockfish.js](https://github.com/nmrugg/stockfish.js) (GPL-3.0)
- [lucide](https://lucide.dev) (ISC)
- [Capacitor](https://capacitorjs.com) (MIT)
