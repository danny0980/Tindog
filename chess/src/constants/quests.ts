import type { QuestDef } from '../types/quest'

/** Pool the daily quests are drawn from (3 per day, distinct metrics). */
export const QUEST_POOL: ReadonlyArray<QuestDef> = [
  { id: 'win-ai-1', metric: 'ai_wins', target: 1, title: 'Victor', description: 'Win a match against the AI', reward: 40 },
  { id: 'win-ai-2', metric: 'ai_wins', target: 2, title: 'Double Down', description: 'Win 2 matches against the AI', reward: 80 },
  { id: 'play-3', metric: 'games_played', target: 3, title: 'Warm-up', description: 'Finish 3 games', reward: 40 },
  { id: 'puzzles-2', metric: 'puzzles_solved', target: 2, title: 'Puzzle Hunter', description: 'Solve 2 puzzles', reward: 40 },
  { id: 'puzzles-3', metric: 'puzzles_solved', target: 3, title: 'Daily Clean Sweep', description: 'Solve 3 puzzles', reward: 60 },
  { id: 'capture-5', metric: 'captures', target: 5, title: 'Hungry', description: 'Capture 5 pieces', reward: 30 },
  { id: 'capture-15', metric: 'captures', target: 15, title: 'Devourer', description: 'Capture 15 pieces', reward: 60 },
  { id: 'checks-5', metric: 'checks', target: 5, title: 'Pressure', description: 'Give check 5 times', reward: 30 },
  { id: 'castle-2', metric: 'castles', target: 2, title: 'Fortress', description: 'Castle in 2 games', reward: 30 },
  { id: 'promote-1', metric: 'promotions', target: 1, title: 'Ascension', description: 'Promote a pawn', reward: 50 },
  { id: 'rush-1', metric: 'rush_runs', target: 1, title: 'Against the Clock', description: 'Play a Time Rush run', reward: 30 },
  { id: 'rush-3000', metric: 'rush_points', target: 3000, title: 'High Voltage', description: 'Earn 3,000 Time Rush points', reward: 50 },
  { id: 'analyze-1', metric: 'analyses', target: 1, title: 'Student of the Game', description: 'Analyze a finished game', reward: 25 },
  { id: 'black-win', metric: 'black_wins', target: 1, title: 'Dark Side', description: 'Win a game as Black vs the AI', reward: 70 },
  { id: 'fast-win', metric: 'fast_wins', target: 1, title: 'Blitzkrieg', description: 'Win vs the AI in 25 moves or fewer', reward: 70 },
  { id: 'timed-2', metric: 'timed_games', target: 2, title: 'On the Clock', description: 'Finish 2 timed games', reward: 40 },
]

export const DAILY_QUEST_COUNT = 3
/** Bonus chest for completing every daily quest. */
export const QUEST_BONUS_REWARD = 75
