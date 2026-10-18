import { useState } from 'react'
import { type BackgroundSlot, artStore, assetUrl } from '../../assets/artManifest'
import { useStore } from '../../hooks/useStore'
import { settingsStore } from '../../stores/settingsStore'
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

/**
 * The arena backdrop chosen in the loadout (Settings → Art pack, or before a
 * campaign battle), filling the screen behind the board. Nothing when none is
 * chosen, the art pack is off, or the file fails.
 */
export function ArenaBackdrop() {
  const id = useStore(settingsStore, (s) => (s.artPack ? s.arenaBackdrop : null))
  const path = useStore(artStore, (m) => (id ? m.backgrounds[id] : undefined))
  const [failed, setFailed] = useState<string | null>(null)
  if (!path) return null
  const url = assetUrl(path)
  if (failed === url) return null
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true" data-arena-backdrop={id}>
      <img src={url} alt="" decoding="async" className="size-full object-cover opacity-45 transition-opacity duration-300" onError={() => setFailed(url)} draggable={false} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(5,6,10,0.35)_20%,rgba(5,6,10,0.85))]" />
    </div>
  )
}
