import { defaultPieces, type PieceRenderObject } from 'react-chessboard'
import { type ArtPieceSet, PIECE_CODES, type PieceCode } from '../assets/artManifest'
import { ArtPiece } from '../components/board/ArtPiece'
import type { PieceSet } from '../types/theme'

const cache = new Map<string, PieceRenderObject>()
const isPieceCode = (code: string): code is PieceCode => (PIECE_CODES as readonly string[]).includes(code)

/**
 * Builds a react-chessboard piece set: art-pack images when an art set is
 * given (each piece falls back to the vector piece if its file fails), else
 * the default Staunton SVGs re-coloured with the set's glow/shadow filters.
 * Filters are dropped in battery saver mode — they are the most expensive
 * part of rendering the board.
 */
export function buildPieces(set: PieceSet, lowPower: boolean, art: { id: string; set: ArtPieceSet } | null = null): PieceRenderObject {
  const key = `${set.id}:${lowPower ? 'lp' : 'hq'}:${art?.id ?? '-'}`
  const cached = cache.get(key)
  if (cached) return cached
  const pieces: PieceRenderObject = {}
  for (const [code, render] of Object.entries(defaultPieces)) {
    const style = code.startsWith('w') ? set.white : set.black
    const vector: PieceRenderObject[string] = (props) =>
      render({
        ...props,
        fill: style.fill,
        svgStyle: { ...props?.svgStyle, filter: lowPower ? 'none' : style.filter },
      })
    pieces[code] = art && isPieceCode(code) ? (props) => <ArtPiece code={code} art={art.set} fallback={vector(props)} /> : vector
  }
  cache.set(key, pieces)
  return pieces
}
