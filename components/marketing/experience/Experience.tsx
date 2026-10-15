"use client"

import { useEffect } from "react"
import { scrollStore } from "@/store/scroll"

/** Phase 1 placeholder: no 3D yet. Marks the scene ready so the preloader can finish. */
export function Experience() {
  useEffect(() => {
    scrollStore.setState({ loadProgress: 1, sceneReady: true })
  }, [])
  return null
}
