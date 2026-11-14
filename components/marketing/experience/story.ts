import type { SectionId } from "@/store/scroll"
import type { ShapeId, Vec3 } from "./shapes"

/**
 * The film script: where each shape holds and where the camera is, keyed to
 * points in the page (section + local progress). Converted to scroll pixels
 * on the live layout, so retiming a section in CSS retimes the film.
 */

export interface MorphKey {
  s: SectionId
  at: number
  shape: ShapeId
}

/** Consecutive keys with the same shape = hold; different shapes = morph. */
export const MORPH_KEYS: MorphKey[] = [
  { s: "hero", at: 0, shape: "lattice" },
  { s: "hero", at: 0.5, shape: "lattice" },
  { s: "problem", at: 0.22, shape: "shards" },
  { s: "problem", at: 0.82, shape: "shards" },
  { s: "protocol", at: 0.08, shape: "molecule" },
  { s: "protocol", at: 0.26, shape: "molecule" },
  { s: "protocol", at: 0.4, shape: "sphere" },
  { s: "protocol", at: 0.6, shape: "sphere" },
  { s: "protocol", at: 0.74, shape: "token" },
  { s: "protocol", at: 0.98, shape: "token" },
  { s: "terra", at: 0.02, shape: "field" },
  { s: "terra", at: 0.3, shape: "field" },
  { s: "terra", at: 0.48, shape: "biochar" },
  { s: "terra", at: 0.62, shape: "biochar" },
  { s: "terra", at: 0.78, shape: "substrate" },
  { s: "terra", at: 0.98, shape: "substrate" },
  { s: "gallery", at: 0.0, shape: "flora" },
  { s: "gallery", at: 0.97, shape: "flora" },
  { s: "paths", at: 0.32, shape: "paths" },
  { s: "paths", at: 0.78, shape: "paths" },
  { s: "signal", at: 0.38, shape: "ribbon" },
  { s: "signal", at: 0.75, shape: "ribbon" },
  { s: "finale", at: 0.04, shape: "emblem" },
  { s: "finale", at: 0.32, shape: "emblem" },
  { s: "finale", at: 0.56, shape: "finale" },
  { s: "finale", at: 1, shape: "finale" },
]

export interface CamKey {
  s: SectionId
  at: number
  pos: Vec3
  look: Vec3
  fov?: number
  /** Constant speed from this key to the next (no ease-in/out beat). */
  linear?: boolean
}

/**
 * Camera path. Shapes sit right of centre (copy lives on the left), so the
 * camera aims a little left of each anchor.
 */
export const CAM_KEYS: CamKey[] = [
  { s: "hero", at: 0, pos: [0, 0.3, 9.6], look: [0.1, -0.15, 0] },
  { s: "hero", at: 0.45, pos: [0.15, 0.25, 8.4], look: [0.25, -0.15, 0] },
  { s: "hero", at: 0.95, pos: [1.0, 0.15, 2.6], look: [1.3, -0.1, -3] },
  { s: "problem", at: 0.45, pos: [-0.6, 0.45, 2.2], look: [0.9, 0, -6] },
  { s: "problem", at: 0.95, pos: [-0.2, 0.5, -1.2], look: [0.8, 0, -9] },
  { s: "protocol", at: 0.1, pos: [-0.2, 0.35, -7.2], look: [0.75, 0.05, -15] },
  { s: "protocol", at: 0.5, pos: [0.15, 0.25, -7.6], look: [0.95, 0.05, -15] },
  { s: "protocol", at: 0.95, pos: [-0.1, 0.1, -7.9], look: [0.9, -0.05, -15] },
  { s: "terra", at: 0.04, pos: [0, 3.2, -18.5], look: [0.2, -1.6, -26] },
  { s: "terra", at: 0.28, pos: [0.3, -0.9, -21.5], look: [0.4, -1.5, -28] },
  { s: "terra", at: 0.52, pos: [0.25, 0.1, -24.5], look: [1.0, -0.1, -31] },
  { s: "terra", at: 0.95, pos: [0.1, 0.25, -24.9], look: [0.95, -0.1, -31] },
  { s: "gallery", at: 0.0, pos: [-0.55, 0.05, -34], look: [0.45, 0, -44], linear: true },
  { s: "gallery", at: 0.98, pos: [-0.55, 0.05, -55.5], look: [0.45, 0, -66] },
  { s: "paths", at: 0.45, pos: [0, 0.25, -56.2], look: [0, 0, -63] },
  { s: "signal", at: 0.5, pos: [0, 0.3, -63.8], look: [0, 0, -71] },
  { s: "finale", at: 0.06, pos: [0, 0.05, -72.6], look: [0, 0.1, -79] },
  { s: "finale", at: 0.34, pos: [0, 0.05, -73.6], look: [0, 0.1, -79] },
  { s: "finale", at: 0.6, pos: [0, 0.7, -81.6], look: [0, -0.1, -90] },
  { s: "finale", at: 1, pos: [0, 0.45, -82.6], look: [0, 0.05, -90] },
]
