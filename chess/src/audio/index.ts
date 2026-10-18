import type { Move } from '../types/chess'
import type { SoundMaterialSetting } from '../types/settings'
import type { BoardTheme, SoundMaterial } from '../types/theme'
import { audioEngine } from './AudioEngine'
import { ambientMusic } from './ambientMusic'
import * as fanfares from './fanfares'
import { haptic } from './haptics'
import { playPieceSound } from './pieceSounds'

export { ambientMusic, audioEngine, haptic }

/** The material actually used for piece sounds (user override or theme default). */
export const resolveMaterial = (setting: SoundMaterialSetting, theme: BoardTheme): SoundMaterial =>
  setting === 'theme' ? theme.material : setting

/** High-level sound cues used by the app. */
export const sfx = {
  move(material: SoundMaterial, move: Move, givesCheck: boolean): void {
    const kind = move.isPromotion()
      ? 'promote'
      : move.isKingsideCastle() || move.isQueensideCastle()
        ? 'castle'
        : move.isCapture()
          ? 'capture'
          : 'move'
    playPieceSound(material, kind)
    if (givesCheck) fanfares.playCheck()
    haptic(givesCheck ? 'check' : kind === 'capture' ? 'capture' : 'move')
  },
  victory(): void {
    fanfares.playVictory()
    haptic('success')
  },
  defeat(): void {
    fanfares.playDefeat()
    haptic('error')
  },
  draw(): void {
    fanfares.playDraw()
    haptic('warning')
  },
  timeout(): void {
    fanfares.playTimeout()
    haptic('warning')
  },
  achievement: fanfares.playAchievement,
  coins: fanfares.playCoins,
  puzzleSolved(): void {
    fanfares.playPuzzleSolved()
    haptic('success')
  },
  error(): void {
    fanfares.playError()
    haptic('error')
  },
  notify: fanfares.playNotify,
  tap: fanfares.playTap,
  lowTime: fanfares.playLowTime,
  swipe(): void {
    fanfares.playSwipe()
    haptic('tap')
  },
  score: fanfares.playScore,
  pickup(): void {
    haptic('pickup')
  },
  /** Preview a material in the settings panel. */
  preview(material: SoundMaterial): void {
    playPieceSound(material, 'move')
    window.setTimeout(() => playPieceSound(material, 'capture'), 260)
  },
}
