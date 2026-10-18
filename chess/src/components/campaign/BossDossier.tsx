import { BookOpen, Coins, Crown, Gem, Lightbulb, Lock, Swords } from 'lucide-react'
import type { ReactNode } from 'react'
import { ARCHETYPES } from '../../data/campaign/archetypes'
import { BOOKS } from '../../data/campaign/books'
import { getGrandRealm } from '../../data/campaign/realms'
import { RELICS, getRelic, relicSlots } from '../../data/campaign/relics'
import type { Boss, CampaignProgress, RelicId } from '../../types/campaign'
import { bossRecord, starTarget, twoStarTarget } from '../../utils/campaign'
import { PortraitEmblem } from '../legends/PortraitEmblem'
import { PORTRAIT_ICONS } from '../legends/portraitIcons'
import { Button } from '../ui/Button'
import { type BattleOptions, CAMPAIGN_TIME_CONTROLS } from './battleOptions'
import { RelicTile } from './RelicTile'
import { StarRow } from './StarRow'

interface BossDossierProps {
  boss: Boss
  progress: CampaignProgress
  unlocked: boolean
  lockedReason: string
  options: BattleOptions
  onOptions: (next: BattleOptions) => void
  onToggleRelic: (id: RelicId) => void
  onBattle: () => void
  /** False when the host pins the battle button elsewhere (the phone sheet's footer). */
  showAction?: boolean
}

/** Pre-battle briefing: who the boss is, how it plays, what it pays, and your relic loadout. */
export function BossDossier({ boss, progress, unlocked, lockedReason, options, onOptions, onToggleRelic, onBattle, showAction = true }: BossDossierProps) {
  const record = bossRecord(progress, boss.id)
  const archetype = ARCHETYPES[boss.archetype]
  const ArchetypeIcon = PORTRAIT_ICONS[archetype.icon]
  const realm = getGrandRealm(boss.realm)
  const equipped = progress.equipped
  const slots = relicSlots(progress.relics)
  const wearable = RELICS.filter((r) => progress.relics.includes(r.id) && r.scope !== 'passive')
  const three = starTarget(boss.par, equipped)
  const reward = record.firstClear ? boss.rewards.repeat : boss.rewards.first

  return (
    <article className="space-y-4" aria-label={`${boss.name} dossier`}>
      <header className="flex items-start gap-4">
        <PortraitEmblem spec={boss.portrait} label={boss.name} size="xl" locked={!unlocked} defeated={Boolean(record.firstClear)} className="max-sm:size-20 max-sm:rounded-3xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em]">
            <span className="text-accent">
              {realm.name} · #{boss.index + 1}
            </span>
            {boss.rank !== 'regular' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-300/15 px-2 py-0.5 text-amber-200">
                {boss.rank === 'overlord' ? <Crown className="size-3" /> : <Gem className="size-3" />}
                {boss.rank === 'overlord' ? 'Overlord' : 'Milestone'}
              </span>
            )}
            {boss.legendRef && <span className="rounded-full bg-white/10 px-2 py-0.5 text-slate-200">Chronos legend</span>}
          </div>
          <h2 className="mt-1 font-display text-xl leading-tight font-extrabold text-white sm:text-2xl">{boss.name}</h2>
          <div className="text-sm text-slate-400">
            {boss.title} · <span className="font-mono">~{boss.elo}</span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <StarRow stars={record.stars} size="md" />
            <span className="text-xs text-slate-400">
              {record.wins}W · {record.losses}L · {record.draws}D{record.bestMoves !== null ? ` · best ${record.bestMoves} moves` : ''}
            </span>
          </div>
        </div>
      </header>

      <p className="text-sm text-slate-300">{boss.bio}</p>

      <div className="grid gap-2 sm:grid-cols-2">
        <InfoCard icon={<ArchetypeIcon className="size-4" />} title={archetype.name}>
          <p>{archetype.summary}</p>
          <p className="mt-1.5 flex gap-1.5 text-slate-400">
            <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-amber-300" />
            {archetype.counterTip}
          </p>
        </InfoCard>
        <InfoCard icon={<BookOpen className="size-4" />} title={boss.book ? BOOKS[boss.book].name : 'Personal repertoire'}>
          <p>{boss.book ? BOOKS[boss.book].summary : 'This legend plays its own hand-written opening book from Chronos Chess.'}</p>
          <p className="mt-1.5 text-slate-400">
            {boss.zone.name} · board &amp; soundtrack of the {boss.legendRef ? boss.settingName : 'zone'}
          </p>
        </InfoCard>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="★★★ within" value={`${three} moves`} />
        <Stat label="★★ within" value={`${twoStarTarget(boss.par, equipped)} moves`} />
        <Stat label={record.firstClear ? 'Rematch bounty' : 'First-win bounty'} value={<span className="inline-flex items-center gap-1 text-yellow-300"><Coins className="size-3.5" />{reward}</span>} />
      </div>

      {boss.relic && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-3">
          <RelicTile relic={getRelic(boss.relic)} owned={progress.relics.includes(boss.relic)} size="md" />
          <div className="min-w-0 text-sm">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200">{progress.relics.includes(boss.relic) ? 'Relic claimed' : 'Relic reward'}</div>
            <div className="font-semibold text-white">{getRelic(boss.relic).name}</div>
            <div className="text-xs text-slate-300">{getRelic(boss.relic).description}</div>
          </div>
        </div>
      )}

      <section aria-label="Relic loadout">
        <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
          <span>Relic loadout</span>
          <span className="font-mono normal-case tracking-normal">
            {equipped.length}/{slots} slots
          </span>
        </div>
        {wearable.length === 0 ? (
          <p className="rounded-xl bg-white/5 p-3 text-xs text-slate-400">Defeat milestone (#10) and overlord (#20) bosses to earn relics.</p>
        ) : (
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {wearable.map((relic) => {
              const on = equipped.includes(relic.id)
              const full = !on && equipped.length >= slots
              return (
                <button
                  key={relic.id}
                  type="button"
                  aria-pressed={on}
                  disabled={full}
                  onClick={() => onToggleRelic(relic.id)}
                  className={`flex items-center gap-2 rounded-xl border p-2 text-left transition disabled:opacity-40 ${on ? 'border-accent bg-accent/15' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.07]'}`}
                >
                  <RelicTile relic={relic} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-white">{relic.name}</span>
                    <span className="block truncate text-[10px] text-slate-400">{relic.scope === 'rush' ? 'Time Rush' : 'Campaign battles'}</span>
                  </span>
                  <span className={`text-[10px] font-bold ${on ? 'text-accent' : 'text-slate-500'}`}>{on ? 'ON' : 'OFF'}</span>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Segmented
          label="Play as"
          options={[
            { id: 'w', label: 'White' },
            { id: 'random', label: 'Random' },
            { id: 'b', label: 'Black' },
          ]}
          value={options.color}
          onChange={(v) => onOptions({ ...options, color: v === 'w' || v === 'b' ? v : 'random' })}
        />
        <Segmented label="Clock" options={CAMPAIGN_TIME_CONTROLS} value={options.timeControlId} onChange={(v) => onOptions({ ...options, timeControlId: v })} />
      </div>

      {showAction && <BossBattleAction boss={boss} progress={progress} unlocked={unlocked} lockedReason={lockedReason} onBattle={onBattle} />}
    </article>
  )
}

/** The dossier's primary action: battle / rematch, or why the boss is still locked. */
export function BossBattleAction({ boss, progress, unlocked, lockedReason, onBattle }: Pick<BossDossierProps, 'boss' | 'progress' | 'unlocked' | 'lockedReason' | 'onBattle'>) {
  if (!unlocked) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-white/5 p-3 text-sm text-slate-300">
        <Lock className="size-4 shrink-0" /> {lockedReason}
      </div>
    )
  }
  return (
    <Button variant="primary" size="lg" className="w-full" onClick={onBattle} icon={<Swords className="size-5" />}>
      {bossRecord(progress, boss.id).firstClear ? 'Rematch' : 'Battle'} {boss.shortName}
    </Button>
  )
}

function InfoCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-300">
      <div className="mb-1 flex items-center gap-1.5 text-sm font-bold text-white">
        <span className="text-accent">{icon}</span>
        {title}
      </div>
      {children}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-white/5 px-2 py-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-0.5 font-mono text-sm font-bold text-white">{value}</div>
    </div>
  )
}

function Segmented<T extends string>({ label, options, value, onChange }: { label: string; options: ReadonlyArray<{ id: T; label: string }>; value: T; onChange: (v: T) => void }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className="grid gap-1 rounded-xl bg-white/[0.05] p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            onClick={() => onChange(o.id)}
            className={`rounded-lg py-2 font-mono text-xs font-semibold transition-colors ${value === o.id ? 'bg-accent text-ink-950' : 'text-slate-300 hover:text-white'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
