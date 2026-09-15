"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Plus,
  Check,
  ChevronDown,
  ChevronUp,
  Trash2,
  Beaker,
  FlaskConical,
  DollarSign,
  ShieldAlert,
  Scaling,
  Building2,
  CircleAlert,
  RotateCcw,
  BarChart3,
  FileCheck,
  Leaf,
  Gavel,
  Shield,
  Target,
  ExternalLink,
  Loader2,
  AlertCircle,
  FolderOpen,
} from "lucide-react"
import toast from "react-hot-toast"
import { useAuth } from "@/context/auth-context"
import { supabase } from "@/lib/supabase/client"
import { fetchVerifications } from "@/lib/trl-services/api"
import { RequireAuth } from "@/components/auth/require-auth"
import { PROJECT_STATUS_LABELS } from "@/lib/supabase/client"
import type { SubmittedMilestone, VerificationTask } from "@/lib/trl-services/types"

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

interface MilestoneData {
  id: number
  title: string
  proving: string[]
  description: string
  budget: string
  duration: string
  riskCategory: string[]
}

const provingOptions = [
  { label: "Reproducibility", icon: RotateCcw },
  { label: "Performance", icon: BarChart3 },
  { label: "Cost validation", icon: FileCheck },
  { label: "Scale-up feasibility", icon: Scaling },
  { label: "Regulatory", icon: Gavel },
]

const durationOptions = [
  "4 Weeks",
  "6 Weeks",
  "8 Weeks",
  "10 Weeks",
  "12 Weeks",
  "16 Weeks",
  "20 Weeks",
  "24 Weeks",
]

const riskOptions = [
  { label: "Technical", icon: ShieldAlert },
  { label: "Scale", icon: Scaling },
  { label: "Market", icon: Building2 },
  { label: "IP", icon: CircleAlert },
]

function buildTrlSteps(currentTrl: number) {
  const base = Math.min(Math.max(currentTrl, 1), 7)
  return [
    { trl: `TRL ${base}`, label: "In Progress", status: "active" },
    { trl: `TRL ${base + 1}`, label: "Next Target", status: "upcoming" },
    { trl: `TRL ${base + 2}`, label: "Future Plan", status: "future" },
  ]
}

/** Indicative budget / duration envelopes per TRL band. */
function trlTemplate(trl: number): { budget: string; duration: string } {
  if (trl <= 3) return { budget: "$15k to $35k", duration: "6-10 weeks" }
  if (trl === 4) return { budget: "$35k to $50k", duration: "8-12 weeks" }
  if (trl === 5) return { budget: "$50k to $120k", duration: "12-20 weeks" }
  if (trl === 6) return { budget: "$120k to $250k", duration: "16-24 weeks" }
  return { budget: "$250k+", duration: "20-24 weeks" }
}

interface ProjectSummary {
  id: string
  title: string
  trl: number
  status: string
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function MilestoneBuilderPage() {
  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <MilestoneBuilder />
      </Suspense>
    </RequireAuth>
  )
}

function MilestoneBuilder() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get("projectId")
  const [recommendedMilestones, setRecommendedMilestones] = useState<SubmittedMilestone[]>([])
  const [auditorResults, setAuditorResults] = useState<VerificationTask[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [project, setProject] = useState<ProjectSummary | null>(null)
  const [projectLoading, setProjectLoading] = useState(true)
  const [myProjects, setMyProjects] = useState<ProjectSummary[]>([])

  // Load the target project (for its real TRL) or, without a projectId, the
  // user's projects so they can pick one.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    setProjectLoading(true)
    const run = async () => {
      if (projectId) {
        const { data } = await supabase
          .from("projects")
          .select("id, title, trl, status")
          .eq("id", projectId)
          .maybeSingle()
        if (!cancelled) setProject(data ?? null)
      } else {
        const { data } = await supabase
          .from("projects")
          .select("id, title, trl, status")
          .eq("researcher_id", user.id)
          .order("created_at", { ascending: false })
        if (!cancelled) setMyProjects(data ?? [])
      }
      if (!cancelled) setProjectLoading(false)
    }
    run()
    return () => {
      cancelled = true
    }
  }, [user, projectId])

  useEffect(() => {
    if (user) fetchSubmittedMilestones()
    fetchVerifications()
      .then(setAuditorResults)
      .catch(() => setAuditorResults([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const currentTrl = project?.trl ?? 4
  const trlSteps = useMemo(() => buildTrlSteps(currentTrl), [currentTrl])
  const template = trlTemplate(currentTrl)

  const fetchSubmittedMilestones = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('submitted_milestones')
        .select('*')
        .eq('user_id', user.id)
        .order('submitted_at', { ascending: false })

      if (error) throw error

      if (data) {
        const transformed: SubmittedMilestone[] = data.map(m => ({
          id: m.id,
          projectId: m.project_id,
          projectTitle: m.project_title,
          milestoneKey: m.milestone_key as any,
          milestoneLabel: m.milestone_label,
          description: m.description,
          timeline: m.timeline,
          status: m.status,
          submittedAt: m.submitted_at,
          submittedBy: m.submitted_by,
          verificationId: m.verification_id ?? undefined,
        }))
        setRecommendedMilestones(transformed)
      }
    } catch (err) {
      console.error('Error fetching milestones:', err)
    }
  }

  const [milestones, setMilestones] = useState<MilestoneData[]>([
    {
      id: 1,
      title: "Lab Reproducibility Test",
      proving: ["Reproducibility"],
      description: "",
      budget: "40000",
      duration: "8 Weeks",
      riskCategory: ["Technical"],
    },
  ])
  const [expandedId, setExpandedId] = useState<number | null>(1)

  const addMilestone = () => {
    const newId = milestones.length > 0 ? Math.max(...milestones.map((m) => m.id)) + 1 : 1
    setMilestones([
      ...milestones,
      {
        id: newId,
        title: "",
        proving: [],
        description: "",
        budget: "",
        duration: "8 Weeks",
        riskCategory: [],
      },
    ])
    setExpandedId(newId)
  }

  const updateMilestone = (id: number, updates: Partial<MilestoneData>) => {
    setMilestones(milestones.map((m) => (m.id === id ? { ...m, ...updates } : m)))
  }

  const toggleArrayItem = (
    id: number,
    field: "proving" | "riskCategory",
    item: string,
    maxItems?: number
  ) => {
    const milestone = milestones.find((m) => m.id === id)
    if (!milestone) return
    const current = milestone[field]
    if (current.includes(item)) {
      updateMilestone(id, { [field]: current.filter((i) => i !== item) })
    } else if (!maxItems || current.length < maxItems) {
      updateMilestone(id, { [field]: [...current, item] })
    }
  }

  const removeMilestone = (id: number) => {
    setMilestones(milestones.filter((m) => m.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  const handleSubmitMilestones = async () => {
    if (!user) return
    if (!projectId || !project) {
      setError("Pick a project first — milestones are always linked to a submitted project.")
      return
    }
    const filled = milestones.filter((m) => m.title.trim())
    if (filled.length === 0) {
      setError("Add at least one milestone with a title.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const projectTitle = project.title

      // One insert for all milestones: either every row lands or none does.
      const { error: milestoneError } = await supabase.from("submitted_milestones").insert(
        filled.map((milestone) => ({
          user_id: user.id,
          project_id: projectId,
          project_title: projectTitle,
          milestone_key: milestone.id.toString(),
          milestone_label: milestone.title.trim(),
          description: milestone.description,
          timeline: milestone.duration,
          status: "future" as const,
          submitted_by: user.name || user.email,
        })),
      )
      if (milestoneError) throw milestoneError

      // Update project development_timeline
      const timelineData = filled.map(m => ({
        key: m.id.toString(),
        label: m.title,
        description: m.description,
        budget: parseInt(m.budget) || 0,
        duration: m.duration,
        proving: m.proving,
        riskCategory: m.riskCategory,
      }))

      const { error: updateError } = await supabase
        .from('projects')
        .update({ development_timeline: timelineData })
        .eq('id', projectId)

      if (updateError) throw updateError

      await fetchSubmittedMilestones()
      toast.success(`${filled.length} milestone${filled.length === 1 ? "" : "s"} saved`)
      router.push("/researcher-dashboard")
    } catch (err) {
      console.error("Error submitting milestones:", err)
      setError(err instanceof Error ? err.message : "Failed to submit milestones")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col">
      {/* ---- Hero ---- */}
      <section className="border-b border-border/40 bg-card/50 px-4 py-14">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-accent/30 bg-accent/10">
            <FlaskConical className="h-6 w-6 text-accent" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Milestone Builder
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Outline your validation milestones to de-risk your research
            step-by-step. Unlock funding as you progress through TRL stages.
          </p>
        </div>
      </section>

      {/* ---- Project context / picker ---- */}
      <section className="border-b border-border/40 px-4 py-6">
        <div className="mx-auto max-w-2xl">
          {projectLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading project…
            </div>
          ) : projectId && project ? (
            <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Building milestones for</p>
                <p className="truncate text-sm font-semibold text-foreground">{project.title}</p>
                <p className="text-xs text-muted-foreground">
                  Currently TRL {project.trl} · {PROJECT_STATUS_LABELS[project.status as keyof typeof PROJECT_STATUS_LABELS] ?? project.status}
                </p>
              </div>
              <Link href="/submit/milestone" className="text-xs text-primary hover:underline">
                Choose another project
              </Link>
            </div>
          ) : projectId ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              We could not find that project (or you do not have access to it).{" "}
              <Link href="/submit/milestone" className="underline">
                Pick one of your projects
              </Link>
              .
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 bg-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Which project are these milestones for?</h2>
              </div>
              {myProjects.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  You have not submitted a project yet.{" "}
                  <Link href="/submit" className="font-medium text-primary hover:underline">
                    Submit your first project
                  </Link>{" "}
                  and come back here to plan its milestones.
                </div>
              ) : (
                <ul className="space-y-2">
                  {myProjects.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/submit/milestone?projectId=${p.id}`}
                        className="flex items-center justify-between rounded-lg border border-border/60 bg-secondary/20 px-4 py-3 text-sm transition-colors hover:border-primary/50 hover:bg-secondary/40"
                      >
                        <span className="min-w-0 truncate font-medium text-foreground">{p.title}</span>
                        <span className="ml-3 shrink-0 text-xs text-muted-foreground">TRL {p.trl}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ---- AI-Recommended Milestones & Auditor Results ---- */}
      {(recommendedMilestones.length > 0 || auditorResults.length > 0) && (
        <section className="border-b border-border/40 bg-secondary/20 px-4 py-10">
          <div className="mx-auto max-w-3xl space-y-8">
            {recommendedMilestones.length > 0 && (
              <div>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                  <Target className="h-5 w-5 text-primary" />
                  Recommended Next Steps
                </h2>
                <p className="mb-4 text-xs text-muted-foreground">
                  From your Project Assessment report — submit proofs via the AI Auditor.
                </p>
                <div className="space-y-3">
                  {recommendedMilestones.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-xl border border-border/60 bg-card p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground">{m.milestoneLabel}</span>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] capitalize text-primary">
                          {m.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{m.projectTitle}</p>
                      <p className="mt-2 text-sm text-foreground/80">{m.description}</p>
                      <p className="mt-1 font-mono text-[10px] text-muted-foreground">{m.timeline}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {auditorResults.length > 0 && (
              <div>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                  <Shield className="h-5 w-5 text-accent" />
                  AI Auditor Results
                </h2>
                <div className="space-y-3">
                  {auditorResults.slice(0, 5).map((task) => (
                    <div
                      key={task.id}
                      className="rounded-xl border border-border/60 bg-card p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">{task.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {task.projectTitle} · {task.milestoneName}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            task.aiPassed
                              ? "bg-accent/15 text-accent"
                              : "bg-destructive/15 text-destructive"
                          }`}
                        >
                          AI {task.aiPassed ? "Pass" : "Flagged"}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                        {task.aiConsistencyReport.replace(/[#*]/g, "").slice(0, 200)}...
                      </p>
                    </div>
                  ))}
                </div>
                <Link
                  href="/ai-auditor"
                  className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Submit new proof <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ---- TRL Progress Stepper ---- */}
      <section className="px-4 py-10">
        <div className="mx-auto max-w-xl">
          <div className="flex items-start justify-between">
            {trlSteps.map((step, index) => (
              <div key={step.trl} className="flex flex-1 flex-col items-center">
                {/* Top: circle + connector */}
                <div className="flex w-full items-center">
                  {/* Left connector */}
                  {index > 0 && (
                    <div
                      className={`h-0.5 flex-1 ${
                        step.status === "active"
                          ? "bg-primary"
                          : "bg-border/60"
                      }`}
                    />
                  )}
                  {index === 0 && <div className="flex-1" />}

                  {/* Circle */}
                  <div
                    className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
                      step.status === "active"
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                        : "border-2 border-border bg-background text-muted-foreground"
                    }`}
                  >
                    {index + 1}
                  </div>

                  {/* Right connector */}
                  {index < trlSteps.length - 1 && (
                    <div className="h-0.5 flex-1 bg-border/60" />
                  )}
                  {index === trlSteps.length - 1 && <div className="flex-1" />}
                </div>

                {/* Labels */}
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {step.trl}
                </p>
                <p
                  className={`text-xs ${
                    step.status === "active"
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Milestones ---- */}
      <section className="px-4 pb-20">
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          {milestones.map((milestone, mIndex) => {
            const isExpanded = expandedId === milestone.id
            return (
              <div
                key={milestone.id}
                className="overflow-hidden rounded-xl border border-border/50 bg-card/60 shadow-sm"
              >
                {/* ---- Header ---- */}
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId(isExpanded ? null : milestone.id)
                  }
                  className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-secondary/20"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${
                        mIndex === 0
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {milestone.id}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {milestone.title || "New Milestone"}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>TRL {currentTrl}</span>
                        <span className="text-border">|</span>
                        <span>
                          {mIndex === 0 ? "In Progress" : "Draft"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {mIndex === 0 && (
                      <>
                        <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
                          TRL {currentTrl}
                        </span>
                        <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                          In Progress
                        </span>
                      </>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {/* ---- Expanded Content ---- */}
                {isExpanded && (
                  <div className="border-t border-border/40 px-5 py-6">
                    <div className="flex flex-col gap-6">
                      {/* Title */}
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-foreground">
                          Milestone Title
                        </label>
                        <input
                          type="text"
                          value={milestone.title}
                          onChange={(e) =>
                            updateMilestone(milestone.id, {
                              title: e.target.value,
                            })
                          }
                          className="rounded-xl border border-border bg-secondary/30 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                          placeholder="Enter milestone title"
                        />
                      </div>

                      {/* What are you proving */}
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-foreground">
                          What are you proving?
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {provingOptions.map((option) => {
                            const Icon = option.icon
                            const isSelected = milestone.proving.includes(
                              option.label
                            )
                            return (
                              <button
                                key={option.label}
                                type="button"
                                onClick={() =>
                                  toggleArrayItem(
                                    milestone.id,
                                    "proving",
                                    option.label,
                                    2
                                  )
                                }
                                className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium transition-all ${
                                  isSelected
                                    ? "border-accent bg-accent/15 text-accent shadow-sm shadow-accent/10"
                                    : "border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground"
                                }`}
                              >
                                {isSelected ? (
                                  <Check className="h-3.5 w-3.5" />
                                ) : (
                                  <Icon className="h-3.5 w-3.5" />
                                )}
                                {option.label}
                              </button>
                            )
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Select up to 2 categories
                        </p>
                      </div>

                      {/* Description */}
                      <div className="flex flex-col gap-2">
                        <textarea
                          rows={3}
                          value={milestone.description}
                          onChange={(e) =>
                            updateMilestone(milestone.id, {
                              description: e.target.value,
                            })
                          }
                          className="resize-none rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                          placeholder="E.g. Reproduce supercapacitor performance in 3 independent lab tests within +/-10% variance"
                        />
                        <p className="text-xs text-muted-foreground">
                          TRL {currentTrl} milestone template: {template.budget}
                        </p>
                      </div>

                      {/* Budget & Duration */}
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="flex flex-col gap-2">
                          <label className="text-sm font-medium text-foreground">
                            Budget Needed
                          </label>
                          <div className="flex items-center overflow-hidden rounded-xl border border-border bg-secondary/30 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30">
                            <span className="flex items-center justify-center border-r border-border bg-muted/30 px-3 py-2.5">
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                            </span>
                            <input
                              type="text"
                              value={milestone.budget}
                              onChange={(e) =>
                                updateMilestone(milestone.id, {
                                  budget: e.target.value,
                                })
                              }
                              className="w-full bg-transparent px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                              placeholder="40,000"
                            />
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-sm font-medium text-foreground">
                            Duration
                          </label>
                          <div className="relative">
                            <select
                              value={milestone.duration}
                              onChange={(e) =>
                                updateMilestone(milestone.id, {
                                  duration: e.target.value,
                                })
                              }
                              className="w-full appearance-none rounded-xl border border-border bg-secondary/30 px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                            >
                              {durationOptions.map((d) => (
                                <option key={d} value={d}>
                                  {d}
                                </option>
                              ))}
                            </select>
                            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                              <ChevronDown className="h-4 w-4" />
                            </div>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        TRL {currentTrl} milestone template: {template.duration}
                      </p>

                      {/* Risk Category */}
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-foreground">
                          Risk Category
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {riskOptions.map((option) => {
                            const Icon = option.icon
                            const isSelected = milestone.riskCategory.includes(
                              option.label
                            )
                            return (
                              <button
                                key={option.label}
                                type="button"
                                onClick={() =>
                                  toggleArrayItem(
                                    milestone.id,
                                    "riskCategory",
                                    option.label
                                  )
                                }
                                className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium transition-all ${
                                  isSelected
                                    ? "border-accent bg-accent/15 text-accent shadow-sm shadow-accent/10"
                                    : "border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground"
                                }`}
                              >
                                {isSelected ? (
                                  <Check className="h-3.5 w-3.5" />
                                ) : (
                                  <Icon className="h-3.5 w-3.5" />
                                )}
                                {option.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => removeMilestone(milestone.id)}
                          className="flex items-center gap-2 rounded-full border border-border px-5 py-2 text-sm text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedId(null)}
                          className="flex items-center gap-2 rounded-full bg-gradient-to-r from-accent/80 to-primary/80 px-5 py-2 text-sm font-medium text-foreground shadow-sm transition-opacity hover:opacity-90"
                        >
                          <Plus className="h-4 w-4" />
                          Add Milestone
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Add Milestone button */}
          <button
            type="button"
            onClick={addMilestone}
            className="flex items-center gap-2 rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-card/40 hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
            Add Milestone
          </button>

          {/* Submit CTA */}
          <div className="mt-6 flex flex-col items-center gap-3">
            {error && (
              <div role="alert" className="flex w-full items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <button
              type="button"
              onClick={handleSubmitMilestones}
              disabled={loading || !projectId || !project}
              className="inline-flex items-center rounded-full bg-primary px-8 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit All Milestones"
              )}
            </button>
            <p className="text-xs text-muted-foreground">
              Your milestones will be saved and linked to your project.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
