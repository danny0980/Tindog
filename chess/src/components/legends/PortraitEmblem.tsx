import { Crown, Lock } from 'lucide-react'
import { useState } from 'react'
import { usePortraitArt } from '../../assets/useArt'
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
 * Character portrait. Shows the art-pack portrait for this character when one
 * exists; otherwise — or if the image fails to load — the built-in emblem: a
 * gradient, a symbolic icon and a monogram. A locked character keeps its face,
 * dimmed and greyed, behind a padlock.
 */
export function PortraitEmblem({ spec, label, size = 'md', locked = false, defeated = false, className = '', ring = 'ring-white/20' }: PortraitEmblemProps) {
  const s = PORTRAIT_SIZES[size]
  const art = usePortraitArt(label)
  const [failed, setFailed] = useState<string | null>(null)
  const showArt = art !== null && failed !== art
  // A stored emblem (e.g. a trophy avatar from localStorage) with an unknown icon still renders.
  const Icon = PORTRAIT_ICONS[spec.icon] ?? Crown
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden ring-2 transition-all duration-500 ${ring} ${s.box} ${className}`}
      style={{ background: `linear-gradient(145deg, ${spec.from}, ${spec.to})` }}
      aria-label={locked ? `${label} (locked)` : label}
      role="img"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.45),transparent_55%)]" aria-hidden="true" />
      <Icon className={`relative text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] ${s.icon} ${locked ? 'opacity-40' : ''}`} strokeWidth={1.75} />
      <span className={`absolute right-1 bottom-0.5 font-display font-extrabold text-white/80 ${s.mono}`} aria-hidden="true">
        {spec.monogram}
      </span>
      {showArt && (
        <img
          src={art}
          alt=""
          draggable={false}
          decoding="async"
          loading="lazy"
          onError={() => setFailed(art)}
          className={`absolute inset-0 size-full object-cover ${locked ? 'brightness-[0.85] grayscale-[0.75]' : ''}`}
          data-portrait-art
        />
      )}
      {locked && (
        // The padlock sits in the corner so the face stays visible.
        <span className="absolute right-[6%] bottom-[6%] flex size-[42%] items-center justify-center rounded-full bg-black/70 p-[9%] ring-1 ring-white/30" aria-hidden="true" data-portrait-lock>
          <Lock className="size-full text-white/90" strokeWidth={2.5} />
        </span>
      )}
      {defeated && <span className="absolute inset-0 rounded-[inherit] ring-2 ring-inset ring-amber-300/90" aria-hidden="true" />}
    </div>
  )
}
