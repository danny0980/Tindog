import type { Alignment } from '../../hooks/useGameController'

const LIGHTING: Record<Alignment, string> = {
  light: 'radial-gradient(ellipse at 50% -10%, rgba(253,230,138,0.22), transparent 55%), radial-gradient(ellipse at 50% 120%, rgba(125,211,252,0.12), transparent 60%)',
  dark: 'radial-gradient(ellipse at 50% -10%, rgba(220,38,38,0.22), transparent 55%), radial-gradient(ellipse at 50% 120%, rgba(124,58,237,0.18), transparent 60%)',
}

/**
 * Arena lighting from the opponent's alignment: warm dawn light against
 * "light" (cold, principled) foes, a crimson-violet glow against "dark" ones.
 * It flares while you are in danger (severe check).
 */
export function MoodBackdrop({ alignment, danger }: { alignment: Alignment | null; danger: boolean }) {
  if (!alignment) return null
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 transition-opacity duration-700" data-alignment={alignment} aria-hidden>
      <div className="absolute inset-0" style={{ background: LIGHTING[alignment] }} />
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${danger ? 'opacity-100' : 'opacity-0'}`}
        style={{ background: 'radial-gradient(ellipse at center, transparent 45%, rgba(239,68,68,0.28) 100%)' }}
      />
    </div>
  )
}
