import { Coins, Crown, Eye, Handshake, Microscope, RotateCcw, Share2, Skull, TrendingDown, TrendingUp, Trophy } from 'lucide-react'
import type { GameEndSummary } from '../../hooks/useGameController'
import { describeResult } from '../../utils/chess'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

interface GameOverModalProps {
  open: boolean
  summary: GameEndSummary | null
  isAiMode: boolean
  moveCount: number
  onNewGame: () => void
  onReview: () => void
  onAnalyze: () => void
  onShare: () => void
}

export function GameOverModal({ open, summary, isAiMode, moveCount, onNewGame, onReview, onAnalyze, onShare }: GameOverModalProps) {
  if (!summary) return null
  const { title, detail } = describeResult(summary.result)
  const isDraw = summary.result.kind === 'draw'
  const won = summary.outcome === 'win'
  const lost = summary.outcome === 'loss'
  const headline = won ? 'Victory!' : lost ? 'Defeat' : title
  const Icon = isDraw ? Handshake : lost ? Skull : Crown
  const accent = lost ? 'from-slate-500 to-slate-700' : isDraw ? 'from-sky-400 to-indigo-500' : 'from-accent to-accent-2'
  const moves = Math.ceil(moveCount / 2)

  return (
    <Modal
      open={open}
      title="Game over"
      onClose={onReview}
      size="sm"
      footer={
        <div className="space-y-2">
          <Button variant="primary" className="w-full" onClick={onAnalyze} icon={<Microscope className="size-4" />}>
            Analyze game
          </Button>
          <div className="grid grid-cols-3 gap-2">
            <Button size="sm" onClick={onReview} icon={<Eye className="size-4" />}>
              Board
            </Button>
            <Button size="sm" onClick={onShare} icon={<Share2 className="size-4" />}>
              Share
            </Button>
            <Button size="sm" onClick={onNewGame} icon={<RotateCcw className="size-4" />}>
              New
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col items-center py-3 text-center">
        <div className={`idle-pause mb-4 flex size-20 animate-float items-center justify-center rounded-3xl bg-gradient-to-br ${accent} text-ink-950 shadow-[0_20px_50px_-15px_var(--accent)]`}>
          <Icon className="size-10" />
        </div>
        <div className={`font-display text-3xl font-extrabold tracking-wide ${won ? 'holo-text animate-shimmer' : 'text-white'}`}>{headline}</div>
        <div className="mt-1 text-sm text-slate-300">{headline !== title ? `${title} ${detail}` : detail}</div>
        <div className="mt-1 text-xs text-slate-500">
          {moves} {moves === 1 ? 'move' : 'moves'} played{isAiMode && !summary.rated ? ' · casual' : ''}
        </div>

        {isAiMode && (
          <div className="mt-5 grid w-full grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/5 p-3">
              <div className="flex items-center justify-center gap-1 text-[11px] uppercase tracking-wider text-slate-400">
                {summary.eloDelta !== null && summary.eloDelta < 0 ? <TrendingDown className="size-3.5" /> : <TrendingUp className="size-3.5" />} Rating
              </div>
              <div className="mt-1 font-mono text-xl font-bold text-white">{summary.eloAfter ?? '—'}</div>
              {summary.eloDelta !== null && (
                <div className={`font-mono text-xs font-bold ${summary.eloDelta >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                  {summary.eloDelta >= 0 ? '+' : ''}
                  {summary.eloDelta}
                </div>
              )}
            </div>
            <div className="rounded-xl bg-white/5 p-3">
              <div className="flex items-center justify-center gap-1 text-[11px] uppercase tracking-wider text-slate-400">
                <Coins className="size-3.5" /> Coins
              </div>
              <div className="mt-1 font-mono text-xl font-bold text-yellow-300">+{summary.coins}</div>
            </div>
          </div>
        )}

        {summary.unlocked.length > 0 && (
          <div className="mt-3 w-full space-y-1.5">
            {summary.unlocked.map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-left">
                <Trophy className="size-4 shrink-0 text-amber-300" />
                <span className="flex-1 truncate text-sm font-semibold text-amber-100">{a.title}</span>
                <span className="font-mono text-xs text-yellow-300">+{a.reward}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
