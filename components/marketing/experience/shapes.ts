/**
 * Target point sets for the one particle system ("From Atom to Asset").
 *
 * Every shape returns exactly N points (positions + colours) so the shader can
 * morph any shape into any other. Everything is procedural — no models, no
 * textures. Pure functions with no DOM access, so this runs in a Web Worker.
 *
 * World layout (units ≈ metres): the story travels down −Z. Each shape sits at
 * its own anchor, so particles physically migrate as the camera flies on.
 */

export type ShapeId =
  | "scatter"
  | "lattice"
  | "shards"
  | "molecule"
  | "sphere"
  | "token"
  | "field"
  | "biochar"
  | "substrate"
  | "flora"
  | "paths"
  | "ribbon"
  | "emblem"
  | "finale"

export const SHAPE_ORDER: ShapeId[] = [
  "scatter", "lattice", "shards", "molecule", "sphere", "token", "field", "biochar", "substrate", "flora", "paths", "ribbon", "emblem", "finale",
]

export type Vec3 = [number, number, number]

export const ANCHOR: Record<ShapeId, Vec3> = {
  scatter: [1.3, -0.1, 0],
  lattice: [1.3, -0.1, 0],
  shards: [0.6, 0.1, -6],
  molecule: [2.0, 0.1, -15],
  sphere: [2.0, 0.1, -15],
  token: [2.0, 0.0, -15],
  field: [0, -2.2, -27],
  biochar: [2.0, -0.1, -31],
  substrate: [2.0, -0.1, -31],
  flora: [0, 0, -47],
  paths: [0, 0, -63],
  ribbon: [0, 0, -71],
  emblem: [0, 0.1, -79],
  finale: [0, -0.2, -90],
}

/** Per-shape rendering hints read by the shader. */
export interface ShapeMeta {
  center: Vec3
  /** Idle spin about the shape's own Y axis (rad/s). */
  spin: number
  /** Point size multiplier. */
  size: number
  /** 1 = draw as ASCII/data glyphs (KALDERA sphere). */
  glyph: number
  /** 1 = some points rise like embers. */
  ember: number
  /** 1 = sway like plants in water. */
  sway: number
  /** Base brightness. */
  gain: number
}

export const META: Record<ShapeId, Omit<ShapeMeta, "center">> = {
  scatter: { spin: 0.02, size: 0.9, glyph: 0, ember: 0, sway: 0, gain: 0.8 },
  lattice: { spin: 0.12, size: 1, glyph: 0, ember: 0, sway: 0, gain: 1.35 },
  shards: { spin: 0.03, size: 1.1, glyph: 0, ember: 0, sway: 0, gain: 1.1 },
  molecule: { spin: 0.16, size: 1, glyph: 0, ember: 0, sway: 0, gain: 1 },
  sphere: { spin: 0.1, size: 1.9, glyph: 1, ember: 0, sway: 0, gain: 1.2 },
  token: { spin: 0.18, size: 0.95, glyph: 0, ember: 0, sway: 0, gain: 1 },
  field: { spin: 0, size: 1, glyph: 0, ember: 0, sway: 1, gain: 0.95 },
  biochar: { spin: 0.14, size: 1.05, glyph: 0, ember: 0, sway: 0, gain: 1 },
  substrate: { spin: 0.12, size: 1, glyph: 0, ember: 0, sway: 0, gain: 1 },
  flora: { spin: 0, size: 1.05, glyph: 0, ember: 0, sway: 1, gain: 0.95 },
  paths: { spin: 0.1, size: 1, glyph: 0, ember: 0, sway: 0, gain: 1 },
  ribbon: { spin: 0.05, size: 0.85, glyph: 0, ember: 0, sway: 0, gain: 0.9 },
  emblem: { spin: 0.2, size: 1, glyph: 0, ember: 0, sway: 0, gain: 1 },
  finale: { spin: 0.08, size: 1.1, glyph: 0, ember: 1, sway: 0, gain: 1.15 },
}

export interface ShapeData {
  id: ShapeId
  pos: Float32Array
  col: Float32Array
}

/* ------------------------------------------------------------- helpers */

export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Rand = () => number
const gauss = (r: Rand) => {
  const u = Math.max(1e-9, r())
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r())
}
const hex = (h: string): Vec3 => {
  const n = parseInt(h.replace("#", ""), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}
const mixc = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const scale3 = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k]
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

export const C = {
  catalystA: hex("#ff6a2b"),
  catalystB: hex("#ffb15c"),
  dataA: hex("#38e1ff"),
  dataB: hex("#5b7cff"),
  bio: hex("#b8f26b"),
  bioDeep: hex("#4fae5a"),
  teal: hex("#3fd6b0"),
  white: hex("#eef2ff"),
  grey: hex("#7d8696"),
  greyDark: hex("#454b57"),
  char: hex("#4a4d57"),
  cream: hex("#efe6cf"),
  magenta: hex("#e04bd6"),
  violet: hex("#8b5cff"),
}

/** Rotate a point by Euler angles (x then y then z). */
function rot(p: Vec3, ax: number, ay: number, az: number): Vec3 {
  let [x, y, z] = p
  let c = Math.cos(ax), s = Math.sin(ax)
  ;[y, z] = [y * c - z * s, y * s + z * c]
  c = Math.cos(ay); s = Math.sin(ay)
  ;[x, z] = [x * c + z * s, -x * s + z * c]
  c = Math.cos(az); s = Math.sin(az)
  ;[x, y] = [x * c - y * s, x * s + y * c]
  return [x, y, z]
}

class Writer {
  pos: Float32Array
  col: Float32Array
  i = 0
  constructor(public n: number, public center: Vec3) {
    this.pos = new Float32Array(n * 3)
    this.col = new Float32Array(n * 3)
  }
  get full() {
    return this.i >= this.n
  }
  /** p is relative to the shape's anchor. */
  put(p: Vec3, c: Vec3) {
    if (this.i >= this.n) return
    const o = this.i * 3
    this.pos[o] = p[0] + this.center[0]
    this.pos[o + 1] = p[1] + this.center[1]
    this.pos[o + 2] = p[2] + this.center[2]
    this.col[o] = c[0]
    this.col[o + 1] = c[1]
    this.col[o + 2] = c[2]
    this.i++
  }
  /** Fill any remaining slots by repeating earlier points with jitter (so counts always match). */
  finish(r: Rand, jitter = 0.01) {
    const filled = this.i
    if (filled === 0) {
      while (!this.full) this.put([0, 0, 0], [0, 0, 0])
      return
    }
    while (!this.full) {
      const k = Math.floor(r() * filled) * 3
      this.put(
        [this.pos[k] - this.center[0] + gauss(r) * jitter, this.pos[k + 1] - this.center[1] + gauss(r) * jitter, this.pos[k + 2] - this.center[2] + gauss(r) * jitter],
        [this.col[k], this.col[k + 1], this.col[k + 2]],
      )
    }
  }
}

function onSphere(r: Rand): Vec3 {
  const u = r() * 2 - 1
  const th = r() * Math.PI * 2
  const s = Math.sqrt(1 - u * u)
  return [s * Math.cos(th), u, s * Math.sin(th)]
}

function segPoint(a: Vec3, b: Vec3, t: number, r: Rand, w: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t + gauss(r) * w, a[1] + (b[1] - a[1]) * t + gauss(r) * w, a[2] + (b[2] - a[2]) * t + gauss(r) * w]
}

/* --------------------------------------------------------------- shapes */

/** Scattered atoms: a loose cloud the preloader bursts into the lattice from. */
function scatter(n: number): ShapeData {
  const r = rng(11)
  const w = new Writer(n, ANCHOR.scatter)
  while (!w.full) {
    const d = onSphere(r)
    const rad = 2.5 + Math.pow(r(), 0.6) * 11
    const c = r() < 0.15 ? C.catalystB : mixc(C.dataA, C.white, r() * 0.6)
    w.put(scale3(d, rad), scale3(c, 0.35 + r() * 0.4))
  }
  return { id: "scatter", pos: w.pos, col: w.col }
}

/** Crystal lattice: 7×7×7 node clusters + bonds. Catalyst core → data edges. */
function latticePoints(n: number, center: Vec3, opts: { spacing: number; tilt: Vec3; bright: number; seed: number }) {
  const r = rng(opts.seed)
  const w = new Writer(n, center)
  const N = 7
  const h = (N - 1) / 2
  const s = opts.spacing
  const node = (i: number, j: number, k: number): Vec3 => [(i - h) * s, (j - h) * s, (k - h) * s]
  const maxR = Math.sqrt(3) * h * s
  const color = (p: Vec3) => {
    const t = clamp01(Math.hypot(p[0], p[1], p[2]) / maxR)
    const c = t < 0.45 ? mixc(C.catalystB, C.catalystA, t / 0.45) : mixc(C.catalystA, C.dataB, (t - 0.45) / 0.55)
    return scale3(mixc(c, C.dataA, t > 0.8 ? (t - 0.8) * 2 : 0), opts.bright * (1.25 - t * 0.55))
  }
  const nodeShare = 0.56
  const nodesN = N * N * N
  const perNode = Math.floor((n * nodeShare) / nodesN)
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++)
      for (let k = 0; k < N; k++) {
        const c = node(i, j, k)
        for (let q = 0; q < perNode; q++) {
          const p: Vec3 = [c[0] + gauss(r) * 0.045, c[1] + gauss(r) * 0.045, c[2] + gauss(r) * 0.045]
          const tp = rot(p, opts.tilt[0], opts.tilt[1], opts.tilt[2])
          w.put(tp, color(p))
        }
      }
  // Bonds between axis neighbours.
  const bonds: [Vec3, Vec3][] = []
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++)
      for (let k = 0; k < N; k++) {
        if (i < N - 1) bonds.push([node(i, j, k), node(i + 1, j, k)])
        if (j < N - 1) bonds.push([node(i, j, k), node(i, j + 1, k)])
        if (k < N - 1) bonds.push([node(i, j, k), node(i, j, k + 1)])
      }
  while (!w.full) {
    const [a, b] = bonds[Math.floor(r() * bonds.length)]
    const p = segPoint(a, b, 0.12 + r() * 0.76, r, 0.006)
    w.put(rot(p, opts.tilt[0], opts.tilt[1], opts.tilt[2]), scale3(color(p), 0.55))
  }
  return w
}

function lattice(n: number): ShapeData {
  const w = latticePoints(n, ANCHOR.lattice, { spacing: 0.43, tilt: [0.5, 0.6, 0.18], bright: 1, seed: 7 })
  return { id: "lattice", pos: w.pos, col: w.col }
}

/** The lattice fractured: chunks drift apart as shards, the rest becomes dust. Greyed, with embers. */
function shards(n: number): ShapeData {
  const r = rng(23)
  const base = latticePoints(n, [0, 0, 0], { spacing: 0.5, tilt: [0.5, 0.6, 0.18], bright: 1, seed: 7 })
  const w = new Writer(n, ANCHOR.shards)
  // Voronoi chunks.
  const seeds: { c: Vec3; off: Vec3; rot: Vec3 }[] = []
  for (let i = 0; i < 34; i++) {
    const c = scale3(onSphere(r), 1.9 * Math.cbrt(r()))
    const dir = onSphere(r)
    const off: Vec3 = [c[0] * 1.6 + dir[0] * 1.2 + (r() - 0.3) * 3.5, c[1] * 1.3 + dir[1] * 0.9, c[2] * 1.4 + dir[2] * 1.4]
    seeds.push({ c, off, rot: [(r() - 0.5) * 1.6, (r() - 0.5) * 1.6, (r() - 0.5) * 1.6] })
  }
  for (let i = 0; i < n; i++) {
    const o = i * 3
    const p: Vec3 = [base.pos[o], base.pos[o + 1], base.pos[o + 2]]
    const dust = r() < 0.32
    const ember = r() < 0.05
    const grey = mixc(C.greyDark, C.grey, r())
    const col = ember ? scale3(mixc(C.catalystA, C.catalystB, r()), 1.1) : scale3(grey, 1.0)
    if (dust) {
      const d = onSphere(r)
      const rad = 1.5 + Math.pow(r(), 0.7) * 6.5
      w.put([d[0] * rad * 1.5, d[1] * rad * 0.6, d[2] * rad], scale3(col, 0.7))
      continue
    }
    let best = 0, bd = 1e9
    for (let k = 0; k < seeds.length; k++) {
      const s = seeds[k].c
      const d = (p[0] - s[0]) ** 2 + (p[1] - s[1]) ** 2 + (p[2] - s[2]) ** 2
      if (d < bd) { bd = d; best = k }
    }
    const s = seeds[best]
    const local: Vec3 = [p[0] - s.c[0], p[1] - s.c[1], p[2] - s.c[2]]
    const q = rot(local, s.rot[0], s.rot[1], s.rot[2])
    w.put([q[0] + s.c[0] + s.off[0], q[1] + s.c[1] + s.off[1], q[2] + s.c[2] + s.off[2]], col)
  }
  return { id: "shards", pos: w.pos, col: w.col }
}

/** Ball-and-stick molecule (a substituted aromatic ring), point-sampled. */
function molecule(n: number): ShapeData {
  const r = rng(31)
  const w = new Writer(n, ANCHOR.molecule)
  type Atom = { p: Vec3; rad: number; c: Vec3 }
  const atoms: Atom[] = []
  const ring = 1.0
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    atoms.push({ p: [Math.cos(a) * ring, Math.sin(a) * ring, Math.sin(a * 3) * 0.08], rad: 0.24, c: C.white })
  }
  const subs: { at: number; len: number; c: Vec3; rad: number }[] = [
    { at: 0, len: 1.0, c: C.catalystA, rad: 0.22 },
    { at: 2, len: 1.0, c: C.dataA, rad: 0.21 },
    { at: 4, len: 1.0, c: C.catalystB, rad: 0.22 },
    { at: 1, len: 0.7, c: C.dataB, rad: 0.13 },
    { at: 3, len: 0.7, c: C.dataB, rad: 0.13 },
    { at: 5, len: 0.7, c: C.dataB, rad: 0.13 },
  ]
  const bonds: [number, number][] = []
  for (let i = 0; i < 6; i++) bonds.push([i, (i + 1) % 6])
  for (const s of subs) {
    const base = atoms[s.at].p
    const dir = [base[0], base[1], 0]
    const L = Math.hypot(dir[0], dir[1])
    const p: Vec3 = [base[0] + (dir[0] / L) * s.len, base[1] + (dir[1] / L) * s.len, (r() - 0.5) * 0.5]
    atoms.push({ p, rad: s.rad, c: s.c })
    bonds.push([s.at, atoms.length - 1])
    if (s.len > 0.9) {
      // a second shell atom for depth
      const q: Vec3 = [p[0] + (dir[0] / L) * 0.55 + (r() - 0.5) * 0.3, p[1] + (dir[1] / L) * 0.55, p[2] + 0.55]
      atoms.push({ p: q, rad: 0.12, c: C.dataB })
      bonds.push([atoms.length - 2, atoms.length - 1])
    }
  }
  const tilt: Vec3 = [0.9, 0.3, 0.2]
  const atomShare = 0.66
  const totalArea = atoms.reduce((s, a) => s + a.rad * a.rad, 0)
  for (const a of atoms) {
    const count = Math.floor(((n * atomShare) * (a.rad * a.rad)) / totalArea)
    for (let q = 0; q < count; q++) {
      const d = onSphere(r)
      const rr = a.rad * (0.92 + r() * 0.1)
      const p: Vec3 = [a.p[0] + d[0] * rr, a.p[1] + d[1] * rr, a.p[2] + d[2] * rr]
      // light from the upper left: brighter on that side
      const lit = 0.55 + 0.45 * clamp01(-d[0] * 0.5 + d[1] * 0.6 + d[2] * 0.5)
      w.put(rot(p, ...tilt), scale3(a.c, lit))
    }
  }
  while (!w.full) {
    const [i, j] = bonds[Math.floor(r() * bonds.length)]
    const A = atoms[i].p, B = atoms[j].p
    const t = r()
    const th = r() * Math.PI * 2
    const p = segPoint(A, B, t, r, 0)
    // cylinder of radius 0.045 around the bond
    const ax: Vec3 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]]
    const L = Math.hypot(...ax)
    const u: Vec3 = Math.abs(ax[2] / L) < 0.9 ? [0, 0, 1] : [1, 0, 0]
    const v1: Vec3 = [ax[1] * u[2] - ax[2] * u[1], ax[2] * u[0] - ax[0] * u[2], ax[0] * u[1] - ax[1] * u[0]]
    const l1 = Math.hypot(...v1)
    const v2: Vec3 = [(ax[1] * v1[2] - ax[2] * v1[1]) / (L * l1), (ax[2] * v1[0] - ax[0] * v1[2]) / (L * l1), (ax[0] * v1[1] - ax[1] * v1[0]) / (L * l1)]
    const cr = 0.045
    const q: Vec3 = [p[0] + (v1[0] / l1) * Math.cos(th) * cr + v2[0] * Math.sin(th) * cr, p[1] + (v1[1] / l1) * Math.cos(th) * cr + v2[1] * Math.sin(th) * cr, p[2] + (v1[2] / l1) * Math.cos(th) * cr + v2[2] * Math.sin(th) * cr]
    w.put(rot(q, ...tilt), scale3(mixc(atoms[i].c, atoms[j].c, t), 0.45))
  }
  return { id: "molecule", pos: w.pos, col: w.col }
}

/** KALDERA data sphere: glyph surface, a denser core, and streams flowing in. */
function sphere(n: number): ShapeData {
  const r = rng(41)
  const w = new Writer(n, ANCHOR.sphere)
  const R = 1.55
  const surf = Math.floor(n * 0.66)
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < surf; i++) {
    const y = 1 - (i / (surf - 1)) * 2
    const rad = Math.sqrt(1 - y * y)
    const th = golden * i
    const p: Vec3 = [Math.cos(th) * rad * R, y * R, Math.sin(th) * rad * R]
    const band = 0.5 + 0.5 * Math.sin(y * 9 + Math.cos(th) * 2)
    w.put([p[0] + gauss(r) * 0.01, p[1] + gauss(r) * 0.01, p[2] + gauss(r) * 0.01], scale3(mixc(C.dataB, C.dataA, band), 0.6 + band * 0.5))
  }
  const core = Math.floor(n * 0.12)
  for (let i = 0; i < core; i++) {
    const d = onSphere(r)
    const rr = Math.pow(r(), 0.5) * R * 0.85
    w.put(scale3(d, rr), scale3(mixc(C.white, C.dataA, r()), 0.35))
  }
  // Streams: 9 spiralling arcs from outside into the sphere.
  while (!w.full) {
    const s = Math.floor(r() * 9)
    const a0 = (s / 9) * Math.PI * 2
    const t = r()
    const rr = R + (1 - t) * 3.2
    const a = a0 + t * 1.8
    const y = (s % 3 - 1) * 1.1 * (1 - t) + Math.sin(s) * 0.4 * (1 - t)
    w.put([Math.cos(a) * rr + gauss(r) * 0.03, y + gauss(r) * 0.03, Math.sin(a) * rr + gauss(r) * 0.03], scale3(C.dataA, 0.5 + t * 0.8))
  }
  return { id: "sphere", pos: w.pos, col: w.col }
}

/** Hexagonal token with a hex-mesh face, standing inside a halo arch. */
function token(n: number): ShapeData {
  const r = rng(53)
  const w = new Writer(n, ANCHOR.token)
  const R = 1.25
  const T = 0.14
  // Hex outline in the XY plane (token stands upright, facing +Z).
  const hexPt = (k: number): [number, number] => [Math.cos((k / 6) * Math.PI * 2 + Math.PI / 6) * R, Math.sin((k / 6) * Math.PI * 2 + Math.PI / 6) * R]
  const insideHex = (x: number, y: number) => {
    for (let k = 0; k < 6; k++) {
      const [ax, ay] = hexPt(k), [bx, by] = hexPt(k + 1)
      if ((bx - ax) * (y - ay) - (by - ay) * (x - ax) < 0) return false
    }
    return true
  }
  // Hex-grid cell edges on both faces.
  const cell = 0.2
  const faceN = Math.floor(n * 0.5)
  let placed = 0
  while (placed < faceN) {
    const x = (r() * 2 - 1) * R, y = (r() * 2 - 1) * R
    if (!insideHex(x, y)) continue
    // distance to the nearest hex-cell edge (axial coords)
    const q = ((Math.sqrt(3) / 3) * x - y / 3) / cell
    const rr = ((2 / 3) * y) / cell
    let rx = Math.round(q), rz = Math.round(rr), ry = Math.round(-q - rr)
    const dx = Math.abs(rx - q), dz = Math.abs(rz - rr), dy = Math.abs(ry - (-q - rr))
    if (dx > dy && dx > dz) rx = -ry - rz
    else if (dy > dz) ry = -rx - rz
    else rz = -rx - ry
    const cx = cell * Math.sqrt(3) * (rx + rz / 2), cy = cell * 1.5 * rz
    const dd = Math.hypot(x - cx, y - cy) / cell
    if (dd < 0.78 && r() > 0.12) continue
    const front = r() < 0.6
    const z = front ? T : -T
    const edgeGlow = clamp01((dd - 0.78) * 4)
    w.put([x, y, z], scale3(mixc(C.dataB, C.dataA, edgeGlow), front ? 0.7 + edgeGlow * 0.5 : 0.4))
    placed++
  }
  // Rim (side walls) — bright.
  const rimN = Math.floor(n * 0.2)
  for (let i = 0; i < rimN; i++) {
    const k = Math.floor(r() * 6)
    const [ax, ay] = hexPt(k), [bx, by] = hexPt(k + 1)
    const t = r()
    w.put([ax + (bx - ax) * t, ay + (by - ay) * t, (r() * 2 - 1) * T], scale3(mixc(C.white, C.dataA, r() * 0.5), 1.1))
  }
  // Halo arch behind and floor glow line.
  const haloR = 2.35
  while (!w.full) {
    if (r() < 0.82) {
      const a = Math.PI * (0.06 + r() * 0.88)
      w.put([Math.cos(a) * haloR + gauss(r) * 0.012, Math.sin(a) * haloR - 0.75 + gauss(r) * 0.012, -0.9 + gauss(r) * 0.01], scale3(mixc(C.violet, C.dataA, r()), 0.85))
    } else {
      const x = (r() * 2 - 1) * 2.6
      w.put([x, -1.75 + gauss(r) * 0.01, -0.6 + gauss(r) * 0.15], scale3(C.dataB, 0.35 * (1 - Math.abs(x) / 2.6)))
    }
  }
  return { id: "token", pos: w.pos, col: w.col }
}

/** Water hyacinth field: rosettes of round leaves on swollen petioles, trailing roots. */
function field(n: number): ShapeData {
  const r = rng(61)
  const w = new Writer(n, ANCHOR.field)
  const plants: { x: number; z: number; s: number; rot: number }[] = []
  for (let i = 0; i < 46; i++) {
    plants.push({ x: (r() * 2 - 1) * 7.5, z: (r() * 2 - 1) * 6.5, s: 0.55 + r() * 0.6, rot: r() * Math.PI * 2 })
  }
  const per = Math.floor(n / plants.length)
  for (const pl of plants) {
    const leaves = 6 + Math.floor(r() * 4)
    for (let q = 0; q < per; q++) {
      const roll = r()
      let p: Vec3
      let c: Vec3
      const L = Math.floor(r() * leaves)
      const ang = pl.rot + (L / leaves) * Math.PI * 2 + (r() - 0.5) * 0.2
      const out = 0.28 * pl.s
      if (roll < 0.5) {
        // Leaf: a cupped round disc tilted up and out at the top of its petiole.
        const lr = 0.32 * pl.s
        const u = Math.sqrt(r()), th = r() * Math.PI * 2
        const lx = Math.cos(th) * u * lr, ly = Math.sin(th) * u * lr * 1.08
        const cup = (lx * lx + ly * ly) / (lr * lr) * 0.08 * pl.s
        const h = 0.5 * pl.s + 0.12 * Math.sin(L * 1.7)
        const base: Vec3 = [Math.cos(ang) * (out + 0.18 * pl.s), h, Math.sin(ang) * (out + 0.18 * pl.s)]
        const tiltUp = 1.0
        const local = rot([lx, cup, ly], tiltUp, -ang + Math.PI / 2, 0)
        p = [base[0] + local[0], base[1] + local[1], base[2] + local[2]]
        const edge = u > 0.92
        c = edge ? scale3(C.bio, 1.1) : scale3(mixc(C.bioDeep, C.bio, r()), 0.75 + r() * 0.3)
        if (r() < 0.06) c = scale3(C.teal, 0.9)
      } else if (roll < 0.72) {
        // Petiole: a bulbous spindle rising and leaning out.
        const t = r()
        const bulb = 0.06 * pl.s * (0.4 + Math.sin(Math.PI * Math.min(1, t * 1.6)) * 1.1)
        const th = r() * Math.PI * 2
        const rr = out * t + 0.03
        p = [Math.cos(ang) * rr + Math.cos(th) * bulb, t * 0.5 * pl.s, Math.sin(ang) * rr + Math.sin(th) * bulb]
        c = scale3(mixc(C.bioDeep, C.teal, r() * 0.5), 0.6)
      } else if (roll < 0.9) {
        // Roots: trailing feathery strands below the waterline.
        const strand = Math.floor(r() * 9)
        const t = r()
        const sa = pl.rot + strand * 0.7
        const len = (0.9 + (strand % 3) * 0.35) * pl.s
        p = [Math.cos(sa) * 0.08 * t + Math.sin(t * 5 + strand) * 0.06 + gauss(r) * 0.02, -t * len, Math.sin(sa) * 0.08 * t + Math.cos(t * 4 + strand) * 0.06 + gauss(r) * 0.02]
        c = scale3(mixc(C.teal, C.violet, 0.35 + r() * 0.3), 0.32)
      } else {
        // Water surface speckle around the plant.
        const rr = Math.sqrt(r()) * 1.3 * pl.s
        const th = r() * Math.PI * 2
        p = [Math.cos(th) * rr, 0.01 + gauss(r) * 0.01, Math.sin(th) * rr]
        c = scale3(mixc(C.teal, C.dataA, r()), 0.18)
      }
      w.put([p[0] + pl.x, p[1], p[2] + pl.z], c)
    }
  }
  w.finish(r)
  return { id: "field", pos: w.pos, col: w.col }
}

/** Value noise (cheap, deterministic) for lumpy surfaces. */
function noise3(x: number, y: number, z: number) {
  return Math.sin(x * 2.1 + Math.sin(y * 1.7)) * Math.cos(y * 2.3 + Math.sin(z * 1.9)) * Math.sin(z * 1.8 + Math.cos(x * 2.6))
}

/** One porous biochar granule (charcoal points, ember edges). */
function granule(w: Writer, r: Rand, count: number, at: Vec3, R: number, emberAmt: number) {
  const pores: { c: Vec3; r: number }[] = []
  for (let i = 0; i < 14; i++) pores.push({ c: scale3(onSphere(r), R * (0.75 + r() * 0.35)), r: R * (0.12 + r() * 0.16) })
  let placed = 0
  let guard = 0
  while (placed < count && guard++ < count * 8) {
    const d = onSphere(r)
    const bump = 1 + 0.18 * noise3(d[0] * 3, d[1] * 3, d[2] * 3) + 0.06 * noise3(d[0] * 9, d[1] * 9, d[2] * 9)
    const shell = r() < 0.8
    const rr = R * bump * (shell ? 0.97 + r() * 0.05 : Math.pow(r(), 0.6))
    const p: Vec3 = scale3(d, rr)
    let inPore = false
    for (const po of pores) if ((p[0] - po.c[0]) ** 2 + (p[1] - po.c[1]) ** 2 + (p[2] - po.c[2]) ** 2 < po.r * po.r) inPore = true
    if (inPore && shell) continue
    const hot = noise3(d[0] * 5 + 1, d[1] * 5, d[2] * 5) > 0.55 && shell
    const c = hot && r() < emberAmt ? scale3(mixc(C.catalystA, C.catalystB, r()), 1.1) : scale3(mixc(C.char, C.grey, r() * 0.5), shell ? 0.75 : 0.35)
    w.put([p[0] + at[0], p[1] + at[1], p[2] + at[2]], c)
    placed++
  }
}

function biochar(n: number): ShapeData {
  const r = rng(71)
  const w = new Writer(n, ANCHOR.biochar)
  granule(w, r, n, [0, 0, 0], 1.25, 0.9)
  w.finish(r, 0.02)
  return { id: "biochar", pos: w.pos, col: w.col }
}

/** Substrate block: biochar granules bound in a woven bacterial-cellulose mesh. */
function substrate(n: number): ShapeData {
  const r = rng(73)
  const w = new Writer(n, ANCHOR.substrate)
  const half: Vec3 = [1.35, 0.8, 1.1]
  const charN = Math.floor(n * 0.55)
  const granules = 26
  for (let g = 0; g < granules; g++) {
    const at: Vec3 = [(r() * 2 - 1) * (half[0] - 0.3), (r() * 2 - 1) * (half[1] - 0.25), (r() * 2 - 1) * (half[2] - 0.3)]
    granule(w, r, Math.floor(charN / granules), at, 0.2 + r() * 0.16, 0.4)
  }
  // Cellulose fibres: woven strands across all six faces of a rounded block.
  while (!w.full) {
    const face = Math.floor(r() * 6)
    const axis = face >> 1
    const sign = face & 1 ? 1 : -1
    const along = r() < 0.5
    const lane = Math.round((r() * 2 - 1) * 9) / 9
    const t = r() * 2 - 1
    const p: Vec3 = [0, 0, 0]
    const a1 = (axis + 1) % 3, a2 = (axis + 2) % 3
    p[axis] = sign * half[axis] * (1 + 0.04 * Math.sin(t * 12 + lane * 20))
    p[a1] = (along ? t : lane) * half[a1]
    p[a2] = (along ? lane : t) * half[a2]
    // weave: fibres bob over/under each other
    p[axis] += sign * 0.025 * Math.sin((along ? t : lane) * 30) * (along ? 1 : -1)
    // round the block's edges
    const m = Math.max(Math.abs(p[0]) / half[0], Math.abs(p[1]) / half[1], Math.abs(p[2]) / half[2])
    const q: Vec3 = [p[0] / m, p[1] / m, p[2] / m]
    w.put([q[0] + gauss(r) * 0.006, q[1] + gauss(r) * 0.006, q[2] + gauss(r) * 0.006], scale3(C.cream, 0.32 + r() * 0.3))
  }
  return { id: "substrate", pos: w.pos, col: w.col }
}

/** Corridor flora: particle blooms dissolving around each card, plus a sparse wall. */
export const CORRIDOR = { z0: -38, z1: -58, radius: 3.3, cards: 7 }
export function cardSlot(i: number): { pos: Vec3; side: number } {
  const z = CORRIDOR.z0 - 2.2 - i * ((CORRIDOR.z0 - CORRIDOR.z1 - 3) / (CORRIDOR.cards - 1))
  const side = i % 2 ? 1 : -1
  return { pos: [side * 1.25, (i % 3 - 1) * 0.35, z], side }
}
function flora(n: number): ShapeData {
  const r = rng(83)
  const w = new Writer(n, [0, 0, 0])
  const palette = [C.dataA, C.magenta, C.violet, C.dataB]
  for (let i = 0; i < CORRIDOR.cards; i++) {
    const { pos, side } = cardSlot(i)
    const count = Math.floor((n * 0.72) / CORRIDOR.cards)
    for (let q = 0; q < count; q++) {
      // blooms clustered on the corridor wall behind/around the card
      const th = (side > 0 ? 0 : Math.PI) + (r() - 0.5) * 1.6
      const rad = CORRIDOR.radius * (0.82 + r() * 0.3)
      const fz = pos[2] + gauss(r) * 1.1
      const curl = Math.sin(fz * 3 + q) * 0.2
      const p: Vec3 = [Math.cos(th) * rad + curl, Math.sin(th) * rad * 0.9 + gauss(r) * 0.6, fz]
      const c = palette[(i + Math.floor(r() * 2)) % palette.length]
      w.put(p, scale3(c, 0.45 + r() * 0.6))
    }
  }
  while (!w.full) {
    const th = r() * Math.PI * 2
    const z = CORRIDOR.z0 + (CORRIDOR.z1 - CORRIDOR.z0) * r()
    w.put([Math.cos(th) * CORRIDOR.radius * 1.1, Math.sin(th) * CORRIDOR.radius * 1.1, z], scale3(mixc(C.dataB, C.violet, r()), 0.18))
  }
  return { id: "flora", pos: w.pos, col: w.col }
}

/** Two paths: an orange cluster (researchers) and a cyan one (backers). */
function paths(n: number): ShapeData {
  const r = rng(91)
  const w = new Writer(n, ANCHOR.paths)
  while (!w.full) {
    const left = r() < 0.5
    const cx = left ? -2.7 : 2.7
    // a soft galaxy: disc + bulge
    const disc = r() < 0.7
    let p: Vec3
    if (disc) {
      const rr = Math.pow(r(), 0.6) * 1.6
      const th = r() * Math.PI * 2 + rr * 1.8
      p = [Math.cos(th) * rr, gauss(r) * 0.06 * (1.7 - rr), Math.sin(th) * rr]
      p = rot(p, 1.1, 0, left ? 0.35 : -0.35)
    } else {
      p = scale3(onSphere(r), Math.pow(r(), 1.4) * 0.6)
    }
    const c = left ? mixc(C.catalystA, C.catalystB, r()) : mixc(C.dataA, C.dataB, r())
    w.put([p[0] + cx, p[1], p[2]], scale3(c, disc ? 0.7 : 1.0))
  }
  return { id: "paths", pos: w.pos, col: w.col }
}

/** A figure-8 ribbon of fine particles (ref B1). */
function ribbonPoints(w: Writer, r: Rand, count: number, scale: number, bright: number) {
  for (let i = 0; i < count; i++) {
    const t = r() * Math.PI * 2
    const d = 1 + Math.sin(t) ** 2
    const x = (Math.cos(t) / d) * 2.6 * scale
    const y = ((Math.sin(t) * Math.cos(t)) / d) * 2.6 * scale
    const width = (0.12 + 0.1 * Math.sin(t * 3)) * scale
    const twist = t * 2
    const u = (r() - 0.5) * width
    const p: Vec3 = [x, y * 0.6 + Math.cos(twist) * u, Math.sin(twist) * u + Math.sin(t) * 0.6 * scale]
    const c = mixc(C.dataA, C.white, r() * 0.5)
    w.put(rot(p, 0.2, 0, Math.PI / 2), scale3(c, bright * (0.35 + r() * 0.5)))
  }
}
function ribbon(n: number): ShapeData {
  const r = rng(101)
  const w = new Writer(n, ANCHOR.ribbon)
  ribbonPoints(w, r, Math.floor(n * 0.8), 1.1, 0.8)
  while (!w.full) w.put(scale3(onSphere(r), 2 + r() * 6), scale3(C.dataB, 0.18))
  return { id: "ribbon", pos: w.pos, col: w.col }
}

/** The MatDAO mark (molecule graph from the logo), extruded, on the ribbon. */
export const MARK_NODES: [number, number, number][] = [
  [62, 38, 16], [196, 22, 20], [131, 101, 7], [230, 126, 17], [20, 148, 14], [112, 222, 20], [200, 218, 14],
]
export const MARK_EDGES: [number, number][] = [
  [0, 1], [0, 2], [0, 4], [1, 2], [1, 3], [2, 3], [2, 5], [4, 5], [3, 6], [5, 6],
]
function emblem(n: number): ShapeData {
  const r = rng(113)
  const w = new Writer(n, ANCHOR.emblem)
  const k = 1.6 / 125 // logo units → world
  const node = (i: number): Vec3 => [(MARK_NODES[i][0] - 125) * k, -(MARK_NODES[i][1] - 122) * k, 0]
  const markN = Math.floor(n * 0.62)
  for (let i = 0; i < markN; i++) {
    if (r() < 0.45) {
      const j = Math.floor(r() * MARK_NODES.length)
      const c = node(j)
      const rad = MARK_NODES[j][2] * k * 1.05
      const d = onSphere(r)
      w.put([c[0] + d[0] * rad, c[1] + d[1] * rad, c[2] + d[2] * rad], scale3(mixc(C.dataA, C.white, r() * 0.6), 1.05))
    } else {
      const [a, b] = MARK_EDGES[Math.floor(r() * MARK_EDGES.length)]
      const p = segPoint(node(a), node(b), r(), r, 0.025)
      w.put(p, scale3(mixc(C.dataB, C.dataA, r()), 0.85))
    }
  }
  ribbonPoints(w, r, n - markN, 1.25, 0.6)
  return { id: "emblem", pos: w.pos, col: w.col }
}

/** Finale: the lattice again, complete and glowing, with embers rising. */
function finale(n: number): ShapeData {
  const w = latticePoints(n, ANCHOR.finale, { spacing: 0.7, tilt: [0.42, 0.75, 0.12], bright: 1.15, seed: 9 })
  return { id: "finale", pos: w.pos, col: w.col }
}

const GEN: Record<ShapeId, (n: number) => ShapeData> = {
  scatter, lattice, shards, molecule, sphere, token, field, biochar, substrate, flora, paths, ribbon, emblem, finale,
}

export function buildShape(id: ShapeId, n: number): ShapeData {
  return GEN[id](n)
}
