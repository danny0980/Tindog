// The board's own vector pieces as images, for drawing on a canvas (the
// highlight reel). Each piece is rendered once off-screen, its SVG markup
// turned into an image, and the set cached by its colours.
import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { defaultPieces } from 'react-chessboard'
import type { PieceSet } from '../types/theme'

export type PieceImages = Readonly<Record<string, HTMLImageElement>>

const cache = new Map<string, Promise<PieceImages>>()

function svgMarkup(code: string, fill: string): string | null {
  const render = defaultPieces[code]
  if (!render) return null
  const host = document.createElement('div')
  const root = createRoot(host)
  flushSync(() => root.render(createElement(() => render({ fill }))))
  const svg = host.querySelector('svg')
  if (svg) {
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    svg.setAttribute('width', '256')
    svg.setAttribute('height', '256')
  }
  const markup = svg?.outerHTML ?? null
  root.unmount()
  return markup
}

const load = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('piece image failed'))
    img.src = src
  })

async function build(set: PieceSet): Promise<PieceImages> {
  // A task of its own: React can't flush a second root while it is rendering or committing.
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
  const markups = Object.keys(defaultPieces).map((code) => [code, svgMarkup(code, code.startsWith('w') ? set.white.fill : set.black.fill)] as const)
  const pairs = await Promise.all(
    markups.map(async ([code, markup]) => {
      if (!markup) return null
      try {
        return [code, await load(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`)] as const
      } catch {
        return null
      }
    }),
  )
  return Object.fromEntries(pairs.filter((p): p is readonly [string, HTMLImageElement] => p !== null))
}

/** Images of all twelve pieces in the set's colours, keyed "wK", "bP"… (missing ones fall back to glyphs). */
export function pieceImages(set: PieceSet): Promise<PieceImages> {
  const key = `${set.white.fill}|${set.black.fill}`
  const cached = cache.get(key)
  if (cached) return cached
  const job = build(set)
  cache.set(key, job)
  return job
}
