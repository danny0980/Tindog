import { Lightbulb } from 'lucide-react'
import { CLASSIFICATION_META } from '../../constants/classifications'
import { moveInsight } from '../../engine/insight'
import type { MoveAnalysis } from '../../types/analysis'
import { ClassificationBadge } from './ClassificationBadge'

/** The lesson for the move on the board while you step through a reviewed game. */
export function MoveInsightCard({ move }: { move: MoveAnalysis }) {
  const insight = moveInsight(move)
  const color = CLASSIFICATION_META[insight.classification].color
  return (
    <div className="glass animate-fade-in space-y-1.5 rounded-xl px-3 py-2.5 text-xs" data-move-insight={insight.classification}>
      <div className="flex items-center gap-2">
        <ClassificationBadge classification={insight.classification} size="xs" />
        <span className="font-semibold text-white" style={{ color }}>
          {insight.title}
        </span>
        <span className="ml-auto font-mono text-slate-300" title="Evaluation before → after, from the mover's side">
          {insight.swing}
        </span>
      </div>
      <div className="text-slate-300">
        {insight.verdict}
        {insight.better && (
          <>
            {' '}
            Better was <span className="font-mono font-bold text-lime-300">{insight.better}</span> (the green arrow).
          </>
        )}
      </div>
      <div className="flex items-start gap-1.5 text-slate-400">
        <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-amber-300" /> {insight.tip}
      </div>
    </div>
  )
}
