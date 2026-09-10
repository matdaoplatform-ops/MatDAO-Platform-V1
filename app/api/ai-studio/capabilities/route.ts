import { NextResponse } from "next/server"
import { getIpEngineUrl } from "@/lib/config/services"

/**
 * Proxy for GET {IP_ENGINE_URL}/api/capabilities — which providers/keys the
 * backend has configured (booleans only, never key values).
 */
export async function GET() {
  const IP_ENGINE_URL = getIpEngineUrl()
  try {
    const response = await fetch(`${IP_ENGINE_URL}/api/capabilities`, { cache: "no-store" })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      return NextResponse.json(
        { reachable: false, backend_url: IP_ENGINE_URL, detail: body?.detail ?? `IP Engine returned HTTP ${response.status}` },
        { status: response.status },
      )
    }
    return NextResponse.json({ reachable: true, backend_url: IP_ENGINE_URL, ...body })
  } catch {
    return NextResponse.json(
      {
        reachable: false,
        backend_url: IP_ENGINE_URL,
        detail: `Cannot reach IP Engine at ${IP_ENGINE_URL}. Set IP_ENGINE_URL in your environment.`,
      },
      { status: 503 },
    )
  }
}
