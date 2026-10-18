import { useEffect, useState } from 'react'
import { ambientMusic, audioEngine } from '../audio'
import { configureHaptics } from '../audio/haptics'
import { getBoardTheme } from '../constants/themes'
import { enginePool } from '../engine/enginePool'
import { settingsStore, updateSettings } from '../stores/settingsStore'
import { themeOverrideStore } from '../stores/themeOverrideStore'
import { showToast } from '../stores/toastStore'
import { useStore } from './useStore'

interface BatteryLike {
  level: number
  charging: boolean
  addEventListener: (type: 'levelchange' | 'chargingchange', listener: () => void) => void
  removeEventListener: (type: 'levelchange' | 'chargingchange', listener: () => void) => void
}

const hasGetBattery = (nav: Navigator): nav is Navigator & { getBattery: () => Promise<BatteryLike> } =>
  'getBattery' in nav && typeof (nav as Navigator & { getBattery?: unknown }).getBattery === 'function'

export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible')
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])
  return visible
}

/** True after `timeoutMs` without pointer/keyboard input. */
export function useIdle(timeoutMs: number): boolean {
  const [idle, setIdle] = useState(false)
  useEffect(() => {
    let timer = window.setTimeout(() => setIdle(true), timeoutMs)
    const onActivity = () => {
      window.clearTimeout(timer)
      setIdle(false)
      timer = window.setTimeout(() => setIdle(true), timeoutMs)
    }
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))
    return () => {
      window.clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, onActivity))
    }
  }, [timeoutMs])
  return idle
}

/**
 * Global side effects: theme CSS variables, audio settings, unlocking audio on
 * the first gesture, pausing work while backgrounded, idle throttling and the
 * automatic battery saver.
 */
export function useAppEnvironment(): { idle: boolean; visible: boolean } {
  const settings = useStore(settingsStore, (s) => s)
  const visible = usePageVisible()
  const idle = useIdle(45_000)
  // An epoch (Chronos Chess) can temporarily override the saved theme app-wide.
  const overrideTheme = useStore(themeOverrideStore, (t) => t)
  const theme = getBoardTheme(overrideTheme ?? settings.boardTheme)

  // Theme variables drive Tailwind's `accent` colours and the page background.
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--accent', theme.accent)
    root.style.setProperty('--accent-2', theme.accent2)
    root.style.setProperty('--app-bg', theme.background)
    root.dataset.theme = theme.id
    ambientMusic.setTexture(theme.musicTexture ?? 'default')
    // Status bar / notch / Dynamic Island area blends into the theme (pure black for OLED).
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.chromeColor)
  }, [theme])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('battery-saver', settings.batterySaver)
    root.classList.toggle('is-idle', idle)
    enginePool.idleTimeoutMs = settings.batterySaver ? 10_000 : 45_000
  }, [idle, settings.batterySaver])

  useEffect(() => {
    audioEngine.setVolume(settings.masterVolume)
    audioEngine.setMix({
      sfx: settings.sfxEnabled,
      sfxVolume: settings.sfxVolume,
      music: settings.musicEnabled,
      musicVolume: settings.musicVolume,
      ui: settings.uiSoundsEnabled,
      uiVolume: settings.uiVolume,
    })
  }, [
    settings.masterVolume,
    settings.musicEnabled,
    settings.musicVolume,
    settings.sfxEnabled,
    settings.sfxVolume,
    settings.uiSoundsEnabled,
    settings.uiVolume,
  ])

  useEffect(() => {
    configureHaptics(settings.hapticsEnabled, settings.haptics)
  }, [settings.haptics, settings.hapticsEnabled])

  // Browsers only allow audio after a user gesture.
  useEffect(() => {
    const unlock = () => {
      audioEngine.unlock()
      if (settingsStore.get().musicEnabled && !settingsStore.get().batterySaver) ambientMusic.start()
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  const musicActive = settings.musicEnabled && !settings.batterySaver && visible
  useEffect(() => {
    if (musicActive) {
      if (audioEngine.context) ambientMusic.start()
    } else {
      ambientMusic.stop()
    }
  }, [musicActive])

  useEffect(() => {
    if (visible) {
      audioEngine.ready()
    } else {
      enginePool.stopAll()
      audioEngine.suspend()
    }
  }, [visible])

  // Automatic battery saver when the device reports a low, discharging battery.
  const autoSaver = settings.autoBatterySaver
  useEffect(() => {
    if (!autoSaver || !hasGetBattery(navigator)) return
    let battery: BatteryLike | null = null
    let cancelled = false
    const check = () => {
      if (!battery) return
      const low = !battery.charging && battery.level <= 0.2
      if (low && !settingsStore.get().batterySaver) {
        updateSettings({ batterySaver: true })
        showToast('warning', 'Battery saver on', 'Effects reduced to save power.')
      }
    }
    navigator
      .getBattery()
      .then((b) => {
        if (cancelled) return
        battery = b
        check()
        b.addEventListener('levelchange', check)
        b.addEventListener('chargingchange', check)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
      battery?.removeEventListener('levelchange', check)
      battery?.removeEventListener('chargingchange', check)
    }
  }, [autoSaver])

  return { idle, visible }
}
