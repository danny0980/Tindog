import { useCallback, useEffect, useMemo } from 'react'
import { loadRealmRoster, realmStatusStore, rosterStore } from '../data/campaign/loader'
import { GRAND_REALMS } from '../data/campaign/realms'
import type { Boss, GrandRealmId } from '../types/campaign'
import type { GauntletRun } from '../types/gauntlet'
import { pickBoss, realmsForRound } from '../utils/gauntlet'
import { useStore } from './useStore'

export interface GauntletBossState {
  boss: Boss | null
  loading: boolean
  failed: boolean
  retry: () => void
}

/**
 * The opponent for the run's current round. Only the realms whose Elo band
 * covers the round are downloaded (lazily, with the loader's retries).
 */
export function useGauntletBoss(run: GauntletRun | null): GauntletBossState {
  const realms = useMemo(() => (run ? (realmsForRound(run.round, GRAND_REALMS) as GrandRealmId[]) : []), [run])
  const rosters = useStore(rosterStore, (s) => s)
  const statuses = useStore(realmStatusStore, (s) => s)

  const retry = useCallback(() => {
    for (const realm of realms) loadRealmRoster(realm).catch(() => undefined)
  }, [realms])

  useEffect(() => {
    for (const realm of realms) if (!rosters[realm] && !statuses[realm]) loadRealmRoster(realm).catch(() => undefined)
  }, [realms, rosters, statuses])

  const loaded = realms.every((r) => rosters[r])
  const failed = realms.some((r) => statuses[r]?.status === 'error')
  const boss = useMemo(() => {
    if (!run || !loaded) return null
    const all = realms.flatMap((r) => [...(rosters[r] ?? [])])
    if (run.bossId) return all.find((b) => b.id === run.bossId) ?? Object.values(rosters).flatMap((r) => [...(r ?? [])]).find((b) => b.id === run.bossId) ?? null
    return pickBoss(all, run)
  }, [loaded, realms, rosters, run])

  return { boss, loading: !loaded && !failed, failed, retry }
}
