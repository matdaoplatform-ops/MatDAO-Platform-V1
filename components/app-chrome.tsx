"use client"

import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

/** App chrome that the landing page replaces with its own (2D particle background, demo toggle). */
export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  if (pathname === "/") return null
  return <>{children}</>
}
