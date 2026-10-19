// Turned and carved chess pieces for the film (lathe profiles plus extruded
// knight heads and crown details, merged per piece), and the shader-patched
// physical materials that let a piece wake (a gold rim wipe from obsidian to
// its era's material), crack open with molten gold, flare its crown, and glow
// with Viking runes.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { EraId, PieceKind } from './layout'

type Profile = Array<[number, number]>

const arc = (cx: number, cy: number, r: number, from: number, to: number, steps: number): Profile =>
  Array.from({ length: steps + 1 }, (_, i) => {
    const a = from + ((to - from) * i) / steps
    return [Math.max(0, cx + Math.cos(a) * r), cy + Math.sin(a) * r]
  })

/** The shared turned foot: a wide base with a bead and a cove. */
const foot = (r: number): Profile => [
  [0, 0],
  [r, 0],
  [r * 1.03, 0.03],
  [r, 0.065],
  [r * 0.86, 0.085],
  [r * 0.8, 0.11],
  [r * 0.84, 0.13],
  [r * 0.7, 0.16],
]

const PROFILES: Record<Exclude<PieceKind, 'knight'>, Profile> = {
  pawn: [...foot(0.3), [0.17, 0.22], [0.12, 0.34], [0.1, 0.42], [0.155, 0.45], [0.155, 0.475], [0.09, 0.5], ...arc(0, 0.6, 0.135, -Math.PI / 2 + 0.6, Math.PI / 2, 10)],
  bishop: [...foot(0.31), [0.2, 0.24], [0.13, 0.42], [0.105, 0.58], [0.17, 0.61], [0.17, 0.64], [0.1, 0.67], [0.13, 0.72], ...arc(0, 0.82, 0.135, -Math.PI / 2 + 0.75, Math.PI / 2 - 0.35, 9), [0.04, 0.96], ...arc(0, 1.0, 0.045, -Math.PI / 2, Math.PI / 2, 6)],
  rook: [...foot(0.33), [0.24, 0.22], [0.215, 0.4], [0.215, 0.62], [0.27, 0.7], [0.29, 0.74], [0.27, 0.86], [0.17, 0.86], [0.17, 0.8], [0, 0.8]],
  queen: [...foot(0.35), [0.23, 0.26], [0.15, 0.55], [0.12, 0.82], [0.2, 0.86], [0.2, 0.9], [0.12, 0.94], [0.13, 0.99], [0.19, 1.1], [0.22, 1.17], [0.19, 1.19], [0.1, 1.2], ...arc(0, 1.24, 0.08, -Math.PI / 2 + 1.2, Math.PI / 2, 6)],
  king: [...foot(0.37), [0.25, 0.28], [0.17, 0.6], [0.135, 0.98], [0.22, 1.03], [0.22, 1.08], [0.14, 1.12], [0.15, 1.18], [0.22, 1.36], [0.235, 1.42], [0.16, 1.47], [0.06, 1.52], [0, 1.53]],
}

const lathe = (profile: Profile, segments: number): THREE.BufferGeometry => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments)

const box = (w: number, h: number, d: number, x: number, y: number, z: number, rotY = 0): THREE.BufferGeometry => {
  const g = new THREE.BoxGeometry(w, h, d)
  g.rotateY(rotY)
  g.translate(x, y, z)
  return g
}

function knightHead(): THREE.BufferGeometry {
  // Side profile of the horse (facing +x), extruded and bevelled.
  const s = new THREE.Shape()
  s.moveTo(-0.21, 0.18)
  s.lineTo(0.2, 0.18)
  s.quadraticCurveTo(0.2, 0.34, 0.09, 0.45) // chest
  s.quadraticCurveTo(0.2, 0.5, 0.3, 0.56) // jaw
  s.quadraticCurveTo(0.37, 0.62, 0.33, 0.69) // muzzle
  s.quadraticCurveTo(0.27, 0.74, 0.15, 0.75) // brow
  s.lineTo(0.08, 0.86) // ear
  s.lineTo(0.03, 0.79)
  s.quadraticCurveTo(-0.08, 0.84, -0.14, 0.76) // poll
  s.quadraticCurveTo(-0.25, 0.6, -0.23, 0.42) // mane
  s.quadraticCurveTo(-0.22, 0.28, -0.21, 0.18)
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.15, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 4, steps: 1, curveSegments: 10 })
  g.translate(0, 0, -0.08)
  return g
}

/** The king's cross: a bevelled cross pattée, flared arms catching the light. */
function crossPattee(): THREE.BufferGeometry {
  const s = new THREE.Shape()
  const pts: Array<[number, number]> = [
    [-0.03, 0], [0.03, 0], [0.028, 0.09], [0.11, 0.065], [0.11, 0.155], [0.028, 0.13], [0.04, 0.22],
    [-0.04, 0.22], [-0.028, 0.13], [-0.11, 0.155], [-0.11, 0.065], [-0.028, 0.09],
  ]
  s.moveTo(pts[0]![0], pts[0]![1])
  for (const [x, y] of pts.slice(1)) s.lineTo(x, y)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.012, bevelSegments: 3, steps: 1 })
  g.scale(1.5, 1.5, 1.5)
  g.translate(0, 1.52, -0.026)
  return g
}

const nonIndexed = (g: THREE.BufferGeometry): THREE.BufferGeometry => {
  const out = g.index ? g.toNonIndexed() : g
  if (out !== g) g.dispose()
  // Keep exactly the attributes every part shares, so they merge.
  for (const name of Object.keys(out.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') out.deleteAttribute(name)
  return out
}

/** One merged geometry per piece kind, built once and shared. */
export function buildPieceGeometries(segments: number): Record<PieceKind, THREE.BufferGeometry> {
  const merge = (parts: THREE.BufferGeometry[]): THREE.BufferGeometry => {
    const merged = mergeGeometries(parts.map(nonIndexed), false)
    for (const p of parts) p.dispose()
    if (!merged) throw new Error('Could not build a chess piece')
    merged.computeBoundingSphere()
    return merged
  }

  const rookParts = [lathe(PROFILES.rook, segments)]
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    rookParts.push(box(0.11, 0.12, 0.08, Math.cos(a) * 0.22, 0.91, Math.sin(a) * 0.22, -a))
  }

  const queenParts = [lathe(PROFILES.queen, segments)]
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const tine = new THREE.ConeGeometry(0.032, 0.11, 8)
    tine.translate(Math.cos(a) * 0.19, 1.22, Math.sin(a) * 0.19)
    const ball = new THREE.SphereGeometry(0.024, 10, 8)
    ball.translate(Math.cos(a) * 0.19, 1.285, Math.sin(a) * 0.19)
    queenParts.push(tine, ball)
  }

  const kingParts = [lathe(PROFILES.king, segments), crossPattee()]

  const knightParts = [lathe([...foot(0.31), [0.22, 0.2], [0, 0.2]], segments), knightHead()]

  return {
    pawn: merge([lathe(PROFILES.pawn, segments)]),
    bishop: merge([lathe(PROFILES.bishop, segments)]),
    rook: merge(rookParts),
    queen: merge(queenParts),
    king: merge(kingParts),
    knight: merge(knightParts),
  }
}

/** Uniforms each piece material exposes to the timeline. */
export interface PieceUniforms {
  uWipe: { value: number }
  uHeight: { value: number }
  uSleep: { value: THREE.Color }
  uRim: { value: THREE.Color }
  uGlow: { value: number }
  uCrack: { value: number }
  uCrown: { value: number }
  uCrownFrom: { value: number }
  uGoldFrom: { value: number }
}

export interface PieceMaterial {
  material: THREE.MeshPhysicalMaterial
  u: PieceUniforms
}

type Pattern = 'none' | 'bands' | 'lacquer' | 'runes'
const PATTERN_ID: Record<Pattern, number> = { none: 0, bands: 1, lacquer: 2, runes: 3 }

const NOISE = /* glsl */ `
varying vec3 vObjPos;
uniform float uWipe, uHeight, uGlow, uCrack, uCrown, uCrownFrom, uGoldFrom;
uniform vec3 uSleep, uRim;
float lgHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float lgNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(lgHash(i), lgHash(i + vec3(1,0,0)), f.x), mix(lgHash(i + vec3(0,1,0)), lgHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(lgHash(i + vec3(0,0,1)), lgHash(i + vec3(1,0,1)), f.x), mix(lgHash(i + vec3(0,1,1)), lgHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float lgFbm(vec3 p) { return lgNoise(p) * 0.55 + lgNoise(p * 2.1) * 0.3 + lgNoise(p * 4.3) * 0.15; }
`

function patchShader(shader: THREE.WebGLProgramParametersWithUniforms, u: PieceUniforms, pattern: Pattern): void {
  Object.assign(shader.uniforms, u)
  shader.defines = { ...shader.defines, LG_PATTERN: PATTERN_ID[pattern] }
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position;')
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${NOISE}`)
    .replace(
      '#include <color_fragment>',
      /* glsl */ `#include <color_fragment>
      float lgWake = uWipe * (uHeight + 0.3) - 0.12;
      float lgAwake = smoothstep(lgWake + 0.025, lgWake - 0.025, vObjPos.y);
      float lgGold = step(uGoldFrom, vObjPos.y);
      vec3 lgEra = diffuseColor.rgb;
      #if LG_PATTERN == 1
        lgEra = mix(lgEra, vec3(0.92, 0.66, 0.24), step(0.8, fract(vObjPos.y * 9.0 + 0.2)) * step(0.16, vObjPos.y));
      #elif LG_PATTERN == 2
        lgEra = mix(lgEra, vec3(0.95, 0.7, 0.28), step(0.9, fract(vObjPos.y * 5.0 + 0.45)) * step(0.16, vObjPos.y));
      #endif
      lgEra = mix(lgEra, vec3(0.78, 0.5, 0.14), lgGold);
      diffuseColor.rgb = mix(uSleep, lgEra, lgAwake);`,
    )
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(mix(0.08, roughnessFactor, lgAwake), 0.2, lgGold);')
    .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(mix(0.0, metalnessFactor, lgAwake), 1.0, lgGold);')
    .replace(
      '#include <emissivemap_fragment>',
      /* glsl */ `#include <emissivemap_fragment>
      vec3 lgV = normalize(vViewPosition);
      float lgFres = pow(1.0 - abs(dot(normal, lgV)), 3.0);
      // The rim wipe: a hot gold band climbing the piece as it wakes.
      float lgBand = exp(-abs(vObjPos.y - lgWake) * 18.0) * step(0.001, uWipe) * step(uWipe, 0.999);
      totalEmissiveRadiance += uRim * (lgBand * 4.0 + lgFres * uGlow);
      // Molten fissures: vein lines of the noise field, grown from the foot upwards.
      if (uCrack > 0.001) {
        float lgN = lgFbm(vObjPos * vec3(9.0, 4.5, 9.0));
        float lgLine = smoothstep(0.05, 0.0, abs(lgN - 0.5));
        float lgFront = uCrack * (uHeight + 0.35) - 0.05;
        float lgGrown = smoothstep(lgFront + 0.02, lgFront - 0.22, vObjPos.y);
        float lgEdge = exp(-abs(vObjPos.y - lgFront) * 9.0);
        totalEmissiveRadiance += vec3(1.0, 0.45, 0.1) * lgLine * (lgGrown * 2.4 + lgEdge * 2.4);
      }
      totalEmissiveRadiance += vec3(1.0, 0.68, 0.28) * uCrown * smoothstep(uCrownFrom, uCrownFrom + 0.06, vObjPos.y) * 1.4;
      #if LG_PATTERN == 3
        float lgAng = atan(vObjPos.z, vObjPos.x) * 1.9099;
        vec2 lgCell = vec2(floor(lgAng * 2.0), floor(vObjPos.y * 11.0));
        vec2 lgF = fract(vec2(lgAng * 2.0, vObjPos.y * 11.0));
        float lgR = lgHash(vec3(lgCell, 3.0));
        float lgStroke = step(abs(lgF.x - 0.5), 0.07) + step(abs(lgF.x - lgF.y), 0.08) * step(0.45, lgR) + step(abs(lgF.x + lgF.y - 1.0), 0.08) * step(lgR, 0.55);
        lgStroke *= step(0.15, lgF.y) * step(lgF.y, 0.85) * step(0.26, vObjPos.y) * step(vObjPos.y, 0.68) * step(0.3, lgR);
        totalEmissiveRadiance += vec3(0.3, 0.95, 1.2) * clamp(lgStroke, 0.0, 1.0) * lgAwake * 2.6;
      #endif`,
    )
}

const ERA_LOOK: Record<EraId | 'obsidian', { color: string; metalness: number; roughness: number; clearcoat: number; pattern: Pattern; rim: string }> = {
  obsidian: { color: '#0a0910', metalness: 0, roughness: 0.24, clearcoat: 1, pattern: 'none', rim: '#ffb347' },
  lapis: { color: '#1f43b8', metalness: 0.05, roughness: 0.28, clearcoat: 0.9, pattern: 'bands', rim: '#7fb0ff' },
  bronze: { color: '#c0803f', metalness: 1, roughness: 0.3, clearcoat: 0, pattern: 'none', rim: '#ffb35a' },
  lacquer: { color: '#8e0c12', metalness: 0, roughness: 0.14, clearcoat: 1, pattern: 'lacquer', rim: '#ff6a3d' },
  rune: { color: '#6a6f75', metalness: 0, roughness: 0.78, clearcoat: 0, pattern: 'runes', rim: '#6fe6ff' },
  silver: { color: '#a9b0bb', metalness: 1, roughness: 0.22, clearcoat: 0, pattern: 'none', rim: '#e8f2ff' },
}

/** A piece material; obsidian pieces start awake, era pieces sleep in obsidian until their wipe. */
export function pieceMaterial(look: EraId | 'obsidian', height: number): PieceMaterial {
  const spec = ERA_LOOK[look]
  const u: PieceUniforms = {
    uWipe: { value: look === 'obsidian' ? 1 : 0 },
    uHeight: { value: height },
    uSleep: { value: new THREE.Color('#0a0910') },
    uRim: { value: new THREE.Color(spec.rim) },
    uGlow: { value: look === 'obsidian' ? 0.12 : 0 },
    uCrack: { value: 0 },
    uCrown: { value: 0 },
    uCrownFrom: { value: 99 },
    uGoldFrom: { value: 99 },
  }
  const material = new THREE.MeshPhysicalMaterial({
    color: spec.color,
    metalness: spec.metalness,
    roughness: spec.roughness,
    clearcoat: spec.clearcoat,
    clearcoatRoughness: 0.2,
    envMapIntensity: 1,
  })
  material.onBeforeCompile = (shader) => patchShader(shader, u, spec.pattern)
  material.customProgramCacheKey = () => `last-grain-${spec.pattern}`
  return { material, u }
}
