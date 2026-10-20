import { Clapperboard, Coins, Music, Settings, Volume2, VolumeX } from 'lucide-react'
import { useStore } from '../../hooks/useStore'
import { profileStore } from '../../stores/profileStore'
import { settingsStore, updateSettings } from '../../stores/settingsStore'
import type { AppView } from '../../types/ui'
import { NAV_ITEMS } from './navItems'

interface AppHeaderProps {
  view: AppView
  onNavigate: (view: AppView) => void
  onOpenSettings: () => void
  onOpenIntro: () => void
}

export function AppHeader({ view, onNavigate, onOpenSettings, onOpenIntro }: AppHeaderProps) {
  const coins = useStore(profileStore, (p) => p.coins)
  const elo = useStore(profileStore, (p) => p.elo)
  const sfxEnabled = useStore(settingsStore, (s) => s.sfxEnabled)
  const musicEnabled = useStore(settingsStore, (s) => s.musicEnabled)
  const iconButton = 'glass flex size-10 items-center justify-center rounded-xl text-slate-300 transition hover:text-white active:scale-95'

  return (
    <header className="vt-static-header safe-px mx-auto flex w-full max-w-7xl items-center gap-3 py-2.5">
      <button type="button" onClick={() => onNavigate('play')} className="flex items-center gap-2.5" aria-label="Chess Arena home">
        <div className="idle-pause flex size-9 animate-glow items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-2 text-xl text-ink-950">
          <span aria-hidden="true">♞</span>
        </div>
        <div className="hidden text-left sm:block">
          <div className="font-display text-base font-extrabold leading-none tracking-wider text-white">CHESS ARENA</div>
          <div className="mt-0.5 text-[10px] font-semibold tracking-[0.25em] text-accent">AAA EDITION</div>
        </div>
      </button>

      <nav className="ml-2 hidden min-w-0 items-center gap-0.5 lg:flex xl:ml-4" aria-label="Main">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onNavigate(id)}
            aria-current={view === id ? 'page' : undefined}
            aria-label={label}
            title={label}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-semibold transition ${
              view === id ? 'bg-accent/15 text-white shadow-[inset_0_0_0_1px_var(--accent)]' : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Icon className="size-4" /> <span className="hidden xl:inline">{label}</span>
          </button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <button type="button" onClick={() => onNavigate('profile')} className="glass hidden h-10 items-center gap-1.5 rounded-xl px-3 font-mono text-sm font-bold text-white sm:flex" title="Your rating">
          <span className="text-[10px] font-sans font-semibold tracking-wider text-slate-400">ELO</span> {elo}
        </button>
        <button type="button" onClick={() => onNavigate('shop')} className="glass flex h-10 items-center gap-1.5 rounded-xl px-3 font-mono text-sm font-bold text-yellow-300" title="Coins">
          <Coins className="size-4" /> {coins}
        </button>
        <button type="button" onClick={onOpenIntro} className={`${iconButton} hidden sm:flex`} aria-label="Cinematic intro" title="Cinematic intro" data-open-intro>
          <Clapperboard className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => updateSettings({ musicEnabled: !musicEnabled })}
          className={`${iconButton} hidden sm:flex ${musicEnabled ? 'text-accent' : ''}`}
          aria-label={musicEnabled ? 'Stop soundtrack' : 'Play soundtrack'}
          aria-pressed={musicEnabled}
        >
          <Music className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => updateSettings({ sfxEnabled: !sfxEnabled, ...(sfxEnabled ? { musicEnabled: false } : {}) })}
          className={iconButton}
          aria-label={sfxEnabled ? 'Mute all sound' : 'Enable sound'}
          aria-pressed={sfxEnabled}
        >
          {sfxEnabled ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
        </button>
        <button type="button" onClick={onOpenSettings} className={iconButton} aria-label="Settings">
          <Settings className="size-5" />
        </button>
      </div>
    </header>
  )
}
