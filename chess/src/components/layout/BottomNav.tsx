import type { AppView } from '../../types/ui'
import { NAV_ITEMS } from './navItems'

interface BottomNavProps {
  view: AppView
  onNavigate: (view: AppView) => void
  badges?: Partial<Record<AppView, number>>
}

/** Thumb-reachable tab bar for phones, padded for the home indicator. */
export function BottomNav({ view, onNavigate, badges }: BottomNavProps) {
  return (
    <nav
      className="glass-strong fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/10 pb-[max(0.25rem,env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] short:top-0 short:right-auto short:w-[calc(5rem+env(safe-area-inset-left))] short:grid-cols-1 short:content-center short:gap-1 short:border-t-0 short:border-r short:pr-0 short:pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Main"
    >
      {NAV_ITEMS.filter((item) => item.mobile).map(({ id, label, icon: Icon }) => {
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
              {(badges?.[id] ?? 0) > 0 && (
                <span className="absolute -top-1 -right-2 flex min-w-4 items-center justify-center rounded-full bg-accent-2 px-1 text-[9px] font-black text-ink-950 ring-2 ring-ink-900">
                  {badges?.[id]}
                </span>
              )}
            </span>
            {label}
          </button>
        )
      })}
    </nav>
  )
}
