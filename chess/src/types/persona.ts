import type { Difficulty } from './chess'
import type { OpponentProfile } from './engine'
import type { QuoteTrigger } from './legend'
import type { BoardThemeId, PieceSetId } from './theme'

/** Symbolic icons available to character portraits (mapped to lucide icons in PortraitEmblem). */
export type PortraitIcon =
  | 'eye' | 'apple' | 'flag' | 'atom' | 'axe' | 'swords' | 'leaf' | 'flame'
  | 'scale' | 'scroll' | 'crown' | 'mountain' | 'church' | 'moon' | 'wind' | 'shield'
  | 'palette' | 'drama' | 'binary' | 'zap' | 'radiation' | 'feather' | 'bird' | 'hammer'
  | 'pyramid' | 'cloud-lightning' | 'tree' | 'book' | 'sparkles' | 'ghost' | 'bone' | 'snowflake'
  | 'tornado' | 'gem' | 'sun' | 'anchor' | 'sailboat' | 'skull' | 'ship' | 'compass'
  | 'sword' | 'target' | 'map' | 'globe' | 'waves' | 'telescope' | 'eclipse' | 'flower'
  | 'key' | 'scan-eye' | 'bug' | 'terminal' | 'wifi' | 'lock' | 'network' | 'dna'
  | 'hexagon' | 'glasses' | 'shield-half' | 'bot' | 'radar' | 'factory' | 'crosshair' | 'cpu'
  | 'server' | 'brain-circuit' | 'circuit' | 'microchip' | 'clock' | 'nut' | 'infinity' | 'sunrise'
  | 'hourglass' | 'music' | 'orbit' | 'star'

/** Iconographic portrait: a gradient, a symbol and a monogram (no likenesses, no image assets). */
export interface PortraitSpec {
  icon: PortraitIcon
  from: string
  to: string
  monogram: string
}

/**
 * Everything the play screen needs to stage a character battle — produced
 * from a hand-crafted Chronos legend or a generated Grand Campaign boss, so
 * the game controller, dialogue and portraits share one code path.
 */
export interface Persona {
  /** Stable key for dialogue routing, e.g. "legend:napoleon" or "boss:cyber.oracle-7". */
  key: string
  name: string
  title: string
  /** Nominal rating used for Elo. */
  elo: number
  difficulty: Difficulty
  profile: OpponentProfile
  quotes: Record<QuoteTrigger, readonly string[]>
  portrait: PortraitSpec
  themeId: BoardThemeId
  pieceSetId: PieceSetId
  /** Arrival card: big caption ("AD 1805", "Neon Syndicate") and setting name. */
  arrivalCaption: string
  settingName: string
}
