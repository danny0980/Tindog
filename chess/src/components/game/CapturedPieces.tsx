import type { Color, PieceSymbol } from '../../types/chess'
import type { PieceSet } from '../../types/theme'
import { PieceIcon } from '../ui/PieceIcon'

interface CapturedPiecesProps {
  pieces: readonly PieceSymbol[]
  pieceColor: Color
  advantage: number
  pieceSet: PieceSet
}

export function CapturedPieces({ pieces, pieceColor, advantage, pieceSet }: CapturedPiecesProps) {
  if (pieces.length === 0 && advantage <= 0) return <div className="h-5 text-xs text-slate-500">No captures</div>

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
                set={pieceSet}
                className={`block size-5 ${pieceColor === 'b' ? 'drop-shadow-[0_0_1.5px_rgba(255,255,255,0.75)]' : ''} ${i > 0 ? '-ml-3' : ''}`}
              />
            ))}
          </div>
        ))}
      </div>
      {advantage > 0 && <span className="shrink-0 text-xs font-semibold text-slate-300">+{advantage}</span>}
    </div>
  )
}
