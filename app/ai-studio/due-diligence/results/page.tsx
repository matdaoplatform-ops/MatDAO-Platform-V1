"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, CheckCircle2, FileText, XCircle } from "lucide-react"
import type { DueDiligenceReport } from "@/lib/ai-studio/types"
import { getInvestmentTierLabel } from "@/lib/ai-studio/due-diligence"
import { describeProvenance } from "@/lib/ai-studio/api"
import { AnalysisModeBanner } from "@/components/ai-studio/AnalysisModeBanner"
import { DocumentReadCard } from "@/components/ai-studio/DocumentReadCard"
import { DueDiligenceSection } from "@/components/ai-studio/DueDiligenceSection"
import { PriorArtSection } from "@/components/ai-studio/PriorArtSection"

const TIER_STYLES = {
  pass: { bg: "bg-emerald-500/10 border-emerald-500/30", text: "text-emerald-300", icon: CheckCircle2 },
  review: { bg: "bg-amber-500/10 border-amber-500/30", text: "text-amber-300", icon: AlertTriangle },
  fail: { bg: "bg-red-500/10 border-red-500/30", text: "text-red-300", icon: XCircle },
}

export default function DueDiligenceResultsPage() {
  const [report, setReport] = useState<DueDiligenceReport | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem("matdao-dd-report")
    if (stored) setReport(JSON.parse(stored))
  }, [])

  if (!report) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="text-center">
          <p className="mb-4 text-white/60">No due diligence report found.</p>
          <Link href="/ai-studio/due-diligence/submit" className="text-sm text-[#6efcff] hover:underline">
            Run an evaluation first
          </Link>
        </div>
      </div>
    )
  }

  const tierStyle = TIER_STYLES[report.investmentTier]
  const TierIcon = tierStyle.icon
  const scorePct = Math.round((report.totalScore / report.maxTotalScore) * 100)

  return (
    <div className="relative px-5 py-12 sm:px-6 md:py-16">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-[-10%] left-[10%] h-[500px] w-[500px] rounded-full bg-amber-500/3 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl space-y-8">
        <div>
          <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[#c5fdff]">Analysis Complete</p>
          <h1 className="font-headline text-3xl font-bold text-white/95 md:text-4xl">Due Diligence Report</h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-white/55">
            <FileText className="h-4 w-4" />
            {report.documentName} · {report.wordCount.toLocaleString()} words
          </p>
        </div>

        <AnalysisModeBanner
          provenance={report.provenance}
          note={`Generated ${new Date(report.timestamp).toLocaleString()}`}
        />

        {report.integrityGateTriggered && (
          <div className="risk-flag-pulse flex gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
            <div>
              <p className="text-sm font-semibold text-red-200">Integrity Gate Triggered (Dim9)</p>
              <p className="mt-1 text-xs text-red-200/70">
                Text extraction failed or research integrity concerns were detected. Total score forced to 0 per MatDAO diligence policy.
              </p>
            </div>
          </div>
        )}

        <div className={`rounded-xl border p-6 ${tierStyle.bg}`}>
          <div className="mb-3 flex items-center gap-2">
            <TierIcon className={`h-5 w-5 ${tierStyle.text}`} />
            <p className={`text-sm font-semibold ${tierStyle.text}`}>
              {getInvestmentTierLabel(report.investmentTier)}
            </p>
          </div>
          <p className="font-headline text-5xl font-bold text-white/95">
            {report.integrityGateTriggered ? "0" : report.totalScore}
            <span className="text-2xl text-white/40"> / {report.maxTotalScore}</span>
          </p>
          <p className="mt-2 text-xs text-white/50">{scorePct}% · {report.scoreSource ?? describeProvenance(report.provenance)}</p>
        </div>

        <DocumentReadCard profile={report.documentProfile} />

        <DueDiligenceSection dd={report} />

        <PriorArtSection originality={report.originality} />

        <div className="rounded-xl border border-white/10 bg-black/30 px-5 py-4 font-mono text-xs text-white/40">
          Report generated: {new Date(report.timestamp).toLocaleString()} · {describeProvenance(report.provenance)}
          {report.analysisSource === "client" ? " · client-side prototype scorer (deprecated)" : ""}
        </div>

        <Link
          href="/ai-studio/due-diligence/submit"
          className="inline-flex h-11 items-center rounded-full border border-white/20 px-6 text-sm text-white/70 transition-colors hover:text-white"
        >
          New Analysis
        </Link>
      </div>
    </div>
  )
}
