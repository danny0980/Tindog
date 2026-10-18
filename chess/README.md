# ♞ Chess Arena

A responsive chess app built with **React 19 + Vite + TypeScript (strict)**, styled with **Tailwind CSS v4**, powered by **chess.js** for rules, **react-chessboard** for the board, and **Stockfish 19 (WASM, in a Web Worker)** as the AI opponent. It's built mobile-first and is set up to be wrapped as a native iOS/Android app with **Capacitor**.

## Features

- **Player vs AI**: Stockfish at four levels (Beginner, Intermediate, Advanced, Expert). You can play White, Black or a random colour.
- **Player vs Player**: local pass-and-play on one device.
- **Moving pieces**: drag-and-drop, or tap a piece and then tap its destination. Legal moves show as dots, captures as rings, and the last move is highlighted. The king's square glows red when in check.
- **Promotion**: a dialog lets you choose queen, rook, bishop or knight (underpromotion works).
- **Status banner**: shows whose turn it is, Check, Checkmate, Stalemate and the draw types (threefold repetition, insufficient material, fifty-move rule), plus resignation and timeouts.
- **Captured pieces**: shown for each side, with the material advantage (`+N`).
- **Controls**: New Game, Flip Board, Undo and Resign (Resign asks for confirmation). In AI mode, Undo takes back your move and the engine's reply.
- **Move log**: SAN notation in two columns. It collapses on mobile, and a button copies the game as **PGN**.
- **Chess clock**: Unlimited, Bullet 1+0, Blitz 3+2, Blitz 5+0, Rapid 10+0 or Rapid 15+10.
  - Increments are supported, and Undo restores the clock times.
  - It shows tenths of a second under 10 seconds.
  - It doesn't drift, because it measures elapsed time with `performance.now()` instead of counting interval ticks.
  - A flag against a side with no mating material is scored as a draw.
- **Sound and haptics**: move, capture, check and game-end sounds are generated with the Web Audio API, so there are no audio files and they work offline. Phones that support it also vibrate. Sound can be muted.
- **Settings persistence**: your last game setup and the sound preference are saved in `localStorage`.
- **Native-app readiness**:
  - Safe-area insets are handled for notches and home indicators.
  - The viewport uses `100dvh`.
  - Pull-to-refresh and rubber-banding are disabled, along with double-tap zoom and text selection.
  - Touch gestures on the board are captured.
  - Modals open as bottom sheets on phones.

## 1. Project structure

```
chess/
├── capacitor.config.ts          # Capacitor native-shell configuration
├── index.html                   # viewport-fit=cover, theme-color, PWA/iOS meta
├── package.json
├── public/
│   ├── favicon.svg
│   └── stockfish/               # (generated, git-ignored) engine .js + .wasm
├── scripts/
│   └── copy-stockfish.mjs       # postinstall: copies Stockfish WASM into public/
├── src/
│   ├── main.tsx                 # React root
│   ├── App.tsx                  # Layout: board column + side panel + modals
│   ├── index.css                # Tailwind v4 theme, glass utility, safe-area utilities
│   ├── components/
│   │   ├── ChessBoard.tsx       # react-chessboard wrapper: highlights, click/drag, promotion
│   │   ├── PromotionDialog.tsx
│   │   ├── PlayerBar.tsx        # Name, turn indicator, captured pieces, clock
│   │   ├── CapturedPieces.tsx
│   │   ├── ChessClock.tsx
│   │   ├── GameStatusBanner.tsx
│   │   ├── ControlPanel.tsx     # New / Flip / Undo / Resign
│   │   ├── MoveHistory.tsx      # Collapsible SAN move log + PGN copy
│   │   ├── NewGameModal.tsx     # Mode, difficulty, colour, time control
│   │   ├── GameOverModal.tsx
│   │   ├── ConfirmDialog.tsx
│   │   ├── Modal.tsx            # Accessible portal modal (bottom sheet on mobile)
│   │   ├── Header.tsx
│   │   └── PieceIcon.tsx        # Reuses the board's SVG piece set
│   ├── hooks/
│   │   ├── useGameController.ts # Orchestrates game + engine + clock + sounds
│   │   ├── useChessGame.ts      # Owns the chess.js instance, exposes immutable snapshots
│   │   ├── useStockfish.ts      # Engine lifecycle (Web Worker)
│   │   └── useChessClock.ts     # Drift-free chess clock with increments
│   ├── utils/
│   │   ├── stockfishEngine.ts   # Serialized UCI client over postMessage
│   │   ├── chess.ts             # Result/status helpers, captured pieces, formatting
│   │   ├── sound.ts             # Web Audio sound effects + vibration
│   │   └── storage.ts           # Safe localStorage helpers
│   ├── constants/
│   │   └── game.ts              # Difficulty → engine config, time controls, defaults
│   └── types/
│       └── chess.ts             # Shared domain types
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json   # strict mode
└── vite.config.ts               # base: './' for Capacitor, Tailwind plugin
```

### Architecture notes

- **There is a single source of truth.** `useChessGame` keeps the mutable `chess.js` instance in a ref and gives React only immutable snapshots (`fen`, `history`, `turn`, result). Components render purely from the FEN.
- **AI moves can't land on the wrong position.**
  - The engine wrapper queues searches one at a time. A new request first sends `stop` to the search in progress.
  - The controller ignores any `bestmove` whose starting FEN is no longer on the board, for example after Undo or a new game.
- **Difficulty maps to Stockfish's own settings:**

  | Level | Skill Level | Max depth | Move time |
  |---|---|---|---|
  | Beginner | 0 | 2 | 150 ms |
  | Intermediate | 6 | 6 | 400 ms |
  | Advanced | 13 | 12 | 900 ms |
  | Expert | 20 | 20 | 1800 ms |

  A short minimum "think time" keeps very fast replies from feeling abrupt. You can tune all of this in `src/constants/game.ts`.
- **The Stockfish build is "lite, single-threaded" (≈1.8 MB).** It doesn't need `SharedArrayBuffer` or COOP/COEP headers, so it runs on any static host and inside iOS/Android WebViews unchanged.

## 2. Setup and running

**Prerequisites:** Node.js 20.19+ or 22.12+ (required by Vite 8) and npm 10+.

```bash
cd chess
npm install          # also runs postinstall → copies Stockfish into public/stockfish
npm run dev          # http://localhost:5173 (also exposed on your LAN for phone testing)
```

Other scripts:

```bash
npm run build        # type-check (tsc -b) + production build to dist/
npm run preview      # serve the production build locally
npm run typecheck    # strict TypeScript check only
npm run lint         # oxlint
```

### Recreating this project from scratch (for reference)

```bash
npm create vite@latest chess -- --template react-ts
cd chess
npm install chess.js react-chessboard lucide-react stockfish @capacitor/core
npm install -D tailwindcss @tailwindcss/vite @capacitor/cli
# then add scripts/copy-stockfish.mjs and the "postinstall" script, and copy in src/
```

Tailwind v4 needs no `tailwind.config.js` or PostCSS config. The `@tailwindcss/vite` plugin and `@import 'tailwindcss'` in `src/index.css` are all it needs.

> **Testing on a phone during development:** `npm run dev` prints a `Network:` URL. Open it on a phone on the same Wi-Fi network.

## 3. Capacitor: shipping as a native iOS and Android app

The web app is already set up for Capacitor:

- `vite.config.ts` uses `base: './'`, so asset URLs resolve inside the native WebView.
- `capacitor.config.ts` points `webDir` to `dist`.
- The Stockfish worker and WASM are plain static files in `dist/stockfish/`. No special headers or plugins are needed.
- Everything except the Google Fonts stylesheet works offline. If the font can't load, the system font stack is used.

### 3.1 Prerequisites

| Platform | Requirements |
|---|---|
| Android | Android Studio (latest stable) with the Android SDK, and JDK 21 (bundled with Android Studio) |
| iOS | A Mac with the current Xcode and Command Line Tools. A paid Apple Developer account is needed for device testing beyond a free provisioning profile, and for App Store release. |

Check the [Capacitor docs](https://capacitorjs.com/docs/getting-started/environment-setup) for the current minimum versions for Capacitor 8.

### 3.2 Configure the app identity

Edit `capacitor.config.ts`:

```ts
const config: CapacitorConfig = {
  appId: 'com.yourcompany.chessarena', // reverse-DNS, unique on the stores
  appName: 'Chess Arena',
  webDir: 'dist',
  backgroundColor: '#0b0d12',
  ios: { contentInset: 'never', backgroundColor: '#0b0d12' },
}
```

`@capacitor/core` and `@capacitor/cli` are already in `package.json`.

### 3.3 Add the native platforms

```bash
npm install @capacitor/android @capacitor/ios
npm run build
npx cap add android
npx cap add ios
```

This creates the `android/` and `ios/` native projects. Commit them, because they hold your signing settings, icons and permissions.

### 3.4 The build → sync → open loop

Run this every time the web code changes:

```bash
npm run cap:sync        # = npm run build && npx cap sync   (copies dist/ into both native projects)
npm run cap:android     # sync + open Android Studio
npm run cap:ios         # sync + open Xcode
```

- **Android Studio:** wait for the Gradle sync to finish, choose an emulator or a USB device (with USB debugging enabled), then press **Run ▶**. For a release build, use **Build → Generate Signed App Bundle / APK…**, which produces an `.aab` for Google Play.
- **Xcode:** select the **App** target, then **Signing & Capabilities** and set your Team. Choose a simulator or device and press **Run ▶**. For a release, use **Product → Archive**, then **Distribute App**.

**Live reload on a device (optional).** Run `npm run dev`, then:

```bash
npx cap run android --live-reload --host <your-LAN-IP> --port 5173
npx cap run ios --live-reload --host <your-LAN-IP> --port 5173
```

### 3.5 Touch, viewport and safe-area handling (already done in code)

| Concern | Where it's handled |
|---|---|
| Notch and home-indicator insets | `viewport-fit=cover` in `index.html`, plus the `safe-pt`, `safe-pb` and `safe-px` utilities in `index.css`, which use `env(safe-area-inset-*)`. Bottom sheets pad by `safe-area-inset-bottom`. |
| Stopping pinch and double-tap zoom from breaking the layout | `maximum-scale=1, user-scalable=no` in the viewport, plus `touch-action: manipulation` on `body` |
| Board drags scrolling the page | `.board-surface { touch-action: none }` |
| Rubber-band and pull-to-refresh | `overscroll-behavior: none` |
| Long-press callouts and text selection | `-webkit-touch-callout: none` and `user-select: none` |
| Mobile browser toolbars changing the height | `100dvh` units throughout |
| The board fitting both orientations | The board width is `min(100%, max(18rem, 100dvh − 15.5rem), 46rem)` |
| Keyboard and screen readers | Focus rings, `aria-*` labels, `role="status"` and `role="timer"`, and Escape to close modals |

**Android edge-to-edge.** Recent Android versions draw apps edge-to-edge. If the safe-area insets read as `0` on an older Android System WebView, so content sits under the status bar:

- Update the WebView, or
- Install `@capacitor/status-bar` and call `StatusBar.setOverlaysWebView({ overlay: false })` when the app starts.

### 3.6 Recommended native polish (optional plugins)

```bash
npm install @capacitor/status-bar @capacitor/splash-screen @capacitor/haptics @capacitor/app @capacitor/screen-orientation
npx cap sync
```

- **Status bar.** Use a light status bar on the dark background:

  ```ts
  import { StatusBar, Style } from '@capacitor/status-bar'
  StatusBar.setStyle({ style: Style.Dark })
  ```

- **Haptics.** In `src/utils/sound.ts`, swap `navigator.vibrate` for `Haptics.impact({ style: ImpactStyle.Light })`. iOS WebViews ignore `navigator.vibrate`, but the plugin works on both platforms.
- **Android hardware back button.** Close an open modal first, otherwise minimise the app:

  ```ts
  import { App } from '@capacitor/app'
  App.addListener('backButton', ({ canGoBack }) => {
    /* close modal or */ App.minimizeApp()
  })
  ```

- **Orientation lock (optional, phones only).** `ScreenOrientation.lock({ orientation: 'portrait' })`. The layout also works in landscape.
- **Icons and splash screens.** Put a 1024×1024 `assets/icon.png` and a 2732×2732 `assets/splash.png` in the project, then run:

  ```bash
  npm install -D @capacitor/assets
  npx capacitor-assets generate --iconBackgroundColor '#0b0d12' --splashBackgroundColor '#0b0d12'
  ```

You can guard native-only calls with `Capacitor.isNativePlatform()` from `@capacitor/core`, so the same code still runs in the browser.

### 3.7 Pre-release checklist

- [ ] Set a unique `appId`, the app name and the version: `versionCode`/`versionName` in `android/app/build.gradle`, and Version/Build in Xcode.
- [ ] Generate icons and splash screens.
- [ ] Test on a notched iPhone, an Android device with gesture navigation, and a tablet.
- [ ] Self-host the Inter font (optional) for a fully offline first launch.
- [ ] **Licensing:** Stockfish is **GPL-3.0**. Distributing it inside an app means meeting the GPL's terms, including making the corresponding source available. Review this before publishing to the App Store or Google Play.

## Credits

- [chess.js](https://github.com/jhlywa/chess.js) (BSD-2)
- [react-chessboard](https://github.com/Clariity/react-chessboard) (MIT)
- [Stockfish.js](https://github.com/nmrugg/stockfish.js) (GPL-3.0)
- [lucide](https://lucide.dev) (ISC)
