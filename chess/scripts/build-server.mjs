// Bundles the game server (and its maintenance CLI) into dist-server/, so
// production runs plain `node` with only the runtime dependencies installed.
// Packages stay external (installed by `npm ci --omit=dev`); our own code —
// the server and the shared rules from src/ — is bundled in.
import { readFileSync } from 'node:fs'
import { build } from 'esbuild'

const { version } = JSON.parse(readFileSync('package.json', 'utf8'))

await build({
  entryPoints: { index: 'server/index.ts', cli: 'server/cli.ts' },
  outdir: 'dist-server',
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  packages: 'external',
  sourcemap: true,
  define: { 'process.env.APP_VERSION': JSON.stringify(version) },
  logLevel: 'info',
})
