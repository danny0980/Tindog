// Tests for the engine's resilience (6.16), with a scripted stand-in for the
// Stockfish Web Worker: a crash mid-search fails the search instead of
// hanging it; the pool replaces a crashed worker; a worker that never answers
// counts as failed; a search stopped early is marked as interrupted. Also the
// shared Card Chess notation and the history replays.
// Run with `npm run test:engine`.
import type { HistoryGame } from '../src/online/ranked/api'

let failures = 0
const check = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) failures += 1
}
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms))

type Mode = 'normal' | 'silent' | 'slow'
/** A scripted Stockfish: answers `uci`, `isready`, `go` and `stop` like the real one. */
class FakeWorker {
  static mode: Mode = 'normal'
  static made: FakeWorker[] = []
  private readonly listeners = new Map<string, Set<(e: unknown) => void>>()
  terminated = false
  private searching: ReturnType<typeof setTimeout> | null = null
  constructor(_url: string) {
    FakeWorker.made.push(this)
  }
  addEventListener(type: string, fn: (e: unknown) => void): void {
    const set = this.listeners.get(type) ?? new Set()
    set.add(fn)
    this.listeners.set(type, set)
  }
  removeEventListener(type: string, fn: (e: unknown) => void): void {
    this.listeners.get(type)?.delete(fn)
  }
  private emit(line: string): void {
    if (this.terminated) return
    for (const fn of this.listeners.get('message') ?? []) fn({ data: line })
  }
  postMessage(cmd: string): void {
    if (this.terminated || FakeWorker.mode === 'silent') return
    setTimeout(() => {
      if (cmd === 'uci') this.emit('uciok')
      else if (cmd === 'isready') this.emit('readyok')
      else if (cmd.startsWith('go')) {
        this.emit('info depth 4 multipv 1 score cp 25 pv e2e4 e7e5')
        this.searching = setTimeout(() => this.finish(), FakeWorker.mode === 'slow' ? 5000 : 10)
      } else if (cmd === 'stop' && this.searching) {
        clearTimeout(this.searching)
        this.finish()
      }
    }, 1)
  }
  private finish(): void {
    this.searching = null
    this.emit('bestmove e2e4')
  }
  /** The worker dies (a WASM trap, out of memory). */
  crash(): void {
    for (const fn of this.listeners.get('error') ?? []) fn({ message: 'RuntimeError: unreachable', preventDefault: () => {} })
  }
  terminate(): void {
    this.terminated = true
    if (this.searching) clearTimeout(this.searching)
  }
}
const g = globalThis as unknown as Record<string, unknown>
g.Worker = FakeWorker
g.window = globalThis

const { StockfishEngine } = await import('../src/engine/StockfishEngine')
const { enginePool } = await import('../src/engine/enginePool')
const { cardNotation, parseCardNotation } = await import('../src/online/ranked/modeRules')
const { replayAt, replayLength } = await import('../src/online/ranked/history')

const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

// ── A normal search, and one stopped early ──────────────────────────────────
{
  const engine = await StockfishEngine.create('sf.js')
  const r = await engine.search(FEN, { depth: 10 })
  check('a search answers with its best move', r.bestMove === 'e2e4' && r.lines[0]?.score.value === 25 && r.interrupted === undefined)
  FakeWorker.mode = 'slow'
  const p = engine.search(FEN, { depth: 20 })
  await tick(20)
  engine.stop() // e.g. the app went to the background
  const stopped = await p
  check('a search stopped early is marked as interrupted (its move may be shallow)', stopped.interrupted === true && stopped.bestMove === 'e2e4')
  FakeWorker.mode = 'normal'
  check('the next search is a normal one again', (await engine.search(FEN, { depth: 10 })).interrupted === undefined)
  engine.terminate()
}

// ── A crash mid-search ──────────────────────────────────────────────────────
{
  const engine = await StockfishEngine.create('sf.js')
  const crashes: string[] = []
  engine.onCrash((e) => crashes.push(e.message))
  FakeWorker.mode = 'slow'
  const search = engine.search(FEN, { depth: 20 })
  await tick(20)
  FakeWorker.made.at(-1)!.crash()
  const outcome = await search.then(
    () => 'resolved',
    (e: unknown) => (e instanceof Error ? e.message : 'rejected'),
  )
  FakeWorker.mode = 'normal'
  check('a crash fails the running search instead of hanging it forever', outcome.includes('unreachable'))
  check('the crash is reported once, and the worker is gone', crashes.length === 1 && engine.crashed && engine.isDisposed && FakeWorker.made.at(-1)!.terminated)
  check('a later search on the dead engine fails at once', await engine.search(FEN, { depth: 5 }).then(() => false, () => true))
  const late: string[] = []
  engine.onCrash((e) => late.push(e.message))
  check('a listener added after the crash hears about it at once', late.length === 1)
}

// ── A worker that never answers ─────────────────────────────────────────────
{
  const realSetTimeout = globalThis.setTimeout
  // Fast-forward the 20 s start-up limit.
  g.setTimeout = ((fn: () => void, ms?: number) => realSetTimeout(fn, ms && ms >= 20_000 ? 30 : ms)) as typeof setTimeout
  FakeWorker.mode = 'silent'
  const failed = await StockfishEngine.create('sf.js').then(
    () => 'started',
    (e: unknown) => (e instanceof Error ? e.message : 'failed'),
  )
  g.setTimeout = realSetTimeout
  FakeWorker.mode = 'normal'
  check('a worker that never answers counts as failed to start (no endless "loading")', failed.includes('too long'))
}

// ── The pool replaces a crashed worker ──────────────────────────────────────
{
  const first = enginePool.acquire('play')
  const e1 = await first
  e1.onCrash(() => {})
  FakeWorker.made.at(-1)!.crash()
  await tick(5)
  const second = enginePool.acquire('play')
  const e2 = await second
  check('after a crash, the next acquire starts a fresh worker', e2 !== e1 && !e2.isDisposed && (await e2.search(FEN, { depth: 5 })).bestMove === 'e2e4')
  // The holder of the crashed engine lets go: that must not release the new one.
  enginePool.release('play', first)
  const third = enginePool.acquire('play')
  check('releasing a crashed engine leaves its replacement alone', (await third) === e2)
  enginePool.release('play', second)
  enginePool.release('play', third)
}

// ── Card Chess notation and history replays ─────────────────────────────────
{
  const actions = [
    { k: 'm', uci: 'e2e4' },
    { k: 'c', card: 'knights-leap', from: 'f1', to: 'e3' },
    { k: 'c', card: 'reinforcements', from: null, to: 'a2' },
    { k: 'w', card: 'aegis', sq: 'd1' },
    { k: 'm', uci: 'e7e8q' },
  ] as const
  check('Card Chess notation reads back exactly', actions.every((a) => JSON.stringify(parseCardNotation(cardNotation(a))) === JSON.stringify(a)))
  check('nonsense notation is refused', parseCardNotation('c:joker:e2e4') === null && parseCardNotation('w:aegis:z9') === null && parseCardNotation('e2') === null)
  const game: HistoryGame = { id: 'h1', kind: 'chess', pool: '5+3', color: 'b', white: 'A', black: 'B', winner: 'b', reason: 'checkmate', moves: ['f2f3', 'e7e5', 'g2g4', 'd8h4'], hands: null, ratingChange: 8, endedAt: 0 }
  const end = replayAt(game, replayLength(game))
  check('a chess replay reaches the final position', end.kind === 'board' && end.moves.join(' ') === 'f3 e5 g4 Qh4#' && end.fen.startsWith('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR'))
  const mid = replayAt(game, 2)
  check('a replay can stop at any move (and clamps out-of-range moves)', mid.kind === 'board' && mid.ply === 2 && mid.lastMove?.to === 'e5' && replayAt(game, 99).kind === 'board' && (replayAt(game, -5) as { ply: number }).ply === 0)
  const old: HistoryGame = { id: 'h2', kind: 'royale', seat: 0, seats: ['A', 'B', 'C', 'D'], ranking: [0, 1, 2, 3], reason: 'last-king', actions: null, ratingChange: 0, endedAt: 0 }
  check('a Battle Royale recorded before replays existed says so', replayAt(old, 0).kind === 'none')
  const royale: HistoryGame = { ...old, actions: [{ k: 'm', from: [12, 5], to: [10, 5] }, { k: 'x', seat: 1 }] }
  const rf = replayAt(royale, 2)
  check('a Battle Royale replays from its log', rf.kind === 'royale' && rf.total === 2 && !rf.game.alive('blue') && rf.game.at([10, 5])?.owner === 'red')
  const broken: HistoryGame = { ...game, moves: ['e2e5'] }
  check('a damaged record shows a message instead of crashing', replayAt(broken, 1).kind === 'none')
}

if (failures > 0) {
  console.error(`\n${failures} engine check(s) failed.`)
  process.exit(1)
}
console.log('\nAll engine checks passed.')
process.exit(0)
