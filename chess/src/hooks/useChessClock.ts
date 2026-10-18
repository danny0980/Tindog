import { useCallback, useEffect, useRef, useState } from 'react'
import type { ClockTimes, Color, TimeControl } from '../types/chess'

const TICK_MS = 100

interface UseChessClockOptions {
  timeControl: TimeControl
  activeColor: Color
  running: boolean
  onFlag: (color: Color) => void
}

const initialTimes = (tc: TimeControl): ClockTimes => ({ w: tc.initialMs, b: tc.initialMs })

/**
 * Drift-free chess clock: elapsed time is measured with performance.now()
 * rather than by counting interval ticks, so background-tab throttling or a
 * busy main thread never makes the clock run slow.
 */
export function useChessClock({ timeControl, activeColor, running, onFlag }: UseChessClockOptions) {
  const enabled = timeControl.initialMs > 0
  const [times, setTimes] = useState<ClockTimes>(() => initialTimes(timeControl))
  const timesRef = useRef(times)
  const onFlagRef = useRef(onFlag)

  useEffect(() => {
    timesRef.current = times
  }, [times])

  useEffect(() => {
    onFlagRef.current = onFlag
  }, [onFlag])

  useEffect(() => {
    if (!enabled || !running) return
    let last = performance.now()
    let flagged = false

    const tick = () => {
      const now = performance.now()
      const delta = now - last
      last = now
      setTimes((prev) => {
        const remaining = Math.max(0, prev[activeColor] - delta)
        if (remaining === 0 && !flagged) {
          flagged = true
          queueMicrotask(() => onFlagRef.current(activeColor))
        }
        return { ...prev, [activeColor]: remaining }
      })
    }

    const id = window.setInterval(tick, TICK_MS)
    return () => {
      window.clearInterval(id)
      // Account for the partial tick between the last interval and the move.
      if (!flagged) tick()
    }
  }, [enabled, running, activeColor])

  const addIncrement = useCallback(
    (color: Color) => {
      if (!enabled || timeControl.incrementMs === 0) return
      setTimes((prev) => ({ ...prev, [color]: prev[color] + timeControl.incrementMs }))
    },
    [enabled, timeControl.incrementMs],
  )

  const reset = useCallback((tc: TimeControl) => setTimes(initialTimes(tc)), [])
  const restore = useCallback((snapshot: ClockTimes) => setTimes(snapshot), [])
  const getTimes = useCallback((): ClockTimes => timesRef.current, [])

  return { times, enabled, addIncrement, reset, restore, getTimes }
}
