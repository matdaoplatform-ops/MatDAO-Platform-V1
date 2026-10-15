"use client"

import { useEffect, useState } from "react"
import { Canvas } from "@react-three/fiber"
import { scrollStore, useScrollStore, type Tier } from "@/store/scroll"
import { World } from "./World"
import { Effects } from "./Effects"
import { Sets } from "./Sets"
import { Corridor } from "./Corridor"

const COUNTS: Record<Tier, number> = { high: 80_000, mid: 60_000, low: 36_000 }

function hasWebGL() {
  try {
    const c = document.createElement("canvas")
    return !!(c.getContext("webgl2") || c.getContext("webgl"))
  } catch {
    return false
  }
}

/** Device tier from cores, memory, screen and (when it answers in time) detect-gpu. */
async function detectTier(): Promise<Tier> {
  // Manual override for testing: ?tier=high|mid|low
  const forced = new URLSearchParams(window.location.search).get("tier")
  if (forced === "high" || forced === "mid" || forced === "low") return forced
  const mobile = window.matchMedia("(max-width: 767px)").matches || /Mobi|Android|iPhone/i.test(navigator.userAgent)
  const cores = navigator.hardwareConcurrency || 4
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8
  let tier: Tier = mobile ? "low" : cores >= 8 && mem >= 8 ? "high" : "mid"
  try {
    const { getGPUTier } = await import("detect-gpu")
    const gpu = await Promise.race([getGPUTier(), new Promise<null>((r) => setTimeout(() => r(null), 1500))])
    if (gpu && gpu.tier <= 1) tier = "low"
    else if (gpu && gpu.tier === 2 && tier === "high") tier = "mid"
  } catch {
    /* keep the heuristic */
  }
  return tier
}

/**
 * The one fixed WebGL canvas behind the page. Mounted once; reads all scroll
 * state from the store inside useFrame. Renders on demand while the preloader
 * is up, continuously after, and not at all while the tab is hidden.
 */
export function Experience() {
  const [tier, setTier] = useState<Tier | null>(null)
  const [visible, setVisible] = useState(true)
  const entered = useScrollStore((s) => s.entered)
  const reduced = useScrollStore((s) => s.reducedMotion)

  useEffect(() => {
    if (!hasWebGL()) {
      document.documentElement.setAttribute("data-mkt-nowebgl", "")
      scrollStore.setState({ loadProgress: 1, sceneReady: true })
      return
    }
    detectTier().then((t) => {
      scrollStore.setState({ tier: t })
      setTier(t)
    })
    const onVis = () => setVisible(!document.hidden)
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [])

  if (!tier) return null
  const corridor = tier !== "low" && window.matchMedia("(min-width: 900px)").matches
  const frameloop = !visible ? "never" : entered && !reduced ? "always" : "demand"
  return (
    <Canvas
      className="mkt-canvas"
      dpr={tier === "low" ? [1, 1.5] : [1, 1.75]}
      gl={{ antialias: false, powerPreference: "high-performance", alpha: false, stencil: false }}
      camera={{ fov: 35, near: 0.05, far: 160, position: [0, 0.35, 8.8] }}
      frameloop={frameloop}
      onCreated={({ gl, scene }) => {
        gl.setClearColor("#05070d", 1)
        scene.background = null
        document.documentElement.setAttribute("data-mkt-webgl", "")
      }}
    >
      <fogExp2 attach="fog" args={["#05070d", 0.028]} />
      <World count={COUNTS[tier]} />
      <Sets tier={tier} />
      {corridor ? <Corridor /> : null}
      <Effects tier={tier} />
    </Canvas>
  )
}
