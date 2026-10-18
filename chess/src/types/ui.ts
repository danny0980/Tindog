export type AppView = 'play' | 'legends' | 'rush' | 'puzzles' | 'quests' | 'profile' | 'shop'

export type ToastKind = 'achievement' | 'opening' | 'coins' | 'quest' | 'info' | 'success' | 'warning'

export interface Toast {
  id: number
  kind: ToastKind
  title: string
  message?: string
  /** Display duration in ms. */
  duration: number
}
