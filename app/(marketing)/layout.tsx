import type { Metadata } from "next"
import { en } from "@/content/en"
import "./marketing.css"

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://mat-dao-platform-v1-mu.vercel.app"),
  title: en.meta.title,
  description: en.meta.description,
  openGraph: {
    title: en.meta.title,
    description: en.meta.description,
    type: "website",
    images: [{ url: "/marketing/og.jpg", width: 1200, height: 630, alt: "MatDAO" }],
  },
  icons: { icon: "/marketing/favicon.svg" },
  twitter: { card: "summary_large_image", title: en.meta.title, description: en.meta.description, images: ["/marketing/og.jpg"] },
}

/**
 * Marketing layout: design tokens for the landing (fonts come from the root
 * layout). The root layout's 2D particle background and demo toggle hide on "/";
 * the shared navbar switches to its overlay style there.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mkt">
      {/* Marks JS as available before first paint: only then are cues hidden and the preloader shown. */}
      <script dangerouslySetInnerHTML={{ __html: "document.documentElement.setAttribute('data-mkt-js','')" }} />
      {children}
    </div>
  )
}
