import { Download, History, Loader2, ShieldAlert, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useStore } from '../../hooks/useStore'
import { accountStore, deleteAccount } from '../../online/ranked/account'
import { api } from '../../online/ranked/api'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

/** Saves `data` as a JSON file in the browser's downloads. */
function downloadJson(data: unknown, name: string): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Your games and your data: the game history, a JSON export, and deleting the account. */
export function AccountDataPanel({ onOpenHistory }: { onOpenHistory: () => void }) {
  const account = useStore(accountStore, (a) => a)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  if (account.status !== 'signed-in') return null

  const exportData = () => {
    setExporting(true)
    setError(null)
    api
      .exportData()
      .then((data) => downloadJson(data, `chronos-chess-${account.user.name.replace(/[^\w-]+/g, '_')}-${new Date().toISOString().slice(0, 10)}.json`))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'The export failed.'))
      .finally(() => setExporting(false))
  }

  return (
    <section className="glass space-y-3 rounded-3xl p-5" data-account-data>
      <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">Your games and data</h3>
      <div className="grid gap-2 sm:grid-cols-3">
        <Button onClick={onOpenHistory} icon={<History className="size-4" />} data-open-history>
          Game history
        </Button>
        <Button onClick={exportData} disabled={exporting} icon={exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} data-export-data>
          Export my data
        </Button>
        <Button variant="ghost" onClick={() => setConfirming(true)} icon={<Trash2 className="size-4" />} className="text-red-200" data-delete-account>
          Delete account
        </Button>
      </div>
      <p className="text-[11px] text-slate-500">The export is a JSON file with your account, ratings, seasons, clan, cloud save and every online game.</p>
      {error && (
        <p className="text-xs text-red-200" role="alert">
          {error}
        </p>
      )}
      {confirming && <DeleteAccountModal name={account.user.name} onClose={() => setConfirming(false)} />}
    </section>
  )
}

function DeleteAccountModal({ name, onClose }: { name: string; onClose: () => void }) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ok = typed.trim() === 'DELETE'
  const confirm = () => {
    if (!ok || busy) return
    setBusy(true)
    setError(null)
    deleteAccount()
      .then(onClose)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'The account could not be deleted.')
        setBusy(false)
      })
  }
  return (
    <Modal
      open
      title="Delete your account?"
      onClose={busy ? () => {} : onClose}
      size="sm"
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Keep my account
          </Button>
          <Button variant="primary" onClick={confirm} disabled={!ok || busy} icon={busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} data-delete-confirm>
            Delete forever
          </Button>
        </div>
      }
    >
      <div className="space-y-3 py-2 text-sm text-slate-300">
        <p className="flex gap-2 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-red-100">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            This deletes <b>{name}</b> on the server for good: your sign-in, online ratings, seasons, clan membership and cloud save. Your opponents keep their games against you, without your name. Progress saved on this device stays.
          </span>
        </p>
        <p>Download your data first if you want a copy. Type DELETE to confirm.</p>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && confirm()}
          aria-label="Type DELETE to confirm"
          autoComplete="off"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 font-mono text-white outline-none focus:border-red-300/60"
          data-delete-input
        />
        {error && (
          <p className="text-xs text-red-200" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
