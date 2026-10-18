// Imports art into the game. Point it at any folder — even a flat pile of
// images — and it sorts every file BY ITS NAME:
//   characters (Blackbeard, Napoleon, Cleopatra, Ragnar, Ninja Leader …) → portraits
//   piece set names (standard, obsidian, aztec, lacquer …) or "sprite sheet" → piece sets
//   single pieces ("wK", "White King", "aztec_bN" …)                       → piece sets
//   board themes (classic-wood, oled-black, wild-west …; "… light/dark/frame") → boards
//   "player-avatar-…"                                                        → player avatars
//   "…-bg", "… background", "… screen", "world-map…" (victory, defeat, loading …) → screen backgrounds
// Case, spaces, underscores and accents don't matter; folders are optional.
//
//   npm run assets:import                                   (scans the chess folder itself)
//   npm run assets:import -- "C:\Users\you\Downloads\art"   (scans that folder)
//   … add --dry-run to preview without copying anything.
import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCatalog } from './asset-catalog.mjs'
import { buildManifest, classify, imageSize, listImages } from './assets-lib.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const source = args.find((a) => !a.startsWith('--'))
const from = resolve(source ?? root)
if (!existsSync(from)) {
  console.error(`[assets] Folder not found: ${from}`)
  process.exit(1)
}
const assetsDir = join(root, 'public', 'assets')
const catalog = loadCatalog(root)
console.log(`[assets] Scanning ${from}`)
console.log(`[assets] Recognises ${catalog.people.length} characters, ${catalog.pieceSets.length} piece sets, ${catalog.boardThemes.length} board themes\n`)

/** Chosen source per destination: when two files map to the same place, the bigger (higher-quality) one wins. */
const plan = new Map()
const skipped = []
// The app's own folders (src, public, node_modules …) are never scanned.
for (const rel of listImages(from, { skip: true })) {
  const full = join(from, ...rel.split('/'))
  const hit = classify(rel, catalog, imageSize(full))
  if (!hit) {
    skipped.push(rel)
    continue
  }
  const bytes = statSync(full).size
  const prev = plan.get(hit.target)
  if (prev) {
    const keep = bytes > prev.bytes ? { rel, full, hit, bytes } : prev
    console.warn(`[assets] two files for ${hit.target}: keeping "${keep.rel}" (the larger)`)
    plan.set(hit.target, keep)
  } else plan.set(hit.target, { rel, full, hit, bytes })
}

const counts = { portrait: 0, piece: 0, sheet: 0, board: 0, avatar: 0, background: 0 }
for (const { rel, full, hit, bytes } of [...plan.values()].sort((a, b) => a.hit.target.localeCompare(b.hit.target))) {
  counts[hit.kind] += 1
  const mb = bytes / 1048576
  console.log(`  ${hit.kind.padEnd(8)} ${rel}  →  public/assets/${hit.target}${mb > 2 ? `  (${mb.toFixed(1)} MB — consider WebP / smaller)` : ''}`)
  if (!dryRun) {
    const dest = join(assetsDir, ...hit.target.split('/'))
    mkdirSync(dirname(dest), { recursive: true })
    copyFileSync(full, dest)
  }
}

console.log(`\n[assets] ${dryRun ? 'Would import' : 'Imported'}: ${counts.portrait} portraits, ${counts.piece} piece images, ${counts.sheet} sprite sheets, ${counts.board} board images, ${counts.avatar} avatars, ${counts.background} backgrounds`)
if (skipped.length > 0) {
  console.log(`[assets] Not recognised (${skipped.length}). Rename each to include a character, piece-set or board-theme name`)
  console.log('         (e.g. "Saladin.png", "aztec sprite sheet.png", "wild-west board.png") and run again:')
  for (const s of skipped) console.log(`  ? ${s}`)
}
if (!dryRun) {
  mkdirSync(assetsDir, { recursive: true })
  const manifest = buildManifest(assetsDir)
  writeFileSync(join(assetsDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`[assets] manifest: ${Object.keys(manifest.portraits).length} portraits, ${Object.keys(manifest.pieceSets).length} piece sets, ${Object.keys(manifest.boards).length} boards, ${Object.keys(manifest.avatars).length} avatars, ${Object.keys(manifest.backgrounds).length} backgrounds`)
}
