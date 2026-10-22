// Adapters that turn any character — a hand-crafted Chronos legend or a
// generated Grand Campaign boss — into the Persona the play screen stages.
import { rivalLines } from './classic/rivals'
import { loadedLore } from './classic/loreLoader'
import type { Boss } from '../types/campaign'
import type { Difficulty } from '../types/chess'
import type { Legend, LegendStrength } from '../types/legend'
import type { Persona } from '../types/persona'
import { applyStrength, epochLabel, getEpoch, legendElo } from './legends'
import { LEGEND_SPELLS, spellsForBoss } from './spells'
import { ARCHETYPE_TONE, LEGEND_TONE } from './taunts'
import { ARCHETYPES, buildProfile } from './campaign/archetypes'
import { BOOKS } from './campaign/books'
import { type ClassicCharacter, classicPortrait, getClassicEra } from './classic/roster'
import type { Fingerprint } from '../ghost/fingerprint'

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
 * Facing their historical rival (your avatar), they speak to that rivalry.
 */
export function classicPersona(c: ClassicCharacter, facing: string | null = null): Persona {
  const era = getClassicEra(c.era)
  const archetype = ARCHETYPES[c.archetype]
  const book = BOOKS[c.book]
  const short = c.name.split(' ')[0] ?? c.name
  // Their own last words, once the lore has loaded (it loads right after start-up).
  const lore = loadedLore()?.loreFor(c.id) ?? null
  const rival = rivalLines(c.id, facing)
  return {
    key: `classic:${c.id}`,
    name: c.name,
    title: c.title,
    elo: c.elo,
    difficulty: difficultyForElo(c.elo),
    profile: buildProfile(c.archetype, c.elo, { w: book.w, b: book.b }),
    quotes: {
      ...archetype.lines,
      intro: [rival ? rival.intro : c.line],
      // Their own words at the end of the game (from the lore), with the generic lines as fallback.
      legendWins: rival ? [rival.victory] : lore ? [lore.victory] : [`${short} takes the game. Study it — you were closer than you think.`, 'A fine fight. Come back stronger.'],
      legendLoses: rival ? [rival.defeat] : lore ? [lore.defeat] : [`Well played. ${short} tips the king to you.`, 'The board was yours today. I salute you.'],
    },
    portrait: classicPortrait(c),
    themeId: era.themeId,
    pieceSetId: era.pieceSetId,
    arrivalCaption: era.caption,
    settingName: era.name,
    spells: [],
    tone: ARCHETYPE_TONE[c.archetype],
  }
}

/**
 * Ghost of Yourself: you, as an opponent. It opens with your own lines, plays
 * in the style your habits match, at your rating.
 */
export function ghostPersona(f: Fingerprint, playerName: string): Persona {
  const archetype = ARCHETYPES[f.archetype]
  const name = `Ghost of ${playerName || 'You'}`
  return {
    key: 'ghost',
    name,
    title: `Your own style · ${archetype.name}`,
    elo: f.elo,
    difficulty: difficultyForElo(f.elo),
    profile: buildProfile(f.archetype, f.elo, f.repertoire),
    quotes: {
      ...archetype.lines,
      intro: ['I know every opening you play. I learned them from you.', 'Let us see if you can beat your own habits.'],
      legendWins: ['Beaten by yourself. Those were your mistakes, not mine.', 'Same habits, same result. Change something.'],
      legendLoses: ['You played better than you used to. Good.', 'You beat your old self. That is called progress.'],
    },
    portrait: { icon: 'ghost', from: '#a5b4fc', to: '#1e1b4b', monogram: (playerName[0] ?? 'Y').toUpperCase() },
    themeId: 'oled-black',
    pieceSetId: 'moonsilver',
    arrivalCaption: 'Your mirror',
    settingName: 'The Hall of Mirrors',
    spells: [],
    tone: ARCHETYPE_TONE[f.archetype],
  }
}
