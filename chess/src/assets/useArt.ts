// React hooks over the art pack: which portrait / piece set / board art to
// use right now, honouring the player's art preferences, plus an image
// preloader so broken files fall back to the built-in art instead of
// showing a broken image.
import { useEffect, useState } from 'react'
import { useStore } from '../hooks/useStore'
import { settingsStore } from '../stores/settingsStore'
import { type ArtBoard, type ArtPieceSet, type BackgroundSlot, artStore, assetUrl, backgroundsFor, portraitFor, resolveBoardArt, resolvePieceArt } from './artManifest'

export function usePieceArt(pieceSetId: string): { id: string; set: ArtPieceSet } | null {
  const manifest = useStore(artStore, (m) => m)
  const artPack = useStore(settingsStore, (s) => s.artPack)
  const artPieces = useStore(settingsStore, (s) => s.artPieces)
  const artBoard = useStore(settingsStore, (s) => s.artBoard)
  return resolvePieceArt(manifest, { artPack, artPieces, artBoard }, pieceSetId)
}

export function useBoardArt(themeId: string): { id: string; board: ArtBoard } | null {
  const manifest = useStore(artStore, (m) => m)
  const artPack = useStore(settingsStore, (s) => s.artPack)
  const artPieces = useStore(settingsStore, (s) => s.artPieces)
  const artBoard = useStore(settingsStore, (s) => s.artBoard)
  return resolveBoardArt(manifest, { artPack, artPieces, artBoard }, themeId)
}

/** URL of a character's portrait art, or null. */
export function usePortraitArt(name: string | null): string | null {
  const manifest = useStore(artStore, (m) => m)
  const artPack = useStore(settingsStore, (s) => s.artPack)
  if (!artPack || !name) return null
  const path = portraitFor(manifest, name)
  return path ? assetUrl(path) : null
}

/** URLs of the art-pack backgrounds for a slot (empty when none or the art pack is off). */
export function useBackgrounds(slot: BackgroundSlot): string[] {
  const manifest = useStore(artStore, (m) => m)
  const artPack = useStore(settingsStore, (s) => s.artPack)
  return artPack ? backgroundsFor(manifest, slot).map(assetUrl) : []
}

/** URL of the player's chosen avatar art, or null. */
export function useAvatarArt(): string | null {
  const manifest = useStore(artStore, (m) => m)
  const artPack = useStore(settingsStore, (s) => s.artPack)
  const avatar = useStore(settingsStore, (s) => s.playerAvatar)
  const path = artPack && avatar ? manifest.avatars[avatar] : undefined
  return path ? assetUrl(path) : null
}

type ImageStatus = 'loading' | 'ok' | 'error'
const statusCache = new Map<string, ImageStatus>()
const waiters = new Map<string, Promise<ImageStatus>>()

function probe(url: string): Promise<ImageStatus> {
  const pending = waiters.get(url)
  if (pending) return pending
  const p = new Promise<ImageStatus>((resolve) => {
    const img = new Image()
    img.onload = () => resolve('ok')
    img.onerror = () => resolve('error')
    img.src = url
  }).then((status) => {
    statusCache.set(url, status)
    return status
  })
  waiters.set(url, p)
  return p
}

/**
 * Whether every URL loads ('ok'), any failed ('error'), or still loading.
 * Results are cached for the session, so a broken file is only tried once.
 */
export function useImagesStatus(urls: readonly string[]): ImageStatus {
  const key = urls.join('|')
  const cached = (): ImageStatus => {
    if (urls.length === 0) return 'ok'
    const statuses = urls.map((u) => statusCache.get(u) ?? 'loading')
    return statuses.includes('error') ? 'error' : statuses.every((s) => s === 'ok') ? 'ok' : 'loading'
  }
  const [state, setState] = useState<{ key: string; status: ImageStatus }>(() => ({ key, status: cached() }))
  useEffect(() => {
    let alive = true
    const list = key ? key.split('|') : []
    void Promise.all(list.map(probe)).then((statuses) => {
      if (alive) setState({ key, status: statuses.includes('error') ? 'error' : 'ok' })
    })
    return () => {
      alive = false
    }
  }, [key])
  return state.key === key ? state.status : cached()
}
