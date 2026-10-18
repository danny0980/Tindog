/** Copies text, with a fallback for WebViews lacking the async clipboard API. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    textarea.remove()
    return ok
  }
}

export function downloadText(filename: string, text: string, mime = 'application/x-chess-pgn'): void {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export type ShareResult = 'shared' | 'copied' | 'downloaded' | 'failed'

/**
 * Uses the native share sheet when available (iOS/Android WebViews and mobile
 * browsers), otherwise copies to the clipboard.
 */
export async function shareText(title: string, text: string): Promise<ShareResult> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'failed'
    }
  }
  return (await copyText(text)) ? 'copied' : 'failed'
}

/** Shares a PGN as a file where supported, falling back to a download. */
export async function sharePgn(filename: string, pgn: string): Promise<ShareResult> {
  const file = typeof File === 'function' ? new File([pgn], filename, { type: 'text/plain' }) : null
  if (file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'failed'
    }
  }
  downloadText(filename, pgn)
  return 'downloaded'
}

export function pgnFilename(white: string, black: string, date = new Date()): string {
  const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
  return `chess-arena_${safe(white)}_vs_${safe(black)}_${date.toISOString().slice(0, 10)}.pgn`
}
