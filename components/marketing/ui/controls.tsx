"use client"

import Link from "next/link"
import { useRef, type ReactNode, type PointerEvent as RPointerEvent } from "react"
import { ArrowRight } from "lucide-react"

type Variant = "primary" | "secondary" | "ghost"

/**
 * Pill button. Hover: a 6px magnetic pull toward the cursor and a light sweep.
 * Renders a Next <Link> for internal paths, an <a> for external ones, and a
 * <button> when there is no href.
 */
export function PillButton({
  href,
  onClick,
  children,
  variant = "primary",
  arrow = false,
  className = "",
  size = "md",
}: {
  href?: string
  onClick?: () => void
  children: ReactNode
  variant?: Variant
  arrow?: boolean
  className?: string
  size?: "sm" | "md"
}) {
  const ref = useRef<HTMLElement>(null)
  const onMove = (e: RPointerEvent) => {
    const el = ref.current
    if (!el || e.pointerType !== "mouse") return
    const r = el.getBoundingClientRect()
    const dx = ((e.clientX - r.left) / r.width - 0.5) * 2
    const dy = ((e.clientY - r.top) / r.height - 0.5) * 2
    el.style.transform = `translate(${dx * 6}px, ${dy * 6}px)`
  }
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = ""
  }
  const cls = `mkt-btn mkt-btn-${variant} mkt-btn-${size} ${className}`
  const inner = (
    <>
      <span className="mkt-btn-label">{children}</span>
      {arrow ? <ArrowRight aria-hidden="true" className="mkt-btn-arrow" /> : null}
    </>
  )
  const common = { className: cls, onPointerMove: onMove, onPointerLeave: onLeave, "data-cursor": "hover" }
  if (!href) {
    return (
      <button ref={ref as React.RefObject<HTMLButtonElement>} type="button" onClick={onClick} {...common}>
        {inner}
      </button>
    )
  }
  if (/^https?:/.test(href)) {
    return (
      <a ref={ref as React.RefObject<HTMLAnchorElement>} href={href} target="_blank" rel="noopener noreferrer" {...common}>
        {inner}
      </a>
    )
  }
  return (
    <Link ref={ref as React.RefObject<HTMLAnchorElement>} href={href} onClick={onClick} {...common}>
      {inner}
    </Link>
  )
}
