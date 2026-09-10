/**
 * Server-only module (imported by the notify route handler).
 *
 * Thin Resend wrapper. Email is optional: when RESEND_API_KEY is missing we
 * skip sending and report why, so the submission flow never depends on it.
 */

export interface EmailMessage {
  to: string | string[]
  subject: string
  html: string
  text: string
  replyTo?: string
}

export type EmailResult =
  | { emailed: true; id: string | null }
  | { emailed: false; reason: string }

export const DEFAULT_NOTIFY_EMAIL = "reviews@matdao.example"
export const DEFAULT_FROM_EMAIL = "MatDAO <onboarding@resend.dev>"

export function notifyEmailAddress(): string {
  return process.env.MATDAO_NOTIFY_EMAIL?.trim() || DEFAULT_NOTIFY_EMAIL
}

export function fromEmailAddress(): string {
  return process.env.MATDAO_FROM_EMAIL?.trim() || DEFAULT_FROM_EMAIL
}

export function appUrl(fallbackOrigin?: string): string {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || fallbackOrigin || "http://localhost:3000").replace(/\/+$/, "")
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    console.info("[notify] RESEND_API_KEY not set — skipping email:", message.subject)
    return { emailed: false, reason: "RESEND_API_KEY not configured" }
  }

  try {
    const { Resend } = await import("resend")
    const resend = new Resend(apiKey)
    const { data, error } = await resend.emails.send({
      from: fromEmailAddress(),
      to: Array.isArray(message.to) ? message.to : [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: message.replyTo,
    })
    if (error) {
      console.error("[notify] Resend error:", error)
      return { emailed: false, reason: error.message || "Resend rejected the message" }
    }
    return { emailed: true, id: data?.id ?? null }
  } catch (err) {
    console.error("[notify] Failed to send email:", err)
    return { emailed: false, reason: err instanceof Error ? err.message : "Unknown email error" }
  }
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** Shared dark-on-light email shell that matches the platform's tone. */
export function emailLayout(title: string, bodyHtml: string, cta?: { label: string; href: string }): string {
  const button = cta
    ? `<p style="margin:28px 0 0"><a href="${escapeHtml(cta.href)}" style="display:inline-block;background:#0ea5b7;color:#031014;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px">${escapeHtml(cta.label)}</a></p>`
    : ""
  return `<!doctype html><html><body style="margin:0;background:#f4f6f8;font-family:Inter,Helvetica,Arial,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:32px">
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#64748b">MatDAO</p>
      <h1 style="margin:0 0 18px;font-size:22px;line-height:1.3">${escapeHtml(title)}</h1>
      <div style="font-size:15px;line-height:1.6;color:#334155">${bodyHtml}</div>
      ${button}
    </div>
    <p style="margin:18px 0 0;font-size:12px;color:#94a3b8;text-align:center">You are receiving this because of activity on the MatDAO platform.</p>
  </div></body></html>`
}
