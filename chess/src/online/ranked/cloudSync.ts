// Cloud saves: while you are signed in, your progress (profile) and settings
// live on the game server too, so they follow you between devices.
//
// On sign-in: no cloud save yet → this device's progress is uploaded; the
// same save → nothing to do; a fresh device → the cloud save is restored;
// progress on both → you choose (never silently overwritten). After that,
// changes upload a few seconds after they happen.
//
// Two devices at once: every upload names the cloud save it started from
// (`base`). If another device saved in between, the server refuses (409)
// and sends the newer save, and you choose again. Coming back to the app
// also checks for a newer cloud save: it is taken quietly when this device
// has nothing unsaved, else you choose.
import { createDefaultProfile, profileStore, sanitizeProfile } from '../../stores/profileStore'
import { sanitizeSettings, settingsStore } from '../../stores/settingsStore'
import { journeyStore } from '../../journey/journeyStore'
import { sanitizeJourney } from '../../journey/state'
import { createStore } from '../../utils/store'
import { accountStore } from './account'
import { ApiError, api } from './api'

export interface SaveSummary {
  elo: number
  coins: number
  games: number
  updatedAt: number | null
}

export type SyncState =
  | { status: 'off' }
  | { status: 'syncing' }
  | { status: 'synced'; at: number }
  | { status: 'conflict'; cloud: SaveSummary; device: SaveSummary }
  | { status: 'error'; message: string }

export const syncStore = createStore<SyncState>({ status: 'off' })

interface SaveBlob {
  version: 1
  profile: unknown
  settings: unknown
  /** The Journey (level, season, league…); missing in saves from before it existed. */
  journey?: unknown
}

const UPLOAD_DELAY_MS = 4000

const localBlob = (): SaveBlob => ({ version: 1, profile: profileStore.get(), settings: settingsStore.get(), journey: journeyStore.get() })

const summarise = (profile: unknown, updatedAt: number | null): SaveSummary => {
  const p = sanitizeProfile(profile)
  return { elo: Math.round(p.elo), coins: p.coins, games: p.matches.length, updatedAt }
}

/** A device that has never really been played on. */
const isFresh = (): boolean => {
  const p = profileStore.get()
  const d = createDefaultProfile()
  return p.matches.length === 0 && Object.keys(p.achievements).length === 0 && p.coins === d.coins
}

const isBlob = (v: unknown): v is SaveBlob => typeof v === 'object' && v !== null && (v as SaveBlob).version === 1 && 'profile' in v

let pendingCloud: SaveBlob | null = null
let uploadTimer: ReturnType<typeof setTimeout> | null = null
let watching: Array<() => void> = []
/** Stops uploads while a cloud save is being applied (that change isn't news). */
let applying = false
/** The cloud save this device is in step with (its `updatedAt`; null = there was none). */
let base: number | null = null
/** Changes on this device that haven't reached the cloud yet. */
let dirty = false

function stopWatching(): void {
  watching.forEach((off) => off())
  watching = []
  if (uploadTimer) clearTimeout(uploadTimer)
  uploadTimer = null
}

/** Shows the choice between this device and a newer cloud save (uploads pause until it is made). */
function conflict(data: SaveBlob, updatedAt: number | null): void {
  stopWatching()
  pendingCloud = data
  pendingAt = updatedAt
  syncStore.set({ status: 'conflict', cloud: summarise(data.profile, updatedAt), device: summarise(profileStore.get(), null) })
}
let pendingAt: number | null = null

async function upload(): Promise<void> {
  if (accountStore.get().status !== 'signed-in') return
  syncStore.set({ status: 'syncing' })
  try {
    const { updatedAt } = await api.putSave(localBlob(), base)
    base = updatedAt
    dirty = false
    syncStore.set({ status: 'synced', at: updatedAt })
  } catch (err) {
    // Another device saved since we last synced: never overwrite it silently.
    const cloud = err instanceof ApiError && err.status === 409 ? (err.body as { cloud?: { data?: unknown; updatedAt?: unknown } } | null)?.cloud : undefined
    if (cloud && isBlob(cloud.data)) return conflict(cloud.data, typeof cloud.updatedAt === 'number' ? cloud.updatedAt : null)
    syncStore.set({ status: 'error', message: err instanceof Error ? err.message : 'Cloud save failed.' })
  }
}

/** Back in the app: is there a newer cloud save from another device? */
async function checkForNewer(): Promise<void> {
  const st = syncStore.get().status
  if (accountStore.get().status !== 'signed-in' || st === 'conflict' || st === 'syncing' || st === 'off') return
  try {
    const cloud = await api.getSave()
    if (!cloud || cloud.updatedAt === base || !isBlob(cloud.data)) return
    if (dirty) return conflict(cloud.data, cloud.updatedAt)
    apply(cloud.data)
    base = cloud.updatedAt
    syncStore.set({ status: 'synced', at: cloud.updatedAt })
  } catch {
    // Offline for a moment: the next upload will find out.
  }
}

function watch(): void {
  stopWatching()
  const schedule = () => {
    if (applying) return
    dirty = true
    if (uploadTimer) clearTimeout(uploadTimer)
    uploadTimer = setTimeout(() => void upload(), UPLOAD_DELAY_MS)
  }
  watching = [profileStore.subscribe(schedule), settingsStore.subscribe(schedule), journeyStore.subscribe(schedule)]
}

function apply(blob: SaveBlob): void {
  applying = true
  try {
    profileStore.set(sanitizeProfile(blob.profile))
    if (blob.settings) settingsStore.set(sanitizeSettings(blob.settings))
    if (blob.journey) journeyStore.set(sanitizeJourney(blob.journey))
  } finally {
    applying = false
  }
}

async function onSignedIn(): Promise<void> {
  syncStore.set({ status: 'syncing' })
  try {
    const cloud = await api.getSave()
    const data = cloud && isBlob(cloud.data) ? cloud.data : null
    base = cloud?.updatedAt ?? null
    if (!data) {
      await upload()
    } else if (JSON.stringify(data) === JSON.stringify(localBlob())) {
      syncStore.set({ status: 'synced', at: cloud?.updatedAt ?? Date.now() })
    } else if (isFresh()) {
      apply(data)
      syncStore.set({ status: 'synced', at: cloud?.updatedAt ?? Date.now() })
    } else {
      conflict(data, cloud?.updatedAt ?? null)
      return
    }
    watch()
  } catch (err) {
    syncStore.set({ status: 'error', message: err instanceof Error ? err.message : 'Cloud save failed.' })
  }
}

/** Settles a conflict: keep this device's progress (and upload it), or take the cloud's. */
export async function resolveConflict(keep: 'device' | 'cloud'): Promise<void> {
  if (syncStore.get().status !== 'conflict') return
  if (keep === 'cloud' && pendingCloud) apply(pendingCloud)
  pendingCloud = null
  // Either way we now build on the newest cloud save, so this upload is accepted.
  base = pendingAt
  pendingAt = null
  await upload()
  watch()
}

let started = false

/** Starts cloud sync: follows sign-in and sign-out. */
export function startCloudSync(): void {
  if (started) return
  started = true
  let wasSignedIn = false
  const react = () => {
    const signedIn = accountStore.get().status === 'signed-in'
    if (signedIn && !wasSignedIn) void onSignedIn()
    if (!signedIn && wasSignedIn) {
      stopWatching()
      pendingCloud = null
      base = null
      dirty = false
      syncStore.set({ status: 'off' })
    }
    wasSignedIn = signedIn
  }
  accountStore.subscribe(react)
  react()
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void checkForNewer())
}
