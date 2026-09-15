"use client"

import { useEffect, useState } from "react"
import { AlertCircle, Bot, CheckCircle2, Cpu, Loader2 } from "lucide-react"
import { checkBackendHealth, fetchBackendCapabilities, type BackendHealth } from "@/lib/ai-studio/api"
import type { BackendCapabilities } from "@/lib/ai-studio/types"

function Chip({ ok, label, title }: { ok: boolean; label: string; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${
        ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-white/10 bg-black/20 text-white/40"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-300" : "bg-white/30"}`} />
      {label}
    </span>
  )
}

/**
 * Health + capabilities of the IP Engine (via /api/ai-studio/health and
 * /api/ai-studio/capabilities). Shows the backend URL and whether an LLM key
 * is configured, so users know up front if the AI will actually run.
 */
export function BackendStatus({ required = true }: { required?: boolean }) {
  const [health, setHealth] = useState<BackendHealth | null>(null)
  const [caps, setCaps] = useState<BackendCapabilities | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let mounted = true
    Promise.all([checkBackendHealth(), fetchBackendCapabilities()]).then(([h, c]) => {
      if (mounted) {
        setHealth(h)
        setCaps(c)
        setChecking(false)
      }
    })
    return () => {
      mounted = false
    }
  }, [])

  if (checking) {
    return (
      <div className="mb-6 flex items-center gap-2 rounded-lg border border-white/10 bg-white/3 px-4 py-3 text-xs text-white/50">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Checking IP Engine backend...
      </div>
    )
  }

  if (!health?.reachable) {
    return (
      <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div className="text-xs text-amber-200/90">
            <p className="font-semibold text-amber-200">
              {required ? "IP Engine backend is offline" : "IP Engine backend is offline (limited mode)"}
            </p>
            <p className="mt-1 text-amber-200/70">
              {health?.detail ??
                (required
                  ? "Uploads require the matdao-ip-engine service. Set IP_ENGINE_URL in your hosting environment."
                  : "PDF/DOCX need the backend. Plain text paste still works in limited mode.")}
            </p>
            {health?.backend_url && (
              <code className="mt-2 block rounded bg-black/30 px-2 py-1.5 font-mono text-[10px] text-amber-100/80">
                {health.backend_url}
              </code>
            )}
          </div>
        </div>
      </div>
    )
  }

  const llmAvailable = caps?.llm?.available ?? false
  const llmLabel = llmAvailable
    ? `LLM: ${[caps?.llm?.provider, caps?.llm?.model].filter(Boolean).join(" / ")}`
    : "No LLM key — rule-based fallback"
  const priorArt = caps?.prior_art ?? {}
  const embeddings = caps?.embeddings

  return (
    <div className="mb-6 rounded-lg border border-emerald-500/25 bg-emerald-500/8 px-4 py-3 text-xs">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-emerald-300/90">
        <span className="inline-flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          IP Engine connected
          {!health.index_ready && <span className="text-amber-200/80">· patent index warming</span>}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-semibold ${
            llmAvailable
              ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
              : "border-amber-400/40 bg-amber-500/15 text-amber-100"
          }`}
        >
          {llmAvailable ? <Bot className="h-3 w-3" /> : <Cpu className="h-3 w-3" />}
          {llmLabel}
        </span>
        {health.backend_url && (
          <code className="ml-auto rounded bg-black/30 px-2 py-0.5 font-mono text-[10px] text-white/50">{health.backend_url}</code>
        )}
      </div>
      {caps && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Chip ok={!!embeddings?.configured} label={`embeddings: ${embeddings?.configured ? "configured" : embeddings?.fallback ?? "tfidf"}`} />
          <Chip ok={priorArt.google_patents === "serpapi"} label={`Google Patents: ${priorArt.google_patents ?? "off"}`} />
          <Chip ok={priorArt.lens === true} label="Lens" title="Requires LENS_API_KEY" />
          <Chip ok={priorArt.openalex === true} label="OpenAlex" />
          <Chip ok={priorArt.semantic_scholar === true} label={`Semantic Scholar${priorArt.semantic_scholar_key ? " (key)" : ""}`} />
          <Chip ok={priorArt.crossref === true} label="Crossref" />
          <Chip ok={priorArt.sciencedirect === true} label="ScienceDirect" title="Requires ELSEVIER_API_KEY" />
          <Chip ok={!!caps.multi_agent?.enabled && Object.values(caps.multi_agent?.providers ?? {}).some(Boolean)} label="multi-agent narrative" />
          <Chip ok={(health.patent_corpus_size ?? 0) > 0} label={`${health.patent_corpus_size ?? 0} local patents`} />
        </div>
      )}
      {!caps && (
        <p className="mt-1.5 text-white/45">Capabilities endpoint unavailable — backend may be an older build.</p>
      )}
    </div>
  )
}
