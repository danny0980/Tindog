import { Lock } from 'lucide-react'
import type { PortraitSpec } from '../../types/persona'
import { PORTRAIT_ICONS, PORTRAIT_SIZES } from './portraitIcons'

export interface PortraitEmblemProps {
  spec: PortraitSpec
  label: string
  size?: keyof typeof PORTRAIT_SIZES
  locked?: boolean
  defeated?: boolean
  className?: string
  /** Ring colour utility (e.g. a mood ring). */
  ring?: string
}

/**
 * Stylised character emblem — a gradient, a symbolic icon and a monogram.
 * Deliberately iconographic (no likenesses), so it needs no image assets.
 */
export function PortraitEmblem({ spec, label, size = 'md', locked = false, defeated = false, className = '', ring = 'ring-white/20' }: PortraitEmblemProps) {
  const s = PORTRAIT_SIZES[size]
  const Icon = locked ? Lock : PORTRAIT_ICONS[spec.icon]
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden ring-2 transition-all duration-500 ${ring} ${s.box} ${locked ? 'grayscale' : ''} ${className}`}
      style={{ background: `linear-gradient(145deg, ${spec.from}, ${spec.to})` }}
      aria-label={locked ? `${label} (locked)` : label}
      role="img"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.45),transparent_55%)]" aria-hidden="true" />
      <Icon className={`relative text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] ${s.icon} ${locked ? 'opacity-70' : ''}`} strokeWidth={1.75} />
      <span className={`absolute right-1 bottom-0.5 font-display font-extrabold text-white/80 ${s.mono}`} aria-hidden="true">
        {spec.monogram}
      </span>
      {defeated && <span className="absolute inset-0 rounded-[inherit] ring-2 ring-inset ring-amber-300/90" aria-hidden="true" />}
    </div>
  )
}
