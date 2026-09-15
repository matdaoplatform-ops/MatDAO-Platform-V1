import { NextRequest, NextResponse } from "next/server"
import { getIpEngineUrl } from "@/lib/config/services"

/** Forward the end-user IP so the IP Engine rate-limits per user, not per Vercel host (needs PROXY_SHARED_SECRET on both sides). */
function clientIpHeaders(request: NextRequest): Record<string, string> {
  const secret = process.env.PROXY_SHARED_SECRET
  const ip = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  if (!secret || !ip) return {}
  return { "X-MatDAO-Client-IP": ip, "X-MatDAO-Proxy-Secret": secret }
}

// Large PDFs + supporting files can take a while through the LLM pipeline.
export const maxDuration = 300

const TEXT_FIELDS = ["title", "author", "category", "self_reported_trl"] as const

/**
 * Proxy for POST {IP_ENGINE_URL}/api/analyze.
 * Forwards the main `file`, every `supporting_files` entry and all text
 * fields (title/author/category/self_reported_trl) — the backend uses them
 * as submitter metadata and reads the supporting documents.
 */
export async function POST(request: NextRequest) {
  const IP_ENGINE_URL = getIpEngineUrl()

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ detail: "Request must be multipart/form-data" }, { status: 400 })
  }

  const file = formData.get("file")
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ detail: "No file provided" }, { status: 400 })
  }

  const upstream = new FormData()
  // Preserve the filename so FastAPI can validate the extension.  App Router
  // form parsing otherwise serializes a Blob as a generic "blob" upload.
  upstream.append("file", file, file instanceof File ? file.name : "upload")

  for (const field of TEXT_FIELDS) {
    const value = formData.get(field)
    if (typeof value === "string" && value.trim()) {
      upstream.append(field, value.trim())
    }
  }

  for (const extra of formData.getAll("supporting_files")) {
    if (extra instanceof Blob && extra.size > 0) {
      upstream.append("supporting_files", extra, extra instanceof File ? extra.name : "supporting")
    }
  }

  try {
    const response = await fetch(`${IP_ENGINE_URL}/api/analyze`, {
      method: "POST",
      headers: clientIpHeaders(request),
      body: upstream,
    })

    const body = await response.json().catch(() => ({ detail: `IP Engine returned a non-JSON response (HTTP ${response.status})` }))

    if (!response.ok) {
      // Pass the backend's `detail` (422 extraction errors, 429 rate limit, 503 index warming …) straight through.
      return NextResponse.json(body, { status: response.status })
    }

    return NextResponse.json(body)
  } catch {
    return NextResponse.json(
      {
        detail: `Cannot reach IP Engine at ${IP_ENGINE_URL}. Set IP_ENGINE_URL in your Vercel/v0 environment.`,
      },
      { status: 503 },
    )
  }
}
