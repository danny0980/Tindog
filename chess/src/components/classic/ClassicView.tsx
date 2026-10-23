import { Check, ChevronRight, Crown, Lock, ScrollText, Search, Sparkle, Swords, UserRound } from 'lucide-react'
import { loreFor } from '../../data/classic/lore'
import { useDeferredValue, useMemo, useState } from 'react'
import { ARCHETYPES } from '../../data/campaign/archetypes'
import { BOOKS } from '../../data/campaign/books'
import { CLASSIC_ERAS, CLASSIC_ROSTER, type ClassicCharacter, type ClassicEraId, classicUnlockedBy, classicUnlockedThrough } from '../../data/classic/roster'
import { classicPersona, difficultyForElo } from '../../data/personas'
import { classicTrophy } from '../../data/trophyAvatars'
import { useStore } from '../../hooks/useStore'
import { profileStore } from '../../stores/profileStore'
import { settingsStore, updateSettings } from '../../stores/settingsStore'
import type { ColorChoice } from '../../types/chess'
import { CAMPAIGN_TIME_CONTROLS, type ChallengeClock } from '../campaign/battleOptions'
import { PortraitEmblem } from '../legends/PortraitEmblem'
import { Button } from '../ui/Button'
import { Segmented } from '../ui/Segmented'

const LEVEL: Record<ReturnType<typeof difficultyForElo>, { label: string; tone: string }> = {
  beginner: { label: 'Gentle', tone: 'text-emerald-300' },
  intermediate: { label: 'Club', tone: 'text-sky-300' },
  advanced: { label: 'Strong', tone: 'text-amber-300' },
  expert: { label: 'Master', tone: 'text-rose-300' },
}

/**
 * Classic Chess: pick any of 100 historical opponents and play pure chess —
 * no spells, tactics, weather or arena rules. The roster is one rating ladder;
 * the suggested opponent is the first unbeaten one near your rating.
 */
export function ClassicView({ onPlay }: { onPlay: (id: string, options: ChallengeClock) => void }) {
  const elo = useStore(profileStore, (p) => p.elo)
  const matches = useStore(profileStore, (p) => p.matches)
  const avatar = useStore(settingsStore, (s) => s.trophyAvatar)
  const classicBeaten = useStore(profileStore, (p) => p.feats.classicBeaten)
  const beaten = useMemo(() => new Set(matches.filter((m) => m.outcome === 'win').map((m) => m.opponent)), [matches])
  // Beaten for good (the lasting record), plus wins still in the match history.
  const beatenIds = useMemo(() => new Set([...classicBeaten, ...CLASSIC_ROSTER.filter((c) => beaten.has(c.name)).map((c) => c.id)]), [beaten, classicBeaten])
  const openThrough = classicUnlockedThrough(beatenIds)
  const suggested = useMemo(
    () => CLASSIC_ROSTER.find((c) => c.rank <= openThrough && c.elo >= elo - 250 && !beatenIds.has(c.id)) ?? CLASSIC_ROSTER.find((c) => c.rank <= openThrough && !beatenIds.has(c.id)) ?? CLASSIC_ROSTER[0],
    [beatenIds, elo, openThrough],
  )
  const [era, setEra] = useState<ClassicEraId | 'all'>('all')
  const [query, setQuery] = useState('')
  const q = useDeferredValue(query).trim().toLowerCase()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = CLASSIC_ROSTER.find((c) => c.id === selectedId) ?? suggested ?? null
  const shown = CLASSIC_ROSTER.filter((c) => (era === 'all' || c.era === era) && (!q || c.name.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)))
  const [options, setOptions] = useState<ChallengeClock>({ color: 'random', timeControlId: 'none' })
  const lockedBy = selected ? classicUnlockedBy(selected, beatenIds) : null

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]" data-classic>
      <div className="min-w-0 space-y-3">
        <div className="glass flex flex-wrap items-center gap-2 rounded-2xl p-3 text-xs text-slate-300">
          <Crown className="size-4 text-amber-300" />
          <span className="min-w-0 flex-1">
            <b className="text-white">Pure chess.</b> No spells, tactics, weather or contracts — just 100 historical minds, each with their own style and openings, from a gentle ~600 to a world-champion ~2760.
          </span>
          <span className="font-mono text-slate-400">{beatenIds.size}/100 beaten</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Eras">
          {[{ id: 'all' as const, name: 'All eras' }, ...CLASSIC_ERAS].map((e) => (
            <button
              key={e.id}
              type="button"
              role="tab"
              aria-selected={era === e.id}
              data-era={e.id}
              onClick={() => setEra(e.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition pointer-coarse:py-2 ${era === e.id ? 'bg-accent text-ink-950' : 'bg-white/[0.05] text-slate-300 hover:bg-white/10'}`}
            >
              {e.name}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300 focus-within:ring-1 focus-within:ring-accent">
            <Search className="size-3.5 text-slate-500" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search opponents" className="w-28 bg-transparent outline-none placeholder:text-slate-600" />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4" role="list" aria-label="Classic opponents">
          {shown.map((c) => (
            <OpponentCard key={c.id} c={c} active={selected?.id === c.id} beaten={beatenIds.has(c.id)} locked={c.rank > openThrough} suggested={suggested?.id === c.id} onSelect={() => setSelectedId(c.id)} />
          ))}
        </div>
        {shown.length === 0 && <p className="text-sm text-slate-500">Nobody matches “{query}”.</p>}
      </div>

      {selected && (
        <aside className="glass space-y-3 self-start rounded-3xl p-4 lg:sticky lg:top-4" data-classic-dossier={selected.id}>
          <Dossier c={selected} beaten={beatenIds.has(selected.id)} locked={lockedBy !== null} />
          <LoreBlock c={selected} />
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
          {lockedBy ? (
            <Button variant="primary" size="lg" className="w-full" icon={<Lock className="size-5" />} disabled data-classic-play data-classic-locked>
              Beat {lockedBy.name.split(' ')[0]} to unlock
            </Button>
          ) : (
            <Button variant="primary" size="lg" className="w-full" icon={<Swords className="size-5" />} onClick={() => onPlay(selected.id, options)} data-classic-play>
              Play {selected.name.split(' ')[0]}
            </Button>
          )}
          <AvatarButton c={selected} wearing={avatar?.key === `classic:${selected.id}`} canWear={beatenIds.has(selected.id)} />
        </aside>
      )}
    </div>
  )
}

/** Wear a Classic character as your avatar — once you have beaten them. */
function AvatarButton({ c, wearing, canWear }: { c: ClassicCharacter; wearing: boolean; canWear: boolean }) {
  const first = c.name.split(' ')[0]
  return (
    <button
      type="button"
      disabled={!wearing && !canWear}
      onClick={() => updateSettings(wearing ? { trophyAvatar: null } : { trophyAvatar: classicTrophy(c), playerAvatar: null })}
      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:text-slate-500 disabled:hover:bg-transparent"
      data-classic-avatar
    >
      {wearing ? <Check className="size-4 text-accent" /> : canWear ? <UserRound className="size-4" /> : <Lock className="size-4" />}
      {wearing ? 'Your avatar — tap to remove' : canWear ? `Use ${first} as my avatar` : `Beat ${first} to wear them as your avatar`}
    </button>
  )
}

function OpponentCard({ c, active, beaten, locked, suggested, onSelect }: { c: ClassicCharacter; active: boolean; beaten: boolean; locked: boolean; suggested: boolean; onSelect: () => void }) {
  const persona = classicPersona(c)
  const level = LEVEL[persona.difficulty]
  return (
    <button
      type="button"
      role="listitem"
      onClick={onSelect}
      aria-pressed={active}
      data-classic-opponent={c.id}
      data-locked={locked || undefined}
      style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 92px' }}
      className={`relative flex items-center gap-2.5 rounded-2xl border p-2 text-left transition ${active ? 'border-accent bg-accent/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.07]'} ${locked && !active ? 'opacity-90' : ''}`}
    >
      <PortraitEmblem spec={persona.portrait} label={c.name} size="sm" defeated={beaten} locked={locked} />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block text-sm leading-tight font-semibold break-words hyphens-auto text-white">{c.name}</span>
        <span className="block truncate text-[11px] text-slate-400">{c.title}</span>
        <span className="flex items-center gap-1.5 font-mono text-[10px]">
          <span className="text-slate-300">~{c.elo}</span>
          <span className={level.tone}>{level.label}</span>
          {beaten && <Check className="size-3 text-emerald-300" aria-label="beaten" />}
          {locked && <Lock className="size-3 text-slate-500" aria-label="locked" />}
        </span>
      </span>
      {suggested && !active && <ChevronRight className="size-4 shrink-0 text-accent" aria-label="suggested next" />}
    </button>
  )
}

function Dossier({ c, beaten, locked }: { c: ClassicCharacter; beaten: boolean; locked: boolean }) {
  const persona = classicPersona(c)
  const style = ARCHETYPES[c.archetype]
  const era = CLASSIC_ERAS.find((e) => e.id === c.era)
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <PortraitEmblem spec={persona.portrait} label={c.name} size="lg" defeated={beaten} locked={locked} />
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{era?.name}</div>
          <div className="font-display text-lg font-extrabold leading-tight text-white">{c.name}</div>
          <div className="text-xs text-slate-400">{c.title}</div>
          <div className="mt-0.5 font-mono text-xs text-slate-300">
            ~{c.elo} Elo · <span className={LEVEL[persona.difficulty].tone}>{LEVEL[persona.difficulty].label}</span> · #{c.rank + 1} of 100
          </div>
        </div>
      </div>
      <p className="rounded-2xl bg-white/5 p-3 text-sm italic text-slate-200">“{c.line}”</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-slate-500">Style</dt>
        <dd className="text-slate-200">
          {style.name} — {style.summary}
        </dd>
        <dt className="text-slate-500">Openings</dt>
        <dd className="text-slate-200">{BOOKS[c.book].name}</dd>
        <dt className="text-slate-500">Rules</dt>
        <dd className="text-slate-200">Classic chess only — no spells, tactics or arena effects</dd>
      </dl>
    </div>
  )
}

/** Who they really were: dates, story and three true facts. */
function LoreBlock({ c }: { c: ClassicCharacter }) {
  const lore = loreFor(c.id)
  if (!lore) return null
  return (
    <section className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3" data-classic-lore={c.id}>
      <div className="flex items-center gap-2">
        <ScrollText className="size-4 shrink-0 text-amber-200" />
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-200">History</span>
        <span className="ml-auto font-mono text-[11px] text-slate-400">{lore.lived}</span>
      </div>
      <p className="text-xs leading-relaxed text-slate-300">{lore.bio}</p>
      <details className="group" open>
        <summary className="cursor-pointer list-none text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 group-open:mb-1.5">Did you know?</summary>
        <ul className="space-y-1.5">
          {lore.facts.map((fact) => (
            <li key={fact} className="flex gap-1.5 text-xs leading-relaxed text-slate-300">
              <Sparkle className="mt-0.5 size-3 shrink-0 text-amber-300" /> {fact}
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}
