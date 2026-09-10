"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/context/auth-context"
import { roleDestination, safeNextPath } from "@/lib/auth-routes"

/**
 * OAuth / magic-link landing page.
 *
 * With the PKCE flow Supabase redirects here with `?code=...`. The code
 * verifier lives in this browser's localStorage, so the exchange MUST happen
 * client-side — and auth-js already does it: with `detectSessionInUrl: true`
 * the client's `_initialize()` detects `?code` + stored verifier, calls
 * `exchangeCodeForSession` itself and deletes the verifier. Calling
 * `exchangeCodeForSession` again here would fail with "PKCE code verifier
 * not found", so this page only awaits `initialize()` (which surfaces the
 * exchange error) and then waits for the session. Hash-based sessions
 * (email confirmation links) are handled by the same initialisation.
 */
function CallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { ensureProfile } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const run = async () => {
      const next = safeNextPath(searchParams.get("next"), "")
      const providerError = searchParams.get("error_description") || searchParams.get("error")
      if (providerError) {
        setError(providerError)
        return
      }

      // Resolves once auth-js has processed the URL (code exchange / hash tokens).
      const { error: initError } = await supabase.auth.initialize()
      if (initError) {
        setError(initError.message)
        return
      }

      let session = (await supabase.auth.getSession()).data.session
      for (let i = 0; i < 20 && !session; i++) {
        await new Promise((r) => setTimeout(r, 150))
        session = (await supabase.auth.getSession()).data.session
      }
      if (!session?.user) {
        setError(
          searchParams.get("code")
            ? "This sign-in link must be opened in the same browser where you started signing in. Please try again from the sign-in page."
            : "We could not establish a session. Please try signing in again.",
        )
        return
      }

      const profile = await ensureProfile(session.user)
      if (!profile) {
        setError("Signed in, but your profile could not be created. Please contact support.")
        return
      }

      // Strip the auth params from history.
      if (typeof window !== "undefined" && window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname)
      }

      if (profile.needsOnboarding) {
        router.replace(next ? `/onboarding?next=${encodeURIComponent(next)}` : "/onboarding")
        return
      }
      router.replace(next || roleDestination(profile.role))
    }

    run().catch((err) => setError(err instanceof Error ? err.message : "Authentication failed"))
  }, [searchParams, ensureProfile, router])

  if (error) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/10">
          <AlertTriangle className="h-7 w-7 text-destructive" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">Sign-in could not be completed</h1>
        <p className="max-w-md text-sm text-muted-foreground">{error}</p>
        <Link
          href="/auth/sign-in"
          className="mt-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-3">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Finishing sign-in…</p>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  )
}
