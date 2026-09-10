import { supabase } from "./client"

export interface NotifyResponse {
  ok?: boolean
  notified?: boolean
  emailed?: boolean
  reason?: string
  error?: string
}

export type NotifyPayload =
  | { type: "project_submitted"; projectId: string }
  | {
      type: "project_reviewed"
      projectId: string
      decision: "approved" | "rejected" | "changes_requested" | "under_review"
      notes?: string | null
    }

/**
 * Fire-and-forget call to /api/submissions/notify. Forwards the current
 * session's access token so the route acts as this user under RLS.
 * Never throws — notification failures must not break the main action.
 */
export async function notifySubmission(payload: NotifyPayload): Promise<NotifyResponse> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) return { ok: false, emailed: false, reason: "No active session" }

    const res = await fetch("/api/submissions/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    })
    const body = (await res.json().catch(() => ({}))) as NotifyResponse
    if (!res.ok) {
      console.warn("[notify] request failed:", res.status, body.error)
      return { ok: false, emailed: false, reason: body.error ?? `HTTP ${res.status}` }
    }
    return body
  } catch (err) {
    console.warn("[notify] request error:", err)
    return { ok: false, emailed: false, reason: err instanceof Error ? err.message : "Network error" }
  }
}
