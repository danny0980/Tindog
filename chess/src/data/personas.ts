// Adapters that turn any character — a hand-crafted Chronos legend or a
// generated Grand Campaign boss — into the Persona the play screen stages.
import type { Boss } from '../types/campaign'
import type { Difficulty } from '../types/chess'
import type { Legend, LegendStrength } from '../types/legend'
import type { Persona } from '../types/persona'
import { applyStrength, epochLabel, getEpoch, legendElo } from './legends'
import { LEGEND_SPELLS, spellsForBoss } from './spells'
import { ARCHETYPE_TONE, LEGEND_TONE } from './taunts'
import { ARCHETYPES, buildProfile } from './campaign/archetypes'
import { BOOKS } from './campaign/books'
import { type ClassicCharacter, getClassicEra } from './classic/roster'

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

/**
 * A Classic Chess opponent: pure chess. Strength comes from the shared Elo curve
 * (shallow search, blunder guard early on), style from the archetype and the
 * opening book; no spells — Classic games never get a battle setup at all.
 */
export function classicPersona(c: ClassicCharacter): Persona {
  const era = getClassicEra(c.era)
  const archetype = ARCHETYPES[c.archetype]
  const book = BOOKS[c.book]
  const short = c.name.split(' ')[0] ?? c.name
  return {
    key: `classic:${c.id}`,
    name: c.name,
    title: c.title,
    elo: c.elo,
    difficulty: difficultyForElo(c.elo),
    profile: buildProfile(c.archetype, c.elo, { w: book.w, b: book.b }),
    quotes: {
      ...archetype.lines,
      intro: [c.line],
      legendWins: [`${short} takes the game. Study it — you were closer than you think.`, 'A fine fight. Come back stronger.'],
      legendLoses: [`Well played. ${short} tips the king to you.`, 'The board was yours today. I salute you.'],
    },
    portrait: { icon: c.icon, from: era.from, to: era.to, monogram: (c.name.replace(/^(The|Sir|Queen|Captain) /, '')[0] ?? '?').toUpperCase() },
    themeId: era.themeId,
    pieceSetId: era.pieceSetId,
    arrivalCaption: era.caption,
    settingName: era.name,
    spells: [],
    tone: ARCHETYPE_TONE[c.archetype],
  }
}
