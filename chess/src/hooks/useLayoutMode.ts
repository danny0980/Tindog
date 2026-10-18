import { useStore } from './useStore'
import { useMediaQuery } from './useMediaQuery'
import { settingsStore } from '../stores/settingsStore'

/** Shared layout decisions: desktop grid vs phone, and when the one-handed portrait layout is active. */
export function useLayoutMode(): { isDesktop: boolean; oneHanded: boolean; gestures: boolean } {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const portrait = useMediaQuery('(orientation: portrait)')
  const oneHandedSetting = useStore(settingsStore, (s) => s.oneHanded)
  const gesturesSetting = useStore(settingsStore, (s) => s.gesturesEnabled)
  return {
    isDesktop,
    // One-handed is a portrait layout; landscape phones and desktops use the standard grid.
    oneHanded: oneHandedSetting && !isDesktop && portrait,
    gestures: gesturesSetting && !isDesktop,
  }
}
