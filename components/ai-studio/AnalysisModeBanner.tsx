"use client"

import { useState } from "react"
import { AlertTriangle, Bot, ChevronDown, ChevronUp, Cpu } from "lucide-react"
import type { AnalysisProvenance } from "@/lib/ai-studio/types"

interface AnalysisModeBannerProps {
  provenance?: AnalysisProvenance | null
  /** Extra one-line context, e.g. "Report generated 3 min ago". */
  note?: string
  className?: string
}

/**
 * Prominent "did the AI actually run?" indicator for every results page:
 * LLM (provider / model) vs rule-based fallback, plus the backend's warnings.
 */
export function AnalysisModeBanner({ provenance, note, className = "" }: AnalysisModeBannerProps) {
  const [showAll, setShowAll] = useState(false)

  if (!provenance) {
    return (
      <div className={`flex items-start gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3 ${className}`}>
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-white/50" />
        <div className="text-xs text-white/60">
          <p className="font-semibold text-white/80">Analysis mode unknown</p>
          <p className="mt-0.5">This report predates provenance tracking. Re-run the analysis to see whether an LLM read the document.</p>
        </div>
      </div>
    )
  }

  const isLlm = provenance.analysisMode === "llm"
  const warnings = provenance.warnings ?? []
  const visibleWarnings = showAll ? warnings : warnings.slice(0, 3)
  const modelLabel = [provenance.llmProvider, provenance.llmModel].filter(Boolean).join(" / ")

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        isLlm
          ? "border-emerald-500/30 bg-emerald-500/10"
          : "border-amber-500/40 bg-amber-500/10"
      } ${className}`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${
            isLlm
              ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-200"
              : "border-amber-400/40 bg-amber-500/20 text-amber-100"
          }`}
        >
          {isLlm ? <Bot className="h-3.5 w-3.5" /> : <Cpu className="h-3.5 w-3.5" />}
          {isLlm ? "LLM analysis" : "Rule-based fallback"}
        </span>
        <p className={`text-sm ${isLlm ? "text-emerald-100/90" : "text-amber-100/90"}`}>
          {isLlm
            ? <>A language model read this document{modelLabel ? <> — <span className="font-mono text-xs">{modelLabel}</span></> : null}.</>
            : <>No LLM key is configured on the backend. Scores below come from regex/keyword rules and similarity search, not from a model reading the document.</>}
        </p>
        {note && <p className="text-xs text-white/45">{note}</p>}
      </div>

      {warnings.length > 0 && (
        <div className="mt-3 border-t border-white/10 pt-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/60">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />
            Backend warnings ({warnings.length})
          </p>
          <ul className="space-y-1">
            {visibleWarnings.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-white/70">
                <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300/80" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
          {warnings.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-2 inline-flex items-center gap-1 text-xs text-white/50 hover:text-white/80"
            >
              {showAll ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {showAll ? "Show fewer" : `Show all ${warnings.length}`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
