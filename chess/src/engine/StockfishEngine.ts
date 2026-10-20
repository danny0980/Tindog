import type { EngineLine, EngineScore, SearchOptions, SearchResult } from '../types/engine'

type LineListener = (line: string) => void

/** How long the worker has to answer `uci` before it counts as failed to start. */
const BOOT_TIMEOUT_MS = 20_000

export class EngineError extends Error {
  override name = 'EngineError'
}

const INFO_PATTERN = /^info .*?\bdepth (\d+)\b.*?\bmultipv (\d+)\b.*?\bscore (cp|mate) (-?\d+)(?: (?:lower|upper)bound)?.*?\bpv (.+)$/
const INFO_PATTERN_NO_MULTIPV = /^info .*?\bdepth (\d+)\b.*?\bscore (cp|mate) (-?\d+)(?: (?:lower|upper)bound)?.*?\bpv (.+)$/

export function parseInfoLine(line: string): EngineLine | null {
  const m = INFO_PATTERN.exec(line)
  if (m) {
    const [, depth, multipv, type, value, pv] = m
    return {
      depth: Number(depth),
      multipv: Number(multipv),
      score: { type: type === 'mate' ? 'mate' : 'cp', value: Number(value) } satisfies EngineScore,
      pv: (pv ?? '').trim().split(/\s+/),
    }
  }
  const n = INFO_PATTERN_NO_MULTIPV.exec(line)
  if (!n) return null
  const [, depth, type, value, pv] = n
  return {
    depth: Number(depth),
    multipv: 1,
    score: { type: type === 'mate' ? 'mate' : 'cp', value: Number(value) },
    pv: (pv ?? '').trim().split(/\s+/),
  }
}

/**
 * UCI client for the Stockfish WASM build running in a Web Worker.
 * Searches are serialized: a new request first stops any running search and
 * waits for its `bestmove`, so replies never get crossed.
 */
export class StockfishEngine {
  private readonly worker: Worker
  private readonly listeners = new Set<LineListener>()
  private readonly ready: Promise<void>
  private queue: Promise<unknown> = Promise.resolve()
  private searching = false
  private disposed = false
  /** The worker died (crashed, or never answered); it is gone for good. */
  private crashedWith: EngineError | null = null
  /** stop() was called while the current search ran: its result is a partial one. */
  private stopRequested = false
  /** Answered `uci`: an error from now on is a crash, before it a failed load. */
  private started = false
  private options = new Map<string, string>()
  /** Rejects every promise still waiting on the worker (a crash or termination). */
  private readonly waiters = new Set<(err: EngineError) => void>()
  private readonly crashListeners = new Set<(err: EngineError) => void>()

  /** Boots an engine and resolves once it has answered `uciok` / `readyok`. */
  static async create(workerUrl: string): Promise<StockfishEngine> {
    const engine = new StockfishEngine(workerUrl)
    try {
      await engine.ready
      return engine
    } catch (err) {
      engine.terminate()
      throw err
    }
  }

  private constructor(workerUrl: string) {
    this.worker = new Worker(workerUrl)
    this.worker.addEventListener('message', (event: MessageEvent<unknown>) => {
      if (typeof event.data !== 'string') return
      for (const line of event.data.split('\n')) {
        const trimmed = line.trim()
        if (trimmed) this.listeners.forEach((listener) => listener(trimmed))
      }
    })
    // A worker that throws (a failed download, out of memory, a WASM trap) is dead: fail everything waiting on it.
    this.worker.addEventListener('error', (event: ErrorEvent) => {
      event.preventDefault?.()
      this.crash(new EngineError(this.started ? event.message || 'The Stockfish engine stopped unexpectedly' : 'The Stockfish engine couldn’t load. Check your connection.'))
    })
    this.worker.addEventListener('messageerror', () => this.crash(new EngineError('The Stockfish engine sent an unreadable message')))

    this.ready = new Promise<void>((resolve, reject) => {
      // A worker that never answers (e.g. the WASM file is missing) counts as a failure too.
      const boot = setTimeout(() => this.crash(new EngineError('The Stockfish engine took too long to start')), BOOT_TIMEOUT_MS)
      this.waitFor((line) => line === 'uciok')
        .then(() => {
          this.send('setoption name Hash value 16')
          this.send('ucinewgame')
          return this.isReady()
        })
        .then(() => {
          clearTimeout(boot)
          this.started = true
          resolve()
        })
        .catch((err: unknown) => {
          clearTimeout(boot)
          reject(err)
        })
      this.send('uci')
    })
  }

  /** Called once if the worker dies after starting (not when it is terminated on purpose). Returns an unsubscribe. */
  onCrash(fn: (err: EngineError) => void): () => void {
    if (this.crashedWith) {
      fn(this.crashedWith)
      return () => {}
    }
    this.crashListeners.add(fn)
    return () => this.crashListeners.delete(fn)
  }

  get crashed(): boolean {
    return this.crashedWith !== null
  }

  private crash(err: EngineError): void {
    if (this.disposed) return
    this.crashedWith = err
    this.shutDown(err)
    for (const fn of [...this.crashListeners]) fn(err)
    this.crashListeners.clear()
  }

  private shutDown(err: EngineError): void {
    this.disposed = true
    this.searching = false
    this.listeners.clear()
    for (const reject of [...this.waiters]) reject(err)
    this.waiters.clear()
    this.worker.terminate()
  }

  get isDisposed(): boolean {
    return this.disposed
  }

  /** Clears engine hash tables between games. */
  newGame(): void {
    if (this.disposed) return
    this.stop()
    this.queue = this.queue
      .catch(() => undefined)
      .then(async () => {
        this.send('ucinewgame')
        await this.isReady()
      })
      .catch(() => undefined)
  }

  /** Runs a search; `lines` holds the deepest result for each MultiPV slot. */
  search(fen: string, options: SearchOptions): Promise<SearchResult> {
    this.stop()
    const task = this.queue.catch(() => undefined).then(() => this.runSearch(fen, options))
    this.queue = task
    return task
  }

  /** Interrupts a running search; its promise resolves with the best result so far. */
  stop(): void {
    if (this.searching && !this.disposed) {
      this.stopRequested = true
      this.send('stop')
    }
  }

  terminate(): void {
    if (this.disposed) return
    this.stop()
    this.crashListeners.clear()
    this.shutDown(new EngineError('Engine has been terminated'))
  }

  private setOption(name: string, value: string): boolean {
    if (this.options.get(name) === value) return false
    this.options.set(name, value)
    this.send(`setoption name ${name} value ${value}`)
    return true
  }

  private async runSearch(fen: string, options: SearchOptions): Promise<SearchResult> {
    await this.ready
    if (this.disposed) throw new EngineError('Engine has been terminated')

    const changedPv = this.setOption('MultiPV', String(options.multiPv ?? 1))
    const changedSkill = this.setOption('Skill Level', String(options.skillLevel ?? 20))
    const changed960 = this.setOption('UCI_Chess960', options.chess960 ? 'true' : 'false')
    if (changedPv || changedSkill || changed960) await this.isReady()

    this.stopRequested = false
    const lines = new Map<number, EngineLine>()
    const collector: LineListener = (line) => {
      if (!line.startsWith('info')) return
      const parsed = parseInfoLine(line)
      if (!parsed) return
      lines.set(parsed.multipv, parsed)
      options.onInfo?.([...lines.values()].sort((a, b) => a.multipv - b.multipv))
    }
    this.listeners.add(collector)

    this.send(`position fen ${fen}`)
    const bestMoveLine = this.waitFor((line) => line.startsWith('bestmove'))
    this.searching = true
    const limit = options.searchMoves && options.searchMoves.length > 0 ? ` searchmoves ${options.searchMoves.join(' ')}` : ''
    const go = (options.moveTimeMs ? `go depth ${options.depth} movetime ${options.moveTimeMs}` : `go depth ${options.depth}`) + limit
    this.send(go)

    try {
      const line = await bestMoveLine
      const bestMove = line.split(/\s+/)[1] ?? '(none)'
      return {
        bestMove,
        lines: [...lines.values()].sort((a, b) => a.multipv - b.multipv),
        ...(this.stopRequested ? { interrupted: true } : {}),
      }
    } finally {
      this.searching = false
      this.listeners.delete(collector)
    }
  }

  private isReady(): Promise<string> {
    const promise = this.waitFor((line) => line === 'readyok')
    this.send('isready')
    return promise
  }

  private waitFor(predicate: (line: string) => boolean): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (this.disposed) {
        reject(new EngineError('Engine has been terminated'))
        return
      }
      const fail = (err: EngineError) => {
        this.listeners.delete(listener)
        reject(err)
      }
      const listener: LineListener = (line) => {
        if (!predicate(line)) return
        this.listeners.delete(listener)
        this.waiters.delete(fail)
        resolve(line)
      }
      this.listeners.add(listener)
      this.waiters.add(fail)
    })
  }

  private send(command: string): void {
    if (!this.disposed) this.worker.postMessage(command)
  }
}
