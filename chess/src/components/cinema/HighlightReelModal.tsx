import { Download, Film, RotateCcw, Share2, Square as StopIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { type ReelInfo, type ReelMove, pickHighlights, reelLength } from '../../cinema/highlights'
import { canRecord, recordReel } from '../../cinema/recordReel'
import { type PieceImages, pieceImages } from '../../cinema/pieceImages'
import { type ReelLook, drawReel } from '../../cinema/reelRenderer'
import type { PieceSet } from '../../types/theme'
import { showToast } from '../../stores/toastStore'
import type { MoveClassification } from '../../types/analysis'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

interface HighlightReelModalProps {
  open: boolean
  onClose: () => void
  history: readonly ReelMove[]
  /** Engine verdicts per move, when the game has been analysed (adds brilliant moves). */
  classes?: ReadonlyArray<MoveClassification | null>
  info: ReelInfo
  look: ReelLook
  /** The pieces to film (the board's own set). */
  pieceSet: PieceSet
}

/** Wide for YouTube and the web; tall (9:16) for TikTok, Reels and Shorts. */
const FORMATS = { wide: { w: 1280, h: 720, label: 'Wide 16:9' }, tall: { w: 720, h: 1280, label: 'Vertical 9:16' } } as const
type ReelFormat = keyof typeof FORMATS

/** The game's best moments as a ≤ 30-second film: preview it, save it as a video, share it. */
export function HighlightReelModal({ open, onClose, history, classes = [], info, look: baseLook, pieceSet }: HighlightReelModalProps) {
  const [images, setImages] = useState<PieceImages | null>(null)
  useEffect(() => {
    let alive = true
    void pieceImages(pieceSet).then((imgs) => alive && setImages(imgs))
    return () => {
      alive = false
    }
  }, [pieceSet])
  const look = useMemo<ReelLook>(() => (images ? { ...baseLook, pieces: images } : baseLook), [baseLook, images])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const moments = useMemo(() => pickHighlights(history, classes), [classes, history])
  const length = reelLength(moments)
  const [replay, setReplay] = useState(0)
  const [progress, setProgress] = useState<number | null>(null)
  const [video, setVideo] = useState<{ url: string; file: File } | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const recording = progress !== null
  const [format, setFormat] = useState<ReelFormat>('tall')
  const W = FORMATS[format].w
  const H = FORMATS[format].h

  // Preview: the reel plays on a loop while the window is open (and not recording).
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!open || !ctx || recording) return
    const start = performance.now()
    let raf = 0
    const frame = (now: number) => {
      drawReel(ctx, W, H, moments, info, look, (now - start) % (length + 800))
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [H, W, info, length, look, moments, open, recording, replay])

  useEffect(() => () => {
    abortRef.current?.abort()
  }, [])
  useEffect(() => () => {
    if (video) URL.revokeObjectURL(video.url)
  }, [video])

  const save = async () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const abort = new AbortController()
    abortRef.current = abort
    setProgress(0)
    try {
      const { blob, extension } = await recordReel({ canvas, durationMs: length, draw: (ms) => drawReel(ctx, W, H, moments, info, look, ms), onProgress: setProgress, signal: abort.signal })
      const name = `chronos-highlights-${info.white}-vs-${info.black}${format === 'tall' ? '-vertical' : ''}.${extension}`.replace(/[^\w.-]+/g, '_')
      const file = new File([blob], name, { type: blob.type })
      const url = URL.createObjectURL(blob)
      setVideo({ url, file })
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.click()
      showToast('success', 'Highlight reel saved', `${name} (${(blob.size / 1_000_000).toFixed(1)} MB)`)
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) showToast('warning', 'Could not record the video', e instanceof Error ? e.message : undefined)
    } finally {
      setProgress(null)
      abortRef.current = null
    }
  }

  const share = async () => {
    if (!video) return
    try {
      await navigator.share({ files: [video.file], title: 'Chronos Chess highlights' })
    } catch {
      // Cancelled by the user, or sharing unavailable: the file is already downloaded.
    }
  }
  const canShare = video !== null && typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [video.file] })

  const close = () => {
    abortRef.current?.abort()
    onClose()
  }

  return (
    <Modal
      open={open}
      title="Highlight reel"
      onClose={close}
      size="lg"
      footer={
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {recording ? (
            <Button variant="secondary" className="col-span-2 sm:col-span-3" onClick={() => abortRef.current?.abort()} icon={<StopIcon className="size-4" />}>
              Stop recording · {Math.round((progress ?? 0) * 100)}%
            </Button>
          ) : (
            <>
              <Button variant="primary" onClick={() => void save()} disabled={!canRecord() || moments.length === 0} icon={<Download className="size-4" />} data-reel-save>
                Save video
              </Button>
              <Button onClick={() => setReplay((n) => n + 1)} icon={<RotateCcw className="size-4" />}>
                Replay
              </Button>
              {canShare && (
                <Button onClick={() => void share()} icon={<Share2 className="size-4" />}>
                  Share
                </Button>
              )}
            </>
          )}
        </div>
      }
    >
      <div className="space-y-2" data-reel={moments.length} data-reel-format={format}>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/[0.05] p-1" role="radiogroup" aria-label="Video format">
          {(Object.keys(FORMATS) as ReelFormat[]).map((f) => (
            <button key={f} type="button" role="radio" aria-checked={format === f} disabled={recording} onClick={() => setFormat(f)} className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition pointer-coarse:min-h-10 ${format === f ? 'bg-accent text-ink-950' : 'text-slate-300 hover:bg-white/5'}`}>
              {FORMATS[f].label}
            </button>
          ))}
        </div>
        <canvas ref={canvasRef} width={W} height={H} className={`mx-auto rounded-xl bg-black ${format === 'tall' ? 'aspect-[9/16] max-h-[60dvh] w-auto max-w-full' : 'aspect-video w-full'}`} aria-label={`Highlight reel: ${moments.map((m) => m.title).join(', ') || 'no highlights'}`} />
        {recording && (
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-accent transition-[width]" style={{ width: `${(progress ?? 0) * 100}%` }} />
          </div>
        )}
        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <Film className="size-3.5 shrink-0" />
          {moments.length === 0
            ? 'No big moments in this game yet: captures, checks, promotions and mates make the reel.'
            : `${moments.length} moment${moments.length === 1 ? '' : 's'} · ${Math.round(length / 1000)} s. ${canRecord() ? 'Saving records the film in real time; keep this tab open.' : 'This browser cannot record video.'}`}
        </p>
      </div>
    </Modal>
  )
}
