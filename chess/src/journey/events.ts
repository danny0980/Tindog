// Weekend events: a different twist on chess every weekend (Friday to
// Sunday): all-cavalry armies, the Peasants' Revolt, a court of queens,
// Fischer Random… The first win of each event's weekend earns a medal and
// coins. On weekdays you can still practise the coming event. Pure.
import type { VariantId } from '../variants/rules'

export interface WeekendEvent {
  id: string
  name: string
  tagline: string
  rules: string
  /** The starting position (standard rules from it), or a built-in variant. */
  fen?: string
  variant?: Extract<VariantId, 'chess960' | 'koth' | 'threecheck'>
  coins: number
}

export const WEEKEND_EVENTS: readonly WeekendEvent[] = [
  { id: 'cavalry', name: 'Cavalry Charge', tagline: 'Every pawn is a knight.', rules: 'Both armies replace their pawns with knights. Normal chess rules otherwise.', fen: 'rnbqkbnr/nnnnnnnn/8/8/8/8/NNNNNNNN/RNBQKBNR w KQkq - 0 1', coins: 250 },
  { id: 'peasants', name: 'The Peasants’ Revolt', tagline: 'Eight pawns against the knights.', rules: 'You lead eight pawns and a king against three knights and a pawn. Break through, promote, and hunt the king down.', fen: '1nn1k1n1/4p3/8/8/8/8/PPPPPPPP/4K3 w - - 0 1', coins: 300 },
  { id: 'queens', name: 'Court of Queens', tagline: 'Three queens a side.', rules: 'The knights are replaced by queens. Everything is under attack from move one.', fen: 'rqbqkbqr/pppppppp/8/8/8/8/PPPPPPPP/RQBQKBQR w KQkq - 0 1', coins: 250 },
  { id: 'fischer', name: 'Fischer Weekend', tagline: 'The back rank is shuffled.', rules: 'Chess960: the pieces behind the pawns start in a random order. Castle by moving your king onto a rook.', variant: 'chess960', coins: 250 },
  { id: 'pawn-storm', name: 'Pawn Storm', tagline: 'Only rooks stand behind the pawns.', rules: 'Kings, rooks and pawns only. A battle of pawn breaks and open files.', fen: 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1', coins: 250 },
  { id: 'hill', name: 'King of the Hill', tagline: 'March your king to the centre.', rules: 'Win by checkmate, or by bringing your king safely to d4, e4, d5 or e5.', variant: 'koth', coins: 250 },
  { id: 'bishops', name: 'Bishops’ Conclave', tagline: 'The knights become bishops.', rules: 'Four bishops a side, two on each colour. Long diagonals everywhere.', fen: 'rbbqkbbr/pppppppp/8/8/8/8/PPPPPPPP/RBBQKBBR w KQkq - 0 1', coins: 250 },
  { id: 'threecheck', name: 'Three-Check Frenzy', tagline: 'Three checks and you win.', rules: 'Win by checkmate or by giving check three times.', variant: 'threecheck', coins: 250 },
]

/** The Monday-based week index (weeks since Monday 5 January 2026). */
function weekIndex(date: Date): number {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - ((date.getDay() + 6) % 7))
  return Math.floor((Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate()) - Date.UTC(2026, 0, 5)) / (7 * 86_400_000))
}

export interface EventInfo {
  event: WeekendEvent
  /** Friday to Sunday. */
  live: boolean
  /** Key for "won this weekend" (the week's Monday index). */
  weekId: string
  /** Days until it starts (when not live) or ends (when live), today counted. */
  days: number
}

export function currentEvent(date: Date = new Date()): EventInfo {
  const idx = weekIndex(date)
  const event = WEEKEND_EVENTS[((idx % WEEKEND_EVENTS.length) + WEEKEND_EVENTS.length) % WEEKEND_EVENTS.length]!
  const day = (date.getDay() + 6) % 7 // Monday 0 … Sunday 6
  const live = day >= 4
  return { event, live, weekId: `w${idx}`, days: live ? 7 - day : 4 - day }
}

export const nextEvent = (date: Date = new Date()): WeekendEvent => {
  const later = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7)
  return currentEvent(later).event
}
