import { Bot, Dices, Play, Users } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { DIFFICULTIES, TIME_CONTROLS } from '../constants/game'
import type { ColorChoice, GameMode, GameSettings } from '../types/chess'
import { Modal } from './Modal'

interface NewGameModalProps {
  open: boolean
  initialSettings: GameSettings
  onStart: (settings: GameSettings) => void
  onClose: () => void
}

export function NewGameModal({ open, initialSettings, onStart, onClose }: NewGameModalProps) {
  return (
    <Modal open={open} title="New game" onClose={onClose}>
      {/* Remount the form on every open so it starts from the latest settings. */}
      {open && <NewGameForm initialSettings={initialSettings} onStart={onStart} />}
    </Modal>
  )
}

function NewGameForm({ initialSettings, onStart }: Pick<NewGameModalProps, 'initialSettings' | 'onStart'>) {
  const [draft, setDraft] = useState<GameSettings>(initialSettings)
  const update = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }))

  const modes: ReadonlyArray<{ id: GameMode; label: string; hint: string; icon: ReactNode }> = [
    { id: 'ai', label: 'vs Computer', hint: 'Play Stockfish', icon: <Bot className="size-6" /> },
    { id: 'local', label: 'vs Friend', hint: 'Pass & play', icon: <Users className="size-6" /> },
  ]

  const colors: ReadonlyArray<{ id: ColorChoice; label: string; swatch: ReactNode }> = [
    { id: 'w', label: 'White', swatch: <span className="block size-5 rounded-full bg-slate-100 ring-2 ring-white/40" /> },
    { id: 'random', label: 'Random', swatch: <Dices className="size-5" /> },
    { id: 'b', label: 'Black', swatch: <span className="block size-5 rounded-full bg-slate-900 ring-2 ring-white/30" /> },
  ]

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault()
        onStart(draft)
      }}
    >
      <Field label="Game mode">
        <div className="grid grid-cols-2 gap-2">
          {modes.map((m) => (
            <OptionCard key={m.id} selected={draft.mode === m.id} onClick={() => update('mode', m.id)}>
              <div className="flex items-center gap-3">
                <span className={draft.mode === m.id ? 'text-emerald-300' : 'text-slate-400'}>{m.icon}</span>
                <div className="text-left">
                  <div className="text-sm font-semibold">{m.label}</div>
                  <div className="text-xs text-slate-400">{m.hint}</div>
                </div>
              </div>
            </OptionCard>
          ))}
        </div>
      </Field>

      {draft.mode === 'ai' && (
        <>
          <Field label="Difficulty">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DIFFICULTIES.map((d) => (
                <OptionCard key={d.id} selected={draft.difficulty === d.id} onClick={() => update('difficulty', d.id)}>
                  <div className="text-sm font-semibold">{d.label}</div>
                  <div className="text-[11px] text-slate-400">{d.elo}</div>
                </OptionCard>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {DIFFICULTIES.find((d) => d.id === draft.difficulty)?.description}
            </p>
          </Field>

          <Field label="Play as">
            <div className="grid grid-cols-3 gap-2">
              {colors.map((c) => (
                <OptionCard key={c.id} selected={draft.playerColor === c.id} onClick={() => update('playerColor', c.id)}>
                  <div className="flex flex-col items-center gap-1.5">
                    {c.swatch}
                    <span className="text-xs font-semibold">{c.label}</span>
                  </div>
                </OptionCard>
              ))}
            </div>
          </Field>
        </>
      )}

      <Field label="Time control">
        <div className="grid grid-cols-3 gap-2">
          {TIME_CONTROLS.map((tc) => (
            <OptionCard key={tc.id} selected={draft.timeControlId === tc.id} onClick={() => update('timeControlId', tc.id)}>
              <div className="font-mono text-sm font-bold">{tc.id === 'none' ? '∞' : tc.label}</div>
              <div className="text-[11px] capitalize text-slate-400">{tc.id === 'none' ? 'Untimed' : tc.category}</div>
            </OptionCard>
          ))}
        </div>
      </Field>

      <button
        type="submit"
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 px-4 py-3.5 text-base font-bold text-ink-950 shadow-[0_14px_40px_-12px_rgba(16,185,129,0.9)] transition hover:brightness-110 active:scale-[0.99]"
      >
        <Play className="size-5" fill="currentColor" /> Start game
      </button>
    </form>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</legend>
      {children}
    </fieldset>
  )
}

function OptionCard({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-xl border px-3 py-2.5 text-center transition duration-150 active:scale-[0.97] ${
        selected
          ? 'border-emerald-400/70 bg-emerald-400/10 text-white shadow-[0_0_0_1px_rgba(52,211,153,0.35)]'
          : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.06]'
      }`}
    >
      {children}
    </button>
  )
}
