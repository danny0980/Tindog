import { type CSSProperties, type ReactNode, useEffect, useState } from 'react'
import { type ArtPieceSet, type PieceCode, assetUrl, sheetBackground } from '../../assets/artManifest'

interface ArtPieceProps {
  code: PieceCode
  art: ArtPieceSet
  /** The built-in vector piece: shown at once, until the art has loaded, and for good if it fails. */
  fallback: ReactNode
  style?: CSSProperties
}

/** Image URLs already decoded in this session: those render straight away, with no fallback flash. */
const ready = new Set<string>()
const failed = new Set<string>()

type Status = 'loading' | 'ok' | 'failed'
const statusOf = (url: string): Status => (ready.has(url) ? 'ok' : failed.has(url) ? 'failed' : 'loading')

/** Loads (and decodes) an image once, sharing the result between every piece that uses it. */
function useImage(url: string): Status {
  // A loaded / failed result is remembered per URL; switching URL re-derives it during render.
  const [result, setResult] = useState<{ url: string; status: Status }>(() => ({ url, status: statusOf(url) }))
  useEffect(() => {
    if (!url || statusOf(url) !== 'loading') return
    let alive = true
    const img = new Image()
    img.decoding = 'async'
    const done = (ok: boolean) => {
      ;(ok ? ready : failed).add(url)
      if (alive) setResult({ url, status: ok ? 'ok' : 'failed' })
    }
    img.onload = () => {
      if (typeof img.decode === 'function') img.decode().then(() => done(true), () => done(true))
      else done(true)
    }
    img.onerror = () => done(false)
    img.src = url
    return () => {
      alive = false
    }
  }, [url])
  return result.url === url ? result.status : statusOf(url)
}

/**
 * One piece from an art-pack set: a single image file or a cell of a sprite
 * sheet. The vector piece is shown instantly while the art loads, and stays
 * if the file is missing or broken — the board never shows an empty square.
 */
export function ArtPiece({ code, art, fallback, style }: ArtPieceProps) {
  const file = art.files?.[code]
  const src = file ?? art.sheet?.src
  const url = src ? assetUrl(src) : ''
  const status = useImage(url)
  // Fade in only art that arrives after the vector was shown — pieces moving around later appear at once.
  const [instant] = useState(() => ready.has(url))
  if (!src || status !== 'ok') return <>{fallback}</>
  if (file) {
    return (
      <img
        src={url}
        alt=""
        draggable={false}
        decoding="async"
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', pointerEvents: 'none', userSelect: 'none', ...(instant ? {} : { animation: 'vfx-fade-in 0.2s ease-out' }), ...style }}
      />
    )
  }
  // A square box of its own: the board's piece slot has no intrinsic height for a bare div.
  return art.sheet ? <div role="presentation" style={{ width: '100%', aspectRatio: '1 / 1', maxHeight: '100%', margin: 'auto', backgroundRepeat: 'no-repeat', ...sheetBackground(code, art.sheet), ...style }} /> : <>{fallback}</>
}
