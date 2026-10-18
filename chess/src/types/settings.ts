import type { GameSettings } from './chess'
import type { BoardThemeId, PieceSetId } from './theme'

export interface AppSettings {
  version: 1
  boardTheme: BoardThemeId
  pieceSet: PieceSetId
  masterVolume: number
  sfxEnabled: boolean
  musicEnabled: boolean
  hapticsEnabled: boolean
  batterySaver: boolean
  autoBatterySaver: boolean
  showEvalBar: boolean
  showLegalMoves: boolean
  showCoordinates: boolean
  game: GameSettings
}
