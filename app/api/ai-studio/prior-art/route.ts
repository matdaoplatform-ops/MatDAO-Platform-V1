import { NextRequest, NextResponse } from "next/server"
import { getIpEngineUrl } from "@/lib/config/services"

/** Forward the end-user IP so the IP Engine rate-limits per user, not per Vercel host (needs PROXY_SHARED_SECRET on both sides). */
function clientIpHeaders(request: NextRequest): Record<string, string> {
  const secret = process.env.PROXY_SHARED_SECRET
  const ip = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  if (!secret || !ip) return {}
  return { "X-MatDAO-Client-IP": ip, "X-MatDAO-Proxy-Secret": secret }
}

export const maxDuration = 120

/**
 * Proxy for POST {IP_ENGINE_URL}/api/prior-art
 * Body: { title, abstract, claims?, methods?, keywords?, assess? }
 * Returns the same `prior_art` + `assessment` shape as the analyze pipeline.
 */
export async function POST(request: NextRequest) {
  const IP_ENGINE_URL = getIpEngineUrl()

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ detail: "Request body must be JSON" }, { status: 400 })
  }
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ detail: "Request body must be a JSON object" }, { status: 400 })
  }
  const { title, abstract } = payload as { title?: unknown; abstract?: unknown }
  if (typeof title !== "string" || title.trim().length < 3) {
    return NextResponse.json({ detail: "title is required (min 3 characters)" }, { status: 400 })
  }
  if (typeof abstract !== "string" || abstract.trim().length < 20) {
    return NextResponse.json({ detail: "abstract is required (min 20 characters)" }, { status: 400 })
  }

  try {
    const response = await fetch(`${IP_ENGINE_URL}/api/prior-art`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...clientIpHeaders(request) },
      body: JSON.stringify(payload),
    })
    const body = await response.json().catch(() => ({ detail: `IP Engine returned a non-JSON response (HTTP ${response.status})` }))
    if (!response.ok) {
      return NextResponse.json(body, { status: response.status })
    }
    return NextResponse.json(body)
  } catch {
    return NextResponse.json(
      { detail: `Cannot reach IP Engine at ${IP_ENGINE_URL}. Set IP_ENGINE_URL in your Vercel/v0 environment.` },
      { status: 503 },
    )
  }
}
