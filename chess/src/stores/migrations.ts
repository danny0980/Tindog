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
export const PROFILE_VERSION = 2

/**
 * v1 → v2 (Grand Campaign, app 4.0): adds the campaign progress block and
 * tags every saved match with `bossId: null`. Everything else is carried over.
 */
const profileV1ToV2: MigrationStep = (data) => ({
  ...data,
  campaign: isRecord(data.campaign) ? data.campaign : { bosses: {}, relics: [], equipped: [], realmsCleared: [] },
  matches: Array.isArray(data.matches) ? data.matches.map((m: unknown) => (isRecord(m) ? { bossId: null, ...m } : m)) : [],
})

export const PROFILE_MIGRATIONS: Readonly<Partial<Record<number, MigrationStep>>> = {
  1: profileV1ToV2,
  // 2: profileV2ToV3 — add the next step here when the profile shape changes,
  // then bump PROFILE_VERSION.
}

export const migrateProfile = (raw: unknown): MigrationResult => runMigrations(raw, PROFILE_VERSION, PROFILE_MIGRATIONS)
