"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/context/auth-context"
import { roleDestination, safeNextPath } from "@/lib/auth-routes"
import { Mail, Lock, Loader2, Wallet, Sparkles, ArrowRight } from "lucide-react"

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

function SignInForm() {
  const { signIn, signInWithGoogle, isLoading, connectWallet, user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextParam = searchParams.get("next")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [showWalletOption, setShowWalletOption] = useState(false)

  // Errors handed over by /auth/callback
  useEffect(() => {
    const err = searchParams.get("error")
    const description = searchParams.get("error_description")
    if (description) setError(description)
    else if (err === "missing-env") setError("Authentication is not configured on this deployment.")
    else if (err) setError(err.replace(/[-_]/g, " "))
  }, [searchParams])

  // Already signed in → go where the user was heading.
  useEffect(() => {
    if (user && !submitting) {
      router.replace(safeNextPath(nextParam, roleDestination(user.role)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!email.trim() || !password) {
      setError("Please enter your email and password.")
      return
    }
    setSubmitting(true)
    try {
      const loggedInUser = await signIn(email.trim(), password)
      if (!loggedInUser) {
        setError("Signed in, but your profile could not be loaded. Please try again or contact support.")
        return
      }
      router.push(safeNextPath(nextParam, roleDestination(loggedInUser.role)))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleWalletConnect() {
    setError("")
    try {
      await connectWallet()
      router.push(safeNextPath(nextParam, "/"))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect wallet")
    }
  }

  async function handleGoogleSignIn() {
    setError("")
    try {
      await signInWithGoogle(nextParam ?? undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in with Google")
    }
  }

  const busy = isLoading || submitting

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a1a] via-[#0d1a2d] to-[#050510]" />
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#6efcff]/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#a78bfa]/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#6efcff]/30 bg-[#6efcff]/10 backdrop-blur-sm">
            <Sparkles className="h-8 w-8 text-[#c5fdff]" />
          </div>
          <h1 className="mb-2 text-3xl font-bold text-white/95">Welcome to MatDAO</h1>
          <p className="text-sm text-white/60">Sign in with your email to access the platform</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-8">
          <form onSubmit={handleSignIn} className="flex flex-col gap-5" noValidate>
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium text-white/90">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@university.edu"
                  className="w-full rounded-lg border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:border-[#6efcff] focus:outline-none focus:ring-1 focus:ring-[#6efcff]/40 transition-all"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-sm font-medium text-white/90">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-lg border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:border-[#6efcff] focus:outline-none focus:ring-1 focus:ring-[#6efcff]/40 transition-all"
                />
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="group flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6efcff] to-[#a78bfa] px-4 py-3 text-sm font-semibold text-black transition-all hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Sign In
              {!submitting && <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>

          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-white/50">or</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={busy}
            className="w-full flex items-center justify-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60 hover:bg-white/10 hover:text-white/80 transition-all disabled:opacity-50"
          >
            <GoogleIcon />
            <span className="font-medium">Sign in with Google</span>
          </button>

          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-white/50">or</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          {!showWalletOption ? (
            <button
              type="button"
              onClick={() => setShowWalletOption(true)}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60 hover:bg-white/10 hover:text-white/80 transition-all"
            >
              <Wallet className="h-4 w-4" />
              <span>Connect Wallet (Optional)</span>
            </button>
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleWalletConnect}
                disabled={busy}
                className="group w-full flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60 hover:bg-white/10 hover:text-white/80 transition-all disabled:opacity-50"
              >
                <Wallet className="h-4 w-4" />
                <span className="font-medium">Connect Wallet</span>
              </button>
              <p className="text-xs text-white/40 text-center">
                Sign in with email first, then link a wallet to enable vault investments and IP-NFT minting.
              </p>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-white/50">
          {"Don't have an account? "}
          <Link href="/auth/sign-up" className="font-medium text-[#c5fdff] transition-colors hover:text-[#6efcff]">
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#c5fdff]" />
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  )
}
