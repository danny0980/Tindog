import { Angry, Annoyed, Bot, Brain, Crown, Frown, Handshake, Laugh, Meh, Skull, Smile, SmilePlus, User, Zap } from 'lucide-react'
import { useState } from 'react'
import { useAvatarArt } from '../../assets/useArt'
import type { Color } from '../../types/chess'
import type { PortraitSpec } from '../../types/persona'
import { PortraitEmblem } from '../legends/PortraitEmblem'
import { FrameRing } from '../journey/ui'
import type { Mood } from '../../utils/mood'

const MOODS: Record<Mood, { icon: typeof Smile; label: string; ring: string; badge: string; motion: string }> = {
  calm: { icon: Smile, label: 'Calm', ring: 'ring-white/15', badge: 'bg-slate-600', motion: '' },
  thinking: { icon: Brain, label: 'Thinking', ring: 'ring-accent/70', badge: 'bg-accent text-ink-950', motion: 'animate-pulse-soft' },
  confident: { icon: SmilePlus, label: 'Confident', ring: 'ring-emerald-400/60', badge: 'bg-emerald-500', motion: '' },
  dominating: { icon: Laugh, label: 'Dominating', ring: 'ring-emerald-300/80', badge: 'bg-emerald-400 text-ink-950', motion: 'animate-bounce-soft' },
  worried: { icon: Annoyed, label: 'Worried', ring: 'ring-orange-400/60', badge: 'bg-orange-500', motion: '' },
  desperate: { icon: Frown, label: 'Desperate', ring: 'ring-red-400/70', badge: 'bg-red-500', motion: 'animate-tension' },
  tense: { icon: Zap, label: 'Time trouble', ring: 'ring-amber-400/80', badge: 'bg-amber-400 text-ink-950', motion: 'animate-tension' },
  check: { icon: Angry, label: 'In check', ring: 'ring-red-500/90', badge: 'bg-red-500', motion: 'animate-tension' },
  victory: { icon: Crown, label: 'Victorious', ring: 'ring-amber-300/90', badge: 'bg-amber-300 text-ink-950', motion: 'animate-bounce-soft' },
  defeat: { icon: Skull, label: 'Defeated', ring: 'ring-slate-500/60', badge: 'bg-slate-700', motion: '' },
  draw: { icon: Handshake, label: 'Draw', ring: 'ring-sky-400/60', badge: 'bg-sky-500', motion: '' },
}

interface PlayerAvatarProps {
  color: Color
  isEngine: boolean
  mood: Mood
  isTurn: boolean
  /** Character portrait (legend or campaign boss) replacing the default avatar. */
  portrait?: { spec: PortraitSpec; label: string } | null
}

/** The moments worth a visible reaction (a short pop above the portrait), and what it says. */
const REACTIONS: Partial<Record<Mood, string>> = {
  check: 'Check!',
  dominating: 'Ha!',
  desperate: 'Oh no…',
  tense: 'Hurry!',
  victory: 'Victory!',
  defeat: 'Defeated',
}

/** Avatar that reacts to the game: tension pulses, advantage grins, defeat greys out — and a pop when the mood turns. */
export function PlayerAvatar({ color, isEngine, mood, isTurn, portrait = null }: PlayerAvatarProps) {
  const m = MOODS[mood]
  // Your art-pack avatar (Settings → Art pack), for human players.
  const avatar = useAvatarArt()
  const [brokenAvatar, setBrokenAvatar] = useState<string | null>(null)
  const showAvatar = !isEngine && avatar !== null && brokenAvatar !== avatar
  const Base = isEngine ? Bot : User
  const MoodIcon = m.icon ?? Meh
  return (
    <div className={`idle-pause relative shrink-0 ${m.motion}`} title={m.label}>
      {/* Your Journey frame rings your own avatar. */}
      <FrameRing frame={isEngine ? null : undefined}>
      {portrait ? (
        <PortraitEmblem spec={portrait.spec} label={portrait.label} size="sm" ring={m.ring} className={mood === 'defeat' ? 'grayscale' : ''} />
      ) : (
        <div
          className={`relative flex size-11 items-center justify-center overflow-hidden rounded-xl ring-2 transition-all duration-500 ${m.ring} ${
            color === 'w' ? 'bg-gradient-to-br from-slate-50 to-slate-300 text-slate-800' : 'bg-gradient-to-br from-slate-700 to-slate-900 text-slate-100'
          } ${mood === 'defeat' ? 'grayscale' : ''}`}
        >
          {showAvatar ? (
            <img src={avatar ?? ''} alt="" draggable={false} onError={() => setBrokenAvatar(avatar)} className="absolute inset-0 size-full object-cover" data-player-avatar />
          ) : (
            <Base className="size-6" aria-hidden="true" />
          )}
          {isEngine && (
            <span className="absolute inset-x-0 bottom-0 h-1 animate-shimmer bg-[linear-gradient(90deg,transparent,var(--accent),transparent)] bg-[length:200%_100%]" />
          )}
        </div>
      )}
      </FrameRing>
      <span
        className={`absolute -right-1.5 -bottom-1.5 flex size-5 items-center justify-center rounded-full text-white shadow-lg ring-2 ring-ink-900 transition-colors duration-300 ${m.badge}`}
        aria-label={m.label}
      >
        <MoodIcon className="size-3" />
      </span>
      {isTurn && <span className="absolute -top-1 -left-1 size-3 animate-pulse-soft rounded-full bg-accent ring-2 ring-ink-900" aria-hidden="true" />}
      {REACTIONS[mood] && (
        // Keyed by mood, so each new reaction replays the pop once, then fades away.
        <span
          key={mood}
          className={`pointer-events-none absolute -top-7 left-1/2 z-10 animate-reaction whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-lg ${m.badge}`}
          aria-hidden="true"
          data-reaction={mood}
        >
          {REACTIONS[mood]}
        </span>
      )}
    </div>
  )
}
