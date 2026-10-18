import { Cpu, LoaderCircle, User } from 'lucide-react'
import type { PlayerInfo } from '../hooks/useGameController'
import type { PieceSymbol } from '../types/chess'
import { opposite } from '../utils/chess'
import { CapturedPieces } from './CapturedPieces'
import { ChessClock } from './ChessClock'

interface PlayerBarProps {
  player: PlayerInfo
  isTurn: boolean
  thinking: boolean
  captured: readonly PieceSymbol[]
  advantage: number
  clock: { enabled: boolean; timeMs: number; initialMs: number }
}

export function PlayerBar({ player, isTurn, thinking, captured, advantage, clock }: PlayerBarProps) {
  const Icon = player.isEngine ? Cpu : User
  return (
    <div
      className={`glass flex items-center gap-3 rounded-xl px-3 py-2 transition-colors duration-300 ${
        isTurn ? 'border-emerald-400/30 bg-emerald-400/[0.06]' : ''
      }`}
    >
      <div
        className={`relative flex size-10 shrink-0 items-center justify-center rounded-lg ring-1 ${
          player.color === 'w' ? 'bg-slate-100 text-slate-800 ring-white/40' : 'bg-slate-800 text-slate-100 ring-white/10'
        }`}
      >
        <Icon className="size-5" aria-hidden="true" />
        {isTurn && (
          <span className="absolute -right-1 -top-1 size-3 rounded-full bg-emerald-400 ring-2 ring-ink-900" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-slate-100">{player.name}</span>
          <span className="truncate text-xs text-slate-400">{player.subtitle}</span>
          {thinking && (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-300">
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
              thinking
            </span>
          )}
        </div>
        <CapturedPieces pieces={captured} pieceColor={opposite(player.color)} advantage={advantage} />
      </div>
      {clock.enabled && <ChessClock timeMs={clock.timeMs} active={isTurn} initialMs={clock.initialMs} />}
    </div>
  )
}
