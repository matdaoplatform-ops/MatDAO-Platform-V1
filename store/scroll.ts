import { createStore } from "zustand/vanilla"
import { useStore } from "zustand"

/**
 * Scroll and scene state shared by the DOM and the 3D world.
 *
 * The 3D reads this with `scrollStore.getState()` inside useFrame — never
 * through React state — so scrolling never re-renders the canvas tree.
 * DOM components that do need to react (nav, preloader) subscribe with
 * `useScrollStore(selector)`.
 */

export type SectionId = "hero" | "problem" | "protocol" | "terra" | "gallery" | "paths" | "signal" | "finale"

export const SECTION_ORDER: SectionId[] = ["hero", "problem", "protocol", "terra", "gallery", "paths", "signal", "finale"]

export interface SectionBox {
  /** Scroll position (px) where the section's top meets the viewport top. */
  start: number
  /** Scroll position (px) where the section's bottom meets the viewport bottom. */
  end: number
  /** 0 → 1 between start and end. */
  progress: number
}

export type Tier = "high" | "mid" | "low"

export interface ScrollState {
  scrollY: number
  /** Smoothed px per frame from Lenis (signed). */
  velocity: number
  /** 0 → 1 over the whole document. */
  progress: number
  viewport: { w: number; h: number }
  sections: Partial<Record<SectionId, SectionBox>>
  /** Pointer in normalised device coordinates (-1..1), y up. */
  pointer: { x: number; y: number; active: boolean }
  /** Preloader finished and the hero is on screen. */
  entered: boolean
  /** The particle engine has built its shapes and drawn a frame. */
  sceneReady: boolean
  /** Load progress shown by the preloader (0..1). */
  loadProgress: number
  reducedMotion: boolean
  tier: Tier
  /** Gallery: index of the card the camera should fly to (-1 = none). */
  galleryTarget: number
  galleryHover: number
}

export const scrollStore = createStore<ScrollState>(() => ({
  scrollY: 0,
  velocity: 0,
  progress: 0,
  viewport: { w: 1, h: 1 },
  sections: {},
  pointer: { x: 0, y: 0, active: false },
  entered: false,
  sceneReady: false,
  loadProgress: 0,
  reducedMotion: false,
  tier: "high",
  galleryTarget: -1,
  galleryHover: -1,
}))

export function useScrollStore<T>(selector: (s: ScrollState) => T): T {
  return useStore(scrollStore, selector)
}

/** Progress of one section (0 before it, 1 after it). */
export function sectionProgress(id: SectionId, s: ScrollState = scrollStore.getState()): number {
  return s.sections[id]?.progress ?? 0
}

/**
 * A point in the story: section id + local progress → absolute scroll px.
 * Used to place morph and camera keys on the real layout.
 */
export function storyToScroll(id: SectionId, at: number, s: ScrollState = scrollStore.getState()): number {
  const box = s.sections[id]
  if (!box) return 0
  return box.start + (box.end - box.start) * at
}
