"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/auth-context"
import { roleDestination } from "@/lib/auth-routes"
import { Mail, Lock, Loader2, KeyRound, CheckCircle2 } from "lucide-react"
import { EmailCodeForm } from "@/components/auth/email-code-form"

type Step = "email" | "code" | "password"

export default function ForgotPasswordPage() {
  const { sendPasswordResetCode, verifyPasswordResetCode, setNewPassword, isLoading } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState<Step>("email")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!email.trim()) {
      setError("Enter the email address on your account.")
      return
    }
    setSubmitting(true)
    try {
      await sendPasswordResetCode(email.trim())
      setStep("code")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the reset code.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
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

  const busy = isLoading || submitting

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-8">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
          {step === "password" ? (
            <CheckCircle2 className="h-7 w-7 text-primary" />
          ) : (
            <KeyRound className="h-7 w-7 text-primary" />
          )}
        </div>

        {step === "email" && (
          <>
            <h1 className="mb-2 text-center text-2xl font-bold text-foreground">Reset your password</h1>
            <p className="mb-6 text-center text-sm text-muted-foreground">
              Enter your email and we will send you a 6-digit code to set a new password.
            </p>
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label htmlFor="reset-email" className="mb-1.5 block text-sm font-medium text-foreground">
                  Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@university.edu"
                    className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-4 text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {busy ? "Sending…" : "Send reset code"}
              </button>
            </form>
          </>
        )}

        {step === "code" && (
          <div className="text-center">
            <h1 className="mb-2 text-2xl font-bold text-foreground">Enter your code</h1>
            <p className="text-sm text-muted-foreground">
              We emailed a 6-digit code to <span className="font-medium text-foreground">{email}</span>.
            </p>
            <EmailCodeForm
              email={email}
              onVerify={async (mail, code) => {
                await verifyPasswordResetCode(mail, code)
                return null
              }}
              onResend={sendPasswordResetCode}
              onVerified={() => setStep("password")}
              confirmLabel="Verify code"
            />
            <p className="mt-4 text-xs text-muted-foreground">
              Wrong address?{" "}
              <button
                type="button"
                onClick={() => setStep("email")}
                className="font-medium text-primary hover:underline"
              >
                Go back
              </button>
            </p>
          </div>
        )}

        {step === "password" && (
          <>
            <h1 className="mb-2 text-center text-2xl font-bold text-foreground">Choose a new password</h1>
            <p className="mb-6 text-center text-sm text-muted-foreground">
              Code confirmed. Set a new password and you will be signed in.
            </p>
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div>
                <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-foreground">
                  New password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="new-password"
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
                <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-foreground">
                  Confirm password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="confirm-password"
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
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {busy ? "Saving…" : "Save password & continue"}
              </button>
            </form>
          </>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link href="/auth/sign-in" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
