import type { Metadata, Viewport } from "next"
import { Space_Grotesk, Instrument_Serif, JetBrains_Mono, IBM_Plex_Sans_Thai } from "next/font/google"
import "./globals.css"
import { Navbar } from "@/components/navbar"
import { AuthProvider } from "@/context/auth-context"
import { WagmiProvider } from "@/components/providers/WagmiProvider"
import { Toaster } from "react-hot-toast"
import { Web3Background } from "@/components/web3-background"
import { DemoModeToggle } from "@/components/demo-mode"
import { AppChrome } from "@/components/app-chrome"

// One type system for the whole site (landing + app): Space Grotesk, an Instrument Serif
// accent, JetBrains Mono labels and IBM Plex Sans Thai for Thai text.
const display = Space_Grotesk({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--mkt-font-display", display: "swap" })
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["italic"], variable: "--mkt-font-serif", display: "swap" })
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--mkt-font-mono", display: "swap" })
const thai = IBM_Plex_Sans_Thai({ subsets: ["thai"], weight: ["300", "400", "500", "600"], variable: "--mkt-font-thai", display: "swap", preload: false })

export const metadata: Metadata = {
  title: "MatDAO - Fueling Material Science Breakthroughs",
  description:
    "MatDAO is a milestone-driven commercialization platform for advanced materials research. Submit projects, track progress, and unlock funding.",
  icons: { icon: "/marketing/favicon.svg" },
}

export const viewport: Viewport = {
  themeColor: "#05070d",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`dark ${display.variable} ${serif.variable} ${mono.variable} ${thai.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <AppChrome>
          <Web3Background />
        </AppChrome>
        <WagmiProvider>
          <AuthProvider>
            <Navbar />
            <main>{children}</main>
          </AuthProvider>
        </WagmiProvider>
        <Toaster position="top-right" />
        <AppChrome>
          <DemoModeToggle />
        </AppChrome>
      </body>
    </html>
  )
}
