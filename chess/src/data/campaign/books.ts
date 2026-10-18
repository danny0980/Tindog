import type { BookId } from '../../types/campaign'

/**
 * Era-specific opening books. Each line is space-separated SAN from the
 * initial position; White lines are played as White, Black lines as Black
 * (replayed with chess.js by tests/campaign.test.ts).
 */
export const BOOKS: Readonly<Record<BookId, { name: string; summary: string; w: readonly string[]; b: readonly string[] }>> = {
  'old-masters': {
    name: 'Old Masters',
    summary: 'Slow, shatranj-style pawn moves and modest set-ups',
    w: ['e3 e5 d3', 'd3 d5 e3', 'c3 e5 d3', 'g3 d5 Bg2'],
    b: ['e4 e6 d4 b6', 'd4 d6', 'e4 d6', 'c4 e6', 'Nf3 d6'],
  },
  romantic: {
    name: 'Romantic Gambits',
    summary: 'King’s Gambit, Evans, Vienna — open lines and early attacks',
    w: ['e4 e5 f4', 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4', 'e4 e5 Bc4', 'e4 e5 Nc3 Nf6 f4'],
    b: ['e4 e5 Nf3 Nc6 Bc4 Nf6', 'e4 e5 f4 d5', 'd4 d5 c4 e5', 'e4 e5 Nf3 d6', 'c4 e5', 'Nf3 d5'],
  },
  classical: {
    name: 'Classical Schools',
    summary: 'Ruy Lopez, Queen’s Gambit Declined and Petroff',
    w: ['e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O', 'd4 d5 c4 e6 Nc3 Nf6 Bg5', 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3'],
    b: ['e4 e5 Nf3 Nc6 Bb5 a6', 'd4 d5 c4 e6', 'e4 e5 Nf3 Nf6', 'c4 e5', 'Nf3 d5'],
  },
  hypermodern: {
    name: 'Hypermodern',
    summary: 'Réti, King’s Indian Attack, Grünfeld and Nimzo-Indian',
    w: ['Nf3 d5 g3', 'c4 e5 g3', 'Nf3 Nf6 g3 g6 Bg2 Bg7 O-O', 'b3'],
    b: ['d4 Nf6 c4 g6 Nc3 d5', 'd4 Nf6 c4 e6 Nc3 Bb4', 'e4 Nf6', 'c4 g6', 'Nf3 Nf6'],
  },
  fortress: {
    name: 'Fortress Systems',
    summary: 'London, Colle, Caro-Kann, French and Slav',
    w: ['d4 d5 Bf4', 'd4 Nf6 Bf4', 'd4 d5 e3 Nf6 Bd3', 'e4 c6 d4 d5 e5'],
    b: ['e4 c6 d4 d5', 'e4 e6 d4 d5', 'd4 d5 c4 c6', 'c4 c6', 'Nf3 d5'],
  },
  gambit: {
    name: 'Gambiteer’s Arsenal',
    summary: 'Danish, Blackmar–Diemer, Smith–Morra, Englund, Budapest and Benko',
    w: ['e4 e5 d4 exd4 c3', 'd4 d5 e4', 'e4 c5 d4 cxd4 c3', 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4'],
    b: ['d4 e5', 'd4 Nf6 c4 e5', 'e4 e5 Nf3 f5', 'd4 Nf6 c4 c5 d5 b5', 'c4 e5 Nc3 Nf6 g3 c6', 'Nf3 f5'],
  },
  sicilian: {
    name: 'Sharp Sicilians',
    summary: 'Najdorf, Dragon and King’s Indian fire',
    w: ['e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3', 'e4 e5 Nf3 Nc6 d4', 'e4 c6 d4 d5 Nc3'],
    b: ['e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6', 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6', 'c4 c5', 'Nf3 c5'],
  },
  irregular: {
    name: 'Irregular & Offbeat',
    summary: 'Polish, Grob, Bird, Owen’s and St. George',
    w: ['b4', 'g4', 'f4', 'Nc3', 'b3 e5 Bb2'],
    b: ['e4 b6', 'e4 a6', 'd4 b5', 'e4 Nc6', 'c4 b6', 'Nf3 g6'],
  },
  engine: {
    name: 'Engine Main Lines',
    summary: 'Catalan, English Attack and the Berlin — modern theory',
    w: ['d4 Nf6 c4 e6 g3 d5 Bg2', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3', 'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O'],
    b: ['e4 e5 Nf3 Nc6 Bb5 Nf6', 'd4 Nf6 c4 e6 Nf3 d5', 'c4 e5 Nc3 Nf6', 'Nf3 d5 g3 Nf6'],
  },
  celestial: {
    name: 'Celestial Canon',
    summary: 'Deep main lines: the Marshall, the Grünfeld Exchange and the Berlin Wall',
    w: ['e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O c3 d5', 'd4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3 bxc3 Bg7', 'c4 e5 g3 Nf6 Bg2'],
    b: ['e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5', 'd4 Nf6 c4 g6 Nc3 d5', 'c4 e5', 'Nf3 Nf6 c4 e6'],
  },
}
