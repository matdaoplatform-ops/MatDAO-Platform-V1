"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Building2, Loader2, User, Sparkles } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { roleDestination, safeNextPath, type SelfServiceRole } from "@/lib/auth-routes"
import { RequireAuth } from "@/components/auth/require-auth"

const roles: { value: SelfServiceRole; label: string; description: string }[] = [
  { value: "researcher", label: "Researcher", description: "Submit and manage research projects" },
  { value: "investor", label: "Investor", description: "Browse and back projects" },
]

function OnboardingForm() {
  const { user, updateProfile } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [name, setName] = useState("")
  const [role, setRole] = useState<SelfServiceRole>("researcher")
  const [university, setUniversity] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    setName(user.name)
    if (user.role === "investor") setRole("investor")
    setUniversity(user.university ?? "")
  }, [user])

  // Staff never need onboarding.
  useEffect(() => {
    if (user?.role === "staff") router.replace(roleDestination("staff"))
  }, [user, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!name.trim()) {
      setError("Please tell us your name.")
      return
    }
    if (role === "researcher" && !university.trim()) {
      setError("Please enter your university or institution.")
      return
    }
    setSaving(true)
    try {
      const updated = await updateProfile({
        name: name.trim(),
        role,
        university: university.trim() || null,
      })
      router.replace(safeNextPath(searchParams.get("next"), roleDestination(updated.role)))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          <h1 className="mb-2 text-3xl font-bold text-foreground">Welcome to MatDAO</h1>
          <p className="text-sm text-muted-foreground">
            One quick step: tell us how you will use the platform.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-2xl border border-border/60 bg-card p-8" noValidate>
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
                value={name}
                onChange={(e) => setName(e.target.value)}
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
            disabled={saving}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Continue
          </button>
        </form>
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <OnboardingForm />
      </Suspense>
    </RequireAuth>
  )
}
