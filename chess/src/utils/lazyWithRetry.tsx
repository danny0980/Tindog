import { type FunctionComponent, type LazyExoticComponent, createElement, lazy } from 'react'
import { DEFAULT_RETRY_DELAYS, importWithRetry } from './retry'

/**
 * Bumped by ErrorBoundary when the player asks to retry (Try again, back
 * online, or navigating back to the screen). A lazy component whose download
 * failed is only rebuilt after a bump — React re-renders once on its own after
 * an error, and rebuilding then would silently start another download loop
 * instead of showing the error screen.
 */
let retryEpoch = 0
export function allowLazyRetry(): void {
  retryEpoch += 1
}

/**
 * `React.lazy` that survives flaky networks:
 *  - each load retries the chunk fetch (2 retries with back-off by default,
 *    cache-busted so the browser really re-downloads it);
 *  - if it still fails, the error reaches the nearest ErrorBoundary; a retry
 *    from there fetches afresh. (Plain `React.lazy` caches the rejection
 *    forever, so a retry could never work.)
 */
export function lazyWithRetry<M, P extends object>(
  /** The dynamic import, e.g. `() => import('./views/X')`. */
  load: () => Promise<M>,
  /** Picks the component from the module, e.g. `(m) => m.X`. */
  pick: (module: M) => FunctionComponent<P>,
  delays: readonly number[] = DEFAULT_RETRY_DELAYS,
): FunctionComponent<P> {
  /** Epoch in which the current lazy failed (null while loading or loaded). */
  let failedIn: number | null = null
  const create = (): LazyExoticComponent<FunctionComponent<P>> =>
    lazy(() =>
      importWithRetry(load, delays).then(
        (module) => ({ default: pick(module) }),
        (error: unknown) => {
          failedIn = retryEpoch
          throw error
        },
      ),
    )
  let current = create()
  function LazyWithRetry(props: P) {
    if (failedIn !== null && failedIn < retryEpoch) {
      failedIn = null
      current = create()
    }
    return createElement(current, props)
  }
  return LazyWithRetry
}
