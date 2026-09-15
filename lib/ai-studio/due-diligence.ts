import { analyzeDocument, describeProvenance, provenanceFromReport } from "./api"
import type {
  AnalysisProvenance,
  AnalysisReport,
  DueDiligenceDimension,
  DueDiligenceReport,
  EngineDueDiligenceReport,
} from "./types"

/**
 * Nine-dimension scorecard. Only dimensions with a real numeric basis get a
 * score; the rest are shown as qualitative LLM findings (or "no basis" in
 * rule-based mode) and are excluded from the weighted total.
 */
const DIMENSION_DEFS = [
  { id: 1, name: "Evidence Quality", layer: "extraction" as const, weight: 12 },
  { id: 2, name: "Methodological Rigor", layer: "extraction" as const, weight: 12 },
  { id: 3, name: "Reproducibility", layer: "extraction" as const, weight: 10 },
  { id: 4, name: "Novelty & Originality", layer: "enrichment" as const, weight: 14 },
  { id: 5, name: "Publication Status", layer: "enrichment" as const, weight: 10 },
  { id: 6, name: "Team Credibility", layer: "enrichment" as const, weight: 10 },
  { id: 7, name: "Market Viability", layer: "enrichment" as const, weight: 12 },
  { id: 8, name: "Regulatory & FTO Risk", layer: "enrichment" as const, weight: 10 },
  { id: 9, name: "Research Integrity", layer: "integrity" as const, weight: 10 },
]

function clampScore(value: number): number {
  return Math.round(Math.min(10, Math.max(0, value)) * 10) / 10
}

function isLlmDueDiligence(dd: EngineDueDiligenceReport | undefined): dd is EngineDueDiligenceReport {
  return !!dd && typeof dd.analysis_source === "string" && dd.analysis_source.startsWith("llm")
}

function parseOverallScore(value: number | string | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.min(100, value))
  if (typeof value === "string") {
    const n = parseFloat(value.replace(/[^0-9.]/g, ""))
    if (Number.isFinite(n)) return Math.max(0, Math.min(100, n))
  }
  return null
}

function tierFromLlm(tier: string | undefined): DueDiligenceReport["investmentTier"] | null {
  if (!tier) return null
  const t = tier.toLowerCase()
  if (/tier\s*a|\ba\b|pass|strong/.test(t)) return "pass"
  if (/tier\s*b|\bb\b|review|moderate/.test(t)) return "review"
  if (/tier\s*c|\bc\b|fail|weak|decline/.test(t)) return "fail"
  return null
}

function levelToScore(level: string | undefined): number | null {
  if (!level) return null
  const l = level.toLowerCase()
  if (l.includes("high")) return 8.5
  if (l.includes("medium") || l.includes("moderate")) return 5.5
  if (l.includes("low")) return 2.5
  return null
}

function nonEmpty(...items: Array<string | undefined | null>): string[] {
  return items.map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean)
}

function finalizeReport(
  documentName: string,
  wordCount: number,
  dimensions: DueDiligenceDimension[],
  provenance: AnalysisProvenance,
  report: AnalysisReport,
  llm: EngineDueDiligenceReport | undefined,
): DueDiligenceReport {
  const integrityDim = dimensions.find((d) => d.id === 9)!
  const integrityGateTriggered = !integrityDim.unscored && integrityDim.score <= 1

  const scored = dimensions.filter((d) => !d.unscored)
  const scoredWeight = scored.reduce((sum, d) => sum + d.weight, 0)
  const weightedPct = scoredWeight > 0
    ? (scored.reduce((sum, d) => sum + (d.score / d.maxScore) * d.weight, 0) / scoredWeight) * 100
    : 0

  const llmOverall = isLlmDueDiligence(llm) ? parseOverallScore(llm.investment_recommendation?.overall_score) : null
  const llmTier = isLlmDueDiligence(llm) ? tierFromLlm(llm.investment_recommendation?.investment_tier) : null

  let totalScore: number
  let scoreSource: string
  if (integrityGateTriggered) {
    totalScore = 0
    scoreSource = "Integrity gate triggered — total forced to 0"
  } else if (llmOverall !== null) {
    totalScore = llmOverall
    scoreSource = `Overall score assigned by ${describeProvenance(provenance)} after reading the document`
  } else {
    totalScore = weightedPct
    scoreSource = `Weighted average of the ${scored.length} dimensions with a numeric basis (${scoredWeight}% of weights); ${dimensions.length - scored.length} dimensions have no numeric basis in rule-based mode`
  }

  let investmentTier: DueDiligenceReport["investmentTier"]
  if (integrityGateTriggered || totalScore < 40) {
    investmentTier = "fail"
  } else if (llmTier) {
    investmentTier = llmTier
  } else if (totalScore < 65 || provenance.analysisMode !== "llm") {
    // Without an LLM, team / market / methodology were never assessed — a
    // rule-based run can at best recommend further review, never "pass".
    investmentTier = "review"
  } else {
    investmentTier = "pass"
  }
  if (provenance.analysisMode !== "llm" && !integrityGateTriggered) {
    scoreSource += " · tier capped at “review” because no model assessed team, market or methodology"
  }

  const profile = report.document_profile
  const extraction = profile?.extraction_method ? `${profile.extraction_method}` : "document parser"
  const quality = typeof profile?.extraction_quality === "number" ? ` · extraction quality ${(profile.extraction_quality * 100).toFixed(0)}%` : ""

  return {
    documentName,
    wordCount,
    dimensions,
    totalScore: Math.round(totalScore * 10) / 10,
    maxTotalScore: 100,
    integrityGateTriggered,
    investmentTier,
    timestamp: Date.now(),
    analysisSource: "engine",
    layers: {
      layer1: `Text extraction via ${extraction}${quality} · IPC/CPC classification (${report.classification.classifier_model ?? "rule-based classifier"})`,
      layer2: provenance.analysisMode === "llm"
        ? `Live prior-art search (${report.originality.prior_art?.sources_queried?.filter((s) => s.status === "ok").length ?? 0} sources returned results) + LLM due diligence (${[provenance.llmProvider, provenance.llmModel].filter(Boolean).join(" / ")})`
        : "Live prior-art search + rule-based scoring — no LLM key configured on the backend, so no model read this document",
      integrityGate: "Dim9 ≤ 1 (text extraction failed) forces total score to 0",
    },
    provenance,
    scoreSource,
    llmReport: isLlmDueDiligence(llm) ? llm : undefined,
    originality: report.originality,
    documentProfile: profile,
  }
}

/** Derive the 9-dimension scorecard from a real matdao-ip-engine AnalysisReport. */
export function deriveDueDiligenceFromAnalysis(
  report: AnalysisReport,
  documentName: string,
): DueDiligenceReport {
  const profile = report.document_profile
  const stats = report.document_stats
  const provenance = provenanceFromReport(report)
  const llm = isLlmDueDiligence(report.due_diligence_report) ? report.due_diligence_report : undefined
  const llmLabel = llm ? `LLM (${[llm.llm_provider, llm.llm_model].filter(Boolean).join(" / ") || provenance.llmProvider || "configured provider"})` : null
  const assessment = report.originality.assessment

  const wordCount = profile?.word_count ?? Math.round(
    (stats.abstract_chars + stats.methodology_chars + stats.claims_chars) / 5,
  )
  const sections = profile?.sections_found ?? []
  const extractionQuality = typeof profile?.extraction_quality === "number"
    ? profile.extraction_quality
    : profile?.parsing_confidence ?? 0.5
  const hasSection = (name: string) => sections.some((s) => s.toLowerCase().includes(name))

  // ---- Dim 1: Evidence quality — numeric basis: parser output --------------
  const dim1: DueDiligenceDimension = {
    id: 1, name: "Evidence Quality", layer: "extraction", weight: 12, maxScore: 10,
    score: clampScore(extractionQuality * 7 + Math.min(3, sections.length * 0.6)),
    source: "document parser",
    evidence: [
      `Extraction quality ${(extractionQuality * 100).toFixed(0)}%${profile?.extraction_method ? ` via ${profile.extraction_method}` : ""}`,
      `${wordCount.toLocaleString()} words${profile?.page_count ? ` across ${profile.page_count} pages` : ""}`,
      `Sections detected: ${sections.length > 0 ? sections.join(", ") : "none"}`,
      ...(profile?.extraction_quality_reasons ?? []),
      ...nonEmpty(llm?.scientific_rigor?.data_analysis),
    ],
  }

  // ---- Dim 2: Methodological rigor — LLM qualitative, else section stats ----
  const dim2: DueDiligenceDimension = llm
    ? {
        id: 2, name: "Methodological Rigor", layer: "extraction", weight: 12, maxScore: 10, score: 0, unscored: true,
        source: llmLabel!,
        evidence: nonEmpty(
          llm.scientific_rigor?.methodology_quality,
          llm.scientific_rigor?.experimental_design,
          llm.scientific_rigor?.statistical_significance,
        ).length
          ? nonEmpty(llm.scientific_rigor?.methodology_quality, llm.scientific_rigor?.experimental_design, llm.scientific_rigor?.statistical_significance)
          : ["LLM returned no methodology assessment"],
      }
    : {
        id: 2, name: "Methodological Rigor", layer: "extraction", weight: 12, maxScore: 10,
        score: clampScore(Math.min(7, stats.methodology_chars / 400) + (hasSection("method") ? 3 : 0)),
        source: "document parser (section length only)",
        evidence: [
          `Methods text: ${stats.methodology_chars.toLocaleString()} chars`,
          hasSection("method") ? "Methods section detected" : "No methods section found",
          "Rule-based mode: length of the methods section is the only signal — not a quality judgement",
        ],
      }

  // ---- Dim 3: Reproducibility — LLM level, else unscored --------------------
  const reproLevel = levelToScore(llm?.scientific_rigor?.reproducibility_score)
  const dim3: DueDiligenceDimension = llm && reproLevel !== null
    ? {
        id: 3, name: "Reproducibility", layer: "extraction", weight: 10, maxScore: 10, score: reproLevel,
        source: llmLabel!,
        evidence: [
          `LLM reproducibility rating: ${llm.scientific_rigor?.reproducibility_score}`,
          ...nonEmpty(llm.innovation_assessment?.publication_quality),
        ],
      }
    : {
        id: 3, name: "Reproducibility", layer: "extraction", weight: 10, maxScore: 10, score: 0, unscored: true,
        source: llm ? llmLabel! : "none",
        evidence: [
          hasSection("result") ? "Results section detected" : "No results section detected",
          `Claims/outcomes text: ${stats.claims_chars.toLocaleString()} chars`,
          llm ? "LLM gave no reproducibility rating" : "No reproducibility judgement in rule-based mode",
        ],
      }

  // ---- Dim 4: Novelty — numeric basis: prior-art assessment ----------------
  const noveltyScore = typeof assessment?.novelty_score === "number" ? assessment.novelty_score : null
  const dim4: DueDiligenceDimension = {
    id: 4, name: "Novelty & Originality", layer: "enrichment", weight: 14, maxScore: 10,
    score: clampScore(
      noveltyScore !== null ? noveltyScore / 10 : (1 - report.originality.max_cosine_similarity) * 10,
    ),
    source: assessment?.analysis_source === "llm"
      ? `prior-art search + LLM verdict (${[assessment.llm_provider, assessment.llm_model].filter(Boolean).join(" / ")})`
      : "prior-art search (lexical/embedding similarity only)",
    evidence: [
      noveltyScore !== null
        ? `Novelty score ${noveltyScore}/100 · verdict: ${assessment?.verdict ?? "n/a"}`
        : `Max similarity to prior art ${(report.originality.max_cosine_similarity * 100).toFixed(1)}% (no LLM verdict)`,
      `${report.originality.prior_art?.live_patent_count ?? 0} live patent hits · ${report.originality.prior_art?.papers?.length ?? 0} papers · local corpus ${report.originality.patent_corpus_size ?? 0}`,
      ...(assessment?.key_differentiators?.slice(0, 3) ?? []),
      ...nonEmpty(llm?.innovation_assessment?.technical_novelty),
    ],
  }

  // ---- Dim 5: Publication status — parser signals only ----------------------
  const dim5: DueDiligenceDimension = {
    id: 5, name: "Publication Status", layer: "enrichment", weight: 10, maxScore: 10, score: 0, unscored: true,
    source: llm ? llmLabel! : "document parser",
    evidence: [
      profile?.document_type ? `Document type: ${profile.document_type.replace(/_/g, " ")}` : "Document type unknown",
      profile?.has_abstract ? "Abstract detected" : "No abstract detected",
      profile?.has_claims ? `${profile.claims_count ?? 0} patent-style claims detected` : "No patent claims detected",
      ...nonEmpty(llm?.innovation_assessment?.publication_quality),
      "Publication venue is not verified against external databases",
    ],
  }

  // ---- Dim 6: Team credibility — LLM qualitative, else parser names ---------
  const dim6: DueDiligenceDimension = {
    id: 6, name: "Team Credibility", layer: "enrichment", weight: 10, maxScore: 10, score: 0, unscored: true,
    source: llm ? llmLabel! : "document parser (names only)",
    evidence: [
      ...(profile?.authors?.length ? [`Authors found: ${profile.authors.slice(0, 5).join(", ")}`] : ["No author names extracted"]),
      ...(profile?.institutions?.length ? [`Institutions: ${profile.institutions.slice(0, 4).join(", ")}`] : []),
      ...nonEmpty(
        llm?.team_capability?.technical_expertise,
        llm?.team_capability?.research_track_record,
        llm?.team_capability?.collaboration_network,
      ),
      ...(llm ? [] : ["Team is not scored in rule-based mode"]),
    ],
  }

  // ---- Dim 7: Market viability — LLM qualitative, else none -----------------
  const dim7: DueDiligenceDimension = {
    id: 7, name: "Market Viability", layer: "enrichment", weight: 12, maxScore: 10, score: 0, unscored: true,
    source: llm ? llmLabel! : "none",
    evidence: llm
      ? nonEmpty(
          llm.market_fit?.problem_solving,
          llm.market_fit?.market_need,
          llm.market_fit?.competitive_advantage,
          llm.market_fit?.scalability_potential,
        )
      : [
          `Sector: ${report.classification.sector_name} (IPC ${report.classification.ipc_primary} · NACE ${report.classification.nace_code})`,
          "Market is not assessed in rule-based mode; the valuation model is under revision",
        ],
  }
  if (dim7.evidence.length === 0) dim7.evidence = ["LLM returned no market assessment"]

  // ---- Dim 8: FTO risk — numeric basis: FTO pipeline ------------------------
  const dim8: DueDiligenceDimension = {
    id: 8, name: "Regulatory & FTO Risk", layer: "enrichment", weight: 10, maxScore: 10,
    score: clampScore(10 - report.fto.r_fto * 20 - (report.fto.expert_consultation_required ? 3 : 0)),
    source: `FTO pipeline (${report.fto.analysis_source})`,
    evidence: [
      `FTO risk haircut −${(report.fto.r_fto * 100).toFixed(1)}% · risk tier ${report.fto.risk_tier_pct}%`,
      `${report.fto.flagged_patent_count} flagged patent${report.fto.flagged_patent_count === 1 ? "" : "s"}`,
      report.fto.expert_consultation_required ? "Attorney consultation recommended" : "No critical FTO flags",
      ...(llm?.risk_assessment?.regulatory_risks?.slice(0, 2) ?? []),
    ],
  }

  // ---- Dim 9: Integrity — parser quality + LLM unsupported claims -----------
  const unsupported = llm?.unsupported_claims?.filter((c) => typeof c === "string" && c.trim()) ?? []
  const integrityBase = extractionQuality < 0.2 ? 0 : extractionQuality < 0.35 ? 1 : 7 + extractionQuality * 3
  const dim9: DueDiligenceDimension = {
    id: 9, name: "Research Integrity", layer: "integrity", weight: 10, maxScore: 10,
    score: clampScore(integrityBase > 1 ? Math.max(2, integrityBase - unsupported.length * 0.75) : integrityBase),
    source: llm ? `document parser + ${llmLabel}` : "document parser",
    evidence: [
      extractionQuality < 0.35
        ? "Low extraction quality — text may be image-only or malformed"
        : "Text extracted cleanly; no format-level integrity flags",
      ...(llm
        ? unsupported.length
          ? [`${unsupported.length} claim${unsupported.length === 1 ? "" : "s"} lack supporting data:`, ...unsupported.slice(0, 5)]
          : ["LLM found no unsupported claims"]
        : ["Plagiarism/fabrication is not checked in rule-based mode"]),
    ],
  }

  const dimensions = [dim1, dim2, dim3, dim4, dim5, dim6, dim7, dim8, dim9]
  return finalizeReport(documentName, wordCount, dimensions, provenance, report, llm)
}

export async function analyzeDueDiligence(file: File): Promise<DueDiligenceReport> {
  try {
    const report = await analyzeDocument(file)
    return deriveDueDiligenceFromAnalysis(report, file.name)
  } catch (error) {
    throw new Error(
      `Due diligence requires the IP Engine; client-side keyword scoring is disabled. ${error instanceof Error ? error.message : ""}`,
    )
  }
}

export function getInvestmentTierLabel(tier: DueDiligenceReport["investmentTier"]): string {
  switch (tier) {
    case "pass": return "Investment Ready"
    case "review": return "Further Review Required"
    case "fail": return "Not Investment Ready"
  }
}

export { DIMENSION_DEFS }
