import type { ColorChoice } from '../../types/chess'

/** Side and clock chosen in the boss dossier. */
export interface BattleOptions {
  color: ColorChoice
  timeControlId: string
}

export const CAMPAIGN_TIME_CONTROLS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'none', label: '∞' },
  { id: 'blitz-5-3', label: '5 + 3' },
  { id: 'rapid-10-5', label: '10 + 5' },
  { id: 'rapid-15-10', label: '15 + 10' },
]
