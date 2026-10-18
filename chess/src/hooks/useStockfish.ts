import { useCallback, useEffect, useRef, useState } from 'react'
import { STOCKFISH_WORKER_PATH } from '../constants/game'
import type { EngineConfig } from '../types/chess'
import { StockfishEngine } from '../utils/stockfishEngine'

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'error'

interface EngineState {
  status: 'idle' | 'ready' | 'error'
  error: string | null
}

const IDLE: EngineState = { status: 'idle', error: null }

/** Boots Stockfish in a Web Worker while `enabled` and tears it down otherwise. */
export function useStockfish(enabled: boolean) {
  const engineRef = useRef<StockfishEngine | null>(null)
  const [state, setState] = useState<EngineState>(IDLE)

  useEffect(() => {
    if (!enabled) return
    let disposed = false

    StockfishEngine.create(STOCKFISH_WORKER_PATH)
      .then((engine) => {
        if (disposed) {
          engine.terminate()
          return
        }
        engineRef.current = engine
        setState({ status: 'ready', error: null })
      })
      .catch((err: unknown) => {
        if (disposed) return
        setState({ status: 'error', error: err instanceof Error ? err.message : 'Unable to start the engine' })
      })

    return () => {
      disposed = true
      engineRef.current?.terminate()
      engineRef.current = null
      setState(IDLE)
    }
  }, [enabled])

  const getBestMove = useCallback((fen: string, config: EngineConfig): Promise<string> => {
    const engine = engineRef.current
    if (!engine) return Promise.reject(new Error('Engine not started'))
    return engine.getBestMove(fen, config)
  }, [])

  const stop = useCallback(() => engineRef.current?.stop(), [])
  const newGame = useCallback(() => engineRef.current?.newGame(), [])

  // "loading" is derived: enabled but not yet resolved either way.
  const status: EngineStatus = enabled && state.status === 'idle' ? 'loading' : state.status

  return { status, error: state.error, getBestMove, stop, newGame }
}
