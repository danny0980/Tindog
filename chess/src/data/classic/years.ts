// Turns the lore's "lived" text into numbers for the Personal Timeline:
// "c. 1507 – 1458 BCE" → about -1482, "1943 – 2008" → 1975.

export interface LifeSpan {
  /** Earliest and latest years mentioned (BCE years are negative). */
  from: number
  to: number
  /** The year the timeline places them at: the middle of their span. */
  year: number
}

const CENTURY = /(\d{1,2})(?:st|nd|rd|th)\b/g
const YEAR = /(\d{1,4})(?:\/\d{1,4})?(?:\s*(BCE|CE|BC|AD)\b)?/g

/** Unmarked numbers take the era of the next marked one ("100 – 44 BCE"); otherwise CE. */
function applyEras(raw: ReadonlyArray<{ n: number; era: string | undefined }>): number[] {
  return raw.map(({ n }, i) => {
    const era = raw.slice(i).find((r) => r.era !== undefined)?.era
    return era === 'BCE' || era === 'BC' ? -n : n
  })
}

export function parseLived(lived: string): LifeSpan | null {
  // Centuries first ("9th century", "6th – 5th century BCE"): the middle of each century.
  if (/century/i.test(lived)) {
    const bce = /BCE|BC\b/.test(lived)
    const centuries = [...lived.matchAll(CENTURY)].map((m) => Number(m[1]))
    if (centuries.length === 0) return null
    const mids = centuries.map((c) => (bce ? -((c - 1) * 100 + 50) : (c - 1) * 100 + 50))
    return span(mids)
  }
  const raw = [...lived.matchAll(YEAR)].map((m) => ({ n: Number(m[1]), era: m[2] }))
  if (raw.length === 0) return null
  return span(applyEras(raw))
}

function span(years: readonly number[]): LifeSpan {
  const from = Math.min(...years)
  const to = Math.max(...years)
  return { from, to, year: Math.round((from + to) / 2) }
}

export const formatYear = (y: number): string => (y < 0 ? `${-y} BCE` : y < 1000 ? `AD ${y}` : `${y}`)

/**
 * Where a year sits on the timeline, 0 → 1. History is crowded at the modern end,
 * so the scale is piecewise: 2400 BCE–0 takes the first quarter, 0–1400 the next,
 * 1400–1800 the next, and 1800–today the last.
 */
const STOPS: ReadonlyArray<readonly [year: number, at: number]> = [
  [-2400, 0],
  [0, 0.25],
  [1400, 0.5],
  [1800, 0.75],
  [2030, 1],
]

export function timelinePosition(year: number): number {
  const first = STOPS[0]!
  const last = STOPS[STOPS.length - 1]!
  if (year <= first[0]) return 0
  if (year >= last[0]) return 1
  for (let i = 1; i < STOPS.length; i++) {
    const [y1, p1] = STOPS[i]!
    const [y0, p0] = STOPS[i - 1]!
    if (year <= y1) return p0 + ((year - y0) / (y1 - y0)) * (p1 - p0)
  }
  return 1
}

/** Labelled ticks along the timeline. */
export const TIMELINE_TICKS: readonly number[] = [-2300, -1500, -800, 0, 500, 1000, 1400, 1600, 1800, 1900, 2000]
