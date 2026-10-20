// Cloud saves: while you are signed in, your progress (profile) and settings
// live on the game server too, so they follow you between devices.
//
// On sign-in: no cloud save yet → this device's progress is uploaded; the
// same save → nothing to do; a fresh device → the cloud save is restored;
// progress on both → you choose (never silently overwritten). After that,
// changes upload a few seconds after they happen.
import { createDefaultProfile, profileStore, sanitizeProfile } from '../../stores/profileStore'
import { sanitizeSettings, settingsStore } from '../../stores/settingsStore'
import { createStore } from '../../utils/store'
import { accountStore } from './account'
import { api } from './api'

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
}

const UPLOAD_DELAY_MS = 4000

const localBlob = (): SaveBlob => ({ version: 1, profile: profileStore.get(), settings: settingsStore.get() })

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

function stopWatching(): void {
  watching.forEach((off) => off())
  watching = []
  if (uploadTimer) clearTimeout(uploadTimer)
  uploadTimer = null
}

async function upload(): Promise<void> {
  if (accountStore.get().status !== 'signed-in') return
  syncStore.set({ status: 'syncing' })
  try {
    const { updatedAt } = await api.putSave(localBlob())
    syncStore.set({ status: 'synced', at: updatedAt })
  } catch (err) {
    syncStore.set({ status: 'error', message: err instanceof Error ? err.message : 'Cloud save failed.' })
  }
}

function watch(): void {
  stopWatching()
  const schedule = () => {
    if (applying) return
    if (uploadTimer) clearTimeout(uploadTimer)
    uploadTimer = setTimeout(() => void upload(), UPLOAD_DELAY_MS)
  }
  watching = [profileStore.subscribe(schedule), settingsStore.subscribe(schedule)]
}

function apply(blob: SaveBlob): void {
  applying = true
  try {
    profileStore.set(sanitizeProfile(blob.profile))
    if (blob.settings) settingsStore.set(sanitizeSettings(blob.settings))
  } finally {
    applying = false
  }
}

async function onSignedIn(): Promise<void> {
  syncStore.set({ status: 'syncing' })
  try {
    const cloud = await api.getSave()
    const data = cloud && isBlob(cloud.data) ? cloud.data : null
    if (!data) {
      await upload()
    } else if (JSON.stringify(data) === JSON.stringify(localBlob())) {
      syncStore.set({ status: 'synced', at: cloud?.updatedAt ?? Date.now() })
    } else if (isFresh()) {
      apply(data)
      syncStore.set({ status: 'synced', at: cloud?.updatedAt ?? Date.now() })
    } else {
      pendingCloud = data
      syncStore.set({ status: 'conflict', cloud: summarise(data.profile, cloud?.updatedAt ?? null), device: summarise(profileStore.get(), null) })
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
      syncStore.set({ status: 'off' })
    }
    wasSignedIn = signedIn
  }
  accountStore.subscribe(react)
  react()
}
