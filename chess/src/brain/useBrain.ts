import { useEffect, useState } from 'react'
import { useEngine } from '../hooks/useEngine'
import { EMPTY_BRAIN, type BrainState, pruneBrain, reduceBrain } from './brain'

/** How deep the visualizer searches, and how often it repaints. */
export const BRAIN_DEPTH = 22
const PAINT_MS = 120

/** Runs a dedicated Stockfish on `fen` while enabled and streams what it is thinking. */
export function useBrain(fen: string | null, enabled: boolean, lines = 3): { state: BrainState; status: ReturnType<typeof useEngine>['status'] } {
  const engine = useEngine('brain', enabled && fen !== null)
  const [state, setState] = useState<BrainState>(EMPTY_BRAIN)
  const { search, stop, status } = engine

  useEffect(() => {
    if (!enabled || !fen || status !== 'ready') return
    let alive = true
    let last = 0
    void search(fen, {
      depth: BRAIN_DEPTH,
      moveTimeMs: 12_000,
      multiPv: lines,
      onInfo: (raw) => {
        const now = performance.now()
        if (!alive || now - last < PAINT_MS) return
        last = now
        setState((s) => reduceBrain(s, fen, raw, now))
      },
    })
      .then((result) => {
        if (alive) setState((s) => reduceBrain(s, fen, result.lines, performance.now()))
      })
      .catch(() => undefined)
    // Dropped plans fade out on their own.
    const timer = window.setInterval(() => setState((s) => pruneBrain(s, performance.now())), 500)
    return () => {
      alive = false
      window.clearInterval(timer)
      stop()
    }
  }, [enabled, fen, lines, search, status, stop])

  return { state: enabled && fen && state.fen === fen ? state : { ...EMPTY_BRAIN, fen: fen ?? '' }, status: engine.status }
}
