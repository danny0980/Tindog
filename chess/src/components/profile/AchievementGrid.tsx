import { Anchor, Apple, Atom, Axe, Brain, ChessKnight, Clock, Cpu, Crown, Eye, Flag, Flame, Gem, Globe, Handshake, Hourglass, Leaf, Lock, Map, Medal, Orbit, Palette, Puzzle, Repeat, Rocket, ScrollText, Search, Shield, Skull, Sparkles, Star, Swords, Target, Timer, TrendingUp, Trophy, WandSparkles, Zap } from 'lucide-react'
import { ACHIEVEMENTS } from '../../constants/achievements'
import type { AchievementIcon } from '../../types/profile'
import { formatShortDate } from '../../utils/date'

const ACHIEVEMENT_ICONS: Record<AchievementIcon, typeof Trophy> = {
  sword: Swords,
  zap: Zap,
  timer: Timer,
  skull: Skull,
  shield: Shield,
  brain: Brain,
  crown: Crown,
  gem: Gem,
  horse: ChessKnight,
  handshake: Handshake,
  hourglass: Hourglass,
  trending: TrendingUp,
  puzzle: Puzzle,
  flame: Flame,
  trophy: Trophy,
  medal: Medal,
  star: Star,
  target: Target,
  palette: Palette,
  repeat: Repeat,
  search: Search,
  rocket: Rocket,
  atom: Atom,
  apple: Apple,
  eye: Eye,
  flag: Flag,
  clock: Clock,
  axe: Axe,
  swords: Swords,
  leaf: Leaf,
  wand: WandSparkles,
  globe: Globe,
  map: Map,
  anchor: Anchor,
  cpu: Cpu,
  sparkles: Sparkles,
  orbit: Orbit,
  scroll: ScrollText,
}

const TIERS = {
  bronze: 'from-orange-300 to-amber-700',
  silver: 'from-slate-100 to-slate-400',
  gold: 'from-yellow-200 to-amber-500',
  platinum: 'from-cyan-200 via-fuchsia-300 to-violet-500',
} as const

export function AchievementGrid({ unlocked }: { unlocked: Record<string, string> }) {
  const count = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Achievements</h3>
        <span className="font-mono text-xs text-slate-400">
          {count}/{ACHIEVEMENTS.length}
        </span>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-gradient-to-r from-accent to-accent-2" style={{ width: `${(count / ACHIEVEMENTS.length) * 100}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {ACHIEVEMENTS.map((a) => {
          const date = unlocked[a.id]
          const Icon = ACHIEVEMENT_ICONS[a.icon]
          return (
            <div
              key={a.id}
              className={`flex items-start gap-2.5 rounded-xl border p-2.5 transition ${
                date ? 'border-white/10 bg-white/[0.05]' : 'border-white/5 bg-white/[0.015] opacity-60'
              }`}
              title={a.description}
            >
              <div
                className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                  date ? `bg-gradient-to-br ${TIERS[a.tier]} text-ink-950 shadow-lg` : 'bg-white/5 text-slate-500'
                }`}
              >
                {date ? <Icon className="size-5" /> : <Lock className="size-4" />}
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs font-bold text-white">{a.title}</div>
                <div className="line-clamp-2 text-[11px] leading-snug text-slate-400">{a.description}</div>
                <div className="mt-0.5 font-mono text-[10px] text-yellow-300/80">{date ? formatShortDate(date) : `+${a.reward}`}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
