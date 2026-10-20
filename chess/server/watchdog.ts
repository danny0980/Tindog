// Production self-healing: a process that can no longer reach its database
// is useless, so after a few failed checks in a row it exits on purpose and
// the supervisor (Docker's restart policy, or systemd) starts a fresh one.
// Games in progress are saved on every move, so they come back after it.

export interface WatchdogDeps {
  /** True when the database answers. */
  healthy: () => boolean
  /** Called once, after `failures` failed checks in a row. */
  onDead: (reason: string) => void
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (h: unknown) => void
  everyMs?: number
  failures?: number
  log?: (line: string) => void
}

/** Starts checking; returns a stop function. */
export function startWatchdog(d: WatchdogDeps): () => void {
  const setTimer = d.setTimer ?? ((fn, ms) => {
    const t = setTimeout(fn, ms)
    t.unref()
    return t
  })
  const clearTimer = d.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>))
  const every = d.everyMs ?? 30_000
  const limit = d.failures ?? 3
  let failed = 0
  let timer: unknown = null
  let stopped = false
  const check = () => {
    if (stopped) return
    let ok = false
    try {
      ok = d.healthy()
    } catch {
      ok = false
    }
    failed = ok ? 0 : failed + 1
    if (!ok) d.log?.(`watchdog: the database did not answer (${failed}/${limit})`)
    if (failed >= limit) {
      stopped = true
      d.onDead(`the database did not answer ${limit} checks in a row`)
      return
    }
    timer = setTimer(check, every)
  }
  timer = setTimer(check, every)
  return () => {
    stopped = true
    if (timer !== null) clearTimer(timer)
  }
}
