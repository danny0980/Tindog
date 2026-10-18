import { Apple, Atom, Axe, Eye, Flag, Flame, Leaf, Lock, Swords } from 'lucide-react'
import { getLegend } from '../../data/legends'
import type { LegendIcon, LegendId } from '../../types/legend'

const ICONS: Record<LegendIcon, typeof Atom> = { eye: Eye, apple: Apple, flag: Flag, atom: Atom, axe: Axe, swords: Swords, leaf: Leaf, flame: Flame }

const SIZES = {
  sm: { box: 'size-11 rounded-xl', icon: 'size-5', mono: 'text-[10px]' },
  md: { box: 'size-14 rounded-2xl', icon: 'size-7', mono: 'text-xs' },
  lg: { box: 'size-20 rounded-3xl', icon: 'size-9', mono: 'text-sm' },
  xl: { box: 'size-28 rounded-[2rem]', icon: 'size-12', mono: 'text-base' },
} as const

interface LegendPortraitProps {
  legendId: LegendId
  size?: keyof typeof SIZES
  locked?: boolean
  defeated?: boolean
  className?: string
  /** Ring colour utility (e.g. a mood ring). */
  ring?: string
}

/**
 * Stylised legend emblem — an era gradient, a symbolic icon and a monogram.
 * Deliberately iconographic (no likenesses), so it needs no image assets.
 */
export function LegendPortrait({ legendId, size = 'md', locked = false, defeated = false, className = '', ring = 'ring-white/20' }: LegendPortraitProps) {
  const legend = getLegend(legendId)
  const s = SIZES[size]
  const Icon = locked ? Lock : ICONS[legend.portrait.icon]
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden ring-2 transition-all duration-500 ${ring} ${s.box} ${locked ? 'grayscale' : ''} ${className}`}
      style={{ background: `linear-gradient(145deg, ${legend.portrait.from}, ${legend.portrait.to})` }}
      aria-label={legend.name}
      role="img"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.45),transparent_55%)]" aria-hidden="true" />
      <Icon className={`relative text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] ${s.icon} ${locked ? 'opacity-70' : ''}`} strokeWidth={1.75} />
      <span className={`absolute right-1 bottom-0.5 font-display font-extrabold text-white/80 ${s.mono}`} aria-hidden="true">
        {legend.portrait.monogram}
      </span>
      {defeated && <span className="absolute inset-0 rounded-[inherit] ring-2 ring-inset ring-amber-300/90" aria-hidden="true" />}
    </div>
  )
}
