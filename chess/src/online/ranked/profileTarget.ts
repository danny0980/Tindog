// Which player's public profile is open (any player name in the online
// screens can open it; one window shows it, mounted on the Online screen).
import { createStore } from '../../utils/store'

export const profileTarget = createStore<string | null>(null)
export const openProfile = (id: string): void => profileTarget.set(id)
export const closeProfile = (): void => profileTarget.set(null)
