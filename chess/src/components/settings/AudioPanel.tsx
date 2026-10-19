import { Bell, CloudRain, Crown, Flame, Handshake, MessageSquareQuote, Music, Orbit, Play, Skull, Sparkles, Trophy, Volume2, VolumeX, Wind } from 'lucide-react'
import type { ReactNode } from 'react'
import { FOCUS_TRACKS, type FocusTrack, audioEngine, focusSoundscape, sfx } from '../../audio'
import { playAchievement, playCheck, playCoins, playDefeat, playDraw, playVictory } from '../../audio/fanfares'
import { playPieceSound } from '../../audio/pieceSounds'
import { type VoiceMode, hushVoices, speakLine, voicesSupported } from '../../audio/voice'
import { getBoardTheme } from '../../constants/themes'
import { updateSettings } from '../../stores/settingsStore'
import type { AppSettings, SoundMaterialSetting } from '../../types/settings'
import type { SoundMaterial } from '../../types/theme'
import { Section } from './Section'

const MATERIALS: ReadonlyArray<{ id: SoundMaterialSetting; label: string; hint: string }> = [
  { id: 'theme', label: 'Match theme', hint: 'Follows your board' },
  { id: 'wood', label: 'Wood', hint: 'Warm knock' },
  { id: 'marble', label: 'Marble', hint: 'Bright stone click' },
  { id: 'metal', label: 'Metal', hint: 'Ringing bar' },
  { id: 'synth', label: 'Synth', hint: 'Neon blip' },
  { id: 'soft', label: 'Soft', hint: 'Gentle tap' },
  { id: 'crystal', label: 'Crystal', hint: 'Elven glass chime' },
  { id: 'ember', label: 'Ember', hint: 'Obsidian thud & sparks' },
]

const unlock = () => audioEngine.unlock()

const FOCUS_ICON: Record<FocusTrack, typeof Wind> = { off: VolumeX, rain: CloudRain, fireplace: Flame, cosmic: Orbit }

/** Granular mixer: master + three tracks, piece-sound material and cue previews. */
const VOICE_MODES: ReadonlyArray<{ id: VoiceMode; label: string }> = [
  { id: 'off', label: 'Off' },
  { id: 'key', label: 'Key moments' },
  { id: 'all', label: 'Every line' },
]

const VOICE_SAMPLES = [
  { speaker: 'Cleopatra VII', text: 'Rome fell for my charm. You will fall for my traps.', mood: 'smug' as const },
  { speaker: 'Napoleon Bonaparte', text: "Every pawn carries a marshal's baton. Shall we see whose?", mood: 'calm' as const },
  { speaker: 'Genghis Khan', text: 'Your pawns scatter like the steppe wind.', mood: 'smug' as const },
  { speaker: 'ORACLE-7', text: 'Probability of your victory: recalculating.', mood: 'calm' as const },
]

export function AudioPanel({ settings }: { settings: AppSettings }) {
  const themeMaterial: SoundMaterial = getBoardTheme(settings.boardTheme).material
  const materialFor = (id: SoundMaterialSetting): SoundMaterial => (id === 'theme' ? themeMaterial : id)

  return (
    <div className="space-y-6">
      <Section title="Master">
        <VolumeRow
          icon={settings.masterVolume === 0 ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          label="Master volume"
          value={settings.masterVolume}
          onChange={(v) => updateSettings({ masterVolume: v })}
        />
      </Section>

      <Section title="Tracks">
        <Track
          icon={<Sparkles className="size-5" />}
          label="Game effects"
          hint="Pieces, checks, fanfares"
          enabled={settings.sfxEnabled}
          volume={settings.sfxVolume}
          onToggle={(v) => updateSettings({ sfxEnabled: v })}
          onVolume={(v) => updateSettings({ sfxVolume: v })}
          onTest={() => {
            unlock()
            playPieceSound(materialFor(settings.soundMaterial), 'capture')
          }}
        />
        <Track
          icon={<Music className="size-5" />}
          label="Ambient soundtrack"
          hint="Adaptive generative music"
          enabled={settings.musicEnabled}
          volume={settings.musicVolume}
          onToggle={(v) => updateSettings({ musicEnabled: v })}
          onVolume={(v) => updateSettings({ musicVolume: v })}
        />
        <Track
          icon={<Bell className="size-5" />}
          label="Interface & rewards"
          hint="Achievements, coins, quests, ticks"
          enabled={settings.uiSoundsEnabled}
          volume={settings.uiVolume}
          onToggle={(v) => updateSettings({ uiSoundsEnabled: v })}
          onVolume={(v) => updateSettings({ uiVolume: v })}
          onTest={() => {
            unlock()
            playCoins()
          }}
        />
      </Section>

      <Section title="Character voices">
        <p className="mb-2 text-xs text-slate-400">Characters read their lines aloud in voices of their own, using your device's built-in speech.</p>
        {voicesSupported() ? (
          <>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Character voices">
              {VOICE_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={settings.characterVoice === m.id}
                  data-voice-mode={m.id}
                  onClick={() => {
                    updateSettings({ characterVoice: m.id })
                    if (m.id === 'off') hushVoices()
                  }}
                  className={`min-h-12 rounded-xl border p-2 text-sm font-semibold transition ${settings.characterVoice === m.id ? 'border-accent bg-accent/10 text-white' : 'border-white/10 bg-white/[0.03] text-slate-300'}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={settings.characterVoice === 'off'}
              onClick={() => speakLine(VOICE_SAMPLES[Math.floor(Math.random() * VOICE_SAMPLES.length)] ?? VOICE_SAMPLES[0]!, settings.sfxVolume)}
              className="mt-2 flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-40"
              data-voice-sample
            >
              <MessageSquareQuote className="size-4" /> Hear a sample
            </button>
          </>
        ) : (
          <p className="text-xs text-slate-500">This browser has no speech synthesis.</p>
        )}
      </Section>

      <Section title="Focus soundscape">
        <p className="mb-2 text-xs text-slate-400">Ambient sound to help you concentrate — synthesised live, no downloads.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Focus soundscape">
          {FOCUS_TRACKS.map((t) => {
            const Icon = FOCUS_ICON[t.id]
            const on = settings.focusTrack === t.id
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={on}
                data-focus={t.id}
                title={t.description}
                onClick={() => {
                  unlock()
                  updateSettings({ focusTrack: t.id })
                  focusSoundscape.play(t.id, settings.focusVolume)
                }}
                className={`flex min-h-12 items-center gap-2 rounded-xl border p-2 text-left text-sm font-semibold transition ${on ? 'border-accent bg-accent/10 text-white' : 'border-white/10 bg-white/[0.03] text-slate-300'}`}
              >
                <Icon className="size-4 shrink-0" /> {t.name}
              </button>
            )
          })}
        </div>
        <VolumeRow icon={<Volume2 className="size-4" />} label="Focus soundscape volume" value={settings.focusVolume} onChange={(v) => updateSettings({ focusVolume: v })} disabled={settings.focusTrack === 'off'} />
      </Section>

      <Section title="Arena atmosphere">
        <label className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-white">Mood-reactive arena</span>
            <span className="block text-xs text-slate-500">Lighting follows your opponent’s alignment; severe checks shake the board</span>
          </span>
          <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={settings.moodEffects} onChange={(e) => updateSettings({ moodEffects: e.target.checked })} />
        </label>
      </Section>

      <Section title="Piece sound material">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {MATERIALS.map((m) => (
            <div
              key={m.id}
              className={`flex items-center gap-2 rounded-xl border p-2 transition ${
                settings.soundMaterial === m.id ? 'border-accent bg-accent/10' : 'border-white/10 bg-white/[0.03]'
              }`}
            >
              <button type="button" onClick={() => updateSettings({ soundMaterial: m.id })} className="min-w-0 flex-1 text-left" aria-pressed={settings.soundMaterial === m.id}>
                <div className="truncate text-sm font-semibold text-white">{m.label}</div>
                <div className="truncate text-[11px] text-slate-400">{m.id === 'theme' ? `${m.hint} (${themeMaterial})` : m.hint}</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  unlock()
                  sfx.preview(materialFor(m.id))
                }}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-slate-200 transition hover:bg-white/20 active:scale-90"
                aria-label={`Preview ${m.label}`}
              >
                <Play className="size-3.5" fill="currentColor" />
              </button>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Preview cues">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <Cue label="Check" icon={<Crown className="size-4" />} play={playCheck} />
          <Cue label="Victory" icon={<Trophy className="size-4" />} play={playVictory} />
          <Cue label="Defeat" icon={<Skull className="size-4" />} play={playDefeat} />
          <Cue label="Draw" icon={<Handshake className="size-4" />} play={playDraw} />
          <Cue label="Trophy" icon={<Sparkles className="size-4" />} play={playAchievement} />
          <Cue label="Coins" icon={<Bell className="size-4" />} play={playCoins} />
        </div>
      </Section>
    </div>
  )
}

function VolumeRow({ icon, label, value, onChange, disabled = false }: { icon: ReactNode; label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className={`flex items-center gap-3 py-1.5 ${disabled ? 'opacity-40' : ''}`}>
      <span className="text-slate-400">{icon}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1"
        aria-label={label}
      />
      <span className="w-10 text-right font-mono text-xs text-slate-400">{Math.round(value * 100)}%</span>
    </div>
  )
}

function Track(props: {
  icon: ReactNode
  label: string
  hint: string
  enabled: boolean
  volume: number
  onToggle: (v: boolean) => void
  onVolume: (v: number) => void
  onTest?: () => void
}) {
  return (
    <div className="mb-2 rounded-xl bg-white/[0.03] px-3 py-2">
      <div className="flex items-center gap-3">
        <span className="text-slate-400">{props.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-white">{props.label}</div>
          <div className="text-xs text-slate-500">{props.hint}</div>
        </div>
        {props.onTest && (
          <button type="button" onClick={props.onTest} className="rounded-lg px-2 py-1 text-xs font-semibold text-accent hover:bg-white/10" disabled={!props.enabled}>
            Test
          </button>
        )}
        <button
          type="button"
          role="switch"
          aria-checked={props.enabled}
          aria-label={props.label}
          onClick={() => props.onToggle(!props.enabled)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${props.enabled ? 'bg-accent' : 'bg-white/15'}`}
        >
          <span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${props.enabled ? 'translate-x-5' : ''}`} />
        </button>
      </div>
      <VolumeRow icon={<Volume2 className="size-4" />} label={`${props.label} volume`} value={props.volume} onChange={props.onVolume} disabled={!props.enabled} />
    </div>
  )
}

function Cue({ label, icon, play }: { label: string; icon: ReactNode; play: () => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        unlock()
        play()
      }}
      className="flex flex-col items-center gap-1 rounded-xl bg-white/[0.05] py-2 text-[11px] font-semibold text-slate-300 ring-1 ring-white/10 transition hover:bg-white/10 active:scale-95"
    >
      {icon}
      {label}
    </button>
  )
}
