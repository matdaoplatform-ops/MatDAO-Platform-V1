"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import toast from "react-hot-toast"
import { keccak256, toHex } from "viem"
import {
  AlertTriangle,
  CheckCircle,
  Send,
  Shield,
  ShieldAlert,
  XCircle,
  ThumbsUp,
  ThumbsDown,
  FileEdit,
  Loader2,
  Clock,
  TrendingUp,
  Award,
  RefreshCw,
  Gem,
  Hammer,
} from "lucide-react"
import { MarkdownReport } from "@/components/trl-services/MarkdownReport"
import { TrlBackendStatus } from "@/components/trl-services/TrlBackendStatus"
import { RequireAuth } from "@/components/auth/require-auth"
import { useAuth } from "@/context/auth-context"
import { supabase } from "@/lib/supabase/client"
import type { IpStatus, ProjectRow, VerificationTaskRow } from "@/lib/supabase/client"
import { MILESTONE_LABELS } from "@/lib/trl-services/storage"
import { submitVerification } from "@/lib/trl-services/api"
import { useMintIPNFT } from "@/lib/web3/hooks/useMintIPNFT"
import { uploadMetadataToIPFSDetailedAction } from "@/lib/ipfs/uploadMetadataToIPFSAction"
import type { VerificationTask } from "@/lib/trl-services/types"

const AI_UNAVAILABLE_REPORT = "AI audit unavailable — the TRL Services backend could not be reached. A reviewer will assess this proof manually."

function rowToTask(t: VerificationTaskRow): VerificationTask {
  return {
    id: t.id,
    title: t.title,
    milestoneName: t.milestone_name,
    projectId: t.project_id,
    projectTitle: t.project_title,
    proofText: t.proof_text,
    submittedBy: t.submitted_by,
    submittedAt: t.submitted_at,
    aiPassed: t.ai_passed,
    aiPlagiarismScore: t.ai_plagiarism_score,
    aiConsistencyReport: t.ai_consistency_report ?? "",
    humanVoted: t.human_voted,
    humanPassed: t.human_passed ?? undefined,
    humanNotes: t.human_notes ?? undefined,
    status: t.status,
  }
}

type ProjectLite = Pick<ProjectRow, "id" | "title" | "status" | "phase" | "trl" | "researcher_id" | "ip_status" | "working_field" | "description">

/**
 * Scores for the IP-NFT metadata are derived from the project's verified
 * tasks (and its latest AI Studio assessment when one exists) instead of
 * fixed numbers.
 */
function deriveScores(tasks: VerificationTask[], assessment: { ip_score: number; due_diligence_score: number | null } | null, trl: number) {
  const verified = tasks.filter((t) => t.status === "verified")
  const integritySamples = verified.map((t) => Math.max(0, Math.min(100, 100 - (t.aiPlagiarismScore ?? 0))))
  const scientificIntegrity = integritySamples.length
    ? Math.round(integritySamples.reduce((a, b) => a + b, 0) / integritySamples.length)
    : 0
  const aiPassRate = verified.length ? Math.round((verified.filter((t) => t.aiPassed).length / verified.length) * 100) : 0
  const ipNovelty = assessment?.ip_score ?? Math.round(scientificIntegrity * 0.6 + aiPassRate * 0.4)
  const commercialViability = assessment?.due_diligence_score ?? Math.min(100, Math.round(trl * 10 + aiPassRate * 0.1))
  const avg = (scientificIntegrity + ipNovelty + commercialViability) / 3
  const validationTier = avg >= 85 ? "Tier A" : avg >= 70 ? "Tier B" : avg >= 55 ? "Tier C" : "Tier D"
  return { commercialViability, scientificIntegrity, ipNovelty, validationTier, verifiedCount: verified.length }
}

/**
 * A project is "fully verified" when it has at least one verified task and
 * every non-rejected task is verified (rejected proofs are excluded so a
 * single rejection cannot block the project forever).
 */
function isFullyVerified(projectTasks: VerificationTask[]): boolean {
  const considered = projectTasks.filter((t) => t.status !== "rejected")
  return considered.length > 0 && considered.every((t) => t.status === "verified")
}

function AiAuditorContent() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<ProjectLite[]>([])
  const [tasks, setTasks] = useState<VerificationTask[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [mintingProjectId, setMintingProjectId] = useState<string | null>(null)
  const [actingTaskId, setActingTaskId] = useState<string | null>(null)

  const { mintIPNFT, isPending: isMintPending } = useMintIPNFT()

  const [title, setTitle] = useState("")
  const [submittedBy, setSubmittedBy] = useState("")
  const [milestoneName, setMilestoneName] = useState("prototype")
  const [projectId, setProjectId] = useState("")
  const [proofText, setProofText] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const [lastSubmitted, setLastSubmitted] = useState<VerificationTask | null>(null)
  const [editingTask, setEditingTask] = useState<VerificationTask | null>(null)
  const [editProofText, setEditProofText] = useState("")

  const isStaff = user?.role === "staff"
  const isResearcher = user?.role === "researcher"

  useEffect(() => {
    if (user?.name && !submittedBy) setSubmittedBy(user.name)
  }, [user?.name, submittedBy])

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setLoadError(null)
    try {
      // Staff see every project; researchers see their own (RLS enforces both).
      let projectQuery = supabase
        .from("projects")
        .select("id, title, status, phase, trl, researcher_id, ip_status, working_field, description")
        .order("created_at", { ascending: false })
      if (!isStaff) projectQuery = projectQuery.eq("researcher_id", user.id)
      const { data: projectData, error: projectError } = await projectQuery
      if (projectError) throw projectError
      setProjects(projectData ?? [])

      const { data: taskData, error: taskError } = await supabase
        .from("verification_tasks")
        .select("*")
        .order("submitted_at", { ascending: false })
      if (taskError) throw taskError
      setTasks((taskData ?? []).map(rowToTask))

      setProjectId((current) => current || projectData?.[0]?.id || "")
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load auditor data")
    } finally {
      setLoading(false)
    }
  }, [user, isStaff])

  // Fetch only once auth has resolved (and again whenever the user changes).
  useEffect(() => {
    loadData()
  }, [loadData])

  const mintedProjects = useMemo(
    () => projects.filter((p) => (p.ip_status as IpStatus | null)?.status === "minted"),
    [projects],
  )
  /** Fully verified projects whose IP-NFT mint has not succeeded yet. */
  const awaitingMint = useMemo(
    () =>
      projects.filter(
        (p) =>
          (p.ip_status as IpStatus | null)?.status !== "minted" &&
          isFullyVerified(tasks.filter((t) => t.projectId === p.id)),
      ),
    [projects, tasks],
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!title.trim() || !proofText.trim() || !projectId) {
      setFormError("Title, proof text, and project are required.")
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      const targetProject = projects.find((p) => p.id === projectId)
      const projectTitle = targetProject?.title || "Custom Project"
      const author = submittedBy.trim() || user.name || "Researcher"

      const { data: inserted, error: insertError } = await supabase
        .from("verification_tasks")
        .insert({
          title: title.trim(),
          milestone_name: milestoneName,
          project_id: projectId,
          project_title: projectTitle,
          proof_text: proofText.trim(),
          submitted_by: author,
          submitted_by_id: user.id,
          ai_passed: false,
          ai_plagiarism_score: 0,
          ai_consistency_report: "Pending AI analysis…",
          status: "pending",
        })
        .select("*")
        .single()
      if (insertError || !inserted) throw new Error(insertError?.message || "Could not save the proof")

      // Best-effort AI audit via TRL Services; the row stays 'pending' either way.
      let aiUpdate: Partial<VerificationTaskRow>
      try {
        const audit = await submitVerification({
          title: title.trim(),
          milestoneName,
          projectId,
          projectTitle,
          proofText: proofText.trim(),
          submittedBy: author,
        })
        aiUpdate = {
          ai_passed: Boolean(audit.aiPassed),
          ai_plagiarism_score: Math.round(Number(audit.aiPlagiarismScore) || 0),
          ai_consistency_report: audit.aiConsistencyReport || "AI audit completed without a written report.",
          status: audit.aiPassed ? "pending" : "flagged",
        }
      } catch (auditError) {
        console.warn("AI audit unavailable:", auditError)
        aiUpdate = { ai_passed: false, ai_plagiarism_score: 0, ai_consistency_report: AI_UNAVAILABLE_REPORT, status: "pending" }
      }

      const { data: updated, error: updateError } = await supabase
        .from("verification_tasks")
        .update(aiUpdate)
        .eq("id", inserted.id)
        .select("*")
        .single()
      if (updateError) console.warn("Could not store AI audit result:", updateError.message)

      const task = rowToTask(updated ?? { ...inserted, ...aiUpdate })
      setLastSubmitted(task)
      setTitle("")
      setProofText("")
      toast.success(
        task.aiConsistencyReport === AI_UNAVAILABLE_REPORT
          ? "Proof submitted — AI audit unavailable, queued for manual review"
          : task.aiPassed
            ? "Proof submitted — AI screening passed"
            : "Proof submitted — AI flagged it for reviewer attention",
      )
      await loadData()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Submission failed"
      setFormError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  function handleEdit(task: VerificationTask) {
    setEditingTask(task)
    setEditProofText(task.proofText)
  }

  async function handleSaveEdit() {
    if (!editingTask || !editProofText.trim()) return
    const { error } = await supabase
      .from("verification_tasks")
      .update({ proof_text: editProofText.trim() })
      .eq("id", editingTask.id)
    if (error) {
      toast.error(`Failed to update proof: ${error.message}`)
      return
    }
    setTasks((prev) => prev.map((t) => (t.id === editingTask.id ? { ...t, proofText: editProofText.trim() } : t)))
    setEditingTask(null)
    setEditProofText("")
    toast.success("Proof updated")
  }

  async function handleApprove(task: VerificationTask) {
    setActingTaskId(task.id)
    try {
      const { error } = await supabase
        .from("verification_tasks")
        .update({ status: "verified", human_passed: true, human_voted: true })
        .eq("id", task.id)
      if (error) throw new Error(error.message)

      const nextTasks = tasks.map((t) =>
        t.id === task.id ? { ...t, status: "verified" as const, humanPassed: true, humanVoted: true } : t,
      )
      setTasks(nextTasks)
      toast.success(`Verified: ${task.title}`)

      // The project is approved once every non-rejected task is verified.
      const projectTasks = nextTasks.filter((t) => t.projectId === task.projectId)
      if (!isFullyVerified(projectTasks)) {
        const remaining = projectTasks.filter((t) => t.status !== "verified" && t.status !== "rejected").length
        toast(`${remaining} more proof${remaining === 1 ? "" : "s"} to verify before this project is approved.`, { icon: "⏳" })
        return
      }
      await approveAndMint(task.projectId, nextTasks)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve verification")
    } finally {
      setActingTaskId(null)
    }
  }

  /**
   * Mint first, then mark the project approved. If the mint fails (rejected
   * in wallet, wrong owner, Pinata not configured…) the phase is left
   * unchanged and the project shows a "Retry mint" button.
   */
  async function approveAndMint(projectId: string, currentTasks: VerificationTask[]) {
    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single()
    if (projectError || !projectData) throw new Error(projectError?.message || "Project not found")

    const ipStatus = projectData.ip_status as IpStatus | null
    if (ipStatus?.status === "minted") {
      if (projectData.phase !== "approved") await markApproved(projectData)
      return
    }

    const { data: researcher } = await supabase
      .from("profiles")
      .select("wallet_address")
      .eq("id", projectData.researcher_id)
      .maybeSingle()
    if (!researcher?.wallet_address) {
      toast("All proofs verified. The researcher has no linked wallet yet — mint the IP-NFT once they connect one.", { icon: "ℹ️", duration: 7000 })
      return
    }

    const minted = await handleMintIPNFT(projectData, researcher.wallet_address, currentTasks)
    if (minted && projectData.phase !== "approved") await markApproved(projectData)
  }

  async function markApproved(projectData: ProjectRow) {
    const { error: phaseError } = await supabase.from("projects").update({ phase: "approved" }).eq("id", projectData.id)
    if (phaseError) throw new Error(phaseError.message)
    toast.success(`${projectData.title} approved`)
    await loadData()
  }

  async function handleMintIPNFT(projectData: ProjectRow, walletAddress: string, currentTasks: VerificationTask[]): Promise<boolean> {
    if (mintingProjectId) return false
    setMintingProjectId(projectData.id)
    try {
      const { data: assessment } = await supabase
        .from("assessments")
        .select("ip_score, due_diligence_score")
        .eq("project_id", projectData.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      const projectTasks = currentTasks.filter((t) => t.projectId === projectData.id)
      const scores = deriveScores(projectTasks, assessment, projectData.trl)
      const researchField =
        projectData.working_field ||
        projectData.description?.find((d) => d.key === "workingField")?.value ||
        "Materials Science"

      const metadata = {
        title: projectData.title,
        description: `MatDAO IP-NFT representing validated material science research: ${projectData.title}`,
        researchField,
        scores: {
          commercialViability: scores.commercialViability,
          scientificIntegrity: scores.scientificIntegrity,
          ipNovelty: scores.ipNovelty,
          validationTier: scores.validationTier,
        },
        verifiedMilestones: projectTasks.filter((t) => t.status === "verified").map((t) => t.id),
        projectId: projectData.id,
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error("Your session has expired. Sign in again to mint.")

      const pin = await uploadMetadataToIPFSDetailedAction(
        {
          commercialViability: scores.commercialViability,
          scientificIntegrity: scores.scientificIntegrity,
          ipNovelty: scores.ipNovelty,
          validationTier: scores.validationTier,
        },
        { title: metadata.title, description: metadata.description, researchField },
        session.access_token,
      )
      if (pin.mock) {
        throw new Error(
          "IPFS pinning is not configured (PINATA_JWT is missing on the server), so the metadata could not be stored. Minting was not attempted — configure Pinata and use Retry mint.",
        )
      }
      const tokenURI = pin.uri
      const legalHash = keccak256(toHex(JSON.stringify(metadata)))

      // Throws on rejection / wrong owner / revert — nothing is marked minted until it resolves.
      const { hash, tokenId } = await mintIPNFT({
        researcher: walletAddress as `0x${string}`,
        tokenURI,
        legalHash,
      })

      const nextIpStatus: IpStatus = {
        type: "IP-NFT",
        status: "minted",
        details: tokenURI,
        txHash: hash,
        tokenId: tokenId != null ? tokenId.toString() : undefined,
        legalHash,
        mintedAt: new Date().toISOString(),
      }
      const { error: ipError } = await supabase.from("projects").update({ ip_status: nextIpStatus }).eq("id", projectData.id)
      if (ipError) {
        toast.error(`Minted (tx ${hash.slice(0, 10)}…) but could not record it: ${ipError.message}`)
      } else {
        toast.success(tokenId != null ? `IP-NFT #${tokenId.toString()} minted for ${projectData.title}` : `IP-NFT minted for ${projectData.title}`)
      }
      await loadData()
      return true
    } catch (err) {
      console.error("Error minting IP-NFT:", err)
      toast.error(err instanceof Error ? err.message : "Failed to mint IP-NFT", { duration: 8000 })
      return false
    } finally {
      setMintingProjectId(null)
    }
  }

  async function handleRetryMint(projectId: string) {
    setActingTaskId(projectId)
    try {
      await approveAndMint(projectId, tasks)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retry failed")
    } finally {
      setActingTaskId(null)
    }
  }

  async function handleReject(task: VerificationTask) {
    setActingTaskId(task.id)
    try {
      const { error } = await supabase
        .from("verification_tasks")
        .update({ status: "rejected", human_passed: false, human_voted: true })
        .eq("id", task.id)
      if (error) throw new Error(error.message)
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: "rejected" as const, humanPassed: false, humanVoted: true } : t)),
      )
      toast.success(`Rejected: ${task.title}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject verification")
    } finally {
      setActingTaskId(null)
    }
  }

  function statusIcon(task: VerificationTask) {
    if (task.status === "verified") return <CheckCircle className="h-4 w-4 text-emerald-400" />
    if (task.status === "rejected") return <XCircle className="h-4 w-4 text-red-400" />
    if (task.status === "flagged") return <ShieldAlert className="h-4 w-4 text-amber-400" />
    return <AlertTriangle className="h-4 w-4 text-white/40" />
  }

  const minting = mintingProjectId !== null || isMintPending

  return (
    <div className="relative min-h-[calc(100dvh-4rem)] px-5 py-12 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/16 via-black/26 to-black/56" />
      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="mb-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#6efcff]/35 bg-[#6efcff]/10 px-4 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[#c5fdff]">
            <Shield className="h-3.5 w-3.5" />
            AI Scientific Auditor
          </div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="font-headline mb-2 text-3xl font-extrabold text-white/95">
              {isStaff ? "Staff Verification Dashboard" : "Milestone Proof Verification"}
            </h1>
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70 hover:bg-white/10 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
          <p className="max-w-2xl text-sm text-white/60">
            {isStaff
              ? "Review and approve or reject milestone verification submissions from researchers. AI results are self-reported screening only; staff make the final decision. Once every non-rejected proof is verified, the IP-NFT is minted and only then is the project marked approved."
              : "Submit milestone methodology proof for automated anomaly detection, plagiarism screening, and thermodynamic consistency checks. Results appear on your "}
            {!isStaff && (
              <Link href="/submit/milestone" className="text-[#c5fdff] underline">
                milestone page
              </Link>
            )}
            {!isStaff && "."}
          </p>

          {loadError && (
            <div role="alert" className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <AlertTriangle className="h-4 w-4" />
              {loadError}
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-[#6efcff]" />
                <span className="text-xs text-white/50">Pending</span>
              </div>
              <p className="text-2xl font-bold text-white">{tasks.filter((t) => t.status === "pending" || t.status === "flagged").length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-400" />
                <span className="text-xs text-white/50">Verified</span>
              </div>
              <p className="text-2xl font-bold text-white">{tasks.filter((t) => t.status === "verified").length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-[#a78bfa]" />
                <span className="text-xs text-white/50">AI Pass Rate</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {tasks.length > 0 ? Math.round((tasks.filter((t) => t.aiPassed).length / tasks.length) * 100) : 0}%
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <Award className="h-4 w-4 text-[#6efcff]" />
                <span className="text-xs text-white/50">NFTs Minted</span>
              </div>
              <p className="text-2xl font-bold text-white">{mintedProjects.length}</p>
            </div>
          </div>

          <div className="mt-4">
            <TrlBackendStatus />
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {isResearcher && (
            <form onSubmit={handleSubmit} className="workflow-panel space-y-4 rounded-2xl p-6">
              <h2 className="font-headline text-lg font-bold text-white/95">Submit Proof for Audit</h2>
              {projects.length === 0 && !loading ? (
                <p className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                  You have no projects yet.{" "}
                  <Link href="/submit" className="text-[#c5fdff] underline">
                    Submit a project
                  </Link>{" "}
                  before sending milestone proofs.
                </p>
              ) : (
                <select
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              )}
              <select
                className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white"
                value={milestoneName}
                onChange={(e) => setMilestoneName(e.target.value)}
              >
                {Object.entries(MILESTONE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white placeholder:text-white/30"
                placeholder="Claim title *"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <input
                className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white placeholder:text-white/30"
                placeholder="Submitted by"
                value={submittedBy}
                onChange={(e) => setSubmittedBy(e.target.value)}
              />
              <textarea
                className="min-h-[160px] w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/30"
                placeholder="Methodology proof and experimental results *"
                value={proofText}
                onChange={(e) => setProofText(e.target.value)}
                required
              />
              {formError && (
                <p role="alert" className="text-sm text-red-400">
                  {formError}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting || projects.length === 0}
                className="inline-flex items-center gap-2 rounded-full bg-[#6efcff]/20 px-6 py-2.5 text-sm font-semibold text-[#c5fdff] hover:bg-[#6efcff]/30 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {submitting ? "Auditing..." : "Run AI Audit"}
              </button>
            </form>
          )}

          {isStaff && (
            <div className="workflow-panel space-y-4 rounded-2xl p-6">
              <h2 className="font-headline text-lg font-bold text-white/95">Staff Actions</h2>
              <p className="text-sm text-white/60">
                Review pending verifications below. Use the approve/reject buttons to make final decisions on milestone
                submissions.
              </p>
              <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                <p className="text-xs text-white/50">
                  <strong className="text-white/70">Pending:</strong>{" "}
                  {tasks.filter((t) => t.status === "pending" || t.status === "flagged").length} submissions awaiting review
                </p>
              </div>
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                <p className="text-xs text-amber-200/80">
                  <strong className="text-amber-200">About the AI badge:</strong> AI results are written by the researcher&apos;s
                  browser after calling TRL Services and are <em>self-reported (unverified)</em>. Treat them as a hint, read the
                  proof, and make the final call yourself.
                </p>
              </div>
              {awaitingMint.length > 0 && (
                <div className="rounded-lg border border-[#6efcff]/25 bg-[#6efcff]/5 p-4">
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-white/70">
                    <Hammer className="h-3.5 w-3.5 text-[#c5fdff]" /> Verified — IP-NFT not minted yet
                  </p>
                  <ul className="space-y-2 text-xs text-white/60">
                    {awaitingMint.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-2">
                        <span className="truncate">{p.title}</span>
                        <button
                          type="button"
                          onClick={() => handleRetryMint(p.id)}
                          disabled={minting || actingTaskId === p.id}
                          className="shrink-0 rounded-full bg-[#6efcff]/20 px-3 py-1 text-[11px] font-semibold text-[#c5fdff] hover:bg-[#6efcff]/30 disabled:opacity-50"
                        >
                          {actingTaskId === p.id ? "Minting…" : p.phase === "approved" ? "Retry mint" : "Approve & mint"}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {mintedProjects.length > 0 && (
                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-white/70">
                    <Gem className="h-3.5 w-3.5 text-[#c5fdff]" /> Minted IP-NFTs
                  </p>
                  <ul className="space-y-1 text-xs text-white/60">
                    {mintedProjects.map((p) => {
                      const ip = p.ip_status as IpStatus
                      return (
                        <li key={p.id} className="flex items-center justify-between gap-2">
                          <span className="truncate">{p.title}</span>
                          <span className="shrink-0 font-mono text-[10px] text-white/40">
                            {ip.tokenId ? `#${ip.tokenId}` : ""} {ip.txHash ? ip.txHash.slice(0, 10) + "…" : ""}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
              {minting && (
                <div className="flex items-center gap-2 rounded-lg border border-[#6efcff]/30 bg-[#6efcff]/10 p-3 text-xs text-[#c5fdff]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Minting IP-NFT — confirm the transaction in your wallet.
                </div>
              )}
            </div>
          )}

          <div className="space-y-6">
            {lastSubmitted && isResearcher && (
              <div className="workflow-panel rounded-2xl p-6">
                <h2 className="mb-3 font-headline text-lg font-bold text-white/95">Latest Audit Result</h2>
                <div className="mb-3 flex items-center gap-2">
                  {lastSubmitted.aiPassed ? (
                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400">AI Passed</span>
                  ) : lastSubmitted.aiConsistencyReport === AI_UNAVAILABLE_REPORT ? (
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/60">AI Unavailable</span>
                  ) : (
                    <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs text-red-400">AI Flagged</span>
                  )}
                  <span className="text-xs text-white/50">Plagiarism risk: {lastSubmitted.aiPlagiarismScore}%</span>
                </div>
                <MarkdownReport content={lastSubmitted.aiConsistencyReport} />
              </div>
            )}

            <div className="workflow-panel rounded-2xl p-6">
              <h2 className="mb-4 font-headline text-lg font-bold text-white/95">
                {isStaff ? "All Verification Submissions" : "Audit History"}
              </h2>
              {loading ? (
                <p className="flex items-center gap-2 text-sm text-white/50">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                </p>
              ) : tasks.length === 0 ? (
                <p className="text-sm text-white/50">No verification submissions yet.</p>
              ) : (
                <div className="max-h-[500px] space-y-3 overflow-y-auto">
                  {tasks.map((task) => {
                    const acting = actingTaskId === task.id
                    return (
                      <div key={task.id} className="rounded-lg border border-white/10 bg-black/20 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <h3 className="text-sm font-semibold text-white/90">{task.title}</h3>
                            <p className="text-xs text-white/45">
                              {task.projectTitle} · {MILESTONE_LABELS[task.milestoneName] || task.milestoneName}
                              {isStaff && ` · ${task.submittedBy}`}
                            </p>
                            <p className="mt-2 text-xs text-white/55 line-clamp-2">{task.proofText}</p>
                          </div>
                          {statusIcon(task)}
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="flex gap-2 text-[10px]">
                            <span
                              className={`rounded px-2 py-0.5 ${
                                task.aiPassed
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : task.aiConsistencyReport === AI_UNAVAILABLE_REPORT
                                    ? "bg-white/5 text-white/50"
                                    : "bg-red-500/10 text-red-400"
                              }`}
                            >
                              AI: {task.aiPassed ? "Pass" : task.aiConsistencyReport === AI_UNAVAILABLE_REPORT ? "N/A" : "Fail"}
                              {isStaff && task.aiConsistencyReport !== AI_UNAVAILABLE_REPORT && (
                                <span className="ml-1 opacity-70">(self-reported, unverified)</span>
                              )}
                            </span>
                            <span className="rounded bg-white/5 px-2 py-0.5 text-white/50">{task.status}</span>
                          </div>
                          <div className="flex gap-2">
                            {isResearcher && (task.status === "pending" || task.status === "flagged") && (
                              <button
                                onClick={() => handleEdit(task)}
                                className="rounded p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
                                title="Edit proof"
                              >
                                <FileEdit className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {isStaff && (task.status === "pending" || task.status === "flagged") && (
                              <>
                                <button
                                  onClick={() => handleApprove(task)}
                                  disabled={acting || minting}
                                  className="rounded p-1.5 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50"
                                  title="Approve"
                                >
                                  {acting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsUp className="h-3.5 w-3.5" />}
                                </button>
                                <button
                                  onClick={() => handleReject(task)}
                                  disabled={acting || minting}
                                  className="rounded p-1.5 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                                  title="Reject"
                                >
                                  <ThumbsDown className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        {isStaff && task.aiConsistencyReport && task.aiConsistencyReport !== "Pending AI analysis…" && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-[11px] text-white/45 hover:text-white/70">
                              AI report (self-reported by the researcher&apos;s browser — unverified)
                            </summary>
                            <div className="mt-2 max-h-48 overflow-y-auto rounded border border-white/10 bg-black/30 p-3 text-xs">
                              <MarkdownReport content={task.aiConsistencyReport} />
                            </div>
                          </details>
                        )}
                        {editingTask?.id === task.id && (
                          <div className="mt-3 space-y-2">
                            <textarea
                              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white"
                              value={editProofText}
                              onChange={(e) => setEditProofText(e.target.value)}
                              rows={4}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={handleSaveEdit}
                                className="rounded-full bg-[#6efcff]/20 px-3 py-1 text-xs font-semibold text-[#c5fdff] hover:bg-[#6efcff]/30"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setEditingTask(null)
                                  setEditProofText("")
                                }}
                                className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60 hover:bg-white/10"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AiAuditorPage() {
  return (
    <RequireAuth roles={["researcher", "staff"]}>
      <AiAuditorContent />
    </RequireAuth>
  )
}
