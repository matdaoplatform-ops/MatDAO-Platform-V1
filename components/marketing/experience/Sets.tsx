"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Environment, Lightformer, MeshReflectorMaterial, MeshTransmissionMaterial, Text } from "@react-three/drei"
import * as THREE from "three"
import { scrollStore, type ScrollState, type Tier } from "@/store/scroll"
import { ANCHOR } from "./shapes"

/**
 * Set pieces around the particles: glass sample spheres (hero), the mirror
 * floor (hero, token, finale), the halo arch (token), and the manifesto
 * text with the glass ring in front (finale). Each is mounted only while its
 * scene is on screen — transmission and reflection both re-render the scene.
 */

type Active = { hero: boolean; token: boolean; manifesto: boolean; finale: boolean }

function activeFrom(s: ScrollState): Active {
  const p = (id: keyof ScrollState["sections"]) => s.sections[id]?.progress ?? 0
  const y = s.scrollY
  const hero = !s.sections.problem || y < (s.sections.problem.start - s.viewport.h * 0.2)
  const proto = p("protocol")
  const token = proto > 0.6 && (s.sections.terra ? y < s.sections.terra.start - s.viewport.h * 0.3 : true)
  const f = p("finale")
  const inFinale = !!s.sections.finale && y > s.sections.finale.start - s.viewport.h * 0.6
  return { hero, token, manifesto: inFinale && f < 0.5, finale: inFinale && f > 0.32 }
}

export function Sets({ tier }: { tier: Tier }) {
  const [active, setActive] = useState<Active>(() => activeFrom(scrollStore.getState()))
  useEffect(() => {
    let last = JSON.stringify(active)
    return scrollStore.subscribe((s) => {
      const a = activeFrom(s)
      const k = JSON.stringify(a)
      if (k !== last) {
        last = k
        setActive(a)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const glass = tier !== "low"

  return (
    <>
      {/* Procedural studio for reflections: no HDRI download. */}
      <Environment resolution={128} frames={1} background={false}>
        <Lightformer form="rect" intensity={2.2} color="#ffb15c" position={[4, 3, 2]} scale={[3, 1, 1]} />
        <Lightformer form="rect" intensity={2.6} color="#38e1ff" position={[-4, 1, 3]} scale={[2, 4, 1]} />
        <Lightformer form="ring" intensity={1.4} color="#ffffff" position={[0, 4, -3]} scale={2} />
        <Lightformer form="rect" intensity={0.8} color="#5b7cff" position={[0, -3, 4]} scale={[6, 1, 1]} />
      </Environment>

      {active.hero ? <HeroGlass glass={glass} /> : null}
      {active.hero ? <Floor at={[ANCHOR.lattice[0], -2.25, ANCHOR.lattice[2] - 2]} quality={tier} /> : null}
      {active.token ? <Floor at={[ANCHOR.token[0], -1.78, ANCHOR.token[2]]} quality={tier} /> : null}
      {active.token ? <Halo /> : null}
      {active.manifesto ? <Manifesto glass={glass} /> : null}
      {active.finale ? <Floor at={[ANCHOR.finale[0], -2.6, ANCHOR.finale[2]]} quality={tier} /> : null}
      {active.finale ? <GodRays /> : null}
    </>
  )
}

/* ------------------------------------------------------------- glass */

function GlassBall({ position, radius, glass, phase }: { position: [number, number, number]; radius: number; glass: boolean; phase: number }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.elapsedTime + phase
    ref.current.position.set(position[0] + Math.sin(t * 0.3) * 0.08, position[1] + Math.sin(t * 0.5) * 0.12, position[2])
  })
  if (!glass) return <FakeGlass position={position} radius={radius} />
  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[radius, 64, 48]} />
      <MeshTransmissionMaterial
        samples={6}
        resolution={512}
        thickness={0.4}
        chromaticAberration={0.06}
        anisotropy={0.2}
        roughness={0.02}
        ior={1.25}
        distortion={0.12}
        distortionScale={0.4}
        temporalDistortion={0.06}
        color="#ffffff"
        envMapIntensity={0.6}
      />
    </mesh>
  )
}

/** Phones: a sprite that reads as a glass bead (rim light + soft core), no transmission pass. */
function FakeGlass({ position, radius }: { position: [number, number, number]; radius: number }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas")
    c.width = c.height = 256
    const g = c.getContext("2d")!
    const rim = g.createRadialGradient(128, 128, 90, 128, 128, 128)
    rim.addColorStop(0, "rgba(255,255,255,0)")
    rim.addColorStop(0.82, "rgba(190,235,255,0.16)")
    rim.addColorStop(1, "rgba(255,255,255,0)")
    g.fillStyle = rim
    g.fillRect(0, 0, 256, 256)
    const hi = g.createRadialGradient(92, 84, 2, 92, 84, 50)
    hi.addColorStop(0, "rgba(255,255,255,0.32)")
    hi.addColorStop(1, "rgba(255,255,255,0)")
    g.fillStyle = hi
    g.fillRect(0, 0, 256, 256)
    return new THREE.CanvasTexture(c)
  }, [])
  return (
    <sprite position={position} scale={[radius * 2.2, radius * 2.2, 1]} renderOrder={10}>
      <spriteMaterial map={tex} transparent depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} opacity={0.8} />
    </sprite>
  )
}

function HeroGlass({ glass }: { glass: boolean }) {
  const [x, y, z] = ANCHOR.lattice
  return (
    <group>
      <GlassBall position={[x - 1.05, y - 0.95, z + 2.1]} radius={0.42} glass={glass} phase={0} />
      <GlassBall position={[x + 1.5, y + 0.7, z + 1.5]} radius={0.55} glass={glass} phase={2.1} />
    </group>
  )
}

/* ------------------------------------------------------------- floor */

function Floor({ at, quality }: { at: [number, number, number]; quality: Tier }) {
  return (
    <mesh position={at} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[90, 90]} />
      <MeshReflectorMaterial
        blur={[300, 100]}
        resolution={quality === "high" ? 1024 : 512}
        mixBlur={1}
        mixStrength={1.5}
        mixContrast={1}
        roughness={0.85}
        depthScale={0.6}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.4}
        color="#06080f"
        metalness={0.4}
        mirror={0.6}
      />
    </mesh>
  )
}

/* -------------------------------------------------------------- halo */

function Halo() {
  const [x, y, z] = ANCHOR.token
  return (
    <group position={[x, y - 1.75, z - 0.9]}>
      <mesh>
        <torusGeometry args={[2.5, 0.01, 8, 200, Math.PI]} />
        <meshBasicMaterial color="#c4b5ff" toneMapped={false} />
      </mesh>
      <mesh>
        <torusGeometry args={[2.5, 0.07, 8, 200, Math.PI]} />
        <meshBasicMaterial color="#7c5cff" toneMapped={false} transparent opacity={0.18} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  )
}

/* -------------------------------------------------------- manifesto */

function Manifesto({ glass }: { glass: boolean }) {
  const ring = useRef<THREE.Group>(null)
  const textMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#7d838f", transparent: true }), [])
  const [x, y, z] = ANCHOR.emblem
  useFrame(({ clock }) => {
    const s = scrollStore.getState()
    const f = s.sections.finale?.progress ?? 0
    if (ring.current) {
      ring.current.rotation.y = clock.elapsedTime * 0.45 + f * 2.4
      ring.current.rotation.x = Math.sin(clock.elapsedTime * 0.3) * 0.25
    }
    textMat.opacity = 1 - Math.min(1, Math.max(0, (f - 0.3) / 0.12))
  })
  return (
    <group>
      <Text
        font="/marketing/fonts/JetBrainsMono-Medium.woff"
        position={[x, y + 0.05, z - 1.6]}
        fontSize={1.05}
        lineHeight={0.95}
        letterSpacing={-0.02}
        textAlign="center"
        anchorX="center"
        anchorY="middle"
        material={textMat}
      >
        {"FROM ATOM\nTO ASSET"}
      </Text>
      <group ref={ring} position={[x, y, z + 0.9]}>
        <mesh>
          <torusGeometry args={[1.18, 0.17, 48, 160]} />
          {glass ? (
            <MeshTransmissionMaterial
              samples={6}
              resolution={512}
              thickness={0.4}
              chromaticAberration={0.06}
              anisotropy={0.2}
              roughness={0.03}
              ior={1.45}
              distortion={0.25}
              distortionScale={0.5}
              temporalDistortion={0.1}
              backside
              color="#eef6ff"
              envMapIntensity={2.2}
            />
          ) : (
            <meshStandardMaterial color="#cfd8e6" metalness={1} roughness={0.12} envMapIntensity={1.6} />
          )}
        </mesh>
      </group>
    </group>
  )
}

/* ---------------------------------------------------------- god rays */

/** Soft light shafts over the finale lattice: additive gradient planes, no extra pass. */
function GodRays() {
  const tex = useMemo(() => {
    const c = document.createElement("canvas")
    c.width = 64
    c.height = 256
    const g = c.getContext("2d")!
    const v = g.createLinearGradient(0, 0, 0, 256)
    v.addColorStop(0, "rgba(255,200,150,0.55)")
    v.addColorStop(1, "rgba(255,160,90,0)")
    g.fillStyle = v
    g.fillRect(0, 0, 64, 256)
    const h = g.createLinearGradient(0, 0, 64, 0)
    h.addColorStop(0, "rgba(0,0,0,1)")
    h.addColorStop(0.5, "rgba(0,0,0,0)")
    h.addColorStop(1, "rgba(0,0,0,1)")
    g.globalCompositeOperation = "destination-out"
    g.fillStyle = h
    g.fillRect(0, 0, 64, 256)
    return new THREE.CanvasTexture(c)
  }, [])
  const group = useRef<THREE.Group>(null)
  const [x, y, z] = ANCHOR.finale
  const rays = useMemo(() => [-2.4, -1.1, 0.3, 1.5, 2.6].map((dx, i) => ({ dx, w: 0.5 + (i % 3) * 0.35, tilt: -0.18 + i * 0.09, o: 0.18 + (i % 2) * 0.1 })), [])
  useFrame(({ clock }) => {
    group.current?.children.forEach((m, i) => {
      const mat = (m as THREE.Mesh).material as THREE.MeshBasicMaterial
      mat.opacity = rays[i].o * (0.75 + 0.25 * Math.sin(clock.elapsedTime * 0.4 + i))
    })
  })
  return (
    <group ref={group} position={[x, y + 3.2, z - 1.5]}>
      {rays.map((r, i) => (
        <mesh key={i} position={[r.dx, 0, 0]} rotation={[0, 0, r.tilt]}>
          <planeGeometry args={[r.w, 7]} />
          <meshBasicMaterial map={tex} transparent opacity={r.o} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}
