import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import type { HapticCategory, HapticIntensity, HapticSettings } from '../types/settings'

/** Semantic haptic events emitted by the app. */
export type HapticKind = 'pickup' | 'tap' | 'move' | 'capture' | 'check' | 'success' | 'warning' | 'error'

const CATEGORY: Record<HapticKind, HapticCategory> = {
  pickup: 'pickup',
  tap: 'ui',
  move: 'move',
  capture: 'capture',
  check: 'check',
  success: 'ui',
  warning: 'ui',
  error: 'ui',
}

let enabled = true
let levels: HapticSettings = { pickup: 'light', move: 'light', capture: 'medium', check: 'heavy', ui: 'light' }

export function configureHaptics(master: boolean, settings: HapticSettings): void {
  enabled = master
  levels = settings
}

const IMPACT: Record<Exclude<HapticIntensity, 'off'>, ImpactStyle> = {
  light: ImpactStyle.Light,
  medium: ImpactStyle.Medium,
  heavy: ImpactStyle.Heavy,
}

/** Vibration API pulse lengths (ms) per intensity for browsers / Android web. */
const PULSE: Record<Exclude<HapticIntensity, 'off'>, number> = { light: 8, medium: 18, heavy: 32 }

function webPattern(kind: HapticKind, intensity: Exclude<HapticIntensity, 'off'>): number | number[] {
  const p = PULSE[intensity]
  switch (kind) {
    case 'capture':
      return [p, 24, Math.round(p * 0.6)]
    case 'check':
      return [p, 40, p]
    case 'success':
      return [p, 40, p * 2]
    case 'warning':
    case 'error':
      return [p * 2, 50, p * 2]
    default:
      return p
  }
}

/** Optional debug sink (enabled with localStorage `chess-arena:debug-haptics` = '1'). */
const debug = (() => {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('chess-arena:debug-haptics') === '1'
  } catch {
    return false
  }
})()

/**
 * Fires a haptic for `kind` at the user's configured intensity for that
 * channel. Uses the native Taptic Engine / vibrator through Capacitor on
 * devices, and falls back to the Vibration API on the web (silently ignored
 * where unsupported, e.g. iOS Safari).
 */
export function haptic(kind: HapticKind, override?: HapticIntensity): void {
  const intensity = override ?? levels[CATEGORY[kind]]
  if (!enabled || intensity === 'off') return
  if (debug) console.debug('[haptic]', kind, intensity)

  if (Capacitor.isNativePlatform()) {
    const task =
      kind === 'success'
        ? Haptics.notification({ type: NotificationType.Success })
        : kind === 'warning'
          ? Haptics.notification({ type: NotificationType.Warning })
          : kind === 'error'
            ? Haptics.notification({ type: NotificationType.Error })
            : kind === 'pickup'
              ? Haptics.selectionStart().then(() => Haptics.selectionChanged()).then(() => Haptics.selectionEnd())
              : Haptics.impact({ style: IMPACT[intensity] })
    void task.catch(() => undefined)
    return
  }
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(webPattern(kind, intensity))
  }
}

/** True when this device can produce haptics at all (for the settings UI). */
export function hapticsSupported(): boolean {
  return Capacitor.isNativePlatform() || (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function')
}
