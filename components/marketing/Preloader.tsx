"use client"

import { useEffect, useRef, useState } from "react"
import gsap from "gsap"
import { scrollStore } from "@/store/scroll"
import { useI18n } from "./i18n"
import { lockScroll } from "./SmoothScroll"

const MIN_MS = 1400 // never flash
const MAX_MS = 7000 // never hold the page hostage to a slow GPU

/**
 * S0 — Preloader (dark). Counter 000→100 bottom-right, a 1px catalyst→data
 * line across the bottom, a scrambling mono label. The count follows real
 * readiness (fonts + particle shapes) but is eased so it never jumps. At 100
 * the counter flies up and the screen splits open.
 */
export function Preloader() {
  const { t } = useI18n()
  const root = useRef<HTMLDivElement>(null)
  const num = useRef<HTMLSpanElement>(null)
  const line = useRef<HTMLDivElement>(null)
  const label = useRef<HTMLSpanElement>(null)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    window.scrollTo(0, 0)
    lockScroll(true)
    const t0 = performance.now()
    let shown = 0
    let fontsReady = false
    document.fonts.ready.then(() => (fontsReady = true))
    const final = label.current?.textContent ?? ""
    const glyphs = "ABCDEF0123456789#+"
    let raf = 0
    let done = false

    const finish = () => {
      done = true
      const tl = gsap.timeline({
        onComplete: () => {
          setGone(true)
          lockScroll(false)
        },
      })
      if (reduced) {
        tl.to(root.current, { autoAlpha: 0, duration: 0.4 })
        scrollStore.setState({ entered: true })
        return
      }
      tl.to(num.current, { yPercent: -120, opacity: 0, duration: 0.6, ease: "expo.in" }, 0)
        .to(line.current, { scaleX: 0, transformOrigin: "100% 50%", duration: 0.5, ease: "expo.in" }, 0)
        .to(label.current, { opacity: 0, duration: 0.3 }, 0)
        .add(() => scrollStore.setState({ entered: true }), 0.55)
        .to(".mkt-pre-half-top", { yPercent: -100, duration: 1.1, ease: "expo.inOut" }, 0.45)
        .to(".mkt-pre-half-bottom", { yPercent: 100, duration: 1.1, ease: "expo.inOut" }, 0.45)
    }

    const tick = (now: number) => {
      const s = scrollStore.getState()
      const elapsed = now - t0
      // Target: real readiness (scene + fonts), but at least a gentle time ramp.
      const ready = (s.sceneReady || s.loadProgress >= 1) && fontsReady
      const real = Math.max(s.loadProgress * 0.9 + (fontsReady ? 0.1 : 0), Math.min(0.85, elapsed / 2400))
      const target = ready && elapsed > MIN_MS ? 1 : elapsed > MAX_MS ? 1 : Math.min(0.97, real)
      shown += (target - shown) * 0.08
      if (target === 1 && shown > 0.995) shown = 1
      const n = Math.round(shown * 100)
      if (num.current) num.current.textContent = String(n).padStart(3, "0")
      if (line.current) line.current.style.transform = `scaleX(${shown})`
      if (label.current && !reduced && shown < 1) {
        let out = ""
        for (let i = 0; i < final.length; i++) out += final[i] === " " || Math.random() > 0.25 + shown * 0.75 ? (Math.random() > 0.85 ? glyphs[(Math.random() * glyphs.length) | 0] : final[i]) : final[i]
        label.current.textContent = out
      }
      if (shown >= 1 && !done) {
        if (label.current) label.current.textContent = final
        finish()
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      lockScroll(false)
    }
  }, [])

  if (gone) return null
  return (
    <div ref={root} className="mkt-pre" role="status" aria-live="polite" aria-label="Loading">
      <div className="mkt-pre-half mkt-pre-half-top" />
      <div className="mkt-pre-half mkt-pre-half-bottom" />
      <span ref={label} className="mkt-mono mkt-pre-label">{t.preloader.label}</span>
      <span ref={num} className="mkt-pre-num">000</span>
      <div ref={line} className="mkt-pre-line" />
    </div>
  )
}
