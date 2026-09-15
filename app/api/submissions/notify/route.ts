import { NextResponse } from "next/server"
import { bearerToken, createServerClientWithToken } from "@/lib/supabase/server"
import type { ProjectRow } from "@/lib/supabase/client"
import { appUrl, emailLayout, escapeHtml, notifyEmailAddress, sendEmail, type EmailResult } from "./email"

export const runtime = "nodejs"

type NotifyType = "project_submitted" | "project_reviewed"

/** A researcher can trigger at most one "submitted" notification per project per window. */
const SUBMITTED_DEDUPE_MS = 10 * 60 * 1000

interface NotifyBody {
  type: NotifyType
  projectId: string
  /** project_reviewed only */
  decision?: "approved" | "rejected" | "changes_requested" | "under_review"
  notes?: string | null
}

const DECISION_COPY: Record<NonNullable<NotifyBody["decision"]>, { subject: string; headline: string; body: string }> = {
  approved: {
    subject: "Your MatDAO project has been approved",
    headline: "Your project was approved",
    body: "Congratulations — the review team approved your submission. It is now listed on the MatDAO marketplace and you can start building milestones and submitting verification proofs.",
  },
  rejected: {
    subject: "Update on your MatDAO project submission",
    headline: "Your project was not approved",
    body: "After review, the team decided not to move forward with this submission at this time. You can read the reviewer notes below and submit a revised project whenever you are ready.",
  },
  changes_requested: {
    subject: "Changes requested on your MatDAO project",
    headline: "The review team requested changes",
    body: "Your submission is close. The reviewer left notes on what needs to change before it can be approved. Update your project and resubmit it from your dashboard.",
  },
  under_review: {
    subject: "Your MatDAO project is under review",
    headline: "A reviewer picked up your project",
    body: "Your submission is now being reviewed by the MatDAO team. We will let you know as soon as there is a decision.",
  },
}

function isNotifyBody(value: unknown): value is NotifyBody {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return (
    (v.type === "project_submitted" || v.type === "project_reviewed") &&
    typeof v.projectId === "string" &&
    /^[0-9a-f-]{36}$/i.test(v.projectId)
  )
}

/**
 * POST /api/submissions/notify
 *
 * Runs AS the calling user (their access token is forwarded to Supabase so
 * RLS applies — no service key). Inserts a `notifications` row and, when
 * RESEND_API_KEY is configured, sends the matching email. Never throws on
 * email failure: the response always reports `{ emailed, reason? }`.
 */
export async function POST(request: Request) {
  const token = bearerToken(request)
  if (!token) {
    return NextResponse.json({ error: "Missing Authorization bearer token" }, { status: 401 })
  }
  const supabase = createServerClientWithToken(token)
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  if (!isNotifyBody(body)) {
    return NextResponse.json({ error: "Expected { type, projectId }" }, { status: 400 })
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 })
  }

  // RLS: owner, staff or (approved) public rows only.
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", body.projectId)
    .maybeSingle()
  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found or not accessible" }, { status: 404 })
  }

  const origin = appUrl(new URL(request.url).origin)
  const { data: senderProfile } = await supabase.from("profiles").select("name, role").eq("id", user.id).maybeSingle()

  if (body.type === "project_submitted") {
    // Only the owner may announce a submission, only while it is actually
    // waiting for review, and at most once per project per window.
    if (project.researcher_id !== user.id) {
      return NextResponse.json({ error: "Only the project owner can send this notification" }, { status: 403 })
    }
    if (project.status !== "pending_review") {
      return NextResponse.json({ error: "Project is not pending review" }, { status: 409 })
    }
    const since = new Date(Date.now() - SUBMITTED_DEDUPE_MS).toISOString()
    const { count: recent } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("project_id", project.id)
      .eq("type", "project_submitted")
      .gte("created_at", since)
    if ((recent ?? 0) > 0) {
      return NextResponse.json({ ok: true, notified: false, emailed: false, reason: "Already notified recently" })
    }
    return handleSubmitted({ supabase, project, senderName: senderProfile?.name ?? user.email ?? "A researcher", origin })
  }

  if (senderProfile?.role !== "staff") {
    return NextResponse.json({ error: "Only staff can send review notifications" }, { status: 403 })
  }
  return handleReviewed({ supabase, project, decision: body.decision ?? "under_review", notes: body.notes ?? null, origin })
}

type Client = NonNullable<ReturnType<typeof createServerClientWithToken>>

async function handleSubmitted(args: { supabase: Client; project: ProjectRow; senderName: string; origin: string }) {
  const { supabase, project, senderName, origin } = args
  const reviewUrl = `${origin}/tto-portal?project=${project.id}`

  const { error: notifyError } = await supabase.from("notifications").insert({
    type: "project_submitted",
    recipient_role: "staff",
    recipient_id: null,
    project_id: project.id,
    payload: {
      title: project.title,
      submitter: senderName,
      submitter_email: project.submitter_email,
      institution: project.institution,
      working_field: project.working_field,
      trl: project.trl,
    },
  })
  if (notifyError) console.error("[notify] notifications insert failed:", notifyError.message)

  const summaryRows = [
    ["Title", project.title],
    ["Submitted by", senderName],
    ["Contact", project.submitter_email ?? "—"],
    ["Institution", project.institution ?? "—"],
    ["Field", project.working_field ?? "—"],
    ["TRL", String(project.trl)],
    ["Funding goal", `$${Number(project.funding_goal || 0).toLocaleString()}`],
    ["Documents", String(Array.isArray(project.documents) ? project.documents.length : 0)],
  ]
  const html = emailLayout(
    "New project submitted for review",
    `<p>A new project is waiting in the TTO review queue.</p>
     <table style="border-collapse:collapse;width:100%;margin-top:12px">${summaryRows
       .map(
         ([k, v]) =>
           `<tr><td style="padding:6px 0;color:#64748b;width:38%">${escapeHtml(k)}</td><td style="padding:6px 0;font-weight:500">${escapeHtml(v)}</td></tr>`,
       )
       .join("")}</table>`,
    { label: "Open review queue", href: reviewUrl },
  )
  const text = `New project submitted for review\n\n${summaryRows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\nReview: ${reviewUrl}`

  const email: EmailResult = await sendEmail({
    to: notifyEmailAddress(),
    subject: `[MatDAO] New submission: ${project.title}`,
    html,
    text,
    replyTo: project.submitter_email ?? undefined,
  })

  return NextResponse.json({ ok: true, notified: !notifyError, ...email })
}

async function handleReviewed(args: {
  supabase: Client
  project: ProjectRow
  decision: NonNullable<NotifyBody["decision"]>
  notes: string | null
  origin: string
}) {
  const { supabase, project, decision, notes, origin } = args
  const copy = DECISION_COPY[decision]
  const dashboardUrl = `${origin}/researcher-dashboard`

  const { error: notifyError } = await supabase.from("notifications").insert({
    type: "project_reviewed",
    recipient_role: "researcher",
    recipient_id: project.researcher_id,
    project_id: project.id,
    payload: { title: project.title, decision, notes },
  })
  if (notifyError) console.error("[notify] notifications insert failed:", notifyError.message)

  let email: EmailResult
  const to = project.submitter_email
  if (!to) {
    email = { emailed: false, reason: "Project has no submitter_email" }
  } else {
    const html = emailLayout(
      copy.headline,
      `<p>${escapeHtml(copy.body)}</p>
       <p style="margin-top:14px"><strong>Project:</strong> ${escapeHtml(project.title)}</p>
       ${notes ? `<p style="margin-top:14px"><strong>Reviewer notes</strong></p><blockquote style="margin:8px 0 0;padding:12px 16px;background:#f8fafc;border-left:3px solid #0ea5b7;border-radius:8px;white-space:pre-wrap">${escapeHtml(notes)}</blockquote>` : ""}`,
      { label: "Open my dashboard", href: dashboardUrl },
    )
    const text = `${copy.headline}\n\n${copy.body}\n\nProject: ${project.title}${notes ? `\n\nReviewer notes:\n${notes}` : ""}\n\n${dashboardUrl}`
    email = await sendEmail({ to, subject: `[MatDAO] ${copy.subject}`, html, text })
  }

  return NextResponse.json({ ok: true, notified: !notifyError, ...email })
}
