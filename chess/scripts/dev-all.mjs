// Runs the app (Vite) and the game server together, on any OS: `npm run dev:all`.
import { spawn } from 'node:child_process'

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const children = [
  spawn(npm, ['run', 'server'], { stdio: 'inherit', shell: process.platform === 'win32' }),
  spawn(npm, ['run', 'dev', '--', ...process.argv.slice(2)], { stdio: 'inherit', shell: process.platform === 'win32' }),
]
const stop = () => {
  for (const c of children) if (!c.killed) c.kill()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
for (const c of children) c.on('exit', (code) => code && code !== 0 && stop())
