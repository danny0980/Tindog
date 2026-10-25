export type AppView = 'play' | 'journey' | 'legends' | 'online' | 'rush' | 'puzzles' | 'quests' | 'profile' | 'shop'

/** The Journey screen's tabs. */
export type JourneyTab = 'progress' | 'story' | 'characters' | 'arena' | 'learn' | 'social' | 'rewards'

export type ToastKind = 'achievement' | 'opening' | 'coins' | 'quest' | 'info' | 'success' | 'warning'

export interface Toast {
  id: number
  kind: ToastKind
  title: string
  message?: string
  /** Display duration in ms. */
  duration: number
}
