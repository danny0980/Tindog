import { useState } from 'react'
import type { BackgroundSlot } from '../../assets/artManifest'
import { useBackgrounds } from '../../assets/useArt'

interface ArtBackdropProps {
  slot: BackgroundSlot
  /** `fixed` fills the viewport behind the page; otherwise it fills the nearest positioned parent. */
  fixed?: boolean
  /** Image opacity (a dark gradient keeps text readable on top). */
  opacity?: number
}

/**
 * Art-pack background for a screen (victory, defeat, loading, world map, the
 * Chronos realm hub). Renders nothing without art; a file that fails to load
 * simply disappears. With several images for a slot (e.g. loading screens),
 * one is picked per visit.
 */
export function ArtBackdrop({ slot, fixed = false, opacity = 0.35 }: ArtBackdropProps) {
  const urls = useBackgrounds(slot)
  const [pick] = useState(() => Math.random())
  const [failed, setFailed] = useState<string | null>(null)
  const url = urls.length > 0 ? urls[Math.floor(pick * urls.length) % urls.length] : undefined
  if (!url || failed === url) return null
  return (
    <div className={`pointer-events-none ${fixed ? 'fixed -z-10' : 'absolute -z-10'} inset-0 overflow-hidden`} aria-hidden="true" data-art-backdrop={slot}>
      <img src={url} alt="" className="size-full object-cover" style={{ opacity }} onError={() => setFailed(url)} draggable={false} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(5,6,10,0.75))]" />
    </div>
  )
}
