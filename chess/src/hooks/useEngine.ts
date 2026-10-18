import { useCallback, useEffect, useRef, useState } from 'react'
import { enginePool } from '../engine/enginePool'
import type { StockfishEngine } from '../engine/StockfishEngine'
import type { EngineRole, EngineStatus, SearchOptions, SearchResult } from '../types/engine'

interface EngineState {
  status: 'idle' | 'ready' | 'error'
  error: string | null
}

const IDLE: EngineState = { status: 'idle', error: null }

/** Holds a pooled Stockfish worker for `role` while `enabled`. */
export function useEngine(role: EngineRole, enabled: boolean) {
  const engineRef = useRef<StockfishEngine | null>(null)
  const [state, setState] = useState<EngineState>(IDLE)

  useEffect(() => {
    if (!enabled) return
    let disposed = false
    enginePool
      .acquire(role)
      .then((engine) => {
        if (disposed) return
        engineRef.current = engine
        setState({ status: 'ready', error: null })
      })
      .catch((err: unknown) => {
        if (!disposed) setState({ status: 'error', error: err instanceof Error ? err.message : 'Unable to start the engine' })
      })
    return () => {
      disposed = true
      engineRef.current?.stop()
      engineRef.current = null
      enginePool.release(role)
      setState(IDLE)
    }
  }, [enabled, role])

  const search = useCallback((fen: string, options: SearchOptions): Promise<SearchResult> => {
    const engine = engineRef.current
    if (!engine || engine.isDisposed) return Promise.reject(new Error('Engine not ready'))
    return engine.search(fen, options)
  }, [])

  const stop = useCallback(() => engineRef.current?.stop(), [])
  const newGame = useCallback(() => engineRef.current?.newGame(), [])

  const status: EngineStatus = enabled && state.status === 'idle' ? 'loading' : state.status
  return { status, error: state.error, search, stop, newGame }
}

export type EngineHandle = ReturnType<typeof useEngine>
