"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ChevronDown } from "lucide-react"
import { scrollStore } from "@/store/scroll"
import { useI18n } from "./i18n"
import { scrollToTarget } from "./SmoothScroll"

/**
 * Marketing navbar: logo left, frosted-glass pill centre, Login + Launch App
 * right. Dropdowns open on hover and keyboard focus with CSS alone, and the
 * phone menu is a <details>, so navigation works without JavaScript.
 * Hides while scrolling down, shows on scroll up.
 */
export function MarketingNav() {
  const { t } = useI18n()
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    let last = 0
    return scrollStore.subscribe((s) => {
      const y = s.scrollY
      const down = y > last + 4
      const up = y < last - 4
      if (down && y > 160) setHidden(true)
      else if (up || y < 80) setHidden(false)
      if (down || up) last = y
    })
  }, [])

  const anchor = (id: string) => (e: React.MouseEvent) => {
    const el = document.getElementById(id)
    if (!el) return
    e.preventDefault()
    scrollToTarget(el)
  }

  return (
    <header className={`mkt-nav ${hidden ? "is-hidden" : ""}`}>
      <Link href="/" className="mkt-nav-logo" aria-label="MatDAO home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/marketing/matdao-logo.png" alt="MatDAO" width={140} height={37} />
      </Link>

      <nav className="mkt-nav-pill" aria-label="Main">
        <div className="mkt-nav-dd">
          <button type="button" className="mkt-nav-link" aria-haspopup="true">
            {t.nav.research} <ChevronDown aria-hidden="true" />
          </button>
          <div className="mkt-nav-menu">
            {t.nav.researchItems.map((l) => (
              <Link key={l.href} href={l.href}>{l.label}</Link>
            ))}
          </div>
        </div>
        <a href="#protocol" className="mkt-nav-link" onClick={anchor("protocol")}>{t.nav.how}</a>
        <a href="#terra" className="mkt-nav-link" onClick={anchor("terra")}>{t.nav.terra}</a>
        <div className="mkt-nav-dd">
          <button type="button" className="mkt-nav-link" aria-haspopup="true">
            {t.nav.dao} <ChevronDown aria-hidden="true" />
          </button>
          <div className="mkt-nav-menu">
            {t.nav.daoItems.map((l) => (
              <Link key={l.href} href={l.href}>{l.label}</Link>
            ))}
          </div>
        </div>
        <Link href="/guide" className="mkt-nav-link">{t.nav.docs}</Link>
      </nav>

      <div className="mkt-nav-right">
        <Link href="/auth/sign-in" className="mkt-nav-login">{t.nav.login}</Link>
        {/* TODO: confirm route — /project is the public research list; switch to the app home if one is added. */}
        <Link href="/project" className="mkt-btn mkt-btn-secondary mkt-btn-sm">
          <span className="mkt-btn-label">{t.nav.launch}</span>
        </Link>
      </div>

      <details className="mkt-nav-mobile">
        <summary aria-label={t.nav.menu}>
          <span />
          <span />
        </summary>
        <div className="mkt-nav-sheet">
          {[...t.nav.researchItems, ...t.nav.daoItems].map((l) => (
            <Link key={l.href} href={l.href}>{l.label}</Link>
          ))}
          <a href="#protocol">{t.nav.how}</a>
          <a href="#terra">{t.nav.terra}</a>
          <Link href="/guide">{t.nav.docs}</Link>
          <Link href="/auth/sign-in">{t.nav.login}</Link>
          <Link href="/project" className="mkt-btn mkt-btn-primary mkt-btn-md"><span className="mkt-btn-label">{t.nav.launch}</span></Link>
        </div>
      </details>
    </header>
  )
}
