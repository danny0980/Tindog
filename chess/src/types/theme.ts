import type { CSSProperties } from 'react'

export type BoardThemeId = 'classic-wood' | 'minimal' | 'oled-black' | 'obsidian-marble' | 'cyberpunk-neon' | 'royal-gold'

export type PieceSetId = 'standard' | 'obsidian' | 'neon' | 'gilded'

export type SoundMaterial = 'wood' | 'marble' | 'metal' | 'synth' | 'soft'

export interface SquareHighlights {
  lastMove: CSSProperties
  selected: CSSProperties
  target: CSSProperties
  captureTarget: CSSProperties
  check: CSSProperties
  hover: CSSProperties
  hint: CSSProperties
}

export interface BoardTheme {
  id: BoardThemeId
  name: string
  description: string
  price: number
  material: SoundMaterial
  lightSquare: CSSProperties
  darkSquare: CSSProperties
  notationLight: string
  notationDark: string
  boardFrame: CSSProperties
  highlights: SquareHighlights
  /** App accent colours (hex). */
  accent: string
  accent2: string
  /** Full-page background. */
  background: string
  /** Browser/OS chrome colour (status bar, Android task switcher). */
  chromeColor: string
  /** Particle colours for celebrations. */
  particles: string[]
  /** Piece set equipped automatically if owned and the user hasn't chosen one. */
  suggestedPieceSet: PieceSetId
}

export interface PieceStyle {
  fill: string
  filter: string
}

export interface PieceSet {
  id: PieceSetId
  name: string
  description: string
  price: number
  white: PieceStyle
  black: PieceStyle
}
