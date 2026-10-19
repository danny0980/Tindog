# ♞ Chess Arena: AAA Edition (v6.8 · Chronos Chess — Learn & Play)

A chess app built with **React 19, Vite 8 and strict TypeScript**, styled with **Tailwind CSS v4**. Rules come from **chess.js**, the board is **react-chessboard**, and the engine is **Stockfish 19** (WASM in Web Workers). It's built mobile-first and is set up to be wrapped as a native iOS/Android app with **Capacitor**.

- No `any` types.
- No audio files, because every sound is synthesised at runtime.
- Works offline once loaded, apart from the Google Fonts stylesheet.

---

## What's new in 6.8: history lessons, character voices, variants and the Opening School

### History behind every Classic opponent (`src/data/classic/lore/`)
- **Lore for all 100 Classic Chess opponents.** Each has their dates, a short biography, three checkable facts, and their own lines for when they beat you or you beat them.
- **Accuracy rules.**
  - Legends are labelled as legends ("according to tradition", "Plutarch reports").
  - Disputed claims are left out.
  - Several facts bust myths, for example Napoleon's height, Einstein's maths and Washington's teeth.
  - The end-of-game lines are written as game dialogue and are never presented as quotations.
- **In the game.** The Classic dossier shows the story and a *Did you know?* list. Every Classic game ends with a *History lesson*: one of the opponent's facts, a different one each game.

### Character voices (Settings → Audio → Character voices)
- **What's read aloud.** Characters read their lines aloud with your device's built-in speech, with no downloads. Choose *Off*, *Key moments* (greetings, results and big reactions; the default) or *Every line*.
- **A voice for each character.** Each character keeps a voice of their own. The register matches who they are (female, male, or a flat synthetic voice for machines and AIs), with a personal pitch and pace, and the mood colours the delivery.
- **Hearing a sample.** Use *Hear a sample* in Settings, or *Hear Bobby* (or whoever) in the Classic dossier.

### Coaching in the game review
The Stockfish review was already there: badges from brilliant to blunder, accuracy, the evaluation graph and key moments. Stepping through a reviewed game now shows a **move-insight card** for the move on the board:
- the evaluation before → after, from the mover's side;
- how much winning chance the move cost;
- the better move, also shown as the green arrow;
- a coaching tip for that kind of moment.

### Chess variants (Legends → *Chess Variants*)
- **Chess960 (Fischer Random).**
  - All 960 start positions, with the standard numbering (#518 is the normal setup). Pick a number or play a random one.
  - Full Chess960 castling: move your king onto the rook.
  - The engine plays in Stockfish's own Chess960 mode.
- **King of the Hill.** Reach d4, e4, d5 or e5 with your king to win; the hill squares glow.
- **Three-Check.** Give three checks to win; a counter shows each side's checks.
- **The computer, at three levels.** For King of the Hill and Three-Check, the computer weighs Stockfish's candidate moves against the variant's goals. It takes a variant win when there is one, never hands you one if anything else is possible, and reaches for cheap checks in Three-Check.
- **Built on its own rules engine.** The rules are a pure, tested `VariantGame` (`src/variants/`) layered over chess.js, with its own repetition tracking.

### The Opening School (Legends → *Opening School*)
- **Eleven interactive lessons.** Italian, Ruy Lopez, King's Gambit, Queen's Gambit Declined, London, English, Sicilian Najdorf, French, Caro-Kann, King's Indian and Scandinavian. Each is guided by a Classic chess master.
- **How a lesson runs.**
  - You play your side and every move is explained.
  - A wrong move gets a hint; a second wrong move shows the answer with an arrow.
  - Each lesson ends with three key ideas.
  - With voices on, the master reads the explanations aloud.

### Portrait reactions and new achievements
- **Reaction pops.** Portraits already changed ring and badge with the mood. Now a short reaction pops above them when the game turns: *Check!*, *Ha!*, *Oh no…*, *Hurry!*, *Victory!*. It is hidden with reduced motion or Battery Saver.
- **Eight new achievements.** Fischer Random, King of the Hill, Triple Threat, Variant Virtuoso, Globetrotter, On the World Stage, Opening Student and Opening Scholar.

### Tests
- `npm run test:lore` (21 checks)
- `npm run test:variants` (24 checks)
- `npm run test:openings` (23 checks, replaying every lesson line through chess.js)
- A browser run covered the hub, King of the Hill and Chess960 against the engine, a full lesson and the dossier.

## What's new in 6.7: Online play, and Classic portraits that import

### Play a friend online (the **Online** tab)
- **Create a room.** Pick a clock (none, 3+2, 5+0, 10+0 or 15+10) and your colour, then tap *Create a room*. You get a six-letter code and an invite link (*Copy invite link*, or *Share* on phones).
- **Join a room.** Type your friend's code, or just open their invite link. The link skips the startup film and goes straight into the game.
- **Peer-to-peer, no server or account.** The two browsers connect directly over WebRTC. PeerJS's free public broker only introduces them; it also provides STUN/TURN for awkward networks. Moves never pass through a game server (`src/online/`).
- **Fair by construction.**
  - Both browsers run the full rules (chess.js) on every move.
  - Everything received from the other side is validated: an illegal, out-of-turn or malformed message never reaches the board.
  - The two boards resync from the host if they ever disagree.
- **Clocks.** The clock starts with White's first move, and the increment is added after each move. Your own flag falls at zero. If your opponent's browser goes quiet past zero, you can claim after a short grace period. Timing out against a lone king is a draw.
- **In the game.** You can offer a draw (accept or decline), resign with a confirmation, and ask for a rematch, which swaps colours.
- **Drops and reloads.**
  - A dropped connection reconnects by itself, and a heartbeat spots a silent link within about 12 s.
  - A guest who reloads the page rejoins the same seat; a secret seat token stops anyone else with the code from taking it.
  - A player gone for 90 s loses by abandonment.
  - If the **host** closes their page, the room closes.
- **What's shared.** Your opponent sees your online name (set in the lobby) and your rating. Online games don't change your rating or coins.
- **Tests.** `npm run test:online` (36 checks) plays whole games between two sessions over an in-memory network with a fake clock: protocol validation, legality, clocks and increment, flags, draws, resignation, rematch, a third player turned away, drops, reconnects, heartbeat and abandonment. I also played real games between two browsers through the public broker.

### Classic Chess portraits now import
- **The importer knows Classic opponents.** Its catalog now includes the 100 Classic Chess opponents, so portraits of Classic-only characters (Sargon of Akkad, Hatshepsut, Socrates…) are recognised instead of skipped.
- **The audit lists what's missing.** `npm run assets:missing` has a new section, *Classic Chess opponents without a portrait*, grouped by era, with the file name for each.
- **No more misfiled portraits.** One-word shortcuts shared by two characters ("franklin", "alexander") no longer match either. Name such files in full (`benjamin-franklin.png`).

## What's new in 6.6: "The Last Grain", a 15-second WebGL opening film

The game now opens with a short film. The last grain of sand in time's hourglass falls onto an obsidian board, wakes chess pieces from five eras, and becomes the menu (`src/components/cinematic/lastGrain/`).

| Shot | Time | What happens |
|---|---|---|
| 1 | 0.0–2.2 s | Macro slow motion: a golden grain falls, strikes the board and throws a crown-shaped splash of light into a gold seam. |
| 2 | 2.2–5.0 s | The light races along the seam and wakes five era pieces in turn, each with a gold rim wipe, embers and its own material sound: Egyptian lapis, Roman bronze, samurai lacquer, Viking rune stone and Renaissance silver. |
| 3 | 5.0–7.8 s | An orbit round the obsidian queen as molten fissures climb her body; her crown points flare on the brass peak. |
| 4 | 7.8–10.4 s | Match cut to the king's cross. The camera dollies back, the last grain lands, and time freezes: the splash and embers hang in the air (bullet time) while the camera keeps moving. |
| 5 | 10.4–12.8 s | The frozen grains stream together into **CHRONOS** (Cinzel Black) above *CHESS ARENA · AAA EDITION* (tracked Orbitron), and a ray of light sweeps across to lock the title. |
| 6 | 12.8–15.0 s | The board flattens into frosted glass, and the three mode chips rise: **Classic Chess**, **Grand Campaign** and **Endless Gauntlet**. The film ends on *Tap to begin*. |

- **How it is built.** The hybrid WebGL/React route.
  - **three.js** draws the world: turned and carved pieces with shader-driven wake, crack, crown and rune effects; a gold-seam board shader; and about 2,500 deterministic particles.
  - The post-processing chain is highlight roll-off, bloom, then a grade (freeze desaturation, vignette and flash), then ACES tone mapping.
  - React owns the clock and the DOM layer (title, glass menu and chips).
  - Everything is a pure function of film time (`timeline.ts`, `camera.ts`, `particles.ts`, `overlay.ts`), so Skip, a hidden tab or a frame capture always lands on exactly the right frame.
- **Seamless hand-off.**
  - The title grains home onto the real DOM letters, sampled from the rendered Cinzel glyphs. Each letter fades in as its grains arrive.
  - The final frame *is* the live, clickable menu. Choosing a mode switches the app underneath at once, and the film's live last frame dissolves over it. There is no screenshot and no blank frame.
- **Sound.**
  - The synthesised score and effects follow the storyboard's sync map: celesta at the impact, a string ostinato, five material ticks, the brass and taiko peak, a reverse cymbal into the match cut, a clock tick in the frozen second, a heartbeat as time restarts, a chime per letter, an orchestral hit at the lock, UI clicks and a resolving chord.
  - The film waits for the first tap, because browsers keep audio locked until then. A replay starts at once.
  - Every voice runs on the film's own buses, so Skip silences anything still scheduled, reverb tails included.
- **Controls.**
  - **Skip** appears after one second and jumps to the title and menu.
  - Esc skips, then leaves. Enter or Space begins.
  - With reduced motion, the film opens on the finished menu.
- **Performance and fallbacks.**
  - **Quality tiers.** Battery Saver, low-memory or low-core devices, and phones get fewer particles, a lower pixel ratio and cheaper geometry.
  - **Lazy loading.** three.js is its own lazily loaded chunk (`three-vendor`, ~139 kB gzipped). It is never loaded once the film has been seen.
  - **No WebGL.** If WebGL is missing or the context is lost, a CSS obsidian board runs the same title and menu.
- **The previous intro.** *The Visual Evolution* is still on the Legends screen as a replayable cinematic card. Settings → *Replay the cinematic intro* and the header's clapperboard play *The Last Grain*.
- **Tests.** `npm run test:lastgrain` (32 checks) covers:
  - the shot grid and the cue sheet;
  - the seam light reaching each piece on its beat;
  - no camera pops outside the two planned cuts;
  - every particle frozen solid in bullet time;
  - deterministic seeking;
  - the grains converging on their letters;
  - Skip timing;
  - the final frame holding as the menu.

## What's new in 6.5: Classic Chess and a fair difficulty curve

- **Classic Chess, a separate mode** (Legends → *Classic Chess*, shown above the fantasy modes). It has 100 historical opponents who play strictly by the rules of chess, with no spells, tactics, weather, contracts or relics; a Classic game never gets a battle setup.
  - The opponents come from ten eras of ten: cradles of civilisation, Greece & Rome, kings & crusaders, empires of the East, the Renaissance, the age of sail, the Enlightenment, the 19th century, minds of science, and the masters of the board (Philidor → Fischer).
  - Together they form one rating ladder, from about 600 to 2760 Elo. Each has their own playing style, opening book and lines of dialogue (`src/data/classic/roster.ts`).
  - The screen has era filters, search, a suggested next opponent near your rating and a count of opponents beaten. Any character can be your avatar.
  - Portraits come from the art pack by name, using the same names as the campaign where a character appears in both.
- **Smart but winnable AI.**
  - Early opponents are now weak through shallow search: they miss deeper tactics, like a club player. Before, they were weak through random engine blunders.
  - A **blunder guard** (`maxLossCp`) never lets an opponent choose a move that loses more than ~1.5 pawns at the lowest levels, tightening to ~0.5 at the top. They no longer hang pieces or throw games away. A mate in one is never missed.
  - The first campaign realm now starts at 650 Elo. Quick Play Beginner and the legends' Novice strength follow the same rules.

## What's new in 6.4: Campaign expansion and the pre-battle loadout

- **Branching roads.** Each zone of the Grand Campaign now forks after its gate into two branches that rejoin before the zone boss. Clear either branch to go on; the skipped one stays open for later (`src/data/campaign/paths.ts`).
- **Hidden nodes.** Each realm hides an **Echo** of its overlord: 250 Elo stronger, searching deeper, paying double. It appears at the end of the road only when every node, both branches of every fork included, is conquered. Echoes are a bonus: they don't count toward the realm's clears or stars.
- **Difficulty tiers.** Story, Normal, Heroic and Legendary (`src/data/campaign/tiers.ts`) tune each boss's engine and set coin rewards from ×0.5 to ×2.5. Each boss remembers the hardest tier you beat it on.
- **Mutators.** Switch them on and two random twists are rolled for each battle, at most one of each kind: a weather (Blizzard, Gale, Fog of War), a contract (Iron Vow, Pawn Oath, Swift Hunt) and a fury (Enraged, Weary) (`src/data/campaign/mutators.ts`). Rolls are fixed per boss and day, with two re-rolls. Rewards multiply, and a broken contract forfeits the mutators' bonus.
- **Pre-battle loadout.** The battle window has a *Loadout* tab with the difficulty tier, mutators and the battle's look. Choose the realm's own board and pieces or *My look*: any board or piece set you own, any art-pack set or board, your avatar, and an arena backdrop shown behind the board. Every choice applies instantly and is remembered.
- **Scalable pickers.** Art-pack and look grids get a search box once a grid has more than 9 options. Previews are built only for visible items, and off-screen cells skip layout and paint, so dozens of art packs stay fast. Settings → Art pack can also choose the arena backdrop.

## What's new in 6.3: Board VFX

- **Effects under every piece.** Each square can carry its own animated layers, drawn under the piece:
  - a pulsing **selection aura** in the theme colour, with the selected piece raised;
  - a **last-move trail**: a soft glow on the origin square and a landing ring on the destination;
  - a **check** alarm on the king, and a dark core with repeating shockwaves on **checkmate**;
  - **status tiles** with shimmer: frost, snow, glue and stuck squares come from the battle rules.
  Lava, poison and void tiles are drawn the same way, but no game rule creates them yet. To use them, pass `arena.hazards` (`src/components/board/boardVfx.ts`, `BoardSquare.tsx`, `src/styles/vfx.css`).
- **Captures.** A white-hot flash, an expanding ring and a burst of shards and sparks on the square.
- **Piece interaction.** On a mouse or trackpad, the side to move's pieces lift when hovered.
- **The board rim** glows in the theme accent colour, and turns into a pulsing red alarm while a king is in check.
- **Game over.** Golden fountains and motes for a victory, rising embers for a defeat.
- **Resilient art.** Art-pack pieces show the built-in vector piece immediately and fade in once their image has decoded. A missing or broken file never leaves an empty square. The importer skips any file it cannot read or write, lists it, and keeps going.
- **Battery saver and reduced motion.** Battery saver keeps the looks but stops the motion, flashes and particles. "Reduce motion" does the same, except that particles still play on the game-over window.

## What's new in 6.2: the Art Pack — your own portraits, pieces and boards

Drop a folder of images in and the game uses them everywhere:
- **Portraits:** boss and legend portraits, in dossiers, the map, speech bubbles, player bars and victory/defeat cards.
- **Pieces:** custom piece sets (12 images or one sprite sheet), on the board, captured pieces, promotion and shop swatches.
- **Boards:** custom boards (one image, or light/dark tiles, plus an optional frame).

Anything missing or broken falls back to the built-in vector art.

### 1. Import your art (Windows, macOS, Linux)

```bash
cd chess
npm run assets:import                                         # images sitting in the chess folder itself
npm run assets:import -- "C:\Users\you\Downloads\my-art"      # or any other folder
npm run assets:import -- "C:\…\my-art" --dry-run              # preview without copying
npm run dev
```

**Folders are optional.** The importer scans the folder recursively, skipping the app's own `node_modules`, `src`, `public`, `dist` …, and sorts every image **by its file name** (case, spaces, underscores and accents don't matter):

| Name contains | Goes to | Examples |
|---|---|---|
| A character name | portraits | `Ragnar.png`, `NAPOLEON.png`, `cleopatra.png`, `Blackbeard.png`, `ninja_leader.png`, `Queen Elizabeth I.png` |
| A piece-set name, or "sprite sheet" | piece set (sprite sheet) | `standard.png`, `Obsidian.png`, `aztec.png`, `lacquer sprite sheet.png` |
| A single piece | piece set (12 images) | `wK.png`, `White King.png`, `obsidian_bN.png`, `Aztec Black Queen.png` |
| `player-avatar-…` / `avatar …` | your player avatar (pick it in Settings → Display → Art pack) | `player-avatar-knight.png`, `player-avatar-mage.png` |
| `…-bg`, `… background`, `… screen`, `world-map…` | screen backgrounds: **victory** / **defeat** card, **loading** screens (one picked at random), **world map** (Grand Campaign), **realm** / **chrono** (Legends hub) | `victory-screen-bg.png`, `defeat-screen-bg.png`, `loading-screen-space.png`, `world-map-campaign.png`, `chrono-realm-bg.png` |
| A board-theme name | board | `classic-wood.png`, `OLED Black.png`, `wild west light.png`, `wild west dark.png`, `nebula frame.png` |

**Name matching details.**
- **Where the names come from:** the known names are read from the game itself, so every legend and all 100 bosses are recognised. On top of that come built-in sets and themes, plus extra names: Queen Victoria, Abraham Lincoln, Julius Caesar, and new sets/themes such as `dark-fantasy`, `cyber-ninja`, `wild-west` and `ancient-greece` (`scripts/asset-catalog.mjs`).
- **Conflicts:** the longest matching name wins (`obsidian-marble.png` is a board, `obsidian.png` is a piece set). When a name is both a set and a theme (`minimal`), the image's shape decides.
- **Unknown names:** an unknown name with a hint word works too (`Merlin portrait.png`, `Coral Reef sprite sheet.png`, `Frozen Lake board.png`). So does a wide or tall image, which is treated as a sprite sheet.
- **Which characters still need art?** `npm run assets:missing` lists every campaign boss and Chronos legend with no portrait (using the same name matching as the game), each with a file name that would match. It also lists portrait files that name no known character.
- **Relics, icons and arenas.**
  - Relic images (`relic-…` or a `relics` folder) replace a relic's drawn emblem wherever it is shown. Use the relic's id or name, e.g. `relic-smoke-veil.png` or `Smoke Veil of Iga.png`.
  - UI icons (`icon-…` or an `icons` folder) replace the mode icons on the Legends screen, the mode cards and the bounty contract. The slot names are chronos, historical, fantasy, free-play, tournament, gauntlet (also `boss-rush`), grand-campaign, bounty (also `daily-bounty`) and cinematic.
  - Images in an `arenas` folder (or named `arena-…`) become arena backdrops you can pick in the battle Loadout.
  - When the art folder contains the game folder itself (`chess app/chess`), that folder is skipped.
- **Organised folders work.** The importer scans every subfolder, however deep: realm folders such as `Cosmic Pantheon` and `Ninjas & Shinobi`, plus `icons`, `relics` and `arenas`. It prints a per-folder count of what it found. If a folder holds other recognised portraits, any image in it whose name doesn't match a character is imported as a portrait too, and the audit flags it. A Windows path ending in a backslash (`"...\chess app\"`) is handled.
- **Full art audit:** `npm run assets:audit` (same as `assets:missing`; add `-- "<art folder>"` to preview a source folder before importing) lists every missing portrait, relic, icon and screen background. It also lists images the game can't use: portraits of characters who aren't in the game, relics that don't exist, and icons with no slot.
- **Portraits copied in by hand** to `public/assets/portraits/` work too. The importer, the scan before `npm run dev`, and `assets:missing` rename each one to the name the game looks for, so `Portrait of Napoleon (1).PNG` becomes `napoleon-bonaparte.png`. This covers any case, spaces, underscores, accents, numbering, `(1)`, `copy`, `final`, `v2`, `4k`, `.jpeg` and `.jfif`. When there are two images of one character, the larger stays and the other moves to `portraits/duplicates/`. Files that name nobody are left as they are and reported.
- **Sprite sheets are cut automatically:** the importer removes the background (green screen, any flat colour, or transparent), finds each piece wherever it sits on the sheet (any layout, any order), recognises it by its silhouette (king, queen, rook, bishop, knight, pawn; White = the lighter army) and saves 12 transparent images, `pieces/<set>/wK.webp` … `bP.webp`, all on one canvas so a pawn stays smaller than a king (smaller pieces are enlarged towards the king's height so they stay readable). The size of art pieces on the board is adjustable in Settings → Art pack → *Piece size on the board* (80–150%, default 115%). A "sheet" with no background to remove is a board picture and goes to `boards/<theme>/board.png`. Pieces that touch or overlap are cut apart at their thinnest point. Sheets can be PNG, JPEG or WebP (read with [sharp](https://github.com/lovell/sharp)); the cut pieces are saved as 512 px WebP. After importing, open `/assets/report.html` in the running app to see every set as it was cut. If a sheet can't be cut, it is kept with its background removed, sliced on a grid, and marked ⚠ in the report.
- **Leftovers:** anything else is listed as *Not recognised* with a suggestion. Rename it and run the importer again.
- **Duplicates:** if two files map to the same place, the larger one is kept.

Folder layouts from 6.2 (`Portraits/`, `Pieces/<set>/`, `Boards/<theme>/`) still work as a fallback.

### 2. How the art is used
- **Portraits** match the character's name loosely:
  - *Napoleon* finds Napoleon Bonaparte, *einstein* finds Albert Einstein, and *Cleopatra* finds Cleopatra VII.
  - Titles are ignored (*Queen Elizabeth I*, *Richard the Lionheart*).
  - A few aliases are built in, e.g. *Ninja Leader* → Hattori Hanzō (`PORTRAIT_ALIASES` in `src/assets/artManifest.ts`).
  - Locked characters keep their mystery emblem.
  - Portraits for people who aren't characters in the game (e.g. Queen Victoria, Abraham Lincoln, Julius Caesar) are imported but unused until such a character exists.
- **Piece sets and boards:**
  - **Automatic match:** a set or board named after a built-in one (`standard`, `classic-wood`, `nebula` …) automatically skins it, including inside themed character battles.
  - **New names:** any other name (`dark-fantasy`, `wild-west` …) is picked in **Settings → Display → Art pack** or **Shop → Art pack**. That choice applies to every board immediately; *Theme default* hands control back to each theme.
  - **Switch:** *Use the art pack* turns everything off.
- **Fallbacks:**
  - **Pieces:** a broken piece image shows that piece in vector instead.
  - **Boards:** board textures are applied only after every file has loaded, so a broken one keeps the theme's colours.
  - **Manifest:** a missing or invalid manifest simply means no art pack.
  - **Paths:** manifest entries are validated (relative paths inside `assets/`, image extensions only, no `..`).

**Code.**
- `scripts/assets-lib.mjs`, `import-assets.mjs`, `scan-assets.mjs`: dependency-free Node scripts that read PNG, JPEG, WebP and GIF headers.
- `src/assets/artManifest.ts`: typed manifest, sanitiser, matching and sprite geometry.
- `src/assets/useArt.ts`: hooks and the image preloader.
- `src/components/board/ArtPiece.tsx`: renders one piece.
- `src/components/settings/ArtPackPicker.tsx`: the picker UI.

**Tests:** `npm run test:assets` runs 34 checks: file recognition, a manifest built from real files, sanitising, portrait matching for the requested names, sheet slicing, and resolution rules.

**Tip:** generated images are often 2–8 MB each. Exporting them as WebP (or resizing pieces to 256–512 px) keeps the game fast on phones.

---

## What's new in 6.1: The Visual Evolution — cinematic intro & post-processing

The app now opens on a ~20-second **cinematic intro**, rendered live on a 2D canvas with no video or image files. It starts as a hyper-real study game and is torn apart into the Chronos realm.

### 🎬 The sequence (`src/components/cinematic/`)
The intro starts behind a gate (*Begin the cinematic*), so the first tap also unlocks audio on mobile.

| Time | Phase | What you see and hear |
|---|---|---|
| 0–8.6 s | **Classic study** | A macro shot of a varnished maple and walnut board that pulls back slowly. <br>• **Wood grain:** procedural, with growth rings warped by noise and the grain alternating direction per square. <br>• **Lighting:** a brass inlay, a warm specular pool, and a volumetric lamplight beam with drifting dust motes. <br>• **Moves:** the Italian Game is played with physical weight: lift arc, settle, a damped micro-tremor that ripples into neighbouring pieces, and a wooden thock. <br>• **Sound:** a fireplace room tone. |
| 8.6–12.4 s | **The rift** | The board rattles and a seeded temporal crack spreads branch by branch from e4/e5. <br>• **Fracturing HUD:** holographic panels (*Timeline integrity*, *Engine eval*, *Reality anchor*) glitch, scramble their data and shatter. <br>• **Post-processing:** chromatic aberration. <br>• **Sound:** a rising tear with glitch blips. <br>• **At 10.6 s:** a blue and gold **shockwave**, a white flash, a camera kick, a heavy haptic and a sub-bass impact. Then the realm floods outward from the crack behind a glowing front. |
| 12.4–18.5 s | **Chronos realm** | Obsidian and cracked-basalt tiles with pulsing lava seams. <br>• **Pieces:** rune-lit — crystal-gold for White, obsidian and fire for Black. <br>• **Effects:** a turning rune circle, rising embers, spell motes, an aurora sky and bloom. <br>• **The game turns violent:** Nxe5 makes the e5 pawn shatter into shards, and Bxf2+ triggers a chromatic burst. <br>• **Sound:** an orchestral loop in D minor (brass, strings, choir, timpani). |
| 18.5 s → | **Finale** | The letterbox bars open and the **CHRONOS CHESS** title card appears. <br>• **Buttons:** **Grand Campaign**, **Endless Gauntlet** or **To the board**. <br>• **Background:** the realm keeps animating behind the title. |

**Skipping and replaying.**
- **Skip:** the *Skip* button (or `Esc`) jumps to the finale at any time. The gate itself also offers *Skip to the Grand Campaign / Gauntlet / board*.
- **First launch:** the intro plays once automatically (`settings.introSeen`).
- **Replay:** from the header 🎬 button, the **Legends → The Visual Evolution** card, or **Settings → General → Cinematic**.
- **Reduced motion:** with `prefers-reduced-motion`, the intro goes straight to the title card, without camera moves, shake, flashes or glitch.

**Architecture.**
- **Pure core:** `timeline.ts` holds the phases, the scripted moves, lift and tremor physics, the camera path, the pinhole projection and the beats. The renderer only draws what it says, so every beat is deterministic and unit-tested.
- **Rendering:**
  - **`renderer.ts`:** the board is drawn as horizontal texture strips. This is exact because the camera has no yaw or roll, so every board row projects to one horizontal line. The strips are clipped to the projected board outline.
  - **Bloom:** emissive elements (lava, runes, crack and shockwave) are also drawn into a quarter-resolution buffer, which is upscaled additively.
- **Assets:** `textures.ts` paints the boards and lit piece sprites once from seeded value noise.
- **Sound:** `introAudio.ts` synthesises the score.
- **Performance** (aimed at 60 fps):
  - **No garbage during frames:** particles live in typed arrays (`components/fx/particles.ts`) and are recycled.
  - **Adaptive quality:** `QualityGovernor` drops DPR, particle count, strip count and bloom when frames run slow, and raises them again when there's headroom. Phones start at medium.
  - **Loading:** the intro is a lazy chunk (~11 kB gzip) that is only downloaded when it plays.
  - **Pausing:** the loop pauses with the tab.

### ✨ Post-processing in game (`src/components/fx/`)
- **SVG filters:** `FxDefs` mounts `#fx-chromatic` (red and blue channels pulled apart) and `#fx-bloom` (a blurred, brightened copy screened over the original) once.
- **Bursts:** `playFx` plays them as Web Animations bursts, so the board is never remounted:
  - **Chromatic aberration and quake:** on **critical checks** (in check with at most 3 replies) and on checkmate.
  - **Bloom:** on every spell, tactic or potion flash.
- **Spell particles:** `SpellParticles` is a canvas over the board.
  - **Bursts per event:** Frost Sigil ice crystals on the frozen square (plus a slow frost drift while it stays sealed), spell sparks and runes, ward runes, amber glue, blood embers from the altar, potion bubbles, check sparks, and checkmate shards.
  - **Cost at rest:** the loop stops when nothing is alive.
- **Vignette:** a tension vignette darkens with check, time trouble, a charging spell or a character battle, and tints red when you're in danger.
- **Opting out:** everything respects *Settings → Audio → Arena atmosphere* and battery-saver mode.

### 🌀 View transitions (`src/utils/viewTransition.ts`)
- **API:** screen changes run inside the **View Transitions API** (Chromium, Safari 18+), using `flushSync` so the snapshot is exact.
- **Direction:**
  - **Tabs** slide and blur in the direction you travel.
  - **Paths** zoom in: World Map, Gauntlet, Tournament, and the realm switcher.
  - **Profile Legacy tabs** (the Trophies room): slide left or right.
  - **Closing the intro:** zooms into the destination.
- **Header and nav** keep their own `view-transition-name`, so they stay still.
- **Fallbacks:** browsers without the API get a CSS entrance animation, and reduced motion or battery saver switch transitions off.

### Integration & verification guide

```bash
cd chess
npm install
npm run check              # typecheck + lint + data + 6 test suites (now incl. cinematic)
npm run test:cinematic     # 47 checks: phases, move physics, beats, camera & projection, crack, particles, quality governor, FX mapping, transitions
npm run build && npx vite preview   # http://localhost:4173
```

1. **First launch.** Open the app in a fresh profile (a private window, or clear `chess-arena:settings:v2`). The gate appears; click **Begin the cinematic** with sound on.
   - **Study:** the study game plays from 0 to 8 s (e4, e5, Nf3, Nc6, Bc4) with dust in the light beam.
   - **Rift:** at about 9 s the crack, glitching HUD panels and chromatic fringe appear. At 10.6 s come the shockwave and flash.
   - **Realm:** from 12.4 s you see the realm, lava, runes, embers and the orchestra. The Nxe5 capture shatters a piece, and Bxf2+ flashes chromatic.
   - **Finale:** at 18.5 s the title card and buttons appear.
2. **Exits.** **Grand Campaign** lands on the world map with a zoom transition. Reload: the intro doesn't auto-play again.
3. **Replay and skip.** Use the header 🎬 (or Legends → *The Visual Evolution*, or Settings → *Replay the cinematic intro*). Press **Skip** (or `Esc`) to jump to the finale, then **Endless Gauntlet**.
4. **Mobile.** At 390×844 (touch), check the gate, the *Skip* button in the top-right safe area, and the finale buttons wrapping.
5. **In-game effects.** In a campaign battle:
   - **Bloom and bubbles:** drink a potion.
   - **Frost:** fight Malakor; when Frost Sigil lands, ice crystals burst and keep drifting on the sealed square.
   - **Critical check:** a severe check from the boss quakes the board with a chromatic split.
   - **Checkmate:** mate adds shards to the kill-cam.
6. **Transitions.** Switch tabs (slide), open Legends paths (zoom) and switch realms (slide). Header and nav stay still.

**Tested here** (headless Chromium against the production build):
- Every phase rendered; screenshots were checked.
- The HUD panels appear in the rift.
- Every exit lands on the right screen, and `introSeen` persists.
- The header button and `Esc` work.
- View transitions run with the right direction.
- Potion particles draw and the loop goes idle after it settles.
- No page errors.

Measured frame rates (software rendering, no GPU):

| Setup | Frame rate |
|---|---|
| Desktop, 1280×720, high quality | ~40–58 fps |
| Mobile emulation | ~60 fps |

Real GPUs should do better, and the governor lowers quality when needed.

**Limitations.**
- **Rendering:** it's 2D canvas, not WebGL. Pieces are lit glyph sprites (billboards), not 3D models.
- **Board edges:** the strip renderer is exact for board rows; any slight softness at the edges is hidden by the outline clip.
- **SVG filters:** filters on large elements cost a lot on weak GPUs, so the continuous rift aberration is enabled only on fine-pointer (desktop-class) devices, and in-game filters are short bursts.
- **Score:** the orchestral loop is synthesised, so it suggests an orchestra rather than imitating one.

---

## What's new in 6.0: Chronos Chess — The Ultimate Edition

Version 6.0 adds four layers on top of the v5 spell engine:
- **Campaign world:** Ironman, world-map events, parley and a bounty board.
- **Board mechanics:** traps, potions, the Sacrifice Altar and weather.
- **Meta progression:** trophies, a personal notebook, titles and daily tournaments.
- **Polish:** a checkmate kill-cam, mood lighting, focus soundscapes and a Chronicles Log.

Every rule is a pure function with unit tests.

### 1. Campaign world
**Ironman / permadeath** (`src/utils/ironman.ts`). Open it from Grand Campaign → **Ironman**; you are asked to confirm.
- **Starting a run:** your regular campaign is stored safely and the run begins from boss #1 with no relics.
- **During the run:** takebacks are disabled, and victories pay **×3 coins** (stacking with a parley's reward factor).
- **Defeat:** **a single campaign defeat wipes the run**. Bosses, stars, realms and relics earned in it are lost, the run restarts, and the wipe is counted.
- **Ending the run:** your regular campaign comes back.
- **Achievements:** clearing a realm in Ironman earns **Iron Will**; clearing all five earns **The Iron Crown**, plus a trophy.

**World-map events** (`src/utils/world.ts`). Each unlocked realm gets three events a day. They are dealt against your progress, so every one sits beside a boss you can reach, and they appear both as floating markers on the map and on the **Today on the map** board.
- **Shrine:** choose 1 of 2 blessings. The blessing becomes an extra tactic for your next campaign battle.
- **Merchant:** buy potions at varying prices, each ware once per day.
- **Elite ambush:** a boosted boss in random weather, with no draft. It pays coins plus a potion, one attempt per day, unrated.

**Bounties & restrictions.** There are two contracts per realm per day:
- **No pawn moves:** pawn moves are refused on the board.
- **No castling:** castling is refused on the board.
- **Win within 30 moves:** checked when the game ends.
- **60 s vs 5 min:** you get 1:00 + 2 s per move; the boss gets 5:00.

Bounties are unrated, can be retried until fulfilled, and pay coins plus a potion. If a rule would leave you no legal move, all moves are allowed.

**Parley** (`src/data/parley.ts`). The pre-battle draft now opens with a short dialogue: 3 dilemmas per voice (fierce, cold, sly). Each one offers three choices:
- **Taunt:** the boss is empowered and rewards are ×1.5.
- **Bargain:** you gain a free tactic.
- **Feint:** the boss is weakened and rewards are ×0.75.

The boss speaks its answer as the battle begins. The empower and weaken effects change the engine's skill, depth and tolerance.

### 2. Board mechanics (`src/engine/spellEngine.ts`)
**Tile traps.**
- **Frost traps** come from freeze spells and now last a number of moves (Void Lock lasts 2). No piece may land on a frost square or slide through it.
- **Glue traps** are laid by you, from a Trap Kit, on any empty square. An enemy piece that lands on glue is **stuck for two of its turns**; unsprung glue fades after 6 enemy moves.
- **How bosses obey the arena:** the boss's search is restricted with UCI `searchmoves`, so bosses respect glue, snow and wind. Book moves and the final choice are filtered too.

**Potions** (belt under the HUD; at most 3 per battle; drinking one never costs a move):

| Potion | Effect |
|---|---|
| Time Elixir | +30 s on your clock (timed battles only) |
| Purge Potion | removes frost traps and dispels a charging spell or overclock |
| Ward Tonic | +1 Spell Ward |
| Glue Trap Kit | one glue trap to lay (tap the button, then an empty square) |
| Awakening Draught | one 3 + 1 knight leap |

New profiles, and v2 profiles on upgrade, receive a starter pack. Potions are sold in the **Shop → Apothecary**, by merchants, and through bounty and ambush rewards.

**Sacrifice Altar.** The altar opens after the boss's 3rd move and can be used once per battle.
- **Using it:** sacrifice one of your pawns (never one shielding your king). The pawn's removal is recorded as its own ply (`Xh2`), and it is still your move.
- **What you get:** one knight is **awakened** (a long leap), and one spent tactic recharges: Katana, Second Wind, Vanguard, Ward or Boot.

**Dynamic weather** (set by ambushes; it affects both sides):
- **Snow:** every 4 plies, 2 empty squares on ranks 3–6 fill with snow. Pieces can land on them but not slide through.
- **Wind:** turns every 6 plies. Straight slides of 4 or more squares into the wind are blown back; knights and diagonal moves are immune.
- **Fog:** hides legal-move hints, the evaluation bar and the best-move arrows.

Weather is animated over the board and is static in battery-saver mode.

### 3. Meta progression (Profile → Legacy card)
- **Hall of Trophies:** 17 trophies on 3D shelves that turn slowly on their pedestals.
  - **Realm trophies:** a weapon from each milestone boss and a crown from each overlord.
  - **Other trophies:** the Iron Crown and Iron Sigil, two Gauntlet cups, the Tournament Cup, the Chronos Hourglass and the Fair Folk tome.
- **Personal notebook** (`src/utils/notebook.ts`):
  - **Data:** engine analyses now store a compact summary with each match: brilliant moves, best moves, inaccuracies, mistakes, blunders, errors by phase, and pieces blundered.
  - **What it shows:** an opening scorecard, your weakest phase, your blunder-prone piece, blunders per 100 moves, clock losses, and colour imbalance.
  - **Recommendations:** keep or replace an opening, or a starter repertoire if you have little data.
  - **Notes:** a free-text field that is saved with your profile.
- **Titles & noble ranks** (`src/data/titles.ts`):
  - **Ranks by peak Elo:** Squire, Knight 1400, Baron 1600, Count 1800, Duke 2000, Archduke 2200.
  - **13 feat titles,** for example *Slayer of Chronos*, *Grandmaster of Shadows*, *Lord of the Cosmos*, *the Iron Monarch*, *Gauntlet Champion*, *Tournament Victor* and *Brilliant Mind*.
  - **Where they appear:** your profile card, your player bar in games, and the Gauntlet leaderboard (local and global).
- **Daily auto-tournament** (`src/utils/tournament.ts`, Legends → Chronos Tournament):
  - **Bracket:** you and the 7 legends nearest your rating, in a seeded bracket.
  - **Your matches:** played as rated 5 + 3 games, with colours alternating by round. A drawn match goes to the lower-rated player.
  - **Other matches:** simulated from Elo expectation.
  - **Prizes:** 40, 80 and 200 coins for the three rounds; winning the final earns *Tournament Victor*.
- **New achievements:**
  - **Ironman:** Iron Will, The Iron Crown.
  - **World and tournament:** Bounty Hunter, Pilgrim of the Realms, Tournament Victor.
  - **Board mechanics:** Alchemist, Blood for Power, Trapper.

### 4. Polish
- **Kill-cam:** a checkmate slow-zooms onto the mated king, darkens the edges and stamps **CHECKMATE** with the mating move, with a booming toll. The results card waits for it (2.6 s); battery-saver mode skips it.
- **Mood-reactive arena:**
  - **Lighting:** follows the opponent's alignment — warm dawn light for *light* (cold, principled) foes, crimson-violet for *dark* ones (fierce and sly).
  - **Severe check** (you are in check with at most 3 replies): the board quakes, the edges flare red, and a seismic rumble plays with a heavy haptic. You can turn this off in Settings → Audio → *Arena atmosphere*.
- **Focus soundscapes** (`src/audio/focusSounds.ts`, Settings → Audio): procedurally synthesised **rain**, **fireplace** (roar with random crackles) and **cosmic hum** (detuned drones and stellar wind). They play on their own bus with their own volume, and fade in and out.
- **Chronicles Log:** a lore-book timeline of your victories over legends and bosses, conquered realms and timelines, Ironman runs and tournament wins. It also shows your **brilliant-move %**.

### Engineering
- **Module layout:**
  - `src/types/rpg.ts`: types.
  - `src/engine/spellEngine.ts`: arena rules.
  - `src/utils/{ironman,world,inventory,tournament,notebook,chronicle}.ts`: pure logic.
  - `src/data/{arena,parley,titles,trophies}.ts`: data.
  - `src/components/roguelike/`: ArenaBar, KillCam, MoodBackdrop, WeatherOverlay.
  - `src/components/campaign/WorldBoard.tsx`, `src/components/tournament/` and `src/components/profile/{TrophyHall,NotebookPanel,ChroniclePanel,TitlePicker,LegacyPanel}.tsx`: UI.
- **Profile v3 migration** (`stores/migrations.ts`, step 2 → 3) adds inventory, Ironman, world, title, notebook, tournament and feat counters, and gifts the starter potions. Each new field is sanitised on its own (`stores/sanitizeRpg.ts`), so a corrupt value never resets anything else.
- **Strict TypeScript:** no `any`, immutable reducers, and a `BattleKind` covering campaign, legend, gauntlet, event, bounty and tournament.
- **Mobile-first:**
  - **Potion belt:** sits above the thumb dock in one-handed mode with 40 px targets.
  - **Square picker:** for glue and the altar, with pulsing targets; dragging is disabled while it is active.
  - **Sheets:** world events open as safe-area sheets.
- **Lazy loading:** TournamentView is lazy (1.5 kB gzip). GrandCampaign grew to 13.6 kB gzip, and the eager bundle grew by about 8.7 kB gzip.

### Integration & verification guide

```bash
cd chess
npm install
npm run check            # typecheck + lint + data + legends + campaign + resilience + roguelike + ultimate
npm run test:ultimate    # 107 checks: traps, weather, bounties, altar, potions, permadeath, events, parley, tournament, notebook, titles, trophies, v3 migration
npm run build && npx vite preview   # production build on http://localhost:4173
```

The checks below were run in a browser against the production build.
1. **World events.** Open Legends → Grand Campaign. The *Today on the map* board shows a shrine, a merchant, an ambush and two bounties, and markers float beside Hammurabi.
   - **Shrine:** pick a blessing. The draft shows "Shrine blessing joins this battle".
   - **Merchant:** buy a potion; your coins drop and the potion appears in the belt.
2. **Ironman.** Click **Ironman** → *Begin Ironman*. The badge "Ironman · ×3 coins" appears.
   - **Draft:** Hammurabi's draft shows the permadeath warning and a 3-choice **Parley**.
   - **In battle:** the HUD shows *Ironman* and Undo is disabled.
   - **Defeat:** resign. The results card says *Permadeath — the run is lost*, and the profile shows `ironman.wipes = 1`.
3. **Potions and glue.** In any campaign battle, tap **Glue Trap Kit**, then e5. A honey trap appears and the HUD shows "1 glue trap". If the boss lands there, a *Stuck* chip appears and that piece can't move for two turns.
4. **Altar.** After the boss's 3rd move, tap **Altar** and then one of your pawns. The pawn disappears (`Xh2`), it is still your move, violet leap rings appear on your knights, and a spent tactic recharges.
5. **Bounties.** Accept a contract.
   - **No castling:** O-O is refused with an "Arena rule" toast.
   - **60 s:** your clock shows 1:00 and the boss's shows 5:00.
   - **Result:** resign to see "Contract failed — it stays on the board".
6. **Weather.** Fight an ambush. The weather chip appears (Snow, Wind ↑/→ or Fog).
   - **Fog:** hides hints and the eval bar.
   - **Snow:** drifts appear every 4 plies, and sliding through them is refused.
7. **Kill-cam.** Play a local game with Fool's mate (f3 e5 g4 Qh4#). The board zooms to e1 with a *CHECKMATE · Qh4#* stamp, then the results card opens.
8. **Tournament.** Open Legends → Chronos Tournament: the bracket shows the quarter-finals, semi-finals and final. Play your quarter-final. A win advances you and pays 40 coins; a loss simulates the rest of the bracket.
9. **Legacy.** Open Profile → the Legacy card, with its Trophies, Notebook, Chronicle and Titles tabs. Pick a feat title and it shows on your card and player bar.
10. **Audio.** Open Settings → Audio → *Focus soundscape*: Rain, Fireplace or Cosmic hum, with a volume slider. *Arena atmosphere* toggles the mood lighting and quake.
11. **Mobile.** At 390×844 in one-handed mode the potion belt sits just above the thumb dock and there is no horizontal scroll.

**Limitations.**
- **Balance:** traps, weather and parley strengths are tuned by reasoning, not playtesting.
- **Severe-check detection:** it uses a simple heuristic (at most 3 legal replies).
- **Alignment:** it is derived from the opponent's taunt voice rather than authored per boss.
- **Potions and undo:** potions drunk before a takeback stay spent.
- **Saving the v3 profile:** a v2 profile is migrated in memory and written back as v3 on the next change.
- **Tournament prizes:** they are paid for your own matches only.

---

## What's new in 5.0: Legends of the Board — RPG & Roguelike Edition

Four systems turn character battles into RPG encounters: **boss spells**, a **roguelike tactic draft**, **board-aware taunts**, and a new **Endless Gauntlet** survival mode.

### Rule-bending moves, done safely (`src/engine/variant.ts`)
Some spells and tactics break normal chess rules, so they are implemented at FEN level:

| Move | Rule | Written as |
|---|---|---|
| **Charge** | A pawn steps one square diagonally forward onto an empty square; on the last rank it becomes a queen. | `e5~f6` |
| **Leap** | A knight makes a 3 + 1 "camel" jump over anything, onto an empty square or an enemy piece (never the king). | `Nb1~c4` |
| **Pass** | The side to move loses its turn. Only allowed when not in check. | `--` |

Every generated move is validated: the resulting FEN must be legal, and the mover may never leave its own king in check. That keeps every position legal for chess.js and Stockfish.

Special moves are stored as normal entries in the game history, so undo, the time machine, analysis, the captured-pieces bar and opening detection keep working. To make that possible, `useChessGame` now:
- **History:** keeps the full history itself (special moves reload the chess.js instance).
- **Undo:** restores saved positions instead of replaying moves.
- **Threefold repetition:** counts repeats over the whole game.
- **PGN export:** writes a `[Variant "Chronos Spells"]` PGN with comments.

Matches with special moves also store them in `MatchRecord.variant`, so **reviews replay them exactly**.

### 🔮 Boss spells (`src/engine/spellEngine.ts`, `src/data/spells.ts`)
A pure reducer runs after every move and returns the new spell state plus events (casts, warnings, clock changes, Katana passes). The spell state is snapshotted per move, so undo and the time machine restore it exactly.

| Spell (who) | Effect |
|---|---|
| **Frost Sigil** (Malakor) · **Faerie Ring** (Oberon) · **Arrow Storm** (Black Prince) · **Void Lock** (Warden Xal) | Every 5th boss move (with a warning one move before), an empty square freezes for your next move. No piece may land on it or pass through it. The board shows an icy tile, and moves through it are refused. The square is never chosen so that you'd be left without a legal move. |
| **Berserker Charge** (Ragnar) · **Rally of Orléans** (Joan of Arc) | Once the boss loses a rook, its pawns may also make diagonal charges for the rest of the battle. |
| **Time Dilation** (Einstein) · **Eternity** (The Infinite) | Every move you think for more than 15 s gives the boss +10 s. Only active in timed battles; untimed, it shows as dormant. |
| **Ancient Fury** (Aurelion) · **Threat Analysis** (AEGIS Prime) · **Total Computation** (OMNICORE) | Every 5th move is announced, then computed at full engine power. |
| **Shadow Step** (Hattori Hanzō) | Once per battle, when he is in check or his queen is attacked, a knight may make a leap (only one that's legal, e.g. one that blocks the check). |

Every milestone (#10) and overlord (#20) boss in all five realms has a signature spell, as do Ragnar, Einstein and Malakor (in both Chronos and their campaign cameos). Einstein is also Realm I's overlord.

**How the bosses choose spell moves.** The AI considers spell moves (charges and Shadow Steps) only when the engine agrees they're about as good as its best normal move: it checks each with a shallow search, within the boss's style tolerance. So spells add menace without making bosses blunder.

**Visual and audio cues.**
- A holographic banner over the board ("Frost Sigil charging", the spell name when it lands).
- Spell chips that pulse while charging.
- New procedural warning and cast sounds.
- Toasts that name the frozen square.

### 🎒 Roguelike tactic draft (`src/components/campaign/BattleDraft.tsx`)
Pressing **Battle** on a Grand Campaign boss opens **Prepare for battle**:
1. Review the boss's spells.
2. Set your Reliquary loadout (it uses the same store as the Reliquary).
3. Draft **1 of 3** tactic cards for this battle.

The deal is seeded by boss and attempt, so reopening the screen can't reroll it. Clock-only cards appear only in timed battles.

| Tactic | Effect |
|---|---|
| **Knight's Boot** | Once, a knight may make a 3 + 1 leap. Its targets show as violet rings. |
| **Chronos Hourglass** | +20 s every time you're put in check. |
| **Katana Blade** | Your first capture makes the boss lose its next turn (as soon as it isn't in check). |
| **Vanguard Charge** | Once, a pawn may charge diagonally. |
| **Spell Ward** | Blocks the boss's first spell. |
| **Second Wind** | +60 s the first time you finish a move under 30 s. |

The original brief described Knight's Boot as "one leap over a blocking piece". Knights already jump over pieces, so it's implemented as the long 3 + 1 leap instead.

**Relic synergies.** Owning these relics upgrades the draft:
- **Hourglass of Time:** Chronos Hourglass gives +30 s.
- **Smoke Veil:** Knight's Boot can be used twice.
- **Shield of Kings:** Spell Ward blocks two spells.
- **Starforged Crown:** the draft shows 4 cards and you take 2.

During the battle, the **Spells & tactics HUD** shows both sides' powers and their state; tap a chip for its rules. In one-handed mode it appears as compact chips under the opponent's bar.

### 💬 Dynamic psychological taunts (`src/engine/taunts.ts`, `src/data/taunts.ts`)
After every move, `analyzeTaunt()` picks the most important thing that happened and returns it with a priority and a mood. It covers:
- **Queens:** a hanging queen ("A reckless sacrifice!"), your queen lost, or the boss's queen taken.
- **Big swings:** blunders and brilliancies, detected from the boss's own search with no extra engine work (±250 cp compared with what it expected after its last move).
- **Material:** rook, knight and bishop captures, and promotions by either side.
- **Checks:** checks given and received.
- **Your king:** king walks and early castling.
- **The clock and spells:** slow moves, time trouble, spells cast, spells warded and tactic tricks.

**Voices.** Lines come in three voices, *fierce*, *cold* and *sly*, mapped from each boss's archetype or legend. Templates are filled with the real piece, square and spell. The legends' handwritten check lines are still used half the time.

**Interruptions.** Urgent events (priority 80 or above) cut through the chatter cooldown.

**Speech bubbles.** Each bubble takes a mood:
- **smug** 😄
- **angry** 😠 (the bubble shakes)
- **shocked** ⚡
- **tense**
- **calm**

Urgent lines stay up longer, in larger text.

### ♾️ Endless Gauntlet (`src/components/gauntlet/`, `src/utils/gauntlet.ts`)
Open it from **Legends → Endless Gauntlet**.
- **Time bank as health:** a single **5:00 time bank** is your health, carried from battle to battle (+2 s per move). The boss always gets 10:00.
- **Escalating bosses:** opponents come from all 100 campaign characters, spells included, ramping from about 800 Elo by +110 per round. Only the realm chunks a round needs are downloaded.
- **Colours alternate** each round.
- **Takebacks are forbidden.**
- **Results:**
  - **Win:** restores 35% of the time you spent, plus 15 s. Then you pick **1 of 3 boons**: Time Cache +60 s, Tempo (+1 s increment for the whole run), EMP Burst, Tactics Cache or Aegis (one takeback).
  - **Draw:** the run continues without a restore.
  - **Loss or flag:** the run ends.
- **Score:** each win scores the boss's Elo × a streak bonus, plus the seconds you have left. The run pays up to 300 coins.
- **Interruptions:** if the app closes mid-battle, the next launch offers *Resume* (same boss, −60 s) or *End run*.
- **Forfeits:** starting another game mid-battle forfeits the run.

**Leaderboards** (`src/services/leaderboard.ts`).
- **Local:** your top 10 runs and personal bests.
- **Global:** a real HTTP client that's off by default, because there is no server.
  - **Enable:** build with `VITE_LEADERBOARD_URL=https://your.server/gauntlet`.
  - **API:** `GET ?limit=N` must return `LeaderboardEntry[]` (or `{ entries }`), and `POST` takes a `LeaderboardEntry` JSON body.
  - **Robustness:** responses are validated, and requests time out after 6 s and are retried.

Runs are never rated, so the Gauntlet can't be farmed for Elo.

### Integration & test guide

```bash
cd chess
npm install
npm run check              # typecheck + lint + data + legends + campaign + resilience + roguelike tests
npm run test:roguelike     # 76 checks: variant moves, spells, draft, taunts, gauntlet, leaderboard client
npm run dev
```

1. **Draft and Knight's Boot.** Go to Legends → Grand Campaign → Hammurabi → **Battle**. Pick *Knight's Boot* (the deal varies per attempt; resign once for a new deal if it isn't offered).
   - Tap your b1 knight: violet rings appear on a4 and c4.
   - Leap there. The chip turns to "used", and the move list shows `Nb1~c4`.
   - Resign, then open the game from Profile → match history: the review replays the leap.
2. **Frost Sigil.** Seed `{"version":2,"legends":{"defeated":{"aerith":"2026-01-01T00:00:00.000Z"},"wins":{},"losses":{},"draws":{},"epochsVisited":[]}}` into `chess-arena:profile:v1`, then play Malakor (Legends → Fantasy Realm).
   - After his 4th move, the Frost Sigil chip pulses (*charging*).
   - After his 5th, a square turns to ice and Malakor taunts you.
   - Moves onto or through that square are refused with a "Frozen square" toast.
3. **Berserker and Katana.** Win a rook from Ragnar (Chronos or campaign #7): the HUD switches to *pawns charging*, and he may answer with `e5~f6`-style steps. With *Katana Blade* drafted, your first capture makes the boss skip a turn (a `--` ply).
4. **Taunts.** Hang your queen, give or take checks, think for 25 s, or let your clock drop under 20 s in a timed battle. The bubble changes colour and icon by mood.
5. **Gauntlet.** Go to Legends → Endless Gauntlet → **Start a run** → **Fight round 1**.
   - The clocks show 5:00 (you) and 10:00 (the boss), and Undo is disabled.
   - Win to see the boon picker, or resign to see the run summary and the local leaderboard.
   - Reload in the middle of a battle to see the *interrupted* resume option.
6. **Mobile.** In one-handed mode the spell chips sit under the opponent's bar, and the draft and boon screens are scrollable sheets. Landscape keeps the battle on one screen.

**Limitations.**
- **Spells and AI strength:** spells are tuned conservatively (bosses only use rule-bending moves the engine approves), and their effect on win rates hasn't been measured with real players.
- **Global leaderboard:** it needs a server you host; nothing is sent anywhere unless `VITE_LEADERBOARD_URL` is set.
- **Bundle size:** the eager bundle grew by about 13.5 kB gzip (taunt text, spell data, the variant engine and the Gauntlet logic used by the game controller). The Gauntlet screen itself is lazy-loaded (~3.9 kB gzip).

---

## What's new in 4.1: reliability & resilience

This release adds no new features. It makes sure a bad network, a corrupt save or a stray swipe can't cost players their progress.

### Crash and download resilience
- **Error boundaries** (`src/components/ErrorBoundary.tsx`) wrap the whole app, the Play screen, every lazy screen, the Settings modal and the Grand Campaign.
  - A crash shows a recovery card with **Try again** and **Reload App** instead of a blank page.
  - Chunk-download failures get an offline-aware message and retry automatically when the device reconnects.
  - Switching tabs clears a screen's error.
- **Retrying lazy screens** (`src/utils/lazyWithRetry.tsx`).
  - Each screen download is tried up to 3 times with back-off (0.6 s, then 1.8 s).
  - Browsers cache a failed `import()` per URL, so the retries re-request the chunk with a cache-busting query (`importWithRetry`, `src/utils/retry.ts`).
  - Without that, a retry would never reach the network in Chrome or the Android WebView.
  - A screen that still fails is only re-downloaded when the player asks: React re-renders once after an error, and rebuilding the screen then would start a silent download loop.
- **Realm rosters** (`data/campaign/loader.ts`).
  - Downloads use the same cache-busted retries, and a final failure is recorded per realm in `realmStatusStore`.
  - The map shows "Couldn't chart {realm}" / "You're offline" with **Retry download**, and also retries on reconnect. It never sits on "Charting…" forever.
  - `createRosterLoader()` takes the importers as a parameter, so the failure paths are unit-tested.
- **No auto-reload on `vite:preloadError`.** Vite fires that event on the *first* failed attempt, so reloading there would pre-empt the retries and throw the player back to the Play tab. A chunk missing after a new deploy ends on the error card, where **Reload App** loads the new build.
- **Native builds** bundle every chunk locally, so these download failures mainly matter for the web/PWA build.

### Save-data safety
- **Versioned migrations** (`src/stores/migrations.ts`).
  - The profile now carries `version: 2`.
  - Older saves are upgraded one step at a time (v1 → v2 adds the campaign block and `bossId` on old matches). Saves without a version are treated as v1.
  - Saves from a *newer* app version are read best-effort instead of being reset.
  - A missing step stops the chain without discarding anything. The sanitiser then repairs each field on its own; a version number alone never wipes a profile.
  - To add v3: write `PROFILE_MIGRATIONS[2]` and bump `PROFILE_VERSION`.
- **Backups and corruption guards** (`createPersistentStore`, `src/utils/store.ts`).
  - **Backup:** before the first write of each session, and immediately before a migration, the last good save is copied to `chess-arena:profile-backup`.
  - **Corrupt or missing save:** if the main save is corrupt, unreadable or deleted, the backup is loaded and the player sees "Progress restored".
  - **Nothing usable:** if both copies are unusable, defaults are used, but the damaged text is kept under `chess-arena:profile:v1:corrupt` and never deleted.
  - **Good backups stay good:** corrupt text never overwrites a good backup.
  - **No crashes:** a full or blocked storage never crashes the app.
- **Protected takebacks in campaign battles.** In a boss battle, a takeback either spends the Shield of Kings or caps the win at one star. Both swipe-left and the Undo button therefore open a confirmation that says exactly which will happen ("Use the Shield" / "Take back"). Cancel keeps the position. Once the battle is already casual, nothing more is at stake and undo works directly.

### Mobile sheets
- **Safe-area padding:** every bottom sheet (boss dossier, Reliquary, moves, game menu, gesture guide, confirmations) clears the iPhone home indicator. Footers already padded with `env(safe-area-inset-bottom)`; footer-less sheets now pad their scroll area too, and scrolling inside a sheet no longer scrolls the page behind it.
- **Pinned battle button:** on phones the dossier's **Battle / Rematch** button sits in the sheet's footer, so it is always visible above the home indicator instead of below the fold.

### Testing the resilience features

```bash
npm run test:resilience   # retries, roster error/retry, migrations, backups & corruption (25 checks)
npm run check             # everything, including the new suite
```

To try them by hand (`npm run build && npm run preview`, Chrome DevTools):

1. **Offline map.** Open Legends → Grand Campaign, go offline in DevTools → Network, then pick a realm you haven't opened yet. After three attempts the map shows *You're offline*. Go back online and it loads by itself (or press **Retry download**).
2. **Lazy screen failure.** In DevTools → Network → *Block request URL*, block `RushView-*.js`, then open **Rush**. The error card appears and the nav still works. Unblock it and press **Try again**.
3. **Corrupt save.** In the console:
   `localStorage.setItem('chess-arena:profile:v1', '{broken')`
   Reload: the "Progress restored" toast appears and the launch backup is used. The broken text is kept under `chess-arena:profile:v1:corrupt`.
4. **v1 migration.** Save a profile with `"version": 1` and reload. Your progress is intact, `profile-backup` holds the original v1 text, and the next write stores `version: 2`.
5. **Undo protection.** Equip the Shield of Kings, start a boss battle on a phone-sized viewport, play a move and swipe left on the dock. The confirmation appears; Cancel keeps the move.

---

## What's new in 4.0: the Grand Campaign, 100 bosses across 5 realms

Open **Legends → Grand Campaign** (the wide card at the top of the path selector). It is a node-based **world map** of five mega-realms with twenty bosses each:

| Realm | Zones (5 bosses each) | Elo | Relics (#10 · #20) |
|---|---|---|---|
| I. Historical Legends | Ancient World · Middle Ages · Renaissance & Enlightenment · Modern Era | 800–1450 | Shield of Kings · Hourglass of Time |
| II. Mythology & Fantasy | Halls of the Gods · The Silverwood · The Barrow Crypts · Dragonspine Caldera | 1150–1750 | Oberon's Fae Gold · Dragonheart Ember |
| III. Age of Discovery & Blades | The Spanish Main · Tourney Fields · Uncharted Horizons · Shadows of Iga | 1500–2100 | Black Prince's Banner · Smoke Veil of Iga |
| IV. Cyberpunk & Dystopia | The Undernet · Core Datavault · Iron Bastion · Neon Syndicate | 1850–2450 | EMP Spike · Firewall Core |
| V. Cosmic Pantheon (endgame) | Citadel of Hours · The Hollow Between · Maw of Entropy · Throne of Stars | 2200–2800 | Starforged Crown · Singularity Core |

How progression works:

- **Unlocking.** Bosses unlock one at a time along each realm's road. A realm opens when the previous realm's overlord (#20) falls.
- **Map nodes.** Each node shows the boss portrait, its number, a 1–3 star rating and its name. The road glows up to your frontier, and the next boss pulses. Milestone (#10) and overlord (#20) nodes are larger and carry a gem or crown badge.
- **Cameos.** The eight hand-crafted Chronos legends appear as bosses: Cleopatra, Ragnar, Musashi, Newton, Napoleon and Einstein in Realm I, and Aerith and Malakor in Realm II. Their style, opening book and dialogue are kept, but their strength is re-scaled to the campaign Elo curve. Grand Campaign progress is tracked separately from the Chronos chapters.
- **Stars (move efficiency).** These count your moves in a win:
  - ★★★ for a win within par. Par is 22 moves at Elo 800, rising to 47 at Elo 2800.
  - ★★ for a win within 1.6× par.
  - ★ for any other win.
  - A takeback caps the win at ★, unless the Shield of Kings absorbs it.
- **Rewards.**
  - First wins pay a bounty that scales with Elo (×2 for milestones, ×3 for overlords).
  - Rematches pay a smaller bounty, plus 15 coins for each newly earned star.
  - Clearing Discovery unlocks the **Storm Sea Chart** board and **Brass & Tar** pieces. Clearing the Cosmic Pantheon unlocks **Nebula Throne** and **Stardust**. These new themes come with new `nautical` and `cosmic` soundtrack textures. Cyberpunk Neon now plays a `cyber` synthwave texture.
- **Achievements.** There are nine new ones: First Conquest, one per realm cleared, Relic Hunter, Three-Star General and Flawless Conqueror (all 300 stars).

### Relics (equip before a battle)

Relics are earned from milestone and overlord bosses. You have **2 slots**, or 3 once you own the Starforged Crown. Equip them in the boss dossier or the **Reliquary**. Battle relics are fixed for the whole fight, and Time Rush relics apply when a run starts.

| Relic | Effect | Where it's applied |
|---|---|---|
| Shield of Kings | First takeback in the first 15 moves of a campaign battle is free: still rated, stars kept | `useGameController.undo` |
| Hourglass of Time | Time Rush starts with +10 s | `useTimeRush.start` |
| Oberon's Fae Gold | +25% campaign victory coins | `applyBossResult` |
| Dragonheart Ember | +30 s on your clock in timed campaign battles | `startNewGame` |
| Black Prince's Banner | Star targets 25% more generous | `starsFor` |
| Smoke Veil of Iga | First Time Rush blunder costs no time and keeps the combo | `useTimeRush` grading |
| EMP Spike | Bosses search 2 plies shallower and think 25% faster | `applyRelicsToProfile` |
| Firewall Core | Rated campaign defeats cost at most 4 Elo | `applyMatch` (`eloLossCap`) |
| Starforged Crown | Passive: third relic slot | `relicSlots` |
| Singularity Core | Time Rush points +20% | `useTimeRush` |

### The Archetype Engine

None of the 100 AIs is hand-coded. Each boss is a short data row (name, title, archetype, opening book, icon, bio and three signature lines), and `buildRealmRoster()` derives the rest:

- **Archetype** (`data/campaign/archetypes.ts`): The Berserker, Fortifier, Trickster, Calculator, Gambiteer, Sniper, Warlord and Maverick. Each archetype supplies:
  - style weights for the MultiPV re-ranker
  - extra tolerance, noise and think tempo
  - a counter-tip
  - in-character lines for the nine reaction triggers
- **Elo → Stockfish.** `strengthForElo()` interpolates skill, depth, move time, tolerance and noise between calibration anchors from 800 to 2800. The archetype's "style slack" halves as Elo rises, so a 2800 Berserker still plays near-best chess.
- **Elo per boss.** It comes from its position on the realm's ramp (`bossElo`). Par, rewards, rank and relic come from the position too.
- **Era-specific opening books** (`data/campaign/books.ts`): ten books, from Old Masters, Romantic Gambits and Hypermodern to Engine Main Lines and the Celestial Canon. All 88 lines are replayed with chess.js in the tests.

### Data pipeline & lazy loading

```
src/data/campaign/
├── realms.ts        # eager: realm/zone metadata, Elo ramps, relic milestones, id helpers (~1 kB)
├── relics.ts        # eager: relic definitions, slot rules, effect constants
├── archetypes.ts    # archetypes + strengthForElo + buildProfile        ┐ shared lazy chunk,
├── books.ts         # era opening books                                 │ fetched with the
├── build.ts         # seeds → Boss (profile, quotes, portrait, rewards)  ┘ first roster
├── loader.ts        # loadRealmRoster() / getCachedBoss() + subscribable rosterStore
└── rosters/         # chronicle · mythic · discovery · cyber · cosmic — one chunk each (≈2.5 kB gzip)
src/data/personas.ts           # Legend | Boss → Persona (what the play screen stages)
src/utils/campaign.ts          # pure: unlocks, stars, applyBossResult, relic toggles, counters
src/hooks/useCampaignRoster.ts # useRealmRoster / useBoss
src/components/campaign/       # GrandCampaign (lazy), WorldMap, BossDossier, Reliquary,
                               # GrandCampaignCard, CampaignBattleStrip, RelicTile, StarRow
src/components/legends/PortraitEmblem.tsx + portraitIcons.ts   # shared character emblems
```

A realm's roster is only downloaded when its map is opened. The play screen, dialogue bubbles, portraits and arrival card now render a generic **`Persona`**, so legends and bosses share one code path. Campaign progress is stored in `profile.campaign` and sanitised on load. Unknown ids, impossible star counts and unowned equipped relics are dropped.

Measured with `vite build`:
- The eager bundle grew by about 15 kB gzip. Roughly 6 kB of that is the ~80 lucide portrait icons, which live in the shared `ui-vendor` chunk.
- The campaign screen loads ~6 kB gzip on first open.
- Each realm roster is 2.4–2.7 kB gzip.

A boss battle does not survive a page reload, since games are not persisted. A fresh session starts outside the campaign.

### Integration guide: testing the Grand Campaign locally

```bash
cd chess
npm install
npm run check            # typecheck + lint + data validation + legends tests + campaign tests
npm run test:campaign    # 100-boss registry, archetypes, books, stars, relics, storage, lazy loader
npm run dev              # Legends → Grand Campaign
```

1. **Map and lazy loading.** Open Legends and pick the Grand Campaign card. In DevTools → Network, the `chronicle-*.js` chunk loads; switching realm tabs loads the others on demand. Tap a locked node: the dossier explains which boss opens it.
2. **First battle.** Choose Hammurabi (#1), pick a side and a clock, then press **Battle**. You'll see:
   - the arrival card and his intro line
   - the papyrus board
   - a book reply (he answers 1.e4 with 1…d6)
   - the **Grand Campaign strip** with the star targets (in one-handed mode it's in the Moves sheet)

   **Resign** to see the campaign block in the game-over modal ("Hammurabi holds the line"), then use **World map** to return.
3. **Seed progress to see later realms, stars and relics.** Paste this into the console, then reload:

   ```js
   const p = JSON.parse(localStorage.getItem('chess-arena:profile:v1') ?? '{"version":1}')
   const d = new Date().toISOString()
   const slugs = ['hammurabi','sun-tzu','alexander','hannibal','cleopatra','charlemagne','ragnar','saladin','genghis-khan','joan-of-arc','leonardo','machiavelli','elizabeth-i','musashi','newton','napoleon','ada-lovelace','tesla','marie-curie','einstein']
   p.campaign = {
     bosses: Object.fromEntries(slugs.map((s, i) => [`chronicle.${s}`, { stars: (i % 3) + 1, wins: 1, losses: 0, draws: 0, bestMoves: 25, firstClear: d }])),
     relics: ['shield-of-kings', 'hourglass-of-time'], equipped: ['shield-of-kings'], realmsCleared: ['chronicle'],
   }
   localStorage.setItem('chess-arena:profile:v1', JSON.stringify(p))
   ```

   After the reload:
   - Realm I is complete (39 ★) and Mythology & Fantasy is open.
   - Hermes is the next boss.
   - The Reliquary shows two relics.
   - Equip both and press Undo early in a battle: the toast says the Shield absorbed it and the game stays rated.
   - Then start a Time Rush and confirm the countdown starts at 2:10.
4. **Relic effects in battle.** Pick a timed control with the Dragonheart Ember equipped (seed `'dragonheart-ember'` into `relics`) and your clock starts 30 s ahead. The EMP Spike and Firewall Core are covered by `npm run test:campaign`.
5. **Archetypes.** Start Commander Ironjaw (Cyber #11, a Berserker) and Major Tessaract (#13, a Fortifier). Ironjaw throws pawns at your king; Tessaract castles and trades. The test suite measures this on a fixed position: Ironjaw chooses …g5 every time and Tessaract never does.
6. **Mobile checks.** Use DevTools device mode, or a device via `npm run cap:sync`:
   - **390×844:** the map scrolls vertically and auto-centres on your frontier. Tapping a node opens the dossier as a bottom sheet. The realm tabs scroll sideways.
   - **One-handed mode:** the battle fits the screen without scrolling.
   - **844×390 landscape** (and ≥1024 px desktop): the map and dossier sit side by side, with the dossier sticky.

---

## What's new in 3.2: Universes — Vikings, Samurai & the Fantasy Realm

Chronos Chess now spans **two universes** with eight playable characters. The Legends tab opens on a **Campaign Select / Universe Switcher** with three paths:

| Path | Chapters | Notes |
|---|---|---|
| **Historical Timeline** | Cleopatra → Newton → Napoleon → Einstein → **Ragnar Lothbrok** → **Miyamoto Musashi** | Six eras. Finishing it awards **Master of Time**. |
| **Fantasy Realm** | **Queen Aerith** → **Malakor the Dark Sorcerer** | Its own progression, open from the start and independent of history. Finishing it awards **Hero of the Realm**. |
| **Free Play / Quick Battle** | Any character you have defeated | Pick the strength, side and any time control, including custom minutes + increment. |

The last screen you used (select, a campaign, or free play) is remembered.

### The new characters

| Character | Setting | Rating | How they play |
|---|---|---|---|
| **Ragnar Lothbrok** (V) | Viking Age, 865 AD | ~2400 | Berserker. A new **`pawnStorm`** weight pushes flank pawns at your king, with high tolerance and noise for risky trades. Book: King's Gambit, 1.g4, the Borg (1.d4 g5), the Dutch, and the Latvian. |
| **Miyamoto Musashi** (VI) | Feudal Japan, 1612 | ~2600 | Precise and positional. Skill 20, depth 16, a 20 cp tolerance and a short think, so he calculates fast and rarely strays from the best line. Book: Réti / King's Indian Attack, the Catalan, the Najdorf and the Grünfeld. |
| **Queen Aerith** (I) | Elven Kingdom | ~1600 | Defensive. **`pawnStructure`** rewards pawn-supported chains and **`longRange`** rewards bishops and queens on long open diagonals. A high `fork` weight hunts knight and bishop forks. Book: 1.b3 / 1.g3 fianchettos, the Caro-Kann, the Queen's Indian and the English Slav. |
| **Malakor the Dark Sorcerer** (II) | Realm of Shadows | ~2200 | High risk. A large **`sacrifice`** weight and wide tolerance favour gambits and sacrifices. Book: the Blackmar–Diemer, King's and Evans Gambits, the Englund, the Latvian, Traxler and Budapest. |

The data is split by universe:
- `src/data/eras/`: `epochs.ts` and `legends.ts` for history.
- `src/data/realms/`: `realms.ts` and `legends.ts` for fantasy.
- `src/data/campaigns.ts`: the chapter order and completion trophies.
- `src/data/legends.ts`: the single aggregator. It covers lookup, gating, strengths and labels.

Adding a character means adding one data entry plus one chapter slot.

### Strength (difficulty) for every character

`applyStrength()` scales a character's profile but **keeps their style weights and opening book**. A Novice Ragnar still storms, just less accurately.

| Strength | Rating | Engine | Rewards |
|---|---|---|---|
| **Novice** | −350 | skill −7, depth −4, faster, wider tolerance, more noise | ×0.5 |
| **Authentic** | as listed | the character's own profile | ×1 |
| **Mythic** | +200 | skill 20, depth +4, longer think, tighter tolerance | ×1.5 |

Campaign battles are always **Authentic**. Free Play and *New game → vs Computer → Legend opponents* let you choose.

### Themes & soundscapes

| World | Board | Pieces | Piece sound | Soundtrack texture |
|---|---|---|---|---|
| Viking Age | Rune-Carved Oak (rune-etched planks, fur-brown frame) | Runestone | wood | `nordic`: low drones, a **war-drum** pulse, deep booms |
| Feudal Japan | Bamboo & Gold Leaf (ink-wash strokes, gold leaf) | Urushi Lacquer | wood | `japanese`: In-scale **koto** plucks with a breathy **shakuhachi** flute |
| Elven Kingdom | Elven Crystal (frosted crystal, leaf veins) | Moonsilver | **crystal** (new) | `elven`: **harp** arpeggios and a formant-filtered "choir" pad |
| Realm of Shadows | Obsidian & Lava (cracked obsidian, glowing fissures) | Hellfire | **ember** (new) | `shadow`: a dark cinematic pad, **heartbeat** pulse and sub booms |

As in 3.1, the four new boards and piece sets are unlocked by a character's **first defeat** and can't be bought. First-win bounties are Ragnar 1200, Musashi 1500, Aerith 600 and Malakor 1200. New trophies:
- **Valhalla Can Wait**
- **The Book of Five Rings**
- **Elven Accord**
- **Shadowbane**
- **Hero of the Realm**
- **Walker Between Worlds** (fight in both universes)

**Time Traveler** now requires all six historical eras.

### Integration guide: testing the universes locally

```bash
cd chess
npm install
npm run check        # typecheck + lint + data validation (44 repertoire lines replayed) + logic tests
npm run dev          # Legends tab (hourglass icon)
```

1. **Universe selector.** The Legends tab opens on three cards: Historical Timeline, Fantasy Realm and Free Play. Each card shows your progress and the next chapter. Use **← Paths** to come back. Reloading returns you to the screen you left.
2. **Fantasy is open from the start.** Choose Fantasy Realm and Aerith is unlocked. The board re-themes to Elven Crystal while she is selected. Malakor stays locked until Aerith falls, and his card reads "through the veil".
3. **Seed progress to reach the new chapters.** Paste this into the browser console, then reload:

   ```js
   const now = new Date().toISOString()
   const p = JSON.parse(localStorage.getItem('chess-arena:profile:v1') ?? '{"version":1}')
   p.legends = { defeated: { cleopatra: now, newton: now, napoleon: now, einstein: now, ragnar: now, aerith: now }, wins: {}, losses: {}, draws: {}, epochsVisited: [] }
   localStorage.setItem('chess-arena:profile:v1', JSON.stringify(p))
   ```

   Musashi and Malakor are then the next chapters, and six characters are playable in Free Play. As before, cosmetics and trophies come only from real wins; `npm run test:legends` covers the full win path.
4. **Opening books to try.** Repertoire moves are played without the engine, so they are deterministic within a choice set:
   - **Ragnar** (you play White): 1.d4 → 1…g5 or 1…f5. As White he opens 1.e4 (King's Gambit) or 1.g4.
   - **Musashi** (you play White): 1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 → **5…a6** (Najdorf).
   - **Aerith** (you play Black): she opens 1.b3 or 1.g3.
   - **Malakor** (you play White): 1.d4 → 1…e5 (Englund) or 1…Nf6 2.c4 e5 (Budapest).
5. **Free Play.** Pick a defeated character, then set the strength, side and time control. Try **Custom** with the minute/increment sliders. The player bar shows e.g. "~2800 · Mythic". Locked characters show "Defeat in campaign".
6. **Mobile.** Check these sizes in DevTools device mode, or on device via Capacitor:
   - **390×844** and **375×667** in one-handed mode: the selector cards stack, the timeline scrolls horizontally, and battles fit without page scroll.
   - **844×390** landscape: the battle uses the side rail with the character bar beside the board.

---

## What's new in 3.1: Chronos Chess, historical legends & eras

Travel through four epochs and play legendary historical figures, each with a distinct, engine-backed playing style.

| Chapter | Epoch | Legend | Rating | How they play |
|---|---|---|---|---|
| I | Ancient World (Ptolemaic Egypt) | **Cleopatra VII** | ~1300 | Cunning and patient. Avoids trades and favours moves that **fork** valuable pieces. Her book includes the **Blackburne Shilling trap** (…Nd4). |
| II | Scientific Revolution (1687) | **Sir Isaac Newton** | ~1750 | Slow and methodical: 1.8 s minimum think, deep search, tight tolerance. Castles early, keeps a solid structure, avoids sacrifices. Plays the Queen's Gambit, Caro-Kann and Slav. |
| III | Napoleonic Empire (1805) | **Napoleon Bonaparte** | ~2000 | Relentless. Heavy king-pressure and **sacrifice** weights, never trades willingly, and moves fast. Plays the Napoleon Attack (1.e4 e5 2.Qf3), King's Gambit, Elephant and Latvian Gambits. |
| IV | Modern Physics (1905) | **Albert Einstein** | ~2300 | Creative. A **creativity** weight deliberately reaches for lower-ranked (but sound) MultiPV lines, with high randomness and gambits such as 1.b4, the Evans Gambit and the Budapest Gambit. |

### How a persona becomes a playing style

Every legend has an `OpponentProfile` in `src/data/eras/legends.ts` (fantasy characters: `src/data/realms/legends.ts`). The fields are:

- **Strength:** Stockfish `skillLevel`, `depth`, `moveTimeMs`, and `minThinkMs` (a human-like pause).
- **Candidates:** `multiPv`, the number of candidate lines Stockfish returns. `toleranceCp` sets how far below the best move a stylish choice may be.
- **Personality:** `StyleWeights`, which re-score each candidate. The base weights are check, capture, forcing, king pressure, advance, castling, king shelter, trades, centre, development, quiet moves and early queen moves. Three are new for 3.1:
  - **`sacrifice`**: rewards leaving material en prise for initiative.
  - **`fork`**: rewards moves where the moved piece attacks two or more valuable targets.
  - **`creativity`**: rewards lower-ranked MultiPV lines.
- **Randomness:** `noise`, a creativity / unpredictability factor.
- **Openings:** a **per-colour repertoire** (SAN lines) played while the game stays in book.

Forced mates are never passed up. The move picker is shared with the regular personalities (`engine/personalities.ts`), so Quick Play and Legends use one code path.

### Era overhaul

Each epoch overrides the whole app while you browse it on the Legends screen or play its legend. This uses a non-persisted `themeOverrideStore`, so your saved theme is untouched.

| Epoch | Board | Pieces | Piece sound | Soundtrack texture |
|---|---|---|---|---|
| Ancient | Papyrus & Gold (papyrus / sienna, lapis frame) | Lapis & Gold | marble | E Phrygian-dominant drone + harp plucks |
| Scientific | Principia Blueprint (navy drafting grid) | Quill & Ink | wood | harpsichord-style arpeggios over a I–V–vi–IV continuo |
| Napoleonic | Imperial Velvet (ivory / blue velvet, gold & crimson frame) | Grande Armée | metal | brass pads + military snare cadence |
| Modern | Chalkboard 1905 (slate, chalk dust) | Chalk Sketch | soft | jazz-voiced electric-piano harmony (maj9 / m11 / 13) |

The accent colours, page background, status-bar `theme-color`, particles and the **adaptive soundtrack** all switch too. The soundtrack still follows game tension, and needs Settings → Audio → Ambient soundtrack turned on. Each battle opens with a **time-warp** intro (a tunnel animation and a "warp" sound), which battery saver skips.

### Dialogue & reactions

Each legend has in-character lines for 12 triggers:
- the intro, and thinking
- you taking too long (25 s)
- captures by either side, giving or receiving check
- the advantage swinging past ±2.5 pawns
- winning, losing and drawing

Lines appear in a typewriter speech bubble anchored to the legend's player bar. The bubble overlays the board edge, so it never shifts the one-handed or landscape layouts. A cooldown and per-trigger probabilities stop the legend from monologuing.

The dialogue is written for the game: a few lines riff on popularly attributed sayings, but none are presented as verified historical quotations. Portraits are **iconographic emblems** (an era gradient, a symbol and a monogram), not likenesses, and they need no image assets.

### Campaign & rewards

- **Boss progression.** Chapters unlock in order: each legend becomes challengeable once the previous one is defeated.
- **First victory.** A large coin bounty (**300 / 500 / 700 / 1000**). It also permanently unlocks that epoch's **board theme and piece set** for everyday play; these can't be bought in the shop.
- **Rematches.** Smaller bounties (40–100). Defeated legends also appear under **Legend opponents** in *New game → vs Computer* (Quick Play).
- **Rating.** Legend games are rated against the legend's rating. They also count toward quests, stats and match history, and you can review them with the epoch theme.
- **Trophies:**
  - **Dethroned the Nile**
  - **Gravity Defied**
  - **Calculated by Newton** (last 40+ moves against Newton)
  - **Your Waterloo, Sire**
  - **Relativity Defeated**
  - **Time Traveler** (fight in all four epochs)
  - **Master of Time** (defeat all four)
- **Hall of Legends.** Your record against each legend is shown on the Profile.

### Testing Chronos Chess locally

```bash
cd chess
npm install
npm run dev              # open the Legends tab (hourglass icon)
npm run test:legends     # campaign/reward/repertoire/style-filter logic tests
npm run validate:data    # also replays every legend repertoire line with chess.js
```

1. **Browse the timeline.** Open the **Legends** tab. Selecting an epoch re-themes the whole app. Newton, Napoleon and Einstein are locked at first.
2. **Fight a legend.** Choose a side and time control, then press **Travel & challenge**. You'll see the time-warp intro and the legend's opening remark. Then try their books:
   - **Cleopatra** (you play White): 1.e4 e5 2.Nf3 Nc6 3.Bc4 — she answers **3…Nd4**, the Blackburne Shilling trap.
   - **Napoleon** (you play Black): he opens 1.e4, and after 1…e5 he plays 2.Qf3 or 2.f4.
   - **Newton** (you play White): 1.e4 → 1…c6.
   - **Einstein** (you play White): 1.e4 → 1…Nf6.
3. **Reactions.** Wait 25 s on your move, capture something, or give check, and a speech bubble appears.
4. **Rewards without beating every legend.** To try the later chapters straight away, seed the campaign in the browser console and reload:

   ```js
   const p = JSON.parse(localStorage.getItem('chess-arena:profile:v1') ?? '{"version":1}')
   p.legends = { defeated: { cleopatra: new Date().toISOString(), newton: new Date().toISOString(), napoleon: new Date().toISOString() }, wins: {}, losses: {}, draws: {}, epochsVisited: [] }
   localStorage.setItem('chess-arena:profile:v1', JSON.stringify(p))
   ```

   Einstein is then unlocked, and the three seeded legends appear in Quick Play. Epoch cosmetics are granted by an actual first win, not by this seed.
5. **Mobile.**
   - Enable Settings → General → One-handed mode. The legend's bubble then floats over the top of the board, and the dock shows "*Legend* is thinking…".
   - Rotate to landscape to check the side rail. The legend bar and bubble move beside the board.

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
│   ├── validate-data.mjs          # checks openings, puzzle solutions and legend repertoires
│   └── run-ts-test.mjs            # bundles + runs TS logic tests (tests/legends.test.ts)
├── public/
│   ├── favicon.svg
│   └── stockfish/                 # (generated, git-ignored) engine .js + .wasm
└── src/
    ├── main.tsx · App.tsx         # app shell, navigation, lazy views
    ├── audio/                     # procedural audio engine
    │   ├── AudioEngine.ts         #   context, buses, reverb, unlock/suspend
    │   ├── synth.ts               #   tone / noise voice primitives
    │   ├── pieceSounds.ts         #   wood · marble · metal · synth · soft · crystal · ember impacts
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
    │   ├── questActions.ts        #   feeds game events into daily quests
    │   ├── dialogueStore.ts       #   legend remarks (cooldown, no repeats)
    │   └── themeOverrideStore.ts  #   temporary epoch theme (not persisted)
    ├── components/
    │   ├── board/                 #   ChessBoard, EvalBar, BoardHologram, PromotionDialog
    │   ├── game/                  #   PlayerBar, PlayerAvatar, ChessClock, TimeMachine, MoveHistory,
    │   │                          #   ThumbDock (one-handed), GameMenuSheet
    │   ├── rush/                  #   RushHud, ScorePopups
    │   ├── quests/                #   QuestCard
    │   ├── settings/              #   AudioPanel (mixer), HapticsPanel (channels)
    │   ├── legends/               #   CampaignSelect (universe switcher), EpochSelector (chapter map),
    │   │                          #   FreePlayPanel, LegendDossier, LegendPortrait,
    │   │                          #   LegendDialogue (speech bubble), TimeWarpOverlay
    │   ├── analysis/              #   AnalysisPanel, EvalGraph, ClassificationBadge
    │   ├── modals/                #   NewGame, GameOver, Settings
    │   ├── profile/ · shop/       #   EloChart, AchievementGrid, MatchHistory, ThemeSwatch
    │   ├── effects/               #   ConfettiCanvas
    │   ├── layout/                #   AppHeader, BottomNav
    │   └── ui/                    #   Modal, Button, Toggle, ToastViewport, PieceIcon, GestureGuide, SwipeFeedback…
    ├── views/                     # PlayView · LegendsView · RushView · PuzzlesView · QuestsView · ProfileView · ShopView
    ├── constants/                 # difficulty/personality tuning, themes, achievements, economy, quests, rush
    ├── data/                      # openings.ts (189 lines) · puzzles.ts (120 verified mates)
    │   ├── eras/                  #   epochs.ts · legends.ts (6 historical characters)
    │   ├── realms/                #   realms.ts · legends.ts (Aerith, Malakor)
    │   ├── campaigns.ts           #   chapter order + completion trophies
    │   └── legends.ts             #   aggregator: lookup, gating, strengths, labels
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
| `npm run check` | Typecheck + lint (oxlint) + data validation + legend logic tests |
| `npm run test:legends` | Chronos Chess logic tests (campaign, rewards, shop, repertoires, style filter) |
| `npm run validate:data` | Replay every opening line, puzzle solution and legend repertoire line |
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
