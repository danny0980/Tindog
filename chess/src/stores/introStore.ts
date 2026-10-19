import { createStore } from '../utils/store'
import { settingsStore } from './settingsStore'

/** The two films: the startup film, and the earlier study-to-realm intro kept as a replay. */
export type IntroFilm = 'last-grain' | 'visual-evolution'

/** Which intro is on screen, if any. "The Last Grain" opens by itself until it has been seen once. */
export const introStore = createStore<IntroFilm | null>(settingsStore.get().introSeen ? null : 'last-grain')

export const openIntro = (film: IntroFilm = 'last-grain'): void => introStore.set(film)
export const closeIntroOverlay = (): void => introStore.set(null)
