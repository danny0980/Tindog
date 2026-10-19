// The DOM layer of the film — title, tagline, light-ray lock, the glass menu,
// mode chips and "Tap to begin" — as a pure function of film time. The React
// component applies it to the elements every frame without re-rendering.
import { FILM_LENGTH, T, TITLE, clamp01, easeInOut, easeOut, easeOutBack, letterLands, progress } from './timeline'

export interface OverlayState {
  /** Per title letter: opacity and the brief glow as its grains land. */
  letters: Array<{ opacity: number; glow: number }>
  title: { opacity: number; lift: number; scale: number }
  tagline: { opacity: number; tracking: number }
  /** Light-ray sweep position across the title (0 → 1), and its strength. */
  sweep: { at: number; strength: number }
  /** The horizontal light ray that locks the title. */
  ray: { width: number; opacity: number }
  /** The frosted glass panel of the live menu. */
  glass: number
  /** Blur on the 3D world behind the menu (px). */
  worldBlur: number
  chips: Array<{ opacity: number; rise: number }>
  tap: number
  /** Whether "Skip" is offered. */
  skip: boolean
  /** Whether the menu takes clicks. */
  live: boolean
}

export function overlayAt(t: number): OverlayState {
  const lift = easeInOut(progress(t, T.menu, T.menu + 1.0))
  return {
    letters: Array.from(TITLE, (_, i) => {
      const land = letterLands(i)
      return {
        opacity: easeOut(progress(t, land - 0.12, land + 0.32)),
        glow: t < land - 0.12 ? 0 : Math.exp(-Math.max(0, t - land) * 3.2) * clamp01((t - land + 0.12) * 8),
      }
    }),
    title: { opacity: 1, lift, scale: 1 - 0.3 * lift },
    tagline: { opacity: easeOut(progress(t, T.tagline, T.tagline + 0.5)), tracking: 0.95 - 0.5 * easeOut(progress(t, T.tagline, T.lock + 0.4)) },
    sweep: { at: easeInOut(progress(t, T.lock - 0.05, T.lock + 0.65)), strength: t < T.lock - 0.05 ? 0 : 1 - progress(t, T.lock + 0.5, T.lock + 0.9) },
    ray: { width: easeOut(progress(t, T.lock - 0.05, T.lock + 0.35)), opacity: t < T.lock - 0.05 ? 0 : 1 - progress(t, T.lock + 0.25, T.lock + 1.1) },
    glass: easeInOut(progress(t, T.menu, T.menu + 1.1)),
    worldBlur: 7 * easeInOut(progress(t, T.menu + 0.2, T.menu + 1.4)),
    chips: T.chips.map((at) => {
      const k = progress(t, at, at + 0.55)
      return { opacity: easeOut(clamp01(k * 1.6)), rise: 1 - easeOutBack(k) }
    }),
    tap: easeOut(progress(t, T.tapToBegin, T.tapToBegin + 0.6)),
    skip: t >= T.skipAfter && t < T.skipTo,
    live: t >= T.chips[0] && t <= FILM_LENGTH + 1e9,
  }
}
