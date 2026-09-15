"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { CheckCircle2, ClipboardCheck, Mail, Target, LayoutDashboard, ArrowRight, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase/client"
import { RequireAuth } from "@/components/auth/require-auth"

const NEXT_STEPS = [
  {
    icon: ClipboardCheck,
    title: "TTO review",
    text: "The MatDAO review team checks your submission, documents and IP position. This usually takes a few business days.",
  },
  {
    icon: Mail,
    title: "You will hear from us",
    text: "We email the address on your submission when the project is approved, or if the reviewers need changes.",
  },
  {
    icon: Target,
    title: "Build your milestones",
    text: "While you wait, outline the validation milestones that will unlock funding once the project goes live.",
  },
]

function SuccessContent() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get("projectId")
  const [title, setTitle] = useState<string | null>(null)
  const [documents, setDocuments] = useState<number | null>(null)

  useEffect(() => {
    if (!projectId) return
    supabase
      .from("projects")
      .select("title, documents")
      .eq("id", projectId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setTitle(data.title)
          setDocuments(Array.isArray(data.documents) ? data.documents.length : 0)
        }
      })
  }, [projectId])

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center px-4 py-16">
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10">
            <CheckCircle2 className="h-9 w-9 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Submission received</h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {title ? (
              <>
                <span className="font-medium text-foreground">{title}</span> is now in the review queue
                {documents != null && documents > 0 ? ` with ${documents} attached document${documents === 1 ? "" : "s"}` : ""}.
              </>
            ) : (
              "Your project is now in the review queue."
            )}
          </p>
          {projectId && (
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">Reference: {projectId}</p>
          )}
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">What happens next</h2>
          <ol className="space-y-4">
            {NEXT_STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <step.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {i + 1}. {step.title}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            href={projectId ? `/submit/milestone?projectId=${projectId}` : "/submit/milestone"}
            className="group flex items-center justify-between rounded-xl bg-primary px-5 py-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <span className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Build milestones
            </span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/researcher-dashboard"
            className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <span className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Go to dashboard
            </span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function SubmitSuccessPage() {
  return (
    <RequireAuth>
      <Suspense
        fallback={
          <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        }
      >
        <SuccessContent />
      </Suspense>
    </RequireAuth>
  )
}
