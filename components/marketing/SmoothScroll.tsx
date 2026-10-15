"use client"

import { useEffect } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import Lenis from "lenis"
import { scrollStore, SECTION_ORDER, type SectionBox, type SectionId } from "@/store/scroll"

gsap.registerPlugin(ScrollTrigger)

let lenisInstance: Lenis | null = null
/** Smooth-scroll to a y position or element (falls back to native scrolling). */
export function scrollToTarget(target: number | string | HTMLElement, opts: { immediate?: boolean; duration?: number } = {}) {
  if (lenisInstance) {
    lenisInstance.scrollTo(target, { duration: opts.duration ?? 1.6, immediate: opts.immediate, easing: (t: number) => 1 - Math.pow(1 - t, 4) })
    return
  }
  const y = typeof target === "number" ? target : (typeof target === "string" ? document.querySelector<HTMLElement>(target) : target)?.getBoundingClientRect().top ?? 0
  window.scrollTo({ top: typeof target === "number" ? target : window.scrollY + y, behavior: opts.immediate ? "auto" : "smooth" })
}
export function lockScroll(lock: boolean) {
  if (!lenisInstance) return
  if (lock) lenisInstance.stop()
  else lenisInstance.start()
}

/**
 * Lenis smoothing on top of native scroll, synced to GSAP's ticker, plus the
 * section tracker: every [data-section] element gets a start/end in scroll
 * px and a 0→1 progress, written to the scroll store each frame.
 *
 * No scroll-jacking: the page scrolls natively; Lenis only smooths it.
 */
export function SmoothScroll() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    scrollStore.setState({ reducedMotion: reduced })

    const lenis = reduced
      ? null
      : new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, touchMultiplier: 1.4, smoothWheel: true, syncTouch: false })
    lenisInstance = lenis

    let boxes: { id: SectionId; el: HTMLElement; start: number; end: number }[] = []
    const measure = () => {
      const vh = window.innerHeight
      boxes = SECTION_ORDER.map((id) => {
        const el = document.querySelector<HTMLElement>(`[data-section="${id}"]`)
        if (!el) return null
        const top = el.getBoundingClientRect().top + window.scrollY
        const h = el.offsetHeight
        // Tall (sticky) sections: progress runs while the section is pinned.
        // Short sections: progress runs while the section crosses the viewport.
        const start = h > vh ? top : top - vh
        const end = h > vh ? top + h - vh : top + h
        return { id, el, start, end: Math.max(start + 1, end) }
      }).filter(Boolean) as typeof boxes
      scrollStore.setState({ viewport: { w: window.innerWidth, h: vh } })
      update()
    }

    let lastY = window.scrollY
    const update = () => {
      const y = window.scrollY
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      const sections: Partial<Record<SectionId, SectionBox>> = {}
      for (const b of boxes) {
        sections[b.id] = { start: b.start, end: b.end, progress: Math.min(1, Math.max(0, (y - b.start) / (b.end - b.start))) }
      }
      const velocity = lenis ? lenis.velocity : y - lastY
      lastY = y
      scrollStore.setState({ scrollY: y, progress: y / max, velocity, sections })
    }

    const raf = (time: number) => {
      lenis?.raf(time * 1000)
    }
    if (lenis) {
      lenis.on("scroll", () => {
        ScrollTrigger.update()
        update()
      })
      gsap.ticker.add(raf)
      gsap.ticker.lagSmoothing(0)
    } else {
      window.addEventListener("scroll", update, { passive: true })
    }

    const ro = new ResizeObserver(() => {
      measure()
      ScrollTrigger.refresh()
    })
    ro.observe(document.body)
    window.addEventListener("resize", measure)
    ScrollTrigger.addEventListener("refresh", measure)
    measure()

    // Pointer, shared with the 3D (mouse parallax / repulsion).
    const onPointer = (e: PointerEvent) => {
      scrollStore.setState({
        pointer: { x: (e.clientX / window.innerWidth) * 2 - 1, y: -((e.clientY / window.innerHeight) * 2 - 1), active: e.pointerType === "mouse" },
      })
    }
    window.addEventListener("pointermove", onPointer, { passive: true })

    // Dev aid: log section progress (stripped from production builds).
    let logTimer = 0
    if (process.env.NODE_ENV !== "production") {
      ;(window as unknown as { __mkt: unknown }).__mkt = { store: scrollStore, lenis }
      const log = () => {
        const s = scrollStore.getState().sections
        console.debug("[mkt] progress", Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v?.progress.toFixed(2)])))
      }
      logTimer = window.setInterval(log, 4000)
    }

    return () => {
      window.clearInterval(logTimer)
      ro.disconnect()
      window.removeEventListener("resize", measure)
      window.removeEventListener("scroll", update)
      window.removeEventListener("pointermove", onPointer)
      ScrollTrigger.removeEventListener("refresh", measure)
      gsap.ticker.remove(raf)
      lenis?.destroy()
      lenisInstance = null
    }
  }, [])
  return null
}
