import type { TierId } from '../data/campaign/tiers'
import type { OpponentProfile } from './engine'
import type { LegendId, QuoteTrigger } from './legend'
import type { PortraitIcon, PortraitSpec } from './persona'
import type { BoardThemeId, PieceSetId } from './theme'

/** The five mega-realms of the Grand Campaign, in progression order. */
export type GrandRealmId = 'chronicle' | 'mythic' | 'discovery' | 'cyber' | 'cosmic'

/** "<realm>.<slug>", e.g. "chronicle.hammurabi". */
export type BossId = `${GrandRealmId}.${string}`

/** Combat archetypes every boss inherits its playing style from. */
export type ArchetypeId = 'berserker' | 'fortifier' | 'trickster' | 'calculator' | 'gambiteer' | 'sniper' | 'warlord' | 'maverick'

/** Era-specific opening books (see data/campaign/books.ts). */
export type BookId = 'old-masters' | 'romantic' | 'classical' | 'hypermodern' | 'fortress' | 'gambit' | 'sicilian' | 'irregular' | 'engine' | 'celestial'

export type RelicId =
  | 'shield-of-kings'
  | 'hourglass-of-time'
  | 'fae-gold'
  | 'dragonheart-ember'
  | 'black-prince-banner'
  | 'smoke-veil'
  | 'emp-spike'
  | 'firewall-core'
  | 'starforged-crown'
  | 'singularity-core'

/** Boss tier on the map: regular node, mid-realm milestone (relic) or realm overlord (relic + realm clear). */
export type BossRank = 'regular' | 'milestone' | 'overlord'

export type StarCount = 0 | 1 | 2 | 3

export interface ZoneDef {
  id: string
  name: string
  /** Short era / flavour caption shown on the map banner. */
  caption: string
  themeId: BoardThemeId
  pieceSetId: PieceSetId
  /** Portrait gradient for bosses of this zone. */
  from: string
  to: string
}

export interface GrandRealmDef {
  id: GrandRealmId
  order: number
  name: string
  /** One-word label for tight UI. */
  shortName: string
  tagline: string
  description: string
  icon: PortraitIcon
  /** Elo of the first and the last boss (linear ramp in between). */
  eloRange: readonly [number, number]
  /** Map gradient (hex) and accent colours. */
  colors: { from: string; via: string; to: string }
  /** Four zones of five bosses each. */
  zones: readonly [ZoneDef, ZoneDef, ZoneDef, ZoneDef]
  /** Relics granted by the milestone (#10) and overlord (#20) bosses. */
  relics: readonly [RelicId, RelicId]
  completionAchievement: string
}

/** Hand-authored roster row — everything else is derived by the archetype engine. */
export interface BossSeed {
  slug: string
  name: string
  title: string
  archetype: ArchetypeId
  book: BookId
  icon: PortraitIcon
  bio: string
  /** Signature lines: arrival, when the boss wins, when the boss loses. */
  lines: { intro: string; win: string; lose: string }
}

/** Cameo of a hand-crafted Chronos legend: inherits its style, book, portrait, epoch and dialogue. */
export interface CameoSeed {
  slug: string
  legend: LegendId
  /** Archetype shown in the dossier (the legend keeps its own tuned weights). */
  archetype: ArchetypeId
}

export type RosterEntry = BossSeed | CameoSeed

export interface Boss {
  id: BossId
  realm: GrandRealmId
  zone: ZoneDef
  /** 0–19 within the realm. */
  index: number
  /** 0–99 across the whole campaign. */
  globalIndex: number
  rank: BossRank
  name: string
  shortName: string
  title: string
  bio: string
  archetype: ArchetypeId
  /** null for cameo legends, who play their own repertoire. */
  book: BookId | null
  elo: number
  /** Your-move count for three stars. */
  par: number
  portrait: PortraitSpec
  profile: OpponentProfile
  quotes: Record<QuoteTrigger, readonly string[]>
  rewards: { first: number; repeat: number }
  /** Relic granted on first victory (milestones and overlords only). */
  relic: RelicId | null
  legendRef: LegendId | null
  themeId: BoardThemeId
  pieceSetId: PieceSetId
  /** Arrival-card caption and setting (zone, or the legend's epoch for cameos). */
  arrivalCaption: string
  settingName: string
  /** A hidden node (a realm's Echo): revealed by a condition, not part of the realm's count. */
  hidden?: true
}

export interface ArchetypeDef {
  id: ArchetypeId
  name: string
  summary: string
  /** Advice shown in the dossier on how to beat this style. */
  counterTip: string
  icon: PortraitIcon
}

export interface RelicDef {
  id: RelicId
  name: string
  description: string
  icon: PortraitIcon
  /** Where the effect applies: campaign battles, Time Rush, or always (owned). */
  scope: 'battle' | 'rush' | 'passive'
  realm: GrandRealmId
}

export interface BossRecord {
  stars: StarCount
  wins: number
  losses: number
  draws: number
  /** Fewest of your moves in a victory. */
  bestMoves: number | null
  /** ISO date of the first victory. */
  firstClear: string | null
  /** Hardest difficulty tier this boss was beaten on. */
  bestTier?: TierId
}

export interface CampaignProgress {
  bosses: Partial<Record<BossId, BossRecord>>
  relics: RelicId[]
  equipped: RelicId[]
  realmsCleared: GrandRealmId[]
}
