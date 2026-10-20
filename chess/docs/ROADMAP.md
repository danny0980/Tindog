# Overkill roadmap: execution plan

Twenty features in four phases, all shipped:
- **Phase A** in 6.11;
- **Phase B** in 6.12;
- **Phase C** in 6.13;
- **Phase D** in 6.14;
- the online modes and the production server in 6.15.

The plan below is kept as the design record. The status table at the end says what shipped and what was left out.

Principles carried through every phase:
- **Pure core, thin UI.** Decisions such as which shot, which move, which card or which bracket live in plain TypeScript under `src/<area>/` with unit tests. Components only draw and wire.
- **One code path per concept.** New modes reuse `VariantGame` (custom rules over chess.js), `useEngine` (Stockfish workers), the persona system, the profile store with its sanitisers, and the Node server's hub, matchmaker and store.
- **Opt-out and cheap.** Every effect respects battery saver and `prefers-reduced-motion`, and costs nothing when idle.
- **Honest data.** Game dialogue is never presented as a historical quotation, and server-side rules are authoritative online.

---

## Phase A: cinematic visuals and reactive board (shipped in 6.11)

| Feature | Modules | Notes |
| --- | --- | --- |
| Live cinematic camera | `src/cinema/director.ts` (pure), `components/cinema/CinemaStage.tsx` | Covers checkmate, promotion, a falling queen, and (in *Every highlight*) other winning captures and checks. Each shot pushes in with a 3D tilt and roll, slows the pieces down, blurs everything outside the focus, and drops letterbox bars before snapping back. A cooldown of 3 plies stops shots crowding together, and a tap cuts a shot short. It replaces the old 2D kill-cam. |
| Living battlefields and piece reactions | `src/cinema/terrain.ts`, `src/cinema/pieceStates.ts`, `components/cinema/Battlefield.tsx`, board VFX CSS | Six terrains (sand, snow, sea, forest, ember, starfield). By default the terrain follows the board theme. Captured pieces dissolve and break into the terrain's particles. A king in check trembles, a forking knight shines, and a pawn near promotion glows. |
| Automatic highlight reels | `src/cinema/highlights.ts` (pure), `reelRenderer.ts`, `recordReel.ts`, `pieceImages.ts`, `HighlightReelModal.tsx` | Picks up to 5 moments (mate, sacrifices, big captures, promotions, and brilliant moves once the game is analysed) into a film of 30 s or less. The film is drawn on a canvas with the board's own pieces and recorded with MediaRecorder: MP4 where the browser can write it, WebM otherwise. |

---

## Phase B: advanced AI and mind mechanics

### B1. Ghost of Yourself
- **`src/ghost/profile.ts` (pure):** builds a *style fingerprint* from `profile.matches` PGNs:
  - an opening tree (your moves by position, with counts);
  - aggression (capture and check rate);
  - trading tendency;
  - average centipawn loss by phase (from saved analyses);
  - preferred castling side;
  - time use.
- **`src/ghost/ai.ts`:** plays your book moves while the position is in your tree. After that it asks Stockfish for MultiPV candidates and re-ranks them toward your fingerprint. This is the same pattern as `src/variants/ai.ts`. A tolerance tuned from your average loss makes it miss what you would miss.
- **UI:** a "Ghost" opponent card on the Play screen, built from your last N games. It shows the fingerprint as a small radar.
- **Tests:**
  - a fixed set of PGNs gives the expected tree and stats;
  - the ghost follows the book and its re-ranking is deterministic with a seeded RNG.
- **Risk:** with fewer than about 10 games the fingerprint is thin. The card then says so and falls back to an Elo-matched persona.

### B2. What-If branching and the predictive coach
- **`src/whatif/branch.ts`:** a branch tree over the main line, made of `{ply, moves[]}` nodes, where any ply can fork into a sandbox.
- **UI:** a split screen with the live board on one side and a sandbox board on the other. The sandbox has its own eval bar from a second `useEngine('analysis')`. A "Promote to main line" button is available in analysis only.
- **`src/coach/patterns.ts` (pure):** mines your analysed games for recurring tactical misses:
  - an undefended piece left en prise;
  - a missed fork;
  - a back-rank weakness;
  - an early queen sortie.

  These are detected with chess.js plus the stored `MoveAnalysis` data.
- **Live warning:** before you commit a move matching a known pattern, a non-blocking banner warns you, for example: *"You lost 3 of your last 10 games to a back-rank mate. Your king has no luft."* Its sensitivity is set in Settings.
- **Tests:**
  - every pattern detector is checked on hand-made FENs;
  - the warning is throttled to at most one per 6 plies.

### B3. Stockfish Brain Visualizer
- **Engine:** extends `StockfishEngine` streaming. MultiPV parsing already exists (`INFO_PATTERN`). The new part is a `think` channel that emits `{depth, lines: [{pv, score}]}` while the engine is searching.
- **`src/brain/arrows.ts` (pure):** turns lines into arrows. The best line is solid; the 2nd and 3rd candidates are dashed and fade with their score gap. Lines the engine drops between depths are shown briefly in red as "discarded plans".
- **UI:**
  - a toggleable overlay on the board using `ChessBoard`'s existing `arrows` prop;
  - a depth meter and a small list of candidate lines;
  - hovering a line previews it on a ghost board.
- **Tests:** the parser runs on recorded `info` output, and arrow styling is checked by score gap.

---

## Phase C: history, campaigns and custom armies

### C1. Historical World War and the army builder
- **Map:** `src/war/` holds a world map of territories, each with an era, a terrain from Phase A and an owner. It reuses the Grand Campaign map renderer and node graph.
- **Battles:** each territory battle is a Classic character or a historic battle from 6.10 (`BattleRules`).
- **`src/war/turns.ts` (pure):**
  - the AI empires advance one territory per real day, or per turn in "blitz war" mode;
  - your defeats can cost territory;
  - holding a whole era grants a relic.
- **Army builder (`src/army/`):** draft defeated Classic characters into piece slots: King, Queen, two Rooks, two Bishops and two Knights. Each character gives one small passive trait, built on the existing tactic and relic hooks in `spellEngine`. Examples:
  - *Napoleon (King):* +1 free undo per battle;
  - *Cleopatra (Queen):* the queen's first capture shows a "charm" VFX and refunds 10 s on the clock;
  - *Nemesis (Rook):* no special rule, cosmetic only.

  Traits are capped so they never alter legal moves in rated play. The army works only in campaign and war modes.
- **Tests:** turn resolution, the ownership invariants, and the trait budget (the sum of trait points is at most the cap).

### C2. Memory-bearing opponents and the 3D museum
- **`profile.rivalries[classicId]`:** stores wins, losses, the last result, your favourite opening against them and the date.
- **`classicPersona()` gains a `memory` argument:**
  - their greeting picks from "first meeting", "you beat me last time", "I have you now" and "our fifth game" line sets, written per archetype so the 100 characters don't need 100× new lines;
  - their strength shifts ±100 Elo after streaks, within a capped band;
  - their opening avoids the line that beat them last time.
- **3D museum:** a three.js scene (three is already a dependency for the intro), lazy-loaded.
  - It is a walkable hall with instanced plinths.
  - Each statue is the character's portrait on a lit bust, with glow intensity growing with the number of wins.
  - Orbit and drag controls work on mobile.
  - The current CSS museum remains the fallback for low power and no WebGL.
- **Tests:** memory updates, line selection, the Elo band clamp, and the museum layout (positions computed in a pure module).

---

## Phase D: competitive server and new modes

### D1. Seasons, spectating and weekly tournaments (Node server)
- **Seasons:** `server/seasons.ts` defines monthly seasons with soft rating resets (pull toward 1500 by 25%), tiers from Bronze to Legend, and end-of-season rewards stored per user. A cron-style timer runs in `index.ts`.
- **Spectating:** `server/hub.ts` gains `SPECTATE {gameId}`. The server streams moves to watchers, who are read-only. A rate-limited eval comes from the client watcher's own Stockfish, so the server has no engine cost. There is also a live list of top games.
- **Tournaments:** `server/tournaments.ts` runs 32-player knockouts.
  - Sign-ups close at a fixed weekly time.
  - Brackets are seeded by rating, with byes for missing players.
  - Rounds are timed and a no-show forfeits.
  - Rounds reuse the existing ranked game code path.
- **Protocol:** the new messages go into `src/online/ranked/protocol.ts` with validators.
- **Tests:**
  - the existing `tests/server.test.ts` harness (real WebSocket clients) gets tournament runs with 32 and 13 players (byes);
  - season rollover and spectator fan-out are tested too.
- **Risk:** storage is a JSON file today. Tournaments and spectating are fine at hobby scale, but SQLite should come in before a public launch.

### D2. Battle Royale and Card Chess
- **Card Chess:** this is small and fits the existing engine.
  - `src/cards/` defines cards as `VariantGame` rule hooks, for example *Jumping Pawn* (one pawn may move two squares from any rank, once) and *Stone Wall* (a chosen rook square cannot be captured for 2 turns).
  - Players draft 3 cards from 5 before the game, and the AI drafts by a simple value table.
  - Ranked online play needs server validation of card effects, so card play stays unrated at first.
- **Battle Royale (4 players):** this is a different game. chess.js can't play it, so it needs its own rules core in `src/royale/`.
  - The board is 14×14 with corners cut, as in four-player chess.
  - Turns rotate between four players.
  - A checkmated or timed-out player's pieces turn grey and become obstacles.
  - The last king standing wins.
  - The AI is a lightweight minimax on that core, since Stockfish can't play it.
  - Online play is a 4-seat room on the hub.
  - This is the largest item in the roadmap and should be its own milestone.

### D3. Blindfold Vanishing Chess and historical escape rooms
- **Vanishing Chess:** pieces fade out progressively, with each piece disappearing N plies after it last moved. N shrinks as the game goes on.
  - It is a `ChessBoard` render filter: `pieceStates` gains a `vanish` level, so the rules are untouched.
  - It has a separate rating, `vanishElo`, with its own matchmaking pool on the server.
  - **Tests:** the visibility schedule is checked, and the server pool is kept separate.
- **Escape rooms:** `src/escape/` holds rooms that are sequences of puzzles from the puzzle database and the Classic lore.
  - Each solved puzzle "opens a lock" and reveals the next clue.
  - Narrative text is built from lore facts, so the history stays true.
  - Rooms are themed by era and terrain.
  - **Tests:** every room is solvable, every clue fact exists in the lore, and progress is saved.

---

## Suggested order and size

| Order | Item | Size | Why this order |
| --- | --- | --- | --- |
| 1 | B3 Brain Visualizer | S | Mostly engine plumbing that B1 and B2 also need. |
| 2 | B2 What-If and coach | M | Reuses analysis, and the predictive coach builds on the B3 stream. |
| 3 | B1 Ghost | M | Needs the candidate re-ranking proven in B3. |
| 4 | C2 Memory and 3D museum | M | Persona plumbing first, then the three.js hall. |
| 5 | C1 World War and army | L | Builds on C2's rivalry memory and the 6.10 battles. |
| 6 | D3 Vanishing and escape rooms | M | Client-heavy; the server only needs a new pool. |
| 7 | D2 Card Chess | M | A `VariantGame` extension. |
| 8 | D1 Seasons, spectating and tournaments | L | Server work, best done together with the storage upgrade. |
| 9 | D2 Battle Royale | XL | A new rules engine and AI; its own milestone. |

---

## Status (6.15)

| Item | Shipped | Left out (and why) |
| --- | --- | --- |
| Cinematic camera, battlefields, living pieces, highlight reels | 6.11 | — |
| Ghost, engine brain, What-If, predictive coach | 6.12 | — |
| World War, Custom Army, opponent memory, 3D hall | 6.13 | — |
| Seasons, Weekly Knockout, spectating with eval graph, clans and clan war | 6.14 | — |
| SQLite storage, backups, production build, Docker and security headers | 6.15 | — |
| Battle Royale | 6.14 (vs computer), 6.15 (online, 4 seats, computer armies fill empty seats) | Castling and en passant are not part of its rules. |
| Card Chess | 6.14 (vs computer), 6.15 (online, rated) | — |
| Vanishing Chess | 6.14 (vs computer), 6.15 (online ranked queue) | The fading is drawn by your own browser. The server has to send every move, so a modified client could show the pieces: a fair-play limit of any online blindfold mode. |
| Escape Rooms | 6.14 | — |

Live games are in-process: one server, and a restart ends the games in progress. Moving to several server processes would need a shared message bus, such as Redis, between them.
