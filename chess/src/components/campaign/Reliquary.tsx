import { GRAND_REALMS, MILESTONE_INDEX, OVERLORD_INDEX } from '../../data/campaign/realms'
import { RELICS, relicSlots } from '../../data/campaign/relics'
import type { CampaignProgress, RelicId } from '../../types/campaign'
import { Modal } from '../ui/Modal'
import { RelicTile } from './RelicTile'

const SCOPE_LABEL = { battle: 'Campaign battles', rush: 'Time Rush', passive: 'Passive' } as const

/** Where a relic drops, without needing the realm's roster loaded. */
function sourceOf(id: RelicId): string {
  for (const realm of GRAND_REALMS) {
    const at = realm.relics.indexOf(id)
    if (at === 0) return `${realm.name} · boss #${MILESTONE_INDEX + 1}`
    if (at === 1) return `${realm.name} · overlord #${OVERLORD_INDEX + 1}`
  }
  return ''
}

/** Collection of all ten relics with equip toggles. */
export function Reliquary({ open, progress, onClose, onToggle }: { open: boolean; progress: CampaignProgress; onClose: () => void; onToggle: (id: RelicId) => void }) {
  const slots = relicSlots(progress.relics)
  return (
    <Modal open={open} title={`Reliquary · ${progress.relics.length}/${RELICS.length}`} onClose={onClose} size="md">
      <p className="mb-3 text-xs text-slate-400">
        Equip up to <span className="font-bold text-white">{slots}</span> relics ({progress.equipped.length} in use). Battle relics apply to Grand Campaign bosses, Time Rush relics to your
        next run; passive relics always work.
      </p>
      <ul className="space-y-2 pb-2">
        {RELICS.map((relic) => {
          const owned = progress.relics.includes(relic.id)
          const on = progress.equipped.includes(relic.id)
          const full = !on && progress.equipped.length >= slots
          return (
            <li key={relic.id} className={`flex items-center gap-3 rounded-2xl border p-3 ${on ? 'border-accent/60 bg-accent/10' : 'border-white/10 bg-white/[0.03]'}`}>
              <RelicTile relic={relic} owned={owned} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className={`font-semibold ${owned ? 'text-white' : 'text-slate-400'}`}>{relic.name}</span>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500">{SCOPE_LABEL[relic.scope]}</span>
                </div>
                <div className="text-xs text-slate-300">{relic.description}</div>
                {!owned && <div className="mt-0.5 text-[11px] text-slate-500">Found at {sourceOf(relic.id)}</div>}
              </div>
              {owned && relic.scope !== 'passive' && (
                <button
                  type="button"
                  aria-pressed={on}
                  disabled={full}
                  onClick={() => onToggle(relic.id)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:opacity-40 ${on ? 'bg-accent text-ink-950' : 'border border-white/15 text-slate-200 hover:bg-white/10'}`}
                >
                  {on ? 'Equipped' : 'Equip'}
                </button>
              )}
              {owned && relic.scope === 'passive' && <span className="shrink-0 text-xs font-bold text-emerald-300">Active</span>}
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}
