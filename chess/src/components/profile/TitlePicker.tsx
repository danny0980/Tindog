import { Check, Lock } from 'lucide-react'
import { FEAT_TITLES, NOBLE_RANKS, type TitleContext, displayTitle, nextRank, nobleRank } from '../../data/titles'
import { profileStore } from '../../stores/profileStore'

/** Noble ranks (from your peak rating) and feat titles you can wear on your player card. */
export function TitlePicker({ ctx }: { ctx: TitleContext }) {
  const rank = nobleRank(ctx.profile.peakElo)
  const next = nextRank(ctx.profile.peakElo)
  const shown = displayTitle(ctx)
  const choose = (id: string | null) => profileStore.set((p) => ({ ...p, title: id }))
  return (
    <div className="space-y-3" data-titles>
      <div>
        <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Noble rank</div>
        <div className="flex flex-wrap gap-1.5">
          {NOBLE_RANKS.map((r) => {
            const reached = ctx.profile.peakElo >= r.minElo
            return (
              <span key={r.id} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${r.id === rank.id ? 'bg-accent text-ink-950' : reached ? 'bg-white/10 text-slate-100' : 'bg-white/[0.03] text-slate-500'}`}>
                {r.name}
                {r.minElo > 0 && <span className="ml-1 font-mono opacity-70">{r.minElo}</span>}
              </span>
            )
          })}
        </div>
        {next && <p className="mt-1 text-[11px] text-slate-400">{next.elo - ctx.profile.peakElo} more peak Elo to become {next.rank.name}.</p>}
      </div>
      <div>
        <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Feat titles</div>
        <div className="grid gap-1.5 sm:grid-cols-2">
          <TitleRow label={`${rank.name} (your rank)`} description="Show your noble rank." on={shown.id === rank.id} earned onClick={() => choose(null)} />
          {FEAT_TITLES.map((t) => {
            const earned = t.earned(ctx)
            return <TitleRow key={t.id} label={t.name} description={t.description} on={shown.id === t.id} earned={earned} onClick={() => earned && choose(t.id)} />
          })}
        </div>
      </div>
    </div>
  )
}

function TitleRow({ label, description, on, earned, onClick }: { label: string; description: string; on: boolean; earned: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={!earned}
      aria-pressed={on}
      onClick={onClick}
      className={`flex items-start gap-2 rounded-xl border p-2 text-left text-xs transition disabled:opacity-50 ${on ? 'border-accent bg-accent/15' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.07]'}`}
    >
      {on ? <Check className="mt-0.5 size-4 shrink-0 text-accent" /> : earned ? <span className="size-4 shrink-0" /> : <Lock className="mt-0.5 size-4 shrink-0 text-slate-500" />}
      <span>
        <span className="block font-bold text-white">{label}</span>
        <span className="block text-slate-400">{description}</span>
      </span>
    </button>
  )
}
