// Turns the DOM title's letters into pixel targets for the title particles:
// each letter is redrawn off-screen in the same font at the same place, its
// ink is sampled, and the particles are shared out by how much ink each has.
import { rng, type TitleTargets } from './particles'

export interface LetterBox {
  char: string
  /** CSS px, relative to the canvas. */
  left: number
  top: number
  width: number
  height: number
}

/** Samples `count` points on the ink of the letters, drawn with `font` (a CSS font shorthand). */
export function sampleTitle(letters: readonly LetterBox[], font: string, count: number): TitleTargets | null {
  if (typeof document === 'undefined' || letters.length === 0 || count <= 0) return null
  const STEP = 2
  const inks: Array<Array<[number, number]>> = []
  for (const box of letters) {
    const w = Math.max(1, Math.ceil(box.width))
    const h = Math.max(1, Math.ceil(box.height))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.font = font
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    // Place the baseline the way CSS does: the font's ascent/descent box centred in the line box.
    const m = ctx.measureText(box.char)
    const ascent = m.fontBoundingBoxAscent || m.actualBoundingBoxAscent
    const descent = m.fontBoundingBoxDescent || m.actualBoundingBoxDescent
    const baseline = (h - (ascent + descent)) / 2 + ascent
    ctx.fillText(box.char, w / 2, baseline)
    const data = ctx.getImageData(0, 0, w, h).data
    const ink: Array<[number, number]> = []
    for (let y = 0; y < h; y += STEP) {
      for (let x = 0; x < w; x += STEP) if ((data[(y * w + x) * 4 + 3] ?? 0) > 128) ink.push([box.left + x, box.top + y])
    }
    inks.push(ink)
  }
  const total = inks.reduce((n, ink) => n + ink.length, 0)
  if (total === 0) return null
  const xy = new Float32Array(count * 2)
  const letter = new Uint8Array(count)
  const R = rng(7)
  let at = 0
  inks.forEach((ink, li) => {
    const share = li === inks.length - 1 ? count - at : Math.round((ink.length / total) * count)
    for (let k = 0; k < share && at < count; k++, at++) {
      const box = letters[li]!
      const [px, py] = ink[Math.floor(R() * ink.length)] ?? [box.left + box.width / 2, box.top + box.height / 2]
      xy[at * 2] = px + (R() - 0.5) * STEP
      xy[at * 2 + 1] = py + (R() - 0.5) * STEP
      letter[at] = li
    }
  })
  return { xy, letter }
}
