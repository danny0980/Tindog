/** Counters that game events feed into daily quests. */
export type QuestMetric =
  | 'games_played'
  | 'ai_wins'
  | 'black_wins'
  | 'fast_wins'
  | 'timed_games'
  | 'captures'
  | 'checks'
  | 'castles'
  | 'promotions'
  | 'puzzles_solved'
  | 'analyses'
  | 'rush_runs'
  | 'rush_points'

export type QuestEvents = Partial<Record<QuestMetric, number>>

export interface QuestDef {
  id: string
  metric: QuestMetric
  target: number
  title: string
  description: string
  reward: number
}

export interface QuestProgress {
  /** Local date (YYYY-MM-DD) these quests belong to. */
  date: string
  progress: Partial<Record<QuestMetric, number>>
  claimed: string[]
  bonusClaimed: boolean
  /** Total number of days on which every quest was completed. */
  perfectDays: number
}
