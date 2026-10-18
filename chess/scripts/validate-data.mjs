// Validates bundled game data:
//  • every opening line in src/data/openings.ts is legal SAN
//  • every puzzle in src/data/puzzles.ts replays legally and ends in checkmate
//  • every legend repertoire line in src/data/historicalLegends.ts is legal SAN
//
//   node scripts/validate-data.mjs
import { Chess } from 'chess.js'
import { readFileSync } from 'node:fs'

let failures = 0

const openings = readFileSync(new URL('../src/data/openings.ts', import.meta.url), 'utf8')
const lines = [...openings.matchAll(/name: (['"])(.+?)\1, moves: '([^']+)'/g)]
for (const [, , name, moves] of lines) {
  const chess = new Chess()
  for (const san of moves.split(' ')) {
    try {
      chess.move(san)
    } catch {
      console.error(`✗ opening "${name}": illegal move "${san}"`)
      failures += 1
      break
    }
  }
}
console.log(`${lines.length} openings checked`)

const puzzles = readFileSync(new URL('../src/data/puzzles.ts', import.meta.url), 'utf8')
const entries = [...puzzles.matchAll(/id: '(p\d+)', fen: '([^']+)', solution: \[([^\]]+)\], mateIn: (\d)/g)]
for (const [, id, fen, solution, mateIn] of entries) {
  const chess = new Chess(fen)
  const moves = solution.split(',').map((m) => m.trim().replace(/'/g, ''))
  if (moves.length !== Number(mateIn) * 2 - 1) {
    console.error(`✗ puzzle ${id}: expected ${Number(mateIn) * 2 - 1} plies, got ${moves.length}`)
    failures += 1
    continue
  }
  try {
    for (const uci of moves) chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
  } catch {
    console.error(`✗ puzzle ${id}: illegal solution`)
    failures += 1
    continue
  }
  if (!chess.isCheckmate()) {
    console.error(`✗ puzzle ${id}: solution does not end in checkmate`)
    failures += 1
  }
}
console.log(`${entries.length} puzzles checked`)
const legends = readFileSync(new URL('../src/data/historicalLegends.ts', import.meta.url), 'utf8')
let repertoireLines = 0
for (const [, block] of legends.matchAll(/repertoire: \{([\s\S]*?)\n\s*\},/g)) {
  for (const [, line] of block.matchAll(/'([^']+)'/g)) {
    repertoireLines += 1
    const chess = new Chess()
    for (const san of line.split(' ')) {
      try {
        chess.move(san)
      } catch {
        console.error(`✗ legend repertoire: illegal move "${san}" in "${line}"`)
        failures += 1
        break
      }
    }
  }
}
console.log(`${repertoireLines} legend repertoire lines checked`)

console.log(failures ? `${failures} problem(s) found` : 'All data valid ✓')
process.exit(failures ? 1 : 0)
