// Smooth screen changes with the View Transitions API (Chromium, Safari 18+):
// a direction-aware slide between tabs, a zoom for drilling into a screen.
// Falls back to an instant update where unsupported, in battery-saver mode
// or with reduced motion.
import { flushSync } from 'react-dom'
import type { AppView } from '../types/ui'

export type TransitionDirection = 'forward' | 'back' | 'zoom'

/** Order of the main screens, left to right (drives slide direction). */
export const VIEW_ORDER: readonly AppView[] = ['play', 'journey', 'legends', 'rush', 'puzzles', 'quests', 'profile', 'shop']

export function navDirection(from: AppView, to: AppView): TransitionDirection {
  if (from === to) return 'zoom'
  return VIEW_ORDER.indexOf(to) > VIEW_ORDER.indexOf(from) ? 'forward' : 'back'
}

type TransitionDocument = Document & { startViewTransition?: (update: () => void) => unknown }

export function supportsViewTransitions(): boolean {
  return typeof document !== 'undefined' && typeof (document as TransitionDocument).startViewTransition === 'function'
}

function motionAllowed(): boolean {
  if (typeof window === 'undefined') return false
  if (document.documentElement.classList.contains('battery-saver')) return false
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Runs a React state update inside a view transition (synchronously flushed so the snapshot is right). */
export function runViewTransition(update: () => void, direction: TransitionDirection = 'zoom'): void {
  const doc = document as TransitionDocument
  if (!supportsViewTransitions() || !motionAllowed() || !doc.startViewTransition) {
    update()
    return
  }
  document.documentElement.dataset.vt = direction
  doc.startViewTransition(() => flushSync(update))
}
