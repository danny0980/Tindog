import { useCallback, useEffect } from 'react'
import { type RealmLoadState, loadRealmRoster, realmStatusStore, rosterStore } from '../data/campaign/loader'
import type { Boss, GrandRealmId } from '../types/campaign'
import { useStore } from './useStore'

export interface RealmRosterState {
  /** The realm's bosses, or null until downloaded. */
  roster: readonly Boss[] | null
  /** Set when every download attempt failed. */
  error: Extract<RealmLoadState, { status: 'error' }> | null
  /** Try the download again (also happens automatically when the device reconnects). */
  retry: () => void
}

/** Roster of a realm, downloading it on demand with retries and a recoverable error state. */
export function useRealmRoster(realm: GrandRealmId | null): RealmRosterState {
  const roster = useStore(rosterStore, (s) => (realm ? (s[realm] ?? null) : null))
  const status = useStore(realmStatusStore, (s) => (realm ? (s[realm] ?? null) : null))
  const error = status?.status === 'error' ? status : null

  const retry = useCallback(() => {
    // Failures are recorded in the status store; the promise is only for awaiting callers.
    if (realm) loadRealmRoster(realm).catch(() => undefined)
  }, [realm])

  // First request for this realm (an errored realm waits for a retry instead of looping).
  useEffect(() => {
    if (realm && !roster && !status) retry()
  }, [realm, retry, roster, status])

  // Reconnecting retries a failed download automatically.
  useEffect(() => {
    if (!error) return
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [error, retry])

  return { roster, error, retry }
}
