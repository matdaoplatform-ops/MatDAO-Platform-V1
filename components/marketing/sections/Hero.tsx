"use client"

import { useRef } from "react"
import { ArrowDown } from "lucide-react"
import { useI18n } from "../i18n"
import { smooth, useCues, useSectionScrub } from "../cues"
import { AccentText } from "../ui/text"
import { PillButton } from "../ui/controls"
import { LocalClock, Orbitals, Stat } from "../ui/decor"
import { scrollToTarget } from "../SmoothScroll"

/**
 * S1 — Hero (ref C1 layout). The headline is plain, always-visible text so it
 * paints before WebGL (LCP); the rest of the hero cues in once the preloader
 * has opened.
 */
export function Hero() {
  const { t } = useI18n()
  const root = useRef<HTMLElement>(null)
  const title = useRef<HTMLHeadingElement>(null)
  useCues("hero", root)
  // On scroll out the headline lifts away as the camera pushes into the lattice.
  useSectionScrub("hero", (p) => {
    const k = smooth(0.42, 0.85, p)
    if (title.current) {
      title.current.style.transform = k ? `translate3d(0, ${-k * 90}px, 0)` : ""
      title.current.style.opacity = String(1 - k)
    }
  })
  return (
    <section ref={root} id="top" data-section="hero" className="mkt-sec" style={{ height: "170vh" }} aria-labelledby="hero-title">
      <div className="mkt-sticky mkt-hero">
        <Orbitals className="mkt-hero-orbitals" />
        <div className="mkt-hero-top">
          <div className="mkt-hero-copy">
            <h1 ref={title} id="hero-title" className="mkt-display mkt-hero-title">
              <AccentText a={t.hero.headline} />
            </h1>
            <div className="mkt-cta-row" data-cue="rise" data-in="0" data-out="0.55" data-delay="0.25">
              <PillButton href="/submit" variant="primary" arrow>{t.cta.submit}</PillButton>
              <PillButton href="/project" variant="secondary">{t.cta.explore}</PillButton>
            </div>
          </div>
          <p className="mkt-hero-lede mkt-body" data-cue="rise" data-in="0" data-out="0.55" data-delay="0.1">
            {t.hero.lede}
          </p>
        </div>

        <div className="mkt-hero-bottom" data-cue="fade" data-in="0" data-out="0.4" data-delay="0.45">
          <div className="mkt-hero-stamp">
            <LocalClock prefix={t.hero.locale} />
          </div>
          <div className="mkt-stats">
            {t.hero.stats.map((s) => (
              <Stat key={s.label} value={s.value} label={s.label} />
            ))}
          </div>
          <button type="button" className="mkt-chip" onClick={() => scrollToTarget("#problem")} data-cursor="hover">
            <span className="mkt-mono">{t.hero.scroll}</span>
            <ArrowDown aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  )
}
