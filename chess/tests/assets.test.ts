// Tests for the art-pack pipeline: recognising files (portraits, piece images,
// sprite sheets, boards), building the manifest from real files on disk,
// sanitising it, fuzzy portrait matching, sprite-sheet geometry and the
// art-resolution rules. Run with `npm run test:assets`.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
// @ts-expect-error — plain .mjs helper shared with the Node scripts (no type declarations).
import { buildManifest, classify, imageSize, listImages, pieceCode, sheetGrid, slugify } from '../scripts/assets-lib.mjs'
// @ts-expect-error — plain .mjs helper (no type declarations).
import { loadCatalog } from '../scripts/asset-catalog.mjs'
import {
  EMPTY_MANIFEST,
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

console.log(failures === 0 ? '\nAll art-pack checks passed.' : `\n${failures} check(s) FAILED`)
if (failures > 0) process.exitCode = 1
