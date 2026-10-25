// The Journey save: level, season pass, league, skills, cosmetics, story,
// nemesis, the new modes' records and the learning tools. It lives beside the
// profile (its own storage key, also in the cloud save). Every field is
// validated on load, so a damaged or older save falls back field by field.
import { arrayOf, asRecord, bool, isRecord, num, str } from '../utils/validate'
import { isAuraId, isFrameId } from './cosmetics'
import { LEAGUE_TIERS, type LeagueResult, type LeagueTier } from './league'
import { isSkillId } from './skills'
import { MAX_PRESTIGE } from './xp'

export interface EarnedTitle {
  id: string
  name: string
}

/** A position from one of your own games where you went wrong. */
export interface MistakePuzzle {
  id: string
  fen: string
  /** The engine's move (UCI) and the move you played (SAN). */
  best: string
  played: string
  /** How much the move cost, in centipawns. */
  swing: number
  opponent: string
  date: string
}

export interface ModeRecords {
  /** Classic ids whose three-phase boss fight you have won. */
  phases: string[]
  powersWins: number
  coopWins: number
  defenseBest: number
  defenseRuns: number
  /** Famous positions you have won. */
  positions: string[]
  /** Event id → the week you won it. */
  events: Record<string, string>
  bulletBest: number
  bulletStreak: number
  dreams: number
}

export interface LearnState {
  endgames: string[]
  mistakes: MistakePuzzle[]
  solved: string[]
  /** The mentor's current plan (started on a date, with a focus). */
  plan: { start: string; focus: string } | null
  /** The last week's report you opened (week key). */
  reportSeen: string
}

export interface JourneyState {
  version: 1
  /** XP inside the current prestige, and over all time. */
  xp: number
  totalXp: number
  prestige: number
  /** Date of the last finished game (for the first-game-of-the-day bonus). */
  lastGameDate: string
  season: { index: number; xp: number; claimed: number[] }
  seasonHistory: Array<{ index: number; tier: number }>
  league: { week: string; tier: LeagueTier; points: number }
  leagueHistory: LeagueResult[]
  skills: string[]
  frames: string[]
  frame: string | null
  auras: string[]
  aura: string | null
  titles: EarnedTitle[]
  /** Classic id → the highest bond level whose gift you have collected. */
  bondGifts: Record<string, number>
  /** Era ids whose collection reward you have collected. */
  collection: string[]
  /** Story chapters completed (0-based). */
  story: number[]
  nemesis: { key: string | null; since: string; beaten: string[] }
  modes: ModeRecords
  learn: LearnState
  chest: { date: string; streak: number }
  shop: { date: string; bought: string[] }
  founder: boolean
  notify: { enabled: boolean; hour: number }
  /** Referral rewards already paid out. */
  referralPaid: number
}

export const MAX_MISTAKES = 60
export const MAX_LEAGUE_HISTORY = 12

export function createJourney(): JourneyState {
  return {
    version: 1,
    xp: 0,
    totalXp: 0,
    prestige: 0,
    lastGameDate: '',
    season: { index: -1, xp: 0, claimed: [] },
    seasonHistory: [],
    league: { week: '', tier: 'bronze', points: 0 },
    leagueHistory: [],
    skills: [],
    frames: [],
    frame: null,
    auras: [],
    aura: null,
    titles: [],
    bondGifts: {},
    collection: [],
    story: [],
    nemesis: { key: null, since: '', beaten: [] },
    modes: { phases: [], powersWins: 0, coopWins: 0, defenseBest: 0, defenseRuns: 0, positions: [], events: {}, bulletBest: 0, bulletStreak: 0, dreams: 0 },
    learn: { endgames: [], mistakes: [], solved: [], plan: null, reportSeen: '' },
    chest: { date: '', streak: 0 },
    shop: { date: '', bought: [] },
    founder: false,
    notify: { enabled: false, hour: 18 },
    referralPaid: 0,
  }
}

const isString = (v: unknown): v is string => typeof v === 'string'
const isShortString = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 80
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 10_000
const uniq = <T>(xs: T[]): T[] => [...new Set(xs)]
const count = (v: unknown): number => Math.floor(num(v, 0, 0, 1e9))

function sanitizeLeagueResult(v: unknown): LeagueResult | null {
  if (!isRecord(v) || !isString(v.week) || !LEAGUE_TIERS.includes(v.tier as LeagueTier)) return null
  const move = v.move === 'up' || v.move === 'down' ? v.move : 'stay'
  return { week: v.week.slice(0, 12), tier: v.tier as LeagueTier, rank: Math.round(num(v.rank, 20, 1, 20)), points: count(v.points), move, coins: count(v.coins) }
}

function sanitizeMistake(v: unknown): MistakePuzzle | null {
  if (!isRecord(v) || !isShortString(v.id) || !isString(v.fen) || v.fen.length > 100 || !isString(v.best) || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(v.best)) return null
  return { id: v.id, fen: v.fen, best: v.best, played: str(v.played, '').slice(0, 10), swing: count(v.swing), opponent: str(v.opponent, '').slice(0, 60), date: str(v.date, '').slice(0, 40) }
}

function intRecord(raw: unknown, max: number): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(asRecord(raw)).slice(0, 400)) if (/^[\w:.-]{1,80}$/.test(k) && isInt(v)) out[k] = Math.min(max, v)
  return out
}

function strRecord(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(asRecord(raw)).slice(0, 200)) if (/^[\w:.-]{1,80}$/.test(k) && isString(v)) out[k] = v.slice(0, 20)
  return out
}

export function sanitizeJourney(raw: unknown): JourneyState {
  const d = createJourney()
  if (!isRecord(raw)) return d
  const season = asRecord(raw.season)
  const league = asRecord(raw.league)
  const nemesis = asRecord(raw.nemesis)
  const modes = asRecord(raw.modes)
  const learn = asRecord(raw.learn)
  const chest = asRecord(raw.chest)
  const shop = asRecord(raw.shop)
  const notify = asRecord(raw.notify)
  const plan = asRecord(learn.plan)
  const frames = uniq(arrayOf(raw.frames, isFrameId))
  const auras = uniq(arrayOf(raw.auras, isAuraId))
  return {
    version: 1,
    xp: count(raw.xp),
    totalXp: count(raw.totalXp),
    prestige: Math.round(num(raw.prestige, 0, 0, MAX_PRESTIGE)),
    lastGameDate: str(raw.lastGameDate, '').slice(0, 10),
    season: { index: Math.round(num(season.index, -1, -1, 10_000)), xp: count(season.xp), claimed: uniq(arrayOf(season.claimed, isInt)) },
    seasonHistory: (Array.isArray(raw.seasonHistory) ? raw.seasonHistory : [])
      .filter(isRecord)
      .map((h) => ({ index: Math.round(num(h.index, 0, 0, 10_000)), tier: Math.round(num(h.tier, 0, 0, 100)) }))
      .slice(-20),
    league: { week: str(league.week, '').slice(0, 12), tier: LEAGUE_TIERS.includes(league.tier as LeagueTier) ? (league.tier as LeagueTier) : 'bronze', points: count(league.points) },
    leagueHistory: (Array.isArray(raw.leagueHistory) ? raw.leagueHistory : []).map(sanitizeLeagueResult).filter((r): r is LeagueResult => r !== null).slice(-MAX_LEAGUE_HISTORY),
    skills: uniq(arrayOf(raw.skills, isSkillId)),
    frames,
    frame: isFrameId(raw.frame) && frames.includes(raw.frame) ? raw.frame : null,
    auras,
    aura: isAuraId(raw.aura) && auras.includes(raw.aura) ? raw.aura : null,
    titles: (Array.isArray(raw.titles) ? raw.titles : [])
      .filter((t): t is { id: string; name: string } => isRecord(t) && isShortString(t.id) && isShortString(t.name))
      .map((t) => ({ id: t.id, name: t.name }))
      .slice(0, 100),
    bondGifts: intRecord(raw.bondGifts, 5),
    collection: uniq(arrayOf(raw.collection, isShortString)),
    story: uniq(arrayOf(raw.story, isInt)),
    nemesis: { key: isShortString(nemesis.key) ? nemesis.key : null, since: str(nemesis.since, '').slice(0, 40), beaten: uniq(arrayOf(nemesis.beaten, isShortString)).slice(-100) },
    modes: {
      phases: uniq(arrayOf(modes.phases, isShortString)),
      powersWins: count(modes.powersWins),
      coopWins: count(modes.coopWins),
      defenseBest: count(modes.defenseBest),
      defenseRuns: count(modes.defenseRuns),
      positions: uniq(arrayOf(modes.positions, isShortString)),
      events: strRecord(modes.events),
      bulletBest: count(modes.bulletBest),
      bulletStreak: count(modes.bulletStreak),
      dreams: count(modes.dreams),
    },
    learn: {
      endgames: uniq(arrayOf(learn.endgames, isShortString)),
      mistakes: (Array.isArray(learn.mistakes) ? learn.mistakes : []).map(sanitizeMistake).filter((m): m is MistakePuzzle => m !== null).slice(-MAX_MISTAKES),
      solved: uniq(arrayOf(learn.solved, isShortString)).slice(-200),
      plan: isString(plan.start) && isString(plan.focus) ? { start: plan.start.slice(0, 10), focus: plan.focus.slice(0, 30) } : null,
      reportSeen: str(learn.reportSeen, '').slice(0, 12),
    },
    chest: { date: str(chest.date, '').slice(0, 10), streak: count(chest.streak) },
    shop: { date: str(shop.date, '').slice(0, 10), bought: uniq(arrayOf(shop.bought, isShortString)) },
    founder: bool(raw.founder, false),
    notify: { enabled: bool(notify.enabled, false), hour: Math.round(num(notify.hour, 18, 0, 23)) },
    referralPaid: count(raw.referralPaid),
  }
}
