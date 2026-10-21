// Where the app runs: the website (served by the game server itself), or the
// iOS / Android app (Capacitor), whose pages are bundled inside the app and
// talk to the game server at the address it was built with.
import { Capacitor } from '@capacitor/core'

/** Running inside the iOS or Android app. */
export const isNativeApp = (): boolean => Capacitor.isNativePlatform()

/** The game server for the apps, from the build: VITE_SERVER_URL=https://chess.example.com. */
const SERVER_URL = (import.meta.env.VITE_SERVER_URL ?? '').replace(/\/+$/, '')

/** Prefix for API calls: same origin on the website, the game server's address in the apps. */
export const apiOrigin = (): string => (isNativeApp() ? SERVER_URL : '')

/** The apps were built without a game server address (online play is then off). */
export const appHasNoServer = (): boolean => isNativeApp() && SERVER_URL === ''

/** The ranked-play socket's address. */
export function socketUrl(): string {
  if (isNativeApp()) return `${SERVER_URL.replace(/^http/, 'ws')}/ws`
  return `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`
}
