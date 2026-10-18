import { useSyncExternalStore } from 'react'
import type { Store } from '../utils/store'

/**
 * Subscribes to a store slice. Selectors must return values that are stable
 * between renders (state slices or primitives), never freshly built objects.
 */
export function useStore<T, S>(store: Store<T>, selector: (state: T) => S): S {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.get()),
    () => selector(store.get()),
  )
}
