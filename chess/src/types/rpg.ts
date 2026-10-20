import type { CampaignProgress, GrandRealmId } from './campaign'
import type { LegendId, LegendStrength } from './legend'
import type { Square } from './chess'
import type { PortraitIcon } from './persona'
import type { TacticId } from './spells'
import type { TauntMood } from './taunts'

// ── Consumables ──────────────────────────────────────────────────────────────

export type PotionId = 'time-elixir' | 'purge-potion' | 'ward-tonic' | 'trap-kit' | 'awakening-draught'

export interface PotionDef {
  id: PotionId
  name: string
  description: string
  icon: PortraitIcon
  /** Merchant / shop price in coins. */
  price: number
  /** Only useful in timed battles. */
  needsClock: boolean
}

export type PotionInventory = Partial<Record<PotionId, number>>

// ── Board modifiers ──────────────────────────────────────────────────────────

/** Bounty contract rules imposed on the player. */
export type RestrictionId = 'pawnless' | 'no-castling' | 'swift-30' | 'clock-60'

export type WeatherId = 'clear' | 'snow' | 'wind' | 'fog'
/** Direction the wind blows TOWARD (moving against it is "into the wind"). */
export type WindDirection = 'N' | 'E' | 'S' | 'W'

export interface WeatherState {
  id: WeatherId
  /** Snow-covered squares: pieces may land on them but not slide through. */
  snow: Square[]
  wind: WindDirection
}

/**
 * Board traps. `frost` (boss spells): the victim may not land on or pass
 * through. `glue` (your trap kit): an enemy piece that lands on it is stuck
 * for two of its turns.
 */
export interface Trap {
  square: Square
  kind: 'frost' | 'glue'
  victim: 'human' | 'boss'
  /** Victim moves left before it fades. */
  turnsLeft: number
}

/** A boss piece caught in glue (tracked by square — a stuck piece can't leave it). */
export interface StuckPiece {
  square: Square
  turnsLeft: number
}

// ── Pre-battle parley ────────────────────────────────────────────────────────

export interface ParleyChoice {
  id: string
  label: string
  /** What the choice does, in player terms. */
  effect: string
  /** The boss's answer (spoken as the battle begins). */
  reply: string
  mood: TauntMood
  /** Multiplier on campaign coin rewards. */
  rewardFactor: number
  /** −1 weakens the boss, +1 empowers it. */
  bossBoost: -1 | 0 | 1
  /** A temporary boon: an extra tactic for this battle. */
  grant?: TacticId
}

export interface Parley {
  id: string
  prompt: string
  choices: readonly ParleyChoice[]
}

// ── World map: events, bounties, Ironman ─────────────────────────────────────

export type WorldEventKind = 'shrine' | 'merchant' | 'ambush'

export interface WorldEvent {
  id: string
  kind: WorldEventKind
  realm: GrandRealmId
  /** Placed beside this boss node; reachable once that boss is unlocked. */
  anchorIndex: number
  title: string
  /** Shrine: blessings to choose from. */
  blessings: TacticId[]
  /** Merchant: wares and prices. */
  wares: Array<{ potion: PotionId; price: number }>
  /** Ambush: the elite attacker. */
  bossIndex: number
  reward: { coins: number; potion: PotionId | null }
}

export interface Bounty {
  id: string
  realm: GrandRealmId
  bossIndex: number
  restriction: RestrictionId
  reward: { coins: number; potion: PotionId }
}

export interface WorldState {
  /** Local date the events and bounties were dealt for (they refresh daily). */
  cycle: string
  /** Today's map events and bounty contracts (dealt against your progress at the start of the day). */
  events: WorldEvent[]
  bounties: Bounty[]
  resolved: string[]
  /** Merchant wares already bought ("<eventId>:<potion>"). */
  purchases: string[]
  completedBounties: string[]
  /** Shrine blessings waiting for your next campaign battle. */
  blessings: TacticId[]
}

export interface IronmanState {
  enabled: boolean
  /** When the current Ironman run began. */
  since: string | null
  /** Runs lost to permadeath. */
  wipes: number
  /** Most bosses cleared in a single Ironman run. */
  bestCleared: number
  /** Realms cleared across Ironman runs (for the Iron Crown). */
  realmsConquered: GrandRealmId[]
  /** Your regular campaign, kept safe while an Ironman run is active. */
  savedCampaign: CampaignProgress | null
}

/** Lifetime counters for the Chronicle and feats. */
export interface FeatCounters {
  potionsDrunk: number
  eventsResolved: number
  bountiesCompleted: number
  sacrifices: number
  trapsSprung: number
  killCams: number
  /** Chess variants won (any level), by variant. */
  wins960: number
  kothWins: number
  threeCheckWins: number
  /** Online games finished, and won. */
  onlineGames: number
  onlineWins: number
  /** Opening School lessons completed (ids, so a lesson counts once). */
  lessonsDone: string[]
  /** Historic battles won, as "battle:side" (e.g. "waterloo:w"). */
  battlesWon: string[]
  /** Classic Chess characters beaten (ids): the Trophy Museum. */
  classicBeaten: string[]
  /** Classic characters interviewed after a win (ids). */
  interviewed: string[]
  /** History quiz questions answered correctly, lifetime. */
  quizCorrect: number
}

// ── Titles & trophies ────────────────────────────────────────────────────────

export interface TitleDef {
  id: string
  name: string
  description: string
  /** Noble ranks come from rating; feats from achievements. */
  kind: 'rank' | 'feat'
}

export type TrophyKind = 'crown' | 'weapon' | 'relic' | 'tome' | 'cup'

export interface TrophyDef {
  id: string
  name: string
  kind: TrophyKind
  icon: PortraitIcon
  /** Shelf / category. */
  shelf: GrandRealmId | 'legends' | 'arena'
  /** How it is earned (shown on locked trophies). */
  hint: string
  /** Display colours (gradient) on the shelf. */
  from: string
  to: string
}

// ── Daily tournament ─────────────────────────────────────────────────────────

export interface TournamentEntrant {
  /** "you" for the player, else the legend id. */
  id: string
  name: string
  elo: number
  legendId: LegendId | null
  strength: LegendStrength
}

export interface TournamentMatch {
  a: string
  b: string
  winner: string | null
}

export interface TournamentState {
  /** Local date (one tournament per day). */
  date: string
  seed: number
  entrants: TournamentEntrant[]
  /** Rounds of matches: quarter-finals, semi-finals, final. */
  rounds: TournamentMatch[][]
  status: 'active' | 'won' | 'eliminated'
  coins: number
}

// ── Notebook & chronicle ─────────────────────────────────────────────────────

/** Compact engine-analysis summary kept with a match (for the notebook). */
export interface MatchAnalysisSummary {
  /** Your move classifications. */
  brilliant: number
  best: number
  inaccuracies: number
  mistakes: number
  blunders: number
  moves: number
  /** Your mistakes + blunders by phase. */
  errorsByPhase: { opening: number; middlegame: number; endgame: number }
  /** Pieces you blundered with. */
  blunderPieces: Partial<Record<'p' | 'n' | 'b' | 'r' | 'q' | 'k', number>>
}
