// Art audit: lists every campaign boss, Classic Chess opponent and Chronos legend with no portrait,
// and every relic, UI icon and screen background still without art — using
// exactly the matching the game uses at runtime — plus files the game can't
// place anywhere (characters / relics that aren't in the game).
//
//   npm run assets:missing                       (what the game has now: public/assets)
//   npm run assets:missing -- "C:\\path\\to\\chess app"  (preview a source folder, all subfolders, before importing)
//
// Reads public/assets/portraits. Files copied there by hand are first renamed
// to the name the game looks for (any case, spaces, "(1)", "portrait of" …),
// and portraits that match no character are listed so they can be renamed.
// @ts-expect-error — plain .mjs helper shared with the Node scripts (no type declarations).
import { buildManifest, cleanPathArg, logPortraitReport, normalizePortraitFolder, planImport } from './assets-lib.mjs'
// @ts-expect-error — plain .mjs helper (no type declarations).
import { loadCatalog } from './asset-catalog.mjs'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { type ArtManifest, type BackgroundSlot, EMPTY_MANIFEST, ICON_SLOTS, ICON_SLOT_IDS, backgroundsFor, iconFor, portraitFor, relicArtFor, sanitizeManifest, slugify } from '../src/assets/artManifest'
import { CLASSIC_ERAS, CLASSIC_ROSTER } from '../src/data/classic/roster'
import { RELICS } from '../src/data/campaign/relics'
import { GRAND_REALMS } from '../src/data/campaign/realms'
import chronicle from '../src/data/campaign/rosters/chronicle'
import cosmic from '../src/data/campaign/rosters/cosmic'
import cyber from '../src/data/campaign/rosters/cyber'
import discovery from '../src/data/campaign/rosters/discovery'
import mythic from '../src/data/campaign/rosters/mythic'
import { LEGENDS } from '../src/data/legends'
import type { Boss, GrandRealmId } from '../src/types/campaign'

const ROSTERS: Record<GrandRealmId, readonly Boss[]> = { chronicle, mythic, discovery, cyber, cosmic }

const root = process.cwd()
const assetsDir = join(root, 'public', 'assets')
const catalog = loadCatalog(root)
const sourceArg = process.argv.slice(2).find((a) => !a.startsWith('--'))
type Tidy = { renamed: unknown[]; duplicates: unknown[]; unnamed: string[] }
let tidy: Tidy = { renamed: [], duplicates: [], unnamed: [] }
let raw: Partial<ArtManifest>
if (sourceArg) {
  // Preview a source folder: every subfolder is classified exactly as assets:import would, nothing is copied.
  const from = resolve(cleanPathArg(sourceArg))
  if (!existsSync(from)) {
    console.error(`Folder not found: ${from}`)
    process.exit(1)
  }
  const scan = planImport(from, catalog, { exclude: from === resolve(root) ? [] : [root] }) as {
    plan: Map<string, { rel: string; hit: { kind: string; key?: string; target: string } }>
    skipped: string[]
    folders: Map<string, Record<string, number>>
  }
  console.log(`Previewing ${from} (all subfolders; nothing is copied — run npm run assets:import to import)\n`)
  for (const [folder, counts] of [...scan.folders.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`  ${(folder === '.' ? '(top folder)' : folder).padEnd(34)} ${Object.entries(counts).map(([k, n]) => `${n} ${k === 'unknown' ? 'not recognised' : k}`).join(', ')}`)
  }
  if (scan.skipped.length > 0) {
    console.log(`\nNot recognised (${scan.skipped.length}) — rename after a character, relic or icon:`)
    for (const rel of scan.skipped) console.log(`  ? ${rel}`)
  }
  console.log('')
  const fields: Record<string, Record<string, string>> = { portrait: {}, relic: {}, icon: {}, background: {} }
  for (const { hit } of scan.plan.values()) {
    const field = fields[hit.kind]
    if (field) field[hit.target.split('/').pop()?.replace(/\.[a-z0-9]+$/i, '') ?? ''] = hit.target
  }
  raw = { portraits: fields.portrait, relics: fields.relic, icons: fields.icon, backgrounds: fields.background }
} else {
  tidy = normalizePortraitFolder(assetsDir, catalog) as Tidy
  if (tidy.renamed.length + tidy.duplicates.length > 0) {
    console.log('Tidied public/assets/portraits:')
    logPortraitReport({ ...tidy, unnamed: [] })
    console.log('')
  }
  raw = buildManifest(assetsDir) as Partial<ArtManifest>
}
// Exactly what the game will see: the manifest after the runtime's own safety checks.
const manifest: ArtManifest = sanitizeManifest({ ...EMPTY_MANIFEST, ...raw })
const portraitCount = Object.keys(manifest.portraits).length

let missingTotal = 0
let bossTotal = 0
console.log(`Portraits found${sourceArg ? ' in the folder' : ' in public/assets/portraits'}: ${portraitCount}\n`)
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

const classicMissing = CLASSIC_ROSTER.filter((c) => !portraitFor(manifest, c.name))
console.log(`CLASSIC CHESS OPPONENTS WITHOUT A PORTRAIT — ${classicMissing.length} of ${CLASSIC_ROSTER.length} missing`)
for (const era of CLASSIC_ERAS) {
  const missing = classicMissing.filter((c) => c.era === era.id)
  if (missing.length === 0) continue
  console.log(`${era.name} — ${missing.length} of ${CLASSIC_ROSTER.filter((c) => c.era === era.id).length} missing`)
  for (const c of missing) console.log(`  #${String(c.rank + 1).padStart(3)}  ${c.id.padEnd(22)} ${c.name.padEnd(32)} → ${slugify(c.name)}.png`)
}
console.log('')

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
for (const c of CLASSIC_ROSTER) {
  const hit = portraitFor(manifest, c.name)
  if (hit) used.add(hit)
}
const orphans = [...new Set([...Object.values(manifest.portraits).filter((path) => !used.has(path)), ...tidy.unnamed.map((f) => `portraits/${f}`)])]
if (orphans.length > 0) {
  console.log(`\nPORTRAITS OF CHARACTERS NOT IN THE GAME (or misspelt) — ${orphans.length}: they show nowhere until renamed after a character above`)
  for (const path of orphans) console.log(`  ${path}`)
}

// ── Relics ─────────────────────────────────────────────────────────────────
const relicsMissing = RELICS.filter((r) => !relicArtFor(manifest, r))
console.log(`\nRELICS WITHOUT ART — ${relicsMissing.length} of ${RELICS.length} missing`)
for (const r of relicsMissing) console.log(`  ${r.id.padEnd(22)} ${r.name.padEnd(26)} → relic-${r.id}.png`)
const relicIds = new Set(RELICS.flatMap((r) => [r.id, slugify(r.name)]))
const strayRelics = Object.entries(manifest.relics).filter(([key]) => !relicIds.has(key))
if (strayRelics.length > 0) {
  console.log(`  Relic images that match no relic in the game (${strayRelics.length}):`)
  for (const [, path] of strayRelics) console.log(`    ${path}`)
}

// ── UI icons ───────────────────────────────────────────────────────────────
const iconsMissing = ICON_SLOT_IDS.filter((slot) => !iconFor(manifest, slot))
console.log(`\nUI ICONS WITHOUT ART — ${iconsMissing.length} of ${ICON_SLOT_IDS.length} missing`)
for (const slot of iconsMissing) console.log(`  ${slot.padEnd(16)} → icon-${ICON_SLOTS[slot][0]}.png  (also: ${ICON_SLOTS[slot].slice(1).map((n) => `icon-${n}`).join(', ')})`)
const iconNames = new Set<string>(Object.values(ICON_SLOTS).flat())
const strayIcons = Object.entries(manifest.icons).filter(([key]) => !iconNames.has(key))
if (strayIcons.length > 0) {
  console.log(`  Icon images with no place in the game yet (${strayIcons.length}):`)
  for (const [, path] of strayIcons) console.log(`    ${path}`)
}

// ── Screens & arenas ───────────────────────────────────────────────────────
const SCREENS: Record<BackgroundSlot, string> = { victory: 'victory-screen-bg', defeat: 'defeat-screen-bg', loading: 'loading-screen-bg', map: 'world-map-bg', realm: 'chrono-realm-bg' }
const screensMissing = (Object.keys(SCREENS) as BackgroundSlot[]).filter((slot) => backgroundsFor(manifest, slot).length === 0)
console.log(`\nSCREEN BACKGROUNDS WITHOUT ART — ${screensMissing.length} of ${Object.keys(SCREENS).length} missing`)
for (const slot of screensMissing) console.log(`  ${slot.padEnd(10)} → ${SCREENS[slot]}.png`)
const arenas = Object.keys(manifest.backgrounds).filter((k) => k.startsWith('arena-'))
console.log(`Arena backdrops (pick one in the battle Loadout): ${arenas.length}${arenas.length === 0 ? ' — put images in an "arenas" folder, or name them "arena-…"' : ''}`)

// ── Piece sets ─────────────────────────────────────────────────────────────
const uncut = Object.entries(manifest.pieceSets).filter(([, set]) => !set.files && set.sheet)
console.log(`\nPIECE SETS: ${Object.keys(manifest.pieceSets).length} · boards: ${Object.keys(manifest.boards).length}`)
if (uncut.length > 0) {
  console.log(`  Still a grid-sliced sprite sheet (could not be cut into 12 pieces) — ${uncut.length}:`)
  for (const [id] of uncut) console.log(`    ${id}`)
}

console.log(`\nSummary: ${missingTotal} of ${bossTotal} campaign bosses, ${classicMissing.length} of ${CLASSIC_ROSTER.length} Classic opponents and ${legends.length} of ${LEGENDS.length} legends have no portrait; ${relicsMissing.length} relics, ${iconsMissing.length} icons and ${screensMissing.length} screens have no art.`)
console.log('Name each image as shown (case, spaces and accents don’t matter), put it in your art folder and run npm run assets:import.')
