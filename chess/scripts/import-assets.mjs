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
//
// Sprite sheets are CUT here, not at runtime: the background (green screen or
// any flat colour) is removed, every piece is found wherever it sits on the
// sheet, recognised by its silhouette and saved as pieces/<set>/wK.png … bP.png.
// A "sheet" with no background to remove is really a board picture and is
// imported as one.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCatalog } from './asset-catalog.mjs'
import { buildManifest, classify, imageSize, listImages, logPortraitReport, normalizePortraitFolder, slugify } from './assets-lib.mjs'
import { decodePng, encodePng, sliceSheet } from './sprite-slicer.mjs'

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
/** Files that could not be read or written; the import carries on without them. */
const failedFiles = []
for (const rel of listImages(from, { skip: true })) {
  const full = join(from, ...rel.split('/'))
  let hit
  let bytes
  try {
    hit = classify(rel, catalog, imageSize(full))
    bytes = hit ? statSync(full).size : 0
  } catch (err) {
    failedFiles.push({ rel, reason: err instanceof Error ? err.message : String(err) })
    continue
  }
  if (!hit) {
    skipped.push(rel)
    continue
  }
  const prev = plan.get(hit.target)
  if (prev) {
    const keep = bytes > prev.bytes ? { rel, full, hit, bytes } : prev
    console.warn(`[assets] two files for ${hit.target}: keeping "${keep.rel}" (the larger)`)
    plan.set(hit.target, keep)
  } else plan.set(hit.target, { rel, full, hit, bytes })
}

/** The board theme a misnamed "sheet" belongs to: "Obsidian Lava.png" → obsidian-lava. */
function boardThemeFor(rel, set) {
  const base = slugify(rel.split('/').pop().replace(/\.[a-z0-9]+$/i, ''))
  const themes = catalog.boardThemes.filter((t) => t === set || t.startsWith(`${set}-`) || t.endsWith(`-${set}`))
  const named = themes.find((t) => t.split('-').every((w) => base.includes(w)))
  return named ?? themes[0] ?? set
}

// sharp (libvips) reads every format and scales; without it, plain PNG still works.
let sharp = null
try {
  sharp = (await import('sharp')).default
} catch {
  console.warn('[assets] "sharp" is not installed (run npm install) — only PNG sheets can be cut, at full size')
}

/** Any image → RGBA pixels. Huge sheets are scaled to 2400 px: plenty for 12 pieces, and fast. */
async function readPixels(file) {
  if (!sharp) return decodePng(readFileSync(file))
  const { data, info } = await sharp(file).rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { width: info.width, height: info.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length) }
}
/** One cut piece → a small file: 512 px WebP with sharp (tens of KB), else a full-size PNG. */
async function pieceFile(img) {
  if (!sharp) return { ext: 'png', bytes: encodePng(img) }
  const raw = Buffer.from(img.data.buffer, img.data.byteOffset, img.data.length)
  const bytes = await sharp(raw, { raw: { width: img.width, height: img.height, channels: 4 } })
    .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 90, alphaQuality: 100, effort: 5 })
    .toBuffer()
  return { ext: 'webp', bytes }
}

const write = (target, bytes) => {
  if (dryRun) return
  const dest = join(assetsDir, ...target.split('/'))
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, bytes)
}
/** Removes a set's earlier imports (old sheet, old cut pieces) so only the new cut is used. */
const dropOldPieces = (set) => {
  const dir = join(assetsDir, 'pieces', set)
  if (dryRun || !existsSync(dir)) return
  for (const f of readdirSync(dir)) if (/^(sheet|[wb][KQRBNP])\.(png|jpe?g|webp|gif|avif|json)$/i.test(f)) rmSync(join(dir, f))
}

const counts = { portrait: 0, piece: 0, sheet: 0, board: 0, avatar: 0, background: 0 }
let cut = 0
/** What happened to every sheet, for the visual report. */
const report = []
for (const { rel, full, hit, bytes } of [...plan.values()].sort((a, b) => a.hit.target.localeCompare(b.hit.target))) {
  try {
    await importOne(rel, full, hit, bytes)
  } catch (err) {
    failedFiles.push({ rel, reason: err instanceof Error ? err.message : String(err) })
    console.warn(`  ✗        ${rel}  — skipped: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/** Imports one file (cut, copy or route to a board); throws on I/O errors, which the loop above reports. */
async function importOne(rel, full, hit, bytes) {
  const mb = bytes / 1048576
  const big = mb > 2 ? `  (${mb.toFixed(1)} MB — consider WebP / smaller)` : ''
  if (hit.kind === 'sheet' && (sharp || /\.png$/i.test(rel))) {
    let result
    let keyed = null
    try {
      keyed = await readPixels(full)
      result = sliceSheet(keyed)
    } catch (err) {
      result = { error: `could not read the image (${err instanceof Error ? err.message : String(err)})` }
    }
    if (result.pieces) {
      counts.sheet += 1
      cut += 1
      console.log(`  cut      ${rel}  →  public/assets/pieces/${hit.set}/wK…bP  (${result.note})`)
      dropOldPieces(hit.set)
      const files = {}
      for (const [code, img] of Object.entries(result.pieces)) {
        const { ext, bytes: out } = await pieceFile(img)
        files[code] = `pieces/${hit.set}/${code}.${ext}`
        write(files[code], out)
      }
      report.push({ set: hit.set, rel, ok: true, note: result.note, files })
      return
    }
    if (/no background/.test(result.error)) {
      const theme = boardThemeFor(rel, hit.set)
      const target = `boards/${theme}/board.png`
      dropOldPieces(hit.set)
      if (plan.has(target)) return
      counts.board += 1
      console.log(`  board    ${rel}  →  public/assets/${target}  (no pieces on it — it is a board picture)${big}`)
      write(target, readFileSync(full))
      report.push({ set: hit.set, rel, ok: true, note: `a board picture → ${theme}`, files: { board: target } })
      return
    }
    // A file that can't even be decoded is not imported at all (the game keeps its built-in look).
    if (!keyed) throw new Error(result.error)
    // Couldn't find 12 pieces: keep the sheet, background removed, and slice it by grid.
    console.warn(`  sheet    ${rel}  →  public/assets/${hit.target}  ⚠ could not cut it: ${result.error}; using the grid instead`)
    counts.sheet += 1
    dropOldPieces(hit.set)
    const target = `pieces/${hit.set}/sheet.png`
    write(target, encodePng(keyed))
    report.push({ set: hit.set, rel, ok: false, note: result.error, files: { sheet: target } })
    return
  } else console.log(`  ${hit.kind.padEnd(8)} ${rel}  →  public/assets/${hit.target}${big}`)
  counts[hit.kind] += 1
  if (!dryRun) {
    const dest = join(assetsDir, ...hit.target.split('/'))
    mkdirSync(dirname(dest), { recursive: true })
    copyFileSync(full, dest)
  }
}

/** A page showing every cut set on a chessboard pattern — open it to check the result at a glance. */
function writeReport() {
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const stamp = Date.now()
  const rows = report
    .map((r) => {
      const cells = Object.entries(r.files)
        .map(([code, src]) => `<figure><div class="sq"><img src="${esc(src)}?v=${stamp}" alt=""></div><figcaption>${esc(code)}</figcaption></figure>`)
        .join('')
      return `<section class="${r.ok ? '' : 'bad'}"><h2>${esc(r.set)} <small>${esc(r.rel)}</small></h2><p>${r.ok ? '✓' : '⚠'} ${esc(r.note)}</p><div class="row">${cells}</div></section>`
    })
    .join('\n')
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Art import report</title>
<style>body{margin:0;padding:16px;background:#14110f;color:#eee;font:14px system-ui,sans-serif}h1{font-size:20px}h2{font-size:16px;margin:0}small{color:#999;font-weight:400}
section{background:#1f1a17;border-radius:10px;padding:12px;margin:12px 0}section.bad{outline:2px solid #e0a020}p{margin:4px 0 8px;color:#bbb}
.row{display:flex;flex-wrap:wrap;gap:6px}figure{margin:0;text-align:center}figcaption{font-size:12px;color:#aaa}
.sq{width:84px;height:84px;background:repeating-conic-gradient(#b58863 0 25%,#f0d9b5 0 50%) 0 0/42px 42px;display:flex;align-items:flex-end;justify-content:center}
.sq img{max-width:100%;max-height:100%}</style></head><body><h1>Art import report</h1>
<p>Every sprite sheet, cut into pieces. ⚠ = could not be cut (the grid is used) — send that image to get it tuned.</p>${rows}</body></html>`
  write('report.html', html)
}
if (report.length > 0) {
  writeReport()
  if (!dryRun) console.log('[assets] Visual report: npm run dev, then open http://localhost:5173/assets/report.html (use the port Vite prints)')
}

console.log(`\n[assets] ${dryRun ? 'Would import' : 'Imported'}: ${counts.portrait} portraits, ${counts.piece} piece images, ${counts.sheet} sprite sheets (${cut} cut into pieces), ${counts.board} board images, ${counts.avatar} avatars, ${counts.background} backgrounds`)
if (failedFiles.length > 0) {
  console.warn(`[assets] ${failedFiles.length} file(s) could not be read or written and were skipped (the game uses its built-in look for them):`)
  for (const f of failedFiles) console.warn(`  ✗ ${f.rel}: ${f.reason}`)
}
if (skipped.length > 0) {
  console.log(`[assets] Not recognised (${skipped.length}). Rename each to include a character, piece-set or board-theme name`)
  console.log('         (e.g. "Saladin.png", "aztec sprite sheet.png", "wild-west board.png") and run again:')
  for (const s of skipped) console.log(`  ? ${s}`)
}
if (!dryRun) {
  mkdirSync(assetsDir, { recursive: true })
  // Portraits copied straight into public/assets/portraits get canonical names too.
  logPortraitReport(normalizePortraitFolder(assetsDir, catalog))
  const manifest = buildManifest(assetsDir)
  writeFileSync(join(assetsDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`[assets] manifest: ${Object.keys(manifest.portraits).length} portraits, ${Object.keys(manifest.pieceSets).length} piece sets, ${Object.keys(manifest.boards).length} boards, ${Object.keys(manifest.avatars).length} avatars, ${Object.keys(manifest.backgrounds).length} backgrounds`)
}
