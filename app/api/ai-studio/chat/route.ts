import { NextRequest, NextResponse } from "next/server"

export const maxDuration = 120

/**
 * Report-grounded chat. The IP Engine has no chat endpoint, so this route
 * calls an OpenAI-compatible chat-completions API directly — ONLY when a
 * server-side key exists. Without a key it returns a clear "unavailable"
 * message; it never fabricates an answer.
 */

const PROVIDERS = [
  { name: "deepseek", envKey: "DEEPSEEK_API_KEY", baseUrl: "https://api.deepseek.com/v1", model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat" },
  { name: "openai", envKey: "OPENAI_API_KEY", baseUrl: "https://api.openai.com/v1", model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini" },
] as const

const MAX_CONTEXT_CHARS = 60_000
const MAX_HISTORY = 12

interface ChatTurn {
  role: "user" | "assistant"
  content: string
}

function pickProvider() {
  for (const p of PROVIDERS) {
    const key = process.env[p.envKey]
    if (key && key.trim()) return { ...p, key: key.trim() }
  }
  return null
}

/** Trim the report to what a model needs: drop bulky section dumps, cap arrays and long strings. */
function compactReport(value: unknown, depth = 0): unknown {
  if (depth > 7) return undefined
  if (typeof value === "string") return value.length > 2500 ? `${value.slice(0, 2500)}…` : value
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value
  if (Array.isArray(value)) return value.slice(0, 12).map((v) => compactReport(v, depth + 1))
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "sections" || k === "signature_sha256_hmac" || k === "audit_trail" || k === "nlp_analysis") continue
      // Prior-art abstracts are long and numerous — keep a short preview only.
      const c = k === "abstract" && typeof v === "string" ? (v.length > 400 ? `${v.slice(0, 400)}…` : v) : compactReport(v, depth + 1)
      if (c !== undefined) out[k] = c
    }
    return out
  }
  return undefined
}

function buildSystemPrompt(reportJson: string): string {
  return [
    "You are the MatDAO AI Studio analysis assistant. You answer questions about ONE assessment report, given below as JSON.",
    "Rules:",
    "- Ground every statement in the report. Quote or reference the specific field/value you rely on (e.g. trl_evaluation.trl, originality.assessment.novelty_score).",
    "- If the report does not contain the information, say so plainly. Do not invent numbers, patents, papers, timelines, or valuations.",
    "- The report's `analysis_mode` says whether an LLM read the document (\"llm\") or rule-based fallbacks ran (\"rule_based_fallback\"). Mention this when relevant to confidence.",
    "- If `valuation.valuation_available` is false, the valuation model is under revision; do not present dollar figures as reliable.",
    "- Be concise. Use short paragraphs or bullet lists. Plain text, no markdown headers.",
    "",
    "REPORT JSON:",
    reportJson,
  ].join("\n")
}

export async function POST(request: NextRequest) {
  const provider = pickProvider()
  if (!provider) {
    return NextResponse.json(
      {
        available: false,
        detail: "AI chat unavailable — no LLM key configured. Set DEEPSEEK_API_KEY or OPENAI_API_KEY on the Next.js server to enable it.",
      },
      { status: 503 },
    )
  }

  let body: { report?: unknown; messages?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ available: true, detail: "Request body must be JSON" }, { status: 400 })
  }

  const history: ChatTurn[] = Array.isArray(body.messages)
    ? (body.messages as unknown[])
        .filter((m): m is ChatTurn =>
          !!m && typeof m === "object" &&
          ((m as ChatTurn).role === "user" || (m as ChatTurn).role === "assistant") &&
          typeof (m as ChatTurn).content === "string" && (m as ChatTurn).content.trim().length > 0,
        )
        .slice(-MAX_HISTORY)
    : []
  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return NextResponse.json({ available: true, detail: "messages must end with a user turn" }, { status: 400 })
  }
  if (!body.report || typeof body.report !== "object") {
    return NextResponse.json({ available: true, detail: "report is required" }, { status: 400 })
  }

  let reportJson = JSON.stringify(compactReport(body.report))
  if (reportJson.length > MAX_CONTEXT_CHARS) {
    reportJson = `${reportJson.slice(0, MAX_CONTEXT_CHARS)}… [truncated: report exceeds context budget]`
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 90_000)
  try {
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.key}`,
      },
      body: JSON.stringify({
        model: provider.model,
        temperature: 0.2,
        max_tokens: 900,
        messages: [
          { role: "system", content: buildSystemPrompt(reportJson) },
          ...history.map((m) => ({ role: m.role, content: m.content.slice(0, 4000) })),
        ],
      }),
      signal: controller.signal,
    })

    const data = (await response.json().catch(() => null)) as
      | { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } }
      | null

    if (!response.ok) {
      const detail = data?.error?.message ?? `LLM provider ${provider.name} returned HTTP ${response.status}`
      return NextResponse.json({ available: true, provider: provider.name, model: provider.model, detail }, { status: 502 })
    }

    const reply = data?.choices?.[0]?.message?.content?.trim()
    if (!reply) {
      return NextResponse.json(
        { available: true, provider: provider.name, model: provider.model, detail: "LLM returned an empty reply" },
        { status: 502 },
      )
    }

    return NextResponse.json({ available: true, provider: provider.name, model: provider.model, reply })
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError"
    return NextResponse.json(
      {
        available: true,
        provider: provider.name,
        model: provider.model,
        detail: aborted ? "LLM request timed out" : `Could not reach LLM provider ${provider.name}`,
      },
      { status: 502 },
    )
  } finally {
    clearTimeout(timer)
  }
}
