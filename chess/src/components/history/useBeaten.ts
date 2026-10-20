import { useMemo } from 'react'
import { CLASSIC_ROSTER, type ClassicCharacter } from '../../data/classic/roster'
import { useStore } from '../../hooks/useStore'
import { profileStore } from '../../stores/profileStore'

/**
 * Classic characters you have beaten: the lasting record, plus wins still in the
 * match history from before the record existed.
 */
export function useBeatenClassics(): ClassicCharacter[] {
  const ids = useStore(profileStore, (p) => p.feats.classicBeaten)
  const matches = useStore(profileStore, (p) => p.matches)
  return useMemo(() => {
    const won = new Set(matches.filter((m) => m.outcome === 'win').map((m) => m.opponent))
    const kept = new Set(ids)
    return CLASSIC_ROSTER.filter((c) => kept.has(c.id) || won.has(c.name))
  }, [ids, matches])
}
