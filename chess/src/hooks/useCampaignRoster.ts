import { useEffect } from 'react'
import { loadRealmRoster, rosterStore } from '../data/campaign/loader'
import { realmOfBoss } from '../data/campaign/realms'
import type { Boss, BossId, GrandRealmId } from '../types/campaign'
import { useStore } from './useStore'

/** Roster of a realm, loading it on demand; null while the chunk downloads. */
export function useRealmRoster(realm: GrandRealmId | null): readonly Boss[] | null {
  const roster = useStore(rosterStore, (s) => (realm ? (s[realm] ?? null) : null))
  useEffect(() => {
    if (realm && !roster) void loadRealmRoster(realm)
  }, [realm, roster])
  return roster
}

/** A single boss, loading its realm on demand. */
export function useBoss(id: BossId | null): Boss | null {
  const roster = useRealmRoster(id ? realmOfBoss(id) : null)
  return id && roster ? (roster.find((b) => b.id === id) ?? null) : null
}
