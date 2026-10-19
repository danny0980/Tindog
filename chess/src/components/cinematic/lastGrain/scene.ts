// The WebGL world of "The Last Grain": an obsidian board with gold inlay seams,
// turned pieces, light, particles and a filmic post chain (bloom, depth of
// field, grade). render(t) is a pure function of film time — the React layer
// owns the clock — so a frame can be re-rendered or captured exactly.
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { cameraAt } from './camera'
import { ERA_PIECES, IMPACT, KING, KING_HEIGHT, LAST_IMPACT, type PieceKind, QUEEN, QUEEN_CROWN_FROM, QUEEN_HEIGHT, SET_PIECES, type Vec3 } from './layout'
import { ParticleSim, type Quality, TITLE_DEPTH, type TitleTargets } from './particles'
import { type PieceMaterial, buildPieceGeometries, pieceMaterial } from './pieces'
import { T, easeInOut, easeOut, freezeAmount, lightX, progress, worldTime } from './timeline'

const HEIGHTS: Record<PieceKind, number> = { pawn: 0.74, knight: 0.95, bishop: 1.05, rook: 0.99, queen: QUEEN_HEIGHT, king: KING_HEIGHT }
const BOARD_SIZE = 8.7

const BOARD_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`

const BOARD_FRAG = /* glsl */ `
precision highp float;
varying vec3 vWorld;
uniform float uTime, uLightX, uRun, uWake, uImpact1, uImpact2, uQueen, uFrost, uDormant;
uniform float uIgnite[5];
uniform vec3 uOcc[17];
uniform vec2 uImpactAt1, uImpactAt2, uQueenAt;

float bHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(bHash(i), bHash(i + vec2(1, 0)), f.x), mix(bHash(i + vec2(0, 1)), bHash(i + vec2(1, 1)), f.x), f.y);
}
float bFbm(vec2 p) { return bNoise(p) * 0.5 + bNoise(p * 2.3) * 0.3 + bNoise(p * 5.1) * 0.2; }

// How much light runs through the seam network at p (0 = dormant inlay).
float seamLight(vec2 p) {
  float lit = uDormant;
  // The running light on the z = 2 seam: a hot head with a long glowing trail.
  float onRow = smoothstep(0.08, 0.0, abs(p.y - 2.0)) * step(-3.55, p.x);
  float behind = uLightX - p.x;
  lit += uRun * onRow * (behind >= 0.0 ? 0.45 + 2.6 * exp(-behind * 2.2) : 3.0 * exp(behind * 9.0));
  // Each era piece's square lights up as it wakes.
  for (int i = 0; i < 5; i++) {
    vec2 c = vec2(-2.5 + float(i), 1.5);
    float sq = max(abs(p.x - c.x), abs(p.y - c.y));
    lit += uIgnite[i] * smoothstep(0.62, 0.5, sq) * 1.6;
  }
  // The wake: light spreads out through the whole network from the impact.
  float r = length(p - uImpactAt1);
  lit += step(0.01, uWake) * (smoothstep(uWake, uWake - 1.2, r) * 0.42 + exp(-abs(r - uWake) * 3.0) * 1.1 * smoothstep(0.0, 1.0, uWake) * smoothstep(13.0, 9.0, uWake));
  // The queen's square burns as she cracks open.
  float q = max(abs(p.x - uQueenAt.x), abs(p.y - uQueenAt.y));
  lit += uQueen * (smoothstep(0.62, 0.5, q) * 2.2 + exp(-length(p - uQueenAt) * 0.9) * 0.6);
  return lit;
}

void main() {
  vec2 p = vWorld.xz;
  float inside = step(abs(p.x), 4.0) * step(abs(p.y), 4.0);
  vec2 cell = floor(p);
  float parity = mod(cell.x + cell.y, 2.0);
  // Polished obsidian: near-black squares with a smoky vein figure.
  float veins = bFbm(p * vec2(1.3, 2.1) + parity * 9.0 + cell * 3.1);
  vec3 base = mix(vec3(0.007, 0.006, 0.010), vec3(0.026, 0.024, 0.032), parity) * (0.65 + 0.9 * veins * veins);
  base = mix(vec3(0.005, 0.004, 0.007), base, inside);

  // Gold inlay seams on every integer line, plus the border.
  vec2 d = abs(p - floor(p + 0.5));
  float sd = min(d.x, d.y);
  float onBoard = step(max(abs(p.x), abs(p.y)), 4.03);
  float seam = smoothstep(0.024, 0.008, sd) * onBoard;
  float lit = seamLight(p);
  vec3 gold = vec3(1.0, 0.6, 0.2);
  vec3 col = base + seam * (vec3(0.16, 0.1, 0.035) + gold * lit * 1.4);
  // Glow spilling from lit seams onto the polished squares.
  col += gold * lit * exp(-sd * 16.0) * 0.16 * onBoard;

  // Impacts: a hot spot and a ring travelling out across the stone.
  for (int k = 0; k < 2; k++) {
    float age = k == 0 ? uImpact1 : uImpact2;
    vec2 at = k == 0 ? uImpactAt1 : uImpactAt2;
    if (age > 0.0) {
      float rr = length(p - at);
      float front = 0.04 + age * 0.75;
      col += gold * (exp(-abs(rr - front) * 38.0) * exp(-age * 1.4) * 1.6 + exp(-rr * 16.0) * exp(-age * 2.2) * 2.2);
    }
  }

  // Contact shadows under the pieces.
  float ao = 1.0;
  for (int i = 0; i < 17; i++) {
    float dd = length(p - uOcc[i].xy) / uOcc[i].z;
    ao *= 1.0 - 0.75 * exp(-dd * dd * 2.2);
  }
  col *= ao;

  // Polished sheen: warm key specular and a cool fresnel reflection of the void.
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 L = normalize(vec3(-0.35, 0.75, 0.55));
  vec3 H = normalize(L + V);
  col += vec3(1.0, 0.8, 0.6) * pow(max(H.y, 0.0), 90.0) * 0.07 * inside * ao;
  float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 5.0);
  col += vec3(0.035, 0.033, 0.05) * fres * inside;

  // The menu: squares flatten into frosted glass.
  float frost = uFrost * inside;
  vec3 glass = vec3(0.075, 0.085, 0.115) + parity * vec3(0.02, 0.022, 0.03) + bNoise(p * 60.0) * 0.012;
  col = mix(col, glass + seam * gold * 0.4 + gold * lit * exp(-sd * 10.0) * 0.08, frost * 0.7);

  gl_FragColor = vec4(col, 1.0);
}`

const STUDIO_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const STUDIO_FRAG = /* glsl */ `
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  // A warm key softbox high on the white side, a cold rim behind, a faint horizon; black below.
  float key = pow(max(dot(d, normalize(vec3(-0.45, 0.65, 0.6))), 0.0), 6.0);
  float rim = pow(max(dot(d, normalize(vec3(0.3, 0.35, -0.9))), 0.0), 5.0);
  float horizon = exp(-abs(d.y - 0.05) * 9.0) * 0.06;
  vec3 col = vec3(1.0, 0.78, 0.55) * key * 1.6 + vec3(0.45, 0.6, 1.0) * rim * 0.9 + vec3(0.5, 0.42, 0.36) * horizon;
  col *= smoothstep(-0.25, 0.05, d.y);
  gl_FragColor = vec4(col + 0.004, 1.0);
}`

const PARTICLE_VERT = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;
attribute float aAlpha;
uniform float uScale, uFocus, uAperture;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  // Depth of field: a grain off the focal plane opens into a wider, dimmer disc.
  float coc = abs(-mv.z - uFocus) * uAperture / max(0.05, -mv.z);
  float sharp = aSize * uScale / max(0.05, -mv.z);
  float px = sharp + coc * uScale * 0.5;
  // Sub-pixel grains stay 1.5 px and dim instead of shimmering.
  gl_PointSize = aAlpha > 0.002 ? clamp(px, 1.5, 420.0) : 0.0;
  vColor = aColor;
  // Grains drifting right past the lens fade instead of filling the frame.
  vAlpha = aAlpha * clamp(px / 1.5, 0.15, 1.0) * smoothstep(0.12, 0.6, -mv.z) * clamp(28.0 / px, 0.0, 1.0) * clamp((sharp * sharp) / (px * px) * 3.0, 0.08, 1.0);
}`

const PARTICLE_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c) * 4.0;
  if (d > 1.0) discard;
  float a = exp(-d * 4.5) + exp(-d * 30.0) * 0.6;
  gl_FragColor = vec4(vColor, vAlpha * a);
}`

/** Rolls off extreme highlights before bloom, so a one-pixel specular spike can't bloom into a block. */
const ROLL_OFF = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float peak = max(c.r, max(c.g, c.b));
      float knee = 4.0;
      float rolled = peak < knee ? peak : knee + (peak - knee) / (1.0 + (peak - knee) / 4.0);
      gl_FragColor = vec4(c.rgb * (rolled / max(peak, 1e-4)), c.a);
    }`,
}

const GRADE = {
  uniforms: {
    tDiffuse: { value: null },
    uFreeze: { value: 0 },
    uFade: { value: 1 },
    uFlash: { value: 0 },
    uVignette: { value: 1.1 },
    uAberr: { value: 0.002 },
    uExposure: { value: 1 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uFreeze, uFade, uFlash, uVignette, uAberr, uExposure, uTime;
    varying vec2 vUv;
    float gHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);
      vec2 off = c * uAberr * r2 * 4.0;
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
      // The frozen second: the world drains to cold steel; only the brightest gold keeps its colour.
      float keep = smoothstep(0.9, 2.6, lum);
      col = mix(col, vec3(lum) * vec3(0.86, 0.95, 1.12), uFreeze * 0.8 * (1.0 - keep));
      col *= 1.0 - r2 * uVignette;
      col = col * uExposure + uFlash * vec3(1.0, 0.78, 0.45);
      col += (gHash(vUv * 1000.0 + uTime) - 0.5) * 0.012;
      gl_FragColor = vec4(max(col, 0.0) * uFade, 1.0);
    }`,
}

interface Piece {
  mesh: THREE.Mesh
  m: PieceMaterial
}

export interface LastGrainSceneOptions {
  canvas: HTMLCanvasElement
  quality: Quality
  onContextLost: () => void
}

/** Thrown when WebGL is unavailable — the caller falls back to the 2D layers. */
export class WebGLUnavailableError extends Error {}

export class LastGrainScene {
  private readonly renderer: THREE.WebGLRenderer
  private readonly composer: EffectComposer
  private readonly bloom: UnrealBloomPass
  private readonly grade: ShaderPass
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.03, 80)
  private readonly sim: ParticleSim
  private readonly points: THREE.Points
  private readonly pointsMat: THREE.ShaderMaterial
  private readonly board: THREE.ShaderMaterial
  private readonly eras: Piece[] = []
  private readonly queen: Piece
  private readonly king: Piece
  private readonly seamLight: THREE.PointLight
  private readonly queenLight: THREE.PointLight
  private readonly grainLight: THREE.PointLight
  private readonly disposables: Array<{ dispose: () => void }> = []
  private readonly onLost: (e: Event) => void
  private cssWidth = 1
  private cssHeight = 1
  private readonly ray = new THREE.Vector3()
  private readonly buffer = new THREE.Vector2()

  constructor({ canvas, quality, onContextLost }: LastGrainSceneOptions) {
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === 'high', powerPreference: 'high-performance', alpha: false, stencil: false })
    } catch (err) {
      throw new WebGLUnavailableError(err instanceof Error ? err.message : 'WebGL unavailable')
    }
    this.renderer = renderer
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.setClearColor(0x030206, 1)
    this.onLost = (e: Event) => {
      e.preventDefault()
      onContextLost()
    }
    canvas.addEventListener('webglcontextlost', this.onLost)

    const scene = this.scene
    scene.background = new THREE.Color(0x030206)
    scene.fog = new THREE.FogExp2(0x030206, 0.055)
    // Reflections come from a soft studio of gradients (no hard-edged panels to glint as squares).
    const pmrem = new THREE.PMREMGenerator(renderer)
    const studio = new THREE.Scene()
    const domeGeo = new THREE.SphereGeometry(10, 48, 24)
    const domeMat = new THREE.ShaderMaterial({ vertexShader: STUDIO_VERT, fragmentShader: STUDIO_FRAG, side: THREE.BackSide })
    studio.add(new THREE.Mesh(domeGeo, domeMat))
    const env = pmrem.fromScene(studio, 0.02).texture
    domeGeo.dispose()
    domeMat.dispose()
    pmrem.dispose()
    scene.environment = env
    scene.environmentIntensity = 0.6
    this.disposables.push(env)

    // Light: a warm key from the white side, a cold rim from the far side, and practicals that follow the action.
    scene.add(new THREE.HemisphereLight(0x2a2840, 0x060408, 0.35))
    const key = new THREE.DirectionalLight(0xffd2a0, 1.1)
    key.position.set(-3, 6, 5)
    const rim = new THREE.DirectionalLight(0x86a6ff, 1.5)
    rim.position.set(2, 3, -7)
    scene.add(key, rim)
    this.seamLight = new THREE.PointLight(0xffa040, 0, 3.2, 2)
    this.queenLight = new THREE.PointLight(0xff8a2a, 0, 2.2, 2)
    this.grainLight = new THREE.PointLight(0xffb050, 0, 2.5, 2)
    scene.add(this.seamLight, this.queenLight, this.grainLight)

    // The board: a shader slab with a bevelled obsidian frame under it.
    const occ = [...ERA_PIECES.map((p) => p.at), QUEEN, KING, ...SET_PIECES.map((p) => p.at)].map((at) => new THREE.Vector3(at[0], at[2], 0.34))
    while (occ.length < 17) occ.push(new THREE.Vector3(99, 99, 1))
    this.board = new THREE.ShaderMaterial({
      vertexShader: BOARD_VERT,
      fragmentShader: BOARD_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uLightX: { value: -3.5 },
        uRun: { value: 0 },
        uWake: { value: 0 },
        uImpact1: { value: -1 },
        uImpact2: { value: -1 },
        uQueen: { value: 0 },
        uFrost: { value: 0 },
        uDormant: { value: 0.0 },
        uIgnite: { value: [0, 0, 0, 0, 0] },
        uOcc: { value: occ.slice(0, 17) },
        uImpactAt1: { value: new THREE.Vector2(IMPACT[0], IMPACT[2]) },
        uImpactAt2: { value: new THREE.Vector2(LAST_IMPACT[0], LAST_IMPACT[2]) },
        uQueenAt: { value: new THREE.Vector2(QUEEN[0], QUEEN[2]) },
      },
    })
    const boardGeo = new THREE.PlaneGeometry(BOARD_SIZE, BOARD_SIZE)
    boardGeo.rotateX(-Math.PI / 2)
    const boardMesh = new THREE.Mesh(boardGeo, this.board)
    const frameGeo = new THREE.BoxGeometry(BOARD_SIZE, 0.32, BOARD_SIZE)
    frameGeo.translate(0, -0.161, 0)
    const frameMat = new THREE.MeshPhysicalMaterial({ color: 0x07060a, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 })
    scene.add(boardMesh, new THREE.Mesh(frameGeo, frameMat))
    this.disposables.push(boardGeo, this.board, frameGeo, frameMat)

    // The pieces.
    const geos = buildPieceGeometries(quality === 'high' ? 64 : 32)
    this.disposables.push(...Object.values(geos))
    const place = (kind: PieceKind, at: Vec3, yaw: number, m: PieceMaterial): Piece => {
      const mesh = new THREE.Mesh(geos[kind], m.material)
      mesh.position.set(at[0], at[1], at[2])
      mesh.rotation.y = yaw
      scene.add(mesh)
      this.disposables.push(m.material)
      return { mesh, m }
    }
    for (const p of ERA_PIECES) this.eras.push(place(p.kind, p.at, p.yaw, pieceMaterial(p.era, HEIGHTS[p.kind])))
    this.queen = place('queen', QUEEN, 0, pieceMaterial('obsidian', QUEEN_HEIGHT))
    this.queen.m.u.uCrownFrom.value = QUEEN_CROWN_FROM
    this.king = place('king', KING, 0, pieceMaterial('obsidian', KING_HEIGHT))
    this.king.m.u.uGoldFrom.value = 1.535
    for (const p of SET_PIECES) place(p.kind, p.at, p.yaw, pieceMaterial('obsidian', HEIGHTS[p.kind]))

    // Particles: one additive point cloud, updated on the CPU each frame.
    this.sim = new ParticleSim(quality)
    const pg = new THREE.BufferGeometry()
    const attr = (array: Float32Array, size: number) => new THREE.BufferAttribute(array, size).setUsage(THREE.DynamicDrawUsage)
    pg.setAttribute('position', attr(this.sim.position, 3))
    pg.setAttribute('aColor', attr(this.sim.color, 3))
    pg.setAttribute('aSize', attr(this.sim.size, 1))
    pg.setAttribute('aAlpha', attr(this.sim.alpha, 1))
    pg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100)
    this.pointsMat = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      uniforms: { uScale: { value: 500 }, uFocus: { value: 2 }, uAperture: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    this.points = new THREE.Points(pg, this.pointsMat)
    this.points.frustumCulled = false
    this.points.renderOrder = 10
    scene.add(this.points)
    this.disposables.push(pg, this.pointsMat)

    // Post: render → highlight roll-off → bloom → grade → tone map. (Depth of field lives in the particles: out-of-focus grains open into soft discs.)
    this.composer = new EffectComposer(renderer)
    this.composer.addPass(new RenderPass(scene, this.camera))
    const rollOff = new ShaderPass(ROLL_OFF)
    this.composer.addPass(rollOff)
    this.disposables.push(rollOff)
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.45, 0.95)
    this.composer.addPass(this.bloom)
    this.grade = new ShaderPass(GRADE)
    this.composer.addPass(this.grade)
    this.composer.addPass(new OutputPass())
    this.disposables.push(this.composer, this.bloom, this.grade)
    renderer.compile(scene, this.camera)
  }

  get titleParticleCount(): number {
    return this.sim.titleParticles
  }

  setTitleTargets(targets: TitleTargets | null): void {
    this.sim.setTitleTargets(targets)
  }

  setSize(width: number, height: number, dpr: number): void {
    this.cssWidth = Math.max(1, width)
    this.cssHeight = Math.max(1, height)
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(this.cssWidth, this.cssHeight, false)
    this.composer.setPixelRatio(dpr)
    this.composer.setSize(this.cssWidth, this.cssHeight)
    this.bloom.resolution.set(this.cssWidth * dpr * 0.5, this.cssHeight * dpr * 0.5)
    this.camera.aspect = this.cssWidth / this.cssHeight
  }

  /** Draws the frame at film time t. */
  render(t: number): void {
    const wt = worldTime(t)
    const pose = cameraAt(t)
    const cam = this.camera
    // Keep the same horizontal coverage on tall (portrait) screens.
    const aspect = cam.aspect
    const fov = aspect < 1.6 ? (2 * Math.atan(Math.tan((pose.fov * Math.PI) / 360) * Math.min(2.4, 1.6 / aspect)) * 180) / Math.PI : pose.fov
    cam.fov = Math.min(100, fov)
    cam.position.set(pose.pos[0], pose.pos[1], pose.pos[2])
    cam.up.set(0, 1, 0)
    cam.lookAt(pose.target[0], pose.target[1], pose.target[2])
    cam.rotateZ(pose.roll)
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld()

    // Board.
    const b = this.board.uniforms
    b['uTime']!.value = wt
    b['uLightX']!.value = lightX(t)
    b['uRun']!.value = progress(t, T.seamEnter - 0.2, T.seamEnter + 0.2)
    b['uImpact1']!.value = t >= T.impact ? (wt - T.impact) * 0.6 : -1
    b['uImpact2']!.value = wt >= T.lastGrainDrop ? wt - T.lastGrainDrop : -1
    b['uWake']!.value = t < 4.3 ? 0 : (wt - 4.3) * 3.2
    b['uDormant']!.value = 0.05 + 0.1 * progress(t, 6, 9)
    b['uQueen']!.value = easeInOut(progress(t, T.crackStart, T.crackFull)) * (1 + 0.8 * Math.exp(-Math.max(0, wt - T.flare) * 3) * (t > T.flare ? 1 : 0))
    b['uFrost']!.value = easeInOut(progress(t, T.menu, T.menu + 1.3))
    const ignite = b['uIgnite']!.value as number[]
    ERA_PIECES.forEach((p, i) => {
      ignite[i] = easeOut(progress(t, p.ignite - 0.05, p.ignite + 0.25)) * (0.55 + 0.45 * Math.exp(-Math.max(0, wt - p.ignite) * 1.6))
    })

    // Era pieces wake with a gold rim wipe.
    ERA_PIECES.forEach((p, i) => {
      const u = this.eras[i]!.m.u
      u.uWipe.value = easeOut(progress(t, p.ignite, p.ignite + 0.6))
      u.uGlow.value = 0.9 * Math.exp(-Math.max(0, wt - p.ignite - 0.6) * 1.2) * (t > p.ignite ? 1 : 0) + 0.28 * progress(t, p.ignite, p.ignite + 0.6)
    })
    // The queen cracks open; the crown points flare.
    const q = this.queen.m.u
    q.uCrack.value = easeInOut(progress(t, T.crackStart, T.crackFull))
    q.uCrown.value = progress(t, T.crownStart, T.crownStart + 0.5) * (0.35 + 0.65 * (t > T.flare ? Math.exp(-(wt - T.flare) * 2.5) : 0))
    q.uGlow.value = 0.1 + 0.25 * q.uCrack.value
    // The king: a cold rim that warms as the last grain falls.
    this.king.m.u.uGlow.value = 0.08 + 0.22 * progress(t, T.matchCut, T.lastGrainDrop)

    // Practical lights.
    const head = lightX(t)
    this.seamLight.position.set(t < T.seamEnter ? IMPACT[0] : head, 0.16, IMPACT[2])
    this.seamLight.intensity = t < T.impact ? 1.4 * progress(t, 0.2, T.impact) ** 2 : t < T.seamEnter ? 3.5 * Math.exp(-(wt - T.impact) * 1.5) : 3.2 * progress(t, T.seamEnter, T.seamEnter + 0.4) * (1 - progress(t, 5, 5.6))
    this.queenLight.position.set(QUEEN[0] + 0.35, 0.4 + q.uCrack.value * 0.9, QUEEN[2] + 0.45)
    this.queenLight.intensity = 1.6 * q.uCrack.value + (t > T.flare ? 2.4 * Math.exp(-(wt - T.flare) * 3) : 0)
    this.grainLight.position.set(LAST_IMPACT[0], 0.25, LAST_IMPACT[2])
    this.grainLight.intensity = wt >= T.lastGrainDrop ? 4 * Math.exp(-(wt - T.lastGrainDrop) * 1.2) + 0.6 : 0

    // Particles, with the title grains homing onto the DOM letters.
    const pxWorld = (2 * TITLE_DEPTH * Math.tan((cam.fov * Math.PI) / 360)) / this.cssHeight
    this.sim.update(t, this.unproject, pxWorld)
    const geo = this.points.geometry
    for (const name of ['position', 'aColor', 'aSize', 'aAlpha']) {
      const a = geo.getAttribute(name)
      a.needsUpdate = true
    }
    const buffer = this.renderer.getDrawingBufferSize(this.buffer)
    this.pointsMat.uniforms['uScale']!.value = buffer.y / (2 * Math.tan((cam.fov * Math.PI) / 360))

    // Lens.
    const pu = this.pointsMat.uniforms
    pu['uFocus']!.value = Math.hypot(pose.pos[0] - pose.target[0], pose.pos[1] - pose.target[1], pose.pos[2] - pose.target[2])
    pu['uAperture']!.value = pose.dof * 0.045
    const g = this.grade.uniforms
    g['uFreeze']!.value = freezeAmount(t)
    g['uFade']!.value = easeInOut(progress(t, 0, 0.35))
    g['uFlash']!.value = (t > T.impact ? 0.06 * Math.exp(-(t - T.impact) * 8) : 0) + (t > T.flare ? 0.05 * Math.exp(-(t - T.flare) * 8) : 0)
    g['uAberr']!.value = 0.0015 + (t > T.flare ? 0.01 * Math.exp(-(t - T.flare) * 5) : 0)
    g['uExposure']!.value = 1 - 0.28 * progress(t, T.menu, T.menu + 1.2)
    g['uTime']!.value = t % 10
    this.bloom.strength = 0.6 + (t > T.flare ? 0.15 * Math.exp(-(t - T.flare) * 4) : 0)

    this.composer.render()
  }

  private readonly unproject = (x: number, y: number, depth: number, out: [number, number, number]): void => {
    const cam = this.camera
    this.ray.set((x / this.cssWidth) * 2 - 1, -(y / this.cssHeight) * 2 + 1, 0.5).unproject(cam).sub(cam.position).normalize()
    out[0] = cam.position.x + this.ray.x * depth
    out[1] = cam.position.y + this.ray.y * depth
    out[2] = cam.position.z + this.ray.z * depth
  }

  dispose(): void {
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onLost)
    for (const d of this.disposables) d.dispose()
    this.renderer.dispose()
  }
}
