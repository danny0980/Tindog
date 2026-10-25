import { useEffect, useState } from 'react'
import { auraDef } from '../../journey/cosmetics'

type DayPhase = 'dawn' | 'day' | 'dusk' | 'night'

/** The light of the hour: dawn 5–8, day 8–17, dusk 17–20, night after. */
function dayPhase(hour: number): DayPhase {
  if (hour >= 5 && hour < 8) return 'dawn'
  if (hour >= 8 && hour < 17) return 'day'
  if (hour >= 17 && hour < 20) return 'dusk'
  return 'night'
}

const LIGHT: Record<DayPhase, string> = {
  dawn: 'radial-gradient(120% 90% at 0% 100%, rgba(251,146,60,.22), transparent 60%), linear-gradient(180deg, rgba(244,114,182,.10), transparent 55%)',
  day: 'radial-gradient(120% 80% at 80% 0%, rgba(255,250,220,.10), transparent 60%)',
  dusk: 'radial-gradient(130% 100% at 100% 100%, rgba(249,115,22,.26), transparent 55%), linear-gradient(0deg, rgba(124,58,237,.14), transparent 60%)',
  night: 'radial-gradient(140% 120% at 50% 0%, rgba(30,58,138,.30), rgba(2,6,23,.28))',
}

// A few fixed star positions (percent), so the night sky doesn't jump between renders.
const STARS = [
  [8, 12], [22, 6], [37, 18], [55, 9], [71, 15], [88, 7], [14, 31], [63, 27], [93, 33], [46, 4],
] as const

/** A soft overlay over the board that follows the local time of day. */
export function LivingLight({ enabled }: { enabled: boolean }) {
  const [hour, setHour] = useState(() => new Date().getHours())
  useEffect(() => {
    if (!enabled) return
    const id = window.setInterval(() => setHour(new Date().getHours()), 60_000)
    return () => window.clearInterval(id)
  }, [enabled])
  if (!enabled) return null
  const phase = dayPhase(hour)
  return (
    <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden rounded-[inherit] mix-blend-soft-light" aria-hidden="true" data-living-light={phase} style={{ background: LIGHT[phase] }}>
      {phase === 'night' &&
        STARS.map(([x, y], i) => (
          <span key={i} className="absolute size-[3px] animate-pulse-soft rounded-full bg-white/80" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.37}s` }} />
        ))}
    </div>
  )
}

/** Your Journey aura: a breathing glow and drifting motes around the board. */
export function BoardAura({ id, lowPower }: { id: string | null; lowPower: boolean }) {
  const aura = auraDef(id)
  if (!aura) return null
  const motes = lowPower || aura.motes === 'none' ? 0 : 10
  const glyph = aura.motes === 'snow' ? '❄' : aura.motes === 'petals' ? '✿' : aura.motes === 'stars' ? '✦' : aura.motes === 'sparks' ? '⚡' : '•'
  return (
    <div className="pointer-events-none absolute -inset-3 -z-10" aria-hidden="true" data-aura={aura.id}>
      <div className="absolute inset-0 animate-aura rounded-[1.6rem]" style={{ boxShadow: `0 0 36px 8px ${aura.color}, inset 0 0 18px ${aura.color}` }} />
      {Array.from({ length: motes }, (_, i) => (
        <span
          key={i}
          className="absolute bottom-0 animate-mote text-[10px]"
          style={{ left: `${(i * 37) % 100}%`, color: aura.color, animationDelay: `${(i * 0.7) % 7}s`, textShadow: `0 0 6px ${aura.color}` }}
        >
          {glyph}
        </span>
      ))}
    </div>
  )
}
