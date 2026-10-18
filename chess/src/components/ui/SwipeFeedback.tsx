import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react'
import type { SwipeDirection } from '../../hooks/useSwipeGesture'

const ICONS = { left: ArrowLeft, right: ArrowRight, up: ArrowUp, down: ArrowDown } as const

/** Brief floating confirmation of a recognised swipe. Re-key to replay. */
export function SwipeFeedback({ direction, label }: { direction: SwipeDirection; label: string }) {
  const Icon = ICONS[direction]
  return (
    <div className="pointer-events-none fixed inset-x-0 top-1/3 z-[45] flex justify-center" aria-live="polite">
      <div className="glass-strong flex animate-swipe-chip items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-white shadow-2xl">
        <Icon className="size-4 text-accent" /> {label}
      </div>
    </div>
  )
}
