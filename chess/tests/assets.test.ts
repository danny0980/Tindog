// Tests for the art-pack pipeline: recognising files (portraits, piece images,
// sprite sheets, boards), building the manifest from real files on disk,
// sanitising it, fuzzy portrait matching, sprite-sheet geometry and the
// art-resolution rules. Run with `npm run test:assets`.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
// @ts-expect-error — plain .mjs helper shared with the Node scripts (no type declarations).
import { buildManifest, classify, cleanPathArg, cleanPortraitName, planImport, imageSize, listImages, normalizePortraitFolder, pieceCode, portraitPerson, sheetGrid, slugify } from '../scripts/assets-lib.mjs'
// @ts-expect-error — plain .mjs helper (no type declarations).
import { decodePng, encodePng, sliceSheet } from '../scripts/sprite-slicer.mjs'
// @ts-expect-error — plain .mjs helper (no type declarations).
import { loadCatalog } from '../scripts/asset-catalog.mjs'
import {
  EMPTY_MANIFEST,
  iconFor,
  relicArtFor,
  backgroundsFor,
  type ArtManifest,
  type PieceSheet,
  isSafeAssetPath,
  portraitFor,
  resolveBoardArt,
  resolvePieceArt,
  sanitizeManifest,
  sheetBackground,
  sheetCell,
} from '../src/assets/artManifest'
import { LEGENDS } from '../src/data/legends'
import chronicle from '../src/data/campaign/rosters/chronicle'
import discovery from '../src/data/campaign/rosters/discovery'

let failures = 0
const check = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) failures += 1
}

/** JSON with sorted keys (key order is not meaningful). */
const canonical = (v: unknown): string =>
  JSON.stringify(v, (_k, val: unknown) => (val && typeof val === 'object' && !Array.isArray(val) ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => a.localeCompare(b))) : val))

type Hit = { kind: string; target: string } | null
const cls = (p: string): Hit => classify(p) as Hit
// The catalog is read from the game's own source (tests run from the chess folder).
const catalog = loadCatalog(process.cwd()) as { people: Array<{ key: string }>; pieceSets: string[]; boardThemes: string[] }
const flat = (p: string, size: { width: number; height: number } | null = null): string | null => (classify(p, catalog, size) as Hit)?.target ?? null

// ── Recognising files ────────────────────────────────────────────────────────
check('slugs strip accents, quotes and case', slugify('Hattori Hanzō') === 'hattori-hanzo' && slugify('Grace O’Malley') === 'grace-omalley' && slugify('  Queen  Elizabeth I ') === 'queen-elizabeth-i')
check('piece codes from many naming styles', ['wK.png', 'w_k.png', 'White King.png', 'king-white.webp', 'WHITE-K.png'].every((f) => pieceCode(f) === 'wK') && pieceCode('black knight.png') === 'bN' && pieceCode('bn.png') === 'bN' && pieceCode('dark_pawn.png') === 'bP' && pieceCode('castle black.png') === 'bR' && pieceCode('logo.png') === null && pieceCode('b-analysis.png') === null && pieceCode('w-k.png') === 'wK')
check('portraits folder → portraits/<name>', cls('Portraits/Ragnar Lothbrok.png')?.target === 'portraits/ragnar-lothbrok.png' && cls('bosses/Blackbeard portrait.jpg')?.target === 'portraits/blackbeard.jpg')
check('without the catalog, a loose unknown image is not guessed', cls('Albert Einstein.webp') === null)
check('piece images → pieces/<set>/<code>', cls('Pieces/Dark Fantasy/White King.png')?.target === 'pieces/dark-fantasy/wK.png' && cls('pieces/neon/bp.png')?.target === 'pieces/neon/bP.png')
check('a set folder without a "pieces" parent still works', cls('cyber-ninja/black_queen.png')?.target === 'pieces/cyber-ninja/bQ.png')
check('sprite sheets → pieces/<set>/sheet', cls('pieces/steampunk/sheet.png')?.target === 'pieces/steampunk/sheet.png' && cls('Sprites/Aztec sprite sheet.png')?.target === 'pieces/aztec/sheet.png' && cls('pieces/Galactic.png')?.target === 'pieces/galactic/sheet.png')
check('boards → boards/<theme>/<role>', cls('Boards/Ancient Greece/board.png')?.target === 'boards/ancient-greece/board.png' && cls('boards/wild-west/light.jpg')?.target === 'boards/wild-west/light.jpg' && cls('boards/Viking Age dark.png')?.target === 'boards/viking-age/dark.png' && cls('themes/nebula/frame.png')?.target === 'boards/nebula/frame.png')
check('a theme folder without a "boards" parent still works', cls('mayan-civilization/board.png')?.target === 'boards/mayan-civilization/board.png')
check('unplaceable files are skipped', cls('misc/random/logo.png') === null)
// ── Flat folders: everything by name ────────────────────────────────────────
check('the catalog reads characters, sets and themes from the game source', catalog.people.length >= 100 && catalog.pieceSets.includes('lacquer') && catalog.pieceSets.includes('aztec') && catalog.boardThemes.includes('oled-black') && catalog.boardThemes.includes('wild-west'))
check('character names → portraits (case-insensitive, partial names)', [
  ['Ragnar.png', 'portraits/ragnar-lothbrok.png'], ['NAPOLEON.png', 'portraits/napoleon-bonaparte.png'], ['cleopatra.png', 'portraits/cleopatra-vii.png'],
  ['Blackbeard.png', 'portraits/blackbeard.png'], ['Ninja Leader.png', 'portraits/ninja-leader.png'], ['albert_einstein.png', 'portraits/albert-einstein.png'],
  ['Queen Victoria.png', 'portraits/queen-victoria.png'], ['Abraham Lincoln.png', 'portraits/abraham-lincoln.png'], ['julius-caesar.png', 'portraits/julius-caesar.png'],
  ['Sun Tzu.png', 'portraits/sun-tzu.png'], ['Alexander the Great.png', 'portraits/alexander-the-great.png'], ['Richard the Lionheart.png', 'portraits/richard-the-lionheart.png'],
  ['Joan of Arc.png', 'portraits/joan-of-arc.png'], ['Saladin.png', 'portraits/saladin.png'], ['Genghis Khan.png', 'portraits/genghis-khan.png'],
  ['Leonardo da Vinci.png', 'portraits/leonardo-da-vinci.png'], ['Miyamoto Musashi.png', 'portraits/miyamoto-musashi.png'], ['Queen Elizabeth I.png', 'portraits/queen-elizabeth-i.png'],
  ['Hammurabi portrait.png', 'portraits/hammurabi.png'], ['Hattori Hanzō.png', 'portraits/hattori-hanzo.png'],
].every(([f, t]) => flat(f ?? '') === t))
check('piece-set names → sprite sheets', flat('standard.png') === 'pieces/standard/sheet.png' && flat('Obsidian.png') === 'pieces/obsidian/sheet.png' && flat('AZTEC.png') === 'pieces/aztec/sheet.png' && flat('lacquer sprite sheet.png') === 'pieces/lacquer/sheet.png' && flat('dark-fantasy.png') === 'pieces/dark-fantasy/sheet.png')
check('board-theme names → boards (with light / dark / frame roles)', flat('classic-wood.png') === 'boards/classic-wood/board.png' && flat('OLED Black.png') === 'boards/oled-black/board.png' && flat('classic wood light.png') === 'boards/classic-wood/light.png' && flat('Wild West dark.png') === 'boards/wild-west/dark.png' && flat('nebula frame.png') === 'boards/nebula/frame.png')
check('the longest name wins (obsidian set vs obsidian-marble board)', flat('obsidian-marble.png') === 'boards/obsidian-marble/board.png' && flat('chalk.png') === 'pieces/chalk/sheet.png' && flat('chalkboard.png') === 'boards/chalkboard/board.png')
check('a name that is both a set and a theme: the image shape decides', flat('minimal.png', { width: 2048, height: 2048 }) === 'boards/minimal/board.png' && flat('minimal.png', { width: 1200, height: 400 }) === 'pieces/minimal/sheet.png')
check('single pieces by name, set from the name or folder', flat('obsidian_bN.png') === 'pieces/obsidian/bN.png' && flat('Dark Fantasy White King.png') === 'pieces/dark-fantasy/wK.png' && flat('Aztec/black queen.png') === 'pieces/aztec/bQ.png')
check('unknown names with a hint word', flat('Merlin portrait.png') === 'portraits/merlin.png' && flat('Coral Reef sprite sheet.png') === 'pieces/coral-reef/sheet.png' && flat('Frozen Lake board.png') === 'boards/frozen-lake/board.png')
check('an unnamed image shaped like a sprite sheet is one; other unknowns are skipped', flat('IMG_2034.png', { width: 1200, height: 400 }) === 'pieces/img-2034/sheet.png' && flat('IMG_2035.png', { width: 800, height: 800 }) === null)

check('screen art → backgrounds', flat('victory-screen-bg.png') === 'backgrounds/victory-screen.png' && flat('defeat-screen-bg.png') === 'backgrounds/defeat-screen.png' && flat('loading-screen-clash.png') === 'backgrounds/loading-screen-clash.png' && flat('loading-screen-space.png') === 'backgrounds/loading-screen-space.png' && flat('world-map-campaign.png') === 'backgrounds/world-map-campaign.png' && flat('chrono-realm-bg.png') === 'backgrounds/chrono-realm.png')
check('player avatars → avatars', flat('player-avatar-knight.png') === 'avatars/knight.png' && flat('player-avatar-mage.png') === 'avatars/mage.png' && flat('Avatar Rogue.png') === 'avatars/rogue.png')
check('the Chronos overlord portrait is recognised', flat('Chronos - Overlord Boss.png') === 'portraits/chronos-overlord.png')
check('board / sheet hint words still win over "screen"-like words', flat('nebula frame.png') === 'boards/nebula/frame.png' && flat('wild west board.png') === 'boards/wild-west/board.png')

check('sprite-sheet grids from aspect ratio', JSON.stringify(sheetGrid({ width: 1200, height: 400 })) === '{"cols":6,"rows":2}' && JSON.stringify(sheetGrid({ width: 400, height: 1200 })) === '{"cols":2,"rows":6}' && JSON.stringify(sheetGrid({ width: 2400, height: 200 })) === '{"cols":12,"rows":1}' && JSON.stringify(sheetGrid(null)) === '{"cols":6,"rows":2}')

// ── Manifest from real files ────────────────────────────────────────────────
const png = (w: number, h: number): Buffer => {
  const b = Buffer.alloc(33)
  b.writeUInt32BE(0x89504e47, 0)
  b.writeUInt32BE(0x0d0a1a0a, 4)
  b.writeUInt32BE(13, 8)
  b.write('IHDR', 12, 'ascii')
  b.writeUInt32BE(w, 16)
  b.writeUInt32BE(h, 20)
  return b
}
const dir = mkdtempSync(join(tmpdir(), 'chess-assets-'))
try {
  const put = (rel: string, data: Buffer) => {
    const full = join(dir, ...rel.split('/'))
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, data)
  }
  put('portraits/ragnar-lothbrok.png', png(512, 512))
  for (const c of ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP']) put(`pieces/dark-fantasy/${c}.png`, png(256, 256))
  put('pieces/half-done/wK.png', png(256, 256))
  put('pieces/steampunk/sheet.png', png(400, 1200))
  put('pieces/aztec/sheet.png', png(1200, 400))
  writeFileSync(join(dir, 'pieces', 'aztec', 'sheet.json'), JSON.stringify({ cols: 6, rows: 2, order: 'KQBNRP' }))
  put('boards/ancient-greece/board.png', png(2048, 2048))
  put('boards/wild-west/light.png', png(512, 512))
  put('boards/wild-west/dark.png', png(512, 512))
  put('boards/only-light/light.png', png(512, 512))
  put('avatars/knight.png', png(256, 256))
  put('backgrounds/victory-screen.png', png(1920, 1080))
  check('PNG size is read from the header', JSON.stringify(imageSize(join(dir, 'pieces', 'steampunk', 'sheet.png'))) === '{"width":400,"height":1200}')
  const m = buildManifest(dir) as ArtManifest
  check('manifest lists portraits, avatars and backgrounds', m.portraits['ragnar-lothbrok'] === 'portraits/ragnar-lothbrok.png' && m.avatars.knight === 'avatars/knight.png' && m.backgrounds['victory-screen'] === 'backgrounds/victory-screen.png')
  check('a complete 12-image set is listed; an incomplete one is not', Object.keys(m.pieceSets['dark-fantasy']?.files ?? {}).length === 12 && !m.pieceSets['half-done'])
  check('sprite sheet grid detected (2×6), override honoured (order)', m.pieceSets.steampunk?.sheet?.cols === 2 && m.pieceSets.steampunk.sheet.rows === 6 && m.pieceSets.aztec?.sheet?.order === 'KQBNRP')
  check('boards need board.png or light + dark', m.boards['ancient-greece']?.board === 'boards/ancient-greece/board.png' && m.boards['wild-west']?.light !== undefined && !m.boards['only-light'])
  check('the generated manifest survives sanitising unchanged', canonical(sanitizeManifest(JSON.parse(JSON.stringify(m)))) === canonical(m))
  // A flat "chess app" folder: images at the top level, the app's own folders ignored.
  put('flat/Ragnar.png', png(512, 512))
  put('flat/aztec.png', png(1200, 400))
  put('flat/classic-wood.png', png(2048, 2048))
  put('flat/node_modules/pkg/logo.png', png(64, 64))
  put('flat/public/assets/portraits/old.png', png(64, 64))
  put('flat/src/icon.png', png(64, 64))
  const flatFiles = listImages(join(dir, 'flat'), { skip: true }) as string[]
  check('flat scan finds top-level images and skips node_modules / public / src', flatFiles.join() === 'Ragnar.png,aztec.png,classic-wood.png', flatFiles.join())
  check('…and routes every one', flatFiles.map((f) => (classify(f, catalog, imageSize(join(dir, 'flat', f))) as Hit)?.target).join() === 'portraits/ragnar-lothbrok.png,pieces/aztec/sheet.png,boards/classic-wood/board.png')
  check('an empty or missing folder gives an empty manifest', JSON.stringify(buildManifest(join(dir, 'nope'))) === JSON.stringify(EMPTY_MANIFEST))
} finally {
  rmSync(dir, { recursive: true, force: true })
}

// ── Sanitising ──────────────────────────────────────────────────────────────
check('unsafe paths are rejected', !isSafeAssetPath('../secret.png') && !isSafeAssetPath('https://evil.example/x.png') && !isSafeAssetPath('/etc/x.png') && !isSafeAssetPath('a//b.png') && !isSafeAssetPath('pieces/x/wK.exe') && isSafeAssetPath('pieces/x/wK.png'))
const dirty = sanitizeManifest({
  portraits: { 'Bad Key': 'portraits/a.png', ok: 'portraits/ok.png', evil: '../../x.png' },
  pieceSets: { half: { files: { wK: 'pieces/half/wK.png' } }, sheet: { sheet: { src: 'pieces/sheet/sheet.png', cols: 5, rows: 2 } }, good: { sheet: { src: 'pieces/good/sheet.png', cols: 6, rows: 2 } } },
  boards: { lonely: { light: 'boards/lonely/light.png' }, full: { board: 'boards/full/board.png', frame: 'javascript:alert(1)' } },
})
check('the sanitiser keeps only valid entries', Object.keys(dirty.portraits).join() === 'ok' && Object.keys(dirty.pieceSets).join() === 'good' && Object.keys(dirty.boards).join() === 'full' && dirty.boards.full?.frame === undefined)
check('garbage is an empty manifest', JSON.stringify(sanitizeManifest('nope')) === JSON.stringify(EMPTY_MANIFEST))

// ── Portrait matching ───────────────────────────────────────────────────────
const portraitFiles = [
  'blackbeard', 'ninja-leader', 'ragnar-lothbrok', 'albert-einstein', 'queen-victoria', 'abraham-lincoln', 'napoleon-bonaparte', 'julius-caesar',
  'cleopatra', 'hammurabi', 'sun-tzu', 'alexander-the-great', 'richard-the-lionheart', 'joan-of-arc', 'saladin', 'genghis-khan', 'leonardo-da-vinci',
  'miyamoto-musashi', 'queen-elizabeth-i', 'einstein',
]
const pack: ArtManifest = { ...EMPTY_MANIFEST, portraits: Object.fromEntries(portraitFiles.map((k) => [k, `portraits/${k}.png`])) }
const names = [...LEGENDS.map((l) => l.name), ...chronicle.map((b) => b.name), ...discovery.map((b) => b.name)]
const expect = (name: string, file: string) => portraitFor(pack, name) === `portraits/${file}.png`
check('every requested portrait that has a character finds it', [
  ['Blackbeard', 'blackbeard'], ['Hattori Hanzō', 'ninja-leader'], ['Ragnar Lothbrok', 'ragnar-lothbrok'], ['Albert Einstein', 'albert-einstein'],
  ['Napoleon Bonaparte', 'napoleon-bonaparte'], ['Cleopatra VII', 'cleopatra'], ['Hammurabi', 'hammurabi'], ['Sun Tzu', 'sun-tzu'],
  ['Alexander the Great', 'alexander-the-great'], ['Richard the Lionheart', 'richard-the-lionheart'], ['Joan of Arc', 'joan-of-arc'], ['Saladin', 'saladin'],
  ['Genghis Khan', 'genghis-khan'], ['Leonardo da Vinci', 'leonardo-da-vinci'], ['Miyamoto Musashi', 'miyamoto-musashi'], ['Queen Elizabeth I', 'queen-elizabeth-i'],
].every(([n, f]) => names.includes(n ?? '') && expect(n ?? '', f ?? '')))
check('short names match the full name ("napoleon", "einstein")', portraitFor({ ...EMPTY_MANIFEST, portraits: { napoleon: 'portraits/napoleon.png' } }, 'Napoleon Bonaparte') === 'portraits/napoleon.png' && portraitFor({ ...EMPTY_MANIFEST, portraits: { einstein: 'portraits/einstein.png' } }, 'Albert Einstein') === 'portraits/einstein.png')
check('no false matches between different people', portraitFor(pack, 'Ada Lovelace') === null && portraitFor(pack, 'Charlemagne') === null && portraitFor(pack, 'Marie Curie') === null && portraitFor(pack, 'Locked') === null)
check('"Chronos – Overlord Boss" is the final overlord', portraitFor({ ...EMPTY_MANIFEST, portraits: { 'chronos-overlord': 'portraits/chronos-overlord.png' } }, 'The Infinite') === 'portraits/chronos-overlord.png')
const bgPack: ArtManifest = { ...EMPTY_MANIFEST, backgrounds: { 'victory-screen': 'backgrounds/v.png', 'defeat-screen': 'backgrounds/d.png', 'loading-screen-clash': 'backgrounds/l1.png', 'loading-screen-space': 'backgrounds/l2.png', 'world-map-campaign': 'backgrounds/m.png', 'chrono-realm': 'backgrounds/r.png' } }
check('backgrounds fill their screen slots', backgroundsFor(bgPack, 'victory').join() === 'backgrounds/v.png' && backgroundsFor(bgPack, 'defeat').join() === 'backgrounds/d.png' && backgroundsFor(bgPack, 'loading').length === 2 && backgroundsFor(bgPack, 'map').join() === 'backgrounds/m.png' && backgroundsFor(bgPack, 'realm').join() === 'backgrounds/r.png')
check('the most specific file wins ("albert-einstein" over "einstein")', portraitFor(pack, 'Albert Einstein') === 'portraits/albert-einstein.png')

// ── Sprite sheets ───────────────────────────────────────────────────────────
const s62: PieceSheet = { src: 'pieces/x/sheet.png', cols: 6, rows: 2 }
const s26: PieceSheet = { src: 'pieces/x/sheet.png', cols: 2, rows: 6 }
const s121: PieceSheet = { src: 'pieces/x/sheet.png', cols: 12, rows: 1 }
check('6×2 sheet: White row first, K Q R B N P', JSON.stringify(sheetCell('wK', s62)) === '{"col":0,"row":0}' && JSON.stringify(sheetCell('bP', s62)) === '{"col":5,"row":1}' && JSON.stringify(sheetCell('wN', s62)) === '{"col":4,"row":0}')
check('2×6 and 12×1 sheets', JSON.stringify(sheetCell('bQ', s26)) === '{"col":1,"row":1}' && JSON.stringify(sheetCell('bK', s121)) === '{"col":6,"row":0}')
check('custom order', JSON.stringify(sheetCell('wN', { ...s62, order: 'KQBNRP' })) === '{"col":3,"row":0}')
const bg = sheetBackground('bP', s62)
check('sheet CSS slices the right cell', bg.backgroundSize === '600% 200%' && bg.backgroundPosition === '100% 100%' && bg.backgroundImage.includes('assets/pieces/x/sheet.png'))

// ── Resolution rules ────────────────────────────────────────────────────────
const art: ArtManifest = {
  ...EMPTY_MANIFEST,
  pieceSets: { standard: { sheet: s62 }, 'dark-fantasy': { sheet: s62 } },
  boards: { 'classic-wood': { board: 'boards/classic-wood/board.png' }, 'wild-west': { board: 'boards/wild-west/board.png' } },
}
check('built-in set with the same name gets its art', resolvePieceArt(art, { artPack: true, artPieces: null, artBoard: null }, 'standard')?.id === 'standard' && resolvePieceArt(art, { artPack: true, artPieces: null, artBoard: null }, 'neon') === null)
check('an explicitly chosen art set applies everywhere', resolvePieceArt(art, { artPack: true, artPieces: 'dark-fantasy', artBoard: null }, 'neon')?.id === 'dark-fantasy')
check('a chosen set that no longer exists falls back', resolvePieceArt(art, { artPack: true, artPieces: 'gone', artBoard: null }, 'standard')?.id === 'standard')
check('the art-pack switch turns everything off', resolvePieceArt(art, { artPack: false, artPieces: 'dark-fantasy', artBoard: 'wild-west' }, 'standard') === null && resolveBoardArt(art, { artPack: false, artPieces: null, artBoard: 'wild-west' }, 'classic-wood') === null)
check('boards resolve the same way', resolveBoardArt(art, { artPack: true, artPieces: null, artBoard: null }, 'classic-wood')?.id === 'classic-wood' && resolveBoardArt(art, { artPack: true, artPieces: null, artBoard: 'wild-west' }, 'nebula')?.id === 'wild-west')

// ── Cutting sprite sheets ───────────────────────────────────────────────────
type Img = { width: number; height: number; data: Uint8ClampedArray }
type Slice = { pieces?: Record<string, Img>; error?: string; note?: string }
/** Row profile of each test silhouette: [height share, (t) → [left, right] as a share of the cell]. */
const SHAPES: Record<string, [number, (t: number) => [number, number]]> = {
  K: [1, (t) => (t < 0.12 ? [0.45, 0.55] : t < 0.6 ? [0.15, 0.85] : [0.1, 0.9])],
  Q: [0.92, (t) => (t < 0.12 ? [0.25, 0.75] : t < 0.6 ? [0.18, 0.82] : [0.1, 0.9])],
  R: [0.74, (t) => (t < 0.15 ? [0.12, 0.88] : t < 0.8 ? [0.25, 0.75] : [0.1, 0.9])],
  B: [0.84, (t) => (t < 0.12 ? [0.46, 0.54] : t < 0.4 ? [0.32, 0.68] : t < 0.8 ? [0.3, 0.7] : [0.15, 0.85])],
  N: [0.8, (t) => (t < 0.45 ? [0.05, 0.6] : t < 0.8 ? [0.35, 0.7] : [0.15, 0.85])],
  P: [0.58, (t) => (t < 0.35 ? [0.37, 0.63] : t < 0.8 ? [0.3, 0.7] : [0.15, 0.85])],
}
/** A green-screen sheet with the pieces in `layout` (3 rows × 4), each tinted uniquely so the cut can be traced back. */
function makeSheet(layout: string[], spacing = 1): { img: Img; tint: Record<string, number> } {
  const cell = 60
  const width = cell * 4
  const height = cell * 3
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) data.set([12, 235, 40, 255], i * 4)
  const tint: Record<string, number> = {}
  layout.forEach((code, k) => {
    const [share, row] = SHAPES[code.slice(1)] ?? SHAPES.P!
    const base = code.startsWith('w') ? 215 : 30
    tint[code] = base + k
    const h = Math.round(cell * 0.85 * share)
    const x0 = Math.round((k % 4) * cell * spacing)
    const y1 = Math.floor(k / 4) * cell + cell - 4
    for (let y = 0; y < h; y++) {
      const [l, r] = row(y / h)
      for (let x = Math.round(l * cell * 0.9); x < Math.round(r * cell * 0.9); x++) data.set([base + k, base + k, base + k, 255], ((y1 - h + y) * width + x0 + x + 3) * 4)
    }
  })
  return { img: { width, height, data }, tint }
}
const shuffled = ['bN', 'wP', 'bK', 'wR', 'wQ', 'bB', 'bP', 'wK', 'bR', 'wN', 'bQ', 'wB']
const { img: sheetImg, tint } = makeSheet(shuffled)
const roundTrip = decodePng(encodePng(sheetImg)) as Img
check('PNG encode → decode is lossless', roundTrip.width === 240 && roundTrip.data.every((v, i) => v === sheetImg.data[i]))
const sliced = sliceSheet(roundTrip) as Slice
check('a shuffled green-screen sheet is cut into 12 pieces', Object.keys(sliced.pieces ?? {}).length === 12, sliced.error ?? sliced.note ?? '')
/** Which source piece each cut came from: the tint most of its solid pixels carry. */
const trace = (cut: Slice, tints: Record<string, number>) =>
  Object.entries(cut.pieces ?? {}).map(([code, im]) => {
    const votes = new Map<number, number>()
    for (let i = 0; i < im.data.length; i += 4) if ((im.data[i + 3] ?? 0) === 255) votes.set(im.data[i] ?? 0, (votes.get(im.data[i] ?? 0) ?? 0) + 1)
    const top = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    return [code, Object.entries(tints).find(([, t]) => t === top)?.[0]]
  })
const traced = trace(sliced, tint)
const wrong = traced.filter(([code, from]) => code !== from)
check('every piece is recognised wherever it sits on the sheet', wrong.length === 0, wrong.map(([c, f]) => `${c}←${f}`).join(' '))
const anyGreen = Object.values(sliced.pieces ?? {}).some((im) => {
  for (let i = 0; i < im.data.length; i += 4) if ((im.data[i + 3] ?? 0) > 0 && (im.data[i + 1] ?? 0) > (im.data[i] ?? 0) + 40) return true
  return false
})
check('the green background is gone from every piece', !anyGreen)
const pk = sliced.pieces?.wK
const pp = sliced.pieces?.wP
check('all pieces share one canvas (a pawn stays smaller than a king)', Boolean(pk && pp && pk.width === pp.width && pk.height === pp.height))
const touching = makeSheet(['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'], 0.82)
const touchCut = sliceSheet(touching.img) as Slice
const touchWrong = trace(touchCut, touching.tint).filter(([code, from]) => code !== from)
check('pieces touching each other are cut apart and recognised', Object.keys(touchCut.pieces ?? {}).length === 12 && touchWrong.length === 0, touchCut.error ?? touchWrong.map(([c, f]) => `${c}←${f}`).join(' '))
const clear = makeSheet(shuffled).img
for (let i = 0; i < clear.data.length; i += 4) if ((clear.data[i + 1] ?? 0) === 235) clear.data[i + 3] = 0
check('an already-transparent sheet is cut the same way', Object.keys((sliceSheet(clear) as Slice).pieces ?? {}).length === 12)
const checker: Img = { width: 64, height: 64, data: new Uint8ClampedArray(64 * 64 * 4) }
for (let i = 0; i < 64 * 64; i++) {
  const dark = (Math.floor((i % 64) / 8) + Math.floor(i / 64 / 8)) % 2 === 1
  checker.data.set(dark ? [60, 30, 20, 255] : [200, 90, 40, 255], i * 4)
}
check('a board picture is not mistaken for a sprite sheet', /no background/.test((sliceSheet(checker) as Slice).error ?? ''))

// ── Portrait file names copied in by hand ──────────────────────────────────
const people = catalog
const named: Array<[string, string | null]> = [
  ['Napoleon Bonaparte (1).png', 'napoleon-bonaparte'],
  ['portrait_napoleon_final_v2.PNG', 'napoleon-bonaparte'],
  ['Portrait of Cleopatra.png', 'cleopatra-vii'],
  ['01 - Sun Tzu.jpg', 'sun-tzu'],
  ['SunTzu.png', 'sun-tzu'],
  ['Niccolò Machiavelli.webp', 'niccolo-machiavelli'],
  ['einstein copy.png', 'albert-einstein'],
  ['Joan_of_Arc_HD.png', 'joan-of-arc'],
  ['Lich King Vorthax 4k.png', 'lich-king-vorthax'],
  ['boss-hermes.png', 'hermes'],
  ['Oberon (High King).png', 'high-king-oberon'],
  ['Gemini_Generated_Image_abc123.png', null],
]
const wrongNames = named.filter(([f, key]) => portraitPerson(f, people) !== key)
check('portrait file names in any spelling name the right character', wrongNames.length === 0, wrongNames.map(([f]) => `${f} → ${String(portraitPerson(f, people))}`).join(', '))
check('decoration is stripped from portrait names', cleanPortraitName('01 - Portrait of Thor (2) final v3 1024x1024') === 'thor')
const pdir = mkdtempSync(join(tmpdir(), 'portraits-'))
mkdirSync(join(pdir, 'portraits'))
const fakePng = (w: number) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, w, 0, 0, 0, w]), Buffer.alloc(w)])
writeFileSync(join(pdir, 'portraits', 'Napoleon Bonaparte (1).PNG'), fakePng(40))
writeFileSync(join(pdir, 'portraits', 'napoleon_portrait.png'), fakePng(10))
writeFileSync(join(pdir, 'portraits', 'Charlemagne.jfif'), fakePng(10))
writeFileSync(join(pdir, 'portraits', 'Random Image.png'), fakePng(10))
const tidy = normalizePortraitFolder(pdir, people) as { renamed: Array<{ to: string }>; duplicates: string[]; unnamed: string[] }
const after = listImages(join(pdir, 'portraits')) as string[]
check('hand-copied portraits get canonical, URL-safe names', after.includes('napoleon-bonaparte.png') && after.includes('charlemagne.jpg'), after.join(', '))
check('the larger of two images of one character is kept', tidy.duplicates.join() === 'napoleon_portrait.png' && after.includes('duplicates/napoleon_portrait.png'))
check('a file naming nobody keeps its name and is reported', after.includes('Random Image.png') && tidy.unnamed.join() === 'Random Image.png')
check('tidying twice changes nothing', (normalizePortraitFolder(pdir, people) as { renamed: unknown[] }).renamed.length === 0)
const tidied = sanitizeManifest(buildManifest(pdir))
check('the game finds the tidied portraits', portraitFor(tidied, 'Napoleon Bonaparte') === 'portraits/napoleon-bonaparte.png' && portraitFor(tidied, 'Charlemagne') === 'portraits/charlemagne.jpg')
rmSync(pdir, { recursive: true, force: true })

// ── Relics, UI icons, arenas ────────────────────────────────────────────────
type Target = { kind: string; target: string } | null
const at = (p: string): Target => classify(p, catalog) as Target
check('relic art lands on the relic id', at('relic-fae-gold.png')?.target === 'relics/fae-gold.png' && at('relics/Smoke Veil of Iga.png')?.target === 'relics/smoke-veil.png')
check('an unknown relic keeps its own name', at('relic-crown-of-kings.png')?.target === 'relics/crown-of-kings.png')
check('UI icons by prefix or folder', at('icon-boss-rush.png')?.target === 'icons/boss-rush.png' && at('icons/Grand Campaign.png')?.target === 'icons/grand-campaign.png')
check('arena images become arena backdrops', at('arenas/Volcano Arena.png')?.target === 'backgrounds/arena-volcano.png' && at('Frozen arena.jpg')?.target === 'backgrounds/arena-frozen.jpg')
check('character portraits inside realm folders still go to portraits', at('Ninjas & Shinobi/Hattori Hanzo.png')?.target === 'portraits/hattori-hanzo.png')
const iconArt: ArtManifest = { ...EMPTY_MANIFEST, icons: { 'boss-rush': 'icons/boss-rush.png', 'daily-bounty': 'icons/daily-bounty.png' }, relics: { 'fae-gold': 'relics/fae-gold.png' } }
check('icon aliases fill the right slot', iconFor(iconArt, 'gauntlet') === 'icons/boss-rush.png' && iconFor(iconArt, 'bounty') === 'icons/daily-bounty.png' && iconFor(iconArt, 'tournament') === null)
check('relic art is found by id', relicArtFor(iconArt, { id: 'fae-gold', name: 'Oberon’s Fae Gold' }) === 'relics/fae-gold.png' && relicArtFor(iconArt, { id: 'emp-spike', name: 'EMP Spike' }) === null)
const roundTrip2 = sanitizeManifest(JSON.parse(JSON.stringify({ ...iconArt, icons: { ...iconArt.icons, '../x': 'icons/x.png', ok: '../../etc/passwd.png' } })))
check('relic and icon entries are sanitised', roundTrip2.relics['fae-gold'] === 'relics/fae-gold.png' && Object.keys(roundTrip2.icons).join() === 'boss-rush,daily-bounty')
const skipDir = mkdtempSync(join(tmpdir(), 'artroot-'))
mkdirSync(join(skipDir, 'chess'))
writeFileSync(join(skipDir, 'chess', 'debug.png'), 'x')
writeFileSync(join(skipDir, 'thor.png'), 'x')
check('the game folder inside the art folder is not scanned', (listImages(skipDir, { skip: true, exclude: [join(skipDir, 'chess')] }) as string[]).join() === 'thor.png')
rmSync(skipDir, { recursive: true, force: true })

// ── Organised source folders (realm folders, icons/, relics/, arenas/) ─────
const src = mkdtempSync(join(tmpdir(), 'chess app '))
for (const d of ['Cosmic Pantheon', 'Ninjas & Shinobi', 'icons', 'relics', 'arenas', 'chess/src', 'Deep/Nested/Folder']) mkdirSync(join(src, d), { recursive: true })
const tiny = (n: number) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 9, 0, 0, 0, 9]), Buffer.alloc(n)])
const put = (rel: string, n = 10) => writeFileSync(join(src, rel), tiny(n))
put('Cosmic Pantheon/The Infinite.png')
put('Cosmic Pantheon/mystery-figure.png')
put('Ninjas & Shinobi/Hattori Hanzo.PNG')
put('icons/icon-boss-rush.png')
put('relics/Smoke Veil of Iga.png')
put('arenas/Volcano.png')
put('Deep/Nested/Folder/Napoleon Bonaparte.jpg')
put('chess/src/debug.png')
put('chess/stray.png')
type Plan = { plan: Map<string, { rel: string; hit: { kind: string; target: string; guessed?: boolean } }>; skipped: string[]; folders: Map<string, Record<string, number>> }
const scanned = planImport(src, catalog, { exclude: [join(src, 'chess')] }) as Plan
const targets = [...scanned.plan.keys()].sort()
check('every subfolder is scanned, however deep', targets.includes('portraits/napoleon-bonaparte.jpg') && targets.includes('portraits/hattori-hanzo.png') && targets.includes('portraits/the-infinite.png'), targets.join(', '))
check('asset-type folders route to their destinations', targets.includes('icons/boss-rush.png') && targets.includes('relics/smoke-veil.png') && targets.includes('backgrounds/arena-volcano.png'))
check('an unknown name in a character folder is still imported as a portrait', scanned.plan.get('portraits/mystery-figure.png')?.hit.guessed === true)
check('the game folder inside the art folder is skipped', !targets.some((t) => t.includes('debug') || t.includes('stray')))
check('per-folder counts are reported', scanned.folders.get('Cosmic Pantheon')?.portrait === 2 && scanned.folders.get('relics')?.relic === 1)
check('a Windows path with a trailing backslash-quote still works', cleanPathArg('C:\\Users\\Gladi\\chess app"') === 'C:\\Users\\Gladi\\chess app' && cleanPathArg('"/tmp/art/"') === '/tmp/art')
rmSync(src, { recursive: true, force: true })

// ── Spelling slips, copy markers, misplaced files ───────────────────────────
check('a one-letter slip still finds the character', at('major-tesseract.png')?.target === 'portraits/major-tessaract.png' && at('Napolean Bonaparte.png')?.target === 'portraits/napoleon-bonaparte.png')
check('slips are not stretched to short or unrelated names', at('zeuss.png')?.target !== 'portraits/zeus.png' && portraitPerson('mystery-figure.png', catalog) === null)
check('copy markers come off relic and icon names', at('relics/starforged-crown1.png')?.target === 'relics/starforged-crown.png' && at('icon-boss-rush (2).png')?.target === 'icons/boss-rush.png')
const mdir = mkdtempSync(join(tmpdir(), 'misplaced-'))
mkdirSync(join(mdir, 'portraits'), { recursive: true })
writeFileSync(join(mdir, 'portraits', 'icon-boss-rush.png'), 'x')
writeFileSync(join(mdir, 'portraits', 'Thor.png'), 'x')
const moved = normalizePortraitFolder(mdir, catalog) as { moved: Array<{ to: string }> }
check('an icon left among the portraits moves to icons/', moved.moved[0]?.to === 'icons/boss-rush.png' && (listImages(mdir) as string[]).includes('icons/boss-rush.png') && !(listImages(join(mdir, 'portraits')) as string[]).includes('icon-boss-rush.png'))
rmSync(mdir, { recursive: true, force: true })

console.log(failures === 0 ? '\nAll art-pack checks passed.' : `\n${failures} check(s) FAILED`)
if (failures > 0) process.exitCode = 1
