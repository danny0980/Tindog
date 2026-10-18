import { AlertCircle, LineChart, LoaderCircle, Microscope } from 'lucide-react'
import { CLASSIFICATIONS } from '../../engine/analysis'
import type { AnalysisState, MoveAnalysis } from '../../types/analysis'
import type { Color } from '../../types/chess'
import { Button } from '../ui/Button'
import { CLASSIFICATION_META } from '../../constants/classifications'
import { ClassificationBadge } from './ClassificationBadge'
import { EvalGraph } from './EvalGraph'

interface AnalysisPanelProps {
  state: AnalysisState
  available: boolean
  totalPlies: number
  currentPly: number
  names: Record<Color, string>
  onAnalyze: () => void
  onSelect: (ply: number) => void
}

const KEY_TYPES = new Set(['brilliant', 'mistake', 'blunder'])

export function AnalysisPanel({ state, available, totalPlies, currentPly, names, onAnalyze, onSelect }: AnalysisPanelProps) {
  if (state.status === 'idle') {
    if (!available) return null
    return (
      <div className="glass flex items-center gap-3 rounded-xl p-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
          <Microscope className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-white">Game review</div>
          <div className="text-xs text-slate-400">Find brilliant moves, mistakes and blunders.</div>
        </div>
        <Button variant="primary" size="sm" onClick={onAnalyze}>
          Analyze
        </Button>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="glass flex items-center gap-3 rounded-xl p-3 text-sm text-red-200">
        <AlertCircle className="size-5" /> {state.message}
      </div>
    )
  }

  if (state.status === 'running') {
    return (
      <div className="glass space-y-3 rounded-xl p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <LoaderCircle className="size-4 animate-spin text-accent" /> Analyzing with Stockfish…
          <span className="ml-auto font-mono text-xs text-slate-400">{Math.round(state.progress * 100)}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-gradient-to-r from-accent to-accent-2 transition-[width] duration-300" style={{ width: `${state.progress * 100}%` }} />
        </div>
        <EvalGraph evals={state.partial} totalPlies={totalPlies} currentPly={currentPly} onSelect={onSelect} />
      </div>
    )
  }

  const { analysis } = state
  const keyMoments: MoveAnalysis[] = analysis.moves.filter((m) => KEY_TYPES.has(m.classification))

  return (
    <div className="glass space-y-3 rounded-xl p-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <LineChart className="size-4 text-accent" /> Game review
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(['w', 'b'] as const).map((color) => (
          <div key={color} className="rounded-lg bg-white/5 p-2 text-center">
            <div className="truncate text-[11px] text-slate-400">{names[color]}</div>
            <div className="font-mono text-2xl font-bold text-white">{analysis.accuracy[color].toFixed(1)}</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">accuracy</div>
          </div>
        ))}
      </div>
      <EvalGraph evals={analysis.evals} totalPlies={totalPlies} currentPly={currentPly} moves={analysis.moves} onSelect={onSelect} />
      <table className="w-full text-xs">
        <tbody>
          {CLASSIFICATIONS.filter((c) => c !== 'forced').map((c) => (
            <tr key={c} className="border-t border-white/5">
              <td className="py-1 text-center font-mono font-bold" style={{ color: CLASSIFICATION_META[c].color }}>
                {analysis.counts.w[c]}
              </td>
              <td className="py-1">
                <span className="flex items-center justify-center gap-1.5 text-slate-300">
                  <ClassificationBadge classification={c} size="xs" /> {CLASSIFICATION_META[c].label}
                </span>
              </td>
              <td className="py-1 text-center font-mono font-bold" style={{ color: CLASSIFICATION_META[c].color }}>
                {analysis.counts.b[c]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {keyMoments.length > 0 && (
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Key moments</div>
          <div className="scrollbar-thin flex gap-1.5 overflow-x-auto pb-1">
            {keyMoments.map((m) => (
              <button
                key={m.ply}
                type="button"
                onClick={() => onSelect(m.ply)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition ${
                  currentPly === m.ply ? 'border-accent bg-accent/15 text-white' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
                title={m.bestMoveSan ? `Best was ${m.bestMoveSan}` : undefined}
              >
                <ClassificationBadge classification={m.classification} size="xs" />
                <span className="font-mono">
                  {Math.ceil(m.ply / 2)}
                  {m.color === 'w' ? '.' : '…'} {m.san}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
