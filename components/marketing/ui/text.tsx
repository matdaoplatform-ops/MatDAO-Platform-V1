"use client"

import { useEffect, useRef, type ElementType, type ReactNode } from "react"
import type { Accent } from "@/content/en"

/** Headline with at most one italic-serif accent word. */
export function AccentText({ a }: { a: Accent }) {
  return (
    <>
      {a.pre}
      {a.accent ? <em className="mkt-accent">{a.accent}</em> : null}
      {a.post}
    </>
  )
}

/** "—" for any value the team has not confirmed yet. */
export function orDash(v: string | number | null | undefined) {
  return v === "" || v === null || v === undefined ? "—" : String(v)
}

const GLYPHS = "ABCDEF0123456789#+·/<>"

/**
 * Decode effect for mono labels: characters cycle through glyphs and settle
 * left to right. Runs when `play` turns true; shows the final text otherwise
 * (and always for reduced motion / no JS).
 */
export function Scramble({
  text,
  play,
  as: Tag = "span",
  className,
  duration = 900,
}: {
  text: string
  play: boolean
  as?: ElementType
  className?: string
  duration?: number
}) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!play || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = text
      return
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration)
      let out = ""
      for (let i = 0; i < text.length; i++) {
        const ch = text[i]
        const settle = (i / Math.max(1, text.length)) * 0.7 + 0.3
        if (ch === " " || p >= settle) out += ch
        else out += GLYPHS[(Math.random() * GLYPHS.length) | 0]
      }
      el.textContent = out
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [play, text, duration])
  return (
    <Tag ref={ref} className={className} aria-label={text}>
      {text}
    </Tag>
  )
}

/**
 * RGB-split glitch that resolves into crisp text (Problem section only).
 * Three stacked copies; the red and blue ones start offset and sliced, then
 * converge onto the white one. Driven by the `data-cue="glitch"` runner.
 */
export function GlitchText({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={`mkt-glitch ${className ?? ""}`}>
      <span className="mkt-glitch-r" aria-hidden="true">{children}</span>
      <span className="mkt-glitch-b" aria-hidden="true">{children}</span>
      <span className="mkt-glitch-main">{children}</span>
    </span>
  )
}
