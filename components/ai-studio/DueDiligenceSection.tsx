"use client"

import { AlertTriangle, Brain, CheckCircle2, ListChecks, ShieldAlert } from "lucide-react"
import type { DueDiligenceReport, EngineDueDiligenceReport } from "@/lib/ai-studio/types"
import { describeProvenance } from "@/lib/ai-studio/api"
import { SpiderChart } from "./SpiderChart"
import { EvidenceQuotes } from "./EvidenceQuotes"

interface DueDiligenceSectionProps {
  dd: DueDiligenceReport
  className?: string
}

function scoreTone(score: number): { text: string; bar: string } {
  if (score >= 80) return { text: "text-emerald-300", bar: "bg-emerald-400" }
  if (score >= 60) return { text: "text-teal-300", bar: "bg-teal-400" }
  if (score >= 40) return { text: "text-amber-300", bar: "bg-amber-400" }
  return { text: "text-red-300", bar: "bg-red-400" }
}

function tierTone(tier: DueDiligenceReport["investmentTier"]): string {
  if (tier === "pass") return "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
  if (tier === "review") return "border-amber-500/40 bg-amber-500/15 text-amber-100"
  return "border-red-500/40 bg-red-500/15 text-red-200"
}

function Pairs({ title, rows }: { title: string; rows: Array<[string, string | undefined]> }) {
  const list = rows.filter(([, v]) => typeof v === "string" && v.trim())
  if (list.length === 0) return null
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/60">{title}</p>
      <dl className="space-y-2">
        {list.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[11px] uppercase tracking-wider text-white/40">{k}</dt>
            <dd className="text-sm leading-relaxed text-white/75">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function Bullets({ title, items, tone = "text-white/70" }: { title: string; items?: string[]; tone?: string }) {
  const list = (items ?? []).filter((s) => typeof s === "string" && s.trim())
  if (list.length === 0) return null
  return (
    <div>
      <p className="mb-1 text-[11px] uppercase tracking-wider text-white/40">{title}</p>
      <ul className="space-y-1">
        {list.map((s, i) => (
          <li key={i} className={`flex items-start gap-2 text-sm ${tone}`}>
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" />
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function LlmFindings({ llm }: { llm: EngineDueDiligenceReport }) {
  const rec = llm.investment_recommendation
  return (
    <div className="space-y-4">
      {rec && (
        <div className="rounded-xl border border-[#6efcff]/25 bg-[#6efcff]/5 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#c5fdff]">LLM investment recommendation</p>
            {rec.overall_score != null && <span className="font-mono text-sm text-white/85">{String(rec.overall_score)}/100</span>}
            {rec.investment_tier && <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-xs text-white/75">{rec.investment_tier}</span>}
          </div>
          {rec.recommended_action && <p className="text-sm leading-relaxed text-white/80">{rec.recommended_action}</p>}
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Bullets title="Key strengths" items={rec.key_strengths} tone="text-emerald-100/85" />
            <Bullets title="Key concerns" items={rec.key_concerns} tone="text-amber-100/85" />
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <Pairs title="Scientific rigor" rows={[
          ["Methodology quality", llm.scientific_rigor?.methodology_quality],
          ["Experimental design", llm.scientific_rigor?.experimental_design],
          ["Data analysis", llm.scientific_rigor?.data_analysis],
          ["Statistical significance", llm.scientific_rigor?.statistical_significance],
          ["Reproducibility", llm.scientific_rigor?.reproducibility_score],
        ]} />
        <Pairs title="Innovation assessment" rows={[
          ["Technical novelty", llm.innovation_assessment?.technical_novelty],
          ["Prior art", llm.innovation_assessment?.prior_art_analysis],
          ["Patentability", llm.innovation_assessment?.patentability_potential],
          ["Publication quality", llm.innovation_assessment?.publication_quality],
        ]} />
        <Pairs title="Team capability" rows={[
          ["Technical expertise", llm.team_capability?.technical_expertise],
          ["Track record", llm.team_capability?.research_track_record],
          ["Collaboration network", llm.team_capability?.collaboration_network],
          ["Resources", llm.team_capability?.resource_availability],
        ]} />
        <Pairs title="Market fit" rows={[
          ["Problem solved", llm.market_fit?.problem_solving],
          ["Market need", llm.market_fit?.market_need],
          ["Competitive advantage", llm.market_fit?.competitive_advantage],
          ["Scalability", llm.market_fit?.scalability_potential],
        ]} />
      </div>

      {llm.risk_assessment && (
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/60">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-300" /> Risk assessment
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <Bullets title="Technical" items={llm.risk_assessment.technical_risks} />
            <Bullets title="Execution" items={llm.risk_assessment.execution_risks} />
            <Bullets title="Market" items={llm.risk_assessment.market_risks} />
            <Bullets title="Regulatory" items={llm.risk_assessment.regulatory_risks} />
          </div>
        </div>
      )}

      {(llm.unsupported_claims?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-100">
            <AlertTriangle className="h-3.5 w-3.5" /> Claims without supporting data ({llm.unsupported_claims!.length})
          </p>
          <ul className="space-y-1">
            {llm.unsupported_claims!.map((c, i) => (
              <li key={i} className="text-sm text-amber-50/85">· {c}</li>
            ))}
          </ul>
        </div>
      )}

      {llm.next_steps && (
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/60">
            <ListChecks className="h-3.5 w-3.5 text-[#6efcff]" /> Next steps
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <Bullets title="Due diligence items" items={llm.next_steps.due_diligence_items} />
            <Bullets title="Information to request" items={llm.next_steps.information_requests} />
            <Bullets title="Expert consultation" items={llm.next_steps.expert_consultation_needed} />
          </div>
        </div>
      )}

      <EvidenceQuotes quotes={llm.evidence_quotes} title="Quotes the due diligence relies on" />
    </div>
  )
}

/** Due-diligence scorecard + the backend's LLM findings, with truthful source labels. */
export function DueDiligenceSection({ dd, className = "" }: DueDiligenceSectionProps) {
  const tone = scoreTone(dd.totalScore)
  const scored = dd.dimensions.filter((d) => !d.unscored)
  const isLlm = dd.provenance?.analysisMode === "llm"

  return (
    <section className={`workflow-panel rounded-2xl border border-white/10 p-6 ${className}`}>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="rounded-xl bg-[#6efcff]/15 p-2.5">
          <Brain className="h-5 w-5 text-[#c5fdff]" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-headline text-lg font-bold text-white/95">Due Diligence</h2>
          <p className="text-xs text-white/50">{dd.scoreSource ?? describeProvenance(dd.provenance)}</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${tierTone(dd.investmentTier)}`}>
          {dd.investmentTier}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="mb-1 text-[11px] uppercase tracking-wider text-white/45">Total score</p>
          <div className="flex items-center gap-3">
            <p className={`font-headline text-3xl font-bold ${tone.text}`}>
              {dd.totalScore.toFixed(0)}<span className="text-base text-white/40"> / {dd.maxTotalScore}</span>
            </p>
            <div className="h-2 flex-1 rounded-full bg-white/10">
              <div className={`h-2 rounded-full ${tone.bar}`} style={{ width: `${Math.min(100, (dd.totalScore / dd.maxTotalScore) * 100)}%` }} />
            </div>
          </div>
          {dd.integrityGateTriggered && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-red-300">
              <AlertTriangle className="h-3.5 w-3.5" /> Integrity gate triggered — {dd.layers.integrityGate}
            </p>
          )}
          <div className="mt-4 space-y-1.5 text-xs text-white/55">
            <p><span className="text-white/40">Layer 1 · </span>{dd.layers.layer1}</p>
            <p><span className="text-white/40">Layer 2 · </span>{dd.layers.layer2}</p>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="mb-1 text-[11px] uppercase tracking-wider text-white/45">
            Scored dimensions ({scored.length} of {dd.dimensions.length} have a numeric basis)
          </p>
          {scored.length >= 3 ? (
            <SpiderChart data={scored.map((d) => ({ name: d.name, score: d.score, maxScore: d.maxScore }))} />
          ) : (
            <p className="text-xs text-white/45">Not enough scored dimensions to chart.</p>
          )}
        </div>
      </div>

      <div className="mt-5 space-y-2.5">
        {dd.dimensions.map((dim) => {
          const pct = dim.unscored ? 0 : (dim.score / dim.maxScore) * 100
          return (
            <div key={dim.id} className={`rounded-xl border p-4 ${dim.id === 9 && !dim.unscored && dim.score <= 1 ? "border-red-500/30 bg-red-500/5" : "border-white/10 bg-black/20"}`}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] text-white/30">Dim{dim.id}</span>
                <span className="text-sm font-medium text-white/90">{dim.name}</span>
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] uppercase tracking-wider text-white/40">{dim.layer}</span>
                {dim.source && <span className="text-[10px] text-white/35">source: {dim.source}</span>}
                <span className="ml-auto text-right">
                  {dim.unscored ? (
                    <span className="text-xs text-white/45">qualitative only</span>
                  ) : (
                    <span className="font-mono text-sm font-bold text-[#6efcff]">{dim.score}/{dim.maxScore}</span>
                  )}
                  <span className="ml-2 text-[10px] text-white/40">weight {dim.weight}%</span>
                </span>
              </div>
              {!dim.unscored && (
                <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-[#6efcff]" style={{ width: `${pct}%` }} />
                </div>
              )}
              <ul className="space-y-0.5">
                {dim.evidence.map((e, i) => (
                  <li key={i} className="text-xs leading-relaxed text-white/55">· {e}</li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      <div className="mt-6 border-t border-white/10 pt-5">
        <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/60">
          {isLlm ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />}
          {isLlm ? "LLM findings (read from the document)" : "LLM findings"}
        </p>
        {dd.llmReport ? (
          <LlmFindings llm={dd.llmReport} />
        ) : (
          <p className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm text-amber-100/80">
            No LLM due diligence was produced for this report — the backend ran in rule-based mode. Team, market, methodology and publication dimensions above are unscored because nothing read the document. Configure DEEPSEEK_API_KEY (or another provider) on the IP Engine to enable it.
          </p>
        )}
      </div>
    </section>
  )
}
