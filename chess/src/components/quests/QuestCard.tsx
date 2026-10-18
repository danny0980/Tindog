import { Check, ChevronRight, Coins, Crosshair, Crown, Gem, Microscope, Moon, Puzzle, Rocket, Shield, Swords, Timer, Trophy, Zap } from 'lucide-react'
import type { QuestDef, QuestMetric } from '../../types/quest'
import { Button } from '../ui/Button'

const METRIC_ICONS: Record<QuestMetric, typeof Trophy> = {
  games_played: Swords,
  ai_wins: Trophy,
  black_wins: Moon,
  fast_wins: Zap,
  timed_games: Timer,
  captures: Crosshair,
  checks: Crown,
  castles: Shield,
  promotions: Gem,
  puzzles_solved: Puzzle,
  analyses: Microscope,
  rush_runs: Rocket,
  rush_points: Rocket,
}

interface QuestCardProps {
  quest: QuestDef
  value: number
  claimed: boolean
  onClaim: () => void
  onGo: () => void
}

export function QuestCard({ quest, value, claimed, onClaim, onGo }: QuestCardProps) {
  const Icon = METRIC_ICONS[quest.metric]
  const complete = value >= quest.target
  const pct = Math.min(100, (value / quest.target) * 100)
  return (
    <article
      className={`glass relative overflow-hidden rounded-2xl p-4 transition ${complete && !claimed ? 'ring-2 ring-accent shadow-[0_0_30px_-10px_var(--accent)]' : ''} ${claimed ? 'opacity-70' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${complete ? 'bg-gradient-to-br from-accent to-accent-2 text-ink-950' : 'bg-white/[0.06] text-accent'}`}>
          <Icon className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">{quest.title}</div>
          <div className="truncate text-sm font-semibold text-white">{quest.description}</div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={quest.target} aria-valuenow={value} aria-label={quest.description}>
              <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="font-mono text-[11px] text-slate-400 tabular-nums">
              {value.toLocaleString()}/{quest.target.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="flex items-center gap-1 font-mono text-sm font-bold text-yellow-300">
          <Coins className="size-4" /> {quest.reward}
        </span>
        {claimed ? (
          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-300">
            <Check className="size-4" /> Claimed
          </span>
        ) : complete ? (
          <Button size="sm" variant="primary" onClick={onClaim} className="animate-glow">
            Claim reward
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={onGo}>
            Go <ChevronRight className="size-4" />
          </Button>
        )}
      </div>
    </article>
  )
}
