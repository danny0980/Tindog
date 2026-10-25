import { BookHeart, Clapperboard, Gift, Heart, Lock, Search, Skull, Swords, Trophy } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { CLASSIC_ERAS, CLASSIC_ROSTER, type ClassicCharacter, getClassic, getClassicEra } from '../../data/classic/roster'
import { loadLore } from '../../data/classic/loreLoader'
import type { ClassicLore } from '../../data/classic/lore/types'
import { beatenIds } from '../../data/trophyAvatars'
import { useStore } from '../../hooks/useStore'
import {
  BOND_LEVELS,
  RARITY,
  bondGift,
  bondLevel,
  bondStories,
  classicKey,
  collectionReward,
  collections,
  completion,
  nemesisTaunt,
  nextBond,
  pendingGifts,
  pickNemesis,
  rarityFor,
} from '../../journey/characters'
import { payRewards } from '../../journey/journeyActions'
import { journeyStore } from '../../journey/journeyStore'
import { DREAM_MATCHES, type DreamMatch } from '../../journey/modes'
import { skillEffects } from '../../journey/skills'
import { rewardLabel } from '../../journey/rewards'
import { profileStore } from '../../stores/profileStore'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { DreamMatchViewer } from './DreamMatchViewer'
import type { JourneyLaunch } from './launch'
import { Bar, Card, ClassicFace, Pill } from './ui'

type Section = 'nemesis' | 'bonds' | 'codex' | 'collection' | 'dreams'

export function CharactersTab({ launch }: { launch: JourneyLaunch }) {
  const [section, setSection] = useState<Section>('nemesis')
  const [lore, setLore] = useState<((id: string) => ClassicLore | null) | null>(null)
  useEffect(() => {
    let alive = true
    loadLore()
      .then((m) => alive && setLore(() => m.loreFor))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])
  const tabs: Array<{ id: Section; label: string; icon: typeof Heart }> = [
    { id: 'nemesis', label: 'Nemesis', icon: Skull },
    { id: 'bonds', label: 'Bonds', icon: Heart },
    { id: 'codex', label: 'Codex', icon: BookHeart },
    { id: 'collection', label: 'Collection', icon: Trophy },
    { id: 'dreams', label: 'Dream matches', icon: Clapperboard },
  ]
  return (
    <div className="space-y-4">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Characters">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={section === t.id}
            onClick={() => setSection(t.id)}
            data-characters-tab={t.id}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition pointer-coarse:min-h-10 ${section === t.id ? 'bg-accent text-ink-950' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
          >
            <t.icon className="size-3.5" /> {t.label}
          </button>
        ))}
      </div>
      {section === 'nemesis' && <NemesisCard launch={launch} />}
      {section === 'bonds' && <Bonds lore={lore} />}
      {section === 'codex' && <Codex lore={lore} />}
      {section === 'collection' && <Collections />}
      {section === 'dreams' && <DreamMatches />}
    </div>
  )
}

function NemesisCard({ launch }: { launch: JourneyLaunch }) {
  const memory = useStore(profileStore, (p) => p.memory)
  const nemesis = useStore(journeyStore, (j) => j.nemesis)
  const key = pickNemesis(memory, nemesis.beaten)
  const c = key ? getClassic(key.slice(8)) : null
  const m = key ? memory[key] : undefined
  const beaten = nemesis.beaten.map((k) => getClassic(k.slice(8))).filter((x): x is ClassicCharacter => x !== null)
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card title="Your nemesis" icon={<Skull className="size-4" />} className="relative overflow-hidden" data-nemesis={c?.id ?? 'none'}>
        <div className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-red-500/20 blur-3xl" aria-hidden="true" />
        {c && m ? (
          <div className="relative">
            <div className="flex items-center gap-4">
              <ClassicFace c={c} size="lg" />
              <div className="min-w-0">
                <div className="font-display text-xl font-extrabold text-white">{c.name}</div>
                <div className="text-xs text-slate-400">{c.title}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Pill tone="red">
                    {m.losses}–{m.wins} in their favour
                  </Pill>
                  {m.streak < 0 && <Pill tone="red">{-m.streak} in a row</Pill>}
                </div>
              </div>
            </div>
            <p className="mt-3 text-sm italic text-red-100">{nemesisTaunt(c, m)}</p>
            <p className="mt-2 text-xs text-slate-400">A revenge match: they come back +120 Elo stronger and remember every game. Beat them for 400 coins{nemesis.beaten.length === 0 ? ' and the Nemesis Bane frame' : ''}.</p>
            <Button
              variant="danger"
              className="mt-3 w-full"
              icon={<Swords className="size-4" />}
              onClick={() => launch.playClassic(c.id, { color: 'random', timeControlId: 'rapid-10-5' }, { kind: 'legend', tactics: [], journey: { kind: 'nemesis' } })}
              data-nemesis-play
            >
              Take revenge
            </Button>
          </div>
        ) : (
          <p className="relative text-sm text-slate-300">
            No nemesis yet. When a Classic character beats you twice or more and stays ahead, they become your nemesis — and they won’t let you forget it.
          </p>
        )}
      </Card>
      <Card title="Defeated nemeses" icon={<Trophy className="size-4" />}>
        {beaten.length === 0 ? (
          <p className="text-xs text-slate-500">None yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {beaten.map((b) => (
              <li key={b.id} title={b.name}>
                <ClassicFace c={b} size="sm" defeated />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function Bonds({ lore }: { lore: ((id: string) => ClassicLore | null) | null }) {
  const memory = useStore(profileStore, (p) => p.memory)
  const gifts = useStore(journeyStore, (j) => j.bondGifts)
  const skills = useStore(journeyStore, (j) => j.skills)
  const factor = skillEffects(skills).bondFactor
  const [open, setOpen] = useState<ClassicCharacter | null>(null)
  const known = CLASSIC_ROSTER.map((c) => ({ c, games: memory[classicKey(c.id)]?.games ?? 0 }))
    .filter((x) => x.games > 0)
    .sort((a, b) => b.games - a.games)
  const pending = pendingGifts(memory, gifts, factor)
  const claim = (c: ClassicCharacter, level: number) => {
    journeyStore.set((j) => ({ ...j, bondGifts: { ...j.bondGifts, [c.id]: Math.max(j.bondGifts[c.id] ?? 0, level) } }))
    payRewards(bondGift(c, level), `A gift from ${c.name}`)
  }
  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <Card title="Gifts waiting" icon={<Gift className="size-4" />} data-bond-gifts={String(pending.length)}>
          <ul className="space-y-2">
            {pending.map(({ character, level }) => (
              <li key={`${character.id}:${level}`} className="flex items-center gap-3 rounded-2xl bg-amber-300/10 p-2">
                <ClassicFace c={character} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">{character.name}</div>
                  <div className="text-[11px] text-amber-200">{bondGift(character, level).map(rewardLabel).join(' · ')}</div>
                </div>
                <Button size="sm" variant="primary" icon={<Gift className="size-4" />} onClick={() => claim(character, level)}>
                  Open
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card title="Bonds" icon={<Heart className="size-4" />}>
        <p className="mb-3 text-xs text-slate-400">
          Every game against a character brings you closer. At each bond level they tell you more about their life; at levels 3 and 5 they give you a gift.
          {factor > 1 ? ' Kindred Spirit: bonds grow twice as fast.' : ''}
        </p>
        {known.length === 0 ? (
          <p className="text-sm text-slate-500">Play Classic Chess against the characters to start a bond.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {known.map(({ c, games }) => {
              const lvl = bondLevel(games, factor)
              const next = nextBond(games, factor)
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => setOpen(c)} className="flex w-full items-center gap-3 rounded-2xl bg-white/[0.04] p-2 text-left hover:bg-white/[0.08]" data-bond={c.id}>
                    <ClassicFace c={c} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">{c.name}</span>
                      <span className="flex items-center gap-1 text-[11px] text-pink-200">
                        {Array.from({ length: 5 }, (_, i) => (
                          <Heart key={i} className={`size-3 ${i < lvl ? 'fill-pink-300 text-pink-300' : 'text-slate-600'}`} />
                        ))}
                        <span className="ml-1">{BOND_LEVELS[lvl - 1]?.name ?? 'Stranger'}</span>
                      </span>
                      <span className="block text-[10px] text-slate-500">{next ? `${next.gamesLeft} more game${next.gamesLeft === 1 ? '' : 's'} to “${next.level.name}”` : 'The deepest bond'}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
      <Modal open={open !== null} title={open?.name ?? ''} onClose={() => setOpen(null)} size="md">
        {open && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <ClassicFace c={open} size="lg" />
              <div>
                <div className="text-sm text-slate-300">{open.title}</div>
                <div className="text-xs text-pink-200">{BOND_LEVELS[bondLevel(memory[classicKey(open.id)]?.games ?? 0, factor) - 1]?.name ?? 'Stranger'}</div>
              </div>
            </div>
            <ol className="space-y-2">
              {bondStories(open, lore?.(open.id) ?? null, 5).map((s) => {
                const unlocked = s.level <= bondLevel(memory[classicKey(open.id)]?.games ?? 0, factor)
                return (
                  <li key={s.level} className={`rounded-2xl p-3 text-sm ${unlocked ? 'bg-white/[0.05] text-slate-200' : 'bg-black/30 text-slate-600'}`}>
                    <div className="mb-1 text-[10px] font-bold tracking-wider text-pink-200 uppercase">Bond level {s.level}</div>
                    {unlocked ? s.text : (
                      <span className="flex items-center gap-1">
                        <Lock className="size-3" /> Play more games together to hear this.
                      </span>
                    )}
                  </li>
                )
              })}
            </ol>
          </div>
        )}
      </Modal>
    </div>
  )
}

function Codex({ lore }: { lore: ((id: string) => ClassicLore | null) | null }) {
  const profile = useStore(profileStore, (p) => p)
  const beaten = useMemo(() => beatenIds(profile).classicIds, [profile])
  const [era, setEra] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<ClassicCharacter | null>(null)
  const list = CLASSIC_ROSTER.filter((c) => (era === 'all' || c.era === era) && c.name.toLowerCase().includes(query.trim().toLowerCase()))
  const l = open && lore ? lore(open.id) : null
  const m = open ? profile.memory[classicKey(open.id)] : undefined
  return (
    <Card title="The Codex" icon={<BookHeart className="size-4" />} action={<Pill tone="gold">{beaten.size}/{CLASSIC_ROSTER.length} cards</Pill>} data-codex>
      <p className="mb-3 text-xs text-slate-400">Beat a character to add their card to your Codex: their story, their words and your record against them.</p>
      <div className="mb-3 flex flex-wrap gap-2">
        <label className="flex min-w-[10rem] flex-1 items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm">
          <Search className="size-4 text-slate-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search characters" className="w-full bg-transparent text-white outline-none placeholder:text-slate-500" aria-label="Search characters" />
        </label>
        <select value={era} onChange={(e) => setEra(e.target.value)} className="rounded-xl bg-white/5 px-3 py-2 text-sm text-white" aria-label="Era">
          <option value="all">All eras</option>
          {CLASSIC_ERAS.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
        {list.map((c) => {
          const owned = beaten.has(c.id)
          const r = RARITY[rarityFor(c.elo)]
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => owned && setOpen(c)}
                disabled={!owned}
                data-codex-card={c.id}
                className={`flex w-full flex-col items-center gap-1 rounded-2xl border p-2 text-center transition ${owned ? 'bg-white/[0.04] hover:-translate-y-0.5' : 'bg-black/30 opacity-60'}`}
                style={{ borderColor: owned ? r.color : 'rgba(255,255,255,0.08)', boxShadow: owned ? `0 0 14px -6px ${r.color}` : undefined }}
              >
                <ClassicFace c={c} size="md" locked={!owned} />
                <span className="line-clamp-2 text-[10px] leading-tight font-semibold text-white">{owned ? c.name : '???'}</span>
                <span className="text-[9px] font-bold tracking-wider uppercase" style={{ color: r.color }}>
                  {r.name}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <Modal open={open !== null} title={open?.name ?? ''} onClose={() => setOpen(null)} size="md">
        {open && (
          <div className="space-y-3" data-codex-page={open.id}>
            <div className="flex items-center gap-3">
              <ClassicFace c={open} size="xl" />
              <div className="min-w-0">
                <div className="text-sm text-slate-300">{open.title}</div>
                <div className="text-xs text-amber-200">{l?.lived ?? getClassicEra(open.era).caption}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Pill tone="sky">~{open.elo} Elo</Pill>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ color: RARITY[rarityFor(open.elo)].color, border: `1px solid ${RARITY[rarityFor(open.elo)].color}` }}>
                    {RARITY[rarityFor(open.elo)].name}
                  </span>
                </div>
              </div>
            </div>
            {l && <p className="text-sm text-slate-200">{l.bio}</p>}
            {l && (
              <ul className="space-y-1 text-xs text-slate-300">
                {l.facts.map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
            )}
            <div className="space-y-1 rounded-2xl bg-white/[0.04] p-3 text-xs">
              <div className="italic text-slate-200">“{open.line}”</div>
              {l && <div className="italic text-slate-400">On winning: “{l.victory}”</div>}
              {l && <div className="italic text-slate-400">On losing: “{l.defeat}”</div>}
            </div>
            {m && (
              <div className="text-xs text-slate-400">
                Your record: {m.wins} won, {m.losses} lost, {m.draws} drawn · bond: {BOND_LEVELS[bondLevel(m.games) - 1]?.name ?? 'Stranger'}
              </div>
            )}
          </div>
        )}
      </Modal>
    </Card>
  )
}

function Collections() {
  const profile = useStore(profileStore, (p) => p)
  const claimed = useStore(journeyStore, (j) => j.collection)
  const beaten = useMemo(() => beatenIds(profile).classicIds, [profile])
  const eras = collections(beaten)
  const claim = (era: string) => {
    journeyStore.set((j) => ({ ...j, collection: [...j.collection, era] }))
    payRewards(collectionReward(era as Parameters<typeof collectionReward>[0]), 'Collection complete')
  }
  return (
    <Card title="Collection" icon={<Trophy className="size-4" />} action={<Pill tone="gold">{completion(beaten)}% complete</Pill>} data-collection>
      <p className="mb-3 text-xs text-slate-400">Beat all ten characters of an era to complete its collection: 500 coins and the era’s own board and pieces.</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {eras.map((e) => {
          const done = claimed.includes(e.era)
          return (
            <li key={e.era} className="rounded-2xl bg-white/[0.04] p-3" data-collection-era={e.era}>
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{e.name}</span>
                <span className="font-mono text-xs text-slate-300">
                  {e.owned}/{e.total}
                </span>
              </div>
              <Bar value={e.owned / e.total} className="mt-2" color={e.complete ? '#34d399' : undefined} />
              {e.complete && !done && (
                <Button size="sm" variant="primary" className="mt-2 w-full" icon={<Gift className="size-4" />} onClick={() => claim(e.era)}>
                  Claim the reward
                </Button>
              )}
              {done && <div className="mt-2 text-[11px] text-emerald-300">Reward collected</div>}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function DreamMatches() {
  const [watching, setWatching] = useState<DreamMatch | null>(null)
  const [custom, setCustom] = useState<{ a: string; b: string }>({ a: 'cleopatra', b: 'alexander' })
  if (watching) return <DreamMatchViewer match={watching} onClose={() => setWatching(null)} />
  return (
    <div className="space-y-4">
      <Card title="Dream matches" icon={<Clapperboard className="size-4" />} data-dreams>
        <p className="mb-3 text-xs text-slate-400">Games that never happened. Pick a pair and watch them play each other, each in their own style.</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {DREAM_MATCHES.map((m) => {
            const a = getClassic(m.a)
            const b = getClassic(m.b)
            if (!a || !b) return null
            return (
              <li key={`${m.a}-${m.b}`}>
                <button type="button" onClick={() => setWatching(m)} className="flex w-full items-center gap-2 rounded-2xl bg-white/[0.04] p-2 text-left hover:bg-white/[0.08]" data-dream={`${m.a}-${m.b}`}>
                  <ClassicFace c={a} size="sm" />
                  <span className="text-xs font-black text-amber-300">VS</span>
                  <ClassicFace c={b} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">
                      {a.name.split(' ')[0]} vs {b.name.split(' ')[0]}
                    </span>
                    <span className="block truncate text-[11px] text-slate-400">{m.title}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </Card>
      <Card title="Make your own" icon={<Swords className="size-4" />}>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-center">
          {(['a', 'b'] as const).map((side, i) => (
            <div key={side} className={i === 1 ? 'sm:order-3' : ''}>
              <select value={custom[side]} onChange={(e) => setCustom((c) => ({ ...c, [side]: e.target.value }))} className="w-full rounded-xl bg-white/5 px-3 py-2 text-sm text-white" aria-label={side === 'a' ? 'White' : 'Black'}>
                {CLASSIC_ROSTER.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <span className="text-center text-xs font-black text-amber-300 sm:order-2">VS</span>
          <Button variant="primary" className="sm:order-4" disabled={custom.a === custom.b} onClick={() => setWatching({ a: custom.a, b: custom.b, title: 'A dream match of your own' })}>
            Watch
          </Button>
        </div>
      </Card>
    </div>
  )
}
