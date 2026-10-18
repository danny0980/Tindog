import { Crown, Eye, Handshake, RotateCcw } from 'lucide-react'
import type { Color, GameMode, GameResult } from '../types/chess'
import { describeResult } from '../utils/chess'
import { Modal } from './Modal'

interface GameOverModalProps {
  open: boolean
  result: GameResult | null
  mode: GameMode
  humanColor: Color
  moveCount: number
  onNewGame: () => void
  onReview: () => void
}

export function GameOverModal({ open, result, mode, humanColor, moveCount, onNewGame, onReview }: GameOverModalProps) {
  if (!result) return null
  const { title, detail } = describeResult(result)
  const isDraw = result.kind === 'draw'
  const humanWon = mode === 'ai' && !isDraw && result.winner === humanColor
  const humanLost = mode === 'ai' && !isDraw && result.winner !== humanColor

  const headline = humanWon ? 'Victory!' : humanLost ? 'Defeat' : title
  const Icon = isDraw ? Handshake : Crown
  const accent = humanLost
    ? 'from-slate-500 to-slate-700'
    : isDraw
      ? 'from-sky-400 to-indigo-500'
      : 'from-amber-300 to-emerald-400'

  return (
    <Modal
      open={open}
      title="Game over"
      onClose={onReview}
      size="sm"
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onReview}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
          >
            <Eye className="size-4" /> Review
          </button>
          <button
            type="button"
            onClick={onNewGame}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 px-4 py-3 text-sm font-bold text-ink-950 transition hover:brightness-110 active:scale-[0.98]"
          >
            <RotateCcw className="size-4" /> New game
          </button>
        </div>
      }
    >
      <div className="flex flex-col items-center py-4 text-center">
        <div
          className={`mb-4 flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br ${accent} text-ink-950 shadow-[0_20px_50px_-15px_rgba(16,185,129,0.6)]`}
        >
          <Icon className="size-10" />
        </div>
        <div className="text-3xl font-extrabold tracking-tight text-white">{headline}</div>
        <div className="mt-1 text-sm text-slate-300">
          {headline !== title ? `${title} ${detail}` : detail}
        </div>
        <div className="mt-3 text-xs text-slate-500">{Math.ceil(moveCount / 2)} {Math.ceil(moveCount / 2) === 1 ? 'move' : 'moves'} played</div>
      </div>
    </Modal>
  )
}
