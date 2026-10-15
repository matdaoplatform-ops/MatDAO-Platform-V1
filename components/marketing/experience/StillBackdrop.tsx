"use client"

import { useEffect, useState } from "react"
import { scrollStore, type ScrollState } from "@/store/scroll"
import { STEP_WINDOWS } from "../sections/Protocol"
import { TERRA_WINDOWS } from "../sections/Terra"

/**
 * Reduced motion / no WebGL: instead of the live film, one still render of
 * each section's shape (exported once from the real scene), cross-faded as
 * sections change. No camera moves, no scrubbing.
 */

const STILLS = ["hero", "problem", "molecule", "sphere", "token", "field", "biochar", "substrate", "flora", "paths", "ribbon", "emblem", "finale"] as const
type Still = (typeof STILLS)[number]

function pick(s: ScrollState): Still {
  const y = s.scrollY + s.viewport.h * 0.5
  const sec = (id: keyof ScrollState["sections"]) => s.sections[id]
  const inside = (id: keyof ScrollState["sections"]) => {
    const b = sec(id)
    if (!b) return false
    const el = document.querySelector<HTMLElement>(`[data-section="${id}"]`)
    const top = el ? el.getBoundingClientRect().top + window.scrollY : b.start
    const h = el ? el.offsetHeight : 0
    return y >= top && y < top + h
  }
  const p = (id: keyof ScrollState["sections"]) => s.sections[id]?.progress ?? 0
  const at = (w: [number, number][], x: number) => Math.max(0, w.findIndex(([a, b]) => x >= a && x < b))
  if (inside("problem")) return "problem"
  if (inside("protocol")) return (["molecule", "sphere", "token"] as const)[at(STEP_WINDOWS, p("protocol"))]
  if (inside("terra")) return (["field", "biochar", "substrate"] as const)[at(TERRA_WINDOWS, p("terra"))]
  if (inside("gallery")) return "flora"
  if (inside("paths")) return "paths"
  if (inside("signal")) return "ribbon"
  if (inside("finale")) return p("finale") < 0.4 ? "emblem" : "finale"
  return "hero"
}

export function StillBackdrop() {
  const [still, setStill] = useState<Still>("hero")
  useEffect(() => {
    scrollStore.setState({ loadProgress: 1, sceneReady: true })
    let last: Still = "hero"
    return scrollStore.subscribe((s) => {
      const k = pick(s)
      if (k !== last) {
        last = k
        setStill(k)
      }
    })
  }, [])
  return (
    <div className="mkt-stills" aria-hidden="true">
      {STILLS.map((k) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={k} src={`/marketing/stills/${k}.webp`} alt="" loading={k === "hero" ? "eager" : "lazy"} decoding="async" className={k === still ? "is-on" : ""} />
      ))}
    </div>
  )
}
