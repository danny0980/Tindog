// Bundles a TypeScript test file with Rolldown (Vite's bundler) and runs it in Node.
//
//   node scripts/run-ts-test.mjs tests/legends.test.ts
import { build } from 'rolldown'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const input = resolve(process.argv[2] ?? 'tests/legends.test.ts')
const dir = mkdtempSync(join(tmpdir(), 'chess-test-'))
const file = join(dir, 'test.mjs')
try {
  await build({
    input,
    platform: 'node',
    // Vite-only globals used by app modules.
    transform: { define: { 'import.meta.env.BASE_URL': '"/"' } },
    // Lazy realm rosters are dynamic imports; inline them into the single test bundle.
    output: { file, format: 'esm', codeSplitting: false },
    logLevel: 'warn',
  })
  const run = spawnSync(process.execPath, [file], { stdio: 'inherit' })
  process.exitCode = run.status ?? 1
} finally {
  rmSync(dir, { recursive: true, force: true })
}
