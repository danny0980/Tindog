import { defaultPieces, type PieceRenderObject } from 'react-chessboard'
import type { PieceSet } from '../types/theme'

const cache = new Map<string, PieceRenderObject>()

/**
 * Builds a react-chessboard piece set by re-colouring the default Staunton SVGs
 * and applying the set's glow/shadow filters. Filters are dropped in battery
 * saver mode because they are the most expensive part of rendering the board.
 */
export function buildPieces(set: PieceSet, lowPower: boolean): PieceRenderObject {
  const key = `${set.id}:${lowPower ? 'lp' : 'hq'}`
  const cached = cache.get(key)
  if (cached) return cached
  const pieces: PieceRenderObject = {}
  for (const [code, render] of Object.entries(defaultPieces)) {
    const style = code.startsWith('w') ? set.white : set.black
    pieces[code] = (props) =>
      render({
        ...props,
        fill: style.fill,
        svgStyle: { ...props?.svgStyle, filter: lowPower ? 'none' : style.filter },
      })
  }
  cache.set(key, pieces)
  return pieces
}
