// Consumables, arena weather and bounty contract rules.
import type { PotionDef, PotionId, RestrictionId, WeatherId } from '../types/rpg'
import type { PortraitIcon } from '../types/persona'

export const POTIONS: Readonly<Record<PotionId, PotionDef>> = {
  'time-elixir': { id: 'time-elixir', name: 'Time Elixir', icon: 'hourglass', price: 60, needsClock: true, description: '+30 seconds on your clock.' },
  'purge-potion': { id: 'purge-potion', name: 'Purge Potion', icon: 'sparkles', price: 80, needsClock: false, description: 'Removes every curse and trap affecting you, and dispels a charging spell.' },
  'ward-tonic': { id: 'ward-tonic', name: 'Ward Tonic', icon: 'shield', price: 70, needsClock: false, description: 'Grants a Spell Ward: the boss’s next spell is blocked.' },
  'trap-kit': { id: 'trap-kit', name: 'Glue Trap Kit', icon: 'hexagon', price: 50, needsClock: false, description: 'Lay a glue trap on an empty square: an enemy piece that lands there is stuck for two turns.' },
  'awakening-draught': { id: 'awakening-draught', name: 'Awakening Draught', icon: 'zap', price: 90, needsClock: false, description: 'One of your knights may make a 3 + 1 long leap.' },
}
export const POTION_IDS = Object.keys(POTIONS) as PotionId[]
/** Potions usable per battle. */
export const MAX_POTIONS_PER_BATTLE = 3

export const WEATHER: Readonly<Record<WeatherId, { name: string; description: string; icon: PortraitIcon }>> = {
  clear: { name: 'Clear skies', description: 'No arena effects.', icon: 'sun' },
  snow: { name: 'Snowfall', description: 'Every 4 plies two empty squares are buried in snow: pieces may land there but nothing slides through.', icon: 'snowflake' },
  wind: { name: 'Shifting winds', description: 'Long slides (4+ squares) straight into the wind are blown back. The wind turns every 6 plies.', icon: 'wind' },
  fog: { name: 'Fog of war', description: 'Thick fog hides legal-move hints and the evaluation bar.', icon: 'eclipse' },
}
export const WEATHER_IDS = Object.keys(WEATHER) as WeatherId[]

export const RESTRICTIONS: Readonly<Record<RestrictionId, { name: string; description: string }>> = {
  pawnless: { name: 'No pawn moves', description: 'Win without moving a single pawn (unless nothing else is legal).' },
  'no-castling': { name: 'No castling', description: 'Your king may not castle.' },
  'swift-30': { name: 'Swift victory', description: 'Win within 30 of your moves.' },
  'clock-60': { name: 'Clock pressure', description: 'You start with only 60 seconds (+2 s per move); the boss has 5 minutes.' },
}
export const RESTRICTION_IDS = Object.keys(RESTRICTIONS) as RestrictionId[]
