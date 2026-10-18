import { BookOpen, Coins, Hourglass, Lock, Swords, Trophy } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { getAchievement } from '../../constants/achievements'
import { TIME_CONTROLS } from '../../constants/game'
import { getBoardTheme, getPieceSet } from '../../constants/themes'
import { epochLabel, getCampaign, getEpoch, getLegend, isLegendUnlocked } from '../../data/legends'
import type { ColorChoice } from '../../types/chess'
import type { ChallengeOptions, Legend, LegendProgress } from '../../types/legend'
import { formatShortDate } from '../../utils/date'
import { ThemeSwatch } from '../shop/ThemeSwatch'
import { Button } from '../ui/Button'
import { LegendPortrait } from './LegendPortrait'

const STAT_LABELS: Record<keyof Legend['stats'], string> = {
  aggression: 'Aggression',
  calculation: 'Calculation',
  creativity: 'Creativity',
  cunning: 'Cunning',
}

/** Unhurried controls suit a duel with history (and the legends' think times). */
const DUEL_TIME_IDS = ['none', 'rapid-10-5', 'rapid-15-10', 'classical-30-20']

interface LegendDossierProps {
  legend: Legend
  progress: LegendProgress
  onChallenge: (options: ChallengeOptions) => void
}

export function LegendDossier({ legend, progress, onChallenge }: LegendDossierProps) {
  const [color, setColor] = useState<ColorChoice>('w')
  const [timeControlId, setTimeControlId] = useState('none')
  const epoch = getEpoch(legend.epoch)
  const unlocked = isLegendUnlocked(legend.id, progress.defeated)
  const defeatedOn = progress.defeated[legend.id]
  const chapters = getCampaign(legend.campaign).chapters
  const previousId = chapters[chapters.indexOf(legend.id) - 1]
  const previous = previousId ? getLegend(previousId) : null
  const achievement = getAchievement(legend.achievementId)
  const record = `${progress.wins[legend.id] ?? 0}W · ${progress.draws[legend.id] ?? 0}D · ${progress.losses[legend.id] ?? 0}L`

  return (
    <article className="glass relative overflow-hidden rounded-3xl p-5" aria-labelledby={`legend-${legend.id}`}>
      <div className="pointer-events-none absolute -top-24 -right-20 size-72 rounded-full bg-accent/20 blur-3xl" aria-hidden="true" />
      <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div>
          <div className="flex items-center gap-4">
            <LegendPortrait legendId={legend.id} size="xl" locked={!unlocked} defeated={Boolean(defeatedOn)} />
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-accent">{epoch.name}</div>
              <h2 id={`legend-${legend.id}`} className="font-display text-2xl font-extrabold tracking-wide text-white sm:text-3xl">
                {legend.name}
              </h2>
              <div className="text-sm text-slate-400">
                {legend.title} · {legend.lifespan}
              </div>
              <div className="mt-1 text-xs text-slate-500">{epoch.tagline}</div>
            </div>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-slate-300">{legend.bio}</p>
          <div className="mt-3 rounded-xl bg-white/[0.04] p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <Swords className="size-3.5" /> Playstyle
            </div>
            <p className="mt-1 text-sm text-slate-200">{legend.playstyle}</p>
            <div className="mt-2 flex items-start gap-1.5 text-xs text-slate-400">
              <BookOpen className="mt-0.5 size-3.5 shrink-0" /> {legend.signature}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
            {(Object.keys(STAT_LABELS) as Array<keyof Legend['stats']>).map((key) => (
              <div key={key}>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>{STAT_LABELS[key]}</span>
                  <span className="font-mono text-slate-200">{legend.stats[key]}/10</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2" style={{ width: `${legend.stats[key] * 10}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <Info label="Rating" value={`~${legend.elo}`} />
            <Info label="Your record" value={record} />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Rewards</div>
            <Reward icon={<Coins className="size-4 text-yellow-300" />}>
              {defeatedOn ? (
                <>
                  Defeated {formatShortDate(defeatedOn)} · rematch <span className="font-mono text-yellow-300">+{legend.repeatWinReward}</span>
                </>
              ) : (
                <>
                  First victory <span className="font-mono font-bold text-yellow-300">+{legend.firstWinReward}</span> coins
                </>
              )}
            </Reward>
            {achievement && (
              <Reward icon={<Trophy className="size-4 text-amber-300" />}>
                Trophy: <span className="font-semibold text-white">{achievement.title}</span>
              </Reward>
            )}
            <div className="mt-2 flex items-center gap-3">
              <div className="w-16 shrink-0">
                <ThemeSwatch theme={getBoardTheme(epoch.themeId)} pieceSet={getPieceSet(epoch.pieceSetId)} />
              </div>
              <div className="text-xs text-slate-300">
                <span className="font-semibold text-white">{getBoardTheme(epoch.themeId).name}</span> board &{' '}
                <span className="font-semibold text-white">{getPieceSet(epoch.pieceSetId).name}</span> pieces — yours for everyday play after the first win.
              </div>
            </div>
          </div>

          {unlocked ? (
            <>
              <div>
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Play as</div>
                <Segmented
                  options={[
                    { id: 'w', label: 'White' },
                    { id: 'random', label: 'Random' },
                    { id: 'b', label: 'Black' },
                  ]}
                  value={color}
                  onChange={(v) => setColor(v === 'w' || v === 'b' ? v : 'random')}
                />
              </div>
              <div>
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Time control</div>
                <Segmented
                  options={DUEL_TIME_IDS.map((id) => ({ id, label: id === 'none' ? '∞' : (TIME_CONTROLS.find((t) => t.id === id)?.label ?? id) }))}
                  value={timeControlId}
                  onChange={setTimeControlId}
                />
              </div>
              <Button variant="primary" size="lg" className="mt-1 w-full" icon={<Hourglass className="size-5" />} onClick={() => onChallenge({ color, timeControlId, strength: 'authentic' })}>
                {epoch.year === null ? `Cross into the ${epoch.name} & challenge` : `Travel to ${epochLabel(epoch)} & challenge`}
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
              <Lock className="size-5 shrink-0 text-slate-500" />
              <span>
                Defeat <span className="font-semibold text-white">{previous?.name ?? 'the previous legend'}</span> to open this chapter
                {legend.campaign === 'fantasy' ? ' of the realm.' : ' of history.'}
              </span>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.05] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="font-mono text-sm font-bold text-white">{value}</div>
    </div>
  )
}

function Reward({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-1 text-sm text-slate-300">
      {icon}
      <span>{children}</span>
    </div>
  )
}

function Segmented<T extends string>({ options, value, onChange }: { options: ReadonlyArray<{ id: T; label: string }>; value: T; onChange: (v: T) => void }) {
  return (
    <div className="grid gap-1 rounded-xl bg-white/[0.05] p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-lg py-2 text-xs font-semibold transition ${value === o.id ? 'bg-accent text-ink-950' : 'text-slate-300 hover:text-white'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
