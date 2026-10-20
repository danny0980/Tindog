// Records a highlight reel to a video file in the browser: the reel is drawn
// on a canvas in real time and captured with MediaRecorder. MP4 where the
// browser can write it (Chrome, Edge, Safari), WebM otherwise.

const TYPES = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']

export function recordingType(): string | null {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return null
  return TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? null
}

export const canRecord = (): boolean => recordingType() !== null && typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype

export interface RecordOptions {
  canvas: HTMLCanvasElement
  durationMs: number
  /** Draws the frame `ms` into the reel. */
  draw: (ms: number) => void
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
}

export function recordReel({ canvas, durationMs, draw, onProgress, signal }: RecordOptions): Promise<{ blob: Blob; extension: 'mp4' | 'webm' }> {
  const type = recordingType()
  if (!type) return Promise.reject(new Error('This browser cannot record video.'))
  const stream = canvas.captureStream(30)
  const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 5_000_000 })
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }
  return new Promise((resolve, reject) => {
    let raf = 0
    const stop = () => {
      cancelAnimationFrame(raf)
      if (recorder.state !== 'inactive') recorder.stop()
      stream.getTracks().forEach((t) => t.stop())
    }
    recorder.onstop = () => {
      if (signal?.aborted) return reject(new DOMException('Recording cancelled.', 'AbortError'))
      resolve({ blob: new Blob(chunks, { type: type.split(';')[0] }), extension: type.startsWith('video/mp4') ? 'mp4' : 'webm' })
    }
    recorder.onerror = () => {
      stop()
      reject(new Error('Recording failed.'))
    }
    signal?.addEventListener('abort', stop, { once: true })
    recorder.start(250)
    const start = performance.now()
    const frame = (now: number) => {
      const ms = now - start
      draw(Math.min(ms, durationMs))
      onProgress?.(Math.min(1, ms / durationMs))
      if (ms >= durationMs + 200) return stop()
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
  })
}
