"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, Save, Target, Gem, Loader2, Download, Flame, ShieldCheck, AlertTriangle, Award, ChevronRight, Zap, Brain, Battery, Orbit, MessageSquare, X, FileText, Scale, Gavel, Search, BarChart3, Sparkles, CheckCircle2 } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { describeProvenance, formatUsd, provenanceFromReport } from "@/lib/ai-studio/api"
import { addAssessment, addSubmittedMilestone, MILESTONE_LABELS } from "@/lib/trl-services/storage"
import { uploadMetadataToIPFSDetailedAction } from "@/lib/ipfs/uploadMetadataToIPFSAction"
import { useMintIPNFT } from "@/lib/web3/hooks/useMintIPNFT"
import toast from "react-hot-toast"
import type { CombinedAssessmentReport, Milestone } from "@/lib/trl-services/types"
import { SpiderChart } from "@/components/ai-studio/SpiderChart"
import { AnalysisModeBanner } from "@/components/ai-studio/AnalysisModeBanner"
import { DocumentReadCard } from "@/components/ai-studio/DocumentReadCard"
import { DueDiligenceSection } from "@/components/ai-studio/DueDiligenceSection"
import { MilestoneGuidance } from "@/components/ai-studio/MilestoneGuidance"
import { EvidenceQuotes } from "@/components/ai-studio/EvidenceQuotes"
import { FtoOverlapTable } from "@/components/ai-studio/FtoOverlapTable"
import { PriorArtSection } from "@/components/ai-studio/PriorArtSection"
import { ValuationNotice, isValuationUnavailable } from "@/components/ai-studio/ValuationNotice"
import ClaimChartVisualizer from "@/components/ClaimChartVisualizer"
import { generateReportPDF } from "@/lib/pdf/generateReportPDF"
import { ChatAgent } from "./chat-agent"

export default function ProjectAssessmentResultsPage() {
  const router = useRouter()
  const { user, getAccessToken } = useAuth()
  const [report, setReport] = useState<CombinedAssessmentReport | null>(null)
  const [saved, setSaved] = useState(false)
  const [minting, setMinting] = useState(false)
  const [minted, setMinted] = useState(false)
  const [nftTokenId, setNftTokenId] = useState<string | null>(null)
  const [ipfsUri, setIpfsUri] = useState<string | null>(null)
  const [showChat, setShowChat] = useState(false)

  const { mintIPNFT, isPending: isMintingPending, isSuccess: isMintSuccess } = useMintIPNFT()

  useEffect(() => {
    const raw = sessionStorage.getItem("matdao-combined-report")
    if (!raw) {
      router.replace("/ai-studio/project-assessment/submit")
      return
    }
    setReport(JSON.parse(raw))
  }, [router])

  async function handleMintIPNFT() {
    if (!report || !user?.walletAddress) return

    setMinting(true)
    try {
      // Upload metadata to IPFS using server action (requires a signed-in session)
      const accessToken = await getAccessToken()
      if (!accessToken) throw new Error("Sign in again to mint — your session has expired.")
      const pin = await uploadMetadataToIPFSDetailedAction(
        {
          commercialViability: report.summary.ipScore,
          scientificIntegrity: report.summary.dueDiligenceScore || 85,
          ipNovelty: report.summary.ipScore,
          validationTier: report.summary.investmentTier === "pass" ? "Tier A" : report.summary.investmentTier === "review" ? "Tier B" : "Tier C"
        },
        {
          title: report.title,
          description: `MatDAO IP-NFT representing validated material science research: ${report.title}`,
          researchField: report.category
        },
        accessToken,
      )
      if (pin.mock) {
        throw new Error("IPFS pinning is not configured (PINATA_JWT missing) — refusing to mint an IP-NFT with a placeholder metadata URI.")
      }
      const metadataUri = pin.uri
      setIpfsUri(metadataUri)

      // Mint IP-NFT
      // contractAddress omitted → hook uses NEXT_PUBLIC_MATDAO_IPNFT_ADDRESS and throws a readable error if unset
      const { tokenId } = await mintIPNFT({
        researcher: user.walletAddress as `0x${string}`,
        tokenURI: metadataUri,
      })

      setMinted(true)
      setNftTokenId(tokenId !== null ? tokenId.toString() : null)
    } catch (error) {
      console.error("Error minting IP-NFT:", error)
      toast.error(error instanceof Error ? error.message : "Failed to mint IP-NFT. Check wallet, network and contract address.")
    } finally {
      setMinting(false)
    }
  }

  function downloadPDF() {
    if (!report) return
    generateReportPDF(report)
  }

  function saveToProfile() {
    if (!report || !user) return
    addAssessment(user.id, report)

    Object.entries(report.trlProject.milestones).forEach(([key, m]) => {
      if (m.status === "current" || m.status === "future") {
        addSubmittedMilestone(user.id, {
          id: `ms-${Date.now()}-${key}`,
          projectId: report.trlProject.id,
          projectTitle: report.title,
          milestoneKey: key as keyof typeof report.trlProject.milestones,
          milestoneLabel: MILESTONE_LABELS[key] || key,
          description: m.description,
          timeline: m.timeline,
          status: m.status,
          submittedAt: new Date().toISOString(),
          submittedBy: user.name,
        })
      }
    })

    setSaved(true)
  }

  if (!report) return null

  const provenance = report.provenance ?? (report.ipReport ? provenanceFromReport(report.ipReport) : null)
  const valuationUnavailable = isValuationUnavailable(report.ipReport?.valuation)
  const trlEval = report.ipReport?.trl_evaluation
  const ddLlm = report.dueDiligenceReport?.llmReport

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-black via-gray-950 to-black px-5 py-12 sm:px-6">
      <div className="relative z-10 mx-auto max-w-6xl">
        {/* Analysis mode: did an LLM actually read this, or did rule-based fallbacks run? */}
        <AnalysisModeBanner
          provenance={provenance}
          note={`Generated ${new Date(report.createdAt).toLocaleString()}`}
          className="mb-6"
        />

        {/* Proof the engine read the upload */}
        <DocumentReadCard
          profile={report.ipReport?.document_profile}
          stats={report.ipReport?.document_stats}
          className="mb-8"
        />

        <div className="mb-10 flex flex-wrap items-start justify-between gap-6">
          <div className="flex-1 min-w-[300px]">
            <p className="mb-3 text-[11px] uppercase tracking-widest text-[#c5fdff] font-semibold">Detailed Assessment Report</p>
            <h1 className="font-headline text-3xl font-bold text-white/95 md:text-4xl leading-tight">{report.title}</h1>
            <p className="mt-3 text-base text-white/50">
              {report.author} · {report.category}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={downloadPDF}
              className="inline-flex items-center gap-2 rounded-2xl border border-[#6efcff]/40 bg-gradient-to-r from-[#6efcff]/10 to-[#6efcff]/5 px-6 py-3 text-sm font-semibold text-[#c5fdff] hover:from-[#6efcff]/20 hover:to-[#6efcff]/10 transition-all duration-200 shadow-lg shadow-[#6efcff]/10"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
            {user ? (
              <button
                type="button"
                onClick={saveToProfile}
                disabled={saved}
                className="inline-flex items-center gap-2 rounded-2xl border border-[#6efcff]/40 bg-gradient-to-r from-[#6efcff]/10 to-[#6efcff]/5 px-6 py-3 text-sm font-semibold text-[#c5fdff] hover:from-[#6efcff]/20 hover:to-[#6efcff]/10 transition-all duration-200 shadow-lg shadow-[#6efcff]/10 disabled:opacity-60"
              >
                {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {saved ? "Saved to Profile" : "Save to Profile"}
              </button>
            ) : (
              <Link
                href="/auth/sign-in"
                className="rounded-2xl border border-white/20 px-6 py-3 text-sm text-white/70 hover:bg-white/5 transition-all duration-200"
              >
                Sign in to save
              </Link>
            )}
            {false && user?.walletAddress && !minted && (
              <button
                type="button"
                onClick={handleMintIPNFT}
                disabled={minting || isMintingPending}
                className="inline-flex items-center gap-2 rounded-2xl border border-[#6efcff]/40 bg-gradient-to-r from-[#6efcff]/10 to-[#6efcff]/5 px-6 py-3 text-sm font-semibold text-[#c5fdff] hover:from-[#6efcff]/20 hover:to-[#6efcff]/10 transition-all duration-200 shadow-lg shadow-[#6efcff]/10 disabled:opacity-60"
              >
                {minting || isMintingPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gem className="h-4 w-4" />}
                {minting || isMintingPending ? "Minting..." : "Mint IP-NFT"}
              </button>
            )}
            {minted && (
              <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 px-6 py-3 text-sm font-semibold text-emerald-400 shadow-lg shadow-emerald-500/10">
                <Award className="h-4 w-4" />
                IP-NFT Minted #{nftTokenId}
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Metrics Grid with Color Coding */}
        <div className="mb-10 grid grid-cols-2 gap-5 md:grid-cols-4">
          <EnhancedMetric 
            label="TRL Level" 
            value={`TRL ${report.summary.trl}`} 
            trl={report.summary.trl}
            icon={<Award className="w-5 h-5" />}
          />
          <EnhancedMetric 
            label="Innovation Score" 
            value={String(report.summary.ipScore)} 
            score={report.summary.ipScore}
            icon={<Flame className="w-5 h-5" />}
          />
          <EnhancedMetric
            label="IP Valuation"
            value={valuationUnavailable
              ? "Under revision"
              : report.ipReport?.valuation?.valuation_range_usd
                ? `${formatUsd(report.ipReport.valuation.valuation_range_usd.low)} - ${formatUsd(report.ipReport.valuation.valuation_range_usd.high)}`
                : report.summary.valuationUsd
                  ? formatUsd(report.summary.valuationUsd)
                  : "Not estimated"
            }
            icon={<Gem className="w-5 h-5" />}
          />
          <EnhancedMetric
            label="Due Diligence"
            value={
              report.summary.dueDiligenceScore !== null
                ? `${report.summary.dueDiligenceScore.toFixed(0)}%`
                : "N/A"
            }
            score={report.summary.dueDiligenceScore || 0}
            icon={<ShieldCheck className="w-5 h-5" />}
          />
        </div>

        <ValuationNotice valuation={report.ipReport?.valuation} className="mb-8" />

        {/* Comprehensive Analysis Section */}
        {(report.ipReport as any)?.comprehensive_analysis && (
          <section className="mb-8 border border-gray-200 bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Brain className="w-5 h-5 text-gray-700" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Comprehensive Analysis</h2>
            </div>
            <div className="space-y-6">
              {/* Executive Summary */}
              <div className="border border-gray-200 bg-gray-50 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Executive Summary</h3>
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                  {(report.ipReport as any).comprehensive_analysis.executive_summary}
                </div>
              </div>

              {/* Technical Analysis */}
              <div className="border border-gray-200 bg-gray-50 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Technical Analysis</h3>
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                  {(report.ipReport as any).comprehensive_analysis.technical_analysis}
                </div>
              </div>

              {/* Market Analysis */}
              <div className="border border-gray-200 bg-gray-50 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Market Analysis</h3>
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                  {(report.ipReport as any).comprehensive_analysis.market_analysis}
                </div>
              </div>

              {/* IP and Competitive Analysis */}
              <div className="border border-gray-200 bg-gray-50 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">IP & Competitive Analysis</h3>
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                  {(report.ipReport as any).comprehensive_analysis.ip_competitive_analysis}
                </div>
              </div>

              {/* Development Roadmap */}
              <div className="border border-gray-200 bg-gray-50 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Development Roadmap</h3>
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                  {(report.ipReport as any).comprehensive_analysis.development_roadmap}
                </div>
              </div>

              {/* Risk Assessment */}
              <div className="border border-gray-200 bg-gray-50 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Risk Assessment</h3>
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                  {(report.ipReport as any).comprehensive_analysis.risk_assessment}
                </div>
              </div>

              {/* Strategic Recommendations */}
              <div className="border border-blue-200 bg-blue-50 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Strategic Recommendations</h3>
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                  {(report.ipReport as any).comprehensive_analysis.strategic_recommendations}
                </div>
              </div>

              {/* Investment Thesis */}
              <div className="border border-gray-200 bg-gray-50 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Investment Thesis</h3>
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                  {(report.ipReport as any).comprehensive_analysis.investment_thesis}
                </div>
              </div>

              {/* Team Assessment */}
              {report.trlProject?.team_assessment && (
                <div className="border border-gray-200 bg-gray-50 rounded-lg p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Team Assessment</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="border border-gray-200 bg-white rounded p-3">
                      <p className="text-xs text-gray-500 mb-1">Team Expertise Score</p>
                      <p className="text-lg font-semibold text-gray-900">{((report.trlProject.team_expertise_score || 0.5) * 100).toFixed(0)}%</p>
                    </div>
                    <div className="border border-gray-200 bg-white rounded p-3">
                      <p className="text-xs text-gray-500 mb-1">Institution Reputation</p>
                      <p className="text-lg font-semibold text-gray-900">{((report.trlProject.institution_reputation_score || 0.5) * 100).toFixed(0)}%</p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                    {report.trlProject.team_assessment}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Market Mapping Section */}
        {(report.ipReport as any)?.market_mapping && (
          <section className="workflow-panel mb-8 rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-8 backdrop-blur-xl shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-[#6efcff]/30 to-[#6efcff]/10">
                <Orbit className="w-6 h-6 text-[#c5fdff]" />
              </div>
              <h2 className="font-headline text-xl font-bold text-white/95">Market Mapping Analysis</h2>
            </div>
            <div className="space-y-6">
              {/* Working Field */}
              <div className="rounded-2xl border border-white/10 bg-black/30 p-6 backdrop-blur-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs text-white/50 mb-2 uppercase tracking-wider">Working Field</p>
                    <p className="text-base font-semibold text-white/90">{(report.ipReport as any).market_mapping.working_field}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/50 mb-2 uppercase tracking-wider">Accuracy Score</p>
                    <p className="text-base font-semibold text-white/90">{(report.ipReport as any).market_mapping.overall_accuracy_score.toFixed(1)}%</p>
                  </div>
                </div>
              </div>

              {/* Market Opportunities */}
              <div className="rounded-2xl border border-white/10 bg-black/30 p-6 backdrop-blur-sm">
                <p className="text-sm font-semibold text-white/70 mb-4">Market Opportunities</p>
                <div className="space-y-4">
                  {(report.ipReport as any).market_mapping.market_opportunities?.slice(0, 4).map((opp: any, i: number) => (
                    <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-white/90 mb-1">{opp.market_name}</p>
                          <p className="text-xs text-white/50">{opp.market_size} · {opp.growth_rate}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-white/50 mb-1">Fit Score</p>
                          <p className="text-sm font-bold text-[#c5fdff]">{opp.fit_score.toFixed(0)}%</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs bg-white/10 px-2 py-1 rounded text-white/60">{opp.entry_difficulty} Entry</span>
                        <span className="text-xs bg-white/10 px-2 py-1 rounded text-white/60">{opp.key_competitors?.slice(0, 2).join(', ')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Strategic Recommendations */}
              {(report.ipReport as any).market_mapping.strategic_recommendations && (
                <div className="rounded-2xl border border-[#6efcff]/30 bg-gradient-to-br from-[#6efcff]/10 to-[#6efcff]/5 p-6 backdrop-blur-sm">
                  <p className="text-sm font-semibold text-[#c5fdff] mb-4">Strategic Recommendations</p>
                  <ul className="space-y-2">
                    {(report.ipReport as any).market_mapping.strategic_recommendations.slice(0, 4).map((rec: string, i: number) => (
                      <li key={i} className="text-sm text-white/70 flex items-start gap-3 leading-relaxed">
                        <span className="text-[#6efcff] mt-0.5">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Development Insights */}
              {(report.ipReport as any).market_mapping.development_insights && (
                <div className="rounded-2xl border border-white/10 bg-black/30 p-6 backdrop-blur-sm">
                  <p className="text-sm font-semibold text-white/70 mb-4">Development Insights</p>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-white/50 mb-2 uppercase tracking-wider">Current Stage</p>
                      <p className="text-sm text-white/70">{(report.ipReport as any).market_mapping.development_insights.current_stage_assessment}</p>
                    </div>
                    <div>
                      <p className="text-xs text-white/50 mb-2 uppercase tracking-wider">Funding Stage</p>
                      <p className="text-sm text-white/70">{(report.ipReport as any).market_mapping.development_insights.funding_recommendations.stage}</p>
                      <p className="text-xs text-white/50 mt-1">{(report.ipReport as any).market_mapping.development_insights.funding_recommendations.estimated_range}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Enhanced TRL Evaluation Section */}
        <section className="workflow-panel mb-8 rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-8 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-[#6efcff]/30 to-[#6efcff]/10">
              <Award className="w-6 h-6 text-[#c5fdff]" />
            </div>
            <h2 className="font-headline text-xl font-bold text-white/95">TRL Evaluation Details</h2>
            <span className={`ml-auto font-mono text-xs font-bold tracking-wider uppercase px-3 py-1.5 rounded-xl ${getTRLBadgeClass(report.trlProject.trl)}`}>
              TRL {report.trlProject.trl}
            </span>
          </div>
          <div className="space-y-5">
            {/* TRL Summary Card */}
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-black/20 to-black/40 p-6 backdrop-blur-sm">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${getTRLIconBg(report.trlProject.trl)} flex-shrink-0`}>
                  {getTRLIcon(report.trlProject.trl)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white/70 mb-3">Why TRL {report.trlProject.trl}?</p>
                  <p className="text-base text-white/60 leading-relaxed whitespace-pre-line">{report.trlProject.trlSummary}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-white/55">
                      Source: {report.trlProject.analysis_source ? report.trlProject.analysis_source.replace(/^llm:/, "LLM · ").replace(/_/g, " ") : describeProvenance(provenance)}
                    </span>
                    {typeof report.trlProject.trl_confidence === "number" && (
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-white/55">
                        Confidence {(report.trlProject.trl_confidence * 100).toFixed(0)}%
                      </span>
                    )}
                    {report.trlProject.self_reported_trl != null && (
                      <span className={`rounded-full border px-2.5 py-1 ${
                        Math.abs(report.trlProject.self_reported_delta ?? 0) >= 2
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
                          : "border-white/10 bg-white/5 text-white/55"
                      }`}>
                        Self-reported TRL {report.trlProject.self_reported_trl} · evidence-based TRL {report.trlProject.estimated_trl ?? report.trlProject.trl}
                        {report.trlProject.self_reported_delta ? ` (${report.trlProject.self_reported_delta > 0 ? "+" : ""}${report.trlProject.self_reported_delta})` : ""}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <EvidenceQuotes
              quotes={report.trlProject.evidence_quotes}
              title="Evidence the TRL rests on"
              emptyText={provenance?.analysisMode === "llm"
                ? "The model cited no verbatim quotes for this TRL."
                : "No evidence quotes — in rule-based mode the TRL comes from keyword matches, not from reading the document."}
            />
            
            {/* Key Accomplishments */}
            <div className="rounded-2xl border border-white/10 bg-black/30 p-6 backdrop-blur-sm">
              <p className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                Key Accomplishments
              </p>
              <ul className="space-y-3">
                {report.trlProject.accomplishments.map((a, i) => (
                  <li key={i} className="text-sm text-white/55 flex items-start gap-3 leading-relaxed">
                    <span className="text-emerald-400 mt-0.5">•</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            {/* Innovation Score with Reasoning */}
            <div className="rounded-2xl border border-white/10 bg-black/30 p-6 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-white/70 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-400" />
                  Innovation Score
                </p>
                <span className={`font-mono text-base font-bold ${getScoreColor(report.trlProject.score)}`}>
                  {report.trlProject.score}/100
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-3 mb-4">
                <div 
                  className={`h-3 rounded-full transition-all duration-500 ${getScoreBarColor(report.trlProject.score)}`} 
                  style={{ width: `${report.trlProject.score}%` }}
                />
              </div>
              <div className="rounded-xl bg-white/5 p-4">
                <p className="text-xs font-semibold text-[#6efcff] mb-2 uppercase tracking-wider">WHERE THIS SCORE COMES FROM</p>
                <p className="text-sm text-white/60 leading-relaxed">
                  {provenance?.analysisMode === "llm"
                    ? `Assigned by the LLM (${[provenance.llmProvider, provenance.llmModel].filter(Boolean).join(" / ")}) as part of the TRL assessment, on a 0–100 scale. ` +
                      (report.ipReport?.originality.assessment?.novelty_score != null
                        ? `Independently, the prior-art verdict scored novelty at ${report.ipReport.originality.assessment.novelty_score}/100 — see IP Originality & Prior Art below.`
                        : "See the evidence quotes and key indicators below for the model's reasoning.")
                    : "Rule-based mode: the score is a formula of the TRL level and the originality premium from text similarity. It is not a judgement of the science — configure an LLM key on the backend for a real assessment."}
                </p>
              </div>
            </div>

            {/* Paper Review (LLM) */}
            {report.trlProject.paper_review && (
              <div className="rounded-2xl border border-[#6efcff]/30 bg-[#6efcff]/5 p-5">
                <p className="text-sm font-semibold text-[#c5fdff] mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Paper Review &amp; Validation
                  {report.trlProject.paper_review.confidence_in_analysis && (
                    <span className="ml-auto rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-normal text-white/60">
                      confidence: {report.trlProject.paper_review.confidence_in_analysis}
                    </span>
                  )}
                </p>
                <div className="grid gap-3 md:grid-cols-3">
                  {([
                    ["Methodology", report.trlProject.paper_review.methodology_assessment],
                    ["Data quality", report.trlProject.paper_review.data_quality],
                    ["Reproducibility", report.trlProject.paper_review.reproducibility],
                  ] as Array<[string, string | undefined]>).map(([label, text]) => (
                    <div key={label} className="rounded-xl bg-black/30 p-3">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-white/50">{label}</p>
                      <p className="text-sm leading-relaxed text-white/70">{text || "—"}</p>
                    </div>
                  ))}
                </div>
                {(report.trlProject.paper_review.potential_hallucinations?.length ?? 0) > 0 && (
                  <div className="mt-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3">
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-yellow-300">
                      <AlertTriangle className="h-3.5 w-3.5" /> Claims flagged as unsupported or possibly hallucinated
                    </p>
                    <ul className="space-y-1">
                      {report.trlProject.paper_review.potential_hallucinations!.map((h, i) => (
                        <li key={i} className="text-xs text-yellow-100/80">· {h}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Key Indicators */}
            {(report.trlProject.key_indicators?.length ?? 0) > 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <p className="text-sm font-semibold text-white/70 mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  Key indicators found in the text
                </p>
                <ul className="space-y-2">
                  {report.trlProject.key_indicators!.map((indicator, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-white/60">
                      <span className="mt-0.5 text-yellow-400">•</span>
                      <span>{indicator}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Missing for Next TRL */}
            {(report.trlProject.missing_for_next_trl?.length ?? 0) > 0 && (
              <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5">
                <p className="text-sm font-semibold text-amber-100 mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4 text-amber-300" />
                  What is needed for TRL {Math.min(9, report.trlProject.trl + 1)}
                </p>
                <ul className="space-y-2">
                  {report.trlProject.missing_for_next_trl!.map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-white/65">
                      <span className="mt-0.5 text-amber-300">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

            {/* Enhanced Milestone Roadmap */}
        <section className="workflow-panel mb-8 rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-8 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-[#6efcff]/30 to-[#6efcff]/10">
              <Target className="w-6 h-6 text-[#c5fdff]" />
            </div>
            <h2 className="font-headline text-xl font-bold text-white/95">Milestone Roadmap</h2>
          </div>
          <div className="space-y-5">
            {/* Incomplete/Current Milestones with Recommendations */}
            {(Object.entries(report.trlProject.milestones) as Array<[string, Milestone]>)
              .filter(([, m]) => m.status === "current" || m.status === "future")
              .map(([key, m], index) => (
                <div key={key} className={`rounded-2xl border p-6 transition-all duration-200 ${
                  m.status === "current" 
                    ? "border-[#6efcff]/40 bg-gradient-to-br from-[#6efcff]/10 to-transparent shadow-xl shadow-[#6efcff]/15" 
                    : "border-white/10 bg-black/30 backdrop-blur-sm"
                }`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`p-3 rounded-xl ${m.status === "current" ? "bg-[#6efcff]/20" : "bg-white/10"} flex-shrink-0`}>
                        {m.status === "current" ? (
                          <Flame className="w-5 h-5 text-[#6efcff]" />
                        ) : (
                          <Target className="w-5 h-5 text-white/50" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-sm font-semibold uppercase text-white/90">
                            {MILESTONE_LABELS[key] || key}
                          </span>
                          <span className={`font-mono text-xs px-3 py-1 rounded-lg ${
                            m.status === "current" 
                              ? "bg-[#6efcff]/20 text-[#c5fdff]" 
                              : "bg-white/10 text-white/50"
                          }`}>
                            {m.status}
                          </span>
                        </div>
                        <p className="text-base text-white/70 leading-relaxed mb-3">{m.description}</p>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-white/50">Target: {m.timeline}</span>
                        </div>
                      </div>
                    </div>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-mono text-sm font-bold flex-shrink-0 ${
                      m.status === "current" ? "bg-[#6efcff] text-black shadow-lg shadow-[#6efcff]/20" : "bg-white/10 text-white/50"
                    }`}>
                      {index + 1}
                    </div>
                  </div>
                  
                  {/* What / Why / How — derived from the engine's own actions when present */}
                  <MilestoneGuidance
                    milestone={m}
                    isCurrent={m.status === "current"}
                    trl={report.trlProject.trl}
                    missingForNextTrl={m.status === "current" ? report.trlProject.missing_for_next_trl : undefined}
                  />

                  {(m.specific_actions?.length ?? 0) > 0 && (
                    <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
                      <p className="text-sm font-semibold text-white/70 mb-3">Specific actions (from the engine):</p>
                      <ul className="space-y-2">
                        {m.specific_actions!.map((action, i) => (
                          <li key={i} className="text-sm text-white/55 flex items-start gap-3 leading-relaxed">
                            <span className="text-[#6efcff]">•</span>
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {(m.resources_needed?.length ?? 0) > 0 && (
                    <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
                      <p className="text-sm font-semibold text-white/70 mb-3">Resources needed:</p>
                      <div className="flex flex-wrap gap-2">
                        {m.resources_needed!.map((resource, i) => (
                          <span key={i} className="text-xs bg-white/10 px-3 py-1.5 rounded-lg text-white/60">
                            {resource}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {m.status === "current" && (
                    <p className="mt-3 text-sm text-[#6efcff] font-medium">
                      💡 This is your current focus. Complete this milestone to advance to the next TRL level.
                    </p>
                  )}
                  {m.status === "future" && (
                    <p className="mt-3 text-sm text-white/50">
                      ⏳ This milestone will be unlocked after completing current milestones.
                    </p>
                  )}
                </div>
              ))}
            
            {/* Completed Milestones (collapsed) */}
            {Object.entries(report.trlProject.milestones).some(([, m]) => m.status === "completed") && (
              <details className="group">
                <summary className="cursor-pointer text-xs text-white/40 hover:text-white/60">
                  Show completed milestones ({Object.entries(report.trlProject.milestones).filter(([, m]) => m.status === "completed").length})
                </summary>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {Object.entries(report.trlProject.milestones)
                    .filter(([, m]) => m.status === "completed")
                    .map(([key, m]) => (
                      <div key={key} className="rounded-xl border border-white/10 bg-black/20 p-4 opacity-60">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase text-white/50">
                            {MILESTONE_LABELS[key] || key}
                          </span>
                          <span className="font-mono text-[10px] text-emerald-400">{m.status}</span>
                        </div>
                        <p className="mt-2 text-xs text-white/40">{m.description}</p>
                        <p className="mt-1 font-mono text-[10px] text-white/30">{m.timeline}</p>
                      </div>
                    ))}
                </div>
              </details>
            )}
          </div>
        </section>

        {/* Enhanced Recommended Next Steps */}
        <section className="workflow-panel mb-8 rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-8 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-[#6efcff]/30 to-[#6efcff]/10">
              <ChevronRight className="w-6 h-6 text-[#c5fdff]" />
            </div>
            <h2 className="font-headline text-xl font-bold text-white/95">Recommended Next Steps</h2>
          </div>
          <div className="space-y-4">
            {report.summary.recommendedNextSteps.map((step, index) => (
              <div key={step} className="flex items-start gap-4 rounded-2xl border border-white/10 bg-black/30 px-5 py-4 transition-all duration-200 hover:border-[#6efcff]/30 backdrop-blur-sm">
                <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-[#6efcff]/20 flex items-center justify-center">
                  <span className="text-sm font-bold text-[#c5fdff]">{index + 1}</span>
                </div>
                <p className="text-base text-white/65 flex-1 leading-relaxed">{step}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-2xl border border-[#6efcff]/30 bg-gradient-to-r from-[#6efcff]/10 to-[#6efcff]/5 p-4 backdrop-blur-sm">
            <p className="text-sm text-white/70 leading-relaxed">
              Submit milestone proofs via the{" "}
              <Link href="/ai-auditor" className="text-[#c5fdff] underline font-medium hover:text-[#6efcff]">
                AI Auditor
              </Link>{" "}
              — results will appear on your{" "}
              <Link href="/submit/milestone" className="text-[#c5fdff] underline font-medium hover:text-[#6efcff]">
                milestone page
              </Link>
              .
            </p>
          </div>
        </section>

        {/* IP Originality & Prior Art — live search + LLM verdict */}
        <PriorArtSection originality={report.ipReport?.originality} className="mb-8" />

        {/* USPTO Patent Search Results - New Section */}
        {(report.ipReport as any)?.uspto_patents && (report.ipReport as any).uspto_patents.length > 0 && (
          <section className="mb-8 border border-gray-200 bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Search className="w-5 h-5 text-gray-700" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">USPTO Patent Search Results</h2>
                <p className="text-sm text-gray-500">Source: USPTO Open Data Portal</p>
              </div>
            </div>
            <div className="space-y-4">
              {(report.ipReport as any).uspto_patents.slice(0, 5).map((patent: any, i: number) => (
                <div key={i} className="border border-gray-200 bg-gray-50 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-mono text-gray-600">{patent.patent_id}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${
                          patent.similarity_score > 0.7 ? 'bg-red-100 text-red-700 border-red-200' :
                          patent.similarity_score > 0.4 ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                          'bg-green-100 text-green-700 border-green-200'
                        }`}>
                          {(patent.similarity_score * 100).toFixed(0)}% Similarity
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 mb-1">{patent.title}</p>
                      <p className="text-xs text-gray-600 mb-2">{patent.abstract?.slice(0, 150)}...</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>Filing: {patent.filing_date}</span>
                        <span>•</span>
                        <span>Assignee: {patent.assignee || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                  {patent.ipc_codes && patent.ipc_codes.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {patent.ipc_codes.slice(0, 3).map((code: string, j: number) => (
                        <span key={j} className="text-xs bg-gray-200 px-2 py-1 rounded text-gray-700">{code}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Patent Claim Analysis - New Section */}
        {(report.ipReport as any)?.patent_claim_analysis && (
          <section className="mb-8 border border-gray-200 bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Gavel className="w-5 h-5 text-gray-700" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Patent Claim Analysis (35 USC § 102/103)</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Novelty Analysis */}
              <div className="border border-gray-200 bg-gray-50 rounded-lg p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-gray-700" />
                  <h3 className="text-sm font-semibold text-gray-900">Novelty Analysis (§ 102)</h3>
                </div>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">Novelty Score</span>
                    <span className={`text-lg font-bold ${
                      (report.ipReport as any).patent_claim_analysis.novelty_score >= 0.7 ? 'text-green-600' :
                      (report.ipReport as any).patent_claim_analysis.novelty_score >= 0.4 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {((report.ipReport as any).patent_claim_analysis.novelty_score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className={`h-2 rounded-full ${
                      (report.ipReport as any).patent_claim_analysis.novelty_score >= 0.7 ? 'bg-green-500' :
                      (report.ipReport as any).patent_claim_analysis.novelty_score >= 0.4 ? 'bg-yellow-500' : 'bg-red-500'
                    }`} style={{ width: `${(report.ipReport as any).patent_claim_analysis.novelty_score * 100}%` }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 mb-1">Novel Elements:</p>
                  <div className="flex flex-wrap gap-2">
                    {(report.ipReport as any).patent_claim_analysis.novel_elements.slice(0, 3).map((element: string, i: number) => (
                      <span key={i} className="text-xs bg-green-100 px-2 py-1 rounded text-green-700">{element.slice(0, 20)}...</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Non-Obviousness Analysis */}
              <div className="border border-gray-200 bg-gray-50 rounded-lg p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Scale className="w-5 h-5 text-gray-700" />
                  <h3 className="text-sm font-semibold text-gray-900">Non-Obviousness (§ 103)</h3>
                </div>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">Non-Obviousness Score</span>
                    <span className={`text-lg font-bold ${
                      (report.ipReport as any).patent_claim_analysis.non_obviousness_score >= 0.7 ? 'text-green-600' :
                      (report.ipReport as any).patent_claim_analysis.non_obviousness_score >= 0.4 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {((report.ipReport as any).patent_claim_analysis.non_obviousness_score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className={`h-2 rounded-full ${
                      (report.ipReport as any).patent_claim_analysis.non_obviousness_score >= 0.7 ? 'bg-green-500' :
                      (report.ipReport as any).patent_claim_analysis.non_obviousness_score >= 0.4 ? 'bg-yellow-500' : 'bg-red-500'
                    }`} style={{ width: `${(report.ipReport as any).patent_claim_analysis.non_obviousness_score * 100}%` }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 mb-1">Non-Obvious Features:</p>
                  <div className="flex flex-wrap gap-2">
                    {(report.ipReport as any).patent_claim_analysis.non_obvious_features.slice(0, 3).map((feature: string, i: number) => (
                      <span key={i} className="text-xs bg-green-100 px-2 py-1 rounded text-green-700">{feature.slice(0, 20)}...</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="border border-blue-200 bg-blue-50 rounded-lg p-5">
              <p className="text-sm font-semibold text-gray-900 mb-3">Overall Patentability</p>
              <p className="text-sm text-gray-700 leading-relaxed">{(report.ipReport as any).patent_claim_analysis.overall_patentability}</p>
              {(report.ipReport as any).patent_claim_analysis.recommendations && (report.ipReport as any).patent_claim_analysis.recommendations.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-gray-500 mb-2">Recommendations:</p>
                  <ul className="space-y-2">
                    {(report.ipReport as any).patent_claim_analysis.recommendations.slice(0, 3).map((rec: string, i: number) => (
                      <li key={i} className="text-xs text-gray-600 flex items-start gap-2">
                        <span className="text-blue-600">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Legal Citation Verification - New Section */}
        {(report.ipReport as any)?.legal_citation_verification && (
          <section className="mb-8 border border-gray-200 bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gray-100 rounded-lg">
                <FileText className="w-5 h-5 text-gray-700" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Legal Citation Verification</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="border border-gray-200 bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-2">Total Citations</p>
                <p className="text-2xl font-bold text-gray-900">{(report.ipReport as any).legal_citation_verification.total_citations}</p>
              </div>
              <div className="border border-green-200 bg-green-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-2">Verified</p>
                <p className="text-2xl font-bold text-green-600">{(report.ipReport as any).legal_citation_verification.verified_citations}</p>
              </div>
              <div className="border border-red-200 bg-red-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-2">Invalid</p>
                <p className="text-2xl font-bold text-red-600">{(report.ipReport as any).legal_citation_verification.invalid_citations}</p>
              </div>
              <div className="border border-gray-200 bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-2">Confidence</p>
                <p className="text-2xl font-bold text-gray-900">{((report.ipReport as any).legal_citation_verification.overall_confidence * 100).toFixed(0)}%</p>
              </div>
            </div>
            {(report.ipReport as any).legal_citation_verification.recommendations && (report.ipReport as any).legal_citation_verification.recommendations.length > 0 && (
              <div className="border border-blue-200 bg-blue-50 rounded-lg p-5">
                <p className="text-sm font-semibold text-gray-900 mb-3">Verification Recommendations</p>
                <ul className="space-y-2">
                  {(report.ipReport as any).legal_citation_verification.recommendations.map((rec: string, i: number) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start gap-3">
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* Claim Chart Visualizer - New Section */}
        {(report.ipReport as any)?.claim_chart_data && (
          <section className="mb-8 border border-gray-200 bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gray-100 rounded-lg">
                <BarChart3 className="w-5 h-5 text-gray-700" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Claim Chart Analysis</h2>
            </div>
            <ClaimChartVisualizer
              patentClaims={(report.ipReport as any).claim_chart_data.patent_claims || []}
              priorArtClaims={(report.ipReport as any).claim_chart_data.prior_art_claims || []}
            />
          </section>
        )}

        {/* Enhanced IP & FTO Analysis */}
        {report.ipReport && (
          <section className="mb-8 border border-gray-200 bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gray-100 rounded-lg">
                <ShieldCheck className="w-5 h-5 text-gray-700" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">IP & FTO Analysis</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="border border-gray-200 bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">Sector</p>
                <p className="text-sm font-medium text-gray-900">{report.ipReport.classification.sector_name}</p>
              </div>
              <div className="border border-gray-200 bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">FTO Risk Score</p>
                <p className={`text-sm font-medium ${getFTORiskColor(report.ipReport.fto.r_fto)}`}>{(report.ipReport.fto.r_fto * 100).toFixed(2)}%</p>
              </div>
              <div className="border border-gray-200 bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">Target Valuation</p>
                {valuationUnavailable ? (
                  <p className="text-sm font-medium text-amber-600">Under revision</p>
                ) : (
                  <p className="text-sm font-medium text-green-600">{formatUsd(report.ipReport.valuation.v_target_usd)}</p>
                )}
              </div>
            </div>

            {/* FTO overlap matrix with sources, missing elements, design-around */}
            <div className="border border-gray-200 bg-gray-900 rounded-lg p-4 mb-4">
              <p className="text-xs font-semibold text-white/80 mb-3">
                Patent overlap matrix · {report.ipReport.fto.flagged_patent_count} flagged · risk tier {report.ipReport.fto.risk_tier_pct}% · {report.ipReport.fto.analysis_source.replace(/_/g, " ")}
                {report.ipReport.fto.expert_consultation_required && <span className="ml-2 text-amber-300">attorney consultation recommended</span>}
              </p>
              <FtoOverlapTable rows={report.ipReport.fto.overlap_matrix} limit={6} />
            </div>

            {/* Enhanced Classification & Keywords */}
            {(report.ipReport.classification as any).detected_keywords && (
              <div className="border border-gray-200 bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-xs font-semibold text-gray-900 mb-3">Automatic Classification & Keywords</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Detected Keywords:</p>
                    <div className="flex flex-wrap gap-2">
                      {(report.ipReport.classification as any).detected_keywords.map((keyword: string, i: number) => (
                        <span key={i} className="text-xs bg-gray-200 px-2 py-1 rounded text-gray-700">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Field Classification:</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Primary:</span>
                        <span className="text-xs text-gray-900">{(report.ipReport.classification as any).field_classification?.primary}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Secondary:</span>
                        <span className="text-xs text-gray-900">{(report.ipReport.classification as any).field_classification?.secondary}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Tertiary:</span>
                        <span className="text-xs text-gray-900">{(report.ipReport.classification as any).field_classification?.tertiary}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Enhanced Valuation Factors Breakdown */}
            {(report.ipReport.valuation as any).additional_factors && (
              <div className="border border-gray-200 bg-gray-50 rounded-lg p-4 mt-4">
                <p className="text-xs font-semibold text-gray-900 mb-3">Enhanced Valuation Factors</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="border border-gray-200 bg-white rounded p-3">
                    <p className="text-xs text-gray-500 mb-1">Market Size Multiplier</p>
                    <p className="text-sm font-medium text-gray-900">{((report.ipReport.valuation as any).additional_factors.market_size_multiplier).toFixed(2)}x</p>
                  </div>
                  <div className="border border-gray-200 bg-white rounded p-3">
                    <p className="text-xs text-gray-500 mb-1">TRL Adjustment</p>
                    <p className="text-sm font-medium text-gray-900">{((report.ipReport.valuation as any).additional_factors.trl_adjustment_factor).toFixed(2)}x</p>
                  </div>
                  <div className="border border-gray-200 bg-white rounded p-3">
                    <p className="text-xs text-gray-500 mb-1">Team Quality</p>
                    <p className="text-sm font-medium text-gray-900">{((report.ipReport.valuation as any).additional_factors.team_quality_score).toFixed(2)}</p>
                  </div>
                  <div className="border border-gray-200 bg-white rounded p-3">
                    <p className="text-xs text-gray-500 mb-1">Competitive Advantage</p>
                    <p className="text-sm font-medium text-gray-900">{((report.ipReport.valuation as any).additional_factors.competitive_advantage_score).toFixed(2)}</p>
                  </div>
                  <div className="border border-gray-200 bg-white rounded p-3">
                    <p className="text-xs text-gray-500 mb-1">Regulatory Risk</p>
                    <p className="text-sm font-medium text-gray-900">{((report.ipReport.valuation as any).additional_factors.regulatory_risk_discount * 100).toFixed(1)}%</p>
                  </div>
                  <div className="border border-gray-200 bg-white rounded p-3">
                    <p className="text-xs text-gray-500 mb-1">Time to Market</p>
                    <p className="text-sm font-medium text-gray-900">{(report.ipReport.valuation as any).additional_factors.time_to_market_months} months</p>
                  </div>
                  <div className="border border-gray-200 bg-white rounded p-3">
                    <p className="text-xs text-gray-500 mb-1">Patent Strength</p>
                    <p className="text-sm font-medium text-gray-900">{((report.ipReport.valuation as any).additional_factors.patent_strength_score).toFixed(2)}</p>
                  </div>
                  <div className="border border-gray-200 bg-white rounded p-3">
                    <p className="text-xs text-gray-500 mb-1">Commercial Readiness</p>
                    <p className="text-sm font-medium text-gray-900">{((report.ipReport.valuation as any).additional_factors.commercial_readiness_score).toFixed(2)}</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Enhanced Formula:</p>
                  <p className="text-xs text-blue-600 font-mono">{report.ipReport.valuation.formula}</p>
                </div>
              </div>
            )}
            
            {valuationUnavailable ? (
              <div className="mt-4 border border-amber-200 bg-amber-50 rounded-lg p-4">
                <p className="text-xs font-semibold text-gray-900 mb-1">Valuation Calculation Breakdown</p>
                <p className="text-xs text-gray-700">
                  Valuation model under revision — the engine returned no USD figures for this report
                  {report.ipReport.valuation.valuation_message ? `: ${report.ipReport.valuation.valuation_message}` : "."}
                </p>
              </div>
            ) : (
              <div className="mt-4 border border-gray-200 bg-gray-50 rounded-lg p-4">
                <p className="text-xs font-semibold text-gray-900 mb-2">Valuation Calculation Breakdown</p>
                <div className="space-y-2 text-xs text-gray-700">
                  <div className="flex justify-between">
                    <span>Baseline Value (V_baseline)</span>
                    <span>{formatUsd(report.ipReport.valuation.v_baseline_usd)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Originality Score (S_originality)</span>
                    <span>{report.ipReport.valuation.s_originality.toFixed(2)}x</span>
                  </div>
                  <div className="flex justify-between">
                    <span>FTO Adjustment (1 - R_fto)</span>
                    <span>{(1 - report.ipReport.valuation.r_fto).toFixed(2)}x</span>
                  </div>
                  <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between font-semibold text-gray-900">
                    <span>Target Valuation (V_target)</span>
                    <span>{formatUsd(report.ipReport.valuation.v_target_usd)}</span>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Formula: V_target = V_baseline × S_originality × (1 - R_fto)
                  </p>
                </div>
              </div>
            )}
              <div className="border border-gray-200 bg-gray-50 rounded-lg p-4">
                <p className="text-xs font-semibold text-gray-900 mb-2">Classification Details</p>
                <div className="space-y-2 text-xs text-gray-700">
                  <div className="flex justify-between">
                    <span>IPC Primary</span>
                    <span>{report.ipReport.classification.ipc_primary}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CPC Primary</span>
                    <span>{report.ipReport.classification.cpc_primary}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>NACE Code</span>
                    <span>{report.ipReport.classification.nace_code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Classification Confidence</span>
                    <span>{(report.ipReport.classification.classification_confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
              
              {/* DeepSeek-enhanced valuation insights */}
              {(report.ipReport.valuation as any).deepseek_enhancement && (
                <>
                  <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
                    <p className="text-xs font-semibold text-gray-900 mb-2">Market Opportunity</p>
                    <div className="space-y-2 text-xs text-gray-700">
                      <div className="flex justify-between">
                        <span>Total Addressable Market</span>
                        <span>{(report.ipReport.valuation as any).deepseek_enhancement.market_opportunity.total_addressable_market}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Serviceable Addressable Market</span>
                        <span>{(report.ipReport.valuation as any).deepseek_enhancement.market_opportunity.serviceable_addressable_market}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Market Growth Rate</span>
                        <span>{(report.ipReport.valuation as any).deepseek_enhancement.market_opportunity.market_growth_rate}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border border-gray-200 bg-gray-50 rounded-lg p-4">
                    <p className="text-xs font-semibold text-gray-900 mb-2">Commercialization Path</p>
                    <div className="space-y-2 text-xs text-gray-700">
                      <div className="flex justify-between">
                        <span>Time to Market</span>
                        <span>{(report.ipReport.valuation as any).deepseek_enhancement.commercialization_path.time_to_market}</span>
                      </div>
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 mb-1">Key Partnerships:</p>
                        <div className="flex flex-wrap gap-1">
                          {(report.ipReport.valuation as any).deepseek_enhancement.commercialization_path.key_partnerships.map((p: string, i: number) => (
                            <span key={i} className="text-xs bg-gray-200 px-2 py-0.5 rounded text-gray-700">{p}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border border-gray-200 bg-gray-50 rounded-lg p-4">
                    <p className="text-xs font-semibold text-gray-900 mb-2">Risk Factors</p>
                    <div className="space-y-2">
                      {(report.ipReport.valuation as any).deepseek_enhancement.risk_factors.technical_risks.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Technical Risks:</p>
                          <ul className="space-y-1">
                            {(report.ipReport.valuation as any).deepseek_enhancement.risk_factors.technical_risks.map((r: string, i: number) => (
                              <li key={i} className="text-xs text-gray-600">• {r}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {(report.ipReport.valuation as any).deepseek_enhancement.risk_factors.market_risks.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Market Risks:</p>
                          <ul className="space-y-1">
                            {(report.ipReport.valuation as any).deepseek_enhancement.risk_factors.market_risks.map((r: string, i: number) => (
                              <li key={i} className="text-xs text-gray-600">• {r}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="border border-gray-200 bg-gray-50 rounded-lg p-4">
                    <p className="text-xs font-semibold text-gray-900 mb-2">Recommendations</p>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Immediate Actions:</p>
                        <ul className="space-y-1">
                          {(report.ipReport.valuation as any).deepseek_enhancement.recommendations.immediate_actions.map((a: string, i: number) => (
                            <li key={i} className="text-xs text-gray-600">• {a}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </>
              )}
          </section>
        )}

        {/* Value Chain Analysis */}
        {(report.ipReport as any).value_chain_analysis && (
          <section className="mb-8 border border-gray-200 bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Orbit className="w-5 h-5 text-gray-700" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Value Chain Analysis</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {/* Upstream */}
              <div className="border border-gray-200 bg-gray-50 rounded-lg p-4">
                <p className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Upstream
                </p>
                <div className="space-y-3">
                  {(report.ipReport as any).value_chain_analysis.upstream.map((stage: any, i: number) => (
                    <div key={i} className="border border-gray-200 bg-white rounded p-3">
                      <p className="text-xs font-medium text-gray-900 mb-1">{stage.stage}</p>
                      <p className="text-xs text-gray-600 mb-2">{stage.description}</p>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-500">Risk:</span>
                        <span className={`text-xs ${stage.risk_level === 'high' ? 'text-red-600' : stage.risk_level === 'medium' ? 'text-yellow-600' : 'text-green-600'}`}>{stage.risk_level}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Cost Impact:</span>
                        <span className={`text-xs ${stage.cost_impact === 'high' ? 'text-red-600' : 'text-green-600'}`}>{stage.cost_impact}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Midstream */}
              <div className="border border-gray-200 bg-gray-50 rounded-lg p-4">
                <p className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  Midstream
                </p>
                <div className="space-y-3">
                  {(report.ipReport as any).value_chain_analysis.midstream.map((stage: any, i: number) => (
                    <div key={i} className="border border-gray-200 bg-white rounded p-3">
                      <p className="text-xs font-medium text-gray-900 mb-1">{stage.stage}</p>
                      <p className="text-xs text-gray-600 mb-2">{stage.description}</p>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-500">Risk:</span>
                        <span className={`text-xs ${stage.risk_level === 'high' ? 'text-red-600' : stage.risk_level === 'medium' ? 'text-yellow-600' : 'text-green-600'}`}>{stage.risk_level}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Cost Impact:</span>
                        <span className={`text-xs ${stage.cost_impact === 'high' ? 'text-red-600' : 'text-green-600'}`}>{stage.cost_impact}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Downstream */}
              <div className="border border-gray-200 bg-gray-50 rounded-lg p-4">
                <p className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  Downstream
                </p>
                <div className="space-y-3">
                  {(report.ipReport as any).value_chain_analysis.downstream.map((stage: any, i: number) => (
                    <div key={i} className="border border-gray-200 bg-white rounded p-3">
                      <p className="text-xs font-medium text-gray-900 mb-1">{stage.stage}</p>
                      <p className="text-xs text-gray-600 mb-2">{stage.description}</p>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-500">Risk:</span>
                        <span className={`text-xs ${stage.risk_level === 'high' ? 'text-red-600' : stage.risk_level === 'medium' ? 'text-yellow-600' : 'text-green-600'}`}>{stage.risk_level}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Cost Impact:</span>
                        <span className={`text-xs ${stage.cost_impact === 'high' ? 'text-red-600' : 'text-green-600'}`}>{stage.cost_impact}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Value Capture Opportunities */}
            <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
              <p className="text-xs font-semibold text-gray-900 mb-3">Value Capture Opportunities</p>
              <ul className="space-y-2">
                {(report.ipReport as any).value_chain_analysis.value_capture_opportunities.map((opportunity: string, i: number) => (
                  <li key={i} className="text-xs text-gray-700 flex items-start gap-2">
                    <span className="text-blue-600">•</span>
                    <span>{opportunity}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* Due Diligence */}
        {report.dueDiligenceReport && (
          <DueDiligenceSection dd={report.dueDiligenceReport} />
        )}

        <section className="mb-8 border border-gray-200 bg-white rounded-lg p-6 shadow-sm">
          <h2 className="mb-6 text-lg font-semibold text-gray-900">Comprehensive Analysis Document</h2>
          <div className="space-y-6 text-sm text-gray-700">
            {ipfsUri && (
              <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
                <h3 className="mb-2 font-semibold text-gray-900">IP-NFT Metadata</h3>
                <p className="text-xs text-gray-600 break-all">IPFS URI: {ipfsUri}</p>
                {minted && (
                  <p className="mt-2 text-xs text-green-600">✓ Successfully minted as IP-NFT #{nftTokenId}</p>
                )}
              </div>
            )}
            <div>
              <h3 className="mb-2 font-semibold text-gray-900">Project Overview</h3>
              <p className="mb-2"><strong>Title:</strong> {report.title}</p>
              <p className="mb-2"><strong>Author:</strong> {report.author}</p>
              <p><strong>Category:</strong> {report.category}</p>
            </div>

            <div>
              <h3 className="mb-2 font-semibold text-gray-900">TRL Evaluation Analysis</h3>
              <p className="mb-2"><strong>TRL Level:</strong> {report.summary.trl}</p>
              <p className="mb-2"><strong>TRL Summary:</strong> {report.trlProject.trlSummary}</p>
              <p className="mb-2"><strong>Key Accomplishments:</strong></p>
              <ul className="ml-4 space-y-1">
                {report.trlProject.accomplishments.map((a: string, i: number) => (
                  <li key={i}>• {a}</li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="mb-2 font-semibold text-gray-900">Milestone Roadmap</h3>
              <div className="space-y-2">
                {Object.entries(report.trlProject.milestones).map(([key, m]: [string, any]) => (
                  <div key={key} className="border border-gray-200 bg-gray-50 rounded-lg p-3">
                    <p className="font-medium text-gray-900">{MILESTONE_LABELS[key] || key}</p>
                    <p className="text-xs text-gray-600">{m.description}</p>
                    <p className="text-xs text-gray-500 mt-1">Timeline: {m.timeline}</p>
                    <p className="text-xs text-blue-600 mt-1">Status: {m.status}</p>
                  </div>
                ))}
              </div>
            </div>

            {report.ipReport && (
              <div>
                <h3 className="mb-2 font-semibold text-gray-900">IP Valuation & FTO Analysis</h3>
                <p className="mb-2"><strong>Sector:</strong> {report.ipReport.classification.sector_name}</p>
                <p className="mb-2"><strong>FTO Risk Score:</strong> {(report.ipReport.fto.r_fto * 100).toFixed(2)}%</p>
                <p className="mb-2"><strong>Target Valuation:</strong> {valuationUnavailable ? "Valuation model under revision" : formatUsd(report.ipReport.valuation.v_target_usd)}</p>
                {report.ipReport.originality.assessment?.novelty_score != null && (
                  <p className="mb-2"><strong>Novelty (prior art):</strong> {report.ipReport.originality.assessment.novelty_score}/100 · {report.ipReport.originality.assessment.verdict}</p>
                )}
                <p className="mb-2"><strong>Classification:</strong> {report.ipReport.classification.ipc_primary}</p>
              </div>
            )}

            {report.dueDiligenceReport && (
              <div>
                <h3 className="mb-2 font-semibold text-gray-900">Scientific Due Diligence Analysis</h3>
                <p className="mb-2"><strong>Total Due Diligence Score:</strong> {report.dueDiligenceReport.totalScore.toFixed(2)}%</p>
                <p className="mb-2"><strong>Investment Tier:</strong> <span className="uppercase text-blue-600">{report.dueDiligenceReport.investmentTier}</span></p>
                <p className="mb-2"><strong>Integrity Gate Status:</strong> {report.dueDiligenceReport.integrityGateTriggered ? "Triggered" : "Not Triggered"}</p>
              </div>
            )}

            <div>
              <h3 className="mb-2 font-semibold text-gray-900">Summary Metrics</h3>
              <p className="mb-2"><strong>Innovation Score:</strong> {report.summary.ipScore}</p>
              <p className="mb-2"><strong>IP Valuation:</strong> {valuationUnavailable ? "Under revision" : report.summary.valuationUsd ? formatUsd(report.summary.valuationUsd) : "N/A"}</p>
              <p className="mb-2"><strong>Analysis mode:</strong> {describeProvenance(provenance)}</p>
              <p><strong>Due Diligence Score:</strong> {report.summary.dueDiligenceScore !== null ? `${report.summary.dueDiligenceScore.toFixed(2)}%` : "N/A"}</p>
            </div>

            <div>
              <h3 className="mb-2 font-semibold text-gray-900">Recommended Actions</h3>
              <ul className="ml-4 space-y-1">
                {report.summary.recommendedNextSteps.map((step: string, i: number) => (
                  <li key={i}>• {step}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>

      {/* AI Chat Agent Panel */}
      {showChat && report && (
        <div className="fixed right-4 top-4 bottom-4 w-96 z-50">
          <ChatAgent report={report} />
        </div>
      )}

      {/* Chat Toggle Button */}
      <button
        onClick={() => setShowChat(!showChat)}
        className={`fixed right-4 bottom-4 z-50 p-4 rounded-full shadow-lg transition-all ${
          showChat ? 'bg-gray-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {showChat ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
      </button>
    </div>
  )
}

function EnhancedMetric({ label, value, trl, score, icon }: { label: string; value: string; trl?: number; score?: number; icon: React.ReactNode }) {
  const getMetricColor = () => {
    if (trl !== undefined) {
      if (trl >= 8) return "border-green-200 bg-green-50"
      if (trl >= 6) return "border-teal-200 bg-teal-50"
      if (trl >= 4) return "border-amber-200 bg-amber-50"
      return "border-indigo-200 bg-indigo-50"
    }
    if (score !== undefined) {
      if (score >= 80) return "border-green-200 bg-green-50"
      if (score >= 60) return "border-teal-200 bg-teal-50"
      if (score >= 40) return "border-amber-200 bg-amber-50"
      return "border-red-200 bg-red-50"
    }
    return "border-gray-200 bg-gray-50"
  }

  const getMetricTextColor = () => {
    if (trl !== undefined) {
      if (trl >= 8) return "text-green-600"
      if (trl >= 6) return "text-teal-600"
      if (trl >= 4) return "text-amber-600"
      return "text-indigo-600"
    }
    if (score !== undefined) {
      if (score >= 80) return "text-green-600"
      if (score >= 60) return "text-teal-600"
      if (score >= 40) return "text-amber-600"
      return "text-red-600"
    }
    return "text-gray-900"
  }

  return (
    <div className={`border rounded-lg px-4 py-4 transition-all duration-200 hover:scale-105 ${getMetricColor()}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-white">{icon}</div>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
      <p className={`text-lg font-semibold ${getMetricTextColor()} mt-1`}>{value}</p>
    </div>
  )
}

function getTRLBadgeClass(trl: number): string {
  if (trl >= 8) return "bg-green-100 text-green-700 border border-green-200"
  if (trl >= 6) return "bg-teal-100 text-teal-700 border border-teal-200"
  if (trl >= 4) return "bg-amber-100 text-amber-700 border border-amber-200"
  return "bg-indigo-100 text-indigo-700 border border-indigo-200"
}

function getTRLIcon(trl: number): React.ReactNode {
  if (trl >= 8) return <Award className="w-4 h-4 text-green-600" />
  if (trl >= 6) return <Zap className="w-4 h-4 text-teal-600" />
  if (trl >= 4) return <Battery className="w-4 h-4 text-amber-600" />
  return <Brain className="w-4 h-4 text-indigo-600" />
}

function getTRLIconBg(trl: number): string {
  if (trl >= 8) return "bg-green-100"
  if (trl >= 6) return "bg-teal-100"
  if (trl >= 4) return "bg-amber-100"
  return "bg-indigo-100"
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-600"
  if (score >= 60) return "text-teal-600"
  if (score >= 40) return "text-amber-600"
  return "text-red-600"
}

function getScoreBarColor(score: number): string {
  if (score >= 80) return "bg-green-500"
  if (score >= 60) return "bg-teal-500"
  if (score >= 40) return "bg-amber-500"
  return "bg-red-500"
}

function getFTORiskColor(risk: number): string {
  if (risk >= 0.7) return "text-red-600"
  if (risk >= 0.4) return "text-amber-600"
  return "text-green-600"
}

