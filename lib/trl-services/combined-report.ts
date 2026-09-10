import { analyzeDocument, provenanceFromReport } from "../ai-studio/api"
import { deriveDueDiligenceFromAnalysis } from "../ai-studio/due-diligence"
import { deriveTrlFromAnalysis, trlReportToProject } from "../ai-studio/trl"
import type { AnalysisReport, DueDiligenceReport } from "../ai-studio/types"
import type { CombinedAssessmentReport } from "./types"

// In-memory cache so re-running the same submission in one session returns the
// same report. Keyed by a SHA-256 of the actual document bytes (not the title
// or a text prefix) so two different PDFs never collide.
const analysisCache = new Map<string, CombinedAssessmentReport>()

export interface AssessmentInput {
  title: string
  /** Pasted abstract / text. Used as the main document when no file is uploaded. */
  textContent: string
  category?: string
  author?: string
  file?: File | null
  proposalFile?: File | null
  pitchdeckFile?: File | null
  financialsFile?: File | null
  userTrl?: number // Optional user-provided TRL (1-9)
}

async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) {
    // Very old browsers / non-secure contexts: fall back to a length+sample key so we still never cache across files blindly.
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
    let h = 0
    for (let i = 0; i < bytes.length; i += Math.max(1, Math.floor(bytes.length / 4096))) {
      h = ((h << 5) - h + bytes[i]) | 0
    }
    return `nosubtle-${bytes.length}-${(h >>> 0).toString(16)}`
  }
  const buffer = data instanceof Uint8Array
    ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
    : data
  const digest = await subtle.digest("SHA-256", buffer as ArrayBuffer)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("")
}

async function fileDigest(file: File): Promise<string> {
  return sha256Hex(await file.arrayBuffer())
}

/** Cache key = SHA-256 of every uploaded file's bytes + normalized title/metadata. */
async function computeCacheKey(input: AssessmentInput, mainFile: File, supporting: File[]): Promise<string> {
  const digests = await Promise.all([mainFile, ...supporting].map(fileDigest))
  const meta = [
    input.title.trim().toLowerCase(),
    input.author?.trim().toLowerCase() ?? "",
    input.category?.trim().toLowerCase() ?? "",
    input.userTrl ?? "",
  ].join("|")
  return `${digests.join("+")}|${await sha256Hex(new TextEncoder().encode(meta))}`
}

/** Single IP Engine upload — returns TRL + IP valuation + due diligence together. */
export async function runCombinedAssessment(
  input: AssessmentInput,
): Promise<CombinedAssessmentReport> {
  const title = input.title.trim()
  const author = input.author?.trim() || "Independent Researcher"
  const category = input.category?.trim() || ""
  const textContent = input.textContent.trim()

  // Main document: the uploaded file, else the pasted text as a .txt.
  // If both exist, the pasted text goes along as a supporting file so the
  // engine still reads it — we never read PDF bytes as text on the client.
  const mainFile =
    input.file ??
    new File([textContent], `${title.slice(0, 40).replace(/[^\w.-]+/g, "_") || "submission"}.txt`, { type: "text/plain" })

  const supporting: File[] = []
  if (input.file && textContent) {
    supporting.push(new File([textContent], "pasted-abstract.txt", { type: "text/plain" }))
  }
  for (const extra of [input.proposalFile, input.pitchdeckFile, input.financialsFile]) {
    if (extra && extra.size > 0) supporting.push(extra)
  }

  const cacheKey = await computeCacheKey(input, mainFile, supporting)
  const cached = analysisCache.get(cacheKey)
  if (cached) return cached

  try {
    const ipReport: AnalysisReport = await analyzeDocument(mainFile, {
      title,
      author: input.author?.trim() || undefined,
      category: category || undefined,
      selfReportedTrl: input.userTrl ?? null,
      supportingFiles: supporting,
    })
    const trlReport = deriveTrlFromAnalysis(ipReport, title)
    const dueDiligenceReport = deriveDueDiligenceFromAnalysis(ipReport, title)
    const trlProject = trlReportToProject(trlReport, title, author)

    const result = buildCombinedReport(
      title,
      author,
      category || trlReport.sectorName,
      trlProject,
      ipReport,
      dueDiligenceReport,
    )

    analysisCache.set(cacheKey, result)
    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("Backend analysis failed:", errorMessage)

    // Never manufacture scores, patent matches, team assessments, or a dollar
    // valuation in the browser. A fallback made from keyword counts looks like
    // an assessment but has no evidentiary basis and is actively misleading.
    throw new Error(
      `The document could not be analyzed by the IP Engine. ${errorMessage || "Please retry after the service is available."}`,
    )
  }
}

function buildCombinedReport(
  title: string,
  author: string,
  category: string,
  trlProject: CombinedAssessmentReport["trlProject"],
  ipReport: AnalysisReport,
  dueDiligenceReport: DueDiligenceReport,
): CombinedAssessmentReport {
  const recommendedNextSteps: string[] = []

  const futureMilestones = Object.entries(trlProject.milestones)
    .filter(([, m]) => m.status === "current" || m.status === "future")
    .map(([key, m]) => `${key}: ${m.description} (${m.timeline})`)

  recommendedNextSteps.push(...futureMilestones.slice(0, 3))

  if (trlProject.potentialPartnership) {
    recommendedNextSteps.push(`Partnership: ${trlProject.potentialPartnership}`)
  }

  if (dueDiligenceReport.investmentTier === "fail") {
    recommendedNextSteps.unshift("Address due diligence integrity concerns before fundraising.")
  }

  if (ipReport.fto.expert_consultation_required) {
    recommendedNextSteps.push("Schedule FTO expert consultation — high patent overlap detected.")
  }

  const narrowing = ipReport.originality.assessment?.recommended_claim_narrowing ?? []
  if (narrowing.length > 0) {
    recommendedNextSteps.push(`Narrow claims: ${narrowing[0]}`)
  }

  const valuationAvailable = ipReport.valuation.valuation_available !== false

  return {
    id: `assessment-${Date.now()}`,
    title,
    author,
    category,
    createdAt: new Date().toISOString(),
    trlProject,
    ipReport,
    dueDiligenceReport,
    provenance: provenanceFromReport(ipReport),
    summary: {
      trl: trlProject.trl,
      ipScore: trlProject.score,
      valuationUsd: valuationAvailable ? ipReport.valuation.v_target_usd : null,
      dueDiligenceScore: dueDiligenceReport.totalScore,
      investmentTier: dueDiligenceReport.investmentTier,
      recommendedNextSteps,
    },
  }
}
