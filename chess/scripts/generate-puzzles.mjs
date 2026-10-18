// Generates engine-verified mate-in-2 / mate-in-3 puzzles into src/data/puzzles.ts.
//
//   node scripts/generate-puzzles.mjs [count=60]
//
// Method: Stockfish plays itself at a low skill level (so it blunders), every
// position is scanned with MultiPV 2, and a position becomes a puzzle when the
// side to move has a forced mate in 2 or 3 with a UNIQUE first move. The full
// solution (with best defence) is re-searched at higher depth and replayed with
// chess.js to prove it ends in checkmate.
import { Chess } from 'chess.js'
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const target = Number(process.argv[2] ?? 60)

function createEngine() {
  let listener = () => {}
  const sf = require('stockfish')('lite-single', (line) => listener(line))
  const send = (cmd) => sf.processCommand(cmd)
  const waitFor = (pred, onLine = () => {}) =>
    new Promise((resolve) => {
      listener = (line) => {
        onLine(line)
        if (pred(line)) resolve(line)
      }
    })
  return {
    async init() {
      const p = waitFor((l) => l === 'uciok')
      send('uci')
      await p
      await this.ready()
    },
    async ready() {
      const p = waitFor((l) => l === 'readyok')
      send('isready')
      await p
    },
    async setOption(name, value) {
      send(`setoption name ${name} value ${value}`)
      await this.ready()
    },
    async search(fen, go) {
      const lines = new Map()
      send(`position fen ${fen}`)
      const p = waitFor(
        (l) => l.startsWith('bestmove'),
        (l) => {
          const m = /multipv (\d+) score (cp|mate) (-?\d+).* pv (.+)$/.exec(l)
          if (m) lines.set(Number(m[1]), { kind: m[2], value: Number(m[3]), pv: m[4].trim().split(' ') })
        },
      )
      send(`go ${go}`)
      const best = await p
      return { best: best.split(' ')[1], lines }
    },
    quit: () => sf.terminate(),
  }
}

const OPENINGS = [
  [], ['e2e4'], ['d2d4'], ['c2c4'], ['g1f3'], ['e2e4', 'c7c5'], ['e2e4', 'e7e5'], ['d2d4', 'd7d5'],
  ['e2e4', 'e7e6'], ['e2e4', 'c7c6'], ['d2d4', 'g8f6'], ['e2e4', 'd7d6'], ['b2b3'], ['f2f4'],
]

const toMove = (uci) => ({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })

function verify(fen, line, mateIn) {
  const chess = new Chess(fen)
  if (line.length !== mateIn * 2 - 1) return false
  for (const uci of line) {
    try {
      chess.move(toMove(uci))
    } catch {
      return false
    }
  }
  return chess.isCheckmate()
}

const engine = createEngine()
await engine.init()
await engine.setOption('Hash', 32)

const puzzles = []
const seen = new Set()
let game = 0

while (puzzles.length < target && game < 2000) {
  game += 1
  const chess = new Chess()
  for (const uci of OPENINGS[game % OPENINGS.length]) chess.move(toMove(uci))
  const skill = 1 + (game % 6)

  for (let ply = 0; ply < 140 && !chess.isGameOver(); ply += 1) {
    const fen = chess.fen()
    await engine.setOption('MultiPV', 2)
    await engine.setOption('Skill Level', 20)
    const scan = await engine.search(fen, 'depth 10')
    const first = scan.lines.get(1)
    const second = scan.lines.get(2)
    const mateIn = first?.kind === 'mate' ? first.value : 0
    const key = fen.split(' ').slice(0, 2).join(' ')

    if ((mateIn === 2 || mateIn === 3) && !seen.has(key) && chess.moves().length > 1) {
      const uniqueKey = !second || second.kind !== 'mate' || second.value <= 0 || second.value > mateIn
      if (uniqueKey) {
        // Deeper single-PV search for an accurate best-defence line.
        await engine.setOption('MultiPV', 1)
        const deep = await engine.search(fen, 'depth 18')
        const line = deep.lines.get(1)
        if (line?.kind === 'mate' && line.value === mateIn) {
          const solution = line.pv.slice(0, mateIn * 2 - 1)
          if (verify(fen, solution, mateIn)) {
            seen.add(key)
            puzzles.push({ fen, solution, mateIn })
            console.log(`#${puzzles.length} mate-in-${mateIn} ${fen}  ${solution.join(' ')}`)
            if (puzzles.length >= target) break
          }
        }
      }
    }

    // Weak self-play move so games contain tactical mistakes.
    await engine.setOption('MultiPV', 1)
    await engine.setOption('Skill Level', skill)
    const { best } = await engine.search(fen, 'depth 6 movetime 60')
    if (!best || best === '(none)') break
    chess.move(toMove(best))
  }
}
engine.quit()

// Interleave so each day gets a mix of mate-in-2 and mate-in-3.
const twos = puzzles.filter((p) => p.mateIn === 2)
const threes = puzzles.filter((p) => p.mateIn === 3)
const mixed = []
while (twos.length || threes.length) {
  if (twos.length) mixed.push(twos.shift())
  if (twos.length) mixed.push(twos.shift())
  if (threes.length) mixed.push(threes.shift())
}

const body = mixed
  .map(
    (p, i) =>
      `  { id: 'p${String(i + 1).padStart(3, '0')}', fen: '${p.fen}', solution: [${p.solution
        .map((m) => `'${m}'`)
        .join(', ')}], mateIn: ${p.mateIn} },`,
  )
  .join('\n')

writeFileSync(
  join(root, 'src', 'data', 'puzzles.ts'),
  `// AUTO-GENERATED by scripts/generate-puzzles.mjs — do not edit by hand.
// Every puzzle is a forced mate with a unique first move, verified by Stockfish
// and replayed with chess.js. \`solution\` alternates solver / defender moves (UCI).
import type { Puzzle } from '../types/puzzle'

export const PUZZLES: ReadonlyArray<Puzzle> = [
${body}
]
`,
)
console.log(`Wrote ${mixed.length} puzzles (${mixed.filter((p) => p.mateIn === 2).length}×M2, ${mixed.filter((p) => p.mateIn === 3).length}×M3)`)
