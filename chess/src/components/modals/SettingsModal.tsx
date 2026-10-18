import {
  Clapperboard,
  BatteryLow,
  BatteryMedium,
  Gauge,
  Grid3x3,
  Hand,
  Music,
  Palette,
  Settings2,
  Sparkles,
  Swords,
  Trash2,
  Vibrate,
  Volume2,
} from 'lucide-react'
import { useState } from 'react'
import { BOARD_THEMES, PIECE_SETS } from '../../constants/themes'
import { useStore } from '../../hooks/useStore'
import { profileStore, resetProfile } from '../../stores/profileStore'
import { settingsStore, updateSettings } from '../../stores/settingsStore'
import { showToast } from '../../stores/toastStore'
import { openIntro } from '../../stores/introStore'
import { AudioPanel } from '../settings/AudioPanel'
import { HapticsPanel } from '../settings/HapticsPanel'
import { Section } from '../settings/Section'
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

type Tab = 'general' | 'display' | 'audio' | 'haptics'

const TABS: ReadonlyArray<{ id: Tab; label: string; icon: typeof Volume2 }> = [
  { id: 'general', label: 'General', icon: Settings2 },
  { id: 'display', label: 'Display', icon: Palette },
  { id: 'audio', label: 'Audio', icon: Volume2 },
  { id: 'haptics', label: 'Haptics', icon: Vibrate },
]

export function SettingsModal({ open, onClose, onOpenShop }: SettingsModalProps) {
  const settings = useStore(settingsStore, (s) => s)
  const profile = useStore(profileStore, (p) => p)
  const [tab, setTab] = useState<Tab>('general')
  const [confirmReset, setConfirmReset] = useState(false)

  return (
    <>
      <Modal open={open} title="Settings" onClose={onClose} size="md">
        <div className="sticky top-0 z-10 -mx-5 mb-4 bg-ink-800/95 px-5 pb-3 backdrop-blur" role="tablist" aria-label="Settings sections">
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-white/[0.05] p-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-semibold transition sm:flex-row sm:justify-center sm:gap-1.5 sm:text-xs ${
                  tab === id ? 'bg-accent text-ink-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>
        </div>

        {tab === 'general' && (
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
            <Section title="Cinematic">
              <Button
                className="w-full"
                icon={<Clapperboard className="size-4" />}
                onClick={() => {
                  onClose()
                  openIntro()
                }}
              >
                Replay the cinematic intro
              </Button>
            </Section>
            <Section title="Mobile ergonomics">
              <Toggle
                label="One-handed mode"
                description="Status, clock and controls anchored in the thumb zone (phones)"
                icon={<Hand className="size-5" />}
                checked={settings.oneHanded}
                onChange={(v) => updateSettings({ oneHanded: v })}
              />
              <Toggle
                label="Swipe gestures"
                description="← undo · → flip · ↑ moves · ↓ menu (on bars & dock)"
                icon={<Swords className="size-5" />}
                checked={settings.gesturesEnabled}
                onChange={(v) => updateSettings({ gesturesEnabled: v })}
              />
              <button type="button" onClick={() => updateSettings({ gestureHintSeen: false })} className="px-1 py-1 text-xs font-semibold text-accent hover:underline">
                Replay gesture tutorial
              </button>
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
        )}

        {tab === 'display' && (
          <div className="space-y-6">
            <Section title="Board theme">
              <div className="grid grid-cols-3 gap-2">
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
            <Section title="Board">
              <Toggle label="Advantage bar" description="Live Stockfish evaluation" icon={<Gauge className="size-5" />} checked={settings.showEvalBar} onChange={(v) => updateSettings({ showEvalBar: v })} />
              <Toggle label="Legal move hints" icon={<Sparkles className="size-5" />} checked={settings.showLegalMoves} onChange={(v) => updateSettings({ showLegalMoves: v })} />
              <Toggle label="Coordinates" icon={<Grid3x3 className="size-5" />} checked={settings.showCoordinates} onChange={(v) => updateSettings({ showCoordinates: v })} />
            </Section>
          </div>
        )}

        {tab === 'audio' && <AudioPanel settings={settings} />}
        {tab === 'haptics' && <HapticsPanel settings={settings} />}
        {tab === 'audio' && (
          <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <Music className="size-3.5" /> The soundtrack adapts to the game: tension rises with checks, big swings and low time.
          </p>
        )}
      </Modal>
      <ConfirmDialog
        open={confirmReset}
        title="Reset progress?"
        message="This deletes your rating, match history, achievements, quests, coins and unlocks. This cannot be undone."
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
