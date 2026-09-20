"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import type { User } from "@/context/auth-context"

interface EmailCodeFormProps {
  email: string
  onVerify: (email: string, code: string) => Promise<User | null>
  onResend: (email: string) => Promise<void>
  onVerified: (user: User | null) => void
}

/** 6-digit confirmation-code entry used after sign-up (and for unconfirmed sign-ins). */
export function EmailCodeForm({ email, onVerify, onResend, onVerified }: EmailCodeFormProps) {
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [resent, setResent] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function submit(value: string) {
    if (busy) return
    setError("")
    setBusy(true)
    try {
      const user = await onVerify(email, value)
      onVerified(user)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify the code.")
    } finally {
      setBusy(false)
    }
  }

  function handleChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 6)
    setCode(digits)
    if (digits.length === 6) void submit(digits)
  }

  async function handleResend() {
    if (cooldown > 0 || busy) return
    setError("")
    try {
      await onResend(email)
      setResent(true)
      setCooldown(30)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend the code.")
    }
  }

  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        void submit(code)
      }}
    >
      <input
        ref={inputRef}
        id="email-code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={6}
        value={code}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="••••••"
        aria-label="6-digit confirmation code"
        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] text-foreground outline-none focus:border-primary"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button
        type="submit"
        disabled={busy || code.length < 6}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {busy ? "Verifying…" : "Confirm & continue"}
      </button>
      <p className="text-xs text-muted-foreground">
        {resent ? "New code sent. " : "Nothing in your inbox? Check spam, or "}
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0 || busy}
          className="font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-60"
        >
          {cooldown > 0 ? `resend in ${cooldown}s` : "resend the code"}
        </button>
        .
      </p>
    </form>
  )
}
