export type AppView = 'play' | 'puzzles' | 'profile' | 'shop'

export type ToastKind = 'achievement' | 'opening' | 'coins' | 'info' | 'success' | 'warning'

export interface Toast {
  id: number
  kind: ToastKind
  title: string
  message?: string
  /** Display duration in ms. */
  duration: number
}
