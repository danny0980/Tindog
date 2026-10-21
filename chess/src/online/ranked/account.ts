// Your account on the game server: who you are, sign-in and sign-out, and
// the magic-link landing (?signin=TOKEN in the address). Cloud saves hang off
// it (cloudSync.ts).
import { loadAppToken } from '../../native/appToken'
import { showToast } from '../../stores/toastStore'
import { createStore } from '../../utils/store'
import { type AccountUser, ApiError, type ServerConfig, api, unauthorizedListeners } from './api'

export type AccountState =
  | { status: 'loading' }
  /** No game server reachable (e.g. the app is hosted as static files only). */
  | { status: 'unavailable'; message: string }
  | { status: 'signed-out'; config: ServerConfig }
  | { status: 'signed-in'; config: ServerConfig; user: AccountUser }

export const accountStore = createStore<AccountState>({ status: 'loading' })

let started: Promise<void> | null = null

/** Loads the account once (call again to refresh after changes, e.g. a rating update). */
export function loadAccount(force = false): Promise<void> {
  if (started && !force) return started
  started = (async () => {
    try {
      await loadAppToken()
      const config = await api.config()
      // Arriving from a sign-in email: finish signing in, then drop the token from the address bar.
      const token = new URLSearchParams(window.location.search).get('signin')
      if (token) {
        const url = new URL(window.location.href)
        url.searchParams.delete('signin')
        window.history.replaceState(null, '', url.pathname + url.search + url.hash)
        try {
          const { user } = await api.verifyEmailLink(token)
          accountStore.set({ status: 'signed-in', config, user })
          showToast('success', `Signed in as ${user.name}`)
          return
        } catch (err) {
          showToast('warning', 'Sign-in link', err instanceof Error ? err.message : 'That link did not work.')
        }
      }
      const user = await api.me()
      accountStore.set(user ? { status: 'signed-in', config, user } : { status: 'signed-out', config })
    } catch (err) {
      accountStore.set({ status: 'unavailable', message: err instanceof ApiError ? err.message : "Can't reach the game server." })
    }
  })()
  return started
}

/** A signed-in user from any sign-in route. */
export function signedIn(user: AccountUser): void {
  const s = accountStore.get()
  const config = s.status === 'signed-out' || s.status === 'signed-in' ? s.config : { google: null, email: true, devLinks: false }
  accountStore.set({ status: 'signed-in', config, user })
}

/** Updates the cached user (new rating, new name). */
export function patchUser(user: AccountUser): void {
  const s = accountStore.get()
  if (s.status === 'signed-in') accountStore.set({ ...s, user })
}

/**
 * The server no longer accepts our sign-in (it expired, or the account was
 * deleted elsewhere): show it as signed out, which also closes the game
 * connection and stops cloud sync.
 */
export function sessionEnded(message = 'Your sign-in has expired. Please sign in again.'): void {
  const s = accountStore.get()
  if (s.status !== 'signed-in') return
  accountStore.set({ status: 'signed-out', config: s.config })
  showToast('warning', 'Signed out', message, 7000)
}
unauthorizedListeners.add(() => sessionEnded())

/** Deletes the account on the server, then signs out here (local progress on this device stays). */
export async function deleteAccount(): Promise<void> {
  const s = accountStore.get()
  await api.deleteAccount()
  if (s.status === 'signed-in') accountStore.set({ status: 'signed-out', config: s.config })
  showToast('info', 'Account deleted', 'Your online account and everything stored with it are gone. Progress on this device stays.', 7000)
}

export async function signOut(): Promise<void> {
  const s = accountStore.get()
  try {
    await api.logout()
  } finally {
    if (s.status === 'signed-in') accountStore.set({ status: 'signed-out', config: s.config })
  }
}
