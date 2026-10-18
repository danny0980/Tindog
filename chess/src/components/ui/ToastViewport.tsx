import { BookOpen, CheckCircle2, Coins, Info, ScrollText, Trophy, TriangleAlert, X } from 'lucide-react'
import { useStore } from '../../hooks/useStore'
import { dismissToast, toastStore } from '../../stores/toastStore'
import type { ToastKind } from '../../types/ui'

const STYLES: Record<ToastKind, { icon: typeof Info; ring: string; iconClass: string }> = {
  achievement: { icon: Trophy, ring: 'ring-amber-300/40', iconClass: 'bg-gradient-to-br from-amber-300 to-orange-500 text-ink-950' },
  opening: { icon: BookOpen, ring: 'ring-accent/40', iconClass: 'bg-accent/20 text-accent' },
  quest: { icon: ScrollText, ring: 'ring-accent-2/40', iconClass: 'bg-accent-2/20 text-accent-2' },
  coins: { icon: Coins, ring: 'ring-yellow-300/40', iconClass: 'bg-yellow-400/20 text-yellow-300' },
  info: { icon: Info, ring: 'ring-white/10', iconClass: 'bg-white/10 text-slate-200' },
  success: { icon: CheckCircle2, ring: 'ring-emerald-400/40', iconClass: 'bg-emerald-400/20 text-emerald-300' },
  warning: { icon: TriangleAlert, ring: 'ring-orange-400/40', iconClass: 'bg-orange-400/20 text-orange-300' },
}

/** Floating notification stack (achievements, openings, rewards). */
export function ToastViewport() {
  const toasts = useStore(toastStore, (t) => t)
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:items-end sm:pt-[calc(4.25rem+env(safe-area-inset-top))] sm:pr-6"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const { icon: Icon, ring, iconClass } = STYLES[toast.kind]
        return (
          <div
            key={toast.id}
            className={`glass-strong pointer-events-auto flex w-full max-w-sm animate-slide-in-right items-center gap-3 rounded-2xl p-3 shadow-2xl ring-1 ${ring}`}
            role="status"
          >
            <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
              <Icon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              {toast.kind === 'achievement' && (
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">Achievement unlocked</div>
              )}
              {toast.kind === 'quest' && (
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent-2">Daily quest complete</div>
              )}
              {toast.kind === 'opening' && (
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Opening · {toast.message}</div>
              )}
              <div className="truncate text-sm font-bold text-white">{toast.title}</div>
              {toast.message && toast.kind !== 'opening' && <div className="line-clamp-2 text-xs text-slate-400">{toast.message}</div>}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="rounded-lg p-1 text-slate-500 transition hover:bg-white/10 hover:text-white"
              aria-label="Dismiss"
            >
              <X className="size-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
