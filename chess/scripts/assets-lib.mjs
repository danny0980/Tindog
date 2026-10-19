// Shared helpers for the art-pack scripts (plain Node, no dependencies, works on
// Windows, macOS and Linux): name normalisation, image-size sniffing, and the
// rules that recognise portraits, piece sets / sprite sheets and board themes.
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'

export const IMAGE_EXTENSIONS = ['.png', '.webp', '.jpg', '.jpeg', '.jfif', '.gif', '.avif', '.svg']
export const PIECE_CODES = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP']

/** "Hattori Hanzō (portrait).PNG" → "hattori-hanzo-portrait" */
export function slugify(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const isImage = (file) => IMAGE_EXTENSIONS.includes(extname(file).toLowerCase())

/** Folders never scanned for art (the app's own code, builds and dependencies). */
export const SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-ssr', '.git', 'public', 'src', 'android', 'ios', 'scripts', 'tests', 'coverage', '.vite', '.idea', '.vscode'])

/** Every image under `dir`, recursively (paths relative to `dir`), skipping SKIP_DIRS when asked, and any folder in `exclude` (absolute paths). */
export function listImages(dir, { skip = false, exclude = [] } = {}) {
  const excluded = new Set(exclude.map((p) => resolve(p).toLowerCase()))
  const out = []
  const walk = (current) => {
    let names = []
    try {
      names = readdirSync(current)
    } catch {
      return // unreadable folder (permissions, a broken link): skip it, keep scanning
    }
    for (const name of names) {
      if (name.startsWith('.')) continue
      const full = join(current, name)
      let st
      try {
        st = statSync(full)
      } catch {
        continue
      }
      if (st.isDirectory()) {
        if (!(skip && SKIP_DIRS.has(name.toLowerCase())) && !excluded.has(resolve(full).toLowerCase())) walk(full)
      } else if (isImage(name)) out.push(relative(dir, full).split(sep).join('/'))
    }
  }
  walk(dir)
  return out.sort()
}

// ── Image dimensions (PNG, JPEG, WebP, GIF headers) ─────────────────────────

/** Width and height from the file header, or null when unknown (e.g. SVG). */
export function imageSize(file) {
  try {
    return readImageSize(file)
  } catch {
    return null // a truncated or corrupt header is "size unknown", never a crash
  }
}

function readImageSize(file) {
  let b
  try {
    b = readFileSync(file)
  } catch {
    return null
  }
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }
  if (b.length > 10 && b.toString('ascii', 0, 3) === 'GIF') return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) }
  if (b.length > 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = b.toString('ascii', 12, 16)
    if (chunk === 'VP8X') return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) }
    if (chunk === 'VP8L') {
      const bits = b.readUInt32LE(21)
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
    }
    if (chunk === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff }
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i += 1
        continue
      }
      const marker = b[i + 1]
      const len = b.readUInt16BE(i + 2)
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) }
      }
      i += 2 + len
    }
  }
  return null
}

/**
 * Grid of a piece sprite sheet from its aspect ratio: 6×2 (default), 2×6,
 * 12×1 or 1×12. Pieces are read in K Q R B N P order, White first.
 */
export function sheetGrid(size) {
  if (!size || !size.width || !size.height) return { cols: 6, rows: 2 }
  const r = size.width / size.height
  if (r > 8) return { cols: 12, rows: 1 }
  if (r < 1 / 8) return { cols: 1, rows: 12 }
  if (r < 1) return { cols: 2, rows: 6 }
  return { cols: 6, rows: 2 }
}

// ── Recognising what a file is ──────────────────────────────────────────────

const TYPE_WORDS = { king: 'K', queen: 'Q', rook: 'R', castle: 'R', tower: 'R', bishop: 'B', knight: 'N', horse: 'N', pawn: 'P', soldier: 'P' }
const COLOR_WORDS = { white: 'w', light: 'w', w: 'w', black: 'b', dark: 'b', b: 'b' }

/** Piece code from a file name: "wK", "w_k", "white-king", "King Black", "bn"… or null. */
export function pieceCode(fileName) {
  const base = slugify(fileName.replace(/\.[a-z0-9]+$/i, ''))
  const compact = base.replace(/-/g, '')
  const direct = /^([wb])([kqrbnp])$/.exec(compact)
  if (direct) return `${direct[1]}${direct[2].toUpperCase()}`
  const parts = base.split('-')
  let type = null
  for (const p of parts) if (!type && TYPE_WORDS[p]) type = TYPE_WORDS[p]
  // "white"/"black" beat "light"/"dark" (which also appear in set names like "dark-fantasy").
  const strong = parts.find((p) => p === 'white' || p === 'black' || p === 'w' || p === 'b')
  const weak = parts.find((p) => p === 'light' || p === 'dark')
  const color = strong ? COLOR_WORDS[strong] : weak ? COLOR_WORDS[weak] : null
  // "white-k" style — the type letter must be a different word than the colour ("b-analysis" is not a piece).
  if (color && !type) {
    const colorAt = parts.indexOf(strong ?? weak ?? '')
    const letter = parts.find((p, i) => i !== colorAt && /^[kqrbnp]$/.test(p))
    if (letter) type = letter.toUpperCase()
  }
  return color && type ? `${color}${type}` : null
}

const PORTRAIT_FOLDERS = /^(portraits?|bosses|boss|legends?|characters?|heroes|faces|avatars?)$/
const PIECE_FOLDERS = /^(pieces?|piece-sets?|sets?|sprites?|sprite-sheets?|soldiers|armies|chessmen)$/
const BOARD_FOLDERS = /^(boards?|board-themes?|themes?|tiles?|textures?)$/
const NOISE = /-(portrait|boss|legend|character|sheet|sprite|spritesheet|sprite-sheet|set|pieces|board|theme|texture|tile|final|v\d+|\d+x\d+)$/

const stripNoise = (slug) => {
  let s = slug
  for (let i = 0; i < 4; i++) s = s.replace(NOISE, '')
  return s
}

/** Whole-word containment: does slug `hay` contain the slug `needle` as complete words? */
const hasWords = (hay, needle) => Boolean(needle) && `-${hay}-`.includes(`-${needle}-`)

/** Longest catalog entry contained (as whole words) in `slug`. */
function longestMatch(slug, entries) {
  let best = null
  for (const e of entries) if (hasWords(slug, e) && (!best || e.length > best.length)) best = e
  return best
}

/** The relic a filename names: its id ("smoke-veil") or the words of its name ("Oberon's Fae Gold" → fae-gold). */
function matchRelic(slug, relics) {
  let best = null
  for (const r of relics) {
    for (const v of [r.id, slugify(r.name)]) if (hasWords(slug, v) && (!best || v.length > best.len)) best = { id: r.id, len: v.length }
  }
  return best?.id ?? null
}

/** The character a filename names (longest matching variant), if any. */
function matchPerson(slug, people) {
  let best = null
  for (const p of people) {
    for (const v of p.variants) if (hasWords(slug, v) && (!best || v.length > best.len)) best = { key: p.key, len: v.length }
  }
  return best
}

// ── Portrait names ──────────────────────────────────────────────────────────

/** Words that decorate a portrait's file name without naming anyone. */
const PORTRAIT_NOISE = new Set([
  'portrait', 'portraits', 'boss', 'legend', 'character', 'face', 'hero', 'art', 'artwork', 'image', 'img', 'pic', 'picture', 'photo',
  'final', 'copy', 'edit', 'edited', 'new', 'hd', 'uhd', 'hq', 'hi', 'res', 'hires', '4k', '8k', '2k', 'small', 'large', 'big', 'square', 'crop', 'cropped',
  'by', 'generated', 'ai', 'gemini', 'midjourney', 'dalle', 'upscaled', 'upscale',
])

/** "SunTzu" → "Sun Tzu" (camelCase file names). */
const splitCamel = (text) => String(text).replace(/([a-z])([A-Z])/g, '$1 $2')

/** A file name with the decoration removed: numbering, "(1)", "copy", "portrait of", "v2", "1024x1024", "final" … */
export function cleanPortraitName(stem) {
  const words = slugify(splitCamel(stem))
    .split('-')
    .filter((w) => w && !PORTRAIT_NOISE.has(w) && !/^v\d+$/.test(w) && !/^\d+x\d+$/.test(w) && !/^\d+$/.test(w))
  // "Portrait of Napoleon" → "napoleon" (the decoration took "portrait"; drop the dangling "of").
  while (words[0] === 'of') words.shift()
  return words.join('-')
}

/**
 * The canonical portrait key for an image file name: the character it names
 * (from the game's catalog, so "portrait_napoleon_final (1).PNG" →
 * "napoleon-bonaparte"), or its cleaned-up name when it names nobody known.
 */
export function portraitKey(fileName, catalog = null) {
  const stem = fileName.replace(/\.[a-z0-9]+$/i, '')
  const cleaned = cleanPortraitName(stem)
  const people = catalog?.people ?? []
  const person = matchPerson(cleaned, people) ?? matchPerson(slugify(splitCamel(stem)), people) ?? matchPerson(slugify(stem), people)
  return person ? person.key : cleaned
}

/** The character key a portrait file names, or null when it names no known character. */
export function portraitPerson(fileName, catalog) {
  const stem = fileName.replace(/\.[a-z0-9]+$/i, '')
  const people = catalog?.people ?? []
  const cleaned = cleanPortraitName(stem)
  return (matchPerson(cleaned, people) ?? matchPerson(slugify(splitCamel(stem)), people) ?? matchPerson(slugify(stem), people) ?? nearPerson(cleaned, people))?.key ?? null
}

/** Copy markers off an asset name: "starforged-crown1" → "starforged-crown", "boss-rush (2) copy" → "boss-rush". */
export function tidyAssetName(slug) {
  return slug
    .replace(/(?<=[a-z])\d+(?=-|$)/g, '')
    .split('-')
    .filter((w) => w && !/^\d+$/.test(w) && !['copy', 'final', 'new', 'edit', 'edited', 'hd', 'v1', 'v2', 'v3'].includes(w))
    .join('-')
}

/** Edit distance (insert / delete / substitute), for forgiving small spelling slips. */
function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return row[b.length]
}

/**
 * A character whose name is spelt almost like the file ("major-tesseract" →
 * Major Tessaract): one slip allowed in names of 6+ letters, two in 12+.
 * Only the full name (or the name without its title) counts, never one word.
 */
function nearPerson(slug, people) {
  if (!slug || slug.length < 6) return null
  let best = null
  for (const p of people) {
    for (const v of p.variants.slice(0, 3)) {
      if (v.length < 6 || Math.abs(v.length - slug.length) > 2) continue
      const d = editDistance(slug, v)
      if (d <= (v.length >= 12 ? 2 : 1) && (!best || d < best.d)) best = { key: p.key, len: v.length, d }
    }
  }
  return best
}

const CANONICAL_EXT = { '.jpeg': '.jpg', '.jfif': '.jpg' }

/**
 * Renames every image in public/assets/portraits to its canonical, URL-safe
 * name (lower-case slug + lower-case extension): files copied in by hand with
 * any spelling are found by the game exactly like imported ones. Two files
 * for one character: the larger stays, the other moves to portraits/duplicates.
 * Returns what changed. `dryRun` only reports.
 */
export function normalizePortraitFolder(assetsDir, catalog = null, { dryRun = false } = {}) {
  const dir = join(assetsDir, 'portraits')
  const report = { renamed: [], duplicates: [], unnamed: [], moved: [] }
  if (!existsSync(dir)) return report
  let files = []
  try {
    files = readdirSync(dir).filter((f) => isImage(f) && statSync(join(dir, f)).isFile())
  } catch {
    return report
  }
  const size = (f) => {
    try {
      return statSync(join(dir, f)).size
    } catch {
      return 0
    }
  }
  // Pick one file per key (the larger), canonical names first so a re-run changes nothing.
  const chosen = new Map()
  const misplaced = { icon: /^icons?-/, relic: /^relics?-/, background: /(^|-)(arenas?|bg|background)(-|$)/ }
  for (const f of [...files]) {
    const stem = slugify(f.replace(/\.[a-z0-9]+$/i, ''))
    const kind = Object.entries(misplaced).find(([, re]) => re.test(stem))?.[0]
    if (!kind) continue
    // An icon / relic / arena that landed among the portraits (an older import): give it back to its own folder.
    files.splice(files.indexOf(f), 1)
    const hit = classify(f, catalog)
    const target = hit && hit.kind === kind ? hit.target : null
    report.moved.push({ from: f, to: target ?? 'portraits/duplicates/' + f })
    if (dryRun) continue
    if (target && !existsSync(join(assetsDir, ...target.split('/')))) {
      mkdirSync(dirname(join(assetsDir, ...target.split('/'))), { recursive: true })
      renameSync(join(dir, f), join(assetsDir, ...target.split('/')))
    } else {
      mkdirSync(join(dir, 'duplicates'), { recursive: true })
      renameSync(join(dir, f), join(dir, 'duplicates', f))
    }
  }
  for (const f of files) {
    const ext = extname(f).toLowerCase()
    // Only files that name a known character are renamed; anything else keeps its name and is reported.
    const key = catalog ? portraitPerson(f, catalog) : portraitKey(f, null) || null
    if (!key) {
      report.unnamed.push(f)
      continue
    }
    const target = `${key}${CANONICAL_EXT[ext] ?? ext}`
    const prev = chosen.get(key)
    if (!prev || size(f) > size(prev.file) || (size(f) === size(prev.file) && f === target)) {
      if (prev) report.duplicates.push(prev.file)
      chosen.set(key, { file: f, target })
    } else report.duplicates.push(f)
  }
  if (!dryRun && report.duplicates.length > 0) mkdirSync(join(dir, 'duplicates'), { recursive: true })
  for (const f of report.duplicates) if (!dryRun) renameSync(join(dir, f), join(dir, 'duplicates', f))
  for (const { file, target } of chosen.values()) {
    if (file === target) continue
    report.renamed.push({ from: file, to: target })
    if (dryRun) continue
    // Two steps, so a change of case alone ("Thor.PNG" → "thor.png") also works on Windows / macOS.
    const temp = join(dir, `.renaming-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    renameSync(join(dir, file), temp)
    renameSync(temp, join(dir, target))
  }
  return report
}

/** Prints what normalizePortraitFolder changed. */
export function logPortraitReport(report, log = console.log) {
  for (const m of report.moved ?? []) log(`  not a portrait    ${m.from}  →  ${m.to}`)
  for (const r of report.renamed) log(`  portrait renamed  ${r.from}  →  ${r.to}`)
  for (const f of report.duplicates) log(`  portrait duplicate ${f}  →  portraits/duplicates/ (a larger image of the same character is kept)`)
  for (const f of report.unnamed) log(`  portrait unknown  ${f}  (names no character — rename it after one; see npm run assets:missing)`)
}

const COLOR_TYPE_WORDS = new Set(['w', 'b', 'white', 'black', 'light', 'dark', 'king', 'queen', 'rook', 'castle', 'tower', 'bishop', 'knight', 'horse', 'pawn', 'soldier'])
const ROLE_WORDS = { light: 'light', white: 'light', dark: 'dark', black: 'dark', frame: 'frame', border: 'frame' }
const SHEET_HINT = /(^|-)(sheet|sprite|sprites|spritesheet|pieces|piece-set|set|chessmen)(-|$)/
const BOARD_HINT = /(^|-)(board|tile|tiles|texture|theme|chessboard)(-|$)/
const PORTRAIT_HINT = /(^|-)(portrait|boss|legend|character|face|hero)(-|$)/
/** "player-avatar-knight", "avatar mage" → a player avatar. */
const AVATAR_HINT = /(^|-)(player-avatar|avatar|player-icon)(-|$)/
/** Full-screen art: "victory-screen-bg", "loading screen space", "world-map-campaign", "chrono realm background". */
const BACKGROUND_HINT = /(^|-)(bg|background|backdrop|wallpaper|splash|screen|world-map|map)(-|$)/
const stripBackground = (slug) => slug.replace(/(^|-)(bg|background|backdrop|wallpaper)(?=-|$)/g, '').replace(/^-+|-+$/g, '').replace(/--+/g, '-')

/** A sprite sheet's shape: clearly wider or taller than square (6×2, 2×6, 12×1, 1×12). */
const sheetShaped = (size) => Boolean(size && size.width && size.height && (size.width / size.height >= 2.4 || size.width / size.height <= 1 / 2.4))

/** Board role from the words left after removing the theme name. */
function boardRole(slug, theme) {
  const rest = `-${slug}-`.replace(`-${theme}-`, '-').split('-').filter(Boolean)
  for (const w of rest) if (ROLE_WORDS[w]) return ROLE_WORDS[w]
  return 'board'
}

/**
 * Classifies one source image (path relative to the art folder) into where it
 * belongs in public/assets — by its NAME first, so a flat folder of files
 * works: "Napoleon.png" → portrait, "obsidian wK.png" → piece, "Aztec.png" →
 * sprite sheet, "classic-wood dark.png" → board tile. Folder names are only
 * a fallback hint. `catalog` comes from asset-catalog.mjs; `size` (width /
 * height) breaks set-vs-board ties and spots unnamed sprite sheets.
 * Returns null for files it can't place.
 */
export function classify(relPath, catalog = null, size = null) {
  const parts = relPath.split('/')
  const file = parts[parts.length - 1] ?? ''
  const ext = extname(file).toLowerCase()
  const base = slugify(file.slice(0, file.length - ext.length))
  const folders = parts.slice(0, -1).map(slugify)
  const cat = catalog ?? { people: [], pieceSets: [], boardThemes: [] }
  if (!base) return null

  // 1. A single piece: "wK", "white king", "obsidian_bN", "Aztec Black Queen" …
  const words = base.split('-')
  const codeWord = words.find((w) => /^[wb][kqrbnp]$/.test(w))
  const code = pieceCode(file) ?? (codeWord ? `${codeWord[0]}${codeWord[1]?.toUpperCase()}` : null)
  if (code) {
    const rest = words.filter((w) => !COLOR_TYPE_WORDS.has(w) && w !== codeWord).join('-')
    const folderSet = folders.length ? stripNoise(folders[folders.length - 1] ?? '') : ''
    const known = longestMatch(base, cat.pieceSets) ?? (folderSet ? longestMatch(folderSet, cat.pieceSets) : null)
    const set = known ?? (stripNoise(rest) || (folderSet && !PIECE_FOLDERS.test(folderSet) ? folderSet : '') || 'custom')
    return { kind: 'piece', set, code, target: `pieces/${set}/${code}${ext}` }
  }

  // 2. Relics, UI icons, arenas, player avatars and full-screen backgrounds are named by purpose, not by character.
  const inFolder = (re) => folders.some((f) => re.test(f))
  if (/^relics?(-|$)/.test(base) || inFolder(/^relics?$/)) {
    const tidy = tidyAssetName(base.replace(/^relics?-/, '')) || base
    const key = matchRelic(tidy, cat.relics ?? []) ?? matchRelic(base, cat.relics ?? []) ?? tidy
    return { kind: 'relic', key, target: `relics/${key}${ext}` }
  }
  if (/^icons?(-|$)/.test(base) || inFolder(/^(icons?|ui-icons?)$/)) {
    const key = tidyAssetName(base.replace(/^icons?-/, '')) || base
    return { kind: 'icon', key, target: `icons/${key}${ext}` }
  }
  if (/(^|-)arenas?(-|$)/.test(base) || inFolder(/^arenas?$/)) {
    const key = `arena-${base.replace(/(^|-)arenas?(?=-|$)/g, '').replace(/^-+|-+$/g, '') || 'default'}`
    return { kind: 'background', key, target: `backgrounds/${key}${ext}` }
  }
  if (AVATAR_HINT.test(base)) {
    const key = base.replace(/(^|-)(player-avatar|player-icon|avatar|player)(?=-|$)/g, '').replace(/^-+|-+$/g, '') || 'default'
    return { kind: 'avatar', key, target: `avatars/${key}${ext}` }
  }
  if (BACKGROUND_HINT.test(base) && !BOARD_HINT.test(base) && !SHEET_HINT.test(base)) {
    const key = stripBackground(base) || base
    return { kind: 'background', key, target: `backgrounds/${key}${ext}` }
  }

  // 3. Known names: the longest match among board themes, piece sets and characters wins.
  const theme = longestMatch(base, cat.boardThemes)
  const set = longestMatch(base, cat.pieceSets)
  const person = matchPerson(base, cat.people) ?? nearPerson(cleanPortraitName(base), cat.people)
  const tLen = theme ? theme.length + (BOARD_HINT.test(base) ? 100 : 0) : -1
  let sLen = set ? set.length + (SHEET_HINT.test(base) ? 100 : 0) : -1
  const pLen = person ? person.len + (PORTRAIT_HINT.test(base) ? 100 : 0) : -1
  // Same name for a set and a theme (e.g. "minimal"): the image's shape decides.
  if (theme && set && theme === set) sLen = sheetShaped(size) ? tLen + 1 : tLen - 1
  const best = Math.max(tLen, sLen, pLen)
  if (best >= 0) {
    if (best === tLen && theme) {
      const role = boardRole(base, theme)
      return { kind: 'board', theme, role, target: `boards/${theme}/${role}${ext}` }
    }
    if (best === sLen && set) return { kind: 'sheet', set, target: `pieces/${set}/sheet${ext}` }
    if (person) return { kind: 'portrait', key: person.key, target: `portraits/${person.key}${ext}` }
  }

  // 4. Unknown names with a hint word: "Galactic sprite sheet", "Wild West board", "Merlin portrait".
  const stripped = stripNoise(base.replace(/-(light|white|dark|black|frame)$/, ''))
  // A bare hint word ("sheet.png", "board.png") names nothing — the folder decides below.
  const named = /^(sheet|sprite|sprites|spritesheet|pieces|piece|set|board|tile|tiles|texture|theme|portrait|light|dark|frame)$/.test(stripped) ? '' : stripped
  if (SHEET_HINT.test(base) && named) return { kind: 'sheet', set: named, target: `pieces/${named}/sheet${ext}` }
  if (BOARD_HINT.test(base) && named) {
    const role = boardRole(base, named)
    return { kind: 'board', theme: named, role, target: `boards/${named}/${role}${ext}` }
  }
  if (PORTRAIT_HINT.test(base) && named) return { kind: 'portrait', key: stripNoise(base), target: `portraits/${stripNoise(base)}${ext}` }

  // 5. Folder hints (portraits/, pieces/<set>/, boards/<theme>/ …).
  const pieceAt = folders.findIndex((f) => PIECE_FOLDERS.test(f))
  const boardAt = folders.findIndex((f) => BOARD_FOLDERS.test(f))
  const portraitAt = folders.findIndex((f) => PORTRAIT_FOLDERS.test(f))
  if (pieceAt >= 0) {
    const s = stripNoise(folders[pieceAt + 1] ?? base)
    return s ? { kind: 'sheet', set: s, target: `pieces/${s}/sheet${ext}` } : null
  }
  if (boardAt >= 0 || (/^(board|light|dark|frame)$/.test(base) && folders.length > 0 && portraitAt < 0)) {
    const t = stripNoise(folders[boardAt + 1] ?? (boardAt >= 0 ? base.replace(/-(light|white|dark|black|frame)(-.*)?$/, '') : (folders[folders.length - 1] ?? '')))
    if (!t) return null
    const role = boardRole(base, t)
    return { kind: 'board', theme: t, role, target: `boards/${t}/${role}${ext}` }
  }
  if (portraitAt >= 0) return { kind: 'portrait', key: stripNoise(base), target: `portraits/${stripNoise(base)}${ext}` }

  // 6. An unnamed image shaped like a sprite sheet is one.
  if (sheetShaped(size) && stripNoise(base)) return { kind: 'sheet', set: stripNoise(base), target: `pieces/${stripNoise(base)}/sheet${ext}` }
  return null
}

// ── Manifest (what the app reads at runtime) ────────────────────────────────

/** Builds the manifest from the normalised public/assets layout. */
export function buildManifest(assetsDir) {
  const manifest = { version: 1, portraits: {}, pieceSets: {}, boards: {}, avatars: {}, backgrounds: {}, relics: {}, icons: {} }
  let files = []
  try {
    files = listImages(assetsDir)
  } catch {
    return manifest
  }
  for (const rel of files) {
    const parts = rel.split('/')
    const [top, group, leaf] = parts
    if ((top === 'portraits' || top === 'avatars' || top === 'backgrounds' || top === 'relics' || top === 'icons') && parts.length === 2 && group) {
      manifest[top][slugify(group.replace(/\.[a-z0-9]+$/i, ''))] = rel
    } else if (top === 'pieces' && parts.length === 3 && group && leaf) {
      const name = leaf.replace(/\.[a-z0-9]+$/i, '')
      const set = (manifest.pieceSets[group] ??= { files: {} })
      if (PIECE_CODES.includes(name)) set.files[name] = rel
      else if (/^sheet$/i.test(name)) {
        let grid = sheetGrid(imageSize(join(assetsDir, rel)))
        try {
          const override = JSON.parse(readFileSync(join(assetsDir, 'pieces', group, 'sheet.json'), 'utf8'))
          if (Number.isInteger(override.cols) && Number.isInteger(override.rows)) grid = { cols: override.cols, rows: override.rows, ...(typeof override.order === 'string' ? { order: override.order } : {}) }
        } catch {
          // No override: the aspect ratio decides.
        }
        set.sheet = { src: rel, ...grid }
      }
    } else if (top === 'boards' && parts.length === 3 && group && leaf) {
      const role = leaf.replace(/\.[a-z0-9]+$/i, '')
      if (['board', 'light', 'dark', 'frame'].includes(role)) (manifest.boards[group] ??= {})[role] = rel
    }
  }
  // A piece set needs either a sheet or all 12 pieces.
  for (const [id, set] of Object.entries(manifest.pieceSets)) {
    if (!set.sheet && Object.keys(set.files).length < 12) {
      const missing = PIECE_CODES.filter((c) => !set.files[c])
      console.warn(`[assets] piece set "${id}" is missing ${missing.join(', ')} (it will be used only once complete)`)
      delete manifest.pieceSets[id]
    } else if (Object.keys(set.files).length === 0) delete set.files
  }
  for (const [id, board] of Object.entries(manifest.boards)) {
    if (!board.board && !(board.light && board.dark)) {
      console.warn(`[assets] board "${id}" needs board.png, or both light.png and dark.png`)
      delete manifest.boards[id]
    }
  }
  return manifest
}

// ── Planning an import ──────────────────────────────────────────────────────

/** A folder path argument as typed on Windows: `"C:\art\"` arrives as `C:\art"` — strip stray quotes and trailing slashes. */
export function cleanPathArg(arg) {
  return String(arg).trim().replace(/^["']+|["']+$/g, '').replace(/[\\/]+$/, '') || String(arg)
}

/**
 * Scans `from` recursively (every subfolder: realm folders, icons/, relics/,
 * arenas/ …) and decides where each image goes. `exclude` lists absolute
 * folders never to scan (the game's own folder). Returns:
 *   plan     Map target → { rel, full, hit, bytes } (the larger file wins a clash)
 *   skipped  images it could not place
 *   failed   images it could not read
 *   clashes  [target, kept rel, dropped rel]
 *   folders  per-folder counts by kind (and 'unknown')
 */
export function planImport(from, catalog, { exclude = [] } = {}) {
  const plan = new Map()
  const skipped = []
  const failed = []
  const clashes = []
  const entries = []
  for (const rel of listImages(from, { skip: true, exclude })) {
    const full = join(from, ...rel.split('/'))
    try {
      const hit = classify(rel, catalog, imageSize(full))
      entries.push({ rel, full, hit, bytes: hit ? statSync(full).size : 0 })
    } catch (err) {
      failed.push({ rel, reason: err instanceof Error ? err.message : String(err) })
    }
  }
  // A folder that holds recognised portraits is a character folder: its other images are portraits too
  // (imported under their cleaned-up name, and flagged by the audit if no character matches).
  const folderOf = (rel) => rel.split('/').slice(0, -1).join('/')
  const characterFolders = new Set(entries.filter((e) => e.hit?.kind === 'portrait' && folderOf(e.rel)).map((e) => folderOf(e.rel)))
  for (const e of entries) {
    if (e.hit || !characterFolders.has(folderOf(e.rel))) continue
    const file = e.rel.split('/').pop() ?? ''
    const key = cleanPortraitName(file.replace(/\.[a-z0-9]+$/i, ''))
    if (!key) continue
    e.hit = { kind: 'portrait', key, target: `portraits/${key}${extname(file).toLowerCase()}`, guessed: true }
    try {
      e.bytes = statSync(e.full).size
    } catch {
      e.bytes = 0
    }
  }
  const folders = new Map()
  for (const e of entries) {
    const folder = folderOf(e.rel) || '.'
    const counts = folders.get(folder) ?? {}
    const kind = e.hit ? e.hit.kind : 'unknown'
    counts[kind] = (counts[kind] ?? 0) + 1
    folders.set(folder, counts)
    if (!e.hit) {
      skipped.push(e.rel)
      continue
    }
    const prev = plan.get(e.hit.target)
    if (prev) {
      const keep = e.bytes > prev.bytes ? e : prev
      clashes.push([e.hit.target, keep.rel, keep === e ? prev.rel : e.rel])
      plan.set(e.hit.target, keep)
    } else plan.set(e.hit.target, e)
  }
  return { plan, skipped, failed, clashes, folders }
}
