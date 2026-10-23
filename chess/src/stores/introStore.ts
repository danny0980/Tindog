import { createStore } from '../utils/store'
import { settingsStore } from './settingsStore'

/** The films: the opening ("One Game. Every Era.", plays on start), "The Last Grain", and the study-to-realm intro kept as a replay. */
export type IntroFilm = 'opening' | 'last-grain' | 'visual-evolution'

/** Which intro is on screen, if any. The opening film plays by itself until it has been seen once. */
// Someone opening an invite link goes straight to their friend's game (the film can wait).
const invited = typeof window !== 'undefined' && /[?&]room=/.test(window.location.search)
export const introStore = createStore<IntroFilm | null>(settingsStore.get().openingSeen || invited ? null : 'opening')

export const openIntro = (film: IntroFilm = 'last-grain'): void => introStore.set(film)
export const closeIntroOverlay = (): void => introStore.set(null)
