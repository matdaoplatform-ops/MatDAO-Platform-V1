"use client"

import { useEffect, useRef, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { Html } from "@react-three/drei"
import * as THREE from "three"
import { scrollStore, useScrollStore, type ScrollState } from "@/store/scroll"
import { ResearchCard } from "../sections/Gallery"
import { cardSlot } from "./shapes"
import { scrollForCameraZ } from "./camera"
import { scrollToTarget } from "../SmoothScroll"

const near = (s: ScrollState) => {
  const g = s.sections.gallery
  if (!g) return false
  return s.scrollY > g.start - s.viewport.h * 1.2 && s.scrollY < g.end + s.viewport.h * 0.8
}

/**
 * S5 — the research corridor (ref B4). The project cards hang on the inside
 * of a curved corridor as real DOM (drei <Html transform>), so their text
 * stays selectable and indexable; the camera flies down the corridor on
 * scroll. Hover lifts a card toward the camera and blurs the rest. Picking a
 * filter flies the camera to the first matching card.
 */
export function Corridor() {
  const [mounted, setMounted] = useState(() => near(scrollStore.getState()))
  const projects = useScrollStore((s) => s.galleryProjects)
  const labels = useScrollStore((s) => s.galleryLabels)
  const filter = useScrollStore((s) => s.galleryFilter)
  const [hover, setHover] = useState(-1)
  const groups = useRef<(THREE.Group | null)[]>([])
  const cards = useRef<(HTMLDivElement | null)[]>([])
  const wp = useRef(new THREE.Vector3())
  const { camera } = useThree()

  useEffect(() => {
    document.documentElement.setAttribute("data-mkt-corridor", "")
    let last = mounted
    const unsub = scrollStore.subscribe((s) => {
      const n = near(s)
      if (n !== last) {
        last = n
        setMounted(n)
      }
    })
    // Filter → fly the camera to the first matching card.
    let lastTarget = -1
    const unsub2 = scrollStore.subscribe((s) => {
      if (s.galleryTarget === lastTarget) return
      lastTarget = s.galleryTarget
      const g = s.sections.gallery
      if (s.galleryTarget < 0 || !g) return
      const z = cardSlot(s.galleryTarget).pos[2] + 3.3
      scrollToTarget(scrollForCameraZ(z, g.start, g.end), { duration: 1.8 })
    })
    return () => {
      unsub()
      unsub2()
      document.documentElement.removeAttribute("data-mkt-corridor")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame((_, dt) => {
    groups.current.forEach((g, i) => {
      if (!g) return
      const slot = cardSlot(i)
      const lift = hover === i ? 0.55 : 0
      // Toward the camera: along the vector from the card to the corridor axis.
      const tx = slot.pos[0] - lift * 0.5
      const tz = slot.pos[2] + lift
      g.position.x += (tx - g.position.x) * Math.min(1, dt * 6)
      g.position.z += (tz - g.position.z) * Math.min(1, dt * 6)
      // Keep facing the camera's path, not the camera itself (no wobble).
      const ry = slot.rotY + (hover === i ? 0.16 : 0)
      g.rotation.y += (ry - g.rotation.y) * Math.min(1, dt * 6)
      // Depth cue for DOM cards (they don't get fog): fade in from the dark, fade out as they pass.
      const el = cards.current[i]
      if (el) {
        g.getWorldPosition(wp.current)
        const d = wp.current.distanceTo(camera.position)
        const behind = wp.current.z > camera.position.z - 0.3
        const o = behind ? 0 : Math.min(1, Math.max(0, (15 - d) / 6)) * Math.min(1, Math.max(0, (d - 1.6) / 1.4))
        el.style.opacity = o.toFixed(3)
        el.style.visibility = o < 0.01 ? "hidden" : "visible"
      }
    })
  })

  if (!mounted || !labels || projects.length === 0) return null
  return (
    <group>
      {projects.map((p, i) => {
        const slot = cardSlot(i)
        const dim = (hover >= 0 && hover !== i) || (!!filter && p.field !== filter)
        return (
          <group key={p.id} ref={(el) => { groups.current[i] = el }} position={slot.pos} rotation={[0, slot.rotY, 0]}>
            <Html transform scale={0.16} zIndexRange={[4, 0]} className="mkt-card-3d-wrap" pointerEvents="auto">
              <div
                ref={(el) => { cards.current[i] = el }}
                className={`mkt-card-3d ${hover === i ? "is-hover" : ""} ${dim ? "is-dim" : ""}`}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover((h) => (h === i ? -1 : h))}
              >
                <ResearchCard p={p} labels={labels} plain />
              </div>
            </Html>
          </group>
        )
      })}
    </group>
  )
}
