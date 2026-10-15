"use client"

import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Bloom, ChromaticAberration, EffectComposer, Noise, Vignette } from "@react-three/postprocessing"
import { BlendFunction, type BloomEffect, type ChromaticAberrationEffect } from "postprocessing"
import * as THREE from "three"
import { scrollStore } from "@/store/scroll"
import { sceneFx } from "./fx"

/**
 * Bloom (mipmap blur), a hair of chromatic aberration that grows during
 * morphs and in the finale, film grain and a vignette.
 */
export function Effects({ tier }: { tier: "high" | "mid" | "low" }) {
  const bloom = useRef<BloomEffect>(null)
  const ca = useRef<ChromaticAberrationEffect>(null)
  const offset = useMemo(() => new THREE.Vector2(0.0004, 0.0003), [])

  useFrame(() => {
    const s = scrollStore.getState()
    const finale = s.sections.finale?.progress ?? 0
    const manifesto = finale > 0 && finale < 0.42 ? 1 : 0
    const t = sceneFx.transition
    const k = 0.00035 + t * 0.0016 + manifesto * 0.0012
    offset.set(k, k * 0.7)
    if (bloom.current) bloom.current.intensity = 1.05 + t * 0.5
  })

  if (tier === "low") {
    return (
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <Bloom ref={bloom} luminanceThreshold={0.2} luminanceSmoothing={0.3} intensity={1.0} mipmapBlur levels={5} />
        <Vignette offset={0.3} darkness={0.65} />
      </EffectComposer>
    )
  }
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom ref={bloom} luminanceThreshold={0.2} luminanceSmoothing={0.25} intensity={1.2} mipmapBlur levels={tier === "high" ? 7 : 6} radius={0.72} />
      <ChromaticAberration ref={ca} offset={offset} radialModulation modulationOffset={0.35} />
      <Noise premultiply blendFunction={BlendFunction.ADD} opacity={0.03} />
      <Vignette offset={0.28} darkness={0.7} />
    </EffectComposer>
  )
}
