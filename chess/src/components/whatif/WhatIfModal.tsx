import { BrainCircuit, ChevronLeft, ChevronRight, GitBranch, Lock, Plus, RotateCcw } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { brainArrows } from '../../brain/brain'
import { useBrain } from '../../brain/useBrain'
import type { BoardTheme, PieceSet } from '../../types/theme'
import type { Color, Move, MoveInput, Square } from '../../types/chess'
import { MAX_LINES, lineSan, newLine, openSandbox, playMove, sandboxFen, selectLine, step } from '../../whatif/branch'
import { ChessBoard } from '../board/ChessBoard'
import { BrainPanel } from '../brain/BrainPanel'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

interface WhatIfModalProps {
  open: boolean
  onClose: () => void
  /** The game so far, and the ply the sandbox forks from. */
  history: readonly Move[]
  startFen: string
  rootPly: number
  orientation: Color
  theme: BoardTheme
  pieceSet: PieceSet
  lowPower: boolean
  /** True while a rated game is in progress: the engine needs your OK (the game turns casual). */
  engineLocked: boolean
  onUnlockEngine: () => void
}

/**
 * What-If: the real game on the left, a sandbox forked from the same move on
 * the right. Try other moves, keep several branches, and switch on the engine
 * brain to see what it thinks of your idea.
 */
export function WhatIfModal(props: WhatIfModalProps) {
  return <Modal open={props.open} title="What if…?" onClose={props.onClose} size="xl">{props.open && <WhatIf key={`${props.rootPly}`} {...props} />}</Modal>
}

function WhatIf({ history, startFen, rootPly, orientation, theme, pieceSet, lowPower, engineLocked, onUnlockEngine }: WhatIfModalProps) {
  const rootFen = rootPly === 0 ? startFen : (history[rootPly - 1]?.after ?? startFen)
  const [sandbox, setSandbox] = useState(() => openSandbox(rootFen, rootPly))
  const [realStep, setRealStep] = useState(0)
  const [brainOn, setBrainOn] = useState(false)
  const real = history.slice(rootPly)
  const realFen = realStep === 0 ? rootFen : (real[realStep - 1]?.after ?? rootFen)
  const fen = sandboxFen(sandbox)
  const line = sandbox.lines[sandbox.active]
  const sans = lineSan(sandbox)
  const turn: Color = fen.split(' ')[1] === 'b' ? 'b' : 'w'
  const brainEnabled = brainOn && !engineLocked
  const brain = useBrain(fen, brainEnabled)
  const arrows = useMemo(() => (brainEnabled ? brainArrows(brain.state) : []), [brain.state, brainEnabled])
  const moveNo = (ply: number) => `${Math.floor(ply / 2) + 1}${ply % 2 === 0 ? '.' : '…'}`

  const onMove = useCallback(
    (m: MoveInput) => {
      const next = playMove(sandbox, `${m.from}${m.to}${m.promotion ?? ''}`)
      if (!next) return false
      setSandbox(next)
      return true
    },
    [sandbox],
  )

  const board = (id: string, f: string, movable: Color | null, last: Pick<Move, 'from' | 'to'> | null, onMv: (m: MoveInput) => boolean, extra?: Parameters<typeof ChessBoard>[0]['arrows']) => (
    <ChessBoard id={id} fen={f} orientation={orientation} lastMove={last} movableColor={movable} onMove={onMv} theme={theme} pieceSet={pieceSet} lowPower={lowPower} showLegalMoves showCoordinates={false} arrows={extra ?? []} />
  )
  const lastSandbox = line && line.cursor > 0 ? line.moves[line.cursor - 1] : null

  return (
    <div className="grid gap-4 pb-2 md:grid-cols-2" data-whatif>
      <section className="space-y-2" aria-label="What happened">
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">
          <span>What happened</span>
          <span className="font-mono text-slate-400">from move {moveNo(rootPly)}</span>
        </div>
        {board('whatif-real', realFen, null, realStep > 0 ? (real[realStep - 1] ?? null) : null, () => false)}
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setRealStep((n) => Math.max(0, n - 1))} disabled={realStep === 0} aria-label="Previous move" icon={<ChevronLeft className="size-4" />} />
          <div className="min-w-0 flex-1 truncate text-center font-mono text-xs text-slate-300" data-whatif-real>
            {realStep === 0 ? 'Position at the fork' : `${moveNo(rootPly + realStep - 1)} ${real[realStep - 1]?.san ?? ''}`}
          </div>
          <Button size="sm" onClick={() => setRealStep((n) => Math.min(real.length, n + 1))} disabled={realStep >= real.length} aria-label="Next move" icon={<ChevronRight className="size-4" />} />
        </div>
      </section>

      <section className="space-y-2" aria-label="Your idea">
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.2em] text-sky-200">
          <span className="flex items-center gap-1.5">
            <GitBranch className="size-3.5" /> Your idea · {turn === 'w' ? 'White' : 'Black'} to move
          </span>
        </div>
        {board('whatif-sandbox', fen, turn, lastSandbox ? { from: lastSandbox.slice(0, 2) as Square, to: lastSandbox.slice(2, 4) as Square } : null, onMove, arrows)}
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setSandbox((s) => step(s, -1))} disabled={!line || line.cursor === 0} aria-label="Back" icon={<ChevronLeft className="size-4" />} />
          <div className="min-w-0 flex-1 truncate font-mono text-xs text-slate-200" data-whatif-line>
            {sans.length === 0 ? <span className="text-slate-500">Make a move on this board</span> : sans.map((s, i) => <span key={i} className={i < (line?.cursor ?? 0) ? 'text-white' : 'text-slate-500'}>{`${i % 2 === 0 || i === 0 ? moveNo(rootPly + i) : ''} ${s} `}</span>)}
          </div>
          <Button size="sm" onClick={() => setSandbox((s) => step(s, 1))} disabled={!line || line.cursor >= line.moves.length} aria-label="Forward" icon={<ChevronRight className="size-4" />} />
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Branches">
          {sandbox.lines.map((l, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={sandbox.active === i}
              onClick={() => setSandbox((s) => selectLine(s, i))}
              className={`rounded-lg border px-2 py-1 font-mono text-[11px] ${sandbox.active === i ? 'border-sky-300 bg-sky-400/15 text-white' : 'border-white/10 text-slate-300'}`}
            >
              {lineSan(sandbox, i)[0] ?? `Line ${i + 1}`}
              {l.moves.length > 1 ? ` +${l.moves.length - 1}` : ''}
            </button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setSandbox((s) => newLine(s))} disabled={sandbox.lines.length >= MAX_LINES} icon={<Plus className="size-3.5" />} data-whatif-branch>
            Branch
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSandbox(openSandbox(rootFen, rootPly))} icon={<RotateCcw className="size-3.5" />}>
            Reset
          </Button>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          {engineLocked ? (
            <div className="space-y-2 text-xs text-slate-300">
              <p className="flex items-center gap-1.5">
                <Lock className="size-3.5" /> A rated game is in progress, so the engine stays off.
              </p>
              <Button size="sm" onClick={onUnlockEngine} icon={<BrainCircuit className="size-4" />}>
                Use the engine (game becomes unrated)
              </Button>
            </div>
          ) : brainOn ? (
            <BrainPanel state={brain.state} status={brain.status} />
          ) : (
            <Button size="sm" onClick={() => setBrainOn(true)} icon={<BrainCircuit className="size-4" />} data-whatif-brain>
              Show the engine’s brain
            </Button>
          )}
        </div>
      </section>
    </div>
  )
}
