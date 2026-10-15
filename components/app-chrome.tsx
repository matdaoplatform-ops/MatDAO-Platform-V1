"use client"

import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

/** App-wide chrome (navbar, background, demo toggle) — hidden on the marketing landing page, which has its own. */
export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  if (pathname === "/") return null
  return <>{children}</>
}
