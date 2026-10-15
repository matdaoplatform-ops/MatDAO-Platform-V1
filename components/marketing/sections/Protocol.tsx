"use client"

import { useEffect, useRef } from "react"
import { scrollStore, storyToScroll } from "@/store/scroll"
import { scrollToTarget } from "../SmoothScroll"
import { useI18n } from "../i18n"
import { useCues, useSectionScrub } from "../cues"
import { AccentText, orDash } from "../ui/text"
import { Marquee } from "../ui/decor"

/** Step windows inside the pinned section (progress 0..1). */
export const STEP_WINDOWS: [number, number][] = [
  [0.0, 0.34],
  [0.34, 0.67],
  [0.67, 1.01],
]

/**
 * S3 — The protocol: three pillars, pinned (ref A3 step row). Each step owns
 * a third of the scroll; the particles morph molecule → data sphere → token.
 */
export function Protocol() {
  const { t } = useI18n()
  const root = useRef<HTMLElement>(null)
  const fill = useRef<HTMLDivElement>(null)
  const rail = useRef<HTMLOListElement>(null)
  useCues("protocol", root)
  useSectionScrub("protocol", (p) => {
    if (fill.current) fill.current.style.transform = `scaleX(${p})`
    const active = STEP_WINDOWS.findIndex(([a, b]) => p >= a && p < b)
    rail.current?.querySelectorAll("li").forEach((li, i) => li.toggleAttribute("data-active", i === active))
  })

  // The one place the page snaps: when scrolling settles inside the pinned
  // steps, ease to the nearest step so a pillar is never left half-morphed.
  useEffect(() => {
    let lastY = -1
    let still = 0
    let snapped = -1
    const centres = [0.17, 0.5, 0.835]
    const id = window.setInterval(() => {
      const s = scrollStore.getState()
      if (s.reducedMotion || !s.entered) return
      if (Math.abs(s.scrollY - lastY) > 0.5) {
        lastY = s.scrollY
        still = 0
        snapped = -1
        return
      }
      if (++still !== 3) return // ~240 ms after scrolling stops
      const p = s.sections.protocol?.progress ?? -1
      if (p <= 0.03 || p >= 0.97) return
      const c = centres.reduce((a, b) => (Math.abs(b - p) < Math.abs(a - p) ? b : a))
      if (Math.abs(c - p) < 0.012 || Math.abs(c - p) > 0.15 || snapped === c) return
      snapped = c
      scrollToTarget(storyToScroll("protocol", c, s), { duration: 0.9 })
    }, 80)
    return () => window.clearInterval(id)
  }, [])

  return (
    <section ref={root} id="protocol" data-section="protocol" className="mkt-sec" style={{ height: "360vh" }} aria-labelledby="protocol-title">
      <div className="mkt-sticky mkt-protocol">
        <div className="mkt-protocol-head">
          <p className="mkt-label" data-cue="scramble" data-in="0" data-out="1.01">{t.protocol.label}</p>
          <h2 id="protocol-title" className="mkt-display mkt-h3" data-cue="lines" data-in="0" data-out="1.01">
            <AccentText a={t.protocol.headline} />
          </h2>
        </div>

        <div className="mkt-rail" aria-hidden="true">
          <ol ref={rail}>
            {t.protocol.steps.map((s) => (
              <li key={s.n} className="mkt-mono">STEP {s.n}</li>
            ))}
          </ol>
          <div className="mkt-rail-track"><div ref={fill} className="mkt-rail-fill" /></div>
        </div>

        <ol className="mkt-steps">
          {t.protocol.steps.map((s, i) => (
            <li key={s.n} className="mkt-step mkt-scrim-left" data-cue="rise" data-in={STEP_WINDOWS[i][0].toFixed(2)} data-out={STEP_WINDOWS[i][1].toFixed(2)}>
              <p className="mkt-mono mkt-dim">STEP {s.n} — {s.tag}</p>
              <h3 className="mkt-display mkt-step-title">{s.title}</h3>
              <p className="mkt-body mkt-step-body">{s.body}</p>
            </li>
          ))}
        </ol>

        <aside className="mkt-readout" data-cue="rise" data-in="0.4" data-out="0.66" aria-label={t.protocol.readout.label}>
          <p className="mkt-mono mkt-readout-label">{t.protocol.readout.label}</p>
          <dl>
            {t.protocol.readout.rows.map((r) => (
              <div key={r.k} className="mkt-readout-row">
                <dt className="mkt-mono mkt-dim" data-cue="scramble" data-in="0.42" data-out="0.66">{r.k}</dt>
                <dd className="mkt-mono">{orDash(r.v)}</dd>
              </div>
            ))}
          </dl>
          <p className="mkt-mono mkt-readout-note">{t.protocol.readout.note}</p>
        </aside>

        <div className="mkt-protocol-marquee" data-cue="fade" data-in="0.02" data-out="1.01">
          <Marquee items={t.protocol.fields} className="mkt-pill-marquee" speed={36} />
        </div>
      </div>
    </section>
  )
}
