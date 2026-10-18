import { Coins, Crown, Flame, Puzzle, Swords, Trophy } from 'lucide-react'
import type { ReactNode } from 'react'
import { AchievementGrid } from '../components/profile/AchievementGrid'
import { LegendPortrait } from '../components/legends/LegendPortrait'
import { LEGENDS, isLegendUnlocked } from '../data/historicalLegends'
import { formatShortDate } from '../utils/date'
import { EloChart } from '../components/profile/EloChart'
import { MatchHistory } from '../components/profile/MatchHistory'
import { DIFFICULTIES, DIFFICULTY_CONFIGS } from '../constants/game'
import { useStore } from '../hooks/useStore'
import { profileStore } from '../stores/profileStore'
import type { MatchRecord } from '../types/profile'
import { rankTitle } from '../utils/progression'

export function ProfileView({ onReview }: { onReview: (match: MatchRecord) => void }) {
  const profile = useStore(profileStore, (p) => p)
  const { stats } = profile
  const winRate = stats.games ? Math.round((stats.wins / stats.games) * 100) : 0
  const circumference = 2 * Math.PI * 34
  const segments = [
    { value: stats.wins, color: '#34d399' },
    { value: stats.draws, color: '#38bdf8' },
    { value: stats.losses, color: '#f87171' },
  ]
  let offset = 0

  return (
    <div className="safe-px mx-auto w-full max-w-7xl flex-1 space-y-4 pb-4">
      {/* Profile card */}
      <section className="glass relative overflow-hidden rounded-2xl p-5">
        <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-accent/20 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-wrap items-center gap-5">
          <div className="idle-pause relative flex size-20 animate-float items-center justify-center rounded-3xl bg-gradient-to-br from-accent to-accent-2 font-display text-3xl font-extrabold text-ink-950 shadow-[0_20px_50px_-15px_var(--accent)]">
            {profile.name.slice(0, 1).toUpperCase()}
            <Crown className="absolute -top-3 -right-2 size-7 rotate-12 text-amber-300 drop-shadow" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-accent">{rankTitle(profile.elo)}</div>
            <h2 className="truncate text-2xl font-extrabold text-white">{profile.name}</h2>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
              <span>
                Peak <span className="font-mono font-bold text-slate-200">{profile.peakElo}</span>
              </span>
              <span>
                Best streak <span className="font-mono font-bold text-slate-200">{stats.bestStreak}</span>
              </span>
              <span>
                Analyzed <span className="font-mono font-bold text-slate-200">{profile.gamesAnalyzed}</span>
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Elo rating</div>
            <div className="holo-text animate-shimmer font-display text-5xl font-extrabold">{profile.elo}</div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="glass rounded-2xl p-4">
          <h3 className="mb-2 text-sm font-semibold text-white">Rating progress</h3>
          <EloChart points={profile.eloHistory} />
        </section>

        <section className="glass flex items-center gap-5 rounded-2xl p-4">
          <div className="relative size-32 shrink-0">
            <svg viewBox="0 0 80 80" className="size-32 -rotate-90" role="img" aria-label={`Win rate ${winRate}%`}>
              <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
              {stats.games > 0 &&
                segments.map((s) => {
                  const length = (s.value / stats.games) * circumference
                  const el = (
                    <circle
                      key={s.color}
                      cx="40"
                      cy="40"
                      r="34"
                      fill="none"
                      stroke={s.color}
                      strokeWidth="9"
                      strokeDasharray={`${length} ${circumference - length}`}
                      strokeDashoffset={-offset}
                    />
                  )
                  offset += length
                  return el
                })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-xl font-bold text-white">{winRate}%</span>
              <span className="text-[10px] uppercase tracking-wider text-slate-500">win rate</span>
            </div>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-2">
            <Stat icon={<Swords className="size-4" />} label="Games" value={stats.games} />
            <Stat icon={<Trophy className="size-4 text-emerald-300" />} label="Wins" value={stats.wins} />
            <Stat icon={<span className="size-2.5 rounded-full bg-sky-400" />} label="Draws" value={stats.draws} />
            <Stat icon={<span className="size-2.5 rounded-full bg-red-400" />} label="Losses" value={stats.losses} />
            <Stat icon={<Flame className="size-4 text-orange-300" />} label="Streak" value={stats.currentStreak} />
            <Stat icon={<Puzzle className="size-4 text-accent" />} label="Puzzles" value={Object.keys(profile.puzzles.solved).length} />
          </div>
        </section>
      </div>

      <section className="glass rounded-2xl p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Wins by difficulty</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {DIFFICULTIES.map((d) => (
            <div key={d.id} className="rounded-xl bg-white/[0.04] p-3">
              <div className="text-xs text-slate-400">{d.label}</div>
              <div className="font-mono text-2xl font-bold text-white">{stats.winsByDifficulty[d.id]}</div>
              <div className="text-[10px] text-slate-500">~{DIFFICULTY_CONFIGS[d.id].elo} Elo</div>
            </div>
          ))}
        </div>
      </section>

      <section className="glass rounded-2xl p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Hall of Legends</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {LEGENDS.map((legend) => {
            const won = profile.legends.defeated[legend.id]
            return (
              <div key={legend.id} className={`flex items-center gap-3 rounded-xl p-2.5 ${won ? 'bg-amber-300/10 ring-1 ring-amber-300/30' : 'bg-white/[0.03]'}`}>
                <LegendPortrait legendId={legend.id} size="sm" locked={!won && !isLegendUnlocked(legend.id, profile.legends.defeated)} defeated={Boolean(won)} />
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold text-white">{legend.name}</div>
                  <div className="font-mono text-[10px] text-slate-400">
                    {profile.legends.wins[legend.id] ?? 0}W · {profile.legends.losses[legend.id] ?? 0}L
                  </div>
                  <div className={`text-[10px] font-semibold ${won ? 'text-amber-300' : 'text-slate-500'}`}>{won ? `Defeated ${formatShortDate(won)}` : 'Undefeated'}</div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="glass rounded-2xl p-4">
        <AchievementGrid unlocked={profile.achievements} />
      </section>

      <section className="glass rounded-2xl p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Match history</h3>
          <span className="flex items-center gap-1 font-mono text-xs text-yellow-300">
            <Coins className="size-3.5" /> {profile.totalCoinsEarned} earned
          </span>
        </div>
        <MatchHistory matches={profile.matches} onReview={onReview} />
      </section>
    </div>
  )
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-2.5 py-2">
      <span className="flex size-4 items-center justify-center">{icon}</span>
      <span className="flex-1 text-xs text-slate-400">{label}</span>
      <span className="font-mono text-sm font-bold text-white">{value}</span>
    </div>
  )
}
