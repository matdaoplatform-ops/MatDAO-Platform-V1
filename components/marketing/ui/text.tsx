"use client"

import type { ReactNode } from "react"
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
