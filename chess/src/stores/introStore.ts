import { createStore } from '../utils/store'
import { settingsStore } from './settingsStore'

/** The films: the clay opening (plays on start), "The Last Grain", and the study-to-realm intro kept as a replay. */
export type IntroFilm = 'clay' | 'last-grain' | 'visual-evolution'

/** Which intro is on screen, if any. The clay opening plays by itself until it has been seen once. */
// Someone opening an invite link goes straight to their friend's game (the film can wait).
const invited = typeof window !== 'undefined' && /[?&]room=/.test(window.location.search)
export const introStore = createStore<IntroFilm | null>(settingsStore.get().clayIntroSeen || invited ? null : 'clay')

export const openIntro = (film: IntroFilm = 'last-grain'): void => introStore.set(film)
export const closeIntroOverlay = (): void => introStore.set(null)
