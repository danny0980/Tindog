import type { AppView } from '../../types/ui'
import { NAV_ITEMS } from './navItems'

interface BottomNavProps {
  view: AppView
  onNavigate: (view: AppView) => void
  badges?: Partial<Record<AppView, boolean>>
}

/** Thumb-reachable tab bar for phones, padded for the home indicator. */
export function BottomNav({ view, onNavigate, badges }: BottomNavProps) {
  return (
    <nav
      className="glass-strong fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-white/10 pb-[max(0.25rem,env(safe-area-inset-bottom))] lg:hidden"
      aria-label="Main"
    >
      {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
        const active = view === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => onNavigate(id)}
            aria-current={active ? 'page' : undefined}
            className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition ${active ? 'text-accent' : 'text-slate-400'}`}
          >
            {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]" />}
            <span className="relative">
              <Icon className={`size-6 transition-transform ${active ? 'scale-110' : ''}`} />
              {badges?.[id] && <span className="absolute -top-0.5 -right-1 size-2 rounded-full bg-accent-2 ring-2 ring-ink-900" />}
            </span>
            {label}
          </button>
        )
      })}
    </nav>
  )
}
