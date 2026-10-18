import { BatteryLow, BatteryMedium, Gauge, Grid3x3, Music, Smartphone, Sparkles, Trash2, Volume2, VolumeX } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { BOARD_THEMES, PIECE_SETS } from '../../constants/themes'
import { useStore } from '../../hooks/useStore'
import { profileStore, resetProfile } from '../../stores/profileStore'
import { settingsStore, updateSettings } from '../../stores/settingsStore'
import { showToast } from '../../stores/toastStore'
import { ThemeSwatch } from '../shop/ThemeSwatch'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Modal } from '../ui/Modal'
import { Toggle } from '../ui/Toggle'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
  onOpenShop: () => void
}

export function SettingsModal({ open, onClose, onOpenShop }: SettingsModalProps) {
  const settings = useStore(settingsStore, (s) => s)
  const profile = useStore(profileStore, (p) => p)
  const [confirmReset, setConfirmReset] = useState(false)

  return (
    <>
      <Modal open={open} title="Settings" onClose={onClose} size="md">
        <div className="space-y-6">
          <Section title="Profile">
            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">Display name</span>
              <input
                type="text"
                maxLength={24}
                defaultValue={profile.name}
                onBlur={(e) => {
                  const name = e.target.value.trim() || 'You'
                  profileStore.set((p) => ({ ...p, name }))
                }}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-accent"
              />
            </label>
          </Section>

          <Section title="Board theme">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {BOARD_THEMES.map((theme) => {
                const owned = profile.unlockedThemes.includes(theme.id)
                return (
                  <button
                    key={theme.id}
                    type="button"
                    disabled={!owned}
                    onClick={() => updateSettings({ boardTheme: theme.id })}
                    className={`rounded-xl border p-1.5 text-left transition ${
                      settings.boardTheme === theme.id ? 'border-accent bg-accent/10' : 'border-white/10 hover:border-white/25'
                    } disabled:opacity-40`}
                    title={owned ? theme.name : `${theme.name} — unlock in the shop`}
                  >
                    <ThemeSwatch theme={theme} />
                    <div className="mt-1 truncate text-[11px] font-semibold text-slate-200">{theme.name}</div>
                  </button>
                )
              })}
            </div>
          </Section>

          <Section title="Piece style">
            <div className="flex flex-wrap gap-2">
              {PIECE_SETS.map((set) => {
                const owned = profile.unlockedPieceSets.includes(set.id)
                return (
                  <button
                    key={set.id}
                    type="button"
                    disabled={!owned}
                    onClick={() => updateSettings({ pieceSet: set.id })}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                      settings.pieceSet === set.id ? 'border-accent bg-accent/15 text-white' : 'border-white/10 text-slate-300 hover:border-white/25'
                    } disabled:opacity-40`}
                  >
                    {set.name}
                  </button>
                )
              })}
            </div>
            <button type="button" onClick={onOpenShop} className="mt-2 text-xs font-semibold text-accent hover:underline">
              Unlock more in the shop →
            </button>
          </Section>

          <Section title="Audio & haptics">
            <div className="flex items-center gap-3 py-2">
              {settings.masterVolume === 0 ? <VolumeX className="size-5 text-slate-400" /> : <Volume2 className="size-5 text-slate-400" />}
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.masterVolume}
                onChange={(e) => updateSettings({ masterVolume: Number(e.target.value) })}
                className="flex-1"
                aria-label="Master volume"
              />
              <span className="w-10 text-right font-mono text-xs text-slate-400">{Math.round(settings.masterVolume * 100)}%</span>
            </div>
            <Toggle label="Sound effects" description="Material-based piece sounds and fanfares" icon={<Sparkles className="size-5" />} checked={settings.sfxEnabled} onChange={(v) => updateSettings({ sfxEnabled: v })} />
            <Toggle label="Ambient soundtrack" description="Adaptive generative music that follows the tension" icon={<Music className="size-5" />} checked={settings.musicEnabled} onChange={(v) => updateSettings({ musicEnabled: v })} />
            <Toggle label="Haptics" description="Vibration feedback on supported devices" icon={<Smartphone className="size-5" />} checked={settings.hapticsEnabled} onChange={(v) => updateSettings({ hapticsEnabled: v })} />
          </Section>

          <Section title="Board">
            <Toggle label="Advantage bar" description="Live Stockfish evaluation" icon={<Gauge className="size-5" />} checked={settings.showEvalBar} onChange={(v) => updateSettings({ showEvalBar: v })} />
            <Toggle label="Legal move hints" icon={<Sparkles className="size-5" />} checked={settings.showLegalMoves} onChange={(v) => updateSettings({ showLegalMoves: v })} />
            <Toggle label="Coordinates" icon={<Grid3x3 className="size-5" />} checked={settings.showCoordinates} onChange={(v) => updateSettings({ showCoordinates: v })} />
          </Section>

          <Section title="Performance">
            <Toggle
              label="Battery saver"
              description="Disables blur, particles, glow and music; lighter engine analysis"
              icon={<BatteryLow className="size-5" />}
              checked={settings.batterySaver}
              onChange={(v) => updateSettings({ batterySaver: v })}
            />
            <Toggle
              label="Automatic battery saver"
              description="Turn on when the battery drops below 20%"
              icon={<BatteryMedium className="size-5" />}
              checked={settings.autoBatterySaver}
              onChange={(v) => updateSettings({ autoBatterySaver: v })}
            />
          </Section>

          <Section title="Data">
            <Button variant="ghost" className="text-red-300" icon={<Trash2 className="size-4" />} onClick={() => setConfirmReset(true)}>
              Reset all progress
            </Button>
          </Section>
        </div>
      </Modal>
      <ConfirmDialog
        open={confirmReset}
        title="Reset progress?"
        message="This deletes your rating, match history, achievements, coins and unlocks. This cannot be undone."
        confirmLabel="Reset"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          resetProfile()
          updateSettings({ boardTheme: 'classic-wood', pieceSet: 'standard' })
          setConfirmReset(false)
          showToast('info', 'Progress reset')
        }}
      />
    </>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
      {children}
    </section>
  )
}
