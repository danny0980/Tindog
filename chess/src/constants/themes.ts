import type { CSSProperties } from 'react'
import type { BoardTheme, BoardThemeId, PieceSet, PieceSetId } from '../types/theme'

const glowRing = (color: string) => `inset 0 0 0 3px ${color}, inset 0 0 18px ${color}`

/** Inline SVG as a CSS url() — lets themes carry engraved motifs without image assets. */
const svg = (markup: string) => `url("data:image/svg+xml,${encodeURIComponent(markup)}")`

/** One image layer of a square; a plain string paints like a bare `background` layer (auto size, top-left, repeating). */
type Layer = string | { image: string; size: string; position?: string; repeat?: string }

/**
 * A square's surface as background longhands. Square and highlight styles are merged per square, so they
 * must never use the `background` shorthand: React warns when it and `backgroundColor` / `backgroundImage` collide.
 */
const surface = (color: string, layers: Layer[]): CSSProperties => {
  const all = layers.map((l) => (typeof l === 'string' ? { image: l, size: 'auto', position: '0 0', repeat: 'repeat' } : { position: 'center', repeat: 'no-repeat', ...l }))
  return {
    backgroundColor: color,
    backgroundImage: all.map((l) => l.image).join(', '),
    backgroundSize: all.map((l) => l.size).join(', '),
    backgroundPosition: all.map((l) => l.position).join(', '),
    backgroundRepeat: all.map((l) => l.repeat).join(', '),
  }
}

/** Runic strokes (algiz, tiwaz, and an ingwaz-style diamond) carved faintly into each square. */
const RUNES = (stroke: string) =>
  svg(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40' fill='none' stroke='${stroke}' stroke-width='1.4' stroke-linecap='round'>` +
      `<path d='M8 30V12M8 18l-4-5M8 18l4-5'/><path d='M30 30V12M26 16l4-4 4 4'/><path d='M20 25l-3 3 3 3 3-3z'/></svg>`,
  )

/** A single soft ink-wash brushstroke for the Feudal Japan board. */
const INK_STROKE = svg(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><path d='M4 30 C14 22, 26 34, 36 18' stroke='rgba(17,24,39,0.10)' stroke-width='3' fill='none' stroke-linecap='round'/></svg>`,
)

/** Leaf-vein motif for the elven board. */
const LEAF = svg(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40' fill='none' stroke='rgba(134,239,172,0.22)' stroke-width='1'><path d='M8 32 C10 18, 22 8, 34 8 C32 20, 22 30, 8 32Z'/><path d='M8 32 L30 11'/></svg>`,
)

/** Glowing lava fissures for the shadow realm. */
const FISSURE = svg(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40' fill='none' stroke='rgba(249,115,22,0.55)' stroke-width='0.9'><path d='M2 12 L12 16 L18 10 L28 18 L38 14'/><path d='M18 10 L20 2'/><path d='M12 16 L10 30 L20 36'/></svg>`,
)

/** Compass-rose and rhumb lines inked onto weathered sea-chart squares. */
const SEA_CHART = svg(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40' fill='none' stroke='rgba(120,72,30,0.16)' stroke-width='0.8'><path d='M0 40 L40 0M0 0 L40 40'/><circle cx='20' cy='20' r='5'/><path d='M20 12 L22 20 L20 28 L18 20Z' fill='rgba(120,72,30,0.12)'/></svg>`,
)

/** Scattered stars for the cosmic board. */
const STARFIELD = svg(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40' fill='rgba(255,255,255,0.55)'><circle cx='7' cy='9' r='0.7'/><circle cx='29' cy='6' r='0.5'/><circle cx='19' cy='22' r='0.9'/><circle cx='34' cy='31' r='0.6'/><circle cx='10' cy='33' r='0.45'/></svg>`,
)

export const BOARD_THEMES: ReadonlyArray<BoardTheme> = [
  {
    id: 'classic-wood',
    name: 'Classic Wood',
    description: 'Hand-rubbed maple and walnut with a warm lacquer.',
    price: 0,
    material: 'wood',
    lightSquare: {
      ...surface('#ecd3a8', ['linear-gradient(115deg, rgba(255,255,255,0.10), rgba(0,0,0,0.04))', 'repeating-linear-gradient(97deg, rgba(120,72,30,0.07) 0 2px, transparent 2px 9px)']),
    },
    darkSquare: {
      ...surface('#a8744a', ['linear-gradient(115deg, rgba(255,255,255,0.06), rgba(0,0,0,0.08))', 'repeating-linear-gradient(83deg, rgba(60,30,10,0.12) 0 2px, transparent 2px 8px)']),
    },
    notationLight: '#9a6b42',
    notationDark: '#f3e1c2',
    boardFrame: {
      boxShadow: '0 0 0 6px #5b371c, 0 0 0 7px rgba(255,220,170,0.25), 0 30px 60px -20px rgba(0,0,0,0.8)',
    },
    highlights: {
      lastMove: { backgroundColor: 'rgba(255, 214, 102, 0.45)' },
      selected: { backgroundColor: 'rgba(255, 160, 50, 0.55)' },
      target: { backgroundImage: 'radial-gradient(circle, rgba(60, 30, 10, 0.42) 22%, transparent 24%)' },
      captureTarget: {
        backgroundImage: 'radial-gradient(circle, transparent 58%, rgba(60,30,10,0.45) 60%, rgba(60,30,10,0.45) 72%, transparent 74%)',
      },
      check: { backgroundImage: 'radial-gradient(circle, rgba(255,64,64,0.95) 0%, rgba(239,68,68,0.6) 38%, transparent 75%)' },
      hover: { boxShadow: 'inset 0 0 0 4px rgba(255, 245, 220, 0.75)' },
      hint: { boxShadow: glowRing('rgba(255, 196, 0, 0.9)') },
    },
    accent: '#f59e0b',
    accent2: '#fb7185',
    background:
      'radial-gradient(1100px 600px at 10% -10%, rgba(245,158,11,0.16), transparent 60%), radial-gradient(900px 500px at 110% 10%, rgba(251,113,133,0.10), transparent 60%), #120d09',
    chromeColor: '#120d09',
    particles: ['#fbbf24', '#f59e0b', '#fde68a', '#fb7185', '#ffffff'],
    suggestedPieceSet: 'standard',
  },
  {
    id: 'minimal',
    name: 'Minimalist',
    description: 'Calm slate tones designed for long, focused sessions.',
    price: 0,
    material: 'soft',
    lightSquare: { backgroundColor: '#dee3e6' },
    darkSquare: { backgroundColor: '#8ca2ad' },
    notationLight: '#788a94',
    notationDark: '#eef2f4',
    boardFrame: { boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 30px 60px -20px rgba(0,0,0,0.75)' },
    highlights: {
      lastMove: { backgroundColor: 'rgba(250, 204, 21, 0.38)' },
      selected: { backgroundColor: 'rgba(52, 211, 153, 0.55)' },
      target: { backgroundImage: 'radial-gradient(circle, rgba(15, 23, 42, 0.38) 22%, transparent 24%)' },
      captureTarget: {
        backgroundImage: 'radial-gradient(circle, transparent 58%, rgba(15,23,42,0.42) 60%, rgba(15,23,42,0.42) 72%, transparent 74%)',
      },
      check: { backgroundImage: 'radial-gradient(circle, rgba(255,64,64,0.95) 0%, rgba(239,68,68,0.65) 35%, transparent 75%)' },
      hover: { boxShadow: 'inset 0 0 0 4px rgba(255, 255, 255, 0.55)' },
      hint: { boxShadow: glowRing('rgba(52, 211, 153, 0.9)') },
    },
    accent: '#34d399',
    accent2: '#38bdf8',
    background:
      'radial-gradient(1200px 600px at 10% -10%, rgba(16,185,129,0.12), transparent 60%), radial-gradient(900px 500px at 110% 10%, rgba(14,165,233,0.10), transparent 60%), #0b0d12',
    chromeColor: '#0b0d12',
    particles: ['#34d399', '#38bdf8', '#a7f3d0', '#ffffff'],
    suggestedPieceSet: 'standard',
  },
  {
    id: 'oled-black',
    name: 'OLED Deep Black',
    description: 'True-black surfaces that switch OLED pixels off — easy on eyes and battery.',
    price: 0,
    material: 'soft',
    lightSquare: { backgroundColor: '#454b55' },
    darkSquare: { backgroundColor: '#1c2027' },
    notationLight: '#9aa1ad',
    notationDark: '#6b7280',
    boardFrame: { boxShadow: '0 0 0 1px rgba(255,255,255,0.10)' },
    highlights: {
      lastMove: { backgroundColor: 'rgba(56, 189, 248, 0.28)' },
      selected: { backgroundColor: 'rgba(56, 189, 248, 0.45)' },
      target: { backgroundImage: 'radial-gradient(circle, rgba(226, 232, 240, 0.55) 18%, transparent 21%)' },
      captureTarget: {
        backgroundImage: 'radial-gradient(circle, transparent 58%, rgba(226,232,240,0.5) 60%, rgba(226,232,240,0.5) 70%, transparent 73%)',
      },
      check: { backgroundImage: 'radial-gradient(circle, rgba(255,64,64,0.95) 0%, rgba(239,68,68,0.55) 38%, transparent 75%)' },
      hover: { boxShadow: 'inset 0 0 0 3px rgba(56, 189, 248, 0.85)' },
      hint: { boxShadow: glowRing('rgba(56, 189, 248, 0.9)') },
    },
    accent: '#38bdf8',
    accent2: '#a3e635',
    background: '#000000',
    chromeColor: '#000000',
    particles: ['#38bdf8', '#a3e635', '#ffffff'],
    suggestedPieceSet: 'standard',
  },
  {
    id: 'obsidian-marble',
    name: 'Obsidian Marble',
    description: 'Carrara marble against volcanic glass, lit from above.',
    price: 200,
    material: 'marble',
    lightSquare: {
      ...surface('#dcdee6', ['radial-gradient(ellipse at 25% 30%, rgba(255,255,255,0.75), transparent 60%)', 'linear-gradient(135deg, transparent 44%, rgba(110,110,135,0.28) 49%, transparent 54%)', 'linear-gradient(60deg, transparent 62%, rgba(140,140,160,0.18) 66%, transparent 70%)']),
    },
    darkSquare: {
      ...surface('#262833', ['linear-gradient(135deg, rgba(255,255,255,0.08), transparent 40%)', 'linear-gradient(315deg, rgba(139,92,246,0.16), transparent 60%)']),
    },
    notationLight: '#6b6f80',
    notationDark: '#c9cbe0',
    boardFrame: {
      boxShadow: '0 0 0 5px #15161d, 0 0 0 6px rgba(167,139,250,0.35), 0 30px 70px -20px rgba(76,29,149,0.6)',
    },
    highlights: {
      lastMove: { backgroundColor: 'rgba(167, 139, 250, 0.42)' },
      selected: { backgroundColor: 'rgba(129, 140, 248, 0.6)' },
      target: { backgroundImage: 'radial-gradient(circle, rgba(167,139,250,0.75) 18%, rgba(167,139,250,0.25) 23%, transparent 26%)' },
      captureTarget: {
        backgroundImage: 'radial-gradient(circle, transparent 58%, rgba(167,139,250,0.65) 60%, rgba(167,139,250,0.65) 70%, transparent 73%)',
      },
      check: { backgroundImage: 'radial-gradient(circle, rgba(255,64,96,0.95) 0%, rgba(225,29,72,0.6) 38%, transparent 75%)' },
      hover: { boxShadow: 'inset 0 0 0 4px rgba(196, 181, 253, 0.8)' },
      hint: { boxShadow: glowRing('rgba(196, 181, 253, 0.95)') },
    },
    accent: '#a78bfa',
    accent2: '#818cf8',
    background:
      'radial-gradient(1100px 600px at 10% -10%, rgba(139,92,246,0.16), transparent 60%), radial-gradient(900px 500px at 110% 20%, rgba(99,102,241,0.12), transparent 60%), #0b0a12',
    chromeColor: '#0b0a12',
    particles: ['#c4b5fd', '#a78bfa', '#818cf8', '#e0e7ff', '#ffffff'],
    suggestedPieceSet: 'obsidian',
  },
  {
    id: 'cyberpunk-neon',
    name: 'Cyberpunk Neon',
    description: 'A holographic grid humming in a rain-slick megacity.',
    price: 400,
    musicTexture: 'cyber',
    material: 'synth',
    lightSquare: {
      ...surface('#2a1650', ['linear-gradient(135deg, rgba(240,171,252,0.10), transparent 60%)']),
      boxShadow: 'inset 0 0 0 1px rgba(240,171,252,0.22)',
    },
    darkSquare: {
      ...surface('#0f0820', ['linear-gradient(135deg, rgba(34,211,238,0.08), transparent 60%)']),
      boxShadow: 'inset 0 0 0 1px rgba(34,211,238,0.16)',
    },
    notationLight: '#f0abfc',
    notationDark: '#67e8f9',
    boardFrame: {
      boxShadow: '0 0 0 2px rgba(34,211,238,0.8), 0 0 30px rgba(34,211,238,0.45), 0 0 80px -10px rgba(232,121,249,0.5)',
    },
    highlights: {
      lastMove: { backgroundColor: 'rgba(240, 171, 252, 0.30)', boxShadow: 'inset 0 0 14px rgba(240,171,252,0.7)' },
      selected: { backgroundColor: 'rgba(34, 211, 238, 0.35)', boxShadow: 'inset 0 0 16px rgba(34,211,238,0.9)' },
      target: { backgroundImage: 'radial-gradient(circle, rgba(34,211,238,0.95) 14%, rgba(34,211,238,0.35) 20%, transparent 26%)' },
      captureTarget: {
        backgroundImage: 'radial-gradient(circle, transparent 56%, rgba(240,171,252,0.9) 60%, rgba(240,171,252,0.4) 68%, transparent 74%)',
      },
      check: { backgroundImage: 'radial-gradient(circle, rgba(255,0,110,1) 0%, rgba(255,0,110,0.55) 40%, transparent 75%)' },
      hover: { boxShadow: 'inset 0 0 0 3px rgba(34,211,238,0.9), inset 0 0 20px rgba(34,211,238,0.6)' },
      hint: { boxShadow: glowRing('rgba(250, 204, 21, 0.95)') },
    },
    accent: '#22d3ee',
    accent2: '#e879f9',
    background:
      'radial-gradient(1000px 600px at 0% 0%, rgba(232,121,249,0.20), transparent 60%), radial-gradient(900px 600px at 100% 20%, rgba(34,211,238,0.16), transparent 60%), linear-gradient(rgba(34,211,238,0.035) 1px, transparent 1px) 0 0 / 100% 32px, #07040f',
    chromeColor: '#07040f',
    particles: ['#22d3ee', '#e879f9', '#a78bfa', '#facc15', '#ffffff'],
    suggestedPieceSet: 'neon',
  },
  {
    id: 'royal-gold',
    name: 'Royal Gold',
    description: 'Gold leaf and crimson velvet fit for a coronation.',
    price: 750,
    material: 'metal',
    lightSquare: {
      ...surface('#e9d49a', ['linear-gradient(135deg, rgba(255,255,255,0.45), transparent 35%, rgba(180,130,30,0.15) 70%, rgba(255,255,255,0.2))']),
    },
    darkSquare: {
      ...surface('transparent', ['radial-gradient(ellipse at 30% 25%, rgba(255,255,255,0.10), transparent 60%)', 'linear-gradient(160deg, #8a1c2c, #5c0f1b)']),
    },
    notationLight: '#8a1c2c',
    notationDark: '#f5d77a',
    boardFrame: {
      boxShadow:
        '0 0 0 4px #b8860b, 0 0 0 6px #fde68a, 0 0 0 8px #7a5a10, 0 30px 70px -20px rgba(250,204,21,0.35), 0 30px 60px -20px rgba(0,0,0,0.85)',
    },
    highlights: {
      lastMove: { backgroundColor: 'rgba(253, 224, 71, 0.45)' },
      selected: { backgroundColor: 'rgba(250, 204, 21, 0.6)', boxShadow: 'inset 0 0 14px rgba(255,255,255,0.6)' },
      target: { backgroundImage: 'radial-gradient(circle, rgba(250,204,21,0.9) 16%, rgba(161,98,7,0.4) 22%, transparent 25%)' },
      captureTarget: {
        backgroundImage: 'radial-gradient(circle, transparent 57%, rgba(250,204,21,0.85) 60%, rgba(161,98,7,0.6) 70%, transparent 74%)',
      },
      check: { backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(239,68,68,0.75) 30%, transparent 75%)' },
      hover: { boxShadow: 'inset 0 0 0 4px rgba(253, 230, 138, 0.9)' },
      hint: { boxShadow: glowRing('rgba(253, 230, 138, 0.95)') },
    },
    accent: '#facc15',
    accent2: '#f43f5e',
    background:
      'radial-gradient(1100px 600px at 10% -10%, rgba(250,204,21,0.16), transparent 60%), radial-gradient(900px 600px at 110% 10%, rgba(244,63,94,0.14), transparent 60%), #120a0c',
    chromeColor: '#120a0c',
    particles: ['#facc15', '#fde68a', '#f59e0b', '#f43f5e', '#ffffff'],
    suggestedPieceSet: 'gilded',
  },
  // ── Epoch themes: earned by defeating historical legends (Chronos Chess) ──
  {
    id: 'papyrus-gold',
    name: 'Papyrus & Gold',
    description: 'Woven papyrus and lapis lazuli from the court of Alexandria.',
    price: 0,
    legendUnlock: 'cleopatra',
    musicTexture: 'ancient',
    material: 'marble',
    lightSquare: {
      ...surface('transparent', ['repeating-linear-gradient(0deg, rgba(120,84,30,0.10) 0 1px, transparent 1px 6px)', 'repeating-linear-gradient(90deg, rgba(120,84,30,0.08) 0 1px, transparent 1px 9px)', 'linear-gradient(135deg, #f1dfaf, #e2c98a)']),
    },
    // Sienna sandstone (not lapis) so the lapis-blue pieces stand out on every square.
    darkSquare: {
      ...surface('transparent', ['radial-gradient(circle at 30% 30%, rgba(250,204,21,0.25) 0 1px, transparent 2px)', 'radial-gradient(circle at 70% 65%, rgba(250,204,21,0.2) 0 1px, transparent 2px)', 'linear-gradient(135deg, #a8743a, #7f5326)']),
    },
    notationLight: '#8a6420',
    notationDark: '#fde7a8',
    boardFrame: {
      boxShadow: '0 0 0 4px #c9a043, 0 0 0 7px #1d3570, 0 0 0 9px #e0b04a, 0 30px 70px -20px rgba(224,176,74,0.45)',
    },
    highlights: {
      lastMove: { backgroundColor: 'rgba(45, 212, 191, 0.38)' },
      selected: { backgroundColor: 'rgba(224, 176, 74, 0.6)' },
      target: { backgroundImage: 'radial-gradient(circle, rgba(224,176,74,0.95) 16%, rgba(120,84,30,0.35) 22%, transparent 25%)' },
      captureTarget: {
        backgroundImage: 'radial-gradient(circle, transparent 57%, rgba(45,212,191,0.85) 60%, rgba(45,212,191,0.5) 70%, transparent 74%)',
      },
      check: { backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(220,38,38,0.75) 32%, transparent 75%)' },
      hover: { boxShadow: 'inset 0 0 0 4px rgba(45, 212, 191, 0.85)' },
      hint: { boxShadow: glowRing('rgba(224, 176, 74, 0.95)') },
    },
    accent: '#e0b04a',
    accent2: '#2dd4bf',
    background:
      'radial-gradient(1100px 600px at 20% -10%, rgba(224,176,74,0.22), transparent 60%), radial-gradient(900px 600px at 110% 30%, rgba(45,212,191,0.12), transparent 60%), linear-gradient(180deg, #120c05, #0a0f1e)',
    chromeColor: '#120c05',
    particles: ['#e0b04a', '#fde68a', '#2dd4bf', '#1d4ed8', '#ffffff'],
    suggestedPieceSet: 'lapis',
  },
  {
    id: 'blueprint',
    name: 'Principia Blueprint',
    description: 'Inked geometry on navy drafting paper, as if plotted by Newton himself.',
    price: 0,
    legendUnlock: 'newton',
    musicTexture: 'baroque',
    material: 'wood',
    lightSquare: {
      ...surface('#2d5a94', [{ image: 'linear-gradient(rgba(191,219,254,0.18) 1px, transparent 1px)', size: '25% 25%', position: '0 0', repeat: 'repeat' }, { image: 'linear-gradient(90deg, rgba(191,219,254,0.18) 1px, transparent 1px)', size: '25% 25%', position: '0 0', repeat: 'repeat' }]),
    },
    darkSquare: {
      ...surface('#1b3a66', [{ image: 'linear-gradient(rgba(191,219,254,0.12) 1px, transparent 1px)', size: '25% 25%', position: '0 0', repeat: 'repeat' }, { image: 'linear-gradient(90deg, rgba(191,219,254,0.12) 1px, transparent 1px)', size: '25% 25%', position: '0 0', repeat: 'repeat' }]),
    },
    notationLight: '#dbeafe',
    notationDark: '#93c5fd',
    boardFrame: {
      boxShadow: '0 0 0 2px rgba(219,234,254,0.85), 0 0 0 7px #10284a, 0 0 0 8px rgba(219,234,254,0.4), 0 30px 70px -20px rgba(30,64,175,0.6)',
    },
    highlights: {
      lastMove: { backgroundColor: 'rgba(253, 230, 138, 0.28)', boxShadow: 'inset 0 0 0 2px rgba(253,230,138,0.6)' },
      selected: { backgroundColor: 'rgba(253, 230, 138, 0.4)' },
      target: { backgroundImage: 'radial-gradient(circle, transparent 16%, rgba(253,230,138,0.95) 18%, rgba(253,230,138,0.95) 22%, transparent 24%)' },
      captureTarget: {
        backgroundImage: 'radial-gradient(circle, transparent 60%, rgba(253,230,138,0.9) 62%, rgba(253,230,138,0.9) 66%, transparent 68%)',
      },
      check: { backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(248,113,113,0.7) 35%, transparent 75%)' },
      hover: { boxShadow: 'inset 0 0 0 3px rgba(253, 230, 138, 0.9)' },
      hint: { boxShadow: glowRing('rgba(253, 230, 138, 0.95)') },
    },
    accent: '#93c5fd',
    accent2: '#fde68a',
    background:
      'linear-gradient(rgba(147,197,253,0.05) 1px, transparent 1px) 0 0 / 100% 28px, linear-gradient(90deg, rgba(147,197,253,0.05) 1px, transparent 1px) 0 0 / 28px 100%, radial-gradient(900px 600px at 80% -10%, rgba(253,230,138,0.12), transparent 60%), #0a1628',
    chromeColor: '#0a1628',
    particles: ['#93c5fd', '#dbeafe', '#fde68a', '#ffffff'],
    suggestedPieceSet: 'ink',
  },
  {
    id: 'imperial-velvet',
    name: 'Imperial Velvet',
    description: 'Ivory and Napoleonic blue velvet, trimmed with laurel gold.',
    price: 0,
    legendUnlock: 'napoleon',
    musicTexture: 'imperial',
    material: 'metal',
    lightSquare: surface('#efe4cc', ['linear-gradient(135deg, rgba(255,255,255,0.4), transparent 45%)']),
    darkSquare: {
      ...surface('transparent', ['radial-gradient(ellipse at 30% 25%, rgba(255,255,255,0.12), transparent 60%)', 'linear-gradient(160deg, #24357a, #141f4d)']),
    },
    notationLight: '#24357a',
    notationDark: '#e8c766',
    boardFrame: {
      boxShadow: '0 0 0 3px #d4af37, 0 0 0 6px #7f1d1d, 0 0 0 8px #d4af37, 0 30px 70px -20px rgba(127,29,29,0.55), 0 30px 60px -20px rgba(0,0,0,0.85)',
    },
    highlights: {
      lastMove: { backgroundColor: 'rgba(212, 175, 55, 0.42)' },
      selected: { backgroundColor: 'rgba(212, 175, 55, 0.6)' },
      target: { backgroundImage: 'radial-gradient(circle, rgba(185,28,28,0.85) 16%, rgba(185,28,28,0.3) 22%, transparent 25%)' },
      captureTarget: {
        backgroundImage: 'radial-gradient(circle, transparent 57%, rgba(185,28,28,0.85) 60%, rgba(185,28,28,0.55) 70%, transparent 74%)',
      },
      check: { backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(220,38,38,0.8) 30%, transparent 75%)' },
      hover: { boxShadow: 'inset 0 0 0 4px rgba(212, 175, 55, 0.9)' },
      hint: { boxShadow: glowRing('rgba(212, 175, 55, 0.95)') },
    },
    accent: '#d4af37',
    accent2: '#ef4444',
    background:
      'radial-gradient(1100px 600px at 10% -10%, rgba(36,53,122,0.45), transparent 60%), radial-gradient(900px 600px at 110% 20%, rgba(127,29,29,0.35), transparent 60%), #0b0d1a',
    chromeColor: '#0b0d1a',
    particles: ['#d4af37', '#2563eb', '#ffffff', '#ef4444'],
    suggestedPieceSet: 'imperial',
  },
  {
    id: 'chalkboard',
    name: 'Chalkboard 1905',
    description: 'A slate blackboard dusted with the equations of a miraculous year.',
    price: 0,
    legendUnlock: 'einstein',
    musicTexture: 'modern',
    material: 'soft',
    lightSquare: {
      ...surface('#4f6157', ['radial-gradient(ellipse at 40% 30%, rgba(255,255,255,0.10), transparent 70%)']),
    },
    darkSquare: {
      ...surface('#2c3a33', ['radial-gradient(ellipse at 60% 70%, rgba(255,255,255,0.06), transparent 70%)']),
    },
    notationLight: '#f8fafc',
    notationDark: '#e2e8f0',
    boardFrame: {
      boxShadow: '0 0 0 8px #6b4a2b, 0 0 0 9px rgba(255,255,255,0.15), 0 30px 60px -20px rgba(0,0,0,0.85)',
    },
    highlights: {
      lastMove: { backgroundColor: 'rgba(254, 243, 199, 0.22)', boxShadow: 'inset 0 0 0 2px rgba(254,243,199,0.55)' },
      selected: { backgroundColor: 'rgba(147, 197, 253, 0.35)' },
      target: { backgroundImage: 'radial-gradient(circle, rgba(248,250,252,0.85) 15%, transparent 19%)' },
      captureTarget: {
        backgroundImage: 'radial-gradient(circle, transparent 58%, rgba(248,250,252,0.75) 60%, rgba(248,250,252,0.75) 65%, transparent 68%)',
      },
      check: { backgroundImage: 'radial-gradient(circle, rgba(254,202,202,0.9) 0%, rgba(239,68,68,0.6) 35%, transparent 75%)' },
      hover: { boxShadow: 'inset 0 0 0 3px rgba(248, 250, 252, 0.8)' },
      hint: { boxShadow: glowRing('rgba(254, 243, 199, 0.95)') },
    },
    accent: '#fde68a',
    accent2: '#93c5fd',
    background:
      'radial-gradient(1000px 600px at 15% -10%, rgba(253,230,138,0.10), transparent 60%), radial-gradient(900px 600px at 100% 30%, rgba(147,197,253,0.10), transparent 60%), #111815',
    chromeColor: '#111815',
    particles: ['#f8fafc', '#fde68a', '#93c5fd', '#fca5a5'],
    suggestedPieceSet: 'chalk',
  },
  // ── New eras & realms ──
  {
    id: 'rune-oak',
    name: 'Rune-Carved Oak',
    description: 'Ash and smoke-dark oak, carved with runes and trimmed in winter fur.',
    price: 0,
    legendUnlock: 'ragnar',
    musicTexture: 'nordic',
    material: 'wood',
    lightSquare: {
      ...surface('#d9c3a0', [{ image: RUNES('rgba(92,56,25,0.13)'), size: '62%' }, 'repeating-linear-gradient(92deg, rgba(110,70,35,0.08) 0 2px, transparent 2px 8px)']),
    },
    darkSquare: {
      ...surface('#5c3d24', [{ image: RUNES('rgba(232,214,180,0.11)'), size: '62%' }, 'repeating-linear-gradient(88deg, rgba(0,0,0,0.12) 0 2px, transparent 2px 7px)']),
    },
    notationLight: '#6b4423',
    notationDark: '#ead9bd',
    boardFrame: {
      // Iron rim, then a pale fur trim.
      boxShadow: '0 0 0 3px #3f3f46, 0 0 0 9px #e7dcc8, 0 0 0 10px rgba(0,0,0,0.4), 0 30px 70px -20px rgba(0,0,0,0.85)',
    },
    highlights: {
      lastMove: { backgroundColor: 'rgba(125, 211, 252, 0.32)' },
      selected: { backgroundColor: 'rgba(214, 185, 140, 0.6)' },
      target: { backgroundImage: 'radial-gradient(circle, rgba(30,20,10,0.5) 20%, transparent 23%)' },
      captureTarget: {
        backgroundImage: 'radial-gradient(circle, transparent 57%, rgba(185,28,28,0.75) 60%, rgba(185,28,28,0.5) 70%, transparent 74%)',
      },
      check: { backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(220,38,38,0.8) 30%, transparent 75%)' },
      hover: { boxShadow: 'inset 0 0 0 4px rgba(125, 211, 252, 0.85)' },
      hint: { boxShadow: glowRing('rgba(125, 211, 252, 0.95)') },
    },
    accent: '#d6b98c',
    accent2: '#7dd3fc',
    background:
      'radial-gradient(1000px 600px at 15% -10%, rgba(125,211,252,0.14), transparent 60%), radial-gradient(900px 600px at 100% 30%, rgba(214,185,140,0.12), transparent 60%), linear-gradient(180deg, #0f1519, #0a0d10)',
    chromeColor: '#0f1519',
    particles: ['#d6b98c', '#e7dcc8', '#7dd3fc', '#ffffff'],
    suggestedPieceSet: 'runestone',
  },
  {
    id: 'bamboo-gold',
    name: 'Bamboo & Gold Leaf',
    description: 'Bamboo slats beside black lacquer flecked with gold leaf, framed in ink wash.',
    price: 0,
    legendUnlock: 'musashi',
    musicTexture: 'japanese',
    material: 'wood',
    lightSquare: {
      ...surface('transparent', [{ image: INK_STROKE, size: '100%' }, 'repeating-linear-gradient(0deg, transparent 0 46%, rgba(120,110,40,0.22) 46% 50%, transparent 50% 100%)', 'linear-gradient(90deg, #e7dfb2, #f1ead0 50%, #e2d8a6)']),
    },
    darkSquare: {
      ...surface('#1c1917', ['radial-gradient(circle at 25% 35%, rgba(212,167,44,0.55) 0 1.2px, transparent 2px)', 'radial-gradient(circle at 70% 70%, rgba(212,167,44,0.45) 0 1px, transparent 2px)', 'radial-gradient(circle at 60% 20%, rgba(212,167,44,0.35) 0 0.8px, transparent 1.5px)']),
    },
    notationLight: '#57534e',
    notationDark: '#d4a72c',
    boardFrame: { boxShadow: '0 0 0 2px #d4a72c, 0 0 0 7px #0c0a09, 0 0 0 8px rgba(212,167,44,0.5), 0 30px 60px -20px rgba(0,0,0,0.85)' },
    highlights: {
      lastMove: { backgroundColor: 'rgba(212, 167, 44, 0.38)' },
      selected: { backgroundColor: 'rgba(239, 68, 68, 0.45)' },
      target: { backgroundImage: 'radial-gradient(circle, rgba(185,28,28,0.75) 15%, transparent 19%)' },
      captureTarget: {
        backgroundImage: 'radial-gradient(circle, transparent 58%, rgba(185,28,28,0.8) 60%, rgba(185,28,28,0.8) 66%, transparent 69%)',
      },
      check: { backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(220,38,38,0.85) 30%, transparent 75%)' },
      hover: { boxShadow: 'inset 0 0 0 3px rgba(212, 167, 44, 0.9)' },
      hint: { boxShadow: glowRing('rgba(239, 68, 68, 0.9)') },
    },
    accent: '#ef4444',
    accent2: '#d4a72c',
    // Minimal ink-wash: soft grey "clouds" of diluted ink on near-black paper.
    background:
      'radial-gradient(700px 300px at 20% 10%, rgba(229,231,235,0.07), transparent 70%), radial-gradient(600px 260px at 85% 60%, rgba(229,231,235,0.05), transparent 70%), radial-gradient(500px 200px at 40% 95%, rgba(239,68,68,0.06), transparent 70%), #0d0d0e',
    chromeColor: '#0d0d0e',
    particles: ['#ef4444', '#d4a72c', '#f5f5f4', '#fecaca'],
    suggestedPieceSet: 'lacquer',
  },
  {
    id: 'elven-crystal',
    name: 'Elven Crystal',
    description: 'Moonlit crystal and living jade, veined with glowing leaves.',
    price: 0,
    legendUnlock: 'aerith',
    musicTexture: 'elven',
    material: 'crystal',
    lightSquare: {
      ...surface('#c7e8e4', ['conic-gradient(from 45deg at 50% 50%, rgba(255,255,255,0.35), rgba(186,230,253,0.15), rgba(255,255,255,0.35), rgba(196,181,253,0.2), rgba(255,255,255,0.35))']),
    },
    darkSquare: {
      ...surface('transparent', [{ image: LEAF, size: '85%' }, 'radial-gradient(ellipse at 30% 25%, rgba(134,239,172,0.25), transparent 65%)', 'linear-gradient(150deg, #0f766e, #134e4a)']),
    },
    notationLight: '#0f766e',
    notationDark: '#bbf7d0',
    boardFrame: {
      boxShadow: '0 0 0 2px rgba(226,232,240,0.9), 0 0 24px rgba(134,239,172,0.55), 0 0 60px -10px rgba(196,181,253,0.6), 0 30px 60px -20px rgba(0,0,0,0.8)',
    },
    highlights: {
      lastMove: { backgroundColor: 'rgba(196, 181, 253, 0.38)', boxShadow: 'inset 0 0 12px rgba(255,255,255,0.45)' },
      selected: { backgroundColor: 'rgba(134, 239, 172, 0.5)', boxShadow: 'inset 0 0 16px rgba(134,239,172,0.9)' },
      target: { backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.95) 12%, rgba(134,239,172,0.55) 19%, transparent 25%)' },
      captureTarget: {
        backgroundImage: 'radial-gradient(circle, transparent 57%, rgba(196,181,253,0.95) 60%, rgba(196,181,253,0.45) 68%, transparent 74%)',
      },
      check: { backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(244,63,94,0.7) 32%, transparent 75%)' },
      hover: { boxShadow: 'inset 0 0 0 3px rgba(134,239,172,0.9), inset 0 0 18px rgba(134,239,172,0.6)' },
      hint: { boxShadow: glowRing('rgba(196, 181, 253, 0.95)') },
    },
    accent: '#86efac',
    accent2: '#c4b5fd',
    background:
      'radial-gradient(2px 2px at 20% 30%, rgba(190,242,100,0.8), transparent), radial-gradient(2px 2px at 70% 60%, rgba(196,181,253,0.8), transparent), radial-gradient(1.5px 1.5px at 40% 80%, rgba(255,255,255,0.7), transparent), radial-gradient(1000px 600px at 50% -10%, rgba(134,239,172,0.18), transparent 60%), linear-gradient(180deg, #06201d, #050d12)',
    chromeColor: '#06201d',
    particles: ['#86efac', '#c4b5fd', '#ffffff', '#bae6fd'],
    suggestedPieceSet: 'moonsilver',
  },
  {
    id: 'obsidian-lava',
    name: 'Obsidian & Lava',
    description: 'Volcanic glass split by rivers of molten rock.',
    price: 0,
    legendUnlock: 'malakor',
    musicTexture: 'shadow',
    material: 'ember',
    lightSquare: {
      ...surface('#6b605c', [{ image: FISSURE, size: '100%' }, 'radial-gradient(ellipse at 40% 30%, rgba(255,255,255,0.08), transparent 70%)']),
    },
    darkSquare: {
      ...surface('transparent', ['radial-gradient(ellipse at 50% 120%, rgba(249,115,22,0.35), transparent 60%)', 'linear-gradient(140deg, #231d1f, #120d0f)']),
    },
    notationLight: '#fdba74',
    notationDark: '#f97316',
    boardFrame: {
      boxShadow: '0 0 0 2px #f97316, 0 0 30px rgba(249,115,22,0.55), 0 0 90px -10px rgba(168,85,247,0.45), 0 30px 60px -20px rgba(0,0,0,0.9)',
    },
    highlights: {
      lastMove: { backgroundColor: 'rgba(249, 115, 22, 0.32)', boxShadow: 'inset 0 0 14px rgba(249,115,22,0.6)' },
      selected: { backgroundColor: 'rgba(168, 85, 247, 0.45)', boxShadow: 'inset 0 0 16px rgba(168,85,247,0.8)' },
      target: { backgroundImage: 'radial-gradient(circle, rgba(253,186,116,0.95) 13%, rgba(249,115,22,0.45) 19%, transparent 25%)' },
      captureTarget: {
        backgroundImage: 'radial-gradient(circle, transparent 56%, rgba(249,115,22,0.95) 60%, rgba(220,38,38,0.5) 68%, transparent 74%)',
      },
      check: { backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(168,85,247,0.85) 32%, transparent 75%)' },
      hover: { boxShadow: 'inset 0 0 0 3px rgba(249,115,22,0.9), inset 0 0 18px rgba(249,115,22,0.6)' },
      hint: { boxShadow: glowRing('rgba(168, 85, 247, 0.95)') },
    },
    accent: '#f97316',
    accent2: '#a855f7',
    background:
      'radial-gradient(1200px 500px at 50% 120%, rgba(249,115,22,0.28), transparent 60%), radial-gradient(800px 500px at 100% -10%, rgba(168,85,247,0.18), transparent 60%), #070506',
    chromeColor: '#070506',
    particles: ['#f97316', '#fbbf24', '#a855f7', '#ef4444'],
    suggestedPieceSet: 'hellfire',
  },
  {
    id: 'storm-sea',
    name: 'Storm Sea Chart',
    description: 'Weathered sea charts on a deck of tarred planks, lashed with brass.',
    price: 0,
    campaignUnlock: 'discovery',
    musicTexture: 'nautical',
    material: 'wood',
    lightSquare: {
      ...surface('#e3cfa2', [{ image: SEA_CHART, size: '100%' }, 'radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.25), transparent 70%)']),
    },
    darkSquare: {
      ...surface('transparent', ['repeating-linear-gradient(90deg, rgba(0,0,0,0.12) 0 1px, transparent 1px 12px)', 'linear-gradient(160deg, #1f5f66, #123c45)']),
    },
    notationLight: '#7c4a1e',
    notationDark: '#e3cfa2',
    boardFrame: {
      boxShadow: '0 0 0 3px #b08d57, 0 0 0 7px #3b2414, 0 0 0 8px #d9b26a, 0 30px 60px -20px rgba(0,0,0,0.85)',
    },
    highlights: {
      lastMove: { backgroundColor: 'rgba(250, 204, 21, 0.38)' },
      selected: { backgroundColor: 'rgba(45, 212, 191, 0.5)', boxShadow: 'inset 0 0 12px rgba(45,212,191,0.6)' },
      target: { backgroundImage: 'radial-gradient(circle, rgba(13,148,136,0.75) 15%, transparent 21%)' },
      captureTarget: { backgroundImage: 'radial-gradient(circle, transparent 56%, rgba(180,83,9,0.85) 60%, transparent 70%)' },
      check: { backgroundImage: 'radial-gradient(circle, rgba(239,68,68,0.95) 0%, rgba(239,68,68,0.45) 42%, transparent 75%)' },
      hover: { boxShadow: 'inset 0 0 0 3px rgba(217,178,106,0.95)' },
      hint: { boxShadow: glowRing('rgba(45, 212, 191, 0.95)') },
    },
    accent: '#2dd4bf',
    accent2: '#d9b26a',
    background:
      'radial-gradient(1200px 600px at 50% -10%, rgba(45,212,191,0.16), transparent 60%), repeating-linear-gradient(170deg, rgba(255,255,255,0.018) 0 2px, transparent 2px 22px), linear-gradient(180deg, #06232a, #03121a)',
    chromeColor: '#06232a',
    particles: ['#2dd4bf', '#d9b26a', '#e3cfa2', '#ffffff'],
    suggestedPieceSet: 'brass',
  },
  {
    id: 'nebula',
    name: 'Nebula Throne',
    description: 'Squares cut from starlight and violet nebulae — the board of the Star Gods.',
    price: 0,
    campaignUnlock: 'cosmic',
    musicTexture: 'cosmic',
    material: 'crystal',
    lightSquare: {
      ...surface('#5b4a9b', [{ image: STARFIELD, size: '100%' }, 'radial-gradient(ellipse at 30% 25%, rgba(196,181,253,0.55), transparent 70%)']),
    },
    darkSquare: {
      ...surface('#160f33', [{ image: STARFIELD, size: '100%' }, 'radial-gradient(ellipse at 70% 80%, rgba(236,72,153,0.25), transparent 70%)']),
    },
    notationLight: '#ede9fe',
    notationDark: '#c4b5fd',
    boardFrame: {
      boxShadow: '0 0 0 2px #c4b5fd, 0 0 34px rgba(167,139,250,0.55), 0 0 100px -10px rgba(236,72,153,0.45), 0 30px 60px -20px rgba(0,0,0,0.9)',
    },
    highlights: {
      lastMove: { backgroundColor: 'rgba(196, 181, 253, 0.32)', boxShadow: 'inset 0 0 14px rgba(196,181,253,0.6)' },
      selected: { backgroundColor: 'rgba(236, 72, 153, 0.4)', boxShadow: 'inset 0 0 16px rgba(236,72,153,0.8)' },
      target: { backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.95) 12%, rgba(196,181,253,0.45) 19%, transparent 25%)' },
      captureTarget: { backgroundImage: 'radial-gradient(circle, transparent 56%, rgba(236,72,153,0.9) 60%, rgba(196,181,253,0.4) 68%, transparent 74%)' },
      check: { backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(236,72,153,0.7) 35%, transparent 75%)' },
      hover: { boxShadow: 'inset 0 0 0 3px rgba(196,181,253,0.9), inset 0 0 18px rgba(196,181,253,0.6)' },
      hint: { boxShadow: glowRing('rgba(250, 204, 21, 0.95)') },
    },
    accent: '#c4b5fd',
    accent2: '#f472b6',
    background:
      'radial-gradient(1.5px 1.5px at 15% 25%, rgba(255,255,255,0.8), transparent), radial-gradient(1px 1px at 65% 15%, rgba(255,255,255,0.7), transparent), radial-gradient(2px 2px at 85% 70%, rgba(196,181,253,0.8), transparent), radial-gradient(900px 500px at 20% 0%, rgba(139,92,246,0.28), transparent 60%), radial-gradient(800px 500px at 100% 80%, rgba(236,72,153,0.18), transparent 60%), #05030f',
    chromeColor: '#05030f',
    particles: ['#c4b5fd', '#f472b6', '#ffffff', '#93c5fd', '#facc15'],
    suggestedPieceSet: 'stardust',
  },
]

export const PIECE_SETS: ReadonlyArray<PieceSet> = [
  {
    id: 'standard',
    name: 'Staunton',
    description: 'The tournament classic.',
    price: 0,
    white: { fill: '#ffffff', filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.35))' },
    black: { fill: '#000000', filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.35))' },
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    description: 'Polished stone with a violet inner glow.',
    price: 150,
    white: { fill: '#eeeef6', filter: 'drop-shadow(0 0 1.5px rgba(196,181,253,0.7)) drop-shadow(0 3px 3px rgba(0,0,0,0.55))' },
    black: { fill: '#1d1a2e', filter: 'drop-shadow(0 0 2px rgba(167,139,250,0.75)) drop-shadow(0 3px 3px rgba(0,0,0,0.6))' },
  },
  {
    id: 'neon',
    name: 'Neon Hologram',
    description: 'Light-sculpted pieces in cyan and magenta.',
    price: 300,
    white: { fill: '#dcfcff', filter: 'drop-shadow(0 0 2px #22d3ee) drop-shadow(0 0 6px rgba(34,211,238,0.7))' },
    black: { fill: '#2b0b3f', filter: 'drop-shadow(0 0 2px #f0abfc) drop-shadow(0 0 6px rgba(232,121,249,0.7))' },
  },
  {
    id: 'gilded',
    name: 'Gilded',
    description: '24-carat gold versus deep garnet.',
    price: 500,
    white: { fill: '#fde68a', filter: 'drop-shadow(0 0 2px rgba(251,191,36,0.8)) drop-shadow(0 2px 2px rgba(0,0,0,0.45))' },
    black: { fill: '#4a1020', filter: 'drop-shadow(0 0 2px rgba(250,204,21,0.75)) drop-shadow(0 2px 2px rgba(0,0,0,0.55))' },
  },
  {
    id: 'lapis',
    name: 'Lapis & Gold',
    description: 'Pharaonic gold against lapis lazuli.',
    price: 0,
    legendUnlock: 'cleopatra',
    white: { fill: '#f2d27a', filter: 'drop-shadow(0 0 2px rgba(224,176,74,0.8)) drop-shadow(0 2px 2px rgba(0,0,0,0.45))' },
    black: { fill: '#1e3a8a', filter: 'drop-shadow(0 0 2px rgba(224,176,74,0.85)) drop-shadow(0 2px 2px rgba(0,0,0,0.55))' },
  },
  {
    id: 'ink',
    name: 'Quill & Ink',
    description: 'Parchment pieces outlined in iron-gall ink.',
    price: 0,
    legendUnlock: 'newton',
    white: { fill: '#f5ecd7', filter: 'sepia(0.35) drop-shadow(0 2px 2px rgba(0,0,0,0.45))' },
    black: { fill: '#2b1d0e', filter: 'drop-shadow(0 0 1.5px rgba(253,230,138,0.6)) drop-shadow(0 2px 2px rgba(0,0,0,0.5))' },
  },
  {
    id: 'imperial',
    name: 'Grande Armée',
    description: 'Ivory guards against crimson grenadiers, edged in gold.',
    price: 0,
    legendUnlock: 'napoleon',
    white: { fill: '#fbf7ec', filter: 'drop-shadow(0 0 1.5px rgba(212,175,55,0.8)) drop-shadow(0 2px 2px rgba(0,0,0,0.45))' },
    black: { fill: '#9b1c1c', filter: 'drop-shadow(0 0 2px rgba(212,175,55,0.85)) drop-shadow(0 2px 2px rgba(0,0,0,0.55))' },
  },
  {
    id: 'chalk',
    name: 'Chalk Sketch',
    description: 'Pieces sketched in chalk on slate.',
    price: 0,
    legendUnlock: 'einstein',
    white: { fill: '#f8fafc', filter: 'drop-shadow(0 0 1.2px rgba(255,255,255,0.85))' },
    black: { fill: '#1b2420', filter: 'drop-shadow(0 0 1.5px rgba(248,250,252,0.9))' },
  },
  {
    id: 'runestone',
    name: 'Runestone',
    description: 'Carved bone against iron-dark soapstone.',
    price: 0,
    legendUnlock: 'ragnar',
    white: { fill: '#efe6d2', filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.55))' },
    black: { fill: '#2d3436', filter: 'drop-shadow(0 0 1.5px rgba(214,185,140,0.75)) drop-shadow(0 2px 2px rgba(0,0,0,0.6))' },
  },
  {
    id: 'lacquer',
    name: 'Urushi Lacquer',
    description: 'Ivory washi and vermilion lacquer, edged in gold.',
    price: 0,
    legendUnlock: 'musashi',
    white: { fill: '#f8f4e8', filter: 'drop-shadow(0 0 1px rgba(212,167,44,0.8)) drop-shadow(0 2px 2px rgba(0,0,0,0.45))' },
    black: { fill: '#b91c1c', filter: 'drop-shadow(0 0 1.5px rgba(212,167,44,0.85)) drop-shadow(0 2px 2px rgba(0,0,0,0.55))' },
  },
  {
    id: 'moonsilver',
    name: 'Moonsilver',
    description: 'Silver touched by moonlight versus deep forest jade.',
    price: 0,
    legendUnlock: 'aerith',
    white: { fill: '#f1f5f9', filter: 'drop-shadow(0 0 2px rgba(196,181,253,0.9)) drop-shadow(0 0 6px rgba(134,239,172,0.4))' },
    black: { fill: '#064e3b', filter: 'drop-shadow(0 0 2px rgba(134,239,172,0.9)) drop-shadow(0 2px 2px rgba(0,0,0,0.5))' },
  },
  {
    id: 'hellfire',
    name: 'Hellfire',
    description: 'Ash-white bone against obsidian rimmed in lava.',
    price: 0,
    legendUnlock: 'malakor',
    white: { fill: '#e7e5e4', filter: 'drop-shadow(0 0 2px rgba(249,115,22,0.7)) drop-shadow(0 2px 2px rgba(0,0,0,0.55))' },
    black: { fill: '#1c1917', filter: 'drop-shadow(0 0 2px rgba(249,115,22,0.95)) drop-shadow(0 0 5px rgba(220,38,38,0.6))' },
  },
  {
    id: 'brass',
    name: 'Brass & Tar',
    description: 'Polished ship’s brass against tarred oak, from the Age of Discovery.',
    price: 0,
    campaignUnlock: 'discovery',
    white: { fill: '#f2d38a', filter: 'drop-shadow(0 0 1.5px rgba(124,74,30,0.9)) drop-shadow(0 2px 2px rgba(0,0,0,0.5))' },
    black: { fill: '#2b1a10', filter: 'drop-shadow(0 0 2px rgba(45,212,191,0.85)) drop-shadow(0 2px 2px rgba(0,0,0,0.6))' },
  },
  {
    id: 'stardust',
    name: 'Stardust',
    description: 'Pieces of white starlight against the violet void, from the Cosmic Pantheon.',
    price: 0,
    campaignUnlock: 'cosmic',
    white: { fill: '#ffffff', filter: 'drop-shadow(0 0 3px rgba(196,181,253,0.95)) drop-shadow(0 0 8px rgba(147,197,253,0.5))' },
    black: { fill: '#3b0764', filter: 'drop-shadow(0 0 2px rgba(244,114,182,0.95)) drop-shadow(0 0 6px rgba(196,181,253,0.55))' },
  },
]

export const getBoardTheme = (id: BoardThemeId): BoardTheme =>
  BOARD_THEMES.find((t) => t.id === id) ?? (BOARD_THEMES[0] as BoardTheme)

export const getPieceSet = (id: PieceSetId): PieceSet => PIECE_SETS.find((p) => p.id === id) ?? (PIECE_SETS[0] as PieceSet)

export const FREE_THEMES: BoardThemeId[] = BOARD_THEMES.filter((t) => t.price === 0 && !t.legendUnlock && !t.campaignUnlock).map((t) => t.id)
export const FREE_PIECE_SETS: PieceSetId[] = PIECE_SETS.filter((p) => p.price === 0 && !p.legendUnlock && !p.campaignUnlock).map((p) => p.id)
