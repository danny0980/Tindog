import { Lock } from 'lucide-react'
import { useState } from 'react'
import { GRAND_REALMS } from '../../data/campaign/realms'
import { TROPHIES, type TrophyContext } from '../../data/trophies'
import { PORTRAIT_ICONS } from '../legends/portraitIcons'

const SHELVES: ReadonlyArray<{ id: string; name: string }> = [
  ...GRAND_REALMS.map((r) => ({ id: r.id, name: r.name })),
  { id: 'legends', name: 'Chronos Legends' },
  { id: 'arena', name: 'Arena & Ironman' },
]

/**
 * Hall of Trophies: crowns and weapons from milestone bosses and realm
 * overlords, cups from the arena modes, on 3D shelves. Earned trophies turn
 * slowly on their pedestals (static in battery saver).
 */
export function TrophyHall({ ctx, lowPower }: { ctx: TrophyContext; lowPower: boolean }) {
  const [inspect, setInspect] = useState<string | null>(null)
  const earned = new Set(TROPHIES.filter((t) => t.earned(ctx)).map((t) => t.id))
  const detail = TROPHIES.find((t) => t.id === inspect)
  return (
    <div className="space-y-3" data-trophy-hall>
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-slate-400">Tap a trophy to inspect it.</span>
        <span className="font-mono text-xs text-amber-200">
          {earned.size}/{TROPHIES.length}
        </span>
      </div>
      {SHELVES.map((shelf) => {
        const items = TROPHIES.filter((t) => t.shelf === shelf.id)
        if (items.length === 0) return null
        return (
          <div key={shelf.id}>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{shelf.name}</div>
            <div className="relative rounded-2xl bg-gradient-to-b from-white/[0.02] to-white/[0.06] px-2 pt-3 pb-4 [perspective:700px]">
              <div className="flex flex-wrap gap-3">
                {items.map((t) => {
                  const Icon = PORTRAIT_ICONS[t.icon]
                  const on = earned.has(t.id)
                  return (
                    <button
                      key={t.id}
                      type="button"
                      data-trophy={t.id}
                      data-earned={on}
                      onClick={() => setInspect((x) => (x === t.id ? null : t.id))}
                      className="flex w-20 flex-col items-center gap-1 text-center"
                      aria-label={`${t.name}${on ? '' : ' (locked)'}`}
                    >
                      <span className="relative flex h-16 w-16 items-center justify-center [transform-style:preserve-3d]">
                        <span
                          className={`flex size-12 items-center justify-center ${t.kind === 'cup' ? 'rounded-b-3xl rounded-t-lg' : t.kind === 'crown' ? 'rounded-t-3xl rounded-b-lg' : 'rounded-2xl'} ${on && !lowPower ? 'animate-trophy-spin' : ''}`}
                          style={
                            on
                              ? { background: `linear-gradient(135deg, ${t.from}, ${t.to})`, boxShadow: `0 10px 26px -8px ${t.from}`, transformStyle: 'preserve-3d' }
                              : { background: 'rgba(255,255,255,0.05)' }
                          }
                        >
                          {on ? <Icon className="size-6 text-white drop-shadow" /> : <Lock className="size-5 text-slate-600" />}
                        </span>
                        {/* Pedestal */}
                        <span className="absolute -bottom-1 h-2 w-14 rounded-full bg-black/50 blur-[2px]" aria-hidden />
                      </span>
                      <span className={`line-clamp-2 text-[10px] font-semibold leading-tight ${on ? 'text-amber-100' : 'text-slate-500'}`}>{on ? t.name : '???'}</span>
                    </button>
                  )
                })}
              </div>
              <div className="absolute inset-x-1 bottom-1 h-2 rounded-full bg-gradient-to-b from-amber-900/50 to-amber-950/80 shadow-[0_6px_10px_rgba(0,0,0,0.5)]" aria-hidden />
            </div>
          </div>
        )
      })}
      {detail && (
        <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-3 text-sm" role="status">
          <div className="font-bold text-white">{earned.has(detail.id) ? detail.name : 'Locked trophy'}</div>
          <div className="text-xs text-slate-300">{detail.hint}</div>
        </div>
      )}
    </div>
  )
}
