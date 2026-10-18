// Lazy realm loading. Each roster is its own chunk (built by Vite from the
// dynamic imports below), downloaded the first time its realm is opened and
// cached in a subscribable store so the map, the dossier and the game
// controller re-render once it arrives.
//
// Downloads are resilient: each fetch is retried with back-off (cache-busted,
// see importWithRetry), and a final
// failure is recorded per realm (never left "loading" forever) so the UI can
// offer a retry — automatically when the device comes back online.
import type { Boss, BossId, GrandRealmId } from '../../types/campaign'
import { DEFAULT_RETRY_DELAYS, importWithRetry, isOnline } from '../../utils/retry'
import { type Store, createStore } from '../../utils/store'
import { realmOfBoss } from './realms'

export type RosterImporter = () => Promise<{ default: readonly Boss[] }>

/** Download state of a realm that isn't loaded yet (a loaded realm simply has a roster). */
export type RealmLoadState = { status: 'loading' } | { status: 'error'; message: string; offline: boolean }

export interface RosterLoader {
  rosterStore: Store<Partial<Record<GrandRealmId, readonly Boss[]>>>
  statusStore: Store<Partial<Record<GrandRealmId, RealmLoadState>>>
  /** Loads (or returns the cached) roster; rejects only after every retry failed. */
  load: (realm: GrandRealmId) => Promise<readonly Boss[]>
  /** Synchronous lookup for bosses whose realm is already loaded (null otherwise). */
  getCachedBoss: (id: BossId) => Boss | null
}

export function createRosterLoader(importers: Record<GrandRealmId, RosterImporter>, delays: readonly number[] = DEFAULT_RETRY_DELAYS): RosterLoader {
  const rosterStore = createStore<Partial<Record<GrandRealmId, readonly Boss[]>>>({})
  const statusStore = createStore<Partial<Record<GrandRealmId, RealmLoadState>>>({})
  const pending = new Map<GrandRealmId, Promise<readonly Boss[]>>()

  const setStatus = (realm: GrandRealmId, state: RealmLoadState | null) =>
    statusStore.set((prev) => {
      const next = { ...prev }
      if (state) next[realm] = state
      else delete next[realm]
      return next
    })

  const load = (realm: GrandRealmId): Promise<readonly Boss[]> => {
    const cached = rosterStore.get()[realm]
    if (cached) return Promise.resolve(cached)
    const inflight = pending.get(realm)
    if (inflight) return inflight
    setStatus(realm, { status: 'loading' })
    const promise = importWithRetry(importers[realm], delays)
      .then((mod) => {
        rosterStore.set((prev) => ({ ...prev, [realm]: mod.default }))
        setStatus(realm, null)
        return mod.default
      })
      .catch((error: unknown) => {
        setStatus(realm, { status: 'error', message: error instanceof Error ? error.message : String(error), offline: !isOnline() })
        throw error
      })
      .finally(() => pending.delete(realm))
    pending.set(realm, promise)
    return promise
  }

  const getCachedBoss = (id: BossId): Boss | null => rosterStore.get()[realmOfBoss(id)]?.find((b) => b.id === id) ?? null

  return { rosterStore, statusStore, load, getCachedBoss }
}

const IMPORTERS: Record<GrandRealmId, RosterImporter> = {
  chronicle: () => import('./rosters/chronicle'),
  mythic: () => import('./rosters/mythic'),
  discovery: () => import('./rosters/discovery'),
  cyber: () => import('./rosters/cyber'),
  cosmic: () => import('./rosters/cosmic'),
}

const loader = createRosterLoader(IMPORTERS)

export const rosterStore = loader.rosterStore
export const realmStatusStore = loader.statusStore
export const loadRealmRoster = loader.load
export const getCachedBoss = loader.getCachedBoss
