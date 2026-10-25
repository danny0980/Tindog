// What a character says depends on how the game went, not just who won: a
// quick mate, a long siege, a comeback, a win on the clock, a promotion, a
// flurry of checks. And before a game they may have heard about your form.
// Pure and unit-tested; the lines are written for the game.
import type { Color, GameResult, Move, Outcome } from '../types/chess'

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

export interface GameShape {
  plies: number
  outcome: Outcome
  result: GameResult['kind']
  /** Your worst material deficit during the game (points, ≥ 0). */
  deficit: number
  promoted: boolean
  checks: number
}

export function shapeOf(history: readonly Move[], human: Color, outcome: Outcome, result: GameResult): GameShape {
  let mine = 39
  let theirs = 39
  let deficit = 0
  let promoted = false
  let checks = 0
  for (const m of history) {
    if (m.captured) {
      if (m.color === human) theirs -= VALUE[m.captured] ?? 0
      else mine -= VALUE[m.captured] ?? 0
    }
    if (m.color === human && m.promotion) promoted = true
    if (m.color === human && m.san.includes('+')) checks += 1
    deficit = Math.max(deficit, theirs - mine)
  }
  return { plies: history.length, outcome, result: result.kind, deficit, promoted, checks }
}

const pick = (lines: readonly string[], seed: number): string => lines[Math.abs(seed) % lines.length]!

/** A remark that fits the game, or null when nothing stands out. `you` = the speaker lost. */
export function styleRemark(s: GameShape, seed: number): string | null {
  const youWon = s.outcome === 'win'
  if (s.result === 'timeout') {
    return youWon
      ? pick(['The clock beat me, not you. Next time I will think faster.', 'Out of time! A poor way to lose a good position.'], seed)
      : pick(['Your clock betrayed you before I did.', 'Time is a merciless opponent. Today it played for me.'], seed)
  }
  if (youWon && s.deficit >= 5) return pick(['You were lost! How did you crawl back from that?', 'I had you. I had you! Remarkable comeback.', 'Never give up — you taught me that today, at my own expense.'], seed)
  if (youWon && s.plies <= 50) return pick(['So quickly? I had barely sat down.', 'A short game, and a sharp one. I will not forget it.', 'You struck before I had my army out of bed.'], seed)
  if (!youWon && s.outcome === 'loss' && s.plies <= 50) return pick(['Too quick. Slow down and look before you leap.', 'That was over before it began. Take more care next time.'], seed)
  if (s.plies >= 120) return s.outcome === 'draw' ? pick(['A siege with no winner. My compliments.'], seed) : pick(['That was not a game, that was a siege.', 'Hours of manoeuvring. My mind aches.'], seed)
  if (youWon && s.promoted) return pick(['A pawn became a queen, and I became a footnote.', 'All the way to the last rank. Bravo, little pawn.'], seed)
  if (s.checks >= 8) return pick(['So many checks! My king needs a holiday.', 'Check, check, check… You do like to make noise.'], seed)
  return null
}

/** A greeting about your form (a winning streak or a rough patch), when it is notable. */
export function formIntro(currentStreak: number, recentLosses: number, seed: number): string | null {
  if (currentStreak >= 3) return pick([`They say you have won ${currentStreak} in a row. Not today.`, `${currentStreak} victories straight? Someone has to end it. Why not me?`], seed)
  if (recentLosses >= 3) return pick(['A rough week, I hear. Let us see if you have learned from it.', 'Losses teach more than wins. Show me what they taught you.'], seed)
  return null
}
