// Shared helpers for the art-pack scripts (plain Node, no dependencies, works on
// Windows, macOS and Linux): name normalisation, image-size sniffing, and the
// rules that recognise portraits, piece sets / sprite sheets and board themes.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, sep } from 'node:path'

export const IMAGE_EXTENSIONS = ['.png', '.webp', '.jpg', '.jpeg', '.avif', '.svg']
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

/** Every image under `dir`, recursively (paths relative to `dir`). */
export function listImages(dir) {
  const out = []
  const walk = (current) => {
    for (const name of readdirSync(current)) {
      if (name.startsWith('.')) continue
      const full = join(current, name)
      const st = statSync(full)
      if (st.isDirectory()) walk(full)
      else if (isImage(name)) out.push(relative(dir, full).split(sep).join('/'))
    }
  }
  walk(dir)
  return out.sort()
}

// ── Image dimensions (PNG, JPEG, WebP, GIF headers) ─────────────────────────

/** Width and height from the file header, or null when unknown (e.g. SVG). */
export function imageSize(file) {
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
  let color = null
  let type = null
  for (const p of parts) {
    if (!color && COLOR_WORDS[p]) color = COLOR_WORDS[p]
    else if (!type && TYPE_WORDS[p]) type = TYPE_WORDS[p]
  }
  // "white-k" style
  if (color && !type) {
    const letter = parts.find((p) => /^[kqrbnp]$/.test(p))
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

/**
 * Classifies one source image (path relative to the art folder) into where it
 * belongs in public/assets. Returns null for files it can't place.
 */
export function classify(relPath) {
  const parts = relPath.split('/')
  const file = parts[parts.length - 1] ?? ''
  const ext = extname(file).toLowerCase()
  const base = slugify(file.slice(0, file.length - ext.length))
  const folders = parts.slice(0, -1).map(slugify)
  const kindIndex = (re) => folders.findIndex((f) => re.test(f))

  const pieceAt = kindIndex(PIECE_FOLDERS)
  const boardAt = kindIndex(BOARD_FOLDERS)
  const portraitAt = kindIndex(PORTRAIT_FOLDERS)
  const code = pieceCode(file)

  // Pieces: <…>/pieces/<set>/<wK>.png, <…>/pieces/<set>/sheet.png or <…>/pieces/<set>.png (a sheet)
  if (pieceAt >= 0 || (code && boardAt < 0 && portraitAt < 0)) {
    const setFolder = folders[pieceAt + 1] ?? (pieceAt < 0 ? folders[folders.length - 1] : undefined)
    if (code) {
      const set = stripNoise(setFolder ?? 'custom')
      return { kind: 'piece', set, code, target: `pieces/${set}/${code}${ext}` }
    }
    const set = stripNoise(setFolder ?? base)
    return set ? { kind: 'sheet', set, target: `pieces/${set}/sheet${ext}` } : null
  }

  // Boards: <…>/boards/<theme>/(board|light|dark|frame).png or <…>/boards/<theme>[-light|-dark].png
  if (boardAt >= 0) {
    const themeFolder = folders[boardAt + 1]
    const role = /(^|-)(light|white)(-|$)/.test(base) ? 'light' : /(^|-)(dark|black)(-|$)/.test(base) ? 'dark' : /(^|-)frame(-|$)/.test(base) ? 'frame' : 'board'
    const theme = stripNoise(themeFolder ?? base.replace(/-(light|white|dark|black|frame)(-.*)?$/, ''))
    return theme ? { kind: 'board', theme, role, target: `boards/${theme}/${role}${ext}` } : null
  }

  // A theme folder without a "boards" parent: <…>/<theme>/(board|light|dark|frame).png
  if (/^(board|light|dark|frame)$/.test(base) && folders.length > 0 && portraitAt < 0) {
    const theme = stripNoise(folders[folders.length - 1] ?? '')
    return theme ? { kind: 'board', theme, role: base, target: `boards/${theme}/${base}${ext}` } : null
  }

  // Portraits: anything in a portraits/bosses/legends folder (or a loose image at the top level).
  if (portraitAt >= 0 || folders.length === 0) {
    const key = stripNoise(base)
    return key ? { kind: 'portrait', key, target: `portraits/${key}${ext}` } : null
  }
  return null
}

// ── Manifest (what the app reads at runtime) ────────────────────────────────

/** Builds the manifest from the normalised public/assets layout. */
export function buildManifest(assetsDir) {
  const manifest = { version: 1, portraits: {}, pieceSets: {}, boards: {} }
  let files = []
  try {
    files = listImages(assetsDir)
  } catch {
    return manifest
  }
  for (const rel of files) {
    const parts = rel.split('/')
    const [top, group, leaf] = parts
    if (top === 'portraits' && parts.length === 2 && group) {
      manifest.portraits[slugify(group.replace(/\.[a-z0-9]+$/i, ''))] = rel
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
