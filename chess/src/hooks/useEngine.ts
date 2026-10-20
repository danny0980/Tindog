import { useCallback, useEffect, useRef, useState } from 'react'
import { enginePool } from '../engine/enginePool'
import type { StockfishEngine } from '../engine/StockfishEngine'
import type { EngineRole, EngineStatus, SearchOptions, SearchResult } from '../types/engine'

interface EngineState {
  status: 'idle' | 'ready' | 'error'
  error: string | null
}

const IDLE: EngineState = { status: 'idle', error: null }

/** Automatic restarts after a failure or crash, before the error is shown with a Retry button. */
export const ENGINE_AUTO_RETRIES = 3
/** First restart delay; doubles each time (1 s, 2 s, 4 s). */
const RETRY_BASE_MS = 1000

/**
 * Holds a pooled Stockfish worker for `role` while `enabled`. If the worker
 * fails to start or crashes mid-game, it is restarted on its own (a few
 * times, backing off); after that `status` is 'error' and `retry()` starts
 * again. While restarting, `status` is 'loading' and `error` says why.
 */
export function useEngine(role: EngineRole, enabled: boolean) {
  const engineRef = useRef<StockfishEngine | null>(null)
  const [state, setState] = useState<EngineState>(IDLE)
  // Bumped to start the worker again (an automatic restart or a Retry press).
  const [attempt, setAttempt] = useState(0)
  const failures = useRef(0)

  useEffect(() => {
    if (!enabled) return
    let disposed = false
    let restartTimer: number | undefined
    let unsubscribe = () => {}
    const fail = (message: string) => {
      if (disposed) return
      engineRef.current = null
      failures.current += 1
      if (failures.current <= ENGINE_AUTO_RETRIES) {
        // Not shown as an error yet: say why we are restarting, and try again.
        setState({ status: 'idle', error: `${message} — restarting…` })
        restartTimer = window.setTimeout(() => setAttempt((a) => a + 1), RETRY_BASE_MS * 2 ** (failures.current - 1))
      } else setState({ status: 'error', error: message })
    }
    const acquired = enginePool.acquire(role)
    acquired
      .then((engine) => {
        if (disposed) return
        engineRef.current = engine
        failures.current = 0
        setState({ status: 'ready', error: null })
        unsubscribe = engine.onCrash((err) => fail(err.message))
      })
      .catch((err: unknown) => fail(err instanceof Error ? err.message : 'Unable to start the engine'))
    return () => {
      disposed = true
      window.clearTimeout(restartTimer)
      unsubscribe()
      engineRef.current?.stop()
      engineRef.current = null
      enginePool.release(role, acquired)
      setState(IDLE)
    }
  }, [enabled, role, attempt])

  const search = useCallback((fen: string, options: SearchOptions): Promise<SearchResult> => {
    const engine = engineRef.current
    if (!engine || engine.isDisposed) return Promise.reject(new Error('Engine not ready'))
    return engine.search(fen, options)
  }, [])

  const stop = useCallback(() => engineRef.current?.stop(), [])
  const newGame = useCallback(() => engineRef.current?.newGame(), [])
  /** Starts the engine again after it gave up (status 'error'). */
  const retry = useCallback(() => {
    failures.current = 0
    setAttempt((a) => a + 1)
  }, [])

  const status: EngineStatus = enabled && state.status === 'idle' ? 'loading' : state.status
  return { status, error: state.error, search, stop, newGame, retry }
}

export type EngineHandle = ReturnType<typeof useEngine>
