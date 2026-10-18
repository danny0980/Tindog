// Versioned migrations for persisted data. Stored progress is never thrown
// away because of a version mismatch: older data is upgraded one step at a
// time (v1 → v2 → v3 …), and data written by a *newer* app version is kept
// and read best-effort by the sanitiser instead of being reset.
import { isRecord } from '../utils/validate'

export type JsonRecord = Record<string, unknown>
export type MigrationStep = (data: JsonRecord) => JsonRecord

export interface MigrationResult {
  /** Upgraded data, or null when the input isn't an object at all. */
  data: JsonRecord | null
  /** Version found in storage (null for non-objects). */
  fromVersion: number | null
  /** True when at least one step ran. */
  migrated: boolean
  /** True when the data comes from a newer app version than this one. */
  future: boolean
}

/**
 * Runs `steps[v]` (which upgrades v → v + 1) from the stored version up to
 * `current`. Data without a version is treated as v1 (pre-versioning saves).
 * A missing step stops the chain without discarding anything — the
 * sanitiser then fills gaps with defaults.
 */
export function runMigrations(raw: unknown, current: number, steps: Readonly<Partial<Record<number, MigrationStep>>>): MigrationResult {
  if (!isRecord(raw)) return { data: null, fromVersion: null, migrated: false, future: false }
  const stored = typeof raw.version === 'number' && Number.isInteger(raw.version) && raw.version >= 1 ? raw.version : 1
  if (stored > current) return { data: raw, fromVersion: stored, migrated: false, future: true }
  let data: JsonRecord = raw
  let version = stored
  while (version < current) {
    const step = steps[version]
    if (!step) break
    data = { ...step(data), version: version + 1 }
    version += 1
  }
  return { data, fromVersion: stored, migrated: version !== stored, future: false }
}

// ── Player profile ───────────────────────────────────────────────────────────

/** Current shape of the saved player profile. */
export const PROFILE_VERSION = 3

/**
 * v1 → v2 (Grand Campaign, app 4.0): adds the campaign progress block and
 * tags every saved match with `bossId: null`. Everything else is carried over.
 */
const profileV1ToV2: MigrationStep = (data) => ({
  ...data,
  campaign: isRecord(data.campaign) ? data.campaign : { bosses: {}, relics: [], equipped: [], realmsCleared: [] },
  matches: Array.isArray(data.matches) ? data.matches.map((m: unknown) => (isRecord(m) ? { bossId: null, ...m } : m)) : [],
})

/** Potions every existing player receives with the v3 upgrade. */
export const V3_STARTER_POTIONS = { 'time-elixir': 1, 'purge-potion': 1, 'trap-kit': 1 } as const

/**
 * v2 → v3 (Ultimate Edition, app 6.0): adds the potion inventory (with a
 * starter gift), Ironman, the world-map state, titles, the notebook, daily
 * tournaments and feat counters. Campaign progress and matches are untouched.
 */
const profileV2ToV3: MigrationStep = (data) => ({
  ...data,
  inventory: isRecord(data.inventory) ? data.inventory : { potions: { ...V3_STARTER_POTIONS } },
  ironman: isRecord(data.ironman) ? data.ironman : { enabled: false, since: null, wipes: 0, bestCleared: 0, realmsConquered: [], savedCampaign: null },
  world: isRecord(data.world) ? data.world : { cycle: '', events: [], bounties: [], resolved: [], purchases: [], completedBounties: [], blessings: [] },
  title: typeof data.title === 'string' ? data.title : null,
  notebook: isRecord(data.notebook) ? data.notebook : { notes: '' },
  tournament: isRecord(data.tournament) ? data.tournament : null,
  tournamentsWon: typeof data.tournamentsWon === 'number' ? data.tournamentsWon : 0,
})

export const PROFILE_MIGRATIONS: Readonly<Partial<Record<number, MigrationStep>>> = {
  1: profileV1ToV2,
  2: profileV2ToV3,
  // 3: profileV3ToV4 — add the next step here when the profile shape changes,
  // then bump PROFILE_VERSION.
}

export const migrateProfile = (raw: unknown): MigrationResult => runMigrations(raw, PROFILE_VERSION, PROFILE_MIGRATIONS)
