import type { BoardTheme, PieceSet } from '../../types/theme'
import { PieceIcon } from '../ui/PieceIcon'

interface ThemeSwatchProps {
  theme: BoardTheme
  pieceSet?: PieceSet
  size?: 'sm' | 'lg'
}

/** Miniature 4×4 board preview of a theme, optionally with sample pieces. */
export function ThemeSwatch({ theme, pieceSet, size = 'sm' }: ThemeSwatchProps) {
  const cells = Array.from({ length: 16 }, (_, i) => ((Math.floor(i / 4) + (i % 4)) % 2 === 0 ? 'light' : 'dark'))
  const samples: Record<number, { color: 'w' | 'b'; type: 'k' | 'q' | 'n' | 'p' }> = { 5: { color: 'b', type: 'q' }, 6: { color: 'w', type: 'n' }, 9: { color: 'w', type: 'k' }, 10: { color: 'b', type: 'p' } }
  return (
    <div className={`grid aspect-square w-full grid-cols-4 overflow-hidden rounded-lg ${size === 'lg' ? 'rounded-xl' : ''}`} style={theme.boardFrame}>
      {cells.map((kind, i) => {
        const sample = pieceSet ? samples[i] : undefined
        return (
          <div key={i} className="relative" style={kind === 'light' ? theme.lightSquare : theme.darkSquare}>
            {sample && pieceSet && <PieceIcon color={sample.color} type={sample.type} set={pieceSet} own className="absolute inset-[6%]" />}
          </div>
        )
      })}
    </div>
  )
}
