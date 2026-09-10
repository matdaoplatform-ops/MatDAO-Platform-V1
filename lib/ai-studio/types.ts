export interface AuditEntry {
  id: string
  parent_id?: string | null
  label: string
  amount_usd: number
  formula: string
  explanation: string
  calculation_steps: Array<{ step: number; operation: string; value: string | number }>
  evidence: Array<{ type: string; ref?: string; detail?: string }>
}

/** How the backend produced this report. `llm` = a model read the document; otherwise regex/keyword rules. */
export type AnalysisMode = "llm" | "rule_based_fallback"

/** Verbatim quote from the submitted document that supports a conclusion. */
export interface EvidenceQuote {
  quote: string
  location?: string
  supports?: string
}

export type MilestoneStatus = "completed" | "current" | "future"

export interface EngineMilestone {
  status: MilestoneStatus
  description: string
  timeline: string
  specific_actions?: string[]
  resources_needed?: string[]
}

export interface PaperReview {
  methodology_assessment?: string
  data_quality?: string
  reproducibility?: string
  potential_hallucinations?: string[]
  confidence_in_analysis?: string
}

export interface PriorArtHit {
  source: string
  id: string
  title: string
  abstract?: string
  url?: string
  date?: string
  assignee?: string
  kind?: "patent" | "paper" | string
  similarity?: number
  similarity_method?: string
  ipc?: string
}

export interface PriorArtSourceStatus {
  name: string
  status: "ok" | "empty" | "error" | "not_configured" | string
  count: number
  ms: number
  errors?: string[]
}

export interface PriorArtSearch {
  queries?: string[]
  patents?: PriorArtHit[]
  papers?: PriorArtHit[]
  search_links?: Record<string, string>
  sources_queried?: PriorArtSourceStatus[]
  live_patent_count?: number
}

export interface OverlappingPriorArt {
  id?: string
  title?: string
  url?: string
  overlap_reason?: string
  overlap_severity?: "low" | "medium" | "high" | string
}

export interface OriginalityAssessment {
  novelty_score?: number
  verdict?: "novel" | "incremental" | "likely-anticipated" | string
  key_differentiators?: string[]
  overlapping_prior_art?: OverlappingPriorArt[]
  recommended_claim_narrowing?: string[]
  confidence?: number
  evidence_quotes?: EvidenceQuote[]
  summary?: string
  analysis_source?: string
  llm_provider?: string | null
  llm_model?: string | null
  warnings?: string[]
}

export interface ConfidenceBlock {
  score: number
  level: "high" | "medium" | "low" | string
  factors: string[]
}

/** LLM due-diligence block returned by the backend (`due_diligence_report`). All optional: empty when no LLM key. */
export interface EngineDueDiligenceReport {
  analysis_source?: string
  llm_provider?: string | null
  llm_model?: string | null
  document_chars_analyzed?: number
  warnings?: string[]
  scientific_rigor?: {
    methodology_quality?: string
    experimental_design?: string
    data_analysis?: string
    statistical_significance?: string
    reproducibility_score?: string
  }
  innovation_assessment?: {
    technical_novelty?: string
    prior_art_analysis?: string
    patentability_potential?: string
    publication_quality?: string
  }
  team_capability?: {
    technical_expertise?: string
    research_track_record?: string
    collaboration_network?: string
    resource_availability?: string
  }
  market_fit?: {
    problem_solving?: string
    market_need?: string
    competitive_advantage?: string
    scalability_potential?: string
  }
  risk_assessment?: {
    technical_risks?: string[]
    execution_risks?: string[]
    market_risks?: string[]
    regulatory_risks?: string[]
  }
  investment_recommendation?: {
    overall_score?: number | string
    investment_tier?: string
    recommended_action?: string
    key_concerns?: string[]
    key_strengths?: string[]
  }
  next_steps?: {
    due_diligence_items?: string[]
    information_requests?: string[]
    expert_consultation_needed?: string[]
  }
  unsupported_claims?: string[]
  evidence_quotes?: EvidenceQuote[]
}

export interface DocumentProfile {
  title?: string
  document_type: string
  parsing_confidence: number
  sections_found: string[]
  sections?: Record<string, string>
  word_count: number
  page_count?: number
  has_abstract?: boolean
  has_claims?: boolean
  claims_count?: number
  authors?: string[]
  institutions?: string[]
  keywords?: string[]
  extraction_method?: string
  extraction_quality?: number
  extraction_quality_reasons?: string[]
  submitted_metadata?: {
    title?: string | null
    author?: string | null
    category?: string | null
    self_reported_trl?: number | null
    supporting_files?: string[]
  }
  supports_tokenization: boolean
  note: string
}

export interface AnalysisReport {
  analysis_mode?: AnalysisMode
  llm_provider?: string | null
  llm_model?: string | null
  warnings?: string[]
  document_profile?: DocumentProfile
  classification: {
    ipc_primary: string
    cpc_primary: string
    nace_code: string
    sector_name: string
    classification_confidence: number
    classifier_model?: string
    detected_keywords?: string[]
    field_classification?: {
      primary: string
      secondary: string
      tertiary: string
    }
  }
  originality: {
    max_cosine_similarity: number
    originality_premium_s: number
    embedding_model: string
    patent_corpus_size?: number
    similarity_method?: string
    confidence?: ConfidenceBlock
    top_patent_matches: Array<{
      patent_id: string
      title: string
      ipc: string
      cosine_similarity: number
      source?: string
      url?: string
      date?: string
      assignee?: string
    }>
    prior_art?: PriorArtSearch
    assessment?: OriginalityAssessment
  }
  fto: {
    r_fto: number
    risk_tier_pct: number
    high_risk_patent_group: string | null
    expert_consultation_required: boolean
    overlap_matrix: Array<{
      patent_id: string
      title: string
      cosine_similarity: number
      overlap_ratio: number
      flagged_elements: string[]
      structural_overlap: boolean
      source?: string
      url?: string
      missing_elements?: string[]
      evidence_quotes?: EvidenceQuote[]
      design_around?: string
    }>
    flagged_patent_count: number
    analysis_source: string
    confidence?: ConfidenceBlock
  }
  valuation: {
    valuation_available?: boolean
    valuation_status?: string
    valuation_message?: string
    v_baseline_usd: number
    s_originality: number
    r_fto: number
    v_target_usd: number
    valuation_floor_usd: number
    tokenization_anchor_usd: number
    royalty_rate_baseline: number
    sector_name: string
    formula: string
    hitl_reserved_pct: number
    automated_anchor_pct: number
    audit_trail?: AuditEntry[]
    confidence?: ConfidenceBlock
    additional_factors?: {
      market_size_multiplier: number
      trl_adjustment_factor: number
      team_quality_score: number
      competitive_advantage_score: number
      regulatory_risk_discount: number
      time_to_market_months: number
      patent_strength_score: number
      commercial_readiness_score: number
    }
    valuation_range_usd?: { low: number; high: number } | null
  }
  trl_evaluation?: {
    trl: number
    estimated_trl?: number
    trl_summary: string
    accomplishments: string[]
    potential_partnership: string
    innovation_score: number
    milestones: {
      prototype: EngineMilestone
      mvp: EngineMilestone
      pilot_test: EngineMilestone
      commercialization: EngineMilestone
    }
    sector_name: string
    analysis_source: string
    llm_provider?: string | null
    llm_model?: string | null
    confidence?: number
    key_indicators?: string[]
    evidence_quotes?: EvidenceQuote[]
    missing_for_next_trl?: string[]
    paper_review?: PaperReview
    self_reported_trl?: number | null
    self_reported_delta?: number | null
    team_expertise_score?: number
    institution_reputation_score?: number
    team_assessment?: string
    detailed_analysis?: string
  }
  due_diligence_report?: EngineDueDiligenceReport
  comprehensive_analysis?: Record<string, unknown>
  market_mapping?: Record<string, unknown>
  nlp_analysis?: Record<string, unknown>
  confidence_metrics?: {
    originality?: ConfidenceBlock
    fto?: ConfidenceBlock
    valuation?: ConfidenceBlock
    overall?: number
  }
  api_usage?: Record<string, unknown>
  document_stats: {
    abstract_chars: number
    methodology_chars: number
    claims_chars: number
    full_text_chars?: number
    llm_context_chars?: number
    supporting_context_chars?: number
  }
  report_metadata: {
    report_id: string
    timestamp_unix: number
    signature_sha256_hmac: string
    privacy_mode: string
  }
  value_chain_analysis?: {
    upstream: Array<{
      stage: string
      description: string
      key_suppliers: string[]
      risk_level: string
      cost_impact: string
    }>
    midstream: Array<{
      stage: string
      description: string
      key_suppliers: string[]
      risk_level: string
      cost_impact: string
    }>
    downstream: Array<{
      stage: string
      description: string
      key_suppliers: string[]
      risk_level: string
      cost_impact: string
    }>
    value_capture_opportunities: string[]
  }
}

/** Standalone /api/prior-art response. */
export interface PriorArtResponse {
  analysis_mode?: AnalysisMode
  llm_provider?: string | null
  llm_model?: string | null
  warnings?: string[]
  prior_art: PriorArtSearch
  assessment: OriginalityAssessment | null
}

/** GET /api/capabilities — booleans only, never key values. */
export interface BackendCapabilities {
  llm?: {
    available: boolean
    provider: string | null
    model: string | null
    configured_providers?: Record<string, boolean>
    context_budget_chars?: number
  }
  analysis_mode?: AnalysisMode
  embeddings?: {
    configured: boolean
    providers?: Record<string, boolean>
    fallback?: string
    index?: Record<string, unknown>
  }
  prior_art?: Record<string, boolean | string>
  multi_agent?: { enabled: boolean; providers?: Record<string, boolean> }
  supported_formats?: string[]
  cumulative_usage?: Record<string, unknown>
}

/** Provenance stamp carried by every derived report so results pages can say whether the AI actually ran. */
export interface AnalysisProvenance {
  analysisMode: AnalysisMode
  llmProvider?: string | null
  llmModel?: string | null
  warnings: string[]
}

export interface HitlModifiers {
  teamPedigree: number
  tradeSecrets: number
  partnerships: number
}

export interface TokenizationBreakdown {
  fullAdjustedValue: number
  tokenizationFractionPct: number
  listedTokenizationValue: number
  retainedOwnershipPct: number
  hitlAudit: AuditEntry[]
}

export interface DueDiligenceDimension {
  id: number
  name: string
  score: number
  maxScore: number
  weight: number
  evidence: string[]
  layer: "extraction" | "enrichment" | "integrity"
  /** True when no numeric basis exists for this dimension — it is shown as qualitative only and excluded from the total. */
  unscored?: boolean
  /** Where the number/evidence came from ("document parser", "prior-art search", "LLM (deepseek)"). */
  source?: string
}

export interface DueDiligenceReport {
  documentName: string
  wordCount: number
  dimensions: DueDiligenceDimension[]
  totalScore: number
  maxTotalScore: number
  integrityGateTriggered: boolean
  investmentTier: "pass" | "review" | "fail"
  timestamp: number
  analysisSource?: "engine" | "client"
  layers: {
    layer1: string
    layer2: string
    integrityGate: string
  }
  /** Provenance of the numbers (LLM vs rule-based) — optional for reports saved before this field existed. */
  provenance?: AnalysisProvenance
  /** Human-readable label of how the total score was produced. */
  scoreSource?: string
  /** Verbatim LLM due-diligence block from the backend, when a key was configured. */
  llmReport?: EngineDueDiligenceReport
  /** Originality / prior-art data so the DD results page can render the IP section. */
  originality?: AnalysisReport["originality"]
  documentProfile?: DocumentProfile
}
