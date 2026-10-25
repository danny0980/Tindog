// Famous positions: step into the critical moment of a famous game, take the
// winner's side, and try to finish the job against Stockfish. The games are
// stored as their real move lists and replayed with chess.js, so the
// positions are exactly the historical ones (tests check every move).
import { Chess } from 'chess.js'
import type { Color } from '../types/chess'
import type { BattleRules } from '../variants/rules'

export interface FamousGame {
  id: string
  name: string
  players: string
  place: string
  year: number
  /** The whole game in SAN. */
  moves: readonly string[]
  /** Plies played before you take over. */
  startPly: number
  /** The side you play (the winner). */
  side: Color
  /** Moves you have to win in, counted from the start position. */
  within: number
  /** Classic character who played the losing side, if they are in the game. */
  opponent: string | null
  story: string
  /** What happened next (shown after you play). */
  actual: string
}

const split = (pgn: string): string[] => pgn.replace(/\d+\.(\.\.)?/g, ' ').split(/\s+/).filter(Boolean)

export const FAMOUS_GAMES: readonly FamousGame[] = [
  {
    id: 'immortal',
    name: 'The Immortal Game',
    players: 'Adolf Anderssen vs Lionel Kieseritzky',
    place: 'London',
    year: 1851,
    moves: split('1.e4 e5 2.f4 exf4 3.Bc4 Qh4+ 4.Kf1 b5 5.Bxb5 Nf6 6.Nf3 Qh6 7.d3 Nh5 8.Nh4 Qg5 9.Nf5 c6 10.g4 Nf6 11.Rg1 cxb5 12.h4 Qg6 13.h5 Qg5 14.Qf3 Ng8 15.Bxf4 Qf6 16.Nc3 Bc5 17.Nd5 Qxb2 18.Bd6 Bxg1 19.e5 Qxa1+ 20.Ke2 Na6 21.Nxg7+ Kd8 22.Qf6+ Nxf6 23.Be7#'),
    startPly: 34,
    side: 'w',
    within: 14,
    opponent: null,
    story: 'Black has just taken on b2 and threatens to take both of White’s rooks. Anderssen ignored the threats completely.',
    actual: 'Anderssen played 18.Bd6!!, gave up both rooks and his queen, and mated with 23.Be7#.',
  },
  {
    id: 'opera',
    name: 'The Opera Game',
    players: 'Paul Morphy vs the Duke of Brunswick & Count Isouard',
    place: 'Paris Opera',
    year: 1858,
    moves: split('1.e4 e5 2.Nf3 d6 3.d4 Bg4 4.dxe5 Bxf3 5.Qxf3 dxe5 6.Bc4 Nf6 7.Qb3 Qe7 8.Nc3 c6 9.Bg5 b5 10.Nxb5 cxb5 11.Bxb5+ Nbd7 12.O-O-O Rd8 13.Rxd7 Rxd7 14.Rd1 Qe6 15.Bxd7+ Nxd7 16.Qb8+ Nxb8 17.Rd8#'),
    startPly: 24,
    side: 'w',
    within: 12,
    opponent: null,
    story: 'Morphy, playing during a performance of an opera, has every piece in the attack. Black’s pieces are tangled up on the d-file.',
    actual: 'Morphy played 13.Rxd7!, then sacrificed his queen with 16.Qb8+! and mated with 17.Rd8#.',
  },
  {
    id: 'evergreen',
    name: 'The Evergreen Game',
    players: 'Adolf Anderssen vs Jean Dufresne',
    place: 'Berlin',
    year: 1852,
    moves: split('1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.b4 Bxb4 5.c3 Ba5 6.d4 exd4 7.O-O d3 8.Qb3 Qf6 9.e5 Qg6 10.Re1 Nge7 11.Ba3 b5 12.Qxb5 Rb8 13.Qa4 Bb6 14.Nbd2 Bb7 15.Ne4 Qf5 16.Bxd3 Qh5 17.Nf6+ gxf6 18.exf6 Rg8 19.Rad1 Qxf3 20.Rxe7+ Nxe7 21.Qxd7+ Kxd7 22.Bf5+ Ke8 23.Bd7+ Kf8 24.Bxe7#'),
    startPly: 38,
    side: 'w',
    within: 12,
    opponent: null,
    story: 'Black has just taken the knight on f3 and threatens mate on g2. White has one way out: attack first.',
    actual: 'Anderssen played 20.Rxe7+!, then 21.Qxd7+!! and mated with the two bishops: 24.Bxe7#.',
  },
  {
    id: 'legal',
    name: 'Légal’s Mate',
    players: 'Kermur de Légal vs Saint Brie',
    place: 'Café de la Régence, Paris',
    year: 1750,
    moves: split('1.e4 e5 2.Nf3 d6 3.Bc4 Bg4 4.Nc3 g6 5.Nxe5 Bxd1 6.Bxf7+ Ke7 7.Nd5#'),
    startPly: 10,
    side: 'w',
    within: 6,
    opponent: null,
    story: 'Black has just taken White’s queen. It looks like a disaster — but Black’s king is far too exposed.',
    actual: '6.Bxf7+ Ke7 7.Nd5# — the minor pieces mate the king in the middle of the board.',
  },
  {
    id: 'century',
    name: 'The Game of the Century',
    players: 'Donald Byrne vs Bobby Fischer (aged 13)',
    place: 'New York',
    year: 1956,
    moves: split('1.Nf3 Nf6 2.c4 g6 3.Nc3 Bg7 4.d4 O-O 5.Bf4 d5 6.Qb3 dxc4 7.Qxc4 c6 8.e4 Nbd7 9.Rd1 Nb6 10.Qc5 Bg4 11.Bg5 Na4 12.Qa3 Nxc3 13.bxc3 Nxe4 14.Bxe7 Qb6 15.Bc4 Nxc3 16.Bc5 Rfe8+ 17.Kf1 Be6 18.Bxb6 Bxc4+ 19.Kg1 Ne2+ 20.Kf1 Nxd4+ 21.Kg1 Ne2+ 22.Kf1 Nc3+ 23.Kg1 axb6 24.Qb4 Ra4 25.Qxb6 Nxd1 26.h3 Rxa2 27.Kh2 Nxf2 28.Re1 Rxe1 29.Qd8+ Bf8 30.Nxe1 Bd5 31.Nf3 Ne4 32.Qb8 b5 33.h4 h5 34.Ne5 Kg7 35.Kg1 Bc5+ 36.Kf1 Ng3+ 37.Ke1 Bb4+ 38.Kd1 Bb3+ 39.Kc1 Ne2+ 40.Kb1 Nc3+ 41.Kc1 Rc2#'),
    startPly: 33,
    side: 'b',
    within: 30,
    opponent: 'fischer',
    story: 'Thirteen-year-old Bobby Fischer’s queen is attacked. Instead of saving it, he found one of the most famous moves ever played.',
    actual: 'Fischer played 17...Be6!!, gave up his queen for a winning attack and material, and mated on move 41.',
  },
  {
    id: 'kasparov-topalov',
    name: 'Kasparov’s Immortal',
    players: 'Garry Kasparov vs Veselin Topalov',
    place: 'Wijk aan Zee',
    year: 1999,
    moves: split('1.e4 d6 2.d4 Nf6 3.Nc3 g6 4.Be3 Bg7 5.Qd2 c6 6.f3 b5 7.Nge2 Nbd7 8.Bh6 Bxh6 9.Qxh6 Bb7 10.a3 e5 11.O-O-O Qe7 12.Kb1 a6 13.Nc1 O-O-O 14.Nb3 exd4 15.Rxd4 c5 16.Rd1 Nb6 17.g3 Kb8 18.Na5 Ba8 19.Bh3 d5 20.Qf4+ Ka7 21.Rhe1 d4 22.Nd5 Nbxd5 23.exd5 Qd6 24.Rxd4 cxd4 25.Re7+ Kb6 26.Qxd4+ Kxa5 27.b4+ Ka4 28.Qc3 Qxd5 29.Ra7 Bb7 30.Rxb7 Qc4 31.Qxf6 Kxa3 32.Qxa6+ Kxb4 33.c3+ Kxc3 34.Qa1+ Kd2 35.Qb2+ Kd1 36.Bf1 Rd2 37.Rd7 Rxd7 38.Bxc4 bxc4 39.Qxh8 Rd3 40.Qa8 c3 41.Qa4+ Ke1 42.f4 f5 43.Kc1 Rd2 44.Qa7'),
    startPly: 46,
    side: 'w',
    within: 30,
    opponent: null,
    story: 'The position looks quiet, but Black’s king is short of defenders. Kasparov saw a combination more than ten moves deep.',
    actual: 'Kasparov played 24.Rxd4!!, chased the black king all the way to d1, and Topalov resigned on move 44.',
  },
]

export const getFamousGame = (id: string): FamousGame | undefined => FAMOUS_GAMES.find((g) => g.id === id)

/** The position you take over (null if the stored game doesn't replay). */
export function startFen(game: FamousGame): string | null {
  const chess = new Chess()
  try {
    for (const san of game.moves.slice(0, game.startPly)) chess.move(san)
  } catch {
    return null
  }
  return chess.turn() === game.side ? chess.fen() : null
}

/** The battle rules: win (by mate) within the game's move limit. */
export function positionRules(game: FamousGame): BattleRules | null {
  const fen = startFen(game)
  if (!fen) return null
  const moveNo = Number(fen.split(' ')[5] ?? 1)
  return { fen, objective: { kind: 'win-by', side: game.side, by: moveNo + game.within - 1 }, events: [] }
}
