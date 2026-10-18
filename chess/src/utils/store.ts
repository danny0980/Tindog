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

/** The slice of the Web Storage API persistence needs (injectable for tests / native storage). */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>

/** How the persisted state was obtained at startup. */
export type LoadSource =
  /** Nothing stored yet (first launch). */
  | 'empty'
  /** Primary key parsed fine. */
  | 'primary'
  /** Primary key was corrupt or unreadable; the backup copy was used. */
  | 'backup'
  /** Primary and backup were both unusable; defaults were used (the raw data is quarantined). */
  | 'reset'

export interface PersistOptions {
  /** Key holding the last known-good copy. Enables backups and corruption recovery. */
  backupKey?: string
  /** Storage backend; defaults to `window.localStorage` when available. */
  storage?: KeyValueStorage | null
  /** Debounce for writes in ms (0 = write synchronously; handy in tests). */
  debounceMs?: number
}

export interface PersistentStore<T> extends Store<T> {
  /** Where the initial state came from (for a one-time "restored from backup" notice). */
  loadSource: LoadSource
  /** Write any pending change immediately. */
  flush: () => void
  /** Copy the stored (parseable) value to the backup key now; once per session. */
  ensureBackup: () => void
}

/** `window.localStorage`, or null where it doesn't exist or access throws (private mode, Node). */
export function defaultStorage(): KeyValueStorage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null
  } catch {
    return null
  }
}

type ReadResult = { kind: 'missing' } | { kind: 'ok'; value: unknown; text: string } | { kind: 'corrupt'; text: string | null }

function readKey(storage: KeyValueStorage | null, key: string): ReadResult {
  if (!storage) return { kind: 'missing' }
  let text: string | null
  try {
    text = storage.getItem(key)
  } catch {
    return { kind: 'corrupt', text: null }
  }
  if (text === null) return { kind: 'missing' }
  try {
    return { kind: 'ok', value: JSON.parse(text) as unknown, text }
  } catch {
    return { kind: 'corrupt', text }
  }
}

function writeKey(storage: KeyValueStorage | null, key: string, text: string): boolean {
  if (!storage) return false
  try {
    storage.setItem(key, text)
    return true
  } catch {
    // Storage full or blocked: persistence is best-effort.
    return false
  }
}

/**
 * Store persisted to localStorage. Writes are debounced so rapid updates
 * (e.g. a volume slider) don't hammer storage on low-end phones.
 *
 * With a `backupKey`, progress is protected against loss:
 *  - Corrupt or unreadable primary data falls back to the backup copy; if both
 *    are unusable the raw text is quarantined under `<key>:corrupt` before
 *    defaults take over, so nothing is silently destroyed.
 *  - Before the first write of each session the previous, parseable primary
 *    value is copied to the backup key — a known-good snapshot from launch.
 *    Corrupt text never overwrites a good backup.
 */
export function createPersistentStore<T>(key: string, sanitize: (raw: unknown) => T, options: PersistOptions = {}): PersistentStore<T> {
  const storage = options.storage === undefined ? defaultStorage() : options.storage
  const { backupKey, debounceMs = 150 } = options

  let initial: unknown
  let loadSource: LoadSource
  const primary = readKey(storage, key)
  if (primary.kind === 'ok') {
    initial = primary.value
    loadSource = 'primary'
  } else if (primary.kind === 'missing' && !backupKey) {
    loadSource = 'empty'
  } else {
    const backup = backupKey ? readKey(storage, backupKey) : ({ kind: 'missing' } as const)
    if (backup.kind === 'ok') {
      initial = backup.value
      loadSource = 'backup'
    } else if (primary.kind === 'missing') {
      loadSource = 'empty'
    } else {
      loadSource = 'reset'
    }
    if (primary.kind === 'corrupt' && primary.text !== null) writeKey(storage, `${key}:corrupt`, primary.text)
  }
  let backedUp = false
  const snapshotBeforeFirstWrite = () => {
    if (backedUp || !backupKey) return
    backedUp = true
    const current = readKey(storage, key)
    if (current.kind === 'ok') writeKey(storage, backupKey, current.text)
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  let dirty = false
  const flush = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    if (!dirty) return
    dirty = false
    snapshotBeforeFirstWrite()
    let text: string
    try {
      text = JSON.stringify(store.get())
    } catch {
      return
    }
    writeKey(storage, key, text)
  }

  const store = createStore<T>(sanitize(initial), () => {
    dirty = true
    if (debounceMs <= 0) {
      flush()
      return
    }
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(flush, debounceMs)
  })

  // Flush pending writes when the app is backgrounded (Capacitor may kill it).
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush()
    })
  }
  return { ...store, loadSource, flush, ensureBackup: snapshotBeforeFirstWrite }
}
