/** Default back-off between attempts (ms): first retry after 600 ms, second after 1.8 s. */
export const DEFAULT_RETRY_DELAYS: readonly number[] = [600, 1800]

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Calls `task` until it resolves, retrying once per entry in `delays`
 * (so the default makes up to 3 attempts). Rejects with the last error.
 */
export async function withRetry<T>(task: () => Promise<T>, delays: readonly number[] = DEFAULT_RETRY_DELAYS): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await task()
    } catch (error) {
      lastError = error
      const delay = delays[attempt]
      if (delay === undefined) break
      if (delay > 0) await wait(delay)
    }
  }
  throw lastError
}

/** Chunk URL named in a failed-import error (Chromium / Firefox include it; Safari doesn't). */
export function failedModuleUrl(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error)
  const match = /((?:https?|capacitor|file):\/\/[^\s'"]+?\.m?js)\b/.exec(message)
  return match?.[1] ?? null
}

/**
 * Retrying wrapper for `import()`.
 *
 * Browsers cache a failed module fetch per URL, so simply calling `import()`
 * again fails instantly without touching the network. When the error names
 * the chunk URL, retries import that URL with a cache-busting query instead,
 * which is a fresh module request. Otherwise the original import is re-run.
 */
export function importWithRetry<M>(load: () => Promise<M>, delays: readonly number[] = DEFAULT_RETRY_DELAYS): Promise<M> {
  let url: string | null = null
  let attempt = 0
  return withRetry(async () => {
    attempt += 1
    if (url === null) {
      try {
        return await load()
      } catch (error) {
        url = failedModuleUrl(error)
        throw error
      }
    }
    const busted = `${url}${url.includes('?') ? '&' : '?'}retry=${attempt}-${Date.now()}`
    // Same module, fresh request; its exports have the shape `load` resolves to.
    return (await import(/* @vite-ignore */ busted)) as M
  }, delays)
}

/** True for the errors browsers raise when a code-split chunk can't be fetched. */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error)
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported|ChunkLoadError|Unable to preload|Failed to fetch/i.test(message)
}

/** navigator.onLine where available (assumes online elsewhere). */
export const isOnline = (): boolean => (typeof navigator === 'undefined' ? true : navigator.onLine !== false)
