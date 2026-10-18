import type { ScorePopup } from '../../types/rush'

const TONES: Record<ScorePopup['tone'], string> = {
  great: 'text-lime-300 [text-shadow:0_0_14px_rgba(163,230,53,0.8)]',
  good: 'text-sky-200 [text-shadow:0_0_12px_rgba(125,211,252,0.7)]',
  bad: 'text-red-300 [text-shadow:0_0_12px_rgba(239,68,68,0.8)]',
  bonus: 'text-amber-200 [text-shadow:0_0_16px_rgba(251,191,36,0.9)]',
}

/** Floating arcade score callouts rendered over the board. */
export function ScorePopups({ popups }: { popups: readonly ScorePopup[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-live="polite">
      {popups.map((p, i) => (
        <div
          key={p.id}
          className={`absolute left-1/2 animate-score-pop text-center font-display font-extrabold whitespace-nowrap ${TONES[p.tone]}`}
          style={{ top: `${38 + (i % 3) * 9}%` }}
        >
          {p.points > 0 && <div className="text-3xl sm:text-4xl">+{p.points.toLocaleString()}</div>}
          <div className="text-[11px] tracking-[0.18em] sm:text-xs">{p.label}</div>
        </div>
      ))}
    </div>
  )
}
