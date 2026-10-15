"use client"

import { useControls } from "leva"
import { tuning } from "./tuning"

/** Dev-only tuning panel (?tune). Never imported in production builds. */
export default function DevTuning() {
  useControls("particles", {
    pointSize: { value: tuning.pointSize, min: 0.5, max: 6, step: 0.1, onChange: (v: number) => (tuning.pointSize = v) },
    drift: { value: tuning.drift, min: 0, max: 0.1, step: 0.002, onChange: (v: number) => (tuning.drift = v) },
    flight: { value: tuning.flight, min: 0, max: 1.5, step: 0.05, onChange: (v: number) => (tuning.flight = v) },
    fog: { value: tuning.fog, min: 0, max: 0.1, step: 0.002, onChange: (v: number) => (tuning.fog = v) },
  })
  useControls("post", {
    bloom: { value: tuning.bloom, min: 0, max: 3, step: 0.05, onChange: (v: number) => (tuning.bloom = v) },
  })
  return null
}
