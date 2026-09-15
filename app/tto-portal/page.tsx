"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import toast from "react-hot-toast"
import {
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  User,
  Building2,
  Loader2,
  RefreshCw,
  Download,
  MessageSquareWarning,
  Eye,
  Bell,
  ExternalLink,
} from "lucide-react"
import { RequireAuth } from "@/components/auth/require-auth"
import { useAuth } from "@/context/auth-context"
import { supabase, PROJECT_STATUS_LABELS } from "@/lib/supabase/client"
import type { ProjectRow, ProjectStatus, ProjectDocument, NotificationRow } from "@/lib/supabase/client"
import { signProjectDocuments } from "@/lib/supabase/storage"
import { notifySubmission } from "@/lib/supabase/notify"

type QueueTab = "queue" | "approved" | "rejected"
type Decision = "approved" | "rejected" | "changes_requested" | "under_review"

const QUEUE_STATUSES: ProjectStatus[] = ["pending_review", "under_review", "changes_requested"]

interface QueueProject extends ProjectRow {
  researcher: { name: string; email: string; university: string | null } | null
}

const STATUS_STYLES: Record<ProjectStatus, string> = {
  draft: "text-white/60 bg-white/5 border-white/20",
  pending_review: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  under_review: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  changes_requested: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  approved: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  rejected: "text-red-400 bg-red-500/10 border-red-500/30",
}

function kv(list: { key: string; value: string }[] | null | undefined, key: string): string {
  return list?.find((d) => d.key === key)?.value?.trim() || ""
}

function formatBytes(bytes: number): string {
  if (!bytes) return ""
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function TtoPortalContent() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<QueueTab>("queue")
  const [projects, setProjects] = useState<QueueProject[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("project"))
  const [notes, setNotes] = useState("")
  const [acting, setActing] = useState<Decision | null>(null)
  const [documents, setDocuments] = useState<(ProjectDocument & { url: string | null })[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [notifications, setNotifications] = useState<NotificationRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    const statuses: ProjectStatus[] = tab === "queue" ? QUEUE_STATUSES : [tab]
    const { data, error } = await supabase
      .from("projects")
      .select("*, researcher:profiles!projects_researcher_id_fkey(name, email, university)")
      .in("status", statuses)
      .order("created_at", { ascending: false })
    if (error) {
      setLoadError(error.message)
      setProjects([])
    } else {
      setProjects((data ?? []) as unknown as QueueProject[])
    }
    setLoading(false)
  }, [tab])

  const loadNotifications = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_role", "staff")
      .eq("read", false)
      .order("created_at", { ascending: false })
      .limit(20)
    setNotifications(data ?? [])
  }, [])

  useEffect(() => {
    if (!user) return
    load()
    loadNotifications()
  }, [user, load, loadNotifications])

  const selected = useMemo(() => projects.find((p) => p.id === selectedId) ?? null, [projects, selectedId])

  // Signed URLs for the selected project's documents.
  useEffect(() => {
    let cancelled = false
    if (!selected) {
      setDocuments([])
      return
    }
    setDocsLoading(true)
    setNotes(selected.review_notes ?? "")
    signProjectDocuments(selected.documents).then((docs) => {
      if (!cancelled) {
        setDocuments(docs)
        setDocsLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [selected])

  async function markNotificationsRead(projectId: string) {
    const ids = notifications.filter((n) => n.project_id === projectId).map((n) => n.id)
    if (ids.length === 0) return
    await supabase.from("notifications").update({ read: true }).in("id", ids)
    setNotifications((prev) => prev.filter((n) => !ids.includes(n.id)))
  }

  async function decide(decision: Decision) {
    if (!selected || !user) return
    if ((decision === "rejected" || decision === "changes_requested") && !notes.trim()) {
      toast.error("Please add a note for the researcher explaining the decision.")
      return
    }
    setActing(decision)
    const nextStatus: ProjectStatus = decision
    try {
      const { error: updateError } = await supabase
        .from("projects")
        .update({
          status: nextStatus,
          review_notes: notes.trim() || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", selected.id)
      if (updateError) throw new Error(updateError.message)

      const { error: reviewError } = await supabase.from("project_reviews").insert({
        project_id: selected.id,
        reviewer_id: user.id,
        decision,
        notes: notes.trim() || null,
      })
      if (reviewError) console.warn("Could not record review row:", reviewError.message)

      // Notification row + email to the submitter (server route; never fatal).
      const notify = await notifySubmission({ type: "project_reviewed", projectId: selected.id, decision, notes: notes.trim() || null })

      await markNotificationsRead(selected.id)

      const label = PROJECT_STATUS_LABELS[nextStatus]
      toast.success(
        notify.emailed
          ? `${selected.title}: ${label}. Researcher emailed.`
          : `${selected.title}: ${label}.${notify.reason ? ` (email not sent: ${notify.reason})` : ""}`,
      )
      setSelectedId(null)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the decision")
    } finally {
      setActing(null)
    }
  }

  const counts = useMemo(
    () => ({
      queue: projects.filter((p) => QUEUE_STATUSES.includes(p.status)).length,
      pending: projects.filter((p) => p.status === "pending_review").length,
    }),
    [projects],
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-950 to-black px-5 py-12 sm:px-6">
      <div className="relative z-10 mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-[#6efcff]/30 to-[#6efcff]/10">
              <Shield className="w-6 h-6 text-[#c5fdff]" />
            </div>
            <div>
              <h1 className="font-headline text-3xl font-bold text-white/95">TTO Review Queue</h1>
              <p className="text-sm text-white/50">Review project submissions before they go live on the marketplace</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(["queue", "approved", "rejected"] as QueueTab[]).map((f) => (
              <button
                key={f}
                onClick={() => {
                  setTab(f)
                  setSelectedId(null)
                }}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  tab === f
                    ? "bg-[#6efcff]/20 text-[#c5fdff] border border-[#6efcff]/40"
                    : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"
                }`}
              >
                {f === "queue" ? "Review queue" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
            <button
              onClick={() => {
                load()
                loadNotifications()
              }}
              disabled={loading}
              aria-label="Refresh"
              className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-white/60 hover:bg-white/10 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-5 backdrop-blur-sm">
            <p className="text-xs text-white/50 mb-1 uppercase tracking-wider">In this view</p>
            <p className="text-2xl font-bold text-white/90">{projects.length}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-5 backdrop-blur-sm">
            <p className="text-xs text-white/50 mb-1 uppercase tracking-wider">Awaiting first review</p>
            <p className="text-2xl font-bold text-[#c5fdff]">{tab === "queue" ? counts.pending : "—"}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-5 backdrop-blur-sm">
            <p className="text-xs text-white/50 mb-1 uppercase tracking-wider">Unread notifications</p>
            <p className="text-2xl font-bold text-purple-400">{notifications.length}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-5 backdrop-blur-sm">
            <p className="text-xs text-white/50 mb-1 uppercase tracking-wider">With documents</p>
            <p className="text-2xl font-bold text-emerald-400">
              {projects.filter((p) => Array.isArray(p.documents) && p.documents.length > 0).length}
            </p>
          </div>
        </div>

        {loadError && (
          <div role="alert" className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {loadError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List */}
          <div className="lg:col-span-2 space-y-4">
            {loading ? (
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 p-8 text-sm text-white/50">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading submissions…
              </div>
            ) : projects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-10 text-center">
                <Bell className="mx-auto mb-3 h-8 w-8 text-white/30" />
                <p className="text-sm font-medium text-white/80">
                  {tab === "queue" ? "The queue is empty" : `No ${tab} projects yet`}
                </p>
                <p className="mt-1 text-xs text-white/50">
                  {tab === "queue" ? "New submissions appear here as soon as researchers send them." : ""}
                </p>
              </div>
            ) : (
              projects.map((project) => {
                const unread = notifications.some((n) => n.project_id === project.id)
                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => setSelectedId(project.id)}
                    className={`w-full rounded-2xl border p-5 text-left backdrop-blur-sm transition-all ${
                      selectedId === project.id
                        ? "border-[#6efcff]/40 bg-gradient-to-br from-[#6efcff]/10 to-[#6efcff]/5"
                        : "border-white/10 bg-black/30 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3 className="font-semibold text-white/90">{project.title}</h3>
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${STATUS_STYLES[project.status]}`}>
                            {PROJECT_STATUS_LABELS[project.status]}
                          </span>
                          {unread && (
                            <span className="rounded-full bg-[#6efcff] px-1.5 py-0.5 text-[10px] font-bold text-black">NEW</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/50">
                          <span className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            {project.researcher?.name ?? "Unknown researcher"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Building2 className="w-4 h-4" />
                            {project.institution || project.researcher?.university || "—"}
                          </span>
                          <span>{new Date(project.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-white/50 mb-1">TRL</p>
                        <p className="font-semibold text-white/90">TRL {project.trl}</p>
                      </div>
                      <div>
                        <p className="text-white/50 mb-1">Field</p>
                        <p className="font-semibold text-white/90 truncate">{project.working_field || kv(project.description, "workingField") || "—"}</p>
                      </div>
                      <div>
                        <p className="text-white/50 mb-1">Documents</p>
                        <p className="font-semibold text-white/90">{Array.isArray(project.documents) ? project.documents.length : 0}</p>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Detail */}
          {selected ? (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-6 backdrop-blur-sm lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
              <div className="mb-6 flex items-start justify-between gap-3">
                <h2 className="font-headline text-xl font-bold text-white/95">Review</h2>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${STATUS_STYLES[selected.status]}`}>
                  {PROJECT_STATUS_LABELS[selected.status]}
                </span>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <p className="text-xs text-white/50 mb-1 uppercase tracking-wider">Title</p>
                  <p className="text-base font-semibold text-white/90">{selected.title}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-white/50 mb-1 uppercase tracking-wider">Submitter</p>
                    <p className="text-sm text-white/70">{selected.researcher?.name ?? "—"}</p>
                    <p className="text-xs text-white/40 break-all">{selected.submitter_email || selected.researcher?.email || ""}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/50 mb-1 uppercase tracking-wider">Institution</p>
                    <p className="text-sm text-white/70">{selected.institution || selected.researcher?.university || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/50 mb-1 uppercase tracking-wider">TRL</p>
                    <p className="text-sm text-white/70">TRL {selected.trl}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/50 mb-1 uppercase tracking-wider">Funding goal</p>
                    <p className="text-sm text-white/70">${Number(selected.funding_goal || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Description fields */}
              <div className="rounded-xl border border-white/10 bg-black/20 p-4 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Eye className="w-5 h-5 text-[#c5fdff]" />
                  <h3 className="font-semibold text-white/90">Submission</h3>
                </div>
                <dl className="space-y-3 text-sm">
                  {[
                    ["Working field", selected.working_field || kv(selected.description, "workingField")],
                    ["Target audience", kv(selected.description, "targetAudience")],
                    ["Pain points", kv(selected.description, "painPoints")],
                    ["Market size", kv(selected.description, "marketSize")],
                    ["Business model", kv(selected.technical_specs, "businessModel")],
                    ["Funding needed", kv(selected.description, "fundingNeeded")],
                    ["Partner needed", kv(selected.description, "partnerNeeded")],
                    ["License", kv(selected.description, "license")],
                    ["Milestones", kv(selected.technical_specs, "milestones")],
                    ["Timeline", kv(selected.technical_specs, "timeline")],
                  ]
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-white/50">{k}</dt>
                        <dd className="whitespace-pre-wrap text-white/85">{v}</dd>
                      </div>
                    ))}
                </dl>
              </div>

              {/* Documents */}
              <div className="rounded-xl border border-white/10 bg-black/20 p-4 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-5 h-5 text-[#c5fdff]" />
                  <h3 className="font-semibold text-white/90">Documents</h3>
                </div>
                {docsLoading ? (
                  <p className="flex items-center gap-2 text-xs text-white/50">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparing secure links…
                  </p>
                ) : documents.length === 0 ? (
                  <p className="text-xs text-white/50">No documents were attached.</p>
                ) : (
                  <ul className="space-y-2">
                    {documents.map((doc) => (
                      <li key={doc.path} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="truncate text-white/85">{doc.name}</p>
                          <p className="text-[11px] text-white/40">
                            {doc.kind} {doc.size ? `· ${formatBytes(doc.size)}` : ""}
                          </p>
                        </div>
                        {doc.url ? (
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex shrink-0 items-center gap-1 rounded-lg border border-[#6efcff]/30 bg-[#6efcff]/10 px-2.5 py-1.5 text-xs text-[#c5fdff] hover:bg-[#6efcff]/20"
                          >
                            <Download className="h-3.5 w-3.5" /> Open
                          </a>
                        ) : (
                          <span className="text-[11px] text-white/40">unavailable</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Existing review info */}
              {selected.reviewed_at && (
                <p className="mb-4 text-xs text-white/45">
                  Last reviewed {new Date(selected.reviewed_at).toLocaleString()}
                </p>
              )}

              {/* Notes + actions */}
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs uppercase tracking-wider text-white/50">Notes to researcher</span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    placeholder="Required when rejecting or requesting changes."
                    className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#6efcff] focus:outline-none"
                  />
                </label>

                {selected.status !== "approved" && (
                  <button
                    onClick={() => decide("approved")}
                    disabled={acting !== null}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                  >
                    {acting === "approved" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Approve &amp; publish
                  </button>
                )}
                {selected.status !== "changes_requested" && selected.status !== "approved" && (
                  <button
                    onClick={() => decide("changes_requested")}
                    disabled={acting !== null}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-400 hover:bg-amber-500/20 transition-all disabled:opacity-50"
                  >
                    {acting === "changes_requested" ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquareWarning className="w-4 h-4" />}
                    Request changes
                  </button>
                )}
                {selected.status === "pending_review" && (
                  <button
                    onClick={() => decide("under_review")}
                    disabled={acting !== null}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white/70 hover:bg-white/10 transition-all disabled:opacity-50"
                  >
                    {acting === "under_review" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                    Mark as under review
                  </button>
                )}
                {selected.status !== "rejected" && (
                  <button
                    onClick={() => decide("rejected")}
                    disabled={acting !== null}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50"
                  >
                    {acting === "rejected" ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                    Reject
                  </button>
                )}
                {selected.status === "approved" && (
                  <Link
                    href={`/project/${selected.id}`}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white/70 hover:bg-white/10"
                  >
                    <ExternalLink className="h-4 w-4" /> View public page
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="hidden rounded-2xl border border-dashed border-white/15 bg-black/20 p-8 text-center text-sm text-white/50 lg:block">
              Select a submission to review it.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TTOPortalPage() {
  return (
    <RequireAuth roles={["staff"]}>
      <Suspense fallback={null}>
        <TtoPortalContent />
      </Suspense>
    </RequireAuth>
  )
}
