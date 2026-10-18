import type { EngineConfig } from '../types/chess'

type LineListener = (line: string) => void

export class EngineError extends Error {
  override name = 'EngineError'
}

/**
 * Minimal UCI client for the Stockfish WASM build running in a Web Worker.
 * Searches are serialized: a new request first stops any running search and
 * waits for its `bestmove` before starting, so replies never get crossed.
 */
export class StockfishEngine {
  private readonly worker: Worker
  private readonly listeners = new Set<LineListener>()
  private readonly ready: Promise<void>
  private queue: Promise<unknown> = Promise.resolve()
  private searching = false
  private disposed = false
  private currentSkill: number | null = null

  private constructor(workerUrl: string) {
    this.worker = new Worker(workerUrl)
    this.worker.addEventListener('message', (event: MessageEvent<unknown>) => {
      if (typeof event.data !== 'string') return
      for (const line of event.data.split('\n')) {
        const trimmed = line.trim()
        if (trimmed) this.listeners.forEach((listener) => listener(trimmed))
      }
    })

    this.ready = new Promise<void>((resolve, reject) => {
      const onError = (event: ErrorEvent) => {
        reject(new EngineError(event.message || 'Failed to load the Stockfish engine'))
      }
      this.worker.addEventListener('error', onError, { once: true })
      this.waitFor((line) => line === 'uciok')
        .then(() => {
          this.send('setoption name UCI_AnalyseMode value false')
          this.send('ucinewgame')
          return this.isReady()
        })
        .then(() => {
          this.worker.removeEventListener('error', onError)
          resolve()
        })
        .catch(reject)
      this.send('uci')
    })
  }

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

  /** Clears engine hash tables between games. */
  newGame(): void {
    if (this.disposed) return
    this.stop()
    this.queue = this.queue
      .catch(() => undefined)
      .then(async () => {
        await this.ready
        this.send('ucinewgame')
        await this.isReady()
      })
      // Nobody awaits this housekeeping step; never surface it as an unhandled rejection.
      .catch(() => undefined)
  }

  /** Returns the best move for `fen` in UCI notation (e.g. "e2e4", "e7e8q"). */
  getBestMove(fen: string, config: EngineConfig): Promise<string> {
    this.stop()
    const task = this.queue
      .catch(() => undefined)
      .then(() => this.search(fen, config))
    this.queue = task
    return task
  }

  /** Interrupts a running search; its pending promise resolves with the best move found so far. */
  stop(): void {
    if (this.searching && !this.disposed) this.send('stop')
  }

  terminate(): void {
    if (this.disposed) return
    this.disposed = true
    this.stop()
    this.listeners.clear()
    this.worker.terminate()
  }

  private async search(fen: string, config: EngineConfig): Promise<string> {
    await this.ready
    if (this.disposed) throw new EngineError('Engine has been terminated')

    if (this.currentSkill !== config.skillLevel) {
      this.send(`setoption name Skill Level value ${config.skillLevel}`)
      this.currentSkill = config.skillLevel
      await this.isReady()
    }

    this.send(`position fen ${fen}`)
    const bestMoveLine = this.waitFor((line) => line.startsWith('bestmove'))
    this.searching = true
    this.send(`go depth ${config.depth} movetime ${config.moveTimeMs}`)

    try {
      const line = await bestMoveLine
      const move = line.split(/\s+/)[1]
      if (!move || move === '(none)') throw new EngineError('Engine returned no move')
      return move
    } finally {
      this.searching = false
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
      const listener: LineListener = (line) => {
        if (!predicate(line)) return
        this.listeners.delete(listener)
        resolve(line)
      }
      this.listeners.add(listener)
    })
  }

  private send(command: string): void {
    if (!this.disposed) this.worker.postMessage(command)
  }
}
