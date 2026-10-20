import { Ghost, Swords } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ARCHETYPES } from '../../data/campaign/archetypes'
import { ghostPersona } from '../../data/personas'
import { MIN_GAMES, fingerprint, radar } from '../../ghost/fingerprint'
import { useStore } from '../../hooks/useStore'
import { profileStore } from '../../stores/profileStore'
import type { ColorChoice } from '../../types/chess'
import { CAMPAIGN_TIME_CONTROLS, type ChallengeClock } from '../campaign/battleOptions'
import { PortraitEmblem } from '../legends/PortraitEmblem'
import { Button } from '../ui/Button'
import { Segmented } from '../ui/Segmented'

/** Ghost of Yourself: your style fingerprint, and a game against it. */
export function GhostView({ onPlay }: { onPlay: (options: ChallengeClock) => void }) {
  const matches = useStore(profileStore, (p) => p.matches)
  const elo = useStore(profileStore, (p) => p.elo)
  const name = useStore(profileStore, (p) => p.name)
  const f = useMemo(() => fingerprint(matches, elo), [elo, matches])
  const persona = useMemo(() => ghostPersona(f, name), [f, name])
  const bars = radar(f)
  const [options, setOptions] = useState<ChallengeClock>({ color: 'random', timeControlId: 'none' })
  const thin = f.games < MIN_GAMES
  const style = ARCHETYPES[f.archetype]

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]" data-ghost>
      <section className="glass space-y-4 rounded-3xl p-5">
        <div className="flex items-center gap-4">
          <PortraitEmblem spec={persona.portrait} label={persona.name} size="lg" ring="ring-indigo-300/60" />
          <div className="min-w-0">
            <div className="font-display text-2xl font-extrabold text-white">{persona.name}</div>
            <div className="text-sm text-indigo-200">
              Plays like {style.name} · {f.elo} Elo
            </div>
            <div className="text-xs text-slate-400" data-ghost-games>
              Learned from {f.games} of your saved games
            </div>
          </div>
        </div>
        <div className="space-y-2" aria-label="Your style">
          {bars.map((b) => (
            <div key={b.label} className="grid grid-cols-[7rem_minmax(0,1fr)_2.5rem] items-center gap-2 text-xs">
              <span className="text-slate-300">{b.label}</span>
              <span className="h-2 overflow-hidden rounded-full bg-white/10">
                <span className="block h-full rounded-full bg-gradient-to-r from-indigo-400 to-fuchsia-400" style={{ width: `${b.value}%` }} />
              </span>
              <span className="text-right font-mono text-slate-400">{b.value}</span>
            </div>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(['w', 'b'] as const).map((c) => (
            <div key={c} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Your openings as {c === 'w' ? 'White' : 'Black'}</div>
              {f.repertoire[c].length === 0 ? (
                <p className="mt-1 text-xs text-slate-500">None yet: the ghost will improvise.</p>
              ) : (
                <ol className="mt-1 space-y-1 font-mono text-[11px] text-slate-300">
                  {f.repertoire[c].slice(0, 3).map((line) => (
                    <li key={line} className="truncate">
                      {line.split(' ').slice(0, 6).join(' ')}…
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      </section>
      <aside className="glass space-y-3 self-start rounded-3xl p-4">
        <p className="text-sm text-slate-300">It opens with your own lines, plays in the style your habits show, at your rating. Beat it, and you have beaten your old habits.</p>
        {thin && <p className="rounded-xl bg-amber-300/10 p-2 text-xs text-amber-100">Only {f.games} saved games so far. Play {MIN_GAMES - f.games} more for a truer copy; until then the ghost fills the gaps with its style.</p>}
        <Segmented
          label="Play as"
          options={[
            { id: 'w', label: 'White' },
            { id: 'random', label: 'Random' },
            { id: 'b', label: 'Black' },
          ]}
          value={options.color}
          onChange={(v) => setOptions({ ...options, color: v as ColorChoice })}
        />
        <Segmented label="Clock" options={CAMPAIGN_TIME_CONTROLS} value={options.timeControlId} onChange={(v) => setOptions({ ...options, timeControlId: v })} />
        <Button variant="primary" size="lg" className="w-full" icon={<Swords className="size-5" />} onClick={() => onPlay(options)} data-ghost-play>
          Face your ghost
        </Button>
        <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <Ghost className="size-3.5" /> It learns again before every game.
        </p>
      </aside>
    </div>
  )
}
