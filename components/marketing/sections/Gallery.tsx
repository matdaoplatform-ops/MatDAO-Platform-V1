"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { ArrowRight } from "lucide-react"
import type { ProjectCard } from "@/content/en"
import { scrollStore } from "@/store/scroll"
import { useI18n } from "../i18n"
import { useCues, useSectionScrub } from "../cues"
import { AccentText, orDash } from "../ui/text"

/** One research card. Used by the DOM track (mobile, fallback) and inside the 3D corridor. */
export function ResearchCard({ p, labels, dim = false, plain = false }: { p: ProjectCard; labels: { trl: string; funded: string; view: string; sample: string }; dim?: boolean; /** plain <a> (for cards rendered outside the Next router, e.g. inside the 3D corridor) */ plain?: boolean }) {
  return (
    <article className={`mkt-card ${dim ? "is-dim" : ""}`} data-field={p.field}>
      <div className="mkt-card-top">
        <span className="mkt-mono mkt-tag">{p.field}</span>
        {p.placeholder ? <span className="mkt-mono mkt-dim">{labels.sample}</span> : null}
      </div>
      <h3 className="mkt-card-title">{p.title}</h3>
      <p className="mkt-mono mkt-dim mkt-card-inst">{p.institution}</p>
      <div className="mkt-card-meta">
        <span className="mkt-mono">{labels.trl} {orDash(p.trl)}</span>
        <span className="mkt-mono">{labels.funded} {p.funded === null ? "—" : `${Math.round(p.funded * 100)}%`}</span>
      </div>
      <div className="mkt-card-bar" aria-hidden="true">
        <div style={{ transform: `scaleX(${p.funded ?? 0})` }} />
      </div>
      {plain ? (
        <a href="/project" className="mkt-link mkt-card-link" data-cursor="hover">
          {labels.view} <ArrowRight aria-hidden="true" />
        </a>
      ) : (
        <Link href="/project" className="mkt-link mkt-card-link" data-cursor="hover">
          {labels.view} <ArrowRight aria-hidden="true" />
        </Link>
      )}
    </article>
  )
}

/** S5 — Open research. Desktop + WebGL: the cards live in the 3D corridor; otherwise a scrubbed DOM track. */
export function Gallery() {
  const { t } = useI18n()
  const root = useRef<HTMLElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const [filter, setFilter] = useState(0)
  useCues("gallery", root)
  useSectionScrub("gallery", (p) => {
    const el = track.current
    if (!el) return
    const max = Math.max(0, el.scrollWidth - el.clientWidth)
    el.style.transform = `translate3d(${-p * max}px, 0, 0)`
  })
  const labels = { trl: t.gallery.trl, funded: t.gallery.funded, view: t.gallery.view, sample: t.gallery.sample }
  useEffect(() => {
    scrollStore.setState({ galleryLabels: { trl: t.gallery.trl, funded: t.gallery.funded, view: t.gallery.view, sample: t.gallery.sample }, galleryProjects: t.gallery.projects })
  }, [t])
  const fieldOf = (i: number) => (i === 0 ? null : t.gallery.filters[i])
  const pick = (i: number) => {
    setFilter(i)
    const field = fieldOf(i)
    const idx = field ? en_fields(t.gallery.projects).indexOf(field) : 0
    scrollStore.setState({ galleryTarget: Math.max(0, idx), galleryFilter: field })
  }

  return (
    <section ref={root} id="research" data-section="gallery" className="mkt-sec" style={{ height: "300vh" }} aria-labelledby="gallery-title">
      <div className="mkt-sticky mkt-gallery">
        <div className="mkt-gallery-side">
          <p className="mkt-label" data-cue="scramble" data-in="0" data-out="1.01">{t.gallery.label}</p>
          <h2 id="gallery-title" className="mkt-display mkt-h3" data-cue="lines" data-in="0" data-out="1.01">
            <AccentText a={t.gallery.headline} />
          </h2>
          <div className="mkt-filter" data-cue="rise" data-in="0.02" data-out="1.01">
            <p className="mkt-mono mkt-dim">{t.gallery.filterTitle}</p>
            <ul>
              {t.gallery.filters.map((f, i) => (
                <li key={f}>
                  <button type="button" aria-pressed={filter === i} onClick={() => pick(i)} className="mkt-mono" data-cursor="hover">
                    <span className="mkt-filter-mark" aria-hidden="true" />
                    {f}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        {/* Desktop with WebGL: these same cards are drawn in the 3D corridor and this track is hidden. */}
        <div className="mkt-gallery-dom">
          <div ref={track} className="mkt-card-track">
            {t.gallery.projects.map((p, i) => (
              <ResearchCard key={p.id} p={p} labels={labels} dim={filter > 0 && fieldOf(filter) !== p.field && i >= 0} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// Filter labels are localised; project fields stay English keys.
function en_fields(projects: ProjectCard[]) {
  return projects.map((p) => p.field as string)
}
