"use client"

import { useState } from "react"
import {
  AlertTriangle,
  BookMarked,
  CheckCircle2,
  ExternalLink,
  FileSearch,
  Scale,
  ScrollText,
  Search,
  Sparkles,
  XCircle,
} from "lucide-react"
import type { AnalysisReport, PriorArtHit, PriorArtSourceStatus } from "@/lib/ai-studio/types"
import { EvidenceQuotes } from "./EvidenceQuotes"

interface PriorArtSectionProps {
  originality?: AnalysisReport["originality"] | null
  className?: string
}

const SEARCH_LINK_LABELS: Record<string, string> = {
  wipo_patentscope: "WIPO PATENTSCOPE",
  espacenet: "Espacenet",
  google_patents: "Google Patents",
  google_scholar: "Google Scholar",
  autm_innovation_marketplace: "AUTM Innovation Marketplace",
  lens: "Lens.org",
  openalex: "OpenAlex",
  sciencedirect: "ScienceDirect",
  uspto_ppubs: "USPTO Patent Public Search",
}
const SEARCH_LINK_ORDER = [
  "wipo_patentscope", "espacenet", "google_patents", "google_scholar", "autm_innovation_marketplace", "lens", "openalex", "sciencedirect", "uspto_ppubs",
]

const SOURCE_LABELS: Record<string, string> = {
  google_patents: "Google Patents",
  lens: "Lens",
  openalex: "OpenAlex",
  semantic_scholar: "Semantic Scholar",
  crossref: "Crossref",
  sciencedirect: "ScienceDirect",
  matdao_local_corpus: "MatDAO sample corpus",
  uspto: "USPTO",
}

function sourceLabel(name: string | undefined): string {
  if (!name) return "unknown"
  return SOURCE_LABELS[name] ?? name.replace(/_/g, " ")
}

function verdictTone(verdict: string | undefined): { label: string; cls: string; Icon: typeof CheckCircle2 } {
  const v = (verdict ?? "").toLowerCase()
  if (v.includes("novel")) return { label: "Novel", cls: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200", Icon: CheckCircle2 }
  if (v.includes("incremental")) return { label: "Incremental", cls: "border-amber-500/40 bg-amber-500/15 text-amber-100", Icon: AlertTriangle }
  if (v.includes("anticipat")) return { label: "Likely anticipated", cls: "border-red-500/40 bg-red-500/15 text-red-200", Icon: XCircle }
  return { label: verdict || "No verdict", cls: "border-white/15 bg-white/5 text-white/70", Icon: Scale }
}

function severityCls(sev: string | undefined): string {
  const s = (sev ?? "").toLowerCase()
  if (s === "high") return "border-red-500/40 bg-red-500/15 text-red-200"
  if (s === "medium") return "border-amber-500/40 bg-amber-500/15 text-amber-100"
  return "border-white/15 bg-white/5 text-white/70"
}

function statusCls(status: string): string {
  switch (status) {
    case "ok": return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
    case "empty": return "border-white/15 bg-white/5 text-white/55"
    case "error": return "border-red-500/40 bg-red-500/10 text-red-200"
    case "not_configured": return "border-white/10 bg-black/20 text-white/40"
    default: return "border-white/15 bg-white/5 text-white/60"
  }
}

function NoveltyGauge({ score, confidence }: { score: number | null; confidence?: number }) {
  const pct = score === null ? 0 : Math.max(0, Math.min(100, score))
  const color = pct >= 70 ? "#34d399" : pct >= 40 ? "#fbbf24" : "#f87171"
  const r = 44
  const c = 2 * Math.PI * r
  const dash = (pct / 100) * c
  return (
    <div className="flex items-center gap-4">
      <svg width="112" height="112" viewBox="0 0 112 112" role="img" aria-label={`Novelty score ${score ?? "unknown"}`}>
        <circle cx="56" cy="56" r={r} stroke="rgba(255,255,255,0.1)" strokeWidth="10" fill="none" />
        <circle
          cx="56" cy="56" r={r} stroke={color} strokeWidth="10" fill="none" strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`} transform="rotate(-90 56 56)"
        />
        <text x="56" y="52" textAnchor="middle" fill="white" fontSize="24" fontWeight="700">{score === null ? "—" : Math.round(pct)}</text>
        <text x="56" y="70" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="10">/ 100</text>
      </svg>
      <div>
        <p className="text-[11px] uppercase tracking-wider text-white/45">Novelty score</p>
        <p className="text-sm text-white/70">
          {score === null ? "Not assessed" : pct >= 70 ? "Strong differentiation from prior art" : pct >= 40 ? "Partial overlap with prior art" : "Heavy overlap — claims likely anticipated"}
        </p>
        {typeof confidence === "number" && (
          <p className="mt-1 text-xs text-white/45">Assessment confidence {(confidence * 100).toFixed(0)}%</p>
        )}
      </div>
    </div>
  )
}

function HitRow({ hit, kind }: { hit: PriorArtHit; kind: "patent" | "paper" }) {
  const sim = typeof hit.similarity === "number" ? hit.similarity : null
  return (
    <tr className="border-b border-white/5 align-top">
      <td className="py-2.5 pr-3">
        <span className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${kind === "patent" ? "border-[#6efcff]/30 bg-[#6efcff]/10 text-[#c5fdff]" : "border-purple-400/30 bg-purple-500/10 text-purple-200"}`}>
          {kind}
        </span>
      </td>
      <td className="py-2.5 pr-3">
        {hit.url ? (
          <a href={hit.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-1 text-sm text-white/85 hover:text-[#c5fdff]">
            <span>{hit.title || hit.id || "Untitled"}</span>
            <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 opacity-60" />
          </a>
        ) : (
          <p className="text-sm text-white/85">{hit.title || hit.id || "Untitled"}</p>
        )}
        <p className="mt-0.5 font-mono text-[11px] text-white/40">
          {[hit.id, hit.date, hit.assignee].filter(Boolean).join(" · ")}
        </p>
      </td>
      <td className="py-2.5 pr-3 text-xs text-white/55">{sourceLabel(hit.source)}</td>
      <td className="py-2.5 text-right font-mono text-xs text-white/70">{sim === null ? "—" : `${(sim * 100).toFixed(0)}%`}</td>
    </tr>
  )
}

/**
 * "IP Originality & Prior Art": novelty gauge + verdict, key differentiators,
 * overlapping prior-art table, patent/paper lists, source status chips,
 * claim narrowing, evidence quotes, and "search manually" links.
 */
export function PriorArtSection({ originality, className = "" }: PriorArtSectionProps) {
  const [showAllHits, setShowAllHits] = useState(false)
  if (!originality) return null

  const prior = originality.prior_art
  const assessment = originality.assessment
  const noveltyScore = typeof assessment?.novelty_score === "number" ? assessment.novelty_score : null
  const verdict = verdictTone(assessment?.verdict)
  const VerdictIcon = verdict.Icon
  const patents = prior?.patents ?? []
  const papers = prior?.papers ?? []
  const overlaps = assessment?.overlapping_prior_art ?? []
  const sources: PriorArtSourceStatus[] = prior?.sources_queried ?? []
  const links = prior?.search_links ?? {}
  const linkKeys = [...SEARCH_LINK_ORDER.filter((k) => links[k]), ...Object.keys(links).filter((k) => !SEARCH_LINK_ORDER.includes(k))]
  const isLlmVerdict = assessment?.analysis_source === "llm"
  const livePatents = prior?.live_patent_count ?? 0
  const hitLimit = showAllHits ? 50 : 6

  return (
    <section className={`workflow-panel rounded-2xl border border-white/10 p-6 ${className}`}>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="rounded-xl bg-[#6efcff]/15 p-2.5">
          <FileSearch className="h-5 w-5 text-[#c5fdff]" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-headline text-lg font-bold text-white/95">IP Originality &amp; Prior Art</h2>
          <p className="text-xs text-white/50">
            {isLlmVerdict
              ? <>Verdict by LLM ({[assessment?.llm_provider, assessment?.llm_model].filter(Boolean).join(" / ") || "configured provider"}) after reading the document against the prior art below</>
              : <>Rule-based verdict from {originality.similarity_method ?? "text"} similarity — no model read the document</>}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${verdict.cls}`}>
          <VerdictIcon className="h-3.5 w-3.5" />
          {verdict.label}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <NoveltyGauge score={noveltyScore} confidence={assessment?.confidence} />
          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-white/5 px-2 py-1.5">
              <p className="text-[10px] uppercase tracking-wider text-white/40">Max similarity</p>
              <p className="font-mono text-sm text-white/80">{(originality.max_cosine_similarity * 100).toFixed(0)}%</p>
            </div>
            <div className="rounded-lg bg-white/5 px-2 py-1.5">
              <p className="text-[10px] uppercase tracking-wider text-white/40">Live patents</p>
              <p className="font-mono text-sm text-white/80">{livePatents}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {assessment?.summary && (
            <p className="text-sm leading-relaxed text-white/75">{assessment.summary}</p>
          )}
          {(assessment?.key_differentiators?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-200/80">
                <Sparkles className="h-3.5 w-3.5" /> Key differentiators
              </p>
              <ul className="space-y-1">
                {assessment!.key_differentiators!.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-white/75">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300/80" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(assessment?.recommended_claim_narrowing?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-100/80">
                <Scale className="h-3.5 w-3.5" /> Recommended claim narrowing
              </p>
              <ul className="space-y-1">
                {assessment!.recommended_claim_narrowing!.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-white/75">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300/80" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {overlaps.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/55">Overlapping prior art ({overlaps.length})</p>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[560px] text-left">
              <thead className="bg-white/5 text-[11px] uppercase tracking-wider text-white/45">
                <tr>
                  <th className="px-3 py-2">Reference</th>
                  <th className="px-3 py-2">Why it overlaps</th>
                  <th className="px-3 py-2 text-right">Severity</th>
                </tr>
              </thead>
              <tbody>
                {overlaps.map((o, i) => (
                  <tr key={`${o.id ?? i}`} className="border-t border-white/5 align-top">
                    <td className="px-3 py-2.5">
                      {o.url ? (
                        <a href={o.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-1 text-sm text-white/85 hover:text-[#c5fdff]">
                          <span>{o.title || o.id || "Untitled"}</span>
                          <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 opacity-60" />
                        </a>
                      ) : (
                        <p className="text-sm text-white/85">{o.title || o.id || "Untitled"}</p>
                      )}
                      {o.id && <p className="mt-0.5 font-mono text-[11px] text-white/40">{o.id}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-xs leading-relaxed text-white/65">{o.overlap_reason || "—"}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${severityCls(o.overlap_severity)}`}>
                        {o.overlap_severity ?? "n/a"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(patents.length > 0 || papers.length > 0) && (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
              Search results — {patents.length} patents · {papers.length} papers
            </p>
            {patents.length + papers.length > 12 && (
              <button type="button" onClick={() => setShowAllHits((v) => !v)} className="text-xs text-white/50 hover:text-white/80">
                {showAllHits ? "Show fewer" : "Show all"}
              </button>
            )}
          </div>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[560px] text-left">
              <thead className="bg-white/5 text-[11px] uppercase tracking-wider text-white/45">
                <tr>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2 text-right">Similarity</th>
                </tr>
              </thead>
              <tbody className="[&>tr>td]:px-3">
                {patents.slice(0, hitLimit).map((h, i) => <HitRow key={`p-${h.id || i}`} hit={h} kind="patent" />)}
                {papers.slice(0, hitLimit).map((h, i) => <HitRow key={`a-${h.id || i}`} hit={h} kind="paper" />)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {patents.length === 0 && papers.length === 0 && originality.top_patent_matches?.length > 0 && (
        <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/55">Closest local-corpus patents</p>
          <ul className="space-y-1.5">
            {originality.top_patent_matches.slice(0, 5).map((m) => (
              <li key={m.patent_id} className="flex items-start justify-between gap-3 text-sm">
                <span className="text-white/75">
                  <span className="font-mono text-xs text-white/45">{m.patent_id}</span> {m.title}
                </span>
                <span className="font-mono text-xs text-white/55">{(m.cosine_similarity * 100).toFixed(0)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sources.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/55">Sources queried</p>
          <div className="flex flex-wrap gap-1.5">
            {sources.map((s, i) => (
              <span
                key={`${s.name}-${i}`}
                title={s.errors?.join("; ") || `${s.count} results in ${s.ms} ms`}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${statusCls(s.status)}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${s.status === "ok" ? "bg-emerald-300" : s.status === "error" ? "bg-red-300" : "bg-white/40"}`} />
                {sourceLabel(s.name)} · {s.status === "not_configured" ? "no key" : s.status} · {s.count}
              </span>
            ))}
          </div>
        </div>
      )}

      <EvidenceQuotes
        quotes={assessment?.evidence_quotes}
        title="Quotes the verdict relies on"
        className="mt-5"
      />

      {(prior?.queries?.length ?? 0) > 0 && (
        <p className="mt-4 text-[11px] text-white/40">
          <ScrollText className="mr-1 inline h-3 w-3" />
          Queries: {prior!.queries!.map((q) => `“${q}”`).join(", ")}
        </p>
      )}

      {linkKeys.length > 0 && (
        <div className="mt-5 border-t border-white/10 pt-4">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/55">
            <Search className="h-3.5 w-3.5" /> Search manually
          </p>
          <div className="flex flex-wrap gap-2">
            {linkKeys.map((k) => (
              <a
                key={k}
                href={links[k]}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/75 transition-colors hover:border-[#6efcff]/40 hover:text-[#c5fdff]"
              >
                <BookMarked className="h-3.5 w-3.5" />
                {SEARCH_LINK_LABELS[k] ?? k.replace(/_/g, " ")}
                <ExternalLink className="h-3 w-3 opacity-60" />
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
