// Crash reports: errors that reach an error boundary, or escape every
// handler, are sent to the game server's log (when there is one), so
// problems in players' browsers are seen. No personal data: the message, a
// trimmed stack, the screen's address and the browser's name. A few per
// session at most, each message once; chunk downloads (flaky networks) are
// left out, as they recover on their own.
import { apiOrigin, appHasNoServer } from '../native/platform'
import { isChunkLoadError } from '../utils/retry'

const MAX_PER_SESSION = 5
const sent = new Set<string>()

export function reportError(error: unknown, where: string): void {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return
  if (isChunkLoadError(error)) return
  const message = (error instanceof Error ? `${error.name}: ${error.message}` : String(error)).slice(0, 500)
  if (sent.has(message) || sent.size >= MAX_PER_SESSION) return
  sent.add(message)
  const body = JSON.stringify({ message, where, stack: error instanceof Error ? (error.stack ?? '').slice(0, 2000) : '', url: window.location.pathname, version: String(import.meta.env?.VITE_APP_VERSION ?? '') })
  // Fire and forget: a static host without the server simply answers 404.
  if (appHasNoServer()) return
  void fetch(`${apiOrigin()}/api/client-error`, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {})
}

/** Reports errors that escape every handler (call once at start-up). */
export function watchUncaughtErrors(): void {
  window.addEventListener('error', (e) => reportError(e.error ?? e.message, 'window'))
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason, 'promise'))
}
