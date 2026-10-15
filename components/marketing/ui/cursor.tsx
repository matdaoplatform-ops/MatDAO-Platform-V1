"use client"

import { useEffect, useRef } from "react"

/** 8px dot + 32px ring that grows over interactive elements. Mouse only. */
export function Cursor() {
  const dot = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return
    document.documentElement.setAttribute("data-mkt-cursor", "")
    let x = -100, y = -100, rx = -100, ry = -100, raf = 0, hover = false, scale = 1
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return
      x = e.clientX
      y = e.clientY
      const t = e.target as HTMLElement | null
      hover = !!t?.closest("a, button, [data-cursor='hover'], summary, input, label")
    }
    const loop = () => {
      rx += (x - rx) * 0.18
      ry += (y - ry) * 0.18
      scale += ((hover ? 1.8 : 1) - scale) * 0.2
      if (dot.current) dot.current.style.transform = `translate3d(${x}px, ${y}px, 0)`
      if (ring.current) ring.current.style.transform = `translate3d(${rx}px, ${ry}px, 0) scale(${scale})`
      raf = requestAnimationFrame(loop)
    }
    window.addEventListener("pointermove", onMove, { passive: true })
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("pointermove", onMove)
      document.documentElement.removeAttribute("data-mkt-cursor")
    }
  }, [])
  return (
    <div className="mkt-cursor" aria-hidden="true">
      <div ref={ring} className="mkt-cursor-ring" />
      <div ref={dot} className="mkt-cursor-dot" />
    </div>
  )
}
