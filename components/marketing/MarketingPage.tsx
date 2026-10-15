"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import { LocaleProvider, useI18n } from "./i18n"
import { SmoothScroll } from "./SmoothScroll"
import { MarketingNav } from "./MarketingNav"
import { Preloader } from "./Preloader"
import { Cursor } from "./ui/cursor"
import { Hero } from "./sections/Hero"
import { Problem } from "./sections/Problem"
import { Protocol } from "./sections/Protocol"
import { Terra } from "./sections/Terra"
import { Gallery } from "./sections/Gallery"
import { Paths } from "./sections/Paths"
import { Signal } from "./sections/Signal"
import { Finale } from "./sections/Finale"

// The WebGL world is client-only and loaded after first paint, so the hero
// copy renders (and counts for LCP) before any 3D code arrives.
const Experience = dynamic(() => import("./experience/Experience").then((m) => m.Experience), { ssr: false })
const StillBackdrop = dynamic(() => import("./experience/StillBackdrop").then((m) => m.StillBackdrop), { ssr: false })

/** Live film, or still renders for reduced motion / no WebGL (three.js is then never downloaded). */
function Backdrop() {
  const [mode, setMode] = useState<"pending" | "live" | "still">("pending")
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const params = new URLSearchParams(window.location.search)
    let gl = false
    let software = false
    try {
      const c = document.createElement("canvas")
      const ctx = (c.getContext("webgl2") || c.getContext("webgl")) as WebGLRenderingContext | null
      gl = !!ctx
      if (ctx) {
        const info = ctx.getExtension("WEBGL_debug_renderer_info")
        const renderer = String(info ? ctx.getParameter(info.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER))
        // Software rasterisers would play the film as a slideshow: show the stills instead.
        software = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer)
        ctx.getExtension("WEBGL_lose_context")?.loseContext()
      }
    } catch {
      gl = false
    }
    const forced = params.has("tier") || params.has("force3d")
    if (!gl || (software && !forced)) document.documentElement.setAttribute("data-mkt-nowebgl", "")
    setMode(reduced || !gl || (software && !forced) ? "still" : "live")
  }, [])
  if (mode === "live") return <Experience />
  if (mode === "still") return <StillBackdrop />
  return null
}

function Page() {
  const { t, locale, setLocale } = useI18n()
  return (
    <>
      <a href="#main" className="mkt-skip">{t.a11y.skip}</a>
      <div className="mkt-bg" aria-hidden="true" />
      <Backdrop />
      <div className="mkt-glow" aria-hidden="true" />
      <MarketingNav />
      {/* Sections remount on language change so line splits are rebuilt. */}
      <main id="main" key={locale} className="mkt-main">
        <Hero />
        <Problem />
        <Protocol />
        <Terra />
        <Gallery />
        <Paths />
        <Signal />
        <Finale onLocale={setLocale} />
      </main>
      <Cursor />
      <Preloader />
      <SmoothScroll />
    </>
  )
}

export function MarketingPage() {
  return (
    <LocaleProvider>
      <Page />
    </LocaleProvider>
  )
}
