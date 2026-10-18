// The names the art importer recognises: every character (Chronos legends and
// the 100 Grand Campaign bosses, read straight from the game's source files),
// every built-in piece set and board theme, plus extra art-pack names.
// Plain Node — no TypeScript needed — so it runs anywhere `npm` does.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { slugify } from './assets-lib.mjs'

/** Extra people with portraits but no character (yet), and handy aliases. */
export const EXTRA_PEOPLE = [
  'Queen Victoria', 'Abraham Lincoln', 'Julius Caesar', 'Ninja Leader', 'Edward Teach', 'Charles Darwin', 'George Washington',
  'Winston Churchill', 'Ramesses II', 'Tutankhamun', 'Attila the Hun', 'William the Conqueror', 'Spartacus', 'Boudica', 'Montezuma',
]

/** Art-pack piece set names beyond the built-in ones. */
export const EXTRA_PIECE_SETS = [
  'minimal', 'dark-fantasy', 'steampunk', 'prismatic-crystal', 'ancient-wood', 'dragonscale', 'galactic', 'alchemist', 'valkyrie', 'aztec',
  'underworld', 'venetian', 'cyber-ninja', 'atlantis', 'tribal', 'sun-moon', 'templar', 'glacier', 'chrome', 'oriental-dynasty',
  'desert-nomad', 'bubblegum-fantasy', 'terracotta', 'dieselpunk', 'fae-wood', 'arthurian',
]

/** Art-pack board theme names beyond the built-in ones. */
export const EXTRA_BOARD_THEMES = [
  'ancient-greece', 'roman-empire', 'medieval-castle', 'crusades', 'mongol-empire', 'renaissance-italy', 'ming-dynasty', 'enlightenment',
  'industrial-age', 'wild-west', 'american-civil-war', 'edwardian-era', 'ottoman-empire', 'persian-empire', 'ancient-india',
  'mayan-civilization', 'viking-age', 'african-kingdoms', 'stone-age', 'modern-space-age',
]

/** Words too generic to identify a person on their own (but fine inside a full name). */
const GENERIC = new Set([
  'the', 'of', 'and', 'great', 'king', 'queen', 'lord', 'lady', 'prince', 'princess', 'captain', 'general', 'commander', 'colonel', 'major',
  'black', 'white', 'light', 'dark', 'knight', 'royal', 'golden', 'crystal', 'ember', 'frost', 'storm', 'shadow', 'shadows', 'stars', 'night',
  'prime', 'warden', 'keeper', 'master', 'elder', 'silent', 'choir', 'queen', 'witch', 'serpent', 'dragon', 'drake', 'knight', 'oracle', 'void',
  'infinite', 'architect', 'pawn', 'rook', 'bishop', 'board', 'piece', 'pieces', 'portrait', 'boss', 'legend', 'chess', 'iron', 'many',
])
const TITLES = /^(the|sir|lady|queen|king|captain|high-king|lord|saint|emperor|empress|pharaoh|general|commander|colonel|major|madame|mr|dr)-/

/** Ways a filename may refer to a person: full slug, without titles, and distinctive single words. */
export function personVariants(name) {
  const slug = slugify(name)
  const out = new Set([slug])
  let s = slug
  for (let i = 0; i < 2; i++) {
    s = s.replace(TITLES, '')
    if (s) out.add(s)
  }
  for (const token of slug.split('-')) if (token.length >= 5 && !GENERIC.has(token)) out.add(token)
  return [...out]
}

const readSafe = (file) => {
  try {
    return readFileSync(file, 'utf8')
  } catch {
    return ''
  }
}
const namesIn = (text) => [...text.matchAll(/\bname:\s*'((?:[^'\\]|\\.)+)'/g)].map((m) => (m[1] ?? '').replace(/\\'/g, "'"))
const idsIn = (text) => [...text.matchAll(/^\s+id:\s*'([a-z0-9-]+)'/gm)].map((m) => m[1] ?? '')

/** Reads the known names from the game's source (`root` = the chess folder). */
export function loadCatalog(root) {
  const themesSrc = readSafe(join(root, 'src', 'constants', 'themes.ts'))
  const split = themesSrc.indexOf('export const PIECE_SETS')
  const boardThemes = idsIn(split > 0 ? themesSrc.slice(0, split) : '')
  const pieceSets = idsIn(split > 0 ? themesSrc.slice(split) : '')

  const people = new Map()
  const addPerson = (name) => {
    const key = slugify(name)
    if (key && !people.has(key)) people.set(key, { key, name, variants: personVariants(name) })
  }
  for (const file of [join(root, 'src', 'data', 'eras', 'legends.ts'), join(root, 'src', 'data', 'realms', 'legends.ts')]) namesIn(readSafe(file)).forEach(addPerson)
  const rosterDir = join(root, 'src', 'data', 'campaign', 'rosters')
  let rosters = []
  try {
    rosters = readdirSync(rosterDir).filter((f) => f.endsWith('.ts'))
  } catch {
    rosters = []
  }
  for (const f of rosters) namesIn(readSafe(join(rosterDir, f))).forEach(addPerson)
  EXTRA_PEOPLE.forEach(addPerson)

  return {
    people: [...people.values()],
    pieceSets: [...new Set([...pieceSets, ...EXTRA_PIECE_SETS])],
    boardThemes: [...new Set([...boardThemes, ...EXTRA_BOARD_THEMES])],
  }
}
