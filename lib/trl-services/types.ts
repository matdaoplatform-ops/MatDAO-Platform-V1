export interface Milestone {
  status: "completed" | "current" | "future"
  description: string
  timeline: string
  /** Concrete actions the engine (LLM) listed for this milestone — absent in rule-based mode. */
  specific_actions?: string[]
  resources_needed?: string[]
}

export interface ProjectMilestones {
  prototype: Milestone
  mvp: Milestone
  pilotTest: Milestone
  commercialization: Milestone
}

export interface TrlProject {
  id: string
  title: string
  author: string
  category: string
  abstract: string
  trl: number
  trlSummary: string
  accomplishments: string[]
  potentialPartnership: string
  milestones: ProjectMilestones
  score: number
  createdAt: string
  logo: "battery" | "carbon" | "ai" | "chitin" | "shield" | "turbine" | "composite"
  keyData?: Record<string, unknown>
  scoreReasoning?: Record<string, string>
  team_expertise_score?: number
  institution_reputation_score?: number
  team_assessment?: string
  /** Engine TRL fields mapped through from `trl_evaluation` (all optional; empty in rule-based mode). */
  paper_review?: import("../ai-studio/types").PaperReview
  key_indicators?: string[]
  missing_for_next_trl?: string[]
  evidence_quotes?: import("../ai-studio/types").EvidenceQuote[]
  estimated_trl?: number
  self_reported_trl?: number | null
  self_reported_delta?: number | null
  trl_confidence?: number
  /** e.g. "llm:deepseek:deepseek-chat" or "rule_based_fallback" */
  analysis_source?: string
}

export interface ResearcherProfile {
  id: string
  name: string
  title: string
  institution: string
  skills: string[]
  bio: string
  synergyNeeds: string
  type: "academic" | "entrepreneur" | "engineer" | "investor"
}

export interface VerificationTask {
  id: string
  title: string
  milestoneName: string
  projectId: string
  projectTitle: string
  proofText: string
  submittedBy: string
  submittedAt: string
  aiPassed: boolean
  aiPlagiarismScore: number
  aiConsistencyReport: string
  humanVoted: boolean
  humanPassed?: boolean
  humanNotes?: string
  status: "pending" | "verified" | "rejected" | "flagged"
}

export interface SubmittedMilestone {
  id: string
  projectId: string
  projectTitle: string
  milestoneKey: keyof ProjectMilestones
  milestoneLabel: string
  description: string
  timeline: string
  status: Milestone["status"]
  submittedAt: string
  submittedBy: string
  verificationId?: string
}

export interface CombinedAssessmentReport {
  id: string
  title: string
  author: string
  category: string
  createdAt: string
  trlProject: TrlProject
  ipReport?: import("../ai-studio/types").AnalysisReport
  dueDiligenceReport?: import("../ai-studio/types").DueDiligenceReport
  /** LLM vs rule-based + backend warnings, so results pages can show whether the AI ran. */
  provenance?: import("../ai-studio/types").AnalysisProvenance
  summary: {
    trl: number
    ipScore: number
    valuationUsd: number | null
    dueDiligenceScore: number | null
    investmentTier: string | null
    recommendedNextSteps: string[]
  }
}

export interface UserPlatformData {
  assessments: CombinedAssessmentReport[]
  submittedMilestones: SubmittedMilestone[]
  matchReports: Array<{ id: string; name: string; report: string; createdAt: string }>
}
