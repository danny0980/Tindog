import type { WeatherState } from '../../types/rpg'

const FLAKES = Array.from({ length: 18 }, (_, i) => ({ left: (i * 37) % 100, delay: (i * 0.73) % 6, size: 2 + (i % 3) }))
const STREAKS = Array.from({ length: 7 }, (_, i) => ({ top: 8 + i * 13, delay: (i * 0.41) % 1.8, width: 18 + (i % 3) * 10 }))
const ROTATE = { E: 0, S: 90, W: 180, N: 270 } as const

/** Decorative, pointer-transparent weather layer over the board. */
export function WeatherOverlay({ weather, lowPower }: { weather: WeatherState; lowPower: boolean }) {
  if (weather.id === 'clear') return null
  if (weather.id === 'fog') {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl" aria-hidden>
        <div
          className={`absolute -inset-[10%] ${lowPower ? '' : 'animate-fog-drift'}`}
          style={{ background: 'radial-gradient(ellipse at 30% 40%, rgba(226,232,240,0.32), transparent 60%), radial-gradient(ellipse at 70% 70%, rgba(203,213,225,0.28), transparent 55%)' }}
        />
      </div>
    )
  }
  if (lowPower) return null
  if (weather.id === 'snow') {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl" aria-hidden>
        {FLAKES.map((f, i) => (
          <span
            key={i}
            className="absolute -top-2 animate-snowfall rounded-full bg-white/80"
            style={{ left: `${f.left}%`, width: f.size, height: f.size, animationDelay: `${f.delay}s` }}
          />
        ))}
      </div>
    )
  }
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl" aria-hidden>
      <div className="absolute inset-0" style={{ transform: `rotate(${ROTATE[weather.wind]}deg)` }}>
        {STREAKS.map((s, i) => (
          <span
            key={i}
            className="absolute left-0 h-px animate-wind-streak bg-gradient-to-r from-transparent via-white/60 to-transparent"
            style={{ top: `${s.top}%`, width: `${s.width}%`, animationDelay: `${s.delay}s` }}
          />
        ))}
      </div>
    </div>
  )
}
