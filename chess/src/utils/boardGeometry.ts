// Board-space helpers shared by the kill-cam, spell particles and other overlays.
import type { Color, Square } from '../types/chess'

/** Percent position (0–100) of a square's centre on a 2D board seen from `orientation`. */
export function squareCenter(square: Square, orientation: Color): { x: number; y: number } {
  const file = 'abcdefgh'.indexOf(square[0] ?? 'a')
  const rank = Number(square[1]) - 1
  const col = orientation === 'w' ? file : 7 - file
  const row = orientation === 'w' ? 7 - rank : rank
  return { x: (col + 0.5) * 12.5, y: (row + 0.5) * 12.5 }
}

/** File (0–7) and rank (0–7) indices of a square. */
export const squareIndex = (square: Square): { file: number; rank: number } => ({
  file: 'abcdefgh'.indexOf(square[0] ?? 'a'),
  rank: Number(square[1]) - 1,
})
