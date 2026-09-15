import { analyzeDocument, provenanceFromReport } from "./api"
import type { AnalysisProvenance, AnalysisReport, EngineMilestone, EvidenceQuote, PaperReview } from "./types"
import type { Milestone, ProjectMilestones, TrlProject } from "../trl-services/types"

export interface TrlReport {
  documentName: string
  trl: number
  trlSummary: string
  accomplishments: string[]
  potentialPartnership: string
  innovationScore: number
  milestones: ProjectMilestones
  sectorName: string
  analysisSource: "engine" | "client"
  timestamp: number
  // ---- engine detail (optional; empty in rule-based mode or on old saved reports) ----
  provenance?: AnalysisProvenance
  /** Raw engine label, e.g. "llm:deepseek:deepseek-chat" or "rule_based_fallback". */
  engineSource?: string
  confidence?: number
  estimatedTrl?: number
  selfReportedTrl?: number | null
  selfReportedDelta?: number | null
  keyIndicators?: string[]
  missingForNextTrl?: string[]
  evidenceQuotes?: EvidenceQuote[]
  paperReview?: PaperReview
  teamExpertiseScore?: number
  institutionReputationScore?: number
  teamAssessment?: string
}

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((v) => (typeof v === "string" ? v.trim() : "")).filter(Boolean)
}

function cleanQuotes(value: unknown): EvidenceQuote[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((q): q is EvidenceQuote => !!q && typeof q === "object" && typeof (q as EvidenceQuote).quote === "string")
    .map((q) => ({ quote: q.quote, location: q.location, supports: q.supports }))
}

function mapMilestone(raw: EngineMilestone | undefined, fallbackDescription: string): Milestone {
  const status: Milestone["status"] =
    raw?.status === "completed" || raw?.status === "current" || raw?.status === "future" ? raw.status : "future"
  const m: Milestone = {
    status,
    description: raw?.description || fallbackDescription,
    timeline: raw?.timeline || "TBD",
  }
  const actions = cleanList(raw?.specific_actions)
  const resources = cleanList(raw?.resources_needed)
  if (actions.length) m.specific_actions = actions
  if (resources.length) m.resources_needed = resources
  return m
}

/** Map engine milestones (snake_case, with optional LLM action lists) onto the platform shape. */
export function mapMilestonesFromEngine(
  raw: Partial<NonNullable<AnalysisReport["trl_evaluation"]>["milestones"]> | undefined,
): ProjectMilestones {
  return {
    prototype: mapMilestone(raw?.prototype, "Bench-scale prototype validation."),
    mvp: mapMilestone(raw?.mvp, "Integrated MVP for partner testing."),
    pilotTest: mapMilestone(raw?.pilot_test, "Operational pilot deployment."),
    commercialization: mapMilestone(raw?.commercialization, "Commercial scale-up and licensing."),
  }
}

/** Derive TRL report from matdao-ip-engine AnalysisReport (same pattern as due diligence). */
export function deriveTrlFromAnalysis(report: AnalysisReport, documentName: string): TrlReport {
  const trl = report.trl_evaluation
  if (!trl) {
    throw new Error("TRL evaluation missing from engine response")
  }

  // In rule-based mode the backend fills paper_review / specific_actions /
  // resources_needed with static placeholder templates. They are not
  // findings, so drop them rather than present them as engine output.
  const isLlm = typeof trl.analysis_source === "string" && trl.analysis_source.startsWith("llm")
  const paperReview = isLlm && trl.paper_review && typeof trl.paper_review === "object" ? trl.paper_review : undefined
  const milestones = mapMilestonesFromEngine(trl.milestones)
  if (!isLlm) {
    for (const m of Object.values(milestones)) {
      delete m.specific_actions
      delete m.resources_needed
    }
  }

  return {
    documentName,
    trl: trl.trl,
    trlSummary: trl.trl_summary,
    accomplishments: cleanList(trl.accomplishments),
    potentialPartnership: trl.potential_partnership,
    innovationScore: trl.innovation_score,
    milestones,
    sectorName: trl.sector_name,
    analysisSource: "engine",
    timestamp: Date.now(),
    provenance: provenanceFromReport(report),
    engineSource: trl.analysis_source,
    confidence: typeof trl.confidence === "number" ? trl.confidence : undefined,
    estimatedTrl: trl.estimated_trl ?? trl.trl,
    selfReportedTrl: trl.self_reported_trl ?? null,
    selfReportedDelta: trl.self_reported_delta ?? null,
    keyIndicators: cleanList(trl.key_indicators),
    missingForNextTrl: cleanList(trl.missing_for_next_trl),
    evidenceQuotes: cleanQuotes(trl.evidence_quotes),
    paperReview,
    teamExpertiseScore: trl.team_expertise_score,
    institutionReputationScore: trl.institution_reputation_score,
    teamAssessment: trl.team_assessment,
  }
}

export function trlReportToProject(report: TrlReport, title?: string, author?: string): TrlProject {
  const name = title || report.documentName.replace(/\.[^.]+$/, "")
  const project: TrlProject = {
    id: `proj-${Date.now()}`,
    title: name,
    author: author || "Independent Researcher",
    category: report.sectorName,
    abstract: report.trlSummary.slice(0, 250),
    trl: report.trl,
    trlSummary: report.trlSummary,
    accomplishments: report.accomplishments,
    potentialPartnership: report.potentialPartnership,
    milestones: report.milestones,
    score: report.innovationScore,
    createdAt: new Date().toISOString(),
    logo: "composite",
    analysis_source: report.engineSource,
    estimated_trl: report.estimatedTrl,
    self_reported_trl: report.selfReportedTrl,
    self_reported_delta: report.selfReportedDelta,
    trl_confidence: report.confidence,
  }
  if (report.keyIndicators?.length) project.key_indicators = report.keyIndicators
  if (report.missingForNextTrl?.length) project.missing_for_next_trl = report.missingForNextTrl
  if (report.evidenceQuotes?.length) project.evidence_quotes = report.evidenceQuotes
  if (report.paperReview) project.paper_review = report.paperReview
  if (typeof report.teamExpertiseScore === "number") project.team_expertise_score = report.teamExpertiseScore
  if (typeof report.institutionReputationScore === "number") project.institution_reputation_score = report.institutionReputationScore
  if (report.teamAssessment) project.team_assessment = report.teamAssessment
  return project
}

export async function analyzeTrl(file: File): Promise<TrlReport> {
  try {
    const report = await analyzeDocument(file)
    return deriveTrlFromAnalysis(report, file.name)
  } catch (error) {
    throw new Error(
      `TRL assessment requires the IP Engine; client-side keyword scoring is disabled. ${error instanceof Error ? error.message : ""}`,
    )
  }
}
