// Maps battle events to on-board particle effects (pure, unit-tested).
import { SPELLS } from '../../data/spells'
import type { Square } from '../../types/chess'
import type { BattleEvent } from '../../types/spells'
import type { EmitOptions, ParticleKind } from './particles'

export type BoardFxKind = 'frost' | 'spell' | 'ward' | 'glue' | 'blood' | 'potion' | 'check' | 'mate'

export interface BoardFx {
  id: number
  kind: BoardFxKind
  /** Where it happens; null = the board's centre. */
  square: Square | null
}

/** The particle effect a battle event deserves, if any. */
export function boardFxFor(e: BattleEvent): Omit<BoardFx, 'id'> | null {
  switch (e.kind) {
    case 'spell-cast':
      return SPELLS[e.spell].mechanic === 'freeze' && e.square ? { kind: 'frost', square: e.square } : { kind: 'spell', square: null }
    case 'spell-blocked':
      return { kind: 'ward', square: null }
    case 'trap':
      if (e.sprung || e.detail.startsWith('Glue')) return { kind: 'glue', square: e.square }
      if (e.detail.startsWith('Altar')) return { kind: 'blood', square: e.square }
      return { kind: 'spell', square: e.square }
    case 'potion':
      return { kind: 'potion', square: null }
    case 'tactic':
      return { kind: 'spell', square: null }
    default:
      return null
  }
}

/** Particle bursts for an effect, in board-relative pixels (`cell` = one square's size). */
export function burstsFor(kind: BoardFxKind, cell: number): Array<{ particle: ParticleKind; count: number; options: Omit<EmitOptions, 'x' | 'y'> }> {
  switch (kind) {
    case 'frost':
      return [
        { particle: 'frost', count: 46, options: { spread: cell * 3.2, life: 1.1, size: cell * 0.06 } },
        { particle: 'spark', count: 14, options: { spread: cell * 2, life: 0.5, size: cell * 0.03 } },
      ]
    case 'spell':
      return [
        { particle: 'spark', count: 40, options: { spread: cell * 4.5, life: 0.8, size: cell * 0.035 } },
        { particle: 'rune', count: 18, options: { spread: cell * 2.2, life: 1.4, size: cell * 0.04, vy: -cell } },
      ]
    case 'ward':
      return [{ particle: 'rune', count: 50, options: { spread: cell * 5, life: 1, size: cell * 0.045 } }]
    case 'glue':
      return [{ particle: 'ember', count: 26, options: { spread: cell * 1.6, life: 0.9, size: cell * 0.05 } }]
    case 'blood':
      return [
        { particle: 'ember', count: 34, options: { spread: cell * 2.5, life: 1.2, size: cell * 0.05, vy: -cell } },
        { particle: 'shard', count: 18, options: { spread: cell * 3, life: 0.9, size: cell * 0.07, vy: -cell * 2 } },
      ]
    case 'potion':
      return [{ particle: 'bubble', count: 36, options: { spread: cell * 2.5, life: 1.3, size: cell * 0.05, vy: -cell * 1.2 } }]
    case 'check':
      return [{ particle: 'spark', count: 30, options: { spread: cell * 3.5, life: 0.6, size: cell * 0.035 } }]
    case 'mate':
      return [
        { particle: 'shard', count: 60, options: { spread: cell * 6, life: 1.3, size: cell * 0.08, vy: -cell * 3 } },
        { particle: 'spark', count: 60, options: { spread: cell * 7, life: 1, size: cell * 0.04 } },
      ]
  }
}
