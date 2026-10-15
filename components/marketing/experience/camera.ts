import * as THREE from "three"
import { scrollStore, storyToScroll, type ScrollState } from "@/store/scroll"
import { CAM_KEYS } from "./story"

const ease = (t: number) => t * t * (3 - 2 * t)
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

const posCurve = new THREE.CatmullRomCurve3(CAM_KEYS.map((k) => new THREE.Vector3(...k.pos)), false, "centripetal")
const lookCurve = new THREE.CatmullRomCurve3(CAM_KEYS.map((k) => new THREE.Vector3(...k.look)), false, "centripetal")

/** Key segment + eased local t for a scroll position. Segments ease in/out (a "beat" on each key) unless the key says linear. */
export function camParam(y: number, s: ScrollState = scrollStore.getState()) {
  const px = CAM_KEYS.map((k) => storyToScroll(k.s, k.at, s))
  const n = CAM_KEYS.length - 1
  if (y <= px[0]) return 0
  if (y >= px[n]) return 1
  let i = 0
  while (i < n - 1 && y > px[i + 1]) i++
  const t = clamp01((y - px[i]) / Math.max(1, px[i + 1] - px[i]))
  const e = CAM_KEYS[i].linear ? t : ease(t)
  return (i + e) / n
}

/** Camera position and look target at a scroll position. */
export function cameraPose(y: number, outPos: THREE.Vector3, outLook: THREE.Vector3, s: ScrollState = scrollStore.getState()) {
  const u = camParam(y, s)
  posCurve.getPoint(u, outPos)
  lookCurve.getPoint(u, outLook)
  return u
}

/** Scroll position (px) where the camera's z first reaches `z` inside [y0, y1]. */
export function scrollForCameraZ(z: number, y0: number, y1: number, s: ScrollState = scrollStore.getState()) {
  const p = new THREE.Vector3(), l = new THREE.Vector3()
  let lo = y0, hi = y1
  for (let k = 0; k < 28; k++) {
    const mid = (lo + hi) / 2
    cameraPose(mid, p, l, s)
    if (p.z > z) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}
