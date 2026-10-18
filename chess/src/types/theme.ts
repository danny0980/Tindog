import type { CSSProperties } from 'react'
import type { GrandRealmId } from './campaign'
import type { LegendId, MusicTexture } from './legend'

export type BoardThemeId =
  | 'classic-wood'
  | 'minimal'
  | 'oled-black'
  | 'obsidian-marble'
  | 'cyberpunk-neon'
  | 'royal-gold'
  | 'papyrus-gold'
  | 'blueprint'
  | 'imperial-velvet'
  | 'chalkboard'
  | 'rune-oak'
  | 'bamboo-gold'
  | 'elven-crystal'
  | 'obsidian-lava'
  | 'storm-sea'
  | 'nebula'

export type PieceSetId =
  | 'standard'
  | 'obsidian'
  | 'neon'
  | 'gilded'
  | 'lapis'
  | 'ink'
  | 'imperial'
  | 'chalk'
  | 'runestone'
  | 'lacquer'
  | 'moonsilver'
  | 'hellfire'
  | 'brass'
  | 'stardust'

export type SoundMaterial = 'wood' | 'marble' | 'metal' | 'synth' | 'soft' | 'crystal' | 'ember'

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
  /** Earned (not bought) by defeating this legend for the first time. */
  legendUnlock?: LegendId
  /** Earned by clearing this Grand Campaign realm. */
  campaignUnlock?: GrandRealmId
  /** Soundtrack flavour while this theme is shown. */
  musicTexture?: MusicTexture
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
  legendUnlock?: LegendId
  campaignUnlock?: GrandRealmId
}
