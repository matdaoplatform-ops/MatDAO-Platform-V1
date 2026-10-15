import type { Metadata } from "next"
import { Space_Grotesk, Instrument_Serif, JetBrains_Mono, IBM_Plex_Sans_Thai } from "next/font/google"
import { en } from "@/content/en"
import "./marketing.css"

const display = Space_Grotesk({ subsets: ["latin"], weight: ["300", "400", "500"], variable: "--mkt-font-display", display: "swap" })
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["italic"], variable: "--mkt-font-serif", display: "swap" })
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--mkt-font-mono", display: "swap" })
const thai = IBM_Plex_Sans_Thai({ subsets: ["thai", "latin"], weight: ["300", "400", "500"], variable: "--mkt-font-thai", display: "swap" })

export const metadata: Metadata = {
  title: en.meta.title,
  description: en.meta.description,
  openGraph: {
    title: en.meta.title,
    description: en.meta.description,
    type: "website",
    images: [{ url: "/marketing/og.jpg", width: 1200, height: 630, alt: "MatDAO" }],
  },
  twitter: { card: "summary_large_image", title: en.meta.title, description: en.meta.description, images: ["/marketing/og.jpg"] },
}

/**
 * Marketing layout: its own fonts and design tokens. The app chrome (navbar,
 * particle background, demo toggle) from the root layout hides itself on "/".
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`mkt ${display.variable} ${serif.variable} ${mono.variable} ${thai.variable}`}>
      {/* Marks JS as available before first paint: only then are cues hidden and the preloader shown. */}
      <script dangerouslySetInnerHTML={{ __html: "document.documentElement.setAttribute('data-mkt-js','')" }} />
      {children}
    </div>
  )
}
