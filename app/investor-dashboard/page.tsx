"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/context/auth-context"
import { RequireAuth } from "@/components/auth/require-auth"
import { ConnectWalletButton } from "@/components/ConnectWalletButton"
import {
  ArrowUpRight,
  ArrowDownRight,
  Bell,
  DollarSign,
  Wallet,
  Shield,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Vote,
  Clock,
  Award,
  Briefcase,
  TrendingUp,
  X,
  MousePointerClick,
} from "lucide-react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts"

// ---------------------------------------------------------------------------
// Mock portfolio data — figures pulled from the investor UI wireframe so the
// dashboard reads true to the original sketch (Project A example: $20k
// invested / $36k current / +80% ROI / 2 of 4 milestones).
// ---------------------------------------------------------------------------

interface Investment {
  id: string
  projectId: string
  title: string
  field: "Materials" | "Biotech" | "AI"
  university: string
  trl: number
  stage: string
  investedAmount: number
  currentValue: number
  fundingGoal: number
  fundingRaised: number
  milestones: { total: number; completed: number }
  scores: {
    technicalMaturity: number
    fundingProgress: number
    milestoneCompletion: number
    technicalRisk: number
    researchCredibility: number
    industryValidation: number
  }
  updates: { id: string; message: string; date: string }[]
  investedAt: string
}

const mockInvestments: Investment[] = [
  {
    id: "inv-1",
    projectId: "g-cap-500",
    title: "G-Cap 500: Ultra-Fast Charging Graphene Batteries",
    field: "Materials",
    university: "MIT",
    trl: 6,
    stage: "Scale-Up Phase",
    investedAmount: 20000,
    currentValue: 36000,
    fundingGoal: 250000,
    fundingRaised: 180000,
    milestones: { total: 4, completed: 2 },
    scores: {
      technicalMaturity: 80,
      fundingProgress: 60,
      milestoneCompletion: 70,
      technicalRisk: 30,
      researchCredibility: 75,
      industryValidation: 50,
    },
    updates: [
      { id: "u1", message: "Prototype validated at 500W fast-charge threshold.", date: "2 weeks ago" },
      { id: "u2", message: "Patent application filed for electrode composite.", date: "1 week ago" },
      { id: "u3", message: "Industry partner signed for pilot manufacturing run.", date: "2 days ago" },
    ],
    investedAt: "2026-03-14",
  },
  {
    id: "inv-2",
    projectId: "water-hyacinth-biochar",
    title: "Water Hyacinth Biochar for Carbon Sequestration",
    field: "Materials",
    university: "Chulalongkorn University",
    trl: 7,
    stage: "Field Validation",
    investedAmount: 15000,
    currentValue: 37500,
    fundingGoal: 300000,
    fundingRaised: 250000,
    milestones: { total: 4, completed: 3 },
    scores: {
      technicalMaturity: 88,
      fundingProgress: 83,
      milestoneCompletion: 75,
      technicalRisk: 20,
      researchCredibility: 82,
      industryValidation: 66,
    },
    updates: [
      { id: "u1", message: "Third-party lab confirmed carbon capture yield.", date: "9 days ago" },
      { id: "u2", message: "Milestone 3 proof of experiment submitted for review.", date: "3 days ago" },
    ],
    investedAt: "2026-02-02",
  },
  {
    id: "inv-3",
    projectId: "quantum-dots-solar",
    title: "Quantum Dot Enhanced Solar Cells",
    field: "Materials",
    university: "Stanford University",
    trl: 5,
    stage: "Prototype Testing",
    investedAmount: 10000,
    currentValue: 8600,
    fundingGoal: 200000,
    fundingRaised: 125000,
    milestones: { total: 4, completed: 2 },
    scores: {
      technicalMaturity: 62,
      fundingProgress: 55,
      milestoneCompletion: 50,
      technicalRisk: 58,
      researchCredibility: 60,
      industryValidation: 40,
    },
    updates: [
      { id: "u1", message: "Efficiency test delayed pending new equipment calibration.", date: "5 days ago" },
    ],
    investedAt: "2026-04-01",
  },
  {
    id: "inv-4",
    projectId: "cnt-power-cable",
    title: "CNT Power Cable for Grid Infrastructure",
    field: "Materials",
    university: "Georgia Tech",
    trl: 4,
    stage: "Lab Validation",
    investedAmount: 8000,
    currentValue: 10200,
    fundingGoal: 150000,
    fundingRaised: 95000,
    milestones: { total: 4, completed: 1 },
    scores: {
      technicalMaturity: 55,
      fundingProgress: 63,
      milestoneCompletion: 25,
      technicalRisk: 45,
      researchCredibility: 58,
      industryValidation: 35,
    },
    updates: [
      { id: "u1", message: "Conductivity benchmark published in peer-reviewed journal.", date: "1 month ago" },
    ],
    investedAt: "2026-01-20",
  },
]

// Overall portfolio score — matches the "Overall project score" panel in the wireframe
const overallScore = [
  { label: "Technical Maturity", short: "Technical", value: 80 },
  { label: "Funding Progress", short: "Funding", value: 60 },
  { label: "Milestone Completion", short: "Milestones", value: 70 },
  { label: "Technical Risk", short: "Risk", value: 30 },
  { label: "Research Credibility", short: "Credibility", value: 75 },
  { label: "Industry Validation", short: "Validation", value: 50 },
]

// Technical Risk is inverted for the radar (lower risk = larger, safer footprint)
// so every axis on the web reads "further out is better."
const overallScoreRadar = overallScore.map((m) => ({
  axis: m.short,
  fullLabel: m.label,
  raw: m.value,
  plotted: m.label === "Technical Risk" ? 100 - m.value : m.value,
}))

// Composite "portfolio health" index — average of the risk-adjusted axis values
const compositeScore = Math.round(
  overallScoreRadar.reduce((sum, m) => sum + m.plotted, 0) / overallScoreRadar.length
)

const overallScoreByAxis = Object.fromEntries(overallScoreRadar.map((m) => [m.axis, m.raw]))

const SCORE_AXES: { key: keyof Investment["scores"]; axis: string; fullLabel: string }[] = [
  { key: "technicalMaturity", axis: "Technical", fullLabel: "Technical Maturity" },
  { key: "fundingProgress", axis: "Funding", fullLabel: "Funding Progress" },
  { key: "milestoneCompletion", axis: "Milestones", fullLabel: "Milestone Completion" },
  { key: "technicalRisk", axis: "Risk", fullLabel: "Technical Risk" },
  { key: "researchCredibility", axis: "Credibility", fullLabel: "Research Credibility" },
  { key: "industryValidation", axis: "Validation", fullLabel: "Industry Validation" },
]

function buildRadarData(scores: Investment["scores"]) {
  return SCORE_AXES.map(({ key, axis, fullLabel }) => {
    const raw = scores[key]
    return { axis, fullLabel, raw, plotted: key === "technicalRisk" ? 100 - raw : raw }
  })
}

function compositeFromScores(scores: Investment["scores"]) {
  const data = buildRadarData(scores)
  return Math.round(data.reduce((sum, m) => sum + m.plotted, 0) / data.length)
}

// What each axis actually measures — shown as the "considered" checklist
// inside the explainer panel, independent of any one project's numbers.
const FACTORS_BY_AXIS: Record<string, string[]> = {
  Technical: ["Current TRL stage", "Prototype validation results", "Reproducibility across test runs"],
  Funding: ["Capital raised vs. funding goal", "Investor participation momentum", "Runway remaining at current burn"],
  Milestones: ["Milestones completed vs. planned", "Delivery cadence against timeline", "Verification status of completed work"],
  Risk: ["TRL-stage technical risk", "Dependency on unproven steps", "Time-to-completion uncertainty"],
  Credibility: ["Research team & institution track record", "Publications and prior grants", "Collaborator network"],
  Validation: ["Industry partner interest", "Pilot / licensing conversations", "Market pull signals"],
}

// The "why" behind one project's score on one axis — written from that
// project's own funding, milestone, and TRL data rather than generic filler.
function reasonForProject(axis: string, score: number, inv: Investment): string {
  const fundingPct = Math.round((inv.fundingRaised / inv.fundingGoal) * 100)
  const milestonePct = Math.round((inv.milestones.completed / inv.milestones.total) * 100)
  const latestUpdate = inv.updates[inv.updates.length - 1]?.message

  switch (axis) {
    case "Technical":
      return `TRL ${inv.trl} · ${inv.stage}. ${
        score >= 70
          ? "Prototype has been independently validated and results are reproducible."
          : score >= 45
          ? "Core mechanism is proven, but full-scale validation is still in progress."
          : "Still early-stage — validation evidence is limited so far."
      }`
    case "Funding":
      return `$${inv.fundingRaised.toLocaleString()} raised of $${inv.fundingGoal.toLocaleString()} goal (${fundingPct}%). ${
        fundingPct >= 70
          ? "Round is nearly closed."
          : fundingPct >= 40
          ? "Steady progress toward the funding goal."
          : "Early in the raise — most of the goal is still open."
      }`
    case "Milestones":
      return `${inv.milestones.completed} of ${inv.milestones.total} milestones completed (${milestonePct}%).${
        latestUpdate ? ` Most recent: "${latestUpdate}"` : ""
      }`
    case "Risk":
      return score <= 30
        ? "Low risk — the core technical uncertainty for this stage is largely resolved."
        : score <= 55
        ? "Moderate risk — some steps in the plan are still unproven."
        : "Elevated risk — key technical steps have not yet been validated."
    case "Credibility":
      return `Led by researchers at ${inv.university}. ${
        score >= 70
          ? "Strong publication and prior-funding track record."
          : score >= 45
          ? "Solid academic footing with a growing track record."
          : "Early-career team — track record is still developing."
      }`
    case "Validation":
      return score >= 70
        ? "Active industry partnerships and pilot commitments are already in place."
        : score >= 45
        ? "Early industry interest, but no signed commitments yet."
        : "Limited industry engagement so far."
    default:
      return ""
  }
}

// The "why" behind the portfolio-level average on one axis — compares every
// holding on that axis instead of describing a single project.
function reasonForPortfolio(axis: string): string {
  const rows = mockInvestments
    .map((inv) => {
      const d = buildRadarData(inv.scores).find((d) => d.axis === axis)
      return { name: inv.title.split(":")[0].trim(), value: d?.raw ?? 0, goodness: d?.plotted ?? 0 }
    })
    // Rank by "plotted" (risk-adjusted), not raw — for Risk a lower raw
    // number is the better outcome, so ranking on raw would call the
    // riskiest project "strongest."
    .sort((a, b) => b.goodness - a.goodness)
  const best = rows[0]
  const worst = rows[rows.length - 1]
  return `Averaged across your ${rows.length} holdings. Strongest at ${best.name} (${best.value}), weakest at ${worst.name} (${worst.value}).`
}

interface ExplainerState {
  axisFullLabel: string
  score: number
  factors: string[]
  reason: string
  color: string
}

// A full-screen "why this score" overlay, triggered by hovering a spoke on
// any radar chart. Centered and dominant on purpose — it's meant to be read,
// not squeezed into whatever inline space happens to be free next to a card.
function ScoreExplainerModal({ explainer, onClose }: { explainer: ExplainerState; onClose: () => void }) {
  const { axisFullLabel, score, factors, reason, color } = explainer
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border p-7 shadow-2xl animate-in zoom-in-95 fade-in duration-200"
        style={{ borderColor: `${color}55`, backgroundColor: "hsl(220 15% 8%)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color }}>
              Why this score
            </p>
            <h3
              className="mt-1 text-2xl font-bold text-foreground"
              style={{ fontFamily: "var(--font-jakarta)" }}
            >
              {axisFullLabel}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-6 flex items-center gap-5">
          <div
            className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full"
            style={{ background: `conic-gradient(${color} ${score * 3.6}deg, hsl(220 10% 16%) 0deg)` }}
          >
            <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-card">
              <span className="text-2xl font-bold tabular-nums text-foreground">{score}</span>
            </div>
          </div>
          <ul className="flex-1 space-y-2">
            {factors.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p
          className="rounded-xl border p-4 text-sm leading-relaxed text-foreground/90"
          style={{ borderColor: `${color}33`, backgroundColor: `${color}0f` }}
        >
          {reason}
        </p>
      </div>
    </div>
  )
}

// Recharts strips non-SVG props (like `payload`) before they reach a Radar's
// `label` renderer, so per-vertex value chips can't read the raw score that
// way. PolarAngleAxis's `tick` renderer doesn't have that problem — it always
// gets `payload.value` (the axis name) — so we look the raw score up from
// there instead and render name + value together at each spoke, and make the
// whole spoke clickable to open the "why this score" explainer.
function makeAxisTick(scoreByAxis: Record<string, number>, accentColor: string, onHover: (axis: string) => void) {
  return function AxisTick(props: any) {
    const { x, y, cx, cy, textAnchor, payload } = props
    const axisName = payload?.value as string
    const raw = scoreByAxis[axisName]
    if (raw === undefined) return <></>

    // The value number matches this chart's own line color — a blue web
    // gets blue numbers, a purple web gets purple numbers — so the label
    // reads as part of that specific chart, not a generic overlay.
    const dx = x - cx
    const dy = y - cy
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const nameY = y + (dy / len) * 2
    const valueY = nameY + (dy >= 0 ? 16 : -14)

    return (
      <g
        onMouseEnter={() => onHover(axisName)}
        onClick={() => onHover(axisName)}
        style={{ cursor: "pointer" }}
        role="button"
        aria-label={`Why did ${axisName} score ${raw}?`}
      >
        {/* Invisible, larger hit area so the spoke is easy to hover/tap */}
        <circle cx={x} cy={(nameY + valueY) / 2} r={22} fill="transparent" />
        <text x={x} y={nameY} textAnchor={textAnchor} fill="hsl(0 0% 75%)" fontSize={10.5} fontWeight={500} letterSpacing={0.3}>
          {axisName}
        </text>
        <text
          x={x}
          y={valueY}
          textAnchor={textAnchor}
          fill={accentColor}
          fontSize={14}
          fontWeight={700}
          style={{ filter: `drop-shadow(0 0 4px ${accentColor}73)` }}
        >
          {raw}
        </text>
      </g>
    )
  }
}

// Distinct accent per project so overlaid/adjacent radar charts read apart at
// a glance. The portfolio-level chart owns cyan/blue exclusively — none of
// these reuse it, so a project card never gets confused with the aggregate.
const PROJECT_ACCENTS = [
  { stroke: "#c084fc", fillFrom: "#c084fc", fillTo: "#7c3aed", solid: "#a855f7" }, // purple
  { stroke: "#fb923c", fillFrom: "#fb923c", fillTo: "#c2410c", solid: "#fb923c" }, // orange
  { stroke: "#34d399", fillFrom: "#34d399", fillTo: "#059669", solid: "#34d399" }, // emerald
  { stroke: "#f472b6", fillFrom: "#f472b6", fillTo: "#db2777", solid: "#f472b6" }, // pink
  { stroke: "#fbbf24", fillFrom: "#fbbf24", fillTo: "#b45309", solid: "#fbbf24" }, // amber
]

const PROJECT_ACCENT_BY_ID: Record<string, (typeof PROJECT_ACCENTS)[number]> = {}
mockInvestments.forEach((inv, idx) => {
  PROJECT_ACCENT_BY_ID[inv.id] = PROJECT_ACCENTS[idx % PROJECT_ACCENTS.length]
})

type Timeframe = "1D" | "1W" | "1M" | "ALL"

// Real portfolios don't move in a straight line — each series wobbles up and
// down along the way and only lands on the final value at the last point.
const performanceSeries: Record<Timeframe, { t: string; v: number }[]> = {
  "1D": [
    { t: "9AM", v: 188400 }, { t: "10:30", v: 190900 }, { t: "12PM", v: 188900 },
    { t: "1:30", v: 191700 }, { t: "3PM", v: 189800 }, { t: "4:30", v: 191300 }, { t: "5PM", v: 192224 },
  ],
  "1W": [
    { t: "Mon", v: 176300 }, { t: "Tue", v: 183100 }, { t: "Wed", v: 179400 },
    { t: "Thu", v: 186800 }, { t: "Fri", v: 183900 }, { t: "Sat", v: 189700 }, { t: "Sun", v: 192224 },
  ],
  "1M": [
    { t: "Wk1", v: 142000 }, { t: "Wk1.5", v: 156800 }, { t: "Wk2", v: 148300 },
    { t: "Wk2.5", v: 167900 }, { t: "Wk3", v: 159600 }, { t: "Wk3.5", v: 178400 }, { t: "Wk4", v: 192224 },
  ],
  ALL: [
    { t: "Jan", v: 53000 }, { t: "Feb", v: 81400 }, { t: "Mar", v: 64200 },
    { t: "Apr", v: 118600 }, { t: "May", v: 103900 }, { t: "Jun", v: 149800 }, { t: "Jul", v: 192224 },
  ],
}

function getRiskLevel(technicalRisk: number): "Low" | "Medium" | "High" {
  if (technicalRisk <= 30) return "Low"
  if (technicalRisk <= 55) return "Medium"
  return "High"
}

export default function InvestorDashboardPage() {
  return (
    <RequireAuth roles={["investor", "staff"]}>
      <InvestorDashboard />
    </RequireAuth>
  )
}

function InvestorDashboard() {
  const { user } = useAuth()
  const [timeframe, setTimeframe] = useState<Timeframe>("ALL")
  const [search, setSearch] = useState("")
  const [fieldFilter, setFieldFilter] = useState("All")
  const [riskFilter, setRiskFilter] = useState("All")
  const [stageFilter, setStageFilter] = useState("All")
  const [universityFilter, setUniversityFilter] = useState("All")
  const [expandedId, setExpandedId] = useState<string | null>(mockInvestments[0]?.id ?? null)
  const [notifOpen, setNotifOpen] = useState(false)
  const [explainer, setExplainer] = useState<ExplainerState | null>(null)

  const totalInvested = mockInvestments.reduce((s, i) => s + i.investedAmount, 0)
  const totalCurrentValue = mockInvestments.reduce((s, i) => s + i.currentValue, 0)
  const unrealizedPL = totalCurrentValue - totalInvested
  const unrealizedPLPercent = totalInvested > 0 ? (unrealizedPL / totalInvested) * 100 : 0

  const stages = useMemo(() => ["All", ...Array.from(new Set(mockInvestments.map((i) => i.stage)))], [])
  const universities = useMemo(() => ["All", ...Array.from(new Set(mockInvestments.map((i) => i.university)))], [])
  const fields = useMemo(() => ["All", ...Array.from(new Set(mockInvestments.map((i) => i.field)))], [])

  const filteredInvestments = mockInvestments.filter((inv) => {
    if (search && !inv.title.toLowerCase().includes(search.toLowerCase())) return false
    if (fieldFilter !== "All" && inv.field !== fieldFilter) return false
    if (stageFilter !== "All" && inv.stage !== stageFilter) return false
    if (universityFilter !== "All" && inv.university !== universityFilter) return false
    if (riskFilter !== "All" && getRiskLevel(inv.scores.technicalRisk) !== riskFilter) return false
    return true
  })

  const reputationScore = 87
  const reputationTier = totalInvested >= 50000 ? "Gold Investor" : totalInvested >= 20000 ? "Silver Investor" : "Bronze Investor"

  const notifications = mockInvestments.flatMap((inv) =>
    inv.updates.map((u) => ({ ...u, project: inv.title, projectId: inv.projectId }))
  ).slice(0, 6)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/60 bg-card/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Investor Dashboard</h1>
              <p className="mt-2 text-muted-foreground">
                Track your portfolio, monitor milestones, and stay ahead of funded research.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Reputation badge */}
              <div className="hidden items-center gap-2.5 rounded-xl border border-border/60 bg-secondary/40 px-3.5 py-2 sm:flex">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#6efcff]/30 to-[#6efcff]/10 text-xs font-bold text-[#c5fdff]">
                  {(user?.name ?? "Investor").charAt(0).toUpperCase()}
                </div>
                <div className="leading-tight">
                  <p className="text-xs font-semibold text-foreground">{user?.name ?? "Investor"}</p>
                  <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Award className="h-3 w-3 text-primary" /> {reputationTier} · {reputationScore} pts
                  </p>
                </div>
              </div>

              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setNotifOpen((v) => !v)}
                  aria-label="Notifications"
                  className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-secondary/40 text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
                >
                  <Bell className="h-4 w-4" />
                  {notifications.length > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {notifications.length}
                    </span>
                  )}
                </button>
                {notifOpen && (
                  <div className="absolute right-0 top-full z-20 mt-2 w-80 rounded-xl border border-border/60 bg-card/95 backdrop-blur-xl p-2 shadow-2xl shadow-black/20">
                    <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Updates from funded projects</p>
                    <div className="max-h-72 overflow-y-auto">
                      {notifications.map((n, idx) => (
                        <Link
                          key={`${n.id}-${idx}`}
                          href={`/project/${n.projectId}`}
                          onClick={() => setNotifOpen(false)}
                          className="block rounded-lg px-2 py-2 text-xs hover:bg-secondary/60"
                        >
                          <p className="font-medium text-foreground">{n.project}</p>
                          <p className="mt-0.5 text-muted-foreground">{n.message}</p>
                          <p className="mt-1 text-[10px] text-muted-foreground/70">{n.date}</p>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="hidden sm:block">
                <ConnectWalletButton />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* DAO voting reminder */}
        <div className="mb-6 flex flex-col items-start justify-between gap-4 rounded-xl border border-primary/30 bg-primary/10 p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/20">
              <Vote className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">DAO Voting — Milestone approval open</p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" /> 3 days left to cast your vote
              </p>
            </div>
          </div>
          <Link
            href="/project"
            className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Review &amp; Vote
          </Link>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border/60 bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-3">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Invested</p>
                <p className="text-2xl font-bold text-foreground">${totalInvested.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-3">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Portfolio Value</p>
                <p className="text-2xl font-bold text-foreground">${totalCurrentValue.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-6">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-3 ${unrealizedPL >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                {unrealizedPL >= 0 ? (
                  <ArrowUpRight className="h-5 w-5 text-emerald-400" />
                ) : (
                  <ArrowDownRight className="h-5 w-5 text-red-400" />
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Unrealized P/L</p>
                <p className={`text-2xl font-bold ${unrealizedPL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {unrealizedPL >= 0 ? "+" : ""}
                  {unrealizedPLPercent.toFixed(0)}%
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-3">
                <Briefcase className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Investments</p>
                <p className="text-2xl font-bold text-foreground">{mockInvestments.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Chart + Overall score */}
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Profit / Loss chart */}
          <div className="rounded-xl border border-border/60 bg-card p-6 lg:col-span-2">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Portfolio Value</p>
                <div className="flex items-center gap-2">
                  <p className="text-3xl font-bold text-foreground">
                    ${performanceSeries[timeframe][performanceSeries[timeframe].length - 1].v.toLocaleString()}
                  </p>
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                    <TrendingUp className="h-3 w-3" />
                    {unrealizedPLPercent.toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="flex gap-1 rounded-lg border border-border/60 bg-secondary/30 p-1">
                {(["1D", "1W", "1M", "ALL"] as Timeframe[]).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      timeframe === tf
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performanceSeries[timeframe]} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" stroke="hsl(220 5% 55%)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis hide domain={["dataMin - 5000", "dataMax + 5000"]} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(220 15% 8%)",
                      border: "1px solid hsl(220 10% 18%)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, "Value"]}
                  />
                  <Area type="monotone" dataKey="v" stroke="#3b82f6" strokeWidth={2} fill="url(#portfolioGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Overall project score */}
          <div className="rounded-xl border border-border/60 bg-gradient-to-b from-card to-card/60 p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <p
                    className="text-base font-semibold tracking-tight text-foreground"
                    style={{ fontFamily: "var(--font-jakarta)" }}
                  >
                    Overall Portfolio Score
                  </p>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Further out on every axis is better</p>
              </div>

              {/* Composite score dial */}
              <div
                className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: `conic-gradient(#3b82f6 ${compositeScore * 3.6}deg, hsl(220 10% 16%) 0deg)`,
                }}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-card">
                  <span
                    className="text-sm font-bold tabular-nums text-foreground"
                    style={{ fontFamily: "var(--font-jakarta)" }}
                  >
                    {compositeScore}
                  </span>
                </div>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={overallScoreRadar} outerRadius="55%" margin={{ top: 24, right: 32, bottom: 24, left: 32 }}>
                  <defs>
                    <radialGradient id="scoreFill" cx="50%" cy="50%" r="70%">
                      <stop offset="0%" stopColor="#6efcff" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.15} />
                    </radialGradient>
                    <filter id="scoreGlow" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="3.5" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <PolarGrid stroke="hsl(220 10% 24%)" radialLines />
                  <PolarAngleAxis
                    dataKey="axis"
                    tick={makeAxisTick(overallScoreByAxis, "#6efcff", (axis) =>
                      setExplainer({
                        axisFullLabel: SCORE_AXES.find((a) => a.axis === axis)?.fullLabel ?? axis,
                        score: overallScoreByAxis[axis],
                        factors: FACTORS_BY_AXIS[axis] ?? [],
                        reason: reasonForPortfolio(axis),
                        color: "#6efcff",
                      })
                    )}
                  />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} tickCount={5} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(220 15% 8%)",
                      border: "1px solid hsl(220 10% 18%)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(_value: number, _name: string, item: any) => [
                      item.payload.raw,
                      item.payload.fullLabel,
                    ]}
                  />
                  <Radar
                    name="Score"
                    dataKey="plotted"
                    stroke="#6efcff"
                    fill="url(#scoreFill)"
                    strokeWidth={2.5}
                    dot={false}
                    style={{ filter: "url(#scoreGlow)" }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <p className="mt-1 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
              <MousePointerClick className="h-3 w-3" />
              Hover a metric on the web to see why it scored that way
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your investments..."
              className="w-full rounded-lg border border-border bg-secondary/40 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterSelect label="Field" value={fieldFilter} onChange={setFieldFilter} options={fields} />
            <FilterSelect
              label="Risk"
              value={riskFilter}
              onChange={setRiskFilter}
              options={["All", "Low", "Medium", "High"]}
            />
            <FilterSelect label="Stage" value={stageFilter} onChange={setStageFilter} options={stages} />
            <FilterSelect label="University" value={universityFilter} onChange={setUniversityFilter} options={universities} />
          </div>
        </div>

        {/* My Investments */}
        <div className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">My Projects</h2>
            <Link href="/project" className="text-xs font-medium text-primary hover:text-primary/80">
              Explore more projects →
            </Link>
          </div>

          {filteredInvestments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 bg-card/50 p-10 text-center text-sm text-muted-foreground">
              No investments match these filters.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredInvestments.map((inv) => {
                const pl = inv.currentValue - inv.investedAmount
                const plPercent = inv.investedAmount > 0 ? (pl / inv.investedAmount) * 100 : 0
                const isExpanded = expandedId === inv.id
                const risk = getRiskLevel(inv.scores.technicalRisk)
                const accent = PROJECT_ACCENT_BY_ID[inv.id]

                return (
                  <div
                    key={inv.id}
                    className="rounded-xl border border-border/60 border-l-[3px] bg-card p-6 transition-all hover:shadow-lg"
                    style={{ borderLeftColor: accent.solid }}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex-1">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: accent.solid }} />
                          <h3 className="text-base font-semibold text-foreground">{inv.title}</h3>
                          <span className="rounded-full border border-border/60 bg-secondary/30 px-2.5 py-0.5 text-[11px] text-muted-foreground">
                            TRL {inv.trl} · {inv.stage}
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                              risk === "Low"
                                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                                : risk === "Medium"
                                ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
                                : "border-red-500/40 bg-red-500/10 text-red-400"
                            }`}
                          >
                            {risk} Risk
                          </span>
                        </div>

                        <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Invested</p>
                            <p className="text-sm font-semibold text-foreground">${inv.investedAmount.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Current Value</p>
                            <p className="text-sm font-semibold text-foreground">${inv.currentValue.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Unrealized P/L</p>
                            <p className={`text-sm font-semibold ${pl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {pl >= 0 ? "+" : "-"}${Math.abs(pl).toLocaleString()} ({pl >= 0 ? "+" : ""}
                              {plPercent.toFixed(0)}%)
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Milestones</p>
                            <p className="text-sm font-semibold text-foreground">
                              {inv.milestones.completed}/{inv.milestones.total} completed
                            </p>
                          </div>
                        </div>

                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Milestone progress</span>
                          <span className="font-medium text-foreground">
                            {Math.round((inv.milestones.completed / inv.milestones.total) * 100)}%
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-secondary/20">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${(inv.milestones.completed / inv.milestones.total) * 100}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col gap-2 lg:w-44">
                        <Link
                          href={`/project/${inv.projectId}`}
                          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                        >
                          <ExternalLink className="h-4 w-4" />
                          View Project
                        </Link>
                        <button
                          onClick={() => {
                            setExpandedId(isExpanded ? null : inv.id)
                            setExplainer(null)
                          }}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border/60 bg-secondary/20 px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/30"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          {isExpanded ? "Hide Details" : "Score & Updates"}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (() => {
                      const accent = PROJECT_ACCENT_BY_ID[inv.id]
                      const projectRadarData = buildRadarData(inv.scores)
                      const projectScoreByAxis = Object.fromEntries(projectRadarData.map((m) => [m.axis, m.raw]))
                      const projectComposite = compositeFromScores(inv.scores)

                      return (
                      <div className="mt-6 grid gap-6 border-t border-border/40 pt-6 md:grid-cols-2">
                        <div>
                          <div className="mb-1 flex items-center justify-between">
                            <p
                              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                              style={{ fontFamily: "var(--font-jakarta)" }}
                            >
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent.solid }} />
                              Project Score
                            </p>
                            <div
                              className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                              style={{
                                background: `conic-gradient(${accent.solid} ${projectComposite * 3.6}deg, hsl(220 10% 16%) 0deg)`,
                              }}
                            >
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-card">
                                <span className="text-[10px] font-bold tabular-nums text-foreground">
                                  {projectComposite}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="h-52 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <RadarChart
                                data={projectRadarData}
                                outerRadius="52%"
                                margin={{ top: 22, right: 24, bottom: 22, left: 24 }}
                              >
                                <defs>
                                  <radialGradient id={`scoreFill-${inv.id}`} cx="50%" cy="50%" r="70%">
                                    <stop offset="0%" stopColor={accent.fillFrom} stopOpacity={0.5} />
                                    <stop offset="100%" stopColor={accent.fillTo} stopOpacity={0.12} />
                                  </radialGradient>
                                </defs>
                                <PolarGrid stroke="hsl(220 10% 24%)" radialLines />
                                <PolarAngleAxis
                                  dataKey="axis"
                                  tick={makeAxisTick(projectScoreByAxis, accent.stroke, (axis) =>
                                    setExplainer({
                                      axisFullLabel: SCORE_AXES.find((a) => a.axis === axis)?.fullLabel ?? axis,
                                      score: projectScoreByAxis[axis],
                                      factors: FACTORS_BY_AXIS[axis] ?? [],
                                      reason: reasonForProject(axis, projectScoreByAxis[axis], inv),
                                      color: accent.stroke,
                                    })
                                  )}
                                />
                                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                                <Tooltip
                                  contentStyle={{
                                    background: "hsl(220 15% 8%)",
                                    border: "1px solid hsl(220 10% 18%)",
                                    borderRadius: 8,
                                    fontSize: 12,
                                  }}
                                  formatter={(_value: number, _name: string, item: any) => [
                                    item.payload.raw,
                                    item.payload.fullLabel,
                                  ]}
                                />
                                <Radar
                                  name="Score"
                                  dataKey="plotted"
                                  stroke={accent.stroke}
                                  fill={`url(#scoreFill-${inv.id})`}
                                  strokeWidth={2}
                                  dot={false}
                                />
                              </RadarChart>
                            </ResponsiveContainer>
                          </div>

                          <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
                            <MousePointerClick className="h-3 w-3" />
                            Hover a metric to see why it scored that way
                          </p>

                          <p className="mt-2 text-xs text-muted-foreground">
                            Funding: ${inv.fundingRaised.toLocaleString()} raised of ${inv.fundingGoal.toLocaleString()} goal
                          </p>
                        </div>

                        <div>
                          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Updates
                          </p>
                          <ol className="space-y-3">
                            {inv.updates.map((u, idx) => (
                              <li key={u.id} className="flex gap-3 text-sm">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
                                  {idx + 1}
                                </span>
                                <div>
                                  <p className="text-foreground">{u.message}</p>
                                  <p className="text-xs text-muted-foreground">{u.date}</p>
                                </div>
                              </li>
                            ))}
                          </ol>
                        </div>
                      </div>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {explainer && <ScoreExplainerModal explainer={explainer} onClose={() => setExplainer(null)} />}
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40"
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt === "All" ? `${label}: All` : opt}
        </option>
      ))}
    </select>
  )
}
