// The art pack: custom portraits, piece sets (12 images or one sprite sheet)
// and board textures dropped into public/assets. `scripts/scan-assets.mjs`
// writes public/assets/manifest.json; the app loads it once at startup and
// every lookup here falls back to the built-in vector art when nothing matches.
import { createStore } from '../utils/store'
import { asRecord, isRecord } from '../utils/validate'

export type PieceCode = 'wK' | 'wQ' | 'wR' | 'wB' | 'wN' | 'wP' | 'bK' | 'bQ' | 'bR' | 'bB' | 'bN' | 'bP'
export const PIECE_CODES: readonly PieceCode[] = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP']

export interface PieceSheet {
  src: string
  cols: number
  rows: number
  /** Piece-type order along the sheet (default "KQRBNP"). */
  order?: string
}

export interface ArtPieceSet {
  files?: Partial<Record<PieceCode, string>>
  sheet?: PieceSheet
}

export interface ArtBoard {
  /** The whole 8×8 board as one image (a1 dark, bottom-left). */
  board?: string
  /** Tileable square textures. */
  light?: string
  dark?: string
  /** Decorative frame (transparent centre). */
  frame?: string
}

export interface ArtManifest {
  version: 1
  portraits: Readonly<Record<string, string>>
  pieceSets: Readonly<Record<string, ArtPieceSet>>
  boards: Readonly<Record<string, ArtBoard>>
}

export const EMPTY_MANIFEST: ArtManifest = { version: 1, portraits: {}, pieceSets: {}, boards: {} }

// ── Sanitising (the manifest is just a file on disk — never trust it blindly) ─

/** Relative paths inside public/assets only: no traversal, no protocols. */
const SAFE_PATH = /^[A-Za-z0-9][A-Za-z0-9._/-]*\.(png|webp|jpe?g|avif|svg|gif)$/i
export const isSafeAssetPath = (v: unknown): v is string => typeof v === 'string' && v.length < 300 && SAFE_PATH.test(v) && !v.includes('..') && !v.includes('//')
const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/
export const isArtId = (v: unknown): v is string => typeof v === 'string' && SAFE_ID.test(v)
const isPieceCode = (v: string): v is PieceCode => (PIECE_CODES as readonly string[]).includes(v)

function sanitizeSheet(raw: unknown): PieceSheet | undefined {
  if (!isRecord(raw) || !isSafeAssetPath(raw.src)) return undefined
  const cols = typeof raw.cols === 'number' && Number.isInteger(raw.cols) ? raw.cols : 6
  const rows = typeof raw.rows === 'number' && Number.isInteger(raw.rows) ? raw.rows : 2
  if (cols * rows !== 12) return undefined
  const order = typeof raw.order === 'string' && /^[KQRBNP]{6}$/.test(raw.order.toUpperCase()) && new Set(raw.order.toUpperCase()).size === 6 ? raw.order.toUpperCase() : undefined
  return { src: raw.src, cols, rows, ...(order ? { order } : {}) }
}

export function sanitizeManifest(raw: unknown): ArtManifest {
  if (!isRecord(raw)) return EMPTY_MANIFEST
  const portraits: Record<string, string> = {}
  for (const [k, v] of Object.entries(asRecord(raw.portraits))) if (isArtId(k) && isSafeAssetPath(v)) portraits[k] = v
  const pieceSets: Record<string, ArtPieceSet> = {}
  for (const [id, v] of Object.entries(asRecord(raw.pieceSets))) {
    if (!isArtId(id) || !isRecord(v)) continue
    const files: Partial<Record<PieceCode, string>> = {}
    for (const [code, path] of Object.entries(asRecord(v.files))) if (isPieceCode(code) && isSafeAssetPath(path)) files[code] = path
    const complete = PIECE_CODES.every((c) => files[c])
    const sheet = sanitizeSheet(v.sheet)
    if (!complete && !sheet) continue
    pieceSets[id] = { ...(complete ? { files } : {}), ...(sheet ? { sheet } : {}) }
  }
  const boards: Record<string, ArtBoard> = {}
  for (const [id, v] of Object.entries(asRecord(raw.boards))) {
    if (!isArtId(id) || !isRecord(v)) continue
    const b: ArtBoard = {}
    for (const role of ['board', 'light', 'dark', 'frame'] as const) if (isSafeAssetPath(v[role])) b[role] = v[role]
    if (b.board || (b.light && b.dark)) boards[id] = b
  }
  return { version: 1, portraits, pieceSets, boards }
}

// ── Store & loading ─────────────────────────────────────────────────────────

export const artStore = createStore<ArtManifest>(EMPTY_MANIFEST)

/** URL of a file in public/assets (works under any deploy base path). */
export const assetUrl = (path: string): string => `${import.meta.env.BASE_URL}assets/${path.split('/').map(encodeURIComponent).join('/')}`

/** Loads public/assets/manifest.json; a missing or broken manifest simply means "no art pack". */
export async function loadArtManifest(fetchImpl: typeof fetch = fetch): Promise<ArtManifest> {
  try {
    const res = await fetchImpl(`${import.meta.env.BASE_URL}assets/manifest.json`, { cache: 'no-cache' })
    if (!res.ok) return artStore.get()
    const manifest = sanitizeManifest(await res.json())
    artStore.set(manifest)
    return manifest
  } catch {
    return artStore.get()
  }
}

// ── Lookups ─────────────────────────────────────────────────────────────────

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** "dark-fantasy" → "Dark Fantasy" */
export const humanize = (id: string): string => id.split('-').filter(Boolean).map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ')

/** Portrait file names that don't share a word with the character's name. */
export const PORTRAIT_ALIASES: Readonly<Record<string, string>> = {
  'ninja-leader': 'hattori-hanzo',
  'ninja-master': 'hattori-hanzo',
  'the-lionheart': 'richard-the-lionheart',
  'black-beard': 'blackbeard',
  'edward-teach': 'blackbeard',
  'the-maid-of-orleans': 'joan-of-arc',
  'temujin': 'genghis-khan',
  'sir-isaac-newton': 'isaac-newton',
}

const TITLES = /^(the|sir|lady|queen|king|captain|high-king|lord|saint|st|emperor|empress|pharaoh|general|commander|colonel|major|madame|mr|dr)-/

/** Name variants to try: "Queen Elizabeth I" → queen-elizabeth-i, elizabeth-i. */
function nameVariants(name: string): string[] {
  const slug = slugify(name)
  const out = [slug]
  let s = slug
  for (let i = 0; i < 2; i++) {
    const next = s.replace(TITLES, '')
    if (next !== s && next) out.push(next)
    s = next
  }
  return out
}

/**
 * The portrait file for a character, if the art pack has one. Exact names
 * win; then aliases; then a whole-word prefix / suffix match ("napoleon" →
 * Napoleon Bonaparte, "einstein" → Albert Einstein).
 */
export function portraitFor(manifest: ArtManifest, name: string): string | null {
  const keys = Object.keys(manifest.portraits)
  if (keys.length === 0 || !name) return null
  const variants = nameVariants(name)
  for (const v of variants) {
    const hit = manifest.portraits[v]
    if (hit) return hit
  }
  for (const k of keys) {
    const target = PORTRAIT_ALIASES[k]
    if (target && variants.includes(target)) return manifest.portraits[k] ?? null
  }
  let best: { key: string; path: string } | null = null
  for (const k of keys) {
    if (k.length < 4) continue
    const kv = nameVariants(k)
    const match = variants.some((v) => kv.some((kk) => kk === v || v.startsWith(`${kk}-`) || v.endsWith(`-${kk}`) || kk.startsWith(`${v}-`)))
    const path = manifest.portraits[k]
    if (match && path && (!best || k.length > best.key.length)) best = { key: k, path }
  }
  return best?.path ?? null
}

/** Grid cell of a piece in a sprite sheet (order K Q R B N P, White row / column first). */
export function sheetCell(code: PieceCode, sheet: PieceSheet): { col: number; row: number } {
  const order = sheet.order ?? 'KQRBNP'
  const type = Math.max(0, order.indexOf(code[1] ?? 'K'))
  const color = code[0] === 'w' ? 0 : 1
  if (sheet.rows === 1) return { col: color * 6 + type, row: 0 }
  if (sheet.cols === 1) return { col: 0, row: color * 6 + type }
  if (sheet.cols === 2) return { col: color, row: type }
  return { col: type, row: color }
}

/** CSS background for one sprite-sheet cell. */
export function sheetBackground(code: PieceCode, sheet: PieceSheet): { backgroundImage: string; backgroundSize: string; backgroundPosition: string } {
  const { col, row } = sheetCell(code, sheet)
  const x = sheet.cols > 1 ? (col / (sheet.cols - 1)) * 100 : 0
  const y = sheet.rows > 1 ? (row / (sheet.rows - 1)) * 100 : 0
  return {
    backgroundImage: `url("${assetUrl(sheet.src)}")`,
    backgroundSize: `${sheet.cols * 100}% ${sheet.rows * 100}%`,
    backgroundPosition: `${x}% ${y}%`,
  }
}

export interface ArtPreferences {
  /** Use art for built-in sets/themes with matching names, and for portraits. */
  artPack: boolean
  /** An art piece set / board chosen explicitly (applies everywhere). */
  artPieces: string | null
  artBoard: string | null
}

/** Which art piece set to draw for a built-in piece set id (or null = vector pieces). */
export function resolvePieceArt(manifest: ArtManifest, prefs: ArtPreferences, pieceSetId: string): { id: string; set: ArtPieceSet } | null {
  if (!prefs.artPack) return null
  const chosen = prefs.artPieces ? manifest.pieceSets[prefs.artPieces] : undefined
  if (prefs.artPieces && chosen) return { id: prefs.artPieces, set: chosen }
  const same = manifest.pieceSets[pieceSetId]
  return same ? { id: pieceSetId, set: same } : null
}

/** Which art board to draw for a built-in theme id (or null = the theme's colours). */
export function resolveBoardArt(manifest: ArtManifest, prefs: ArtPreferences, themeId: string): { id: string; board: ArtBoard } | null {
  if (!prefs.artPack) return null
  const chosen = prefs.artBoard ? manifest.boards[prefs.artBoard] : undefined
  if (prefs.artBoard && chosen) return { id: prefs.artBoard, board: chosen }
  const same = manifest.boards[themeId]
  return same ? { id: themeId, board: same } : null
}
