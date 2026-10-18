import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

export type HapticKind = 'tap' | 'move' | 'capture' | 'check' | 'success' | 'warning' | 'error'

let enabled = true

export function setHapticsEnabled(value: boolean): void {
  enabled = value
}

const WEB_PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 6,
  move: 12,
  capture: [18, 20, 12],
  check: [30, 40, 30],
  success: [20, 40, 60],
  warning: [40, 60, 40],
  error: [60, 40, 60],
}

/**
 * Native Taptic Engine / vibrator through Capacitor on devices; falls back to
 * the Vibration API on the web (silently ignored where unsupported, e.g. iOS Safari).
 */
export function haptic(kind: HapticKind): void {
  if (!enabled) return
  if (Capacitor.isNativePlatform()) {
    const task =
      kind === 'success'
        ? Haptics.notification({ type: NotificationType.Success })
        : kind === 'warning' || kind === 'check'
          ? Haptics.notification({ type: NotificationType.Warning })
          : kind === 'error'
            ? Haptics.notification({ type: NotificationType.Error })
            : Haptics.impact({ style: kind === 'capture' ? ImpactStyle.Medium : ImpactStyle.Light })
    void task.catch(() => undefined)
    return
  }
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(WEB_PATTERNS[kind])
  }
}
