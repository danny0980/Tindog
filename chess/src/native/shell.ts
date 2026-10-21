// The iOS / Android app's frame around the game: the dark status bar, the
// launch screen (hidden once the app has drawn), and Android's back button.
// Does nothing on the website.
import { App } from '@capacitor/app'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { isNativeApp } from './platform'

const BACKGROUND = '#0b0d12'

/** Sets up the app's frame (call once, after the first render). */
export function startNativeShell(): void {
  if (!isNativeApp()) return
  void StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
  void StatusBar.setBackgroundColor({ color: BACKGROUND }).catch(() => {}) // Android only
  void SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {})
}

/**
 * Android's back button: closes an open dialog first (as Escape does), then
 * `goBack` gets its turn (another screen → the board), and on the board it
 * leaves the app.
 */
export function onBackButton(goBack: () => boolean): () => void {
  if (!isNativeApp()) return () => {}
  const handle = App.addListener('backButton', () => {
    if (document.querySelector('[role="dialog"]')) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      return
    }
    if (!goBack()) void App.minimizeApp().catch(() => void App.exitApp())
  })
  return () => void handle.then((h) => h.remove())
}
