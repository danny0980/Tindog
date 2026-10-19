// Lists every campaign boss (and Chronos legend) that has no portrait image in
// the art pack, using exactly the name matching the game uses at runtime
// (portraitFor: exact name, aliases, then first / last name).
//
//   npm run assets:missing
//
// Reads public/assets/portraits. Files copied there by hand are first renamed
// to the name the game looks for (any case, spaces, "(1)", "portrait of" …),
// and portraits that match no character are listed so they can be renamed.
// @ts-expect-error — plain .mjs helper shared with the Node scripts (no type declarations).
import { buildManifest, logPortraitReport, normalizePortraitFolder } from './assets-lib.mjs'
// @ts-expect-error — plain .mjs helper (no type declarations).
import { loadCatalog } from './asset-catalog.mjs'
import { join } from 'node:path'
import { type ArtManifest, EMPTY_MANIFEST, portraitFor, sanitizeManifest, slugify } from '../src/assets/artManifest'
import { GRAND_REALMS } from '../src/data/campaign/realms'
import chronicle from '../src/data/campaign/rosters/chronicle'
import cosmic from '../src/data/campaign/rosters/cosmic'
import cyber from '../src/data/campaign/rosters/cyber'
import discovery from '../src/data/campaign/rosters/discovery'
import mythic from '../src/data/campaign/rosters/mythic'
import { LEGENDS } from '../src/data/legends'
import type { Boss, GrandRealmId } from '../src/types/campaign'

const ROSTERS: Record<GrandRealmId, readonly Boss[]> = { chronicle, mythic, discovery, cyber, cosmic }

const assetsDir = join(process.cwd(), 'public', 'assets')
const tidy = normalizePortraitFolder(assetsDir, loadCatalog(process.cwd())) as { renamed: unknown[]; duplicates: unknown[]; unnamed: string[] }
if (tidy.renamed.length + tidy.duplicates.length > 0) {
  console.log('Tidied public/assets/portraits:')
  logPortraitReport({ ...tidy, unnamed: [] })
  console.log('')
}
// Exactly what the game will see: the manifest after the runtime's own safety checks.
const manifest: ArtManifest = sanitizeManifest({ ...EMPTY_MANIFEST, ...(buildManifest(assetsDir) as Partial<ArtManifest>) })
const portraitCount = Object.keys(manifest.portraits).length

let missingTotal = 0
let bossTotal = 0
console.log(`Portraits found in public/assets/portraits: ${portraitCount}\n`)
console.log('GRAND CAMPAIGN BOSSES WITHOUT A PORTRAIT')
console.log('(id · name · file name that would match)\n')
for (const realm of GRAND_REALMS) {
  const roster = ROSTERS[realm.id]
  const missing = roster.filter((b) => !portraitFor(manifest, b.name))
  bossTotal += roster.length
  missingTotal += missing.length
  console.log(`${realm.name} — ${missing.length} of ${roster.length} missing`)
  for (const b of missing) console.log(`  #${String(b.index + 1).padStart(2)}  ${b.id.padEnd(34)} ${b.name.padEnd(32)} → ${slugify(b.name)}.png`)
  console.log('')
}

const legends = LEGENDS.filter((l) => !portraitFor(manifest, l.name))
console.log(`CHRONOS LEGENDS WITHOUT A PORTRAIT — ${legends.length} of ${LEGENDS.length} missing`)
for (const l of legends) console.log(`  ${l.id.padEnd(36)} ${l.name.padEnd(32)} → ${slugify(l.name)}.png`)

// Portrait files no character resolves to: usually a spelling the matcher can't place.
const used = new Set<string>()
for (const realm of GRAND_REALMS) for (const b of ROSTERS[realm.id]) {
  const hit = portraitFor(manifest, b.name)
  if (hit) used.add(hit)
}
for (const l of LEGENDS) {
  const hit = portraitFor(manifest, l.name)
  if (hit) used.add(hit)
}
const orphans = [...new Set([...Object.values(manifest.portraits).filter((path) => !used.has(path)), ...tidy.unnamed.map((f) => `portraits/${f}`)])]
if (orphans.length > 0) {
  console.log(`\nPORTRAIT FILES THAT MATCH NO CHARACTER — ${orphans.length} (rename them to a name from the lists above)`)
  for (const path of orphans) console.log(`  ${path}`)
}

console.log(`\nSummary: ${missingTotal} of ${bossTotal} campaign bosses and ${legends.length} of ${LEGENDS.length} legends have no portrait.`)
console.log('Name each image after the character (case, spaces and accents don’t matter), put it in your art folder and run npm run assets:import.')
