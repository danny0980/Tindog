// The Trophy Hall in WebGL: a dark marble gallery where every Classic
// character you have beaten stands as a statue on a plinth, with their
// portrait medallion, an engraved plaque and a glow that grows with your wins
// over them. Drag to look around, scroll (or drag up and down) to walk.
import * as THREE from 'three'
import { buildPieceGeometries } from '../components/cinematic/lastGrain/pieces'
import { ENTRANCE_Z, clampWalk, glowFor, hallDepth, hallLayout } from './hall'

export interface HallStatue {
  id: string
  name: string
  lived: string
  title: string
  wins: number
  from: string
  to: string
  monogram: string
  /** Art-pack portrait, if any (drawn on the medallion once loaded). */
  art: string | null
}

export interface HallHandle {
  dispose: () => void
}

function medallion(s: HallStatue, onUpdate: () => void): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  if (!ctx) return tex
  const paint = (img: HTMLImageElement | null) => {
    const g = ctx.createLinearGradient(0, 0, 256, 256)
    g.addColorStop(0, s.from)
    g.addColorStop(1, s.to)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(128, 128, 124, 0, Math.PI * 2)
    ctx.fill()
    if (img) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(128, 128, 116, 0, Math.PI * 2)
      ctx.clip()
      const k = Math.max(232 / img.width, 232 / img.height)
      ctx.drawImage(img, 128 - (img.width * k) / 2, 128 - (img.height * k) / 2, img.width * k, img.height * k)
      ctx.restore()
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.92)'
      ctx.font = '700 120px Georgia, serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(s.monogram, 128, 136)
    }
    ctx.lineWidth = 10
    ctx.strokeStyle = '#d4af37'
    ctx.beginPath()
    ctx.arc(128, 128, 122, 0, Math.PI * 2)
    ctx.stroke()
    tex.needsUpdate = true
  }
  paint(null)
  if (s.art) {
    const img = new Image()
    img.onload = () => {
      paint(img)
      onUpdate()
    }
    img.src = s.art
  }
  return tex
}

function plaque(s: HallStatue): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 160
  const ctx = c.getContext('2d')
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  if (!ctx) return tex
  const g = ctx.createLinearGradient(0, 0, 0, 160)
  g.addColorStop(0, '#f6d77a')
  g.addColorStop(1, '#b8892c')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 512, 160)
  ctx.strokeStyle = '#6b4c12'
  ctx.lineWidth = 6
  ctx.strokeRect(6, 6, 500, 148)
  ctx.fillStyle = '#2a1d05'
  ctx.textAlign = 'center'
  ctx.font = '800 40px Georgia, serif'
  ctx.fillText(s.name.toUpperCase(), 256, 62, 480)
  ctx.font = '500 26px Georgia, serif'
  ctx.fillText(s.lived, 256, 100, 480)
  ctx.font = 'italic 22px Georgia, serif'
  ctx.fillText(`${s.wins} victor${s.wins === 1 ? 'y' : 'ies'} over them`, 256, 134, 480)
  tex.needsUpdate = true
  return tex
}

/** Builds the hall into `canvas`; `onPick` fires with a statue id when one is clicked. */
export function createHall(canvas: HTMLCanvasElement, statues: readonly HallStatue[], onPick: (id: string) => void): HallHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.outputColorSpace = THREE.SRGBColorSpace
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#05070d')
  scene.fog = new THREE.Fog('#05070d', 8, 34)
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 80)

  const depth = hallDepth(statues.length)
  const length = depth + 14
  // Floor, walls, ceiling beams.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, length), new THREE.MeshStandardMaterial({ color: '#141821', roughness: 0.28, metalness: 0.35 }))
  floor.rotation.x = -Math.PI / 2
  floor.position.z = ENTRANCE_Z - length / 2 + 4
  scene.add(floor)
  const runner = new THREE.Mesh(new THREE.PlaneGeometry(2.2, length), new THREE.MeshStandardMaterial({ color: '#5b1420', roughness: 0.85 }))
  runner.rotation.x = -Math.PI / 2
  runner.position.set(0, 0.005, floor.position.z)
  scene.add(runner)
  const wallMat = new THREE.MeshStandardMaterial({ color: '#1b1f2b', roughness: 0.9 })
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(length, 7), wallMat)
    wall.rotation.y = side * -Math.PI / 2
    wall.position.set(side * 6, 3.5, floor.position.z)
    scene.add(wall)
  }
  const far = new THREE.Mesh(new THREE.PlaneGeometry(12, 7), wallMat)
  far.position.set(0, 3.5, -depth - 6)
  scene.add(far)

  scene.add(new THREE.HemisphereLight('#9fb4ff', '#1a1208', 0.9))
  const key = new THREE.DirectionalLight('#ffe7c2', 1.1)
  key.position.set(2, 8, 6)
  scene.add(key)

  const pieces = buildPieceGeometries(28)
  const geo = pieces.king
  for (const [kind, g] of Object.entries(pieces)) if (kind !== 'king') g.dispose()
  const plinthGeo = new THREE.BoxGeometry(1.5, 1.1, 1.5)
  const plinthMat = new THREE.MeshStandardMaterial({ color: '#d9d4c7', roughness: 0.42, metalness: 0.05 })
  const ringGeo = new THREE.TorusGeometry(0.95, 0.05, 12, 48)
  const disposables: Array<{ dispose: () => void }> = [renderer, geo, plinthGeo, plinthMat, ringGeo, wallMat, floor.geometry, floor.material as THREE.Material, runner.geometry, runner.material as THREE.Material, far.geometry]
  const pickables: THREE.Object3D[] = []
  let dirty = true
  const glows: Array<{ ring: THREE.Mesh; base: number; phase: number }> = []

  hallLayout(statues.length).forEach((spot) => {
    const s = statues[spot.index]
    if (!s) return
    const group = new THREE.Group()
    group.position.set(spot.x, 0, spot.z)
    group.rotation.y = spot.yaw
    group.userData.id = s.id
    const plinth = new THREE.Mesh(plinthGeo, plinthMat)
    plinth.position.y = 0.55
    group.add(plinth)
    const tint = new THREE.Color(s.from).lerp(new THREE.Color('#f1ece2'), 0.65)
    const statueMat = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.35, metalness: 0.15, emissive: new THREE.Color(s.from), emissiveIntensity: 0.08 + 0.25 * glowFor(s.wins) })
    const statue = new THREE.Mesh(geo, statueMat)
    statue.scale.setScalar(1.25)
    statue.position.y = 1.1
    group.add(statue)
    const glowMat = new THREE.MeshBasicMaterial({ color: '#fbbf24', transparent: true, opacity: glowFor(s.wins), blending: THREE.AdditiveBlending, depthWrite: false })
    const ring = new THREE.Mesh(ringGeo, glowMat)
    ring.rotation.x = Math.PI / 2
    ring.position.y = 1.12
    group.add(ring)
    glows.push({ ring, base: glowFor(s.wins), phase: spot.index * 0.7 })
    // The portrait hangs on the wall behind the statue; the plaque is on the aisle side of the plinth.
    const medTex = medallion(s, () => (dirty = true))
    const medMat = new THREE.MeshBasicMaterial({ map: medTex, toneMapped: false })
    const med = new THREE.Mesh(new THREE.CircleGeometry(0.72, 48), medMat)
    med.position.set(0, 2.7, -2.75)
    group.add(med)
    const plaqueTex = plaque(s)
    const plaqueMat = new THREE.MeshBasicMaterial({ map: plaqueTex, toneMapped: false })
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 0.42), plaqueMat)
    plate.position.set(0, 0.62, 0.76)
    group.add(plate)
    disposables.push(statueMat, glowMat, medTex, medMat, med.geometry, plaqueTex, plaqueMat, plate.geometry)
    pickables.push(group)
    scene.add(group)
  })

  // Camera: walk along the aisle (z) and look around (yaw, pitch).
  let walk = ENTRANCE_Z
  let yaw = 0
  let pitch = -0.04
  const place = () => {
    camera.position.set(0, 1.9, walk)
    camera.rotation.set(pitch, yaw, 0, 'YXZ')
    dirty = true
  }
  place()

  const resize = () => {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    dirty = true
  }
  resize()
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null
  observer?.observe(canvas)

  // Pointer: drag sideways to look, up/down to walk; a tap picks a statue.
  let drag: { x: number; y: number; moved: number } | null = null
  const ray = new THREE.Raycaster()
  const onDown = (e: PointerEvent) => {
    drag = { x: e.clientX, y: e.clientY, moved: 0 }
    canvas.setPointerCapture(e.pointerId)
  }
  const onMove = (e: PointerEvent) => {
    if (!drag) return
    const dx = e.clientX - drag.x
    const dy = e.clientY - drag.y
    drag = { x: e.clientX, y: e.clientY, moved: drag.moved + Math.abs(dx) + Math.abs(dy) }
    yaw = Math.max(-1.4, Math.min(1.4, yaw - dx * 0.005))
    walk = clampWalk(walk + dy * 0.03, statues.length)
    place()
  }
  const onUp = (e: PointerEvent) => {
    const d = drag
    drag = null
    if (!d || d.moved > 8) return
    const r = canvas.getBoundingClientRect()
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera)
    const hit = ray.intersectObjects(pickables, true)[0]
    let o: THREE.Object3D | null = hit?.object ?? null
    while (o && typeof o.userData.id !== 'string') o = o.parent
    if (o) onPick(o.userData.id as string)
  }
  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    walk = clampWalk(walk + e.deltaY * 0.01, statues.length)
    place()
  }
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })

  let raf = 0
  const start = performance.now()
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame)
    if (document.hidden) return
    const t = (now - start) / 1000
    // The glow breathes slowly (that is the only animation, so render it gently).
    for (const g of glows) (g.ring.material as THREE.MeshBasicMaterial).opacity = g.base * (0.75 + 0.25 * Math.sin(t * 1.6 + g.phase))
    if (glows.length || dirty) {
      renderer.render(scene, camera)
      dirty = false
    }
  }
  raf = requestAnimationFrame(frame)

  return {
    dispose: () => {
      cancelAnimationFrame(raf)
      observer?.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('wheel', onWheel)
      disposables.forEach((d) => d.dispose())
    },
  }
}

/** True when this browser can draw WebGL. */
export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas')
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'))
  } catch {
    return false
  }
}
