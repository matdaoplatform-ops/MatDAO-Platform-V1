"use client"

import { useRef } from "react"
import { useI18n } from "../i18n"
import { useCues } from "../cues"
import { Marquee } from "../ui/decor"

/** S7 — Signal: recognition marquee and the core team (photos grey until hovered). */
export function Signal() {
  const { t } = useI18n()
  const root = useRef<HTMLElement>(null)
  useCues("signal", root)
  return (
    <section ref={root} id="signal" data-section="signal" className="mkt-sec mkt-signal" aria-labelledby="signal-title">
      <h2 id="signal-title" className="mkt-label mkt-signal-label" data-cue="scramble" data-in="0.1">{t.signal.label}</h2>
      <Marquee items={t.signal.recognition} separator="◆" className="mkt-recognition" speed={48} />
      <div className="mkt-team" data-cue="rise" data-in="0.3">
        <h3 className="mkt-mono mkt-dim">{t.signal.teamTitle}</h3>
        <ul>
          {t.signal.team.map((m) => (
            <li key={m.name} className="mkt-member">
              <div className="mkt-member-photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.photo} alt={m.name} width={420} height={400} loading="lazy" decoding="async" />
              </div>
              <p className="mkt-member-name">{m.name}</p>
              <p className="mkt-mono mkt-dim">{m.role}</p>
              <p className="mkt-member-focus">{m.focus}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
