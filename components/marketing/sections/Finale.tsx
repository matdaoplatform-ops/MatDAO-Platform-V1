"use client"

import Link from "next/link"
import { useRef } from "react"
import { ChevronUp } from "lucide-react"
import { useI18n } from "../i18n"
import { smooth, useCues, useSectionScrub } from "../cues"
import { AccentText } from "../ui/text"
import { PillButton } from "../ui/controls"
import { JoinDaoButton } from "../ui/join-dao"
import { scrollToTarget } from "../SmoothScroll"

/**
 * S8 — Finale. Manifesto "FROM ATOM / TO ASSET" with the emblem ring in front
 * (ref B3), then a framed window grows to full screen over the final scene
 * (ref A4), with the closing CTA and the footer laid over it.
 */
export function Finale({ onLocale }: { onLocale: (l: "en" | "th") => void }) {
  const { t, locale } = useI18n()
  const root = useRef<HTMLElement>(null)
  const win = useRef<HTMLDivElement>(null)
  const manifesto = useRef<HTMLDivElement>(null)
  useCues("finale", root)
  useSectionScrub("finale", (p) => {
    const m = manifesto.current
    if (m) {
      const out = smooth(0.3, 0.42, p)
      m.style.opacity = String(1 - out)
      m.style.transform = `scale(${1 + out * 0.08})`
    }
    const w = win.current
    if (w) {
      const show = smooth(0.34, 0.42, p)
      const grow = smooth(0.42, 0.7, p)
      w.style.opacity = String(show)
      w.style.setProperty("--grow", String(grow))
    }
  })

  return (
    <section ref={root} id="finale" data-section="finale" className="mkt-sec" style={{ height: "260vh" }} aria-labelledby="finale-title">
      <div className="mkt-sticky mkt-finale">
        <div ref={manifesto} className="mkt-manifesto">
          <p className="mkt-manifesto-text" aria-label={t.finale.manifesto.join(" ")}>
            {t.finale.manifesto.map((l) => (
              <span key={l} className="mkt-ca" data-text={l} aria-hidden="true">{l}</span>
            ))}
          </p>
          <p className="mkt-mono mkt-manifesto-note" data-cue="fade" data-in="0.04" data-out="0.32">{t.finale.manifestoNote}</p>
        </div>

        <div ref={win} className="mkt-window" aria-hidden="true">
          <div className="mkt-window-frame" />
        </div>

        <div className="mkt-finale-cta">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/marketing/matdao-logo.png" alt="" width={180} height={48} data-cue="fade" data-in="0.68" />
          <h2 id="finale-title" className="mkt-display mkt-h2 mkt-center" data-cue="lines" data-in="0.7">
            <AccentText a={t.finale.headline} />
          </h2>
          <div className="mkt-cta-row mkt-center" data-cue="rise" data-in="0.74">
            <PillButton href="/submit" variant="primary" arrow>{t.cta.submit}</PillButton>
            <JoinDaoButton variant="secondary" />
          </div>
        </div>

        <footer className="mkt-footer" data-cue="rise" data-in="0.8">
          <div className="mkt-footer-cols">
            {t.footer.columns.map((c) => (
              <div key={c.title}>
                <p className="mkt-mono mkt-dim">{c.title}</p>
                <ul>
                  {c.links.map((l) => (
                    <li key={l.label}>
                      {l.href ? (
                        <Link href={l.href}>{l.label}</Link>
                      ) : (
                        <span className="mkt-soon" title={t.footer.soon}>{l.label}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mkt-footer-bottom">
            <span className="mkt-mono mkt-dim">{t.footer.copyright}</span>
            <div className="mkt-lang" role="group" aria-label={t.a11y.language}>
              <button type="button" aria-pressed={locale === "en"} onClick={() => onLocale("en")} className="mkt-mono">EN</button>
              <span aria-hidden="true">/</span>
              <button type="button" aria-pressed={locale === "th"} onClick={() => onLocale("th")} className="mkt-mono">TH</button>
            </div>
            <button type="button" className="mkt-top" onClick={() => scrollToTarget(0, { duration: 3.2 })} data-cursor="hover">
              <ChevronUp aria-hidden="true" />
              <span className="mkt-mono">{t.footer.top}</span>
            </button>
          </div>
        </footer>
      </div>
    </section>
  )
}
