"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, FileText, Target, Zap } from "lucide-react"
import { MILESTONE_LABELS } from "@/lib/trl-services/storage"
import type { Milestone } from "@/lib/trl-services/types"
import type { TrlReport } from "@/lib/ai-studio/trl"
import { AnalysisModeBanner } from "@/components/ai-studio/AnalysisModeBanner"
import { EvidenceQuotes } from "@/components/ai-studio/EvidenceQuotes"

export default function TrlResultsPage() {
  const [report, setReport] = useState<TrlReport | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem("matdao-trl-report")
    if (stored) setReport(JSON.parse(stored))
  }, [])

  if (!report) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="text-center">
          <p className="mb-4 text-white/60">No TRL report found.</p>
          <Link href="/ai-studio/trl/submit" className="text-sm text-[#6efcff] hover:underline">
            Run an evaluation first
          </Link>
        </div>
      </div>
    )
  }

  const isLlm = report.provenance?.analysisMode === "llm"
  const milestones = Object.entries(report.milestones) as Array<[string, Milestone]>

  return (
    <div className="relative px-5 py-12 sm:px-6">
      <div className="relative z-10 mx-auto max-w-3xl">
        <p className="mb-2 text-[11px] uppercase tracking-wider text-[#c5fdff]">TRL Evaluation Results</p>
        <h1 className="font-headline mb-1 text-2xl font-bold text-white/95 md:text-3xl">{report.documentName}</h1>
        <p className="mb-5 text-sm text-white/50">{report.sectorName}</p>

        <AnalysisModeBanner
          provenance={report.provenance}
          note={`Generated ${new Date(report.timestamp).toLocaleString()}`}
          className="mb-6"
        />

        <div className="mb-8 grid grid-cols-2 gap-4">
          <div className="workflow-panel rounded-xl p-5 text-center">
            <Target className="mx-auto mb-2 h-6 w-6 text-[#6efcff]" />
            <p className="text-[10px] uppercase tracking-wider text-white/45">TRL Level</p>
            <p className="font-headline text-3xl font-bold text-white/95">TRL {report.trl}</p>
            {typeof report.confidence === "number" && (
              <p className="mt-1 text-[11px] text-white/45">confidence {(report.confidence * 100).toFixed(0)}%</p>
            )}
          </div>
          <div className="workflow-panel rounded-xl p-5 text-center">
            <p className="text-[10px] uppercase tracking-wider text-white/45">Innovation Score</p>
            <p className="font-headline text-3xl font-bold text-emerald-400">{report.innovationScore}</p>
            <p className="mt-1 text-[11px] text-white/45">{isLlm ? "assigned by the LLM" : "formula of TRL + originality (rule-based)"}</p>
          </div>
        </div>

        {report.selfReportedTrl != null && (
          <div className={`mb-6 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
            Math.abs(report.selfReportedDelta ?? 0) >= 2 ? "border-amber-500/40 bg-amber-500/10 text-amber-100" : "border-white/10 bg-white/5 text-white/70"
          }`}>
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              You reported TRL {report.selfReportedTrl}; the evidence-based estimate is TRL {report.estimatedTrl ?? report.trl}
              {report.selfReportedDelta ? ` (${report.selfReportedDelta > 0 ? "+" : ""}${report.selfReportedDelta})` : ""}.
            </p>
          </div>
        )}

        <section className="workflow-panel mb-6 rounded-2xl p-6">
          <h2 className="mb-3 font-headline text-lg font-bold text-white/95">Why TRL {report.trl}?</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-white/70">{report.trlSummary}</p>
          {report.accomplishments.length > 0 && (
            <ul className="mt-4 space-y-1">
              {report.accomplishments.map((a, i) => (
                <li key={i} className="text-xs text-white/55">· {a}</li>
              ))}
            </ul>
          )}
          <EvidenceQuotes
            quotes={report.evidenceQuotes}
            title="Evidence the TRL rests on"
            emptyText={isLlm ? "The model cited no verbatim quotes." : "No evidence quotes — in rule-based mode the TRL comes from keyword matches, not from reading the document."}
            className="mt-4"
          />
        </section>

        {(report.keyIndicators?.length ?? 0) > 0 && (
          <section className="workflow-panel mb-6 rounded-2xl p-6">
            <h2 className="mb-3 flex items-center gap-2 font-headline text-lg font-bold text-white/95">
              <Zap className="h-4 w-4 text-yellow-400" /> Key indicators found in the text
            </h2>
            <ul className="space-y-1.5">
              {report.keyIndicators!.map((k, i) => (
                <li key={i} className="text-sm text-white/65">· {k}</li>
              ))}
            </ul>
          </section>
        )}

        {(report.missingForNextTrl?.length ?? 0) > 0 && (
          <section className="mb-6 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-6">
            <h2 className="mb-3 font-headline text-lg font-bold text-amber-100">What is needed for TRL {Math.min(9, report.trl + 1)}</h2>
            <ul className="space-y-1.5">
              {report.missingForNextTrl!.map((k, i) => (
                <li key={i} className="text-sm text-white/70">· {k}</li>
              ))}
            </ul>
          </section>
        )}

        {report.paperReview && (
          <section className="workflow-panel mb-6 rounded-2xl p-6">
            <h2 className="mb-3 flex items-center gap-2 font-headline text-lg font-bold text-white/95">
              <FileText className="h-4 w-4 text-[#6efcff]" /> Paper review
              {report.paperReview.confidence_in_analysis && (
                <span className="ml-auto rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-normal text-white/60">
                  confidence: {report.paperReview.confidence_in_analysis}
                </span>
              )}
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {([
                ["Methodology", report.paperReview.methodology_assessment],
                ["Data quality", report.paperReview.data_quality],
                ["Reproducibility", report.paperReview.reproducibility],
              ] as Array<[string, string | undefined]>).map(([label, text]) => (
                <div key={label} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="mb-1 text-[11px] uppercase tracking-wider text-white/45">{label}</p>
                  <p className="text-sm leading-relaxed text-white/70">{text || "—"}</p>
                </div>
              ))}
            </div>
            {(report.paperReview.potential_hallucinations?.length ?? 0) > 0 && (
              <div className="mt-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3">
                <p className="mb-1 text-xs font-semibold text-yellow-300">Claims flagged as unsupported</p>
                <ul className="space-y-0.5">
                  {report.paperReview.potential_hallucinations!.map((h, i) => (
                    <li key={i} className="text-xs text-yellow-100/80">· {h}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        <section className="workflow-panel mb-6 rounded-2xl p-6">
          <h2 className="mb-4 font-headline text-lg font-bold text-white/95">Milestone Roadmap</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {milestones.map(([key, m]) => (
              <div key={key} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white/70">{MILESTONE_LABELS[key] || key}</span>
                  <span className="font-mono text-[10px] capitalize text-[#6efcff]">{m.status}</span>
                </div>
                <p className="mt-2 text-xs text-white/60">{m.description}</p>
                <p className="mt-1 font-mono text-[10px] text-white/40">{m.timeline}</p>
                {(m.specific_actions?.length ?? 0) > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {m.specific_actions!.slice(0, 4).map((a, i) => (
                      <li key={i} className="text-[11px] text-white/55">· {a}</li>
                    ))}
                  </ul>
                )}
                {(m.resources_needed?.length ?? 0) > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {m.resources_needed!.slice(0, 5).map((r, i) => (
                      <span key={i} className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/55">{r}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="workflow-panel rounded-2xl p-6">
          <h2 className="mb-2 font-headline text-lg font-bold text-white/95">Partnership Outlook</h2>
          <p className="text-sm text-white/65">{report.potentialPartnership}</p>
          <p className="mt-4 text-xs text-white/40">
            Source: {report.engineSource ? report.engineSource.replace(/^llm:/, "LLM · ").replace(/_/g, " ") : report.analysisSource === "engine" ? "matdao-ip-engine" : "client fallback"} ·{" "}
            <Link href="/ai-studio/project-assessment" className="text-[#c5fdff] underline">
              Run full assessment (TRL + IP + DD)
            </Link>
          </p>
        </section>
      </div>
    </div>
  )
}
