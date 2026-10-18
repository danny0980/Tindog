import { CloudOff, RefreshCw, RotateCcw, TriangleAlert } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { allowLazyRetry } from '../utils/lazyWithRetry'
import { isChunkLoadError, isOnline } from '../utils/retry'

interface ErrorBoundaryProps {
  children: ReactNode
  /** 'app' fills the screen and can only reload; 'view' is inline and can also retry in place. */
  scope?: 'app' | 'view'
  /** Changing this value clears the error (e.g. navigating to another tab). */
  resetKey?: string | number
  /** Name shown in the fallback ("the Legends screen"). */
  label?: string
  /** Called once an error is caught (e.g. to close an optional overlay instead of showing the fallback). */
  onError?: (error: Error) => void
}

interface ErrorBoundaryState {
  error: Error | null
  offline: boolean
  /** resetKey the current error belongs to. */
  errorKey: string | number | undefined
}

/**
 * Catches render / lazy-load errors below it and shows a recovery screen
 * instead of a blank page. Chunk-download failures get an offline-aware
 * message and retry automatically when the connection comes back.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null, offline: false, errorKey: undefined }

  static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
    return { error: error instanceof Error ? error : new Error(String(error)), offline: !isOnline() }
  }

  /** Remember which resetKey failed; a new key (e.g. another tab) clears the error. */
  static getDerivedStateFromProps(props: ErrorBoundaryProps, state: ErrorBoundaryState): Partial<ErrorBoundaryState> | null {
    if (!state.error) return state.errorKey === props.resetKey ? null : { errorKey: props.resetKey }
    return state.errorKey === props.resetKey ? null : { error: null, errorKey: props.resetKey }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[ErrorBoundary:${this.props.scope ?? 'view'}]`, error, info.componentStack)
    this.props.onError?.(error)
  }

  override componentDidMount(): void {
    window.addEventListener('online', this.handleOnline)
    window.addEventListener('offline', this.handleOffline)
  }

  override componentDidUpdate(prev: ErrorBoundaryProps): void {
    // Navigating away and back clears the error; let failed screens download again.
    if (prev.resetKey !== this.props.resetKey) allowLazyRetry()
  }

  override componentWillUnmount(): void {
    window.removeEventListener('online', this.handleOnline)
    window.removeEventListener('offline', this.handleOffline)
  }

  private handleOnline = () => {
    this.setState({ offline: false })
    // A chunk that failed while offline is worth fetching again right away.
    if (this.state.error && isChunkLoadError(this.state.error) && this.props.scope !== 'app') this.retry()
  }

  private handleOffline = () => this.setState({ offline: true })

  private retry = () => {
    allowLazyRetry()
    this.setState({ error: null })
  }

  private reload = () => window.location.reload()

  override render(): ReactNode {
    const { error, offline } = this.state
    if (!error) return this.props.children
    const app = this.props.scope === 'app'
    const network = isChunkLoadError(error)
    const Icon = offline ? CloudOff : TriangleAlert
    const title = offline ? 'You’re offline' : network ? 'Couldn’t download this screen' : 'Something went wrong'
    const detail = offline
      ? 'Part of the app still needs to download. It will retry as soon as you’re back online — your progress is saved.'
      : network
        ? 'The connection dropped while loading. Try again, or reload the app — your progress is saved.'
        : `An unexpected error stopped ${this.props.label ?? 'this screen'}. Your progress is saved; reloading usually fixes it.`

    return (
      <div className={app ? 'flex min-h-dvh items-center justify-center bg-ink-950 p-6' : 'flex flex-1 items-center justify-center px-4 py-16'} role="alert">
        <div className="glass w-full max-w-sm rounded-3xl p-6 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-white/5 text-amber-300">
            <Icon className="size-7" />
          </div>
          <h2 className="font-display text-lg font-extrabold tracking-wide text-white">{title}</h2>
          <p className="mt-2 text-sm text-slate-300">{detail}</p>
          <div className="mt-5 flex flex-col gap-2">
            {!app && (
              <button
                type="button"
                onClick={this.retry}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-white/10"
              >
                <RotateCcw className="size-4" /> Try again
              </button>
            )}
            <button
              type="button"
              onClick={this.reload}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-accent to-accent-2 px-4 py-2.5 text-sm font-bold text-ink-950"
            >
              <RefreshCw className="size-4" /> Reload App
            </button>
          </div>
          {!network && import.meta.env.DEV && <pre className="mt-4 max-h-32 overflow-auto text-left text-[10px] text-red-300">{error.message}</pre>}
        </div>
      </div>
    )
  }
}
