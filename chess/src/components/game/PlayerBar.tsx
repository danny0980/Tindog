import { LoaderCircle } from 'lucide-react'
import type { PlayerInfo } from '../../hooks/useGameController'
import type { PieceSymbol } from '../../types/chess'
import type { PieceSet } from '../../types/theme'
import { opposite } from '../../utils/chess'
import { CapturedPieces } from './CapturedPieces'
import { ChessClock } from './ChessClock'
import { PlayerAvatar } from './PlayerAvatar'

interface PlayerBarProps {
  player: PlayerInfo
  isTurn: boolean
  thinking: boolean
  captured: readonly PieceSymbol[]
  advantage: number
  pieceSet: PieceSet
  clock: { enabled: boolean; timeMs: number; initialMs: number }
  /** Hide the clock (it is shown elsewhere, e.g. in the thumb dock). */
  hideClock?: boolean
}

export function PlayerBar({ player, isTurn, thinking, captured, advantage, pieceSet, clock, hideClock = false }: PlayerBarProps) {
  return (
    <div
      className={`glass flex items-center gap-3 rounded-xl px-3 py-2 transition-colors duration-300 ${
        isTurn ? 'border-accent/35 bg-accent/[0.07]' : ''
      }`}
    >
      <PlayerAvatar color={player.color} isEngine={player.isEngine} mood={player.mood} isTurn={isTurn} portrait={player.character ? { spec: player.character.portrait, label: player.character.name } : null} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-slate-100">{player.name}</span>
          <span className="truncate text-xs text-slate-400">{player.subtitle}</span>
          {thinking && (
            <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-accent">
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
              <span className="hidden sm:inline">thinking</span>
            </span>
          )}
        </div>
        <CapturedPieces pieces={captured} pieceColor={opposite(player.color)} advantage={advantage} pieceSet={pieceSet} />
      </div>
      {clock.enabled && !hideClock && <ChessClock timeMs={clock.timeMs} active={isTurn} initialMs={clock.initialMs} />}
    </div>
  )
}
