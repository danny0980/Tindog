import type { ChallengeClock } from '../campaign/battleOptions'
import type { BattleLaunch } from '../../hooks/useGameController'
import type { LegendsScreen } from '../../types/settings'
import type { AppView } from '../../types/ui'

/** What the Journey screens can start: games on the main board, and other screens. */
export interface JourneyLaunch {
  playClassic: (classicId: string, clock: ChallengeClock, launch?: BattleLaunch) => void
  playGhost: (clock: ChallengeClock, launch?: BattleLaunch) => void
  navigate: (view: AppView) => void
  openLegends: (screen: LegendsScreen) => void
}
