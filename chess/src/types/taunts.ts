/** What a character can react to (beyond its hand-written quote triggers). */
export type TauntKind =
  | 'queen-sacrifice'
  | 'queen-won'
  | 'queen-lost'
  | 'blunder'
  | 'brilliance'
  | 'big-capture'
  | 'lost-major'
  | 'player-promotes'
  | 'boss-promotes'
  | 'check-given'
  | 'in-check'
  | 'king-walk'
  | 'early-castle'
  | 'long-think'
  | 'time-trouble'
  | 'spell-cast'
  | 'spell-blocked'
  | 'tactic-used'

/** Emotional colour of a line — drives the speech bubble's look. */
export type TauntMood = 'smug' | 'angry' | 'shocked' | 'tense' | 'calm'

/** Voice family: archetypes and legends map onto one of these. */
export type TauntTone = 'fierce' | 'cold' | 'sly'

export interface TauntEvent {
  kind: TauntKind
  mood: TauntMood
  /** Higher wins when several things happen at once; ≥ 80 interrupts other chatter. */
  priority: number
  /** Template values: {piece}, {square}, {spell}, {seconds}. */
  vars: Readonly<Record<string, string>>
}
