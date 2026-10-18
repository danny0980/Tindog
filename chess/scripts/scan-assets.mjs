// Regenerates public/assets/manifest.json from the files in public/assets.
// Runs automatically before `npm run dev` and `npm run build`.
//
//   node scripts/scan-assets.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildManifest } from './assets-lib.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const assetsDir = join(root, 'public', 'assets')
mkdirSync(assetsDir, { recursive: true })
const manifest = buildManifest(assetsDir)
writeFileSync(join(assetsDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(
  `[assets] manifest: ${Object.keys(manifest.portraits).length} portraits, ${Object.keys(manifest.pieceSets).length} piece sets, ${Object.keys(manifest.boards).length} boards, ${Object.keys(manifest.avatars).length} avatars, ${Object.keys(manifest.backgrounds).length} backgrounds`,
)
