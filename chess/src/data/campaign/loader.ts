// Lazy realm loading. Each roster is its own chunk (built by Vite from the
// dynamic imports below), downloaded the first time its realm is opened and
// cached in a subscribable store so the map, the dossier and the game
// controller re-render once it arrives.
import type { Boss, BossId, GrandRealmId } from '../../types/campaign'
import { createStore } from '../../utils/store'
import { realmOfBoss } from './realms'

const IMPORTERS: Record<GrandRealmId, () => Promise<{ default: Boss[] }>> = {
  chronicle: () => import('./rosters/chronicle'),
  mythic: () => import('./rosters/mythic'),
  discovery: () => import('./rosters/discovery'),
  cyber: () => import('./rosters/cyber'),
  cosmic: () => import('./rosters/cosmic'),
}

export const rosterStore = createStore<Partial<Record<GrandRealmId, readonly Boss[]>>>({})
const pending = new Map<GrandRealmId, Promise<readonly Boss[]>>()

export function loadRealmRoster(realm: GrandRealmId): Promise<readonly Boss[]> {
  const cached = rosterStore.get()[realm]
  if (cached) return Promise.resolve(cached)
  const inflight = pending.get(realm)
  if (inflight) return inflight
  const promise = IMPORTERS[realm]()
    .then((mod) => {
      rosterStore.set((prev) => ({ ...prev, [realm]: mod.default }))
      return mod.default
    })
    .finally(() => pending.delete(realm))
  pending.set(realm, promise)
  return promise
}

/** Synchronous lookup for bosses whose realm is already loaded (null otherwise). */
export function getCachedBoss(id: BossId): Boss | null {
  return rosterStore.get()[realmOfBoss(id)]?.find((b) => b.id === id) ?? null
}
