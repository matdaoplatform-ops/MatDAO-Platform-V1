"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useAuth } from "@/context/auth-context"
import { supabase, PROJECT_STATUS_LABELS } from "@/lib/supabase/client"
import type { ProjectStatus } from "@/lib/supabase/client"
import { RequireAuth } from "@/components/auth/require-auth"
import {
  FileText,
  DollarSign,
  Clock,
  CheckCircle,
  Plus,
  Eye,
  Award,
  Users,
  Calendar,
  Loader2,
  Beaker,
  MessageSquareWarning,
} from "lucide-react"
import { getAllMockReports } from "@/lib/ai-studio/mockReports"

interface Project {
  id: string
  title: string
  trl: number
  funding_goal: number
  funding_raised: number
  status: ProjectStatus
  phase: string
  review_notes: string | null
  created_at: string
  updated_at: string
  milestones: {
    total: number
    completed: number
    pending: number
  }
  weeks_in_progress: number
  investor_count: number
}

interface AIReport {
  id: string
  projectId: string
  projectName: string
  trlScore: number
  ipScore: number
  dueDiligenceScore: number | null
  overallScore: number
  generatedAt: string
  status: "complete" | "processing" | "failed"
}


export default function ResearcherDashboardPage() {
  return (
    <RequireAuth roles={["researcher"]}>
      <ResearcherDashboard />
    </RequireAuth>
  )
}

function ResearcherDashboard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<"projects" | "reports" | "funding">("projects")
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const fetchProjects = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setLoadError(null)
    try {
      const { data: projectData, error } = await supabase
        .from("projects")
        .select("*")
        .eq("researcher_id", user.id)
        .order("created_at", { ascending: false })
      if (error) throw error

      const ids = (projectData ?? []).map((p) => p.id)
      // Milestone counts come from the researcher's own submitted milestones.
      const milestoneCounts = new Map<string, { total: number; completed: number }>()
      if (ids.length > 0) {
        const { data: milestoneRows } = await supabase
          .from("submitted_milestones")
          .select("project_id, status")
          .in("project_id", ids)
        for (const m of milestoneRows ?? []) {
          const entry = milestoneCounts.get(m.project_id) ?? { total: 0, completed: 0 }
          entry.total += 1
          if (m.status === "completed") entry.completed += 1
          milestoneCounts.set(m.project_id, entry)
        }
      }

      setProjects(
        (projectData ?? []).map((p) => {
          const m = milestoneCounts.get(p.id) ?? { total: 0, completed: 0 }
          return {
            id: p.id,
            title: p.title,
            trl: p.trl,
            funding_goal: p.funding_goal,
            funding_raised: p.funding_raised ?? 0,
            status: p.status,
            phase: p.phase,
            review_notes: p.review_notes,
            created_at: p.created_at,
            updated_at: p.updated_at,
            milestones: { total: m.total, completed: m.completed, pending: m.total - m.completed },
            weeks_in_progress: Math.max(
              0,
              Math.ceil((Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24 * 7)),
            ),
            investor_count: 0, // Investor tracking is not wired to the escrow yet.
          }
        }),
      )
    } catch (err) {
      console.error("Error fetching projects:", err)
      setLoadError(err instanceof Error ? err.message : "Could not load your projects")
      setProjects([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const displayProjects = projects
  
  // Generate AI reports from mock data
  const mockAIReports: AIReport[] = getAllMockReports().map(report => ({
    id: `report-${report.id}`,
    projectId: report.id,
    projectName: report.title,
    trlScore: report.summary.trl,
    ipScore: report.summary.ipScore,
    dueDiligenceScore: report.summary.dueDiligenceScore,
    overallScore: Math.round((report.summary.ipScore + (report.summary.dueDiligenceScore || 0)) / 2),
    generatedAt: new Date().toISOString(),
    status: "complete" as const
  }))

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-400"
    if (score >= 60) return "text-yellow-400"
    return "text-red-400"
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
      case "pending_review": return "bg-blue-500/20 text-blue-400 border-blue-500/40"
      case "under_review": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/40"
      case "changes_requested": return "bg-orange-500/20 text-orange-400 border-orange-500/40"
      case "rejected": return "bg-red-500/20 text-red-400 border-red-500/40"
      case "draft": return "bg-gray-500/20 text-gray-400 border-gray-500/40"
      case "complete": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
      case "processing": return "bg-blue-500/20 text-blue-400 border-blue-500/40"
      case "failed": return "bg-red-500/20 text-red-400 border-red-500/40"
      default: return "bg-gray-500/20 text-gray-400 border-gray-500/40"
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/60 bg-card/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Researcher Dashboard</h1>
              <p className="mt-2 text-muted-foreground">
                Manage your projects, track AI analysis reports, and monitor funding progress
              </p>
            </div>
            <Link
              href="/submit"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              New Project
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border/60 bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-3">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Projects</p>
                <p className="text-2xl font-bold text-foreground">{displayProjects.length}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-3">
                <Award className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">AI Reports</p>
                <p className="text-2xl font-bold text-foreground">{mockAIReports.length}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-3">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Raised</p>
                <p className="text-2xl font-bold text-foreground">
                  ${displayProjects.reduce((sum, p) => sum + p.funding_raised, 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-3">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Investors</p>
                <p className="text-2xl font-bold text-foreground">
                  {displayProjects.reduce((sum, p) => sum + p.investor_count, 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex gap-2 border-b border-border/60">
          <button
            onClick={() => setActiveTab("projects")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "projects"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            My Projects
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "reports"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            AI Reports
          </button>
          <button
            onClick={() => setActiveTab("funding")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "funding"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Funding Progress
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {activeTab === "projects" && loading && (
          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your projects…
          </div>
        )}
        {activeTab === "projects" && !loading && loadError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
            {loadError}{" "}
            <button onClick={fetchProjects} className="underline">
              Retry
            </button>
          </div>
        )}
        {activeTab === "projects" && !loading && !loadError && displayProjects.length === 0 && (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Beaker className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">No projects yet</h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Submit your first research project. Once the TTO team approves it, it appears on the marketplace and you
                can start unlocking milestone funding.
              </p>
            </div>
            <Link
              href="/submit"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Submit a project
            </Link>
          </div>
        )}
        {activeTab === "projects" && !loading && (
          <div className="space-y-4">
            {displayProjects.map((project) => (
              <div
                key={project.id}
                className="rounded-xl border border-border/60 bg-card p-6 transition-all hover:shadow-lg"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex-1">
                    <div className="mb-3 flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-foreground">{project.title}</h3>
                      <span className={`rounded-full border px-3 py-1 text-xs font-medium ${getStatusColor(project.status)}`}>
                        {PROJECT_STATUS_LABELS[project.status] ?? project.status}
                      </span>
                    </div>
                    {(project.status === "changes_requested" || project.status === "rejected") && project.review_notes && (
                      <div className="mb-4 flex items-start gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 p-3 text-sm">
                        <MessageSquareWarning className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
                        <div>
                          <p className="font-medium text-orange-300">Reviewer notes</p>
                          <p className="whitespace-pre-wrap text-muted-foreground">{project.review_notes}</p>
                        </div>
                      </div>
                    )}
                    <div className="mb-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <p className="text-xs text-muted-foreground">TRL Level</p>
                        <p className="text-lg font-semibold text-foreground">TRL {project.trl}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Funding Raised</p>
                        <p className="text-lg font-semibold text-foreground">${project.funding_raised.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Weeks in Progress</p>
                        <p className="text-lg font-semibold text-foreground">{project.weeks_in_progress}w</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Investors</p>
                        <p className="text-lg font-semibold text-foreground">{project.investor_count}</p>
                      </div>
                    </div>

                    {/* Milestone Progress */}
                    <div className="mb-4">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Milestone Progress</span>
                        <span className="font-medium text-foreground">
                          {project.milestones.completed}/{project.milestones.total}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-secondary/20">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${project.milestones.total ? (project.milestones.completed / project.milestones.total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>

                    {/* Funding Progress */}
                    <div className="mb-4">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Funding Progress</span>
                        <span className="font-medium text-foreground">
                          {project.funding_goal ? Math.round((project.funding_raised / project.funding_goal) * 100) : 0}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-secondary/20">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${project.funding_goal ? Math.min(100, Math.round((project.funding_raised / project.funding_goal) * 100)) : 0}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Goal: ${project.funding_goal.toLocaleString()}
                      </p>
                    </div>

                    {/* Timeline */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Started {new Date(project.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Updated {new Date(project.updated_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {project.status === "approved" ? (
                      <Link
                        href={`/project/${project.id}`}
                        className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/20 px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/30"
                      >
                        <Eye className="h-4 w-4" />
                        View Details
                      </Link>
                    ) : (
                      <Link
                        href={`/submit/milestone?projectId=${project.id}`}
                        className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/20 px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/30"
                      >
                        <Eye className="h-4 w-4" />
                        Milestones
                      </Link>
                    )}
                    <Link
                      href="/ai-studio"
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      <FileText className="h-4 w-4" />
                      Generate Report
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "reports" && (
          <div className="space-y-4">
            {mockAIReports.map((report) => (
              <div
                key={report.id}
                className="rounded-xl border border-border/60 bg-card p-6 transition-all hover:shadow-lg"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex-1">
                    <div className="mb-3 flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-foreground">{report.projectName}</h3>
                      <span className={`rounded-full border px-3 py-1 text-xs font-medium ${getStatusColor(report.status)}`}>
                        {report.status}
                      </span>
                    </div>
                    <div className="grid gap-4 md:grid-cols-4">
                      <div>
                        <p className="text-xs text-muted-foreground">TRL Score</p>
                        <p className={`text-lg font-semibold ${getScoreColor(report.trlScore)}`}>{report.trlScore}/9</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">IP Score</p>
                        <p className={`text-lg font-semibold ${getScoreColor(report.ipScore)}`}>{report.ipScore}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Due Diligence</p>
                        <p className={`text-lg font-semibold ${getScoreColor(report.dueDiligenceScore || 0)}`}>{report.dueDiligenceScore || 0}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Overall</p>
                        <p className={`text-lg font-semibold ${getScoreColor(report.overallScore)}`}>{report.overallScore}%</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href="/ai-studio"
                      className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/20 px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/30"
                    >
                      <Eye className="h-4 w-4" />
                      Open in AI Studio
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "funding" && !loading && displayProjects.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground">
            Funding progress appears here once you have an approved project.
          </div>
        )}
        {activeTab === "funding" && (
          <div className="space-y-4">
            {displayProjects.map((project) => (
              <div
                key={project.id}
                className="rounded-xl border border-border/60 bg-card p-6 transition-all hover:shadow-lg"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex-1">
                    <h3 className="mb-3 text-lg font-semibold text-foreground">{project.title}</h3>
                    <div className="mb-4">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">${project.funding_raised.toLocaleString()} raised of ${project.funding_goal.toLocaleString()}</span>
                        <span className="font-medium text-foreground">
                          {project.funding_goal ? Math.round((project.funding_raised / project.funding_goal) * 100) : 0}%
                        </span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-secondary/20">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 transition-all"
                          style={{ width: `${project.funding_goal ? Math.min(100, Math.round((project.funding_raised / project.funding_goal) * 100)) : 0}%` }}
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Investors</p>
                          <p className="text-sm font-semibold text-foreground">{project.investor_count}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Weeks Active</p>
                          <p className="text-sm font-semibold text-foreground">{project.weeks_in_progress}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Milestones</p>
                          <p className="text-sm font-semibold text-foreground">{project.milestones.completed}/{project.milestones.total}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={project.status === "approved" ? `/project/${project.id}` : `/submit/milestone?projectId=${project.id}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/20 px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/30"
                    >
                      <Eye className="h-4 w-4" />
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
