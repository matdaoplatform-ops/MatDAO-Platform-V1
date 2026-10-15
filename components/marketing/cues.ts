"use client"

import { useEffect, type RefObject } from "react"
import gsap from "gsap"
import { SplitText } from "gsap/SplitText"
import { scrollStore, type SectionId } from "@/store/scroll"

gsap.registerPlugin(SplitText)

/**
 * Text cues, declared in markup and keyed to section progress:
 *
 *   <h2 data-cue="lines" data-in="0.05" data-out="0.9">…</h2>
 *
 * `in` / `out` are positions inside the section (0..1). A cue plays its
 * reveal when the section's progress enters [in, out) and reverses when it
 * leaves, so scrolling back rewinds the copy with the film. Reveals are
 * time-based (expo.out, ~1s) rather than scrubbed: type reads better when it
 * lands on its own clock.
 *
 * Types: lines (masked line slide-up) · rise · fade · scramble (mono decode)
 * · glitch (RGB split resolving, Problem section only).
 */

const GLYPHS = "ABCDEF0123456789#+·/<>"

interface Cue {
  update(progress: number, entered: boolean): void
  kill(): void
}

function scramble(node: HTMLElement, final: string, duration = 0.9) {
  const state = { p: 0 }
  return gsap.to(state, {
    p: 1,
    duration,
    ease: "none",
    onUpdate() {
      let out = ""
      for (let i = 0; i < final.length; i++) {
        const ch = final[i]
        const settle = (i / Math.max(1, final.length)) * 0.7 + 0.3
        out += ch === " " || state.p >= settle ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0]
      }
      node.textContent = out
    },
    onComplete() {
      node.textContent = final
    },
  })
}

function buildCue(node: HTMLElement, reduced: boolean): Cue {
  const type = node.dataset.cue || "fade"
  const inAt = Number(node.dataset.in ?? 0)
  const outAt = node.dataset.out === undefined ? 2 : Number(node.dataset.out)
  const delay = Number(node.dataset.delay ?? 0)
  const tl = gsap.timeline({ paused: true, delay })
  let split: SplitText | null = null
  let scrambleTween: gsap.core.Tween | null = null
  const finalText = node.textContent ?? ""

  tl.set(node, { autoAlpha: 1 }, 0)
  if (reduced) {
    tl.fromTo(node, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "none" }, 0)
  } else if (type === "lines") {
    split = SplitText.create(node, { type: "lines", mask: "lines", linesClass: "mkt-line" })
    tl.fromTo(split.lines, { yPercent: 115 }, { yPercent: 0, duration: 1.1, stagger: 0.08, ease: "expo.out" }, 0)
  } else if (type === "rise") {
    tl.fromTo(node, { y: 28, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: "expo.out" }, 0)
  } else if (type === "glitch") {
    const r = node.querySelector<HTMLElement>(".mkt-glitch-r")
    const b = node.querySelector<HTMLElement>(".mkt-glitch-b")
    const main = node.querySelector<HTMLElement>(".mkt-glitch-main")
    const slices = ["inset(0 0 62% 0)", "inset(38% 0 20% 0)", "inset(70% 0 0 0)", "inset(10% 0 55% 0)", "inset(0 0 0 0)"]
    tl.fromTo(node, { opacity: 0 }, { opacity: 1, duration: 0.15, ease: "none" }, 0)
    if (main) tl.fromTo(main, { opacity: 0, x: 0 }, { opacity: 1, duration: 0.5, ease: "steps(5)" }, 0.1)
    if (r) {
      tl.fromTo(r, { x: -22, opacity: 0.9 }, { x: 0, duration: 1.1, ease: "expo.out" }, 0)
      slices.forEach((c, i) => tl.set(r, { clipPath: c }, i * 0.08))
      tl.to(r, { opacity: 0, duration: 0.35 }, 0.85)
    }
    if (b) {
      tl.fromTo(b, { x: 22, opacity: 0.9 }, { x: 0, duration: 1.1, ease: "expo.out" }, 0)
      slices.slice().reverse().forEach((c, i) => tl.set(b, { clipPath: c }, i * 0.08 + 0.04))
      tl.to(b, { opacity: 0, duration: 0.35 }, 0.85)
    }
  } else if (type === "scramble") {
    tl.fromTo(node, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: "none" }, 0)
  } else {
    tl.fromTo(node, { opacity: 0 }, { opacity: 1, duration: 0.9, ease: "expo.out" }, 0)
  }

  let active = false
  return {
    update(p, entered) {
      const want = entered && p >= inAt && p < outAt
      if (want === active) return
      active = want
      if (want) {
        tl.timeScale(1).play()
        if (type === "scramble" && !reduced) {
          scrambleTween?.kill()
          scrambleTween = scramble(node, finalText)
        }
      } else {
        tl.timeScale(1.8).reverse()
      }
    },
    kill() {
      tl.kill()
      scrambleTween?.kill()
      split?.revert()
      node.textContent === "" && (node.textContent = finalText)
    },
  }
}

export function useCues(id: SectionId, root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current
    if (!el) return
    let cues: Cue[] = []
    let unsub = () => {}
    let cancelled = false
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    // Line splitting needs the final fonts, or the line breaks are wrong.
    document.fonts.ready.then(() => {
      if (cancelled) return
      cues = Array.from(el.querySelectorAll<HTMLElement>("[data-cue]")).map((n) => buildCue(n, reduced))
      const apply = () => {
        const s = scrollStore.getState()
        const p = s.sections[id]?.progress ?? 0
        cues.forEach((c) => c.update(p, s.entered))
      }
      apply()
      unsub = scrollStore.subscribe(apply)
    })
    return () => {
      cancelled = true
      unsub()
      cues.forEach((c) => c.kill())
    }
  }, [id, root])
}

/** Call `cb(progress)` whenever the section's progress changes (for scrubbed DOM effects). */
export function useSectionScrub(id: SectionId, cb: (p: number) => void) {
  useEffect(() => {
    let last = -1
    const run = () => {
      const p = scrollStore.getState().sections[id]?.progress ?? 0
      if (p === last) return
      last = p
      cb(p)
    }
    run()
    return scrollStore.subscribe(run)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
}

export const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
