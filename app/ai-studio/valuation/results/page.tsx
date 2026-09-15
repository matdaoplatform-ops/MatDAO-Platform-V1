"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, Lock, PieChart, TrendingUp } from "lucide-react"
import { AuditableValue } from "@/components/ai-studio/AuditableValue"
import { AnalysisModeBanner } from "@/components/ai-studio/AnalysisModeBanner"
import { DocumentReadCard } from "@/components/ai-studio/DocumentReadCard"
import { FtoOverlapTable } from "@/components/ai-studio/FtoOverlapTable"
import { PriorArtSection } from "@/components/ai-studio/PriorArtSection"
import { ValuationNotice, isValuationUnavailable } from "@/components/ai-studio/ValuationNotice"
import type { AnalysisReport, HitlModifiers } from "@/lib/ai-studio/types"
import {
  computeAdjustedValuation,
  computeTokenizationBreakdown,
  formatUsd,
  provenanceFromReport,
} from "@/lib/ai-studio/api"

function ModifierSlider({
  label,
  description,
  maxPct,
  value,
  onChange,
}: {
  label: string
  description: string
  maxPct: number
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="rounded-xl border border-white/12 bg-white/3 p-4">
      <div className="mb-2 flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-white/90">{label}</p>
          <p className="mt-0.5 text-xs text-white/50">{description}</p>
        </div>
        <span className="font-mono text-xs text-[#6efcff]">±{maxPct}% max</span>
      </div>
      <input
        type="range"
        min={-100}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="slider-track w-full"
      />
      <div className="mt-1 flex justify-between text-[10px] text-white/40">
        <span>−{maxPct}%</span>
        <span className="text-white/70">{value > 0 ? "+" : ""}{value}%</span>
        <span>+{maxPct}%</span>
      </div>
    </div>
  )
}

function FractionSlider({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="rounded-xl border border-purple-400/25 bg-purple-500/5 p-4">
      <div className="mb-2 flex items-start justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-white/90">
            <PieChart className="h-4 w-4 text-purple-300" />
            Fraction of IP to Tokenize
          </p>
          <p className="mt-0.5 text-xs text-white/50">
            You may own 100% but only list a portion (e.g. 20%) for sale on-platform
          </p>
        </div>
        <span className="font-headline font-mono text-lg font-bold text-purple-300">{value}%</span>
      </div>
      <input
        type="range"
        min={1}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="slider-track w-full"
      />
      <div className="mt-1 flex justify-between text-[10px] text-white/40">
        <span>1%</span>
        <span className="text-purple-300/80">{100 - value}% retained off-platform</span>
        <span>100%</span>
      </div>
    </div>
  )
}

export default function ValuationResultsPage() {
  const [report, setReport] = useState<AnalysisReport | null>(null)
  const [modifiers, setModifiers] = useState<HitlModifiers>({
    teamPedigree: 0,
    tradeSecrets: 0,
    partnerships: 0,
  })
  const [tokenizationFraction, setTokenizationFraction] = useState(100)

  useEffect(() => {
    const stored = sessionStorage.getItem("matdao-ip-report")
    if (stored) setReport(JSON.parse(stored))
  }, [])

  const { total: adjustedValuation, audit: hitlAudit } = useMemo(() => {
    if (!report) return { total: 0, audit: [] }
    return computeAdjustedValuation(report.valuation.tokenization_anchor_usd, modifiers)
  }, [report, modifiers])

  const tokenization = useMemo(() => {
    return computeTokenizationBreakdown(adjustedValuation, tokenizationFraction, hitlAudit)
  }, [adjustedValuation, tokenizationFraction, hitlAudit])

  const fullAuditTrail = useMemo(() => {
    if (!report) return []
    return [
      ...(report.valuation.audit_trail ?? []),
      ...tokenization.hitlAudit,
    ]
  }, [report, tokenization.hitlAudit])

  if (!report) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="text-center">
          <p className="mb-4 text-white/60">No analysis report found.</p>
          <Link href="/ai-studio/valuation/submit" className="text-sm text-[#6efcff] hover:underline">
            Run an evaluation first
          </Link>
        </div>
      </div>
    )
  }

  const { classification, originality, fto, valuation, document_profile } = report
  const valuationUnavailable = isValuationUnavailable(valuation)
  const provenance = provenanceFromReport(report)

  return (
    <div className="relative px-5 py-12 sm:px-6 md:py-16">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-[-10%] right-[10%] h-[500px] w-[500px] rounded-full bg-indigo-500/3 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl space-y-8">
        <div>
          <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[#c5fdff]">Analysis Complete</p>
          <h1 className="font-headline text-3xl font-bold text-white/95 md:text-4xl">IP Valuation Report</h1>
          <p className="mt-2 text-sm text-white/55">
            {classification.sector_name} · IPC {classification.ipc_primary} · NACE {classification.nace_code}
            {document_profile && (
              <> · {document_profile.document_type.replace(/_/g, " ")} · {originality.patent_corpus_size} patents indexed</>
            )}
          </p>
        </div>

        <AnalysisModeBanner
          provenance={provenance}
          note={`Report ${report.report_metadata.report_id}`}
        />

        <ValuationNotice valuation={valuation} />

        <DocumentReadCard profile={document_profile} stats={report.document_stats} />

        {fto.expert_consultation_required && (
          <div className="risk-flag-pulse flex gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-5 py-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <p className="text-sm font-semibold text-amber-200">
                High Claim Overlap Detected in Patent Group {fto.high_risk_patent_group}
              </p>
              <p className="mt-1 text-xs text-amber-200/70">
                Professional Patent Attorney Consultation Recommended before Tokenization Minting.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-white/12 bg-white/3 p-5">
            <p className="mb-1 text-[11px] uppercase tracking-wider text-white/45">Originality Premium</p>
            <p className="text-2xl font-bold text-[#6efcff]">+{(originality.originality_premium_s * 100).toFixed(1)}%</p>
            <p className="mt-1 text-xs text-white/45">Max similarity: {(originality.max_cosine_similarity * 100).toFixed(1)}%</p>
          </div>
          <div className="rounded-xl border border-white/12 bg-white/3 p-5">
            <p className="mb-1 text-[11px] uppercase tracking-wider text-white/45">FTO Risk Haircut</p>
            <p className="text-2xl font-bold text-amber-300">−{(fto.r_fto * 100).toFixed(1)}%</p>
            <p className="mt-1 text-xs text-white/45">{fto.flagged_patent_count} flagged · {fto.analysis_source}</p>
          </div>
          {valuationUnavailable ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
              <p className="mb-1 text-[11px] uppercase tracking-wider text-white/45">Listed Tokenization Value</p>
              <p className="text-lg font-bold text-amber-200">Under revision</p>
              <p className="mt-1 text-xs text-white/45">
                {originality.assessment?.novelty_score != null
                  ? `Novelty ${originality.assessment.novelty_score}/100 · ${originality.assessment.verdict ?? ""}`
                  : "No USD figure until the valuation model ships"}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-white/12 bg-white/3 p-5">
              <p className="mb-1 text-[11px] uppercase tracking-wider text-white/45">Listed Tokenization Value</p>
              <p className="text-2xl font-bold text-purple-300">{formatUsd(tokenization.listedTokenizationValue)}</p>
              <p className="mt-1 text-xs text-white/45">{tokenizationFraction}% of {formatUsd(adjustedValuation)} full value</p>
            </div>
          )}
        </div>

        <PriorArtSection originality={originality} />

        {valuationUnavailable ? (
          <div className="workflow-panel rounded-2xl p-6">
            <div className="mb-2 flex items-center gap-2">
              <Lock className="h-4 w-4 text-amber-300" />
              <h2 className="font-headline text-lg font-semibold">Valuation, HITL modifiers &amp; tokenization split</h2>
            </div>
            <p className="text-sm text-white/60">
              Hidden while the valuation methodology is being rebuilt — the engine returned <code className="font-mono text-xs">valuation_available: false</code>
              {valuation.valuation_status ? <> (<span className="font-mono text-xs">{valuation.valuation_status}</span>)</> : null}. Originality, prior art and FTO results above are unaffected.
            </p>
          </div>
        ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="workflow-panel rounded-2xl p-6">
            <div className="mb-4 flex items-center gap-2">
              <Lock className="h-4 w-4 text-[#6efcff]" />
              <h2 className="font-headline text-lg font-semibold">70% AI Baseline Guardrail</h2>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-white/60">V<sub>target</sub></span>
                <span className="font-mono text-white/90">{formatUsd(valuation.v_target_usd)}</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-3">
                <span className="text-white/60">Tokenization Anchor (70%)</span>
                <span className="font-mono font-bold text-[#6efcff]">{formatUsd(valuation.tokenization_anchor_usd)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Valuation Floor</span>
                <span className="font-mono text-white/70">{formatUsd(valuation.valuation_floor_usd)}</span>
              </div>
            </div>
          </div>

          <div className="workflow-panel rounded-2xl p-6">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#6efcff]" />
              <h2 className="font-headline text-lg font-semibold">30% HITL + Tokenization Split</h2>
            </div>
            <div className="mb-4 space-y-4">
              <ModifierSlider label="Team Pedigree & Execution" description="Founder track record, domain expertise" maxPct={10} value={modifiers.teamPedigree} onChange={(v) => setModifiers((m) => ({ ...m, teamPedigree: v }))} />
              <ModifierSlider label="Trade Secrets & Know-How" description="Undocumented processes, proprietary data" maxPct={15} value={modifiers.tradeSecrets} onChange={(v) => setModifiers((m) => ({ ...m, tradeSecrets: v }))} />
              <ModifierSlider label="Strategic Partnerships" description="LOIs, pilots, distribution channels" maxPct={5} value={modifiers.partnerships} onChange={(v) => setModifiers((m) => ({ ...m, partnerships: v }))} />
              <FractionSlider value={tokenizationFraction} onChange={setTokenizationFraction} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-xl border border-white/15 bg-white/3 px-4 py-3">
                <span className="text-xs text-white/50">Full adjusted value (100% IP)</span>
                <span className="font-mono text-white/80">{formatUsd(adjustedValuation)}</span>
              </div>
              <div className="rounded-xl border border-purple-400/30 bg-purple-500/10 px-4 py-4">
                <p className="mb-1 text-xs text-white/50">Amount listed for tokenization ({tokenizationFraction}%)</p>
                <p className="font-headline text-3xl font-bold text-purple-300">{formatUsd(tokenization.listedTokenizationValue)}</p>
                {tokenizationFraction < 100 && (
                  <p className="mt-2 text-xs text-white/40">
                    {tokenization.retainedOwnershipPct}% ({formatUsd(adjustedValuation - tokenization.listedTokenizationValue)}) retained off-platform
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
        )}

        {!valuationUnavailable && (
        <div className="workflow-panel rounded-2xl p-6">
          <h2 className="font-headline mb-1 text-lg font-semibold">Auditable Pricing Trail</h2>
          <p className="mb-4 text-xs text-white/45">
            Every figure is traceable — expand any line item for formula, calculation steps, and evidence references.
          </p>
          <div className="space-y-2">
            {fullAuditTrail.map((entry, i) => (
              <AuditableValue key={entry.id} entry={entry} defaultOpen={i === 0} />
            ))}
          </div>
        </div>
        )}

        <div className="workflow-panel rounded-2xl p-6">
          <h2 className="font-headline mb-1 text-lg font-semibold">Top Patent Matches &amp; FTO Overlap</h2>
          <p className="mb-4 text-xs text-white/45">
            {fto.analysis_source.replace(/_/g, " ")} · risk tier {fto.risk_tier_pct}% · {fto.flagged_patent_count} flagged
            {fto.confidence ? ` · confidence ${fto.confidence.level}` : ""}
          </p>
          <FtoOverlapTable rows={fto.overlap_matrix} limit={8} />
        </div>

        <div className="rounded-xl border border-white/10 bg-black/30 px-5 py-4 font-mono text-xs text-white/40">
          Report ID: {report.report_metadata.report_id} · Signed: {report.report_metadata.signature_sha256_hmac.slice(0, 16)}…
        </div>

        <Link href="/ai-studio/valuation/submit" className="inline-flex h-11 items-center rounded-full border border-white/20 px-6 text-sm text-white/70 transition-colors hover:text-white">
          New Analysis
        </Link>
      </div>
    </div>
  )
}
