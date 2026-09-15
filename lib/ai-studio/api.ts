import type {
  AnalysisProvenance,
  AnalysisReport,
  AuditEntry,
  BackendCapabilities,
  HitlModifiers,
  PriorArtResponse,
  TokenizationBreakdown,
} from "./types"

export interface BackendHealth {
  reachable: boolean
  status?: string
  index_ready?: boolean
  patent_corpus_size?: number
  embedding_model?: string
  embedding_provider?: string
  backend_url?: string
  detail?: string
}

export async function checkBackendHealth(): Promise<BackendHealth> {
  try {
    const response = await fetch("/api/ai-studio/health")
    return response.json()
  } catch {
    return { reachable: false, status: "offline", detail: "Cannot reach API proxy" }
  }
}

export async function fetchBackendCapabilities(): Promise<BackendCapabilities | null> {
  try {
    const response = await fetch("/api/ai-studio/capabilities")
    if (!response.ok) return null
    return response.json()
  } catch {
    return null
  }
}

/** Surface the backend's `detail` (FastAPI error shape) or a status-coded fallback. */
async function readError(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null)
  const detail = body && typeof body === "object" ? (body as { detail?: unknown }).detail : null
  if (typeof detail === "string" && detail.trim()) return detail
  if (Array.isArray(detail)) {
    // FastAPI validation errors: [{loc, msg, type}]
    const msgs = detail.map((d) => (d && typeof d === "object" && "msg" in d ? String((d as { msg: unknown }).msg) : "")).filter(Boolean)
    if (msgs.length) return msgs.join("; ")
  }
  return `${fallback} (HTTP ${response.status})`
}

export interface AnalyzeOptions {
  title?: string
  author?: string
  category?: string
  /** 1-9. Sent as `self_reported_trl`; the engine reports the delta against its own evidence-based estimate. */
  selfReportedTrl?: number | null
  /** Proposal, pitch deck, financials, pasted abstract … forwarded as `supporting_files`. */
  supportingFiles?: File[]
}

export async function analyzeDocument(file: File, options: AnalyzeOptions = {}): Promise<AnalysisReport> {
  const formData = new FormData()
  formData.append("file", file, file.name)
  if (options.title?.trim()) formData.append("title", options.title.trim())
  if (options.author?.trim()) formData.append("author", options.author.trim())
  if (options.category?.trim()) formData.append("category", options.category.trim())
  if (options.selfReportedTrl != null && Number.isFinite(options.selfReportedTrl)) {
    formData.append("self_reported_trl", String(options.selfReportedTrl))
  }
  for (const extra of options.supportingFiles ?? []) {
    if (extra && extra.size > 0) formData.append("supporting_files", extra, extra.name)
  }

  const response = await fetch("/api/ai-studio/analyze", {
    method: "POST",
    body: formData,
  })

  if (!response.ok) {
    throw new Error(await readError(response, "Analysis failed"))
  }

  return response.json()
}

export async function searchPriorArt(input: {
  title: string
  abstract: string
  claims?: string[] | string
  methods?: string
  keywords?: string[]
  assess?: boolean
}): Promise<PriorArtResponse> {
  const response = await fetch("/api/ai-studio/prior-art", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    throw new Error(await readError(response, "Prior-art search failed"))
  }
  return response.json()
}

export interface ChatTurn {
  role: "user" | "assistant"
  content: string
}

export interface ChatResponse {
  available: boolean
  reply?: string
  provider?: string | null
  model?: string | null
  detail?: string
}

/** Ask the report-grounded assistant. Returns `available:false` (no error) when no server-side LLM key exists. */
export async function askReportAssistant(
  report: unknown,
  messages: ChatTurn[],
): Promise<ChatResponse> {
  const response = await fetch("/api/ai-studio/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ report, messages }),
  })
  const body = (await response.json().catch(() => ({}))) as ChatResponse & { detail?: string }
  if (!response.ok && response.status !== 503) {
    throw new Error(body.detail ?? `Chat request failed (HTTP ${response.status})`)
  }
  return body
}

/** Pull the provenance stamp off a raw engine report. Robust to old reports that predate these fields. */
export function provenanceFromReport(report: Partial<AnalysisReport> | null | undefined): AnalysisProvenance {
  const trlSource = report?.trl_evaluation?.analysis_source ?? ""
  const inferredMode: AnalysisProvenance["analysisMode"] =
    report?.analysis_mode ?? (trlSource.startsWith("llm") ? "llm" : "rule_based_fallback")
  return {
    analysisMode: inferredMode,
    llmProvider: report?.llm_provider ?? report?.trl_evaluation?.llm_provider ?? null,
    llmModel: report?.llm_model ?? report?.trl_evaluation?.llm_model ?? null,
    warnings: Array.isArray(report?.warnings) ? report!.warnings!.filter((w) => typeof w === "string") : [],
  }
}

/** "LLM · deepseek / deepseek-chat" or "Rule-based fallback (no LLM key)". */
export function describeProvenance(p: AnalysisProvenance | undefined | null): string {
  if (!p) return "Unknown analysis mode"
  if (p.analysisMode === "llm") {
    const model = [p.llmProvider, p.llmModel].filter(Boolean).join(" / ")
    return model ? `LLM · ${model}` : "LLM"
  }
  return "Rule-based fallback (no LLM key configured)"
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

export function computeAdjustedValuation(
  anchor: number,
  modifiers: HitlModifiers,
): { total: number; audit: AuditEntry[] } {
  const teamAdj = anchor * (modifiers.teamPedigree / 100) * 0.10
  const secretsAdj = anchor * (modifiers.tradeSecrets / 100) * 0.15
  const partnerAdj = anchor * (modifiers.partnerships / 100) * 0.05
  const total = anchor + teamAdj + secretsAdj + partnerAdj

  const audit: AuditEntry[] = [
    {
      id: "hitl_team",
      parent_id: "tokenization_anchor",
      label: "Team Pedigree Adjustment",
      amount_usd: teamAdj,
      formula: `Anchor × (slider/100) × 10% max`,
      explanation: "Human-assessed modifier for founder track record, domain expertise, and execution capability.",
      calculation_steps: [
        { step: 1, operation: "Anchor USD", value: anchor },
        { step: 2, operation: "Slider position", value: `${modifiers.teamPedigree}%` },
        { step: 3, operation: "Adjustment USD", value: Math.round(teamAdj) },
      ],
      evidence: [{ type: "hitl_modifier", ref: "team_pedigree", detail: "Max ±10% of anchor" }],
    },
    {
      id: "hitl_secrets",
      parent_id: "tokenization_anchor",
      label: "Trade Secrets & Know-How",
      amount_usd: secretsAdj,
      formula: `Anchor × (slider/100) × 15% max`,
      explanation: "Premium for unpatentable tacit knowledge, proprietary datasets, and undocumented processes.",
      calculation_steps: [
        { step: 1, operation: "Slider position", value: `${modifiers.tradeSecrets}%` },
        { step: 2, operation: "Adjustment USD", value: Math.round(secretsAdj) },
      ],
      evidence: [{ type: "hitl_modifier", ref: "trade_secrets", detail: "Max +15% of anchor" }],
    },
    {
      id: "hitl_partnerships",
      parent_id: "tokenization_anchor",
      label: "Strategic Partnerships",
      amount_usd: partnerAdj,
      formula: `Anchor × (slider/100) × 5% max`,
      explanation: "Modifier for LOIs, pilot agreements, and distribution partnerships not captured in the paper text.",
      calculation_steps: [
        { step: 1, operation: "Slider position", value: `${modifiers.partnerships}%` },
        { step: 2, operation: "Adjustment USD", value: Math.round(partnerAdj) },
      ],
      evidence: [{ type: "hitl_modifier", ref: "partnerships", detail: "Max +5% of anchor" }],
    },
    {
      id: "hitl_final",
      parent_id: "tokenization_anchor",
      label: "Full Adjusted IP Value (100% ownership)",
      amount_usd: total,
      formula: "Anchor + team + secrets + partnerships",
      explanation: "Total enterprise value after human-in-the-loop modifiers, assuming 100% IP ownership.",
      calculation_steps: [
        { step: 1, operation: "AI anchor", value: anchor },
        { step: 2, operation: "HITL adjustments", value: Math.round(teamAdj + secretsAdj + partnerAdj) },
        { step: 3, operation: "Full adjusted value", value: Math.round(total) },
      ],
      evidence: [{ type: "policy", ref: "30_HITL", detail: "Human discretion layer" }],
    },
  ]

  return { total, audit }
}

export function computeTokenizationBreakdown(
  fullAdjustedValue: number,
  tokenizationFractionPct: number,
  hitlAudit: AuditEntry[],
): TokenizationBreakdown {
  const fraction = Math.max(1, Math.min(100, tokenizationFractionPct))
  const listed = fullAdjustedValue * (fraction / 100)

  const fractionAudit: AuditEntry = {
    id: "tokenization_fraction",
    parent_id: "hitl_final",
    label: `Listed for Tokenization (${fraction}% of IP)`,
    amount_usd: listed,
    formula: `Full adjusted value × ${fraction}%`,
    explanation:
      fraction < 100
        ? `You retain ${100 - fraction}% ownership off-platform. Only ${fraction}% of the IP is offered for fractional tokenization on MatDAO.`
        : "100% of IP ownership is being offered for tokenization on the platform.",
    calculation_steps: [
      { step: 1, operation: "Full adjusted value (100%)", value: Math.round(fullAdjustedValue) },
      { step: 2, operation: "Tokenization fraction", value: `${fraction}%` },
      { step: 3, operation: "Listed tokenization value", value: Math.round(listed) },
      { step: 4, operation: "Retained off-platform", value: `${100 - fraction}%` },
    ],
    evidence: [{ type: "user_input", ref: "tokenization_fraction_slider", detail: `${fraction}% offered` }],
  }

  return {
    fullAdjustedValue,
    tokenizationFractionPct: fraction,
    listedTokenizationValue: listed,
    retainedOwnershipPct: 100 - fraction,
    hitlAudit: [...hitlAudit.filter((a) => a.amount_usd !== 0 || a.id === "hitl_final"), fractionAudit],
  }
}
