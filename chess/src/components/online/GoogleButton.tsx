import { useEffect, useRef, useState } from 'react'

// Google Identity Services (the official "Sign in with Google" button). The
// script loads only when the button is shown; the ID token it hands back is
// verified by our server, never trusted in the browser.

interface GoogleId {
  initialize: (opts: { client_id: string; callback: (r: { credential?: string }) => void; ux_mode?: 'popup'; auto_select?: boolean }) => void
  renderButton: (el: HTMLElement, opts: Record<string, string | number>) => void
}
type GoogleWindow = Window & { google?: { accounts?: { id?: GoogleId } } }

const SRC = 'https://accounts.google.com/gsi/client'
let loading: Promise<GoogleId> | null = null

function loadGoogle(): Promise<GoogleId> {
  loading ??= new Promise<GoogleId>((resolve, reject) => {
    const ready = () => {
      const id = (window as GoogleWindow).google?.accounts?.id
      if (id) resolve(id)
      else reject(new Error('Google sign-in did not load.'))
    }
    if ((window as GoogleWindow).google?.accounts?.id) return ready()
    const s = document.createElement('script')
    s.src = SRC
    s.async = true
    s.onload = ready
    s.onerror = () => {
      loading = null
      reject(new Error('Google sign-in could not load (offline or blocked).'))
    }
    document.head.appendChild(s)
  })
  return loading
}

export function GoogleButton({ clientId, onCredential }: { clientId: string; onCredential: (credential: string) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    loadGoogle()
      .then((id) => {
        if (cancelled || !box.current) return
        id.initialize({ client_id: clientId, ux_mode: 'popup', callback: (r) => r.credential && onCredential(r.credential) })
        id.renderButton(box.current, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', width: 280 })
      })
      .catch((err: unknown) => !cancelled && setError(err instanceof Error ? err.message : 'Google sign-in is unavailable.'))
    return () => {
      cancelled = true
    }
  }, [clientId, onCredential])
  return (
    <div>
      <div ref={box} className="min-h-10" data-google-button />
      {error && <p className="mt-1 text-[11px] text-amber-200">{error}</p>}
    </div>
  )
}
