import { defaultPieces } from 'react-chessboard'
import { viewToBoard } from '../../online/ranked/modeRules'
import { ROYALE_COLOR, samePos } from './royaleTheme'
import { type Pos, type RMove, type RPiece, type RoyaleGame, SIZE, onBoard } from '../../royale/royale'

function Piece({ piece }: { piece: RPiece }) {
  const render = defaultPieces[`w${piece.type.toUpperCase()}`]
  return <div className={`size-full ${piece.owner === 'dead' ? 'opacity-60' : ''}`}>{render?.({ fill: ROYALE_COLOR[piece.owner], svgStyle: { width: '100%', height: '100%' } })}</div>
}

/**
 * The cross-shaped Battle Royale board. `seat` turns it so that army sits at
 * the bottom (0 = red, as offline). Cells report board coordinates.
 */
export function RoyaleBoard({ game, seat = 0, selected, targets, onCell }: { game: RoyaleGame; seat?: number; selected: Pos | null; targets: readonly RMove[]; onCell: (pos: Pos) => void }) {
  return (
    <div className="grid aspect-square w-full overflow-hidden rounded-xl" style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }} role="grid" aria-label="Battle Royale board" data-royale-board>
      {Array.from({ length: SIZE * SIZE }, (_, i) => {
        const [r, c] = viewToBoard(Math.floor(i / SIZE), i % SIZE, seat)
        if (!onBoard(r, c)) return <div key={i} aria-hidden="true" />
        const pos: Pos = [r, c]
        const piece = game.at(pos)
        const isTarget = targets.some((m) => samePos(m.to, pos))
        const isSel = selected !== null && samePos(selected, pos)
        const isLast = game.last !== null && (samePos(game.last.from, pos) || samePos(game.last.to, pos))
        return (
          <button
            key={i}
            type="button"
            role="gridcell"
            onClick={() => onCell(pos)}
            data-cell={`${r}-${c}`}
            data-piece={piece ? `${piece.owner}-${piece.type}` : undefined}
            aria-label={piece ? `${piece.owner} ${piece.type} at row ${r + 1}, column ${c + 1}` : `row ${r + 1}, column ${c + 1}`}
            className="relative p-[6%]"
            style={{ background: isSel ? 'rgba(250,204,21,0.55)' : isLast ? 'rgba(250,204,21,0.28)' : (r + c) % 2 === 0 ? '#e7d3b1' : '#a77b55' }}
          >
            {piece && <Piece piece={piece} />}
            {isTarget && <span className={`pointer-events-none absolute inset-0 m-auto rounded-full ${piece ? 'size-[90%] ring-4 ring-red-500/70' : 'size-[30%] bg-black/30'}`} />}
          </button>
        )
      })}
    </div>
  )
}
