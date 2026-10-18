// Copies the single-threaded "lite" Stockfish WASM build into public/ so Vite
// serves it as a static Web Worker. The single-threaded build does not need
// SharedArrayBuffer / cross-origin isolation, so it works on any static host
// and inside Capacitor's iOS/Android WebViews.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sourceDir = join(root, 'node_modules', 'stockfish', 'bin')
const targetDir = join(root, 'public', 'stockfish')
const files = ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']

mkdirSync(targetDir, { recursive: true })

for (const file of files) {
  const source = join(sourceDir, file)
  if (!existsSync(source)) {
    console.error(`[copy-stockfish] Missing ${source}. Is the "stockfish" package installed?`)
    process.exit(1)
  }
  copyFileSync(source, join(targetDir, file))
}

console.log(`[copy-stockfish] Copied ${files.length} engine files to public/stockfish`)
