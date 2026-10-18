import { useEffect, useState } from 'react'
import { evaluatePosition, terminalEval } from '../engine/analysis'
import { getAnyCachedEval } from '../engine/evalCache'
import type { PositionEval } from '../types/analysis'
import type { EngineHandle } from './useEngine'

/**
 * Live evaluation of `fen` for the advantage bar. Debounced so scrubbing
 * through history or fast moves don't queue up searches, and served from the
 * shared cache when the position was already analysed.
 */
export function useEvaluation(engine: EngineHandle, fen: string, enabled: boolean, depth: number): PositionEval | null {
  const [result, setResult] = useState<{ fen: string; evaluation: PositionEval } | null>(null)
  const { search, stop, status } = engine

  useEffect(() => {
    if (!enabled || status !== 'ready') return
    let cancelled = false
    const timer = window.setTimeout(() => {
      evaluatePosition(fen, depth, (f) => search(f, { depth, multiPv: 1 }))
        .then((evaluation) => {
          if (!cancelled) setResult({ fen, evaluation })
        })
        .catch(() => undefined)
    }, 180)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      stop()
    }
  }, [depth, enabled, fen, search, status, stop])

  if (!enabled) return null
  if (result?.fen === fen) return result.evaluation
  // While searching, show an exact/cached value if we have one, else the last value.
  return terminalEval(fen) ?? getAnyCachedEval(fen) ?? result?.evaluation ?? null
}
