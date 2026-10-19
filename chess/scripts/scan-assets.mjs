// Regenerates public/assets/manifest.json from the files in public/assets.
// Runs automatically before `npm run dev` and `npm run build`. Portrait files
// added by hand to public/assets/portraits are first renamed to the name the
// game looks for ("Portrait of Napoleon (1).PNG" → napoleon-bonaparte.png).
//
//   node scripts/scan-assets.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCatalog } from './asset-catalog.mjs'
import { buildManifest, logPortraitReport, normalizePortraitFolder } from './assets-lib.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const assetsDir = join(root, 'public', 'assets')
mkdirSync(assetsDir, { recursive: true })
// Portraits copied in by hand get their canonical names first, so the game finds every one.
try {
  logPortraitReport(normalizePortraitFolder(assetsDir, loadCatalog(root)))
} catch (err) {
  console.warn(`[assets] could not tidy portrait names: ${err instanceof Error ? err.message : String(err)}`)
}
const manifest = buildManifest(assetsDir)
writeFileSync(join(assetsDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(
  `[assets] manifest: ${Object.keys(manifest.portraits).length} portraits, ${Object.keys(manifest.pieceSets).length} piece sets, ${Object.keys(manifest.boards).length} boards, ${Object.keys(manifest.avatars).length} avatars, ${Object.keys(manifest.backgrounds).length} backgrounds`,
)
