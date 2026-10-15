"use client"

import { useRef } from "react"
import { Check } from "lucide-react"
import { useI18n } from "../i18n"
import { useCues } from "../cues"
import { AccentText } from "../ui/text"
import { PillButton } from "../ui/controls"
import { JoinDaoButton } from "../ui/join-dao"

/** S6 — Two paths: researchers (catalyst) and investors (data). */
export function Paths() {
  const { t } = useI18n()
  const root = useRef<HTMLElement>(null)
  useCues("paths", root)
  const r = t.paths.researchers
  const b = t.paths.investors
  return (
    <section ref={root} id="join" data-section="paths" className="mkt-sec mkt-paths" aria-labelledby="paths-title">
      <h2 id="paths-title" className="mkt-label" data-cue="scramble" data-in="0.15">{t.paths.label}</h2>
      <div className="mkt-paths-grid">
        <article className="mkt-panel mkt-panel-catalyst" data-cue="rise" data-in="0.2">
          <p className="mkt-mono mkt-panel-kicker">{r.kicker}</p>
          <h3 className="mkt-display mkt-panel-title"><AccentText a={r.title} /></h3>
          <ul className="mkt-panel-list">
            {r.bullets.map((x) => (
              <li key={x}><Check aria-hidden="true" />{x}</li>
            ))}
          </ul>
          <PillButton href="/submit" variant="primary" arrow>{t.cta.submit}</PillButton>
        </article>
        <article className="mkt-panel mkt-panel-data" data-cue="rise" data-in="0.26">
          <p className="mkt-mono mkt-panel-kicker">{b.kicker}</p>
          <h3 className="mkt-display mkt-panel-title"><AccentText a={b.title} /></h3>
          <ul className="mkt-panel-list">
            {b.bullets.map((x) => (
              <li key={x}><Check aria-hidden="true" />{x}</li>
            ))}
          </ul>
          <JoinDaoButton variant="secondary" />
        </article>
      </div>
    </section>
  )
}
