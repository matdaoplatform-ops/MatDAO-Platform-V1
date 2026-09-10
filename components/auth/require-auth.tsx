"use client"

import { useEffect, type ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Loader2, Lock, ShieldOff } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { requireRole, roleDestination, type UserRole } from "@/lib/auth-routes"

interface RequireAuthProps {
  /** Allowed roles; omit for "any signed-in user". */
  roles?: readonly UserRole[]
  /**
   * `redirect` (default) sends anonymous users to /auth/sign-in?next=…;
   * `prompt` renders an inline sign-in card instead (useful for pages that
   * are worth previewing, like /submit).
   */
  mode?: "redirect" | "prompt"
  /** Optional replacement for the loading state. */
  fallback?: ReactNode
  children: ReactNode
}

/**
 * Lightweight client-side route guard. Sessions live in the browser
 * (supabase-js localStorage), so this is where access is decided; RLS on the
 * database remains the real security boundary.
 */
export function RequireAuth({ roles, mode = "redirect", fallback, children }: RequireAuthProps) {
  const { user, isLoading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const allowed = roles ?? "any"
  const decision = requireRole(user, allowed, pathname)
  const redirectTarget =
    !isLoading && !decision.ok && decision.reason === "unauthenticated" && mode === "redirect"
      ? decision.redirectTo
      : null

  useEffect(() => {
    if (redirectTarget) router.replace(redirectTarget)
  }, [redirectTarget, router])

  if (isLoading) {
    return (
      fallback ?? (
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )
    )
  }

  if (decision.ok) return <>{children}</>

  if (decision.reason === "unauthenticated") {
    if (mode === "redirect") {
      return (
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )
    }
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-5 px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
          <Lock className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Sign in to continue</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          You need a MatDAO account to use this page. Sign in or create a free account — it only takes a minute.
        </p>
        <div className="flex items-center gap-3">
          <Link
            href={decision.redirectTo}
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Sign In
          </Link>
          <Link
            href="/auth/sign-up"
            className="rounded-full border border-border bg-card px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Create Account
          </Link>
        </div>
      </div>
    )
  }

  // Forbidden: signed in, wrong role.
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-5 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/10">
        <ShieldOff className="h-8 w-8 text-destructive" />
      </div>
      <h1 className="text-2xl font-bold text-foreground">This area is not available for your account</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Your account role is <span className="font-medium capitalize text-foreground">{user?.role}</span>.
        {allowed !== "any" && (
          <>
            {" "}This page is limited to{" "}
            <span className="font-medium text-foreground">{allowed.join(" / ")}</span> accounts.
          </>
        )}
      </p>
      <Link
        href={roleDestination(user?.role)}
        className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Go to my dashboard
      </Link>
    </div>
  )
}
