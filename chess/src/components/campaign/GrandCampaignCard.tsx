import { ChevronRight, Gem, Map as MapIcon, Star } from 'lucide-react'
import { GRAND_REALMS, TOTAL_BOSSES } from '../../data/campaign/realms'
import { RELICS } from '../../data/campaign/relics'
import type { CampaignProgress } from '../../types/campaign'
import { clearedCount, isRealmUnlocked, maxStars, starCount } from '../../utils/campaign'
import { PortraitEmblem } from '../legends/PortraitEmblem'

/** Hero card on the path selector: the 100-boss Grand Campaign at a glance. */
export function GrandCampaignCard({ progress, onOpen }: { progress: CampaignProgress; onOpen: () => void }) {
  const cleared = clearedCount(progress)
  return (
    <button
      type="button"
      onClick={onOpen}
      data-path="grand"
      className="glass group relative overflow-hidden rounded-3xl p-5 text-left shadow-[0_30px_80px_-30px_rgba(129,140,248,0.6)] transition duration-300 hover:-translate-y-1 hover:border-white/25 lg:col-span-3"
    >
      <div className="pointer-events-none absolute -top-28 -left-20 size-80 rounded-full bg-gradient-to-br from-amber-300 via-fuchsia-500 to-indigo-600 opacity-25 blur-3xl transition group-hover:opacity-40" aria-hidden="true" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3 lg:w-80">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 via-fuchsia-400 to-indigo-500 text-ink-950">
            <MapIcon className="size-7" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">Epic campaign</div>
            <div className="font-display text-xl font-extrabold tracking-wide text-white">Grand Campaign</div>
            <div className="text-xs text-slate-400">100 bosses · 5 realms · 10 relics</div>
          </div>
        </div>
        <div className="grid flex-1 grid-cols-5 gap-2">
          {GRAND_REALMS.map((realm) => {
            const done = clearedCount(progress, realm.id)
            return (
              <div key={realm.id} className="min-w-0 text-center">
                <PortraitEmblem
                  spec={{ icon: realm.icon, from: realm.colors.from, to: realm.colors.to, monogram: '' }}
                  label={realm.name}
                  size="sm"
                  locked={!isRealmUnlocked(realm.id, progress)}
                  className="mx-auto"
                />
                <div className="mt-1 truncate text-[10px] font-semibold text-slate-300">{realm.shortName}</div>
                <div className="mx-auto mt-1 h-1 w-full max-w-16 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-fuchsia-400" style={{ width: `${(done / 20) * 100}%` }} />
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-4 lg:w-64 lg:justify-end">
          <span className="font-mono text-sm text-white">
            <span className="text-2xl font-bold">{cleared}</span>
            <span className="text-slate-500">/{TOTAL_BOSSES}</span>
          </span>
          <span className="flex items-center gap-1 font-mono text-sm text-slate-300">
            <Star className="size-4 fill-amber-300 text-amber-300" /> {starCount(progress)}/{maxStars()}
          </span>
          <span className="flex items-center gap-1 font-mono text-sm text-slate-300">
            <Gem className="size-4 text-amber-200" /> {progress.relics.length}/{RELICS.length}
          </span>
          <ChevronRight className="size-5 text-accent transition group-hover:translate-x-1" />
        </div>
      </div>
    </button>
  )
}
