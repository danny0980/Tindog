import { Bot, Brain, Castle, Crosshair, Dices, Play, Scale, Shield, Swords, Users } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { DIFFICULTIES, DIFFICULTY_CONFIGS, PERSONALITIES, TIME_CATEGORY_LABELS, TIME_CONTROLS, resolveTimeControl } from '../../constants/game'
import type { ColorChoice, GameMode, GameSettings, Personality } from '../../types/chess'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { LegendPortrait } from '../legends/LegendPortrait'
import { LEGENDS, LEGEND_STRENGTHS, getEpoch } from '../../data/legends'
import { useStore } from '../../hooks/useStore'
import { profileStore } from '../../stores/profileStore'

interface NewGameModalProps {
  open: boolean
  initialSettings: GameSettings
  onStart: (settings: GameSettings) => void
  onClose: () => void
}

const PERSONALITY_ICONS: Record<Personality, ReactNode> = {
  balanced: <Scale className="size-5" />,
  aggressive: <Swords className="size-5" />,
  defensive: <Shield className="size-5" />,
  tactical: <Crosshair className="size-5" />,
  positional: <Castle className="size-5" />,
}

export function NewGameModal({ open, initialSettings, onStart, onClose }: NewGameModalProps) {
  return (
    <Modal open={open} title="New game" onClose={onClose} size="lg">
      {/* Remount the form on every open so it starts from the latest settings. */}
      {open && <NewGameForm initialSettings={initialSettings} onStart={onStart} />}
    </Modal>
  )
}

function NewGameForm({ initialSettings, onStart }: Pick<NewGameModalProps, 'initialSettings' | 'onStart'>) {
  // Campaign bosses are launched from the world map; a new game from here never continues one.
  const [draft, setDraft] = useState<GameSettings>(() => ({ ...initialSettings, bossId: null, classicId: null }))
  const defeated = useStore(profileStore, (p) => p.legends.defeated)
  const unlockedLegends = LEGENDS.filter((l) => defeated[l.id])
  const update = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => setDraft((prev) => ({ ...prev, [key]: value }))

  const modes: ReadonlyArray<{ id: GameMode; label: string; hint: string; icon: ReactNode }> = [
    { id: 'ai', label: 'vs Computer', hint: 'Rated vs Stockfish', icon: <Bot className="size-6" /> },
    { id: 'local', label: 'vs Friend', hint: 'Pass & play', icon: <Users className="size-6" /> },
  ]
  const colors: ReadonlyArray<{ id: ColorChoice; label: string; swatch: ReactNode }> = [
    { id: 'w', label: 'White', swatch: <span className="block size-5 rounded-full bg-slate-100 ring-2 ring-white/40" /> },
    { id: 'random', label: 'Random', swatch: <Dices className="size-5" /> },
    { id: 'b', label: 'Black', swatch: <span className="block size-5 rounded-full bg-slate-900 ring-2 ring-white/30" /> },
  ]
  const custom = resolveTimeControl({ ...draft, timeControlId: 'custom' })

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
            <OptionCard key={m.id} selected={draft.mode === m.id} onClick={() => setDraft((prev) => ({ ...prev, mode: m.id, legendId: m.id === 'local' ? null : prev.legendId }))}>
              <div className="flex items-center gap-3">
                <span className={draft.mode === m.id ? 'text-accent' : 'text-slate-400'}>{m.icon}</span>
                <div className="text-left">
                  <div className="text-sm font-semibold">{m.label}</div>
                  <div className="text-xs text-slate-400">{m.hint}</div>
                </div>
              </div>
            </OptionCard>
          ))}
        </div>
      </Field>

      {draft.mode === 'ai' && unlockedLegends.length > 0 && (
        <Field label="Legend opponents">
          <div className="grid gap-2 sm:grid-cols-2">
            {unlockedLegends.map((legend) => (
              <OptionCard
                key={legend.id}
                selected={draft.legendId === legend.id}
                onClick={() => update('legendId', draft.legendId === legend.id ? null : legend.id)}
              >
                <div className="flex items-center gap-3 text-left">
                  <LegendPortrait legendId={legend.id} size="sm" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{legend.name}</div>
                    <div className="truncate text-[11px] text-slate-400">
                      {getEpoch(legend.epoch).name} · ~{legend.elo}
                    </div>
                  </div>
                </div>
              </OptionCard>
            ))}
          </div>
          {draft.legendId && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {LEGEND_STRENGTHS.map((s) => (
                <OptionCard key={s.id} selected={draft.legendStrength === s.id} onClick={() => update('legendStrength', s.id)}>
                  <div className="text-sm font-semibold">{s.label}</div>
                  <div className="text-[10px] text-slate-400">{s.eloOffset === 0 ? 'campaign' : `${s.eloOffset > 0 ? '+' : ''}${s.eloOffset} Elo`}</div>
                </OptionCard>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-slate-500">Defeated legends from both campaigns can be re-challenged here. Tap again to clear.</p>
        </Field>
      )}

      {draft.mode === 'ai' && !draft.legendId && (
        <>
          <Field label="Difficulty">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DIFFICULTIES.map((d) => (
                <OptionCard key={d.id} selected={draft.difficulty === d.id} onClick={() => update('difficulty', d.id)}>
                  <div className="text-sm font-semibold">{d.label}</div>
                  <div className="font-mono text-[11px] text-slate-400">~{DIFFICULTY_CONFIGS[d.id].elo}</div>
                </OptionCard>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">{DIFFICULTIES.find((d) => d.id === draft.difficulty)?.description}</p>
          </Field>

          <Field label="AI personality">
            <div className="grid gap-2 sm:grid-cols-2">
              {PERSONALITIES.map((p) => (
                <OptionCard key={p.id} selected={draft.personality === p.id} onClick={() => update('personality', p.id)}>
                  <div className="flex items-center gap-3 text-left">
                    <span className={draft.personality === p.id ? 'text-accent' : 'text-slate-400'}>{PERSONALITY_ICONS[p.id]}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{p.name}</div>
                      <div className="text-[11px] leading-snug text-slate-400">{p.tagline}</div>
                    </div>
                  </div>
                </OptionCard>
              ))}
            </div>
          </Field>

        </>
      )}

      {draft.mode === 'ai' && (
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
      )}

      <Field label="Time control">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {TIME_CONTROLS.map((tc) => (
            <OptionCard key={tc.id} selected={draft.timeControlId === tc.id} onClick={() => update('timeControlId', tc.id)}>
              <div className="font-mono text-sm font-bold">{tc.id === 'none' ? '∞' : tc.label}</div>
              <div className="text-[11px] text-slate-400">{TIME_CATEGORY_LABELS[tc.category]}</div>
            </OptionCard>
          ))}
          <OptionCard selected={draft.timeControlId === 'custom'} onClick={() => update('timeControlId', 'custom')}>
            <div className="font-mono text-sm font-bold">{custom.label}</div>
            <div className="text-[11px] text-slate-400">Custom</div>
          </OptionCard>
        </div>
        {draft.timeControlId === 'custom' && (
          <div className="mt-3 space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <Slider
              label="Minutes per side"
              value={draft.customMinutes}
              min={1}
              max={90}
              step={1}
              display={`${draft.customMinutes} min`}
              onChange={(v) => update('customMinutes', v)}
            />
            <Slider
              label="Fischer increment"
              value={draft.customIncrementSeconds}
              min={0}
              max={30}
              step={1}
              display={`+${draft.customIncrementSeconds} s`}
              onChange={(v) => update('customIncrementSeconds', v)}
            />
            <p className="text-xs text-slate-500">
              Plays as <span className="font-semibold text-accent">{TIME_CATEGORY_LABELS[custom.category]}</span>.
            </p>
          </div>
        )}
      </Field>

      <Button type="submit" variant="primary" size="lg" className="w-full" icon={<Play className="size-5" fill="currentColor" />}>
        Start game
      </Button>
      {draft.mode === 'ai' && (
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
          <Brain className="size-3.5" /> Rated game — takebacks make it casual.
        </p>
      )}
    </form>
  )
}

function Slider({ label, value, min, max, step, display, onChange }: { label: string; value: number; min: number; max: number; step: number; display: string; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-xs text-slate-300">
        {label} <span className="font-mono font-bold text-white">{display}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
    </label>
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
      className={`w-full rounded-xl border px-3 py-2.5 text-center transition duration-150 active:scale-[0.97] ${
        selected
          ? 'border-accent/70 bg-accent/10 text-white shadow-[0_0_0_1px_var(--accent)]'
          : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.06]'
      }`}
    >
      {children}
    </button>
  )
}
