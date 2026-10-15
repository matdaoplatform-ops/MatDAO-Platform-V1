"use client"

import { useRef } from "react"
import { useI18n } from "../i18n"
import { useCues } from "../cues"
import { AccentText, GlitchText } from "../ui/text"

/** S2 — The gap. The lattice fractures behind a statement and three staggered columns (ref A2). */
export function Problem() {
  const { t } = useI18n()
  const root = useRef<HTMLElement>(null)
  useCues("problem", root)
  return (
    <section ref={root} id="problem" data-section="problem" className="mkt-sec" style={{ height: "190vh" }} aria-labelledby="problem-title">
      <div className="mkt-sticky mkt-problem">
        <div className="mkt-problem-lead mkt-scrim-left">
          <p className="mkt-label" data-cue="scramble" data-in="0.02" data-out="0.96">{t.problem.label}</p>
          <h2 id="problem-title" className="mkt-display mkt-h2" data-cue="lines" data-in="0.06" data-out="0.96">
            <AccentText a={t.problem.headline} />
          </h2>
        </div>
        <ol className="mkt-problem-cols">
          {t.problem.columns.map((c, i) => (
            <li key={c.tag} className="mkt-problem-col" style={{ ["--offset" as string]: `${i * 80}px` }} data-cue="glitch" data-in={(0.22 + i * 0.1).toFixed(2)} data-out="0.96">
              <GlitchText>
                <span className="mkt-mono mkt-tag">{c.tag}</span>
                <span className="mkt-col-title">{c.title}</span>
                <span className="mkt-body mkt-col-body">{c.body}</span>
              </GlitchText>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
