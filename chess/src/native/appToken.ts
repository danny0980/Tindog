// The iOS / Android app's sign-in: the session token the server hands it
// (the app can't use the website's cookie). Kept with Capacitor Preferences
// (the system's own key-value store, which survives app updates), and held
// in memory for every request. The website never uses this.
import { Preferences } from '@capacitor/preferences'
import { isNativeApp } from './platform'

const KEY = 'chronos.session'
let token: string | null = null

/** Reads the saved token (call once at start-up, before the account loads). */
export async function loadAppToken(): Promise<void> {
  if (!isNativeApp()) return
  try {
    token = (await Preferences.get({ key: KEY })).value
  } catch {
    token = null
  }
}

export const appToken = (): string | null => token

export function setAppToken(next: string | null): void {
  if (!isNativeApp() || next === token) return
  token = next
  void (next ? Preferences.set({ key: KEY, value: next }) : Preferences.remove({ key: KEY })).catch(() => {})
}
