import { useCallback, useEffect, useState } from 'react'

/**
 * Video-player style navigation through a game's plies. `viewPly === null`
 * means "live" (follow the latest move).
 */
export function useTimeMachine(length: number, resetKey: string | number, playbackMs = 900) {
  const [state, setState] = useState<{ key: string | number; ply: number | null; playing: boolean }>({
    key: resetKey,
    ply: null,
    playing: false,
  })
  const current = state.key === resetKey ? state : { key: resetKey, ply: null, playing: false }
  const viewPly = current.ply === null || current.ply >= length ? null : Math.max(0, current.ply)
  const displayPly = viewPly ?? length
  const playing = current.playing && viewPly !== null

  const goTo = useCallback(
    (ply: number | null) =>
      setState({ key: resetKey, ply: ply === null || ply >= length ? null : Math.max(0, ply), playing: false }),
    [length, resetKey],
  )

  const step = useCallback(
    (delta: number) =>
      setState((prev) => {
        const base = prev.key === resetKey && prev.ply !== null ? prev.ply : length
        const next = Math.max(0, Math.min(length, base + delta))
        return { key: resetKey, ply: next >= length ? null : next, playing: false }
      }),
    [length, resetKey],
  )

  const togglePlay = useCallback(
    () =>
      setState((prev) => {
        const base = prev.key === resetKey ? prev : { key: resetKey, ply: null, playing: false }
        if (base.playing) return { ...base, playing: false }
        // Restart from the beginning when already at the live position.
        return { key: resetKey, ply: base.ply === null ? 0 : base.ply, playing: true }
      }),
    [resetKey],
  )

  useEffect(() => {
    if (!playing) return
    const id = window.setTimeout(() => {
      setState((prev) => {
        if (prev.ply === null) return { ...prev, playing: false }
        const next = prev.ply + 1
        return next >= length ? { ...prev, ply: null, playing: false } : { ...prev, ply: next }
      })
    }, playbackMs)
    return () => window.clearTimeout(id)
  }, [length, playbackMs, playing, displayPly])

  return { viewPly, displayPly, isLive: viewPly === null, playing, goTo, step, togglePlay }
}

export type TimeMachine = ReturnType<typeof useTimeMachine>
