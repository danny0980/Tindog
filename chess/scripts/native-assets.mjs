// Draws the iOS and Android app icons and launch screens from the game's
// emblem (the gradient king of public/favicon.svg) on the app's background.
// Run after changing the emblem: `npm run native:assets`.
import { readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const BG = '#0b0d12'
const svg = await readFile(new URL('../public/favicon.svg', import.meta.url), 'utf8')
const defs = svg.match(/<defs>.*<\/defs>/)?.[0] ?? ''
const glyph = svg.match(/<path[^>]*\/>/)?.[0]
if (!glyph) throw new Error('No emblem path in public/favicon.svg')

// The emblem's path spans about x 18–46, y 10–58 of the 64-unit favicon box: centred on (32, 34).
const art = (size, scale, background) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">${defs}` +
      (background ? `<rect width="64" height="64" fill="${BG}"/>` : '') +
      `<g transform="translate(32 32) scale(${scale}) translate(-32 -34)">${glyph}</g></svg>`,
  )
const png = (size, scale, background = true) => {
  const img = sharp(art(size, scale, background)).png()
  return background ? img.flatten({ background: BG }).toBuffer() : img.toBuffer()
}
const sizeOf = async (file) => (await sharp(file).metadata()).width ?? 0

const res = 'android/app/src/main/res'
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
for (const [d, k] of Object.entries(densities)) {
  const icon = await png(48 * k, 0.8)
  await writeFile(`${res}/mipmap-${d}/ic_launcher.png`, icon)
  await writeFile(`${res}/mipmap-${d}/ic_launcher_round.png`, icon)
  // Adaptive icons: 108dp, of which the launcher's mask always shows the middle 66dp.
  await writeFile(`${res}/mipmap-${d}/ic_launcher_foreground.png`, await png(108 * k, 0.5, false))
}
await writeFile(`${res}/values/ic_launcher_background.xml`, `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG}</color>\n</resources>\n`)

// Launch screens: the emblem small in the middle of the dark background, at each file's own size.
const splash = async (file) => {
  const meta = await sharp(file).metadata()
  const w = meta.width ?? 0
  const h = meta.height ?? 0
  const side = Math.round(Math.min(w, h) * 0.28)
  const mark = await png(side, 1)
  await writeFile(file, await sharp({ create: { width: w, height: h, channels: 3, background: BG } }).composite([{ input: mark }]).png().toBuffer())
}
for (const dir of ['drawable', ...['land', 'port'].flatMap((o) => Object.keys(densities).map((d) => `drawable-${o}-${d}`))]) await splash(`${res}/${dir}/splash.png`)

const ios = 'ios/App/App/Assets.xcassets'
await writeFile(`${ios}/AppIcon.appiconset/AppIcon-512@2x.png`, await png(await sizeOf(`${ios}/AppIcon.appiconset/AppIcon-512@2x.png`), 0.8))
for (const n of ['', '-1', '-2']) await splash(`${ios}/Splash.imageset/splash-2732x2732${n}.png`)
console.log('App icons and launch screens drawn.')
