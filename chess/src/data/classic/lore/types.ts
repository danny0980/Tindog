// The history behind each Classic Chess opponent: who they were, three true
// facts, and what they say at the end of a game (in character — these lines
// are written for the game, not historical quotations).

export interface ClassicLore {
  /** When they lived, as commonly given ("c. 1507 – 1458 BCE", "1943 – 2008"). */
  lived: string
  /** Two or three sentences: who they were and why they matter. */
  bio: string
  /** Three well-documented, checkable facts. */
  facts: readonly [string, string, string]
  /** In character, when they beat you. */
  victory: string
  /** In character, when you beat them. */
  defeat: string
}

/** Lore for one era, keyed by Classic character id. */
export type EraLore = Readonly<Record<string, ClassicLore>>
