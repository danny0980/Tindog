import { Lock } from 'lucide-react'
import type { RelicDef } from '../../types/campaign'
import { PORTRAIT_ICONS } from '../legends/portraitIcons'
import { useState } from 'react'
import { artStore, assetUrl, relicArtFor } from '../../assets/artManifest'
import { useStore } from '../../hooks/useStore'
import { settingsStore } from '../../stores/settingsStore'

const SIZES = { sm: 'size-8 rounded-lg', md: 'size-11 rounded-xl', lg: 'size-14 rounded-2xl' } as const
const ICON = { sm: 'size-4', md: 'size-5', lg: 'size-7' } as const

/** Square relic emblem: gold when owned, greyed and padlocked when not. */
export function RelicTile({ relic, owned = true, active = false, size = 'md' }: { relic: RelicDef; owned?: boolean; active?: boolean; size?: keyof typeof SIZES }) {
  const Icon = owned ? PORTRAIT_ICONS[relic.icon] : Lock
  const art = useStore(artStore, (m) => relicArtFor(m, relic))
  const artPack = useStore(settingsStore, (s) => s.artPack)
  const [failed, setFailed] = useState(false)
  const showArt = owned && artPack && art && !failed
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center ring-1 ${SIZES[size]} ${
        owned
          ? 'bg-gradient-to-br from-amber-200 via-amber-400 to-orange-600 text-ink-950 ring-amber-200/60 shadow-[0_8px_24px_-10px_rgba(251,191,36,0.8)]'
          : 'bg-white/5 text-slate-500 ring-white/10'
      } ${active ? 'outline-2 outline-offset-2 outline-accent' : ''}`}
      role="img"
      aria-label={owned ? relic.name : `${relic.name} (not yet found)`}
    >
      {showArt ? (
        <img src={assetUrl(art)} alt="" decoding="async" draggable={false} onError={() => setFailed(true)} className="size-full rounded-[inherit] object-cover" data-relic-art={relic.id} />
      ) : (
        <Icon className={ICON[size]} strokeWidth={1.75} />
      )}
    </span>
  )
}
