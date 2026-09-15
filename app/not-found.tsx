import Link from "next/link"
import { Compass } from "lucide-react"

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-5 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
        <Compass className="h-8 w-8 text-primary" />
      </div>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">404</p>
      <h1 className="text-3xl font-bold text-foreground">This page does not exist</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        The link may be outdated, or the project you are looking for has not been approved for the marketplace yet.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Back to home
        </Link>
        <Link
          href="/project"
          className="rounded-full border border-border bg-card px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
        >
          Browse projects
        </Link>
      </div>
    </div>
  )
}
