import { createStore } from '../utils/store'
import { settingsStore } from './settingsStore'

/** Whether the cinematic intro is on screen. It opens by itself until it has been seen once. */
export const introStore = createStore<boolean>(!settingsStore.get().introSeen)

export const openIntro = (): void => introStore.set(true)
export const closeIntroOverlay = (): void => introStore.set(false)
