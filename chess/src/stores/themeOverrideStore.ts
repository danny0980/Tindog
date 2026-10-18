import type { BoardThemeId } from '../types/theme'
import { createStore } from '../utils/store'

/**
 * Temporary, non-persisted theme override — used while travelling through an
 * epoch (Legends screen or a legend battle) so the whole app takes on that
 * era's look and soundtrack without touching the player's saved theme.
 */
export const themeOverrideStore = createStore<BoardThemeId | null>(null)

export function setThemeOverride(id: BoardThemeId | null): void {
  themeOverrideStore.set(id)
}
