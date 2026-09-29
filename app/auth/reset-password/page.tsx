"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/context/auth-context"
import { roleDestination } from "@/lib/auth-routes"
import { Lock, Loader2, KeyRound, AlertTriangle } from "lucide-react"

/**
 * Landing page for the "reset password" link in the recovery email.
 *
 * Supabase drops a recovery session into the URL (hash tokens or ?code=), and
 * auth-js picks it up during initialize(). Anyone who prefers the 6-digit code
 * never lands here — /auth/forgot-password handles that path end to end.
 */
export default function ResetPasswordPage() {
  const { setNewPassword } = useAuth()
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      await supabase.auth.initialize()
      let session = (await supabase.auth.getSession()).data.session
      for (let i = 0; i < 20 && !session; i++) {
        await new Promise((r) => setTimeout(r, 150))
        session = (await supabase.auth.getSession()).data.session
      }
      if (cancelled) return
      if (!session) {
        setLinkError(
          "This reset link has expired or was opened in a different browser. Request a new code instead — it works anywhere.",
        )
        return
      }
      if (typeof window !== "undefined" && window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname)
      }
      setReady(true)
    }
    run().catch((err) => setLinkError(err instanceof Error ? err.message : "Could not verify the reset link."))
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (password.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }
    if (password !== confirm) {
      setError("The two passwords do not match.")
      return
    }
    setSubmitting(true)
    try {
      const user = await setNewPassword(password)
      router.push(roleDestination(user?.role ?? "researcher"))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update your password.")
    } finally {
      setSubmitting(false)
    }
  }

  if (linkError) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/10">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-foreground">Link no longer valid</h1>
          <p className="text-sm text-muted-foreground">{linkError}</p>
          <Link
            href="/auth/forgot-password"
            className="mt-6 inline-block rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Get a reset code
          </Link>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Checking your reset link…</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-8">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
          <KeyRound className="h-7 w-7 text-primary" />
        </div>
        <h1 className="mb-2 text-center text-2xl font-bold text-foreground">Choose a new password</h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Set a new password and you will be signed in straight away.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="reset-new-password" className="mb-1.5 block text-sm font-medium text-foreground">
              New password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="reset-new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-4 text-foreground outline-none focus:border-primary"
              />
            </div>
          </div>
          <div>
            <label htmlFor="reset-confirm-password" className="mb-1.5 block text-sm font-medium text-foreground">
              Confirm password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="reset-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat the password"
                className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-4 text-foreground outline-none focus:border-primary"
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Saving…" : "Save password & continue"}
          </button>
        </form>
      </div>
    </div>
  )
}
