"use client"

import { useEffect, useMemo, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import { scrollStore, storyToScroll } from "@/store/scroll"
import { ANCHOR, META, SHAPE_ORDER, rng, type ShapeId } from "./shapes"
import { CAM_KEYS, MORPH_KEYS } from "./story"
import { cameraPose } from "./camera"
import { createParticleMaterial, makeGlyphTexture } from "./particleMaterial"
import { sceneFx } from "./fx"

type ShapeBuffers = { pos: THREE.BufferAttribute; col: THREE.BufferAttribute }

const ease = (t: number) => t * t * (3 - 2 * t)
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/** Order in which shapes are built: what the visitor sees first comes first. */
const BUILD_ORDER: ShapeId[] = ["lattice", "scatter", "shards", "molecule", "sphere", "token", "field", "biochar", "substrate", "flora", "paths", "ribbon", "emblem", "finale"]

/**
 * The particle world: one THREE.Points, its shape library, and the director
 * that maps scroll → (shape A, shape B, morph) and scroll → camera.
 */
export function World({ count }: { count: number }) {
  const { gl, camera, invalidate } = useThree()
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    // `position` is only used for bounds; the shader reads aPosA/aPosB.
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    const r = rng(5)
    const rand = new Float32Array(count)
    for (let i = 0; i < count; i++) rand[i] = r()
    g.setAttribute("aRandom", new THREE.BufferAttribute(rand, 1))
    return g
  }, [count])
  const material = useMemo(() => createParticleMaterial(Math.min(gl.getPixelRatio(), 2)), [gl])
  const points = useRef<THREE.Points>(null)
  const shapes = useRef(new Map<ShapeId, ShapeBuffers>())
  const seed = useRef<ShapeBuffers | null>(null)
  const bound = useRef<{ a: string; b: string }>({ a: "", b: "" })
  const intro = useRef({ start: -1 })

  // --- build shapes (worker when available) -------------------------------
  useEffect(() => {
    material.uniforms.uGlyphs.value = makeGlyphTexture()
    // The intro seed: every particle packed into a small ball at the hero.
    const sp = new Float32Array(count * 3)
    const sc = new Float32Array(count * 3)
    const r = rng(3)
    for (let i = 0; i < count; i++) {
      const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u), rad = 0.18 * Math.cbrt(r())
      sp[i * 3] = ANCHOR.lattice[0] + s * Math.cos(th) * rad
      sp[i * 3 + 1] = ANCHOR.lattice[1] + u * rad
      sp[i * 3 + 2] = ANCHOR.lattice[2] + s * Math.sin(th) * rad
      sc[i * 3] = 1
      sc[i * 3 + 1] = 0.75
      sc[i * 3 + 2] = 0.5
    }
    seed.current = { pos: new THREE.BufferAttribute(sp, 3), col: new THREE.BufferAttribute(sc, 3) }
    bindPair("seed", "seed")

    let cancelled = false
    const accept = (id: ShapeId, pos: Float32Array, col: Float32Array) => {
      if (cancelled) return
      shapes.current.set(id, { pos: new THREE.BufferAttribute(pos, 3), col: new THREE.BufferAttribute(col, 3) })
      const done = shapes.current.size
      scrollStore.setState({ loadProgress: done / BUILD_ORDER.length })
      if (done === BUILD_ORDER.length) scrollStore.setState({ sceneReady: true })
      invalidate()
    }

    let worker: Worker | null = null
    try {
      worker = new Worker(new URL("./shapes.worker.ts", import.meta.url), { type: "module" })
      worker.onmessage = (e: MessageEvent<{ id: ShapeId; pos: Float32Array; col: Float32Array }>) => accept(e.data.id, e.data.pos, e.data.col)
      worker.onerror = () => {
        worker?.terminate()
        worker = null
        buildOnMainThread()
      }
      worker.postMessage({ ids: BUILD_ORDER, n: count })
    } catch {
      buildOnMainThread()
    }
    function buildOnMainThread() {
      import("./shapes").then(({ buildShape }) => {
        let i = 0
        const step = () => {
          if (cancelled || i >= BUILD_ORDER.length) return
          const id = BUILD_ORDER[i++]
          if (!shapes.current.has(id)) {
            const s = buildShape(id, count)
            accept(id, s.pos, s.col)
          }
          setTimeout(step, 0)
        }
        step()
      })
    }
    return () => {
      cancelled = true
      worker?.terminate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count])

  function attrs(id: string) {
    if (id === "seed") return seed.current
    return shapes.current.get(id as ShapeId) ?? null
  }
  function bindPair(a: string, b: string) {
    if (bound.current.a === a && bound.current.b === b) return true
    const A = attrs(a), B = attrs(b)
    if (!A || !B) return false
    geom.setAttribute("aPosA", A.pos)
    geom.setAttribute("aColA", A.col)
    geom.setAttribute("aPosB", B.pos)
    geom.setAttribute("aColB", B.col)
    bound.current = { a, b }
    return true
  }

  const tmp = useMemo(() => ({ p: new THREE.Vector3(), l: new THREE.Vector3(), m: new THREE.Vector3(), dir: new THREE.Vector3(), par: { x: 0, y: 0 } }), [])

  /** Piecewise key lookup → (index, eased local t). */
  function locate<T extends { s: Parameters<typeof storyToScroll>[0]; at: number }>(keys: T[], y: number, s: ReturnType<typeof scrollStore.getState>) {
    let i = 0
    const px = keys.map((k) => storyToScroll(k.s, k.at, s))
    if (y <= px[0]) return { i: 0, t: 0 }
    if (y >= px[px.length - 1]) return { i: keys.length - 2, t: 1 }
    while (i < keys.length - 2 && y > px[i + 1]) i++
    return { i, t: clamp01((y - px[i]) / Math.max(1, px[i + 1] - px[i])) }
  }

  useFrame((state, dt) => {
    const s = scrollStore.getState()
    const u = material.uniforms
    const time = state.clock.elapsedTime
    u.uTime.value = time
    const y = s.scrollY

    // ---------------------------------------------------------- morph
    let a: string = "seed", b: string = "seed", m = 0
    const haveAll = s.sceneReady
    if (haveAll || shapes.current.has("lattice")) {
      const { i, t } = locate(MORPH_KEYS, y, s)
      const ka = MORPH_KEYS[i], kb = MORPH_KEYS[i + 1]
      a = ka.shape
      b = kb.shape
      m = ka.shape === kb.shape ? 0 : t
      // Intro: seed bursts out to scattered atoms, which assemble into the lattice.
      if (s.entered && intro.current.start < 0) intro.current.start = time
      const it = intro.current.start < 0 ? 0 : (time - intro.current.start) / 3.2
      if (it < 1 && a === "lattice" && b === "lattice" && shapes.current.has("scatter")) {
        if (!s.entered) {
          a = "seed"; b = "seed"; m = 0
        } else if (it < 0.3) {
          a = "seed"; b = "scatter"; m = ease(it / 0.3)
        } else {
          a = "scatter"; b = "lattice"; m = ease((it - 0.3) / 0.7)
        }
      }
      if (!attrs(a)) a = attrs(b) ? b : "seed"
      if (!attrs(b)) b = a
    }
    bindPair(a, b)
    u.uMorph.value = m
    const metaOf = (id: string) => (id === "seed" ? { ...META.scatter, size: 0.6, gain: 1.2 } : META[id as ShapeId])
    const centerOf = (id: string) => (id === "seed" ? ANCHOR.lattice : ANCHOR[id as ShapeId])
    const ma = metaOf(a), mb = metaOf(b)
    u.uCenterA.value.set(...centerOf(a))
    u.uCenterB.value.set(...centerOf(b))
    u.uSpinA.value = time * ma.spin
    u.uSpinB.value = time * mb.spin
    u.uMetaA.value.set(ma.size, ma.glyph, ma.ember, ma.sway)
    u.uMetaB.value.set(mb.size, mb.glyph, mb.ember, mb.sway)
    u.uGainA.value = ma.gain
    u.uGainB.value = mb.gain
    const inFlight = Math.sin(Math.PI * Math.min(1, m * 1.25))
    u.uSwirl.value = (a === "field" && b === "biochar") || (a === "biochar" && b === "field") ? 2.6 : a === "seed" ? 0 : 0.7
    sceneFx.transition = inFlight
    sceneFx.shapeA = a
    sceneFx.shapeB = b
    sceneFx.morph = m

    // --------------------------------------------------------- camera
    const reduced = s.reducedMotion
    const uu = cameraPose(y, tmp.p, tmp.l, s)
    const k = CAM_KEYS[Math.min(CAM_KEYS.length - 1, Math.round(uu * (CAM_KEYS.length - 1)))]
    const cam = camera as THREE.PerspectiveCamera
    if (k.fov && Math.abs(cam.fov - k.fov) > 0.01) {
      cam.fov += (k.fov - cam.fov) * 0.1
      cam.updateProjectionMatrix()
    }
    cam.position.copy(tmp.p)
    cam.lookAt(tmp.l)
    // Mouse parallax: ±2° toward the cursor, eased.
    const px = reduced ? 0 : s.pointer.x, py = reduced ? 0 : s.pointer.y
    tmp.par.x += (px - tmp.par.x) * Math.min(1, dt * 3)
    tmp.par.y += (py - tmp.par.y) * Math.min(1, dt * 3)
    cam.rotateY(-tmp.par.x * 0.035)
    cam.rotateX(tmp.par.y * 0.022)

    // --------------------------------------------------- pointer force
    if (s.pointer.active && !reduced) {
      // Project the pointer onto a plane through the current shape, facing the camera.
      const center = m < 0.5 ? centerOf(a) : centerOf(b)
      tmp.m.set(s.pointer.x, s.pointer.y, 0.5).unproject(cam)
      tmp.dir.copy(tmp.m).sub(cam.position).normalize()
      const plane = new THREE.Plane()
      const n = cam.getWorldDirection(new THREE.Vector3()).negate()
      plane.setFromNormalAndCoplanarPoint(n, new THREE.Vector3(...center))
      const hit = new THREE.Ray(cam.position, tmp.dir).intersectPlane(plane, new THREE.Vector3())
      if (hit) u.uMouse.value.lerp(hit, 0.25)
      u.uMouseForce.value += (0.32 - u.uMouseForce.value) * 0.1
    } else {
      u.uMouseForce.value *= 0.9
    }

    // Idle drift never stops, so the page never looks frozen.
    u.uDrift.value = reduced ? 0 : 0.012
    u.uFlight.value = reduced ? 0 : 0.45
  })

  return <points ref={points} geometry={geom} material={material} frustumCulled={false} />
}

export { SHAPE_ORDER }
