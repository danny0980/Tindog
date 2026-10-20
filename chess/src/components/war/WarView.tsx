import { Crown, Flag, Globe2, Shield, Swords, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ARMY_SLOTS, type ArmySlot, TRAITS, TRAIT_OF, armyEffects, armyMembers, draft } from '../../army/army'
import { ARCHETYPES } from '../../data/campaign/archetypes'
import { getClassic } from '../../data/classic/roster'
import { classicPersona } from '../../data/personas'
import { useStore } from '../../hooks/useStore'
import { profileStore } from '../../stores/profileStore'
import type { ColorChoice } from '../../types/chess'
import { FACTIONS, TERRITORIES, type BattleMode, type Territory, attackable, besieger, getTerritory, startWar } from '../../war/war'
import { CAMPAIGN_TIME_CONTROLS, type ChallengeClock } from '../campaign/battleOptions'
import { useBeatenClassics } from '../history/useBeaten'
import { PortraitEmblem } from '../legends/PortraitEmblem'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Segmented } from '../ui/Segmented'

const CAPITALS = ['americas', 'scandinavia', 'greece', 'egypt', 'japan'] as const
const SLOT_NAME: Record<ArmySlot, string> = { king: 'King', queen: 'Queen', rook: 'Rook', bishop: 'Bishop', knight: 'Knight' }

/** The Historical World War: the map, your territories and your army. */
export function WarView({ onBattle }: { onBattle: (territoryId: string, mode: BattleMode, options: ChallengeClock) => void }) {
  const war = useStore(profileStore, (p) => p.war)
  const [tab, setTab] = useState<'map' | 'army'>('map')
  const [confirmQuit, setConfirmQuit] = useState(false)

  if (!war) return <ChooseCapital />
  return (
    <div className="mx-auto w-full max-w-6xl space-y-3" data-war>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl bg-white/[0.05] p-1" role="tablist" aria-label="War">
          {(['map', 'army'] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} data-war-tab={t} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === t ? 'bg-accent text-ink-950' : 'text-slate-300'}`}>
              {t === 'map' ? <Globe2 className="size-3.5" /> : <Users className="size-3.5" />} {t === 'map' ? 'World map' : 'Your army'}
            </button>
          ))}
        </div>
        <span className="font-mono text-xs text-slate-400" data-war-owned>
          {war.owned.length}/{TERRITORIES.length} territories · battle {war.turn}
        </span>
        <button type="button" onClick={() => setConfirmQuit(true)} className="ml-auto text-xs text-slate-500 hover:text-red-300">
          Abandon the war
        </button>
      </div>
      {tab === 'map' ? <WarMap onBattle={onBattle} /> : <ArmyBuilder />}
      <ConfirmDialog
        open={confirmQuit}
        title="Abandon the war?"
        message="Your conquests are lost and the map resets. Your army stays."
        confirmLabel="Abandon"
        onCancel={() => setConfirmQuit(false)}
        onConfirm={() => {
          setConfirmQuit(false)
          profileStore.set({ ...profileStore.get(), war: null })
        }}
      />
    </div>
  )
}

function ChooseCapital() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-3" data-war-start>
      <p className="text-sm text-slate-300">Five empires hold the world, each territory defended by a figure from history. Choose where you raise your banner, then conquer the territories on your borders. Every battle is a game of chess; after each one the empires may strike back.</p>
      <div className="grid gap-3 sm:grid-cols-5">
        {CAPITALS.map((id) => {
          const t = getTerritory(id)!
          const c = getClassic(t.defender)
          const f = FACTIONS[t.faction]
          return (
            <button
              key={id}
              type="button"
              data-capital={id}
              onClick={() => profileStore.set({ ...profileStore.get(), war: startWar(id, new Date().toISOString()) })}
              className="glass flex flex-col gap-1 rounded-3xl p-4 text-left transition hover:-translate-y-0.5 hover:border-white/25"
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: f.color }}>
                {f.name}
              </span>
              <span className="font-display text-lg font-extrabold text-white">{t.name}</span>
              <span className="text-xs text-slate-400">Neighbours: {t.neighbors.map((n) => getTerritory(n)?.name).join(', ')}</span>
              <span className="mt-1 text-[11px] text-slate-500">Rivals start near {c?.elo ?? '?'} Elo</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function WarMap({ onBattle }: { onBattle: (territoryId: string, mode: BattleMode, options: ChallengeClock) => void }) {
  const war = useStore(profileStore, (p) => p.war)
  const army = useStore(profileStore, (p) => p.army)
  const [selected, setSelected] = useState<string | null>(null)
  const [options, setOptions] = useState<ChallengeClock>({ color: 'random', timeControlId: 'none' })
  const targets = useMemo(() => new Set(war ? attackable(war).map((t) => t.id) : []), [war])
  const effects = useMemo(() => armyEffects(army), [army])
  if (!war) return null
  const owned = new Set(war.owned)
  const sieged = Object.keys(war.sieges)
  const pick = selected ? getTerritory(selected) : null
  const edges = TERRITORIES.flatMap((t) => t.neighbors.filter((n) => n > t.id).map((n) => [t, getTerritory(n)!] as const))

  const status = (t: Territory): { label: string; mode: BattleMode | null; foe: string | null } => {
    if (war.sieges[t.id]) return { label: `Under siege · falls in ${war.sieges[t.id]!.turns} battle${war.sieges[t.id]!.turns === 1 ? '' : 's'}`, mode: 'defend', foe: besieger(war, t.id)?.defender ?? null }
    if (owned.has(t.id)) return { label: t.id === war.capital ? 'Your capital' : 'Yours', mode: null, foe: null }
    if (targets.has(t.id)) return { label: 'On your border: attack', mode: 'attack', foe: t.defender }
    return { label: 'Out of reach: take a neighbouring territory first', mode: null, foe: t.defender }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="glass overflow-hidden rounded-3xl p-2">
        <svg viewBox="0 0 100 70" className="h-auto w-full" role="img" aria-label="World war map" data-war-map>
          <defs>
            <pattern id="war-grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(148,163,184,0.08)" strokeWidth="0.2" />
            </pattern>
            <radialGradient id="war-sea" cx="50%" cy="45%" r="70%">
              <stop offset="0%" stopColor="#0f2740" />
              <stop offset="100%" stopColor="#050b16" />
            </radialGradient>
          </defs>
          <rect width="100" height="70" fill="url(#war-sea)" />
          <rect width="100" height="70" fill="url(#war-grid)" />
          {edges.map(([a, b]) => (
            <line key={`${a.id}-${b.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={owned.has(a.id) && owned.has(b.id) ? 'rgba(251,191,36,0.6)' : 'rgba(148,163,184,0.25)'} strokeWidth={owned.has(a.id) && owned.has(b.id) ? 0.5 : 0.3} strokeDasharray={(owned.has(a.id) && targets.has(b.id)) || (owned.has(b.id) && targets.has(a.id)) ? '1 0.8' : undefined} />
          ))}
          {TERRITORIES.map((t) => {
            const mine = owned.has(t.id)
            const color = mine ? '#fbbf24' : FACTIONS[t.faction].color
            return (
              <g key={t.id} onClick={() => setSelected(t.id)} className="cursor-pointer" data-territory={t.id} data-owner={mine ? 'you' : t.faction} role="button" aria-label={`${t.name}: ${status(t).label}`}>
                <circle cx={t.x} cy={t.y} r={5.5} fill="transparent" />
                {war.sieges[t.id] && <circle cx={t.x} cy={t.y} r={4.2} fill="none" stroke="#ef4444" strokeWidth={0.6} className="animate-pulse" />}
                {targets.has(t.id) && <circle cx={t.x} cy={t.y} r={3.6} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={0.35} strokeDasharray="0.8 0.6" />}
                <circle cx={t.x} cy={t.y} r={selected === t.id ? 3.1 : 2.6} fill={color} fillOpacity={mine ? 0.95 : 0.55} stroke={selected === t.id ? '#fff' : 'rgba(0,0,0,0.5)'} strokeWidth={0.4} />
                {t.id === war.capital && <text x={t.x} y={t.y + 1} textAnchor="middle" fontSize="2.6" fill="#1c1003">★</text>}
                <text x={t.x} y={t.y + 5.4} textAnchor="middle" fontSize="2" fill="rgba(226,232,240,0.85)">
                  {t.name}
                </text>
              </g>
            )
          })}
        </svg>
        <div className="flex flex-wrap gap-3 px-2 py-2 text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-amber-400" /> Yours
          </span>
          {Object.values(FACTIONS).map((f) => (
            <span key={f.id} className="flex items-center gap-1">
              <span className="size-2 rounded-full" style={{ background: f.color }} /> {f.name}
            </span>
          ))}
        </div>
      </div>

      <aside className="space-y-3">
        {sieged.length > 0 && (
          <div className="rounded-2xl border border-red-400/40 bg-red-500/10 p-3 text-xs text-red-100" role="alert">
            <Shield className="mb-1 size-4" /> Under siege: {sieged.map((id) => getTerritory(id)?.name).join(', ')}. Break the siege before it falls.
          </div>
        )}
        {pick ? (
          <div className="glass space-y-3 rounded-2xl p-4" data-territory-panel={pick.id}>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: owned.has(pick.id) ? '#fbbf24' : FACTIONS[pick.faction].color }}>
              {owned.has(pick.id) ? 'Your territory' : FACTIONS[pick.faction].name}
            </div>
            <div className="font-display text-xl font-extrabold text-white">{pick.name}</div>
            <p className="text-xs text-slate-300">{status(pick).label}</p>
            {status(pick).foe && <Foe id={status(pick).foe!} />}
            {status(pick).mode && (
              <>
                {!effects.initiative && (
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
                )}
                <Segmented label="Clock" options={CAMPAIGN_TIME_CONTROLS} value={options.timeControlId} onChange={(v) => setOptions({ ...options, timeControlId: v })} />
                <Button variant="primary" className="w-full" icon={status(pick).mode === 'attack' ? <Swords className="size-4" /> : <Shield className="size-4" />} onClick={() => onBattle(pick.id, status(pick).mode!, options)} data-war-battle>
                  {status(pick).mode === 'attack' ? `Attack ${pick.name}` : `Break the siege`}
                </Button>
              </>
            )}
          </div>
        ) : (
          <p className="glass rounded-2xl p-4 text-xs text-slate-400">Tap a territory. Dashed rings are on your border and can be attacked.</p>
        )}
        <div className="glass rounded-2xl p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">
            <Users className="size-3.5" /> Your army’s traits
          </div>
          {effects.briefing.length === 0 ? <p className="text-xs text-slate-500">No one drafted yet: open “Your army”.</p> : effects.briefing.map((b) => <p key={b} className="text-xs text-slate-300">{b}</p>)}
        </div>
        <div className="glass max-h-56 overflow-auto rounded-2xl p-3" aria-label="War log">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">
            <Flag className="size-3.5" /> War log
          </div>
          {[...war.log].reverse().map((e, i) => (
            <p key={`${e.turn}-${i}`} className="text-xs text-slate-300">
              <span className="font-mono text-slate-500">{e.turn}.</span> {e.text}
            </p>
          ))}
        </div>
      </aside>
    </div>
  )
}

function Foe({ id }: { id: string }) {
  const c = getClassic(id)
  if (!c) return null
  const p = classicPersona(c)
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-2">
      <PortraitEmblem spec={p.portrait} label={c.name} size="sm" />
      <div className="min-w-0 text-xs">
        <div className="font-semibold text-white">{c.name}</div>
        <div className="text-slate-400">
          {c.elo} Elo · {ARCHETYPES[c.archetype].name}
        </div>
      </div>
    </div>
  )
}

function ArmyBuilder() {
  const army = useStore(profileStore, (p) => p.army)
  const beaten = useBeatenClassics()
  const beatenIds = useMemo(() => new Set(beaten.map((c) => c.id)), [beaten])
  const effects = armyEffects(army)
  const seated = new Map(armyMembers(army).map((m) => [m.slot, m.c]))
  const seat = (slot: ArmySlot, id: string | null) => profileStore.set({ ...profileStore.get(), army: draft(army, slot, id, beatenIds) })

  return (
    <div className="space-y-4" data-army>
      <p className="text-sm text-slate-300">Draft characters you have beaten into your command. Each brings the trait of their playing style to every World War battle; the King’s seat counts double. Traits never change the rules of chess.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {ARMY_SLOTS.map((slot) => {
          const c = seated.get(slot)
          const trait = c ? TRAITS[TRAIT_OF[c.archetype]] : null
          return (
            <div key={slot} className="glass space-y-2 rounded-2xl p-3" data-army-slot={slot}>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200">
                {slot === 'king' && <Crown className="size-3.5" />} {SLOT_NAME[slot]}
                {slot === 'king' && <span className="text-slate-500">×2</span>}
              </div>
              {c ? (
                <div className="flex items-center gap-2">
                  <PortraitEmblem spec={classicPersona(c).portrait} label={c.name} size="sm" />
                  <div className="min-w-0 text-xs">
                    <div className="truncate font-semibold text-white">{c.name}</div>
                    <div className="text-sky-200">{trait?.name}</div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">Empty seat</p>
              )}
              <select
                aria-label={`${SLOT_NAME[slot]} seat`}
                value={c?.id ?? ''}
                onChange={(e) => seat(slot, e.target.value || null)}
                className="w-full rounded-lg border border-white/10 bg-ink-900 px-2 py-1.5 text-xs text-slate-200"
                data-army-select={slot}
              >
                <option value="">— Empty —</option>
                {beaten.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} · {TRAITS[TRAIT_OF[b.archetype]].name}
                  </option>
                ))}
              </select>
            </div>
          )
        })}
      </div>
      {beaten.length === 0 && <p className="text-xs text-amber-200">Beat Classic Chess opponents to recruit them.</p>}
      <div className="glass rounded-2xl p-4" data-army-effects>
        <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">In battle</div>
        {effects.briefing.length === 0 ? <p className="text-xs text-slate-500">No traits yet.</p> : effects.briefing.map((b) => <p key={b} className="text-sm text-slate-200">{b}</p>)}
      </div>
    </div>
  )
}
