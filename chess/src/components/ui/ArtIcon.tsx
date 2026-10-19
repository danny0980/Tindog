import { type ReactNode, useState } from 'react'
import { type IconSlot, artStore, assetUrl, iconFor } from '../../assets/artManifest'
import { useStore } from '../../hooks/useStore'
import { settingsStore } from '../../stores/settingsStore'

/**
 * A UI icon from the art pack ("icon-boss-rush.png" fills the Gauntlet slot),
 * filling its tile; the built-in vector icon otherwise, or if the file fails.
 */
export function ArtIcon({ slot, fallback }: { slot: IconSlot; fallback: ReactNode }) {
  const path = useStore(artStore, (m) => iconFor(m, slot))
  const artPack = useStore(settingsStore, (s) => s.artPack)
  const [failed, setFailed] = useState<string | null>(null)
  if (!artPack || !path || failed === path) return <>{fallback}</>
  return <img src={assetUrl(path)} alt="" decoding="async" draggable={false} onError={() => setFailed(path)} className="size-full rounded-[inherit] object-cover" data-art-icon={slot} />
}
