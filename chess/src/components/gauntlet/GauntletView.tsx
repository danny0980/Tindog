import { Clock3, Coins, Flame, Infinity as InfinityIcon, Play, RotateCcw, Shield, Skull, Swords, Trophy, Zap } from 'lucide-react'
import type { ReactNode } from 'react'
import { SPELLS, TACTICS, spellsForBoss } from '../../data/spells'
import { useGauntletBoss } from '../../hooks/useGauntletBoss'
import { useStore } from '../../hooks/useStore'
import { endGauntletRun, pickGauntletBoon, resumeGauntletRun, startGauntletRun } from '../../stores/gauntletActions'
import { gauntletStore } from '../../stores/gauntletStore'
import type { Boss } from '../../types/campaign'
import type { BoonId, GauntletRun } from '../../types/gauntlet'
import { formatClock } from '../../utils/chess'
import { BASE_INCREMENT_MS, BOONS, BOSS_CLOCK_MS, INTERRUPT_PENALTY_MS, START_BANK_MS, targetElo } from '../../utils/gauntlet'
import { PortraitEmblem } from '../legends/PortraitEmblem'
import { PORTRAIT_ICONS } from '../legends/portraitIcons'
import { Button } from '../ui/Button'
import { LeaderboardPanel } from './LeaderboardPanel'

interface GauntletViewProps {
  onFight: (boss: Boss) => void
  onReturnToBoard: () => void
}

const BOON_ICONS: Record<BoonId, typeof Zap> = { 'time-cache': Clock3, tempo: Zap, emp: Flame, tactic: Swords, shield: Shield }

function Stat({ label, value, icon }: { label: string; value: ReactNode; icon: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] px-3 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
        {icon} {label}
      </div>
      <div className="mt-0.5 font-mono text-lg font-bold text-white">{value}</div>
    </div>
  )
}

function RunStats({ run }: { run: GauntletRun }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Run status">
      <Stat label="Time bank" value={formatClock(run.bankMs)} icon={<Clock3 className="size-3" />} />
      <Stat label="Defeated" value={run.defeated} icon={<Skull className="size-3" />} />
      <Stat label="Streak" value={run.streak} icon={<Flame className="size-3" />} />
      <Stat label="Score" value={run.score.toLocaleString()} icon={<Trophy className="size-3" />} />
    </div>
  )
}

/**
 * Endless Gauntlet: back-to-back bosses on one carried time bank. Wins
 * restore time and offer a boon; one loss ends the run.
 */
export default function GauntletView({ onFight, onReturnToBoard }: GauntletViewProps) {
  const { run, record } = useStore(gauntletStore, (s) => s)
  const active = run && run.phase !== 'over' ? run : null
  const next = useGauntletBoss(active && (active.phase === 'ready' || active.phase === 'interrupted') ? active : null)

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start" data-gauntlet>
      <div className="space-y-4">
        {!active && (
          <section className="glass space-y-4 rounded-3xl p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-400 via-violet-500 to-cyan-400 text-ink-950">
                <InfinityIcon className="size-7" />
              </div>
              <div>
                <h2 className="font-display text-xl font-extrabold tracking-wide text-white">Endless Gauntlet</h2>
                <p className="text-xs text-slate-400">How many bosses can you defeat on one clock?</p>
              </div>
            </div>
            <ul className="space-y-1.5 text-sm text-slate-300">
              <li>• You start with a <b className="text-white">{formatClock(START_BANK_MS)}</b> time bank; it carries from battle to battle (+{BASE_INCREMENT_MS / 1000} s per move).</li>
              <li>• Each win restores part of the time you spent and offers a <b className="text-white">boon</b> — time, tempo, an EMP, a tactic card or a takeback.</li>
              <li>• Bosses start at ~{targetElo(1)} Elo and get stronger every round — spells included. Takebacks are forbidden.</li>
              <li>• One loss (or a flag) ends the run. Score = boss ratings × streak bonus + time left.</li>
            </ul>
            {run?.phase === 'over' && (
              <div className="rounded-2xl border border-fuchsia-300/30 bg-fuchsia-400/10 p-3" data-run-over>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-fuchsia-200">Last run</div>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-4 text-sm text-white">
                  <span className="font-mono text-2xl font-bold">{run.score.toLocaleString()}</span>
                  <span>{run.defeated} defeated</span>
                  <span>best streak {run.bestStreak}</span>
                  {run.coins > 0 && (
                    <span className="flex items-center gap-1 text-yellow-300">
                      <Coins className="size-3.5" /> +{run.coins}
                    </span>
                  )}
                </div>
                {run.log.length > 0 && (
                  <ol className="mt-2 space-y-0.5 text-xs text-slate-300">
                    {run.log.map((l, i) => (
                      <li key={`${l.bossId}-${i}`}>
                        {i + 1}. {l.name} (~{l.elo}) — <span className={l.outcome === 'win' ? 'text-emerald-300' : l.outcome === 'loss' ? 'text-red-300' : 'text-sky-300'}>{l.outcome}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
            <Button variant="primary" size="lg" className="w-full" onClick={() => startGauntletRun()} icon={<Play className="size-5" />}>
              {run?.phase === 'over' ? 'Start a new run' : 'Start a run'}
            </Button>
          </section>
        )}

        {active && <RunStats run={active} />}

        {active?.phase === 'battle' && (
          <section className="glass flex flex-col items-center gap-3 rounded-3xl p-5 text-center">
            <Swords className="size-8 text-accent" />
            <div className="font-bold text-white">Battle in progress — round {active.round}</div>
            <p className="text-sm text-slate-400">Starting another game forfeits the run.</p>
            <Button variant="primary" onClick={onReturnToBoard} icon={<Play className="size-4" />}>
              Return to the board
            </Button>
          </section>
        )}

        {active?.phase === 'boon' && (
          <section className="glass rounded-3xl p-5" aria-label="Choose a boon" data-boons>
            <h3 className="font-display text-lg font-extrabold text-white">Victory! Choose a boon</h3>
            <p className="mb-3 text-xs text-slate-400">Boons last for the next battle (Tempo lasts the whole run).</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {active.offeredBoons.map((id) => {
                const Icon = BOON_ICONS[id]
                return (
                  <button
                    key={id}
                    type="button"
                    data-boon={id}
                    onClick={() => pickGauntletBoon(id)}
                    className="flex flex-col gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-accent hover:bg-accent/10"
                  >
                    <span className="flex items-center gap-2 text-sm font-bold text-white">
                      <Icon className="size-5 text-accent" /> {BOONS[id].name}
                    </span>
                    <span className="text-xs text-slate-300">{BOONS[id].description}</span>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {active?.phase === 'interrupted' && (
          <section className="glass space-y-3 rounded-3xl p-5" data-interrupted>
            <div className="font-bold text-white">Your last battle was interrupted</div>
            <p className="text-sm text-slate-400">
              The app closed mid-battle. Resume against the same boss with {INTERRUPT_PENALTY_MS / 1000} s less in your bank, or end the run here.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="primary" onClick={resumeGauntletRun} icon={<RotateCcw className="size-4" />}>
                Resume
              </Button>
              <Button onClick={endGauntletRun}>End run</Button>
            </div>
          </section>
        )}

        {active?.phase === 'ready' && (
          <section className="glass rounded-3xl p-5" aria-label="Next boss">
            <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-accent">Round {active.round} · target ~{targetElo(active.round)} Elo</div>
            {next.boss ? (
              <div className="mt-3 flex items-start gap-4">
                <PortraitEmblem spec={next.boss.portrait} label={next.boss.name} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="font-display text-xl font-extrabold text-white">{next.boss.name}</div>
                  <div className="text-sm text-slate-400">
                    {next.boss.title} · ~{next.boss.elo}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {spellsForBoss(next.boss).map((id) => {
                      const Icon = PORTRAIT_ICONS[SPELLS[id].icon]
                      return (
                        <span key={id} className="flex items-center gap-1 rounded-full border border-red-400/40 bg-red-500/10 px-2 py-0.5 text-[11px] text-red-100">
                          <Icon className="size-3" /> {SPELLS[id].name}
                        </span>
                      )
                    })}
                    {active.boons.tactics.map((t) => (
                      <span key={t} className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-100">
                        {TACTICS[t].name}
                      </span>
                    ))}
                    {active.boons.empBattles > 0 && <span className="rounded-full border border-cyan-300/40 bg-cyan-400/10 px-2 py-0.5 text-[11px] text-cyan-100">EMP</span>}
                    {active.boons.shields > 0 && <span className="rounded-full border border-sky-300/40 bg-sky-400/10 px-2 py-0.5 text-[11px] text-sky-100">Aegis ×{active.boons.shields}</span>}
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    Your clock {formatClock(active.bankMs)} vs {formatClock(BOSS_CLOCK_MS)} · +{(BASE_INCREMENT_MS + active.boons.incrementMs) / 1000} s per move · you play{' '}
                    {active.round % 2 === 1 ? 'White' : 'Black'}
                  </p>
                </div>
              </div>
            ) : next.failed ? (
              <div className="mt-3 space-y-2 text-sm text-slate-300" role="alert">
                <p>Couldn’t download the next boss.</p>
                <Button size="sm" onClick={next.retry} icon={<RotateCcw className="size-4" />}>
                  Retry
                </Button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-400" role="status">
                Summoning the next challenger…
              </p>
            )}
            <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
              <Button variant="primary" size="lg" disabled={!next.boss} onClick={() => next.boss && onFight(next.boss)} icon={<Swords className="size-5" />}>
                Fight round {active.round}
              </Button>
              <Button size="lg" onClick={endGauntletRun}>
                Cash out
              </Button>
            </div>
          </section>
        )}
      </div>

      <div className="space-y-4">
        <section className="glass grid grid-cols-3 gap-2 rounded-3xl p-4 text-center" aria-label="Personal bests">
          <Stat label="Best" value={record.bestScore.toLocaleString()} icon={<Trophy className="size-3" />} />
          <Stat label="Most" value={record.bestDefeated} icon={<Skull className="size-3" />} />
          <Stat label="Runs" value={record.runs} icon={<InfinityIcon className="size-3" />} />
        </section>
        <LeaderboardPanel local={record.leaderboard} highlight={run?.id ?? null} />
      </div>
    </div>
  )
}
