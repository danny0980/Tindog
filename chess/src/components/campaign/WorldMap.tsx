import { Crown, Gem, Lock } from 'lucide-react'
import { type CSSProperties, useEffect, useRef } from 'react'
import { getBoardTheme } from '../../constants/themes'
import { BOSSES_PER_ZONE } from '../../data/campaign/realms'
import type { Boss, BossId, CampaignProgress, GrandRealmDef } from '../../types/campaign'
import { bossRecord, isBossUnlocked, nextBoss } from '../../utils/campaign'
import { PortraitEmblem } from '../legends/PortraitEmblem'
import { StarRow } from './StarRow'

interface WorldMapProps {
  realm: GrandRealmDef
  roster: readonly Boss[]
  progress: CampaignProgress
  realmUnlocked: boolean
  lockedReason: string
  selected: BossId | null
  onSelect: (id: BossId) => void
}

const ROW = 108
const BANNER = 88
const PAD = 20
const NUMERALS = ['I', 'II', 'III', 'IV']

/** Node centre: a serpentine path (x in %, y in px). */
const nodePosition = (index: number) => ({
  x: 50 + 29 * Math.sin(index * 1.15 + 0.5),
  y: PAD + (Math.floor(index / BOSSES_PER_ZONE) + 1) * BANNER + index * ROW + ROW / 2,
})
const bannerTop = (zone: number) => PAD + zone * (BANNER + BOSSES_PER_ZONE * ROW)

/** Cubic curve through every node, in the SVG's 100×height user space. */
function pathThrough(points: ReadonlyArray<{ x: number; y: number }>): string {
  return points
    .map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`
      const prev = points[i - 1] ?? p
      const mid = (prev.y + p.y) / 2
      return `C ${prev.x} ${mid} ${p.x} ${mid} ${p.x} ${p.y}`
    })
    .join(' ')
}

const hexA = (hex: string, alpha: number) =>
  `${hex}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0')}`

/**
 * Node-based conquest map of one realm: four themed zones of five bosses
 * joined by a winding road. Conquered stretches of road glow; the next boss
 * pulses; milestone and overlord nodes are larger and show their relic.
 */
export function WorldMap({ realm, roster, progress, realmUnlocked, lockedReason, selected, onSelect }: WorldMapProps) {
  const height = PAD * 2 + realm.zones.length * BANNER + roster.length * ROW
  const points = roster.map((_, i) => nodePosition(i))
  const next = nextBoss(roster, progress)
  const reached = next ? next.index : roster.length - 1
  const nodeRefs = useRef(new Map<BossId, HTMLButtonElement>())

  // Bring the frontier into view when a realm opens or the frontier advances.
  const frontierId = next && next.index >= 2 ? next.id : null
  useEffect(() => {
    if (frontierId) nodeRefs.current.get(frontierId)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [frontierId])

  const mapStyle: CSSProperties = {
    height,
    background: `radial-gradient(circle at 20% 10%, ${hexA(realm.colors.from, 0.18)}, transparent 45%), radial-gradient(circle at 85% 60%, ${hexA(realm.colors.via, 0.16)}, transparent 50%), linear-gradient(180deg, ${hexA(realm.colors.to, 0.25)}, rgba(0,0,0,0.35))`,
  }

  return (
    <div className="glass relative overflow-hidden rounded-3xl" style={mapStyle} role="list" aria-label={`${realm.name} map`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[length:18px_18px]" aria-hidden="true" />

      {realm.zones.map((zone, z) => {
        const theme = getBoardTheme(zone.themeId)
        const cleared = roster.slice(z * BOSSES_PER_ZONE, (z + 1) * BOSSES_PER_ZONE).filter((b) => bossRecord(progress, b.id).firstClear).length
        return (
          <div
            key={zone.id}
            className="absolute inset-x-3 flex items-center gap-3 rounded-2xl border border-white/10 px-3 sm:px-4"
            style={{ top: bannerTop(z) + 8, height: BANNER - 20, background: `linear-gradient(100deg, ${hexA(zone.from, 0.35)}, ${hexA(zone.to, 0.2)})` }}
          >
            <div className="grid size-10 shrink-0 grid-cols-2 overflow-hidden rounded-lg ring-1 ring-white/20" aria-hidden="true">
              <span style={theme.lightSquare} />
              <span style={theme.darkSquare} />
              <span style={theme.darkSquare} />
              <span style={theme.lightSquare} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">
                Zone {NUMERALS[z]} · {zone.caption}
              </div>
              <div className="truncate font-display text-base font-extrabold tracking-wide text-white">{zone.name}</div>
            </div>
            <div className="shrink-0 font-mono text-xs text-white/80">
              {cleared}/{BOSSES_PER_ZONE}
            </div>
          </div>
        )
      })}

      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={`road-${realm.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={realm.colors.from} />
            <stop offset="1" stopColor={realm.colors.via} />
          </linearGradient>
        </defs>
        <path d={pathThrough(points)} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="3" strokeDasharray="2 7" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {reached > 0 && (
          <path
            d={pathThrough(points.slice(0, reached + 1))}
            fill="none"
            stroke={`url(#road-${realm.id})`}
            strokeWidth="4"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={{ filter: `drop-shadow(0 0 6px ${realm.colors.from})` }}
          />
        )}
      </svg>

      {roster.map((boss, i) => {
        const pos = points[i] ?? { x: 50, y: 0 }
        const record = bossRecord(progress, boss.id)
        const unlocked = isBossUnlocked(boss, roster, progress)
        const isNext = next?.id === boss.id && unlocked
        const isSelected = selected === boss.id
        const size = boss.rank === 'overlord' ? 'lg' : boss.rank === 'milestone' ? 'md' : 'sm'
        return (
          <button
            key={boss.id}
            ref={(el) => {
              if (el) nodeRefs.current.set(boss.id, el)
              else nodeRefs.current.delete(boss.id)
            }}
            type="button"
            role="listitem"
            data-boss={boss.id}
            onClick={() => onSelect(boss.id)}
            aria-pressed={isSelected}
            aria-label={`${boss.index + 1}. ${unlocked ? boss.name : 'Locked boss'}${record.firstClear ? `, ${record.stars} stars` : ''}`}
            className="group absolute flex w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 outline-none"
            style={{ left: `${pos.x}%`, top: pos.y }}
          >
            <span className="relative">
              {isNext && <span className="idle-pause absolute -inset-1.5 animate-ping rounded-3xl bg-accent/35" aria-hidden="true" />}
              <PortraitEmblem
                spec={boss.portrait}
                label={unlocked ? boss.name : 'Locked'}
                size={size}
                locked={!unlocked}
                defeated={Boolean(record.firstClear)}
                ring={isSelected ? 'ring-accent ring-4' : isNext ? 'ring-accent/80' : 'ring-white/25'}
                className={`transition group-hover:scale-105 group-focus-visible:scale-105 ${unlocked ? '' : 'opacity-70'}`}
              />
              <span className="absolute -top-2 -left-2 flex size-5 items-center justify-center rounded-full bg-ink-900 font-mono text-[10px] font-bold text-white ring-1 ring-white/30">
                {boss.index + 1}
              </span>
              {boss.rank !== 'regular' && (
                <span
                  className={`absolute -right-2 -bottom-1.5 flex size-6 items-center justify-center rounded-full ring-2 ring-ink-900 ${
                    boss.rank === 'overlord' ? 'bg-gradient-to-br from-amber-200 to-orange-500 text-ink-950' : 'bg-gradient-to-br from-sky-200 to-violet-500 text-ink-950'
                  }`}
                  title={boss.rank === 'overlord' ? 'Realm overlord' : 'Milestone boss'}
                >
                  {boss.rank === 'overlord' ? <Crown className="size-3.5" /> : <Gem className="size-3.5" />}
                </span>
              )}
            </span>
            <StarRow stars={record.stars} size="xs" />
            <span
              className={`max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-semibold ${isSelected ? 'bg-accent text-ink-950' : 'bg-black/55 text-slate-100'}`}
            >
              {unlocked ? boss.shortName : '???'}
            </span>
          </button>
        )
      })}

      {!realmUnlocked && (
        <div className="absolute inset-x-4 top-4 z-10 flex items-center gap-3 rounded-2xl border border-white/15 bg-black/70 p-4 backdrop-blur">
          <Lock className="size-6 shrink-0 text-slate-300" />
          <div>
            <div className="text-sm font-bold text-white">Realm sealed</div>
            <div className="text-xs text-slate-300">{lockedReason}</div>
          </div>
        </div>
      )}
    </div>
  )
}
