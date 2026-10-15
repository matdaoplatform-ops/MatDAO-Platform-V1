"use client"

import Link from "next/link"
import { useRef } from "react"
import { ArrowRight } from "lucide-react"
import { useI18n } from "../i18n"
import { useCues, useSectionScrub } from "../cues"
import { AccentText } from "../ui/text"

export const TERRA_WINDOWS: [number, number][] = [
  [0.0, 0.36],
  [0.36, 0.68],
  [0.68, 1.01],
]

/** S4 — Pilot project: Terra. Water hyacinth → biochar → substrate (ref B2 particle field). */
export function Terra() {
  const { t } = useI18n()
  const root = useRef<HTMLElement>(null)
  const list = useRef<HTMLOListElement>(null)
  useCues("terra", root)
  useSectionScrub("terra", (p) => {
    const active = TERRA_WINDOWS.findIndex(([a, b]) => p >= a && p < b)
    list.current?.querySelectorAll(":scope > li").forEach((li, i) => li.toggleAttribute("data-active", i === active))
  })
  return (
    <section ref={root} id="terra" data-section="terra" className="mkt-sec" style={{ height: "270vh" }} aria-labelledby="terra-title">
      <div className="mkt-sticky mkt-terra">
        <div className="mkt-terra-col mkt-scrim-left">
          <p className="mkt-label" data-cue="scramble" data-in="0" data-out="1.01">{t.terra.label}</p>
          <h2 id="terra-title" className="mkt-display mkt-h3" data-cue="lines" data-in="0" data-out="1.01">
            <AccentText a={t.terra.headline} />
          </h2>
          <ol ref={list} className="mkt-terra-states" data-cue="rise" data-in="0.02" data-out="1.01">
            {t.terra.states.map((s) => (
              <li key={s.n} className="mkt-terra-state">
                <span className="mkt-mono mkt-terra-n">{s.n}</span>
                <span className="mkt-mono mkt-tag">{s.tag}</span>
                <p className="mkt-body">{s.body}</p>
              </li>
            ))}
          </ol>
          <div className="mkt-terra-foot" data-cue="rise" data-in="0.1" data-out="1.01">
            <span className="mkt-badge">
              <span className="mkt-badge-dot" />
              <span className="mkt-mono">{t.terra.pilot}</span>
            </span>
            <p className="mkt-mono mkt-dim mkt-terra-lab">{t.terra.badge}</p>
            <Link href={t.terra.ctaHref} className="mkt-link" data-cursor="hover">
              {t.terra.cta} <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
