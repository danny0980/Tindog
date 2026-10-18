// Imports an art folder into the app: recognises portraits, piece sets (12
// images or one sprite sheet) and board themes, copies them into
// public/assets with standard names, and rebuilds the manifest.
//
//   npm run assets:import -- "C:\Users\you\Downloads\my-art"
//   npm run assets:import -- ./art --dry-run
//
// Folder names it understands (case and spaces don't matter):
//   portraits/ bosses/ legends/ characters/     → one image per character, named after them
//   pieces/<set name>/wK.png … bP.png            → 12 images ("white king", "w_k", "bn" also work)
//   pieces/<set name>/sheet.png  or pieces/<set name>.png → one sprite sheet (6×2: K Q R B N P, White row first)
//   boards/<theme name>/board.png | light.png + dark.png | frame.png
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildManifest, classify, listImages } from './assets-lib.mjs'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const source = args.find((a) => !a.startsWith('--'))
if (!source) {
  console.error('Usage: npm run assets:import -- "<path to your art folder>" [--dry-run]')
  process.exit(1)
}
const from = resolve(source)
if (!existsSync(from)) {
  console.error(`[assets] Folder not found: ${from}`)
  process.exit(1)
}
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const assetsDir = join(root, 'public', 'assets')

const counts = { portrait: 0, piece: 0, sheet: 0, board: 0 }
const skipped = []
const seen = new Map()
for (const rel of listImages(from)) {
  const hit = classify(rel)
  if (!hit) {
    skipped.push(rel)
    continue
  }
  if (seen.has(hit.target)) {
    console.warn(`[assets] ${rel} → ${hit.target} replaces ${seen.get(hit.target)}`)
  }
  seen.set(hit.target, rel)
  counts[hit.kind] += 1
  if (!dryRun) {
    const dest = join(assetsDir, ...hit.target.split('/'))
    mkdirSync(dirname(dest), { recursive: true })
    copyFileSync(join(from, ...rel.split('/')), dest)
  }
  console.log(`  ${hit.kind.padEnd(8)} ${rel}  →  public/assets/${hit.target}`)
}

console.log(`\n[assets] ${dryRun ? 'Would import' : 'Imported'}: ${counts.portrait} portraits, ${counts.piece} piece images, ${counts.sheet} sprite sheets, ${counts.board} board images`)
if (skipped.length > 0) {
  console.log(`[assets] Not recognised (${skipped.length}) — move them into portraits/, pieces/<set>/ or boards/<theme>/ and run again:`)
  for (const s of skipped) console.log(`  ? ${s}`)
}
if (!dryRun) {
  mkdirSync(assetsDir, { recursive: true })
  const manifest = buildManifest(assetsDir)
  writeFileSync(join(assetsDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`[assets] manifest: ${Object.keys(manifest.portraits).length} portraits, ${Object.keys(manifest.pieceSets).length} piece sets, ${Object.keys(manifest.boards).length} boards`)
}
