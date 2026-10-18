type Listener = () => void

export interface Store<T> {
  get: () => T
  set: (updater: T | ((prev: T) => T)) => void
  subscribe: (listener: Listener) => () => void
}

/** Minimal external store compatible with React's useSyncExternalStore. */
export function createStore<T>(initial: T, onChange?: (state: T) => void): Store<T> {
  let state = initial
  const listeners = new Set<Listener>()
  return {
    get: () => state,
    set: (updater) => {
      const next = typeof updater === 'function' ? (updater as (prev: T) => T)(state) : updater
      if (Object.is(next, state)) return
      state = next
      onChange?.(state)
      listeners.forEach((listener) => listener())
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/**
 * Store persisted to localStorage. Writes are debounced so rapid updates
 * (e.g. a volume slider) don't hammer storage on low-end phones.
 */
export function createPersistentStore<T>(key: string, sanitize: (raw: unknown) => T): Store<T> {
  let timer: number | undefined
  const store = createStore<T>(sanitize(readStorage(key)), (state) => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => writeStorage(key, state), 150)
  })
  // Flush pending writes when the app is backgrounded (Capacitor may kill it).
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        window.clearTimeout(timer)
        writeStorage(key, store.get())
      }
    })
  }
  return store
}

function readStorage(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? undefined : (JSON.parse(raw) as unknown)
  } catch {
    return undefined
  }
}

function writeStorage(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or blocked: persistence is best-effort.
  }
}
