import { useCallback, useEffect, useRef, useState } from 'react'
import { classifyMoves, evaluatePosition } from '../engine/analysis'
import type { AnalysisState, GameAnalysis, PositionEval } from '../types/analysis'
import type { Move } from '../types/chess'
import { fenAtPly } from '../utils/chess'
import { bookDepth } from '../utils/openings'
import type { EngineHandle } from './useEngine'

/**
 * Post-game analysis: evaluates every position sequentially on the analysis
 * engine, streaming partial results so the eval graph fills in live.
 */
export function useGameAnalysis(engine: EngineHandle, history: readonly Move[], gameKey: string, depth: number) {
  const [state, setState] = useState<{ key: string; value: AnalysisState }>({ key: gameKey, value: { status: 'idle' } })
  const runRef = useRef(0)
  const { search, stop, status: engineStatus } = engine

  const current: AnalysisState = state.key === gameKey ? state.value : { status: 'idle' }

  const cancel = useCallback(() => {
    runRef.current += 1
    stop()
  }, [stop])

  useEffect(() => cancel, [cancel, gameKey])

  const run = useCallback(
    async (onDone?: (analysis: GameAnalysis) => void) => {
      if (engineStatus !== 'ready' || history.length === 0) return
      const runId = ++runRef.current
      const key = gameKey
      const moves = [...history]
      const evals: PositionEval[] = []
      setState({ key, value: { status: 'running', progress: 0, partial: [] } })
      try {
        for (let ply = 0; ply <= moves.length; ply += 1) {
          const fen = fenAtPly(moves, ply)
          const evaluation = await evaluatePosition(fen, depth, (f) => search(f, { depth, multiPv: 1 }))
          if (runRef.current !== runId) return
          evals.push(evaluation)
          setState({ key, value: { status: 'running', progress: (ply + 1) / (moves.length + 1), partial: [...evals] } })
        }
        const analysis = classifyMoves(moves, evals, bookDepth(moves))
        setState({ key, value: { status: 'done', analysis } })
        onDone?.(analysis)
      } catch (err) {
        if (runRef.current === runId) {
          setState({ key, value: { status: 'error', message: err instanceof Error ? err.message : 'Analysis failed' } })
        }
      }
    },
    [depth, engineStatus, gameKey, history, search],
  )

  return { state: current, run, cancel, engineReady: engineStatus === 'ready' }
}
