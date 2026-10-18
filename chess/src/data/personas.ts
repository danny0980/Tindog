// Adapters that turn any character — a hand-crafted Chronos legend or a
// generated Grand Campaign boss — into the Persona the play screen stages.
import type { Boss } from '../types/campaign'
import type { Difficulty } from '../types/chess'
import type { Legend, LegendStrength } from '../types/legend'
import type { Persona } from '../types/persona'
import { applyStrength, epochLabel, getEpoch, legendElo } from './legends'
import { LEGEND_SPELLS, spellsForBoss } from './spells'
import { ARCHETYPE_TONE, LEGEND_TONE } from './taunts'

/** Closest Quick Play difficulty bucket for a rating (coins and stats). */
export function difficultyForElo(elo: number): Difficulty {
  if (elo < 1200) return 'beginner'
  if (elo < 1800) return 'intermediate'
  if (elo < 2300) return 'advanced'
  return 'expert'
}

export function legendPersona(legend: Legend, strength: LegendStrength): Persona {
  const epoch = getEpoch(legend.epoch)
  return {
    key: `legend:${legend.id}`,
    name: legend.name,
    title: legend.title,
    elo: legendElo(legend, strength),
    difficulty: legend.difficulty,
    profile: applyStrength(legend.profile, strength),
    quotes: legend.quotes,
    portrait: legend.portrait,
    themeId: epoch.themeId,
    pieceSetId: epoch.pieceSetId,
    arrivalCaption: epochLabel(epoch),
    settingName: epoch.name,
    spells: LEGEND_SPELLS[legend.id] ?? [],
    tone: LEGEND_TONE[legend.id],
  }
}

export function bossPersona(boss: Boss): Persona {
  return {
    key: `boss:${boss.id}`,
    name: boss.name,
    title: boss.title,
    elo: boss.elo,
    difficulty: difficultyForElo(boss.elo),
    profile: boss.profile,
    quotes: boss.quotes,
    portrait: boss.portrait,
    themeId: boss.themeId,
    pieceSetId: boss.pieceSetId,
    arrivalCaption: boss.arrivalCaption,
    settingName: boss.settingName,
    spells: spellsForBoss(boss),
    tone: boss.legendRef ? LEGEND_TONE[boss.legendRef] : ARCHETYPE_TONE[boss.archetype],
  }
}
