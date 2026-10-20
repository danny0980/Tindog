import { useCallback, useEffect, useRef, useState } from 'react'

/** A small fetch hook: data, error, reload. It loads again whenever `key` changes. */
export function useApi<T>(load: () => Promise<T>, key = ''): { data: T | null; error: string | null; reload: () => void } {
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  }, [load])
  const [state, setState] = useState<{ data: T | null; error: string | null; n: number }>({ data: null, error: null, n: 0 })
  const reload = useCallback(() => setState((s) => ({ ...s, n: s.n + 1 })), [])
  useEffect(() => {
    let alive = true
    loadRef.current()
      .then((data) => alive && setState((s) => ({ ...s, data, error: null })))
      .catch((err: unknown) => alive && setState((s) => ({ ...s, error: err instanceof Error ? err.message : 'Could not load.' })))
    return () => {
      alive = false
    }
  }, [state.n, key])
  return { data: state.data, error: state.error, reload }
}

