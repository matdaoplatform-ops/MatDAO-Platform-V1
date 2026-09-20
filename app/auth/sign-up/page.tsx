"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/auth-context"
import { roleDestination, type SelfServiceRole } from "@/lib/auth-routes"
import { Mail, Lock, User, Building2, Loader2, MailCheck } from "lucide-react"
import { EmailCodeForm } from "@/components/auth/email-code-form"

const roles: { value: SelfServiceRole; label: string; description: string }[] = [
  { value: "researcher", label: "Researcher", description: "Submit and manage research projects" },
  { value: "investor", label: "Investor", description: "Browse and back projects" },
]

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

export default function SignUpPage() {
  const { signUp, signInWithGoogle, isLoading, verifyEmailCode, resendEmailCode } = useAuth()
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<SelfServiceRole>("researcher")
  const [university, setUniversity] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null)

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!name.trim() || !email.trim() || !password) {
      setError("Please fill in all required fields.")
      return
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }
    if (role === "researcher" && !university.trim()) {
      setError("Please enter your university or institution.")
      return
    }
    setSubmitting(true)
    try {
      const result = await signUp({
        email: email.trim(),
        password,
        name: name.trim(),
        role,
        university: university.trim() || undefined,
      })
      if (result.needsEmailConfirmation) {
        setConfirmationEmail(email.trim())
        return
      }
      router.push(roleDestination(result.user?.role ?? role))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleGoogleSignUp() {
    setError("")
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign up with Google")
    }
  }

  if (confirmationEmail) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
            <MailCheck className="h-7 w-7 text-primary" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-foreground">Enter your code</h1>
          <p className="text-sm text-muted-foreground">
            We emailed a 6-digit code to <span className="font-medium text-foreground">{confirmationEmail}</span>.
            Type it below and you are in — no link to click.
          </p>
          <EmailCodeForm
            email={confirmationEmail}
            onVerify={verifyEmailCode}
            onResend={resendEmailCode}
            onVerified={(u) => router.push(roleDestination(u?.role ?? role))}
          />
          <p className="mt-4 text-xs text-muted-foreground">
            Wrong address?{" "}
            <button type="button" onClick={() => setConfirmationEmail(null)} className="font-medium text-primary hover:underline">
              Go back
            </button>
          </p>
        </div>
      </div>
    )
  }

  const busy = isLoading || submitting

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <img
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Add%20a%20subheading%284%29-8oEDuOtVsHXvDTX1gdv6hBkwYJak4N.png"
            alt="MatDAO Logo"
            className="mx-auto mb-6 h-12"
          />
          <h1 className="mb-2 text-3xl font-bold text-foreground">Create Your Account</h1>
          <p className="text-sm text-muted-foreground">Join the future of materials science commercialization</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border/60 bg-card p-8">
          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={busy}
            className="mb-6 flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-secondary/50 px-4 py-3 text-sm text-foreground transition-all hover:bg-secondary disabled:opacity-50"
          >
            <GoogleIcon />
            <span className="font-medium">Sign up with Google</span>
          </button>

          <div className="mb-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or sign up with email</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSignUp} className="flex flex-col gap-5" noValidate>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground">I am a...</label>
              <div className="grid grid-cols-2 gap-2">
                {roles.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    aria-pressed={role === r.value}
                    className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      role === r.value
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="block text-xs font-semibold">{r.label}</span>
                    <span className="block text-[11px] opacity-80">{r.description}</span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Reviewer (staff) accounts are provisioned by the MatDAO team.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="name" className="text-sm font-medium text-foreground">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Dr. Jane Smith"
                  className="w-full rounded-lg border border-border bg-secondary/50 py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@university.edu"
                  className="w-full rounded-lg border border-border bg-secondary/50 py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full rounded-lg border border-border bg-secondary/50 py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>
            </div>

            {role === "researcher" && (
              <div className="flex flex-col gap-2">
                <label htmlFor="university" className="text-sm font-medium text-foreground">
                  University / Institution
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="university"
                    type="text"
                    autoComplete="organization"
                    value={university}
                    onChange={(e) => setUniversity(e.target.value)}
                    placeholder="Chulalongkorn University"
                    className="w-full rounded-lg border border-border bg-secondary/50 py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                </div>
              </div>
            )}

            {error && (
              <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create Account
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/auth/sign-in" className="font-medium text-primary transition-colors hover:text-primary/80">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
