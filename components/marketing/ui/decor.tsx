"use client"

import { useEffect, useState } from "react"
import { orDash } from "./text"

/** Thin rotating orbital circles laid over the 3D (ref C1). Pure SVG + CSS. */
export function Orbitals({ className = "" }: { className?: string }) {
  return (
    <svg className={`mkt-orbitals ${className}`} viewBox="0 0 1000 1000" aria-hidden="true">
      <g className="mkt-orbit mkt-orbit-a">
        <circle cx="500" cy="500" r="430" />
        <circle cx="500" cy="70" r="5" className="mkt-orbit-dot" />
      </g>
      <g className="mkt-orbit mkt-orbit-b">
        <circle cx="560" cy="520" r="300" />
        <circle cx="860" cy="520" r="4" className="mkt-orbit-dot" />
      </g>
      <g className="mkt-orbit mkt-orbit-c">
        <circle cx="430" cy="470" r="190" />
      </g>
      <circle cx="640" cy="560" r="96" className="mkt-orbit-static" />
    </svg>
  )
}

/** Big number + mono caption, with a thin divider on the left (ref C1). */
export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="mkt-stat">
      <div className="mkt-stat-value">{orDash(value)}</div>
      <div className="mkt-mono mkt-dim">{label}</div>
    </div>
  )
}

/** Infinite horizontal marquee (CSS). Children are repeated to fill. */
export function Marquee({ items, separator, className = "", speed = 40 }: { items: string[]; separator?: string; className?: string; speed?: number }) {
  const row = (aria: boolean) => (
    <div className="mkt-marquee-row" aria-hidden={aria || undefined}>
      {items.map((it, i) => (
        <span key={i} className="mkt-marquee-item">
          {it}
          {separator ? <span className="mkt-marquee-sep">{separator}</span> : null}
        </span>
      ))}
    </div>
  )
  return (
    <div className={`mkt-marquee ${className}`} style={{ ["--speed" as string]: `${speed}s` }}>
      <div className="mkt-marquee-track">
        {row(false)}
        {row(true)}
      </div>
    </div>
  )
}

/** Live local time in Bangkok, e.g. "BANGKOK, TH — 14:32". */
export function LocalClock({ prefix }: { prefix: string }) {
  const [time, setTime] = useState("--:--")
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" })
    const tick = () => setTime(fmt.format(new Date()))
    tick()
    const id = window.setInterval(tick, 15_000)
    return () => window.clearInterval(id)
  }, [])
  return (
    <span className="mkt-mono mkt-dim">
      {prefix} — <time suppressHydrationWarning>{time}</time>
    </span>
  )
}
