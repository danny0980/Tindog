// One-shot post-processing bursts via the Web Animations API, so the element
// (a board, a canvas) is never remounted to restart a CSS animation.

export type FxBurst = 'chroma' | 'bloom' | 'quake'

const BURSTS: Readonly<Record<FxBurst, { frames: Keyframe[]; duration: number }>> = {
  chroma: {
    frames: [
      { filter: 'url(#fx-chromatic)', transform: 'translate3d(-3px,0,0)' },
      { filter: 'url(#fx-chromatic)', transform: 'translate3d(3px,0,0)', offset: 0.3 },
      { filter: 'url(#fx-chromatic)', transform: 'translate3d(-1px,0,0)', offset: 0.6 },
      { filter: 'url(#fx-chromatic)', transform: 'none', offset: 0.99 },
      { filter: 'none', transform: 'none' },
    ],
    duration: 560,
  },
  bloom: {
    frames: [{ filter: 'url(#fx-bloom)' }, { filter: 'url(#fx-bloom)', offset: 0.99 }, { filter: 'none' }],
    duration: 700,
  },
  quake: {
    frames: [
      { transform: 'none' },
      { transform: 'translate3d(-6px,2px,0) rotate(-0.4deg)', offset: 0.15 },
      { transform: 'translate3d(6px,-2px,0) rotate(0.4deg)', offset: 0.3 },
      { transform: 'translate3d(-4px,1px,0)', offset: 0.45 },
      { transform: 'translate3d(4px,-1px,0)', offset: 0.6 },
      { transform: 'translate3d(-2px,0,0)', offset: 0.8 },
      { transform: 'none' },
    ],
    duration: 520,
  },
}

/** Plays a burst on `el` (no-op where the Web Animations API is unavailable). */
export function playFx(el: Element | null, burst: FxBurst): void {
  if (!el || typeof el.animate !== 'function') return
  const { frames, duration } = BURSTS[burst]
  el.animate(frames, { duration, easing: 'linear' })
}
