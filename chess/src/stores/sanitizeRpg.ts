// Sanitisers for the v3 (Ultimate Edition) profile blocks: inventory, Ironman,
// the world map, tournaments, feats and analysis summaries. Every field is
// validated on its own so one broken value never resets the rest.
import { POTION_IDS, RESTRICTION_IDS } from '../data/arena'
import { GRAND_REALM_IDS } from '../data/campaign/realms'
import { LEGEND_IDS } from '../data/legends'
import { TACTIC_IDS } from '../data/spells'
import type { CampaignProgress, GrandRealmId } from '../types/campaign'
import type { LegendId } from '../types/legend'
import type {
  Bounty,
  FeatCounters,
  IronmanState,
  MatchAnalysisSummary,
  PotionId,
  PotionInventory,
  RestrictionId,
  TournamentEntrant,
  TournamentMatch,
  TournamentState,
  WorldEvent,
  WorldState,
} from '../types/rpg'
import type { TacticId } from '../types/spells'
import { arrayOf, asRecord, isRecord, num, oneOf, str } from '../utils/validate'

export const isPotionId = (v: unknown): v is PotionId => typeof v === 'string' && (POTION_IDS as readonly string[]).includes(v)
export const isTacticId = (v: unknown): v is TacticId => typeof v === 'string' && (TACTIC_IDS as readonly string[]).includes(v)
const isRestrictionId = (v: unknown): v is RestrictionId => typeof v === 'string' && (RESTRICTION_IDS as readonly string[]).includes(v)
const isRealmId = (v: unknown): v is GrandRealmId => typeof v === 'string' && (GRAND_REALM_IDS as readonly string[]).includes(v)
const isLegendId = (v: unknown): v is LegendId => typeof v === 'string' && (LEGEND_IDS as readonly string[]).includes(v)
const isString = (v: unknown): v is string => typeof v === 'string'
const count = (v: unknown): number => Math.floor(num(v, 0, 0))

export function sanitizePotions(raw: unknown): PotionInventory {
  const out: PotionInventory = {}
  for (const [key, value] of Object.entries(asRecord(raw))) {
    const n = Math.floor(num(value, 0, 0, 99))
    if (isPotionId(key) && n > 0) out[key] = n
  }
  return out
}

export function sanitizeIronman(raw: unknown, sanitizeCampaign: (raw: unknown) => CampaignProgress): IronmanState {
  const r = asRecord(raw)
  const enabled = r.enabled === true
  return {
    enabled,
    since: enabled && typeof r.since === 'string' ? r.since : null,
    wipes: count(r.wipes),
    bestCleared: count(r.bestCleared),
    realmsConquered: [...new Set(arrayOf(r.realmsConquered, isRealmId))],
    savedCampaign: enabled && isRecord(r.savedCampaign) ? sanitizeCampaign(r.savedCampaign) : null,
  }
}

function sanitizeEvent(raw: unknown): WorldEvent | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !isRealmId(raw.realm)) return null
  const kind = oneOf(raw.kind, ['shrine', 'merchant', 'ambush'] as const, 'shrine')
  const reward = asRecord(raw.reward)
  const wares = Array.isArray(raw.wares)
    ? raw.wares.flatMap((w: unknown) => (isRecord(w) && isPotionId(w.potion) ? [{ potion: w.potion, price: count(w.price) }] : []))
    : []
  return {
    id: raw.id,
    kind,
    realm: raw.realm,
    anchorIndex: Math.min(19, count(raw.anchorIndex)),
    title: str(raw.title, 'Event'),
    blessings: arrayOf(raw.blessings, isTacticId),
    wares,
    bossIndex: Math.min(19, count(raw.bossIndex)),
    reward: { coins: count(reward.coins), potion: isPotionId(reward.potion) ? reward.potion : null },
  }
}

function sanitizeBounty(raw: unknown): Bounty | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !isRealmId(raw.realm) || !isRestrictionId(raw.restriction)) return null
  const reward = asRecord(raw.reward)
  return {
    id: raw.id,
    realm: raw.realm,
    bossIndex: Math.min(19, count(raw.bossIndex)),
    restriction: raw.restriction,
    reward: { coins: count(reward.coins), potion: isPotionId(reward.potion) ? reward.potion : 'time-elixir' },
  }
}

export function sanitizeWorld(raw: unknown): WorldState {
  const r = asRecord(raw)
  return {
    cycle: str(r.cycle, ''),
    events: (Array.isArray(r.events) ? r.events : []).map(sanitizeEvent).filter((e): e is WorldEvent => e !== null),
    bounties: (Array.isArray(r.bounties) ? r.bounties : []).map(sanitizeBounty).filter((b): b is Bounty => b !== null),
    resolved: arrayOf(r.resolved, isString),
    purchases: arrayOf(r.purchases, isString),
    completedBounties: arrayOf(r.completedBounties, isString),
    blessings: arrayOf(r.blessings, isTacticId).slice(0, 3),
  }
}

function sanitizeEntrant(raw: unknown): TournamentEntrant | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.name !== 'string') return null
  return {
    id: raw.id,
    name: raw.name.slice(0, 40),
    elo: num(raw.elo, 1200, 100, 4000),
    legendId: isLegendId(raw.legendId) ? raw.legendId : null,
    strength: oneOf(raw.strength, ['novice', 'authentic', 'mythic'] as const, 'authentic'),
  }
}

const isMatch = (v: unknown): v is TournamentMatch =>
  isRecord(v) && typeof v.a === 'string' && typeof v.b === 'string' && (v.winner === null || typeof v.winner === 'string')

export function sanitizeTournament(raw: unknown): TournamentState | null {
  if (!isRecord(raw) || typeof raw.date !== 'string') return null
  const entrants = (Array.isArray(raw.entrants) ? raw.entrants : []).map(sanitizeEntrant).filter((e): e is TournamentEntrant => e !== null)
  if (entrants.length !== 8) return null
  const rounds = (Array.isArray(raw.rounds) ? raw.rounds : []).map((round: unknown) => arrayOf(round, isMatch)).slice(0, 3)
  return {
    date: raw.date,
    seed: count(raw.seed),
    entrants,
    rounds,
    status: oneOf(raw.status, ['active', 'won', 'eliminated'] as const, 'active'),
    coins: count(raw.coins),
  }
}

export function sanitizeFeats(raw: unknown): FeatCounters {
  const r = asRecord(raw)
  return {
    potionsDrunk: count(r.potionsDrunk),
    eventsResolved: count(r.eventsResolved),
    bountiesCompleted: count(r.bountiesCompleted),
    sacrifices: count(r.sacrifices),
    trapsSprung: count(r.trapsSprung),
    killCams: count(r.killCams),
    wins960: count(r.wins960),
    kothWins: count(r.kothWins),
    threeCheckWins: count(r.threeCheckWins),
    onlineGames: count(r.onlineGames),
    onlineWins: count(r.onlineWins),
    lessonsDone: Array.isArray(r.lessonsDone) ? [...new Set(r.lessonsDone.filter((x): x is string => typeof x === 'string' && /^[a-z0-9-]{1,40}$/.test(x)))].slice(0, 200) : [],
  }
}

const PIECE_KEYS = ['p', 'n', 'b', 'r', 'q', 'k'] as const

export function sanitizeAnalysisSummary(raw: unknown): MatchAnalysisSummary | null {
  if (!isRecord(raw)) return null
  const phase = asRecord(raw.errorsByPhase)
  const pieces = asRecord(raw.blunderPieces)
  const blunderPieces: MatchAnalysisSummary['blunderPieces'] = {}
  for (const key of PIECE_KEYS) {
    const n = count(pieces[key])
    if (n > 0) blunderPieces[key] = n
  }
  return {
    brilliant: count(raw.brilliant),
    best: count(raw.best),
    inaccuracies: count(raw.inaccuracies),
    mistakes: count(raw.mistakes),
    blunders: count(raw.blunders),
    moves: count(raw.moves),
    errorsByPhase: { opening: count(phase.opening), middlegame: count(phase.middlegame), endgame: count(phase.endgame) },
    blunderPieces,
  }
}
