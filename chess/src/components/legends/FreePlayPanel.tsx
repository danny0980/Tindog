import { Lock, Play } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { TIME_CATEGORY_LABELS, TIME_CONTROLS, resolveTimeControl } from '../../constants/game'
import { CAMPAIGNS, LEGEND_STRENGTHS, campaignLegends, getEpoch, getLegend, legendElo } from '../../data/legends'
import type { ColorChoice } from '../../types/chess'
import type { ChallengeOptions, LegendId, LegendStrength } from '../../types/legend'
import { Button } from '../ui/Button'
import { LegendPortrait } from './LegendPortrait'

interface FreePlayPanelProps {
  defeated: Partial<Record<LegendId, string>>
  selected: LegendId | null
  onSelect: (id: LegendId) => void
  onStart: (legendId: LegendId, options: ChallengeOptions) => void
}

/** Quick battle against any defeated character with custom strength and time control. */
export function FreePlayPanel({ defeated, selected, onSelect, onStart }: FreePlayPanelProps) {
  const [strength, setStrength] = useState<LegendStrength>('authentic')
  const [color, setColor] = useState<ColorChoice>('w')
  const [timeControlId, setTimeControlId] = useState('none')
  const [customMinutes, setCustomMinutes] = useState(10)
  const [customIncrement, setCustomIncrement] = useState(5)
  const legend = selected && defeated[selected] ? getLegend(selected) : null
  const custom = resolveTimeControl({ timeControlId: 'custom', customMinutes, customIncrementSeconds: customIncrement })

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <section className="glass rounded-3xl p-4">
        {CAMPAIGNS.map((campaign) => (
          <div key={campaign.id} className="mb-4 last:mb-0">
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">{campaign.name}</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {campaignLegends(campaign.id).map((l) => {
                const unlocked = Boolean(defeated[l.id])
                const active = selected === l.id
                return (
                  <button
                    key={l.id}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => onSelect(l.id)}
                    aria-pressed={active}
                    className={`flex items-center gap-2.5 rounded-2xl border p-2.5 text-left transition ${
                      active ? 'border-accent bg-accent/10' : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                    } disabled:cursor-not-allowed disabled:opacity-45`}
                  >
                    <LegendPortrait legendId={l.id} size="sm" locked={!unlocked} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-white">{l.shortName}</span>
                      <span className="block truncate text-[11px] text-slate-400">{unlocked ? getEpoch(l.epoch).name : 'Defeat in campaign'}</span>
                    </span>
                    {!unlocked && <Lock className="ml-auto size-3.5 shrink-0 text-slate-500" />}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </section>

      <section className="glass flex flex-col gap-4 rounded-3xl p-4">
        {legend ? (
          <>
            <div className="flex items-center gap-3">
              <LegendPortrait legendId={legend.id} size="lg" />
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent">{getEpoch(legend.epoch).name}</div>
                <div className="font-display text-xl font-extrabold text-white">{legend.name}</div>
                <div className="text-xs text-slate-400">
                  {legend.title} · ~{legendElo(legend, strength)}
                </div>
              </div>
            </div>
            <p className="text-sm text-slate-300">{legend.playstyle}</p>

            <Field label="Strength">
              <Segmented
                options={LEGEND_STRENGTHS.map((s) => ({ id: s.id, label: s.label }))}
                value={strength}
                onChange={setStrength}
              />
              <p className="mt-1 text-[11px] text-slate-500">{LEGEND_STRENGTHS.find((s) => s.id === strength)?.description}</p>
            </Field>
            <Field label="Play as">
              <Segmented
                options={[
                  { id: 'w', label: 'White' },
                  { id: 'random', label: 'Random' },
                  { id: 'b', label: 'Black' },
                ]}
                value={color}
                onChange={(v) => setColor(v === 'w' || v === 'b' ? v : 'random')}
              />
            </Field>
            <Field label="Time control">
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                {[...TIME_CONTROLS.map((t) => ({ id: t.id, label: t.id === 'none' ? '∞' : t.label, hint: TIME_CATEGORY_LABELS[t.category] })), { id: 'custom', label: custom.label, hint: 'Custom' }].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTimeControlId(t.id)}
                    aria-pressed={timeControlId === t.id}
                    className={`rounded-xl border px-2 py-1.5 text-center transition ${timeControlId === t.id ? 'border-accent bg-accent/15 text-white' : 'border-white/10 text-slate-300'}`}
                  >
                    <div className="font-mono text-xs font-bold">{t.label}</div>
                    <div className="text-[10px] text-slate-500">{t.hint}</div>
                  </button>
                ))}
              </div>
              {timeControlId === 'custom' && (
                <div className="mt-2 space-y-2 rounded-xl bg-white/[0.04] p-3">
                  <Slider label="Minutes" value={customMinutes} min={1} max={90} onChange={setCustomMinutes} display={`${customMinutes} min`} />
                  <Slider label="Increment" value={customIncrement} min={0} max={30} onChange={setCustomIncrement} display={`+${customIncrement} s`} />
                </div>
              )}
            </Field>
            <Button
              variant="primary"
              size="lg"
              className="mt-auto w-full"
              icon={<Play className="size-5" fill="currentColor" />}
              onClick={() =>
                onStart(legend.id, { color, timeControlId, strength, customMinutes, customIncrementSeconds: customIncrement })
              }
            >
              Start quick battle
            </Button>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center text-sm text-slate-400">
            <Lock className="size-6 text-slate-500" />
            {Object.keys(defeated).length === 0
              ? 'Defeat a legend in either campaign to unlock free play.'
              : 'Choose an unlocked character to set up a battle.'}
          </div>
        )}
      </section>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
      {children}
    </div>
  )
}

function Slider({ label, value, min, max, display, onChange }: { label: string; value: number; min: number; max: number; display: string; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-xs text-slate-300">
        {label} <span className="font-mono font-bold text-white">{display}</span>
      </span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
    </label>
  )
}

function Segmented<T extends string>({ options, value, onChange }: { options: ReadonlyArray<{ id: T; label: string }>; value: T; onChange: (v: T) => void }) {
  return (
    <div className="grid gap-1 rounded-xl bg-white/[0.05] p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-lg py-2 text-xs font-semibold transition ${value === o.id ? 'bg-accent text-ink-950' : 'text-slate-300 hover:text-white'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
