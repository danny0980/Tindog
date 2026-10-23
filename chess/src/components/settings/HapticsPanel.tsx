import { Crosshair, Crown, Hand, MousePointerClick, Smartphone, Sparkles, Vibrate } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import type { ReactNode } from 'react'
import { type HapticKind, haptic, hapticsSupported } from '../../audio/haptics'
import { DEFAULT_HAPTICS, HAPTIC_INTENSITIES, updateSettings } from '../../stores/settingsStore'
import type { AppSettings, HapticCategory, HapticIntensity, HapticSettings } from '../../types/settings'
import { Toggle } from '../ui/Toggle'
import { Section } from './Section'

const CATEGORIES: ReadonlyArray<{ id: HapticCategory; label: string; hint: string; icon: ReactNode; test: HapticKind }> = [
  { id: 'pickup', label: 'Piece pickup', hint: 'Selecting or lifting a piece', icon: <Hand className="size-5" />, test: 'pickup' },
  { id: 'move', label: 'Piece drop', hint: 'Every move landing', icon: <MousePointerClick className="size-5" />, test: 'move' },
  { id: 'capture', label: 'Captures', hint: 'Double pulse on takes', icon: <Crosshair className="size-5" />, test: 'capture' },
  { id: 'check', label: 'Check alerts', hint: 'Strong pulse when a king is attacked', icon: <Crown className="size-5" />, test: 'check' },
  { id: 'ui', label: 'Interface', hint: 'Gestures, rewards, errors', icon: <Sparkles className="size-5" />, test: 'success' },
]

const PRESETS: ReadonlyArray<{ id: string; label: string; value: HapticSettings }> = [
  { id: 'subtle', label: 'Subtle', value: { pickup: 'off', move: 'light', capture: 'light', check: 'medium', ui: 'off' } },
  { id: 'balanced', label: 'Balanced', value: DEFAULT_HAPTICS },
  { id: 'strong', label: 'Strong', value: { pickup: 'medium', move: 'medium', capture: 'heavy', check: 'heavy', ui: 'medium' } },
]

const LABELS: Record<HapticIntensity, string> = { off: 'Off', light: 'Light', medium: 'Med', heavy: 'Heavy' }

/** Per-channel vibration intensities with live test buttons. */
export function HapticsPanel({ settings }: { settings: AppSettings }) {
  const native = Capacitor.isNativePlatform()
  const supported = hapticsSupported()
  const set = (category: HapticCategory, intensity: HapticIntensity) => {
    updateSettings({ haptics: { ...settings.haptics, [category]: intensity } })
    if (settings.hapticsEnabled && intensity !== 'off') haptic(CATEGORIES.find((c) => c.id === category)?.test ?? 'tap', intensity)
  }

  return (
    <div className="space-y-5">
      <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs ${supported ? 'bg-emerald-400/10 text-emerald-200' : 'bg-orange-400/10 text-orange-200'}`}>
        <Smartphone className="size-4 shrink-0" />
        {native
          ? 'Native haptics via Capacitor (Taptic Engine / vibration motor).'
          : supported
            ? 'Browser Vibration API detected. Install the native app for richer Taptic feedback.'
            : 'This browser cannot vibrate (e.g. iOS Safari). Settings apply in the native app.'}
      </div>

      <Toggle label="Haptics" description="Master switch for all vibration" icon={<Vibrate className="size-5" />} checked={settings.hapticsEnabled} onChange={(v) => updateSettings({ hapticsEnabled: v })} />

      <Section title="Presets">
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((p) => {
            const active = Object.entries(p.value).every(([k, v]) => settings.haptics[k as HapticCategory] === v)
            return (
              <button
                key={p.id}
                type="button"
                disabled={!settings.hapticsEnabled}
                onClick={() => updateSettings({ haptics: p.value })}
                className={`rounded-xl border py-2 text-sm font-semibold transition disabled:opacity-40 ${active ? 'border-accent bg-accent/15 text-white' : 'border-white/10 text-slate-300'}`}
              >
                {p.label}
              </button>
            )
          })}
        </div>
      </Section>

      <Section title="Channels">
        <div className={`space-y-2 ${settings.hapticsEnabled ? '' : 'pointer-events-none opacity-40'}`}>
          {CATEGORIES.map((c) => (
            <div key={c.id} className="rounded-xl bg-white/[0.03] px-3 py-2.5">
              <div className="mb-2 flex items-center gap-3">
                <span className="text-slate-400">{c.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-white">{c.label}</div>
                  <div className="text-xs text-slate-500">{c.hint}</div>
                </div>
                <button
                  type="button"
                  onClick={() => haptic(c.test)}
                  className="rounded-lg px-2 py-1 text-xs font-semibold text-accent hover:bg-white/10 pointer-coarse:min-h-10 pointer-coarse:px-3"
                  aria-label={`Test ${c.label}`}
                >
                  Test
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1 rounded-lg bg-black/20 p-1" role="radiogroup" aria-label={`${c.label} intensity`}>
                {HAPTIC_INTENSITIES.map((level) => (
                  <button
                    key={level}
                    type="button"
                    role="radio"
                    aria-checked={settings.haptics[c.id] === level}
                    onClick={() => set(c.id, level)}
                    className={`rounded-md py-1.5 text-xs font-semibold transition pointer-coarse:min-h-10 ${
                      settings.haptics[c.id] === level ? 'bg-accent text-ink-950' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {LABELS[level]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}
