import type { Color, PieceSymbol } from '../types/chess'
import { PieceIcon } from './PieceIcon'

interface CapturedPiecesProps {
  /** Pieces this player has captured (they belong to the opponent). */
  pieces: readonly PieceSymbol[]
  /** Colour of the captured pieces. */
  pieceColor: Color
  /** Material advantage of this player, shown when positive. */
  advantage: number
}

export function CapturedPieces({ pieces, pieceColor, advantage }: CapturedPiecesProps) {
  if (pieces.length === 0 && advantage <= 0) {
    return <div className="h-5 text-xs text-slate-500">No captures</div>
  }

  // Group identical pieces so they overlap like a hand of cards.
  const groups = pieces.reduce<Array<{ type: PieceSymbol; count: number }>>((acc, type) => {
    const last = acc[acc.length - 1]
    if (last && last.type === type) last.count += 1
    else acc.push({ type, count: 1 })
    return acc
  }, [])

  return (
    <div className="flex h-5 min-w-0 items-center gap-1.5" aria-label={`Captured: ${pieces.join(', ') || 'none'}`}>
      <div className="flex min-w-0 items-center gap-1 overflow-hidden">
        {groups.map(({ type, count }) => (
          <div key={type} className="flex shrink-0">
            {Array.from({ length: count }, (_, i) => (
              <PieceIcon
                key={i}
                color={pieceColor}
                type={type}
                className={`block size-5 ${
                  pieceColor === 'b'
                    ? 'drop-shadow-[0_0_1.5px_rgba(255,255,255,0.75)]'
                    : 'drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]'
                } ${i > 0 ? '-ml-3' : ''}`}
              />
            ))}
          </div>
        ))}
      </div>
      {advantage > 0 && <span className="shrink-0 text-xs font-semibold text-slate-300">+{advantage}</span>}
    </div>
  )
}
