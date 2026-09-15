import { notFound } from "next/navigation"
import { createAnonServerClient } from "@/lib/supabase/server"
import type { KeyValue, ApprovedProjectRow } from "@/lib/supabase/client"
import { ProjectDataRoom } from "@/components/project/ProjectDataRoom"
import { LegalRegistryPanel } from "@/components/project/LegalRegistryPanel"
import { FundingPanel } from "@/components/project/FundingPanel"
import { ProjectDetailClient } from "@/components/project/project-detail-client"

const projectData: Record<
  string,
  {
    title: string
    phase: string
    researcher: string
    funding: number
    trl: number
    description: string[]
    advantages: { title: string; text: string }[]
    technicalSpecs: { label: string; value: string }[]
    marketApplications: string[]
    developmentTimeline: { phase: string; timeline: string; status: string }[]
    team: { name: string; role: string; institution: string }[]
    riskFactors: string[]
    competitiveAdvantage: string[]
    ipStatus: { type: string; status: string; details: string }
    milestones?: { id: number; description: string; amount: number; isApproved: boolean; isWithdrawn: boolean }[]
    escrowAddress?: string
    tokenAddress?: string
    iptAddress?: string
    ipnftAddress?: string
    /** Minted IP-NFT token id (IDs start at 1; undefined = not minted yet). */
    ipnftTokenId?: number
    swapAddress?: string
    isRaising?: boolean
    raisedAmount?: number
    targetAmount?: number
    investors?: number
    daysRemaining?: number
  }
> = {
  "g-cap-500": {
    title: "G-Cap 500",
    phase: "Scale-UP Phase",
    researcher: "Prof. Dr. Arnon Jenkins (MIT)",
    funding: 180000,
    trl: 6,
    isRaising: true,
    raisedAmount: 125000,
    targetAmount: 180000,
    investors: 47,
    daysRemaining: 23,
    description: [
      "G-Cap 500 represents a breakthrough in energy storage through Vertically Aligned Graphene Array (VAGA) technology, designed to solve the two major bottlenecks of today's Li-ion batteries: slow charging and short lifespan.",
      "Thanks to graphene's status as one of the most electrically conductive materials in the world, G-Cap 500 can absorb extremely high current instantaneously. This enables 0-80% charging in just 5 minutes (compared to 1-2 hours for conventional Li-ion batteries) and delivers a lifespan 10-50 times longer than standard batteries.",
      "This technology is not intended to completely replace Li-ion batteries, but rather to fill critical market gaps where ultra-fast charging and emergency power are essential\u2014such as electric buses that recharge at terminals, cargo delivery drones, and AI-grade data center UPS systems requiring immediate high-power backup.",
    ],
    advantages: [
      {
        title: "Extreme Fast Charging (XFC)",
        text: "Charges to near-full capacity in minutes, not hours, dramatically reducing vehicle downtime in commercial operations.",
      },
      {
        title: "Ultra-Long Cycle Life",
        text: "Supports over 100,000 charge cycles (compared to ~2,000 cycles for typical Li-ion batteries), effectively eliminating the need for battery replacement over a vehicle's lifetime and significantly reducing total cost of ownership (TCO).",
      },
      {
        title: "High Power Density",
        text: "Exceptional capability to deliver high burst power, ideal for heavy-duty vehicle acceleration and instant emergency power supply applications.",
      },
      {
        title: "Wide Temperature Range",
        text: "Operates reliably under extreme conditions from -40\u00B0C to +65\u00B0C, with minimal performance degradation.",
      },
    ],
    technicalSpecs: [
      { label: "Energy Density", value: "180 Wh/kg" },
      { label: "Power Density", value: "15,000 W/kg" },
      { label: "Cycle Life", value: ">100,000 cycles" },
      { label: "Charge Time", value: "0-80% in 5 minutes" },
      { label: "Operating Temperature", value: "-40°C to +65°C" },
    ],
    marketApplications: [
      "Electric bus rapid charging stations",
      "Cargo delivery drone power systems",
      "Data center UPS and emergency backup",
      "Heavy-duty commercial vehicles",
      "Grid-scale energy storage",
    ],
    developmentTimeline: [
      { phase: "Lab Validation", timeline: "Q1 2024", status: "Completed" },
      { phase: "Prototype Development", timeline: "Q3 2024", status: "Completed" },
      { phase: "Pilot Testing", timeline: "Q1 2025", status: "In Progress" },
      { phase: "Commercial Scale-Up", timeline: "Q4 2025", status: "Planned" },
    ],
    team: [
      { name: "Prof. Dr. Arnon Jenkins", role: "Principal Investigator", institution: "MIT" },
      { name: "Dr. Sarah Chen", role: "Materials Engineer", institution: "MIT" },
      { name: "Dr. Michael Torres", role: "Electrical Engineer", institution: "Stanford" },
    ],
    riskFactors: [
      "Scale-up manufacturing challenges for VAGA production",
      "Competition from established battery manufacturers",
      "Regulatory certification requirements for energy storage systems",
      "Supply chain dependencies for graphene materials",
    ],
    competitiveAdvantage: [
      "Proprietary VAGA manufacturing process with 3 patents filed",
      "10x faster charging than any commercially available solution",
      "50x longer cycle life than conventional Li-ion batteries",
      "Lower total cost of ownership over product lifetime",
    ],
    ipStatus: {
      type: "Patents Filed",
      status: "Pending",
      details: "3 US patent applications filed covering VAGA structure, manufacturing process, and integration methods",
    },
    milestones: [
      { id: 0, description: "Lab Validation", amount: 45000, isApproved: true, isWithdrawn: true },
      { id: 1, description: "Prototype Development", amount: 45000, isApproved: true, isWithdrawn: false },
      { id: 2, description: "Pilot Testing", amount: 45000, isApproved: false, isWithdrawn: false },
      { id: 3, description: "Commercial Scale-Up", amount: 45000, isApproved: false, isWithdrawn: false },
    ],
    escrowAddress: process.env.NEXT_PUBLIC_MATDAO_ESCROW_ADDRESS,
    iptAddress: process.env.NEXT_PUBLIC_MATDAO_IPT_ADDRESS,
    ipnftAddress: process.env.NEXT_PUBLIC_MATDAO_IPNFT_ADDRESS,
    swapAddress: process.env.NEXT_PUBLIC_MATDAO_SWAP_ADDRESS,
  },
  "cnt-power-cable": {
    title: "CNT Power Cable",
    phase: "Research Phase",
    researcher: "Dr. Somchai Tanaka (Chulalongkorn)",
    funding: 95000,
    trl: 4,
    isRaising: true,
    raisedAmount: 42000,
    targetAmount: 95000,
    investors: 23,
    daysRemaining: 45,
    description: [
      "CNT Power Cable uses carbon nanotube technology to create next-generation power transmission cables with significantly lower energy loss.",
      "Traditional copper cables lose 5-8% of energy during transmission. CNT cables reduce this to below 1%, making long-distance power transmission far more efficient.",
    ],
    advantages: [
      {
        title: "Ultra-Low Resistance",
        text: "Carbon nanotube-based conductors achieve resistance levels far below copper, minimizing energy losses.",
      },
      {
        title: "Lightweight Design",
        text: "CNT cables weigh 75% less than copper equivalents, reducing infrastructure costs.",
      },
      {
        title: "High Thermal Stability",
        text: "Maintains performance at temperatures exceeding 400\u00B0C.",
      },
    ],
    technicalSpecs: [
      { label: "Conductivity", value: "10^7 S/m" },
      { label: "Current Capacity", value: "5000 A/cm²" },
      { label: "Weight Reduction", value: "75% vs copper" },
      { label: "Energy Loss", value: "<1% transmission" },
      { label: "Max Temperature", value: ">400°C" },
    ],
    marketApplications: [
      "Long-distance power transmission",
      "Urban grid infrastructure",
      "Renewable energy grid connections",
      "High-voltage DC transmission",
      "Subsea power cables",
    ],
    developmentTimeline: [
      { phase: "Material Synthesis", timeline: "Q2 2024", status: "Completed" },
      { phase: "Cable Prototyping", timeline: "Q4 2024", status: "In Progress" },
      { phase: "Field Testing", timeline: "Q2 2025", status: "Planned" },
      { phase: "Commercial Production", timeline: "Q4 2025", status: "Planned" },
    ],
    team: [
      { name: "Dr. Somchai Tanaka", role: "Principal Investigator", institution: "Chulalongkorn" },
      { name: "Prof. Lisa Wang", role: "Materials Scientist", institution: "NUS" },
      { name: "Dr. Raj Patel", role: "Electrical Engineer", institution: "IIT Bombay" },
    ],
    riskFactors: [
      "CNT production cost at commercial scale",
      "Long-term durability under real-world conditions",
      "Integration with existing grid infrastructure",
      "Regulatory approval for power transmission applications",
    ],
    competitiveAdvantage: [
      "Proprietary CNT alignment technique",
      "Significant weight and energy savings",
      "Higher current capacity than competitors",
      "Established partnerships with utility companies",
    ],
    ipStatus: {
      type: "Patent Pending",
      status: "Filed",
      details: "US patent application for CNT alignment process and cable manufacturing method",
    },
    milestones: [
      { id: 0, description: "Material Synthesis", amount: 30000, isApproved: true, isWithdrawn: true },
      { id: 1, description: "Cable Prototyping", amount: 30000, isApproved: false, isWithdrawn: false },
      { id: 2, description: "Field Testing", amount: 20000, isApproved: false, isWithdrawn: false },
      { id: 3, description: "Commercial Production", amount: 15000, isApproved: false, isWithdrawn: false },
    ],
    escrowAddress: process.env.NEXT_PUBLIC_MATDAO_ESCROW_ADDRESS,
    iptAddress: process.env.NEXT_PUBLIC_MATDAO_IPT_ADDRESS,
    ipnftAddress: process.env.NEXT_PUBLIC_MATDAO_IPNFT_ADDRESS,
    swapAddress: process.env.NEXT_PUBLIC_MATDAO_SWAP_ADDRESS,
  },
}

type ShowcaseProject = (typeof projectData)[string]

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function kv(list: KeyValue[] | null | undefined, key: string): string {
  return list?.find((d) => d.key === key)?.value?.trim() || ""
}

/** Map an approved Supabase row onto the showcase page shape. */
function fromRow(row: ApprovedProjectRow): ShowcaseProject {
  const researcherName = row.researcher_name
  const field = row.working_field || kv(row.description, "workingField")
  const institution = row.institution || kv(row.description, "institution")
  const paragraphs = [
    kv(row.description, "targetAudience") && `Target audience: ${kv(row.description, "targetAudience")}`,
    kv(row.description, "painPoints") && `Problem addressed: ${kv(row.description, "painPoints")}`,
    kv(row.description, "marketSize") && `Market size: ${kv(row.description, "marketSize")}`,
    kv(row.technical_specs, "businessModel") && `Business model: ${kv(row.technical_specs, "businessModel")}`,
  ].filter((p): p is string => Boolean(p))
  const timelineFromForm = kv(row.technical_specs, "timeline")
  const milestonesFromForm = kv(row.technical_specs, "milestones")
  const developmentTimeline =
    Array.isArray(row.development_timeline) && row.development_timeline.length > 0
      ? row.development_timeline.map((m, i) => ({
          phase: String((m as Record<string, unknown>).label ?? (m as Record<string, unknown>).phase ?? `Milestone ${i + 1}`),
          timeline: String((m as Record<string, unknown>).duration ?? (m as Record<string, unknown>).timeline ?? ""),
          status: i === 0 ? "In Progress" : "Planned",
        }))
      : milestonesFromForm
        ? milestonesFromForm.split(/,|\n/).map((m, i) => ({ phase: m.trim(), timeline: i === 0 ? timelineFromForm : "", status: i === 0 ? "In Progress" : "Planned" })).filter((m) => m.phase)
        : [{ phase: "Research", timeline: timelineFromForm || "Ongoing", status: "In Progress" }]
  const ipType = row.ip_status?.type || kv(row.description, "license") || "Under Evaluation"
  return {
    title: row.title,
    phase: field ? `${field} · TRL ${row.trl}` : `TRL ${row.trl}`,
    researcher: researcherName ? `${researcherName}${institution ? ` (${institution})` : ""}` : institution || "MatDAO researcher",
    funding: row.funding_goal,
    trl: row.trl,
    isRaising: row.is_raising,
    raisedAmount: row.funding_raised ?? 0,
    targetAmount: row.funding_goal,
    description: paragraphs.length > 0 ? paragraphs : ["This project was submitted to and approved by the MatDAO review team."],
    advantages: row.competitive_advantage?.length
      ? row.competitive_advantage.map((text) => ({ title: "Advantage", text }))
      : [{ title: "Reviewed submission", text: "Approved by the MatDAO TTO review process." }],
    technicalSpecs: [
      { label: "TRL Level", value: String(row.trl) },
      ...(field ? [{ label: "Field", value: field }] : []),
      ...(institution ? [{ label: "Institution", value: institution }] : []),
      ...(kv(row.description, "partnerNeeded") ? [{ label: "Partner needed", value: kv(row.description, "partnerNeeded") }] : []),
      ...(kv(row.description, "fundingNeeded") ? [{ label: "Funding needed", value: kv(row.description, "fundingNeeded") }] : []),
    ],
    marketApplications: row.market_applications?.length
      ? row.market_applications
      : [kv(row.description, "targetAudience") || "Commercial applications under evaluation"],
    developmentTimeline,
    team: row.team?.length ? row.team : [{ name: researcherName || "Research team", role: "Principal Investigator", institution: institution || "—" }],
    riskFactors: row.risk_factors?.length ? row.risk_factors : ["Early stage research with technical uncertainties"],
    competitiveAdvantage: row.competitive_advantage?.length ? row.competitive_advantage : ["Novel approach to material science challenges"],
    ipStatus: {
      type: ipType,
      status: row.ip_status?.status === "minted" ? "Minted" : row.ip_status?.status || "Pending",
      details: row.ip_status?.status === "minted"
        ? `IP-NFT minted${row.ip_status.tokenId ? ` (token #${row.ip_status.tokenId})` : ""}`
        : row.ip_status?.details || "IP strategy being developed",
    },
    milestones: [],
    ipnftAddress: row.ip_status?.status === "minted" ? process.env.NEXT_PUBLIC_MATDAO_IPNFT_ADDRESS : undefined,
    ipnftTokenId: row.ip_status?.status === "minted" && row.ip_status.tokenId ? Number(row.ip_status.tokenId) : undefined,
  }
}

async function loadLiveProject(id: string): Promise<ShowcaseProject | null> {
  const supabase = createAnonServerClient()
  if (!supabase) return null
  // `approved_projects` only contains status = 'approved' rows and is readable by anon.
  const { data, error } = await supabase.from("approved_projects").select("*").eq("id", id).maybeSingle()
  if (error || !data) return null
  return fromRow(data)
}

async function getProject(id: string): Promise<ShowcaseProject> {
  if (UUID_RE.test(id)) {
    const live = await loadLiveProject(id)
    if (!live) notFound()
    return live
  }
  return (
    projectData[id] || {
      title: id
        .replace(/-/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase()),
      phase: "Research Phase",
      researcher: "Research Team",
      funding: 50000,
      trl: 3,
      description: [
        "This is an advanced materials research project currently in development on the MatDAO platform.",
        "More details will be published as the project progresses through its milestones.",
      ],
      advantages: [
        {
          title: "Innovative Material",
          text: "Novel material properties with potential commercial applications.",
        },
        {
          title: "Scalable Process",
          text: "Manufacturing process designed for eventual industrial scale production.",
        },
      ],
      technicalSpecs: [
        { label: "TRL Level", value: "3" },
        { label: "Development Phase", value: "Early Research" },
      ],
      marketApplications: [
        "Commercial applications under evaluation",
      ],
      developmentTimeline: [
        { phase: "Research", timeline: "Ongoing", status: "In Progress" },
      ],
      team: [
        { name: "Research Team", role: "Principal Investigator", institution: "Multiple" },
      ],
      riskFactors: [
        "Early stage research with technical uncertainties",
      ],
      competitiveAdvantage: [
        "Novel approach to material science challenges",
      ],
      ipStatus: {
        type: "Under Evaluation",
        status: "Pending",
        details: "IP strategy being developed",
      },
      milestones: [],
    }
  )
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const project = await getProject(id)

  return (
    <div className="flex flex-col">
      {/* Hero Banner */}
      <section className="relative flex min-h-[60vh] items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://6ibpna7m8edwyvzk.public.blob.vercel-storage.com/graphene-what-is-it-and-what-is-it-used-for-393831-640x360.jpg"
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-4 px-4 text-center">
          <h1 className="text-5xl font-bold text-white md:text-6xl">
            {project.title}
          </h1>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-[#6efcff]/40 bg-[#6efcff]/10 px-4 py-1 text-sm font-medium text-[#c5fdff]">
              {project.phase}
            </span>
            <span className="rounded-full border border-white/30 bg-white/10 px-4 py-1 text-sm text-white/80">
              {project.researcher}
            </span>
            {project.isRaising && (
              <span className="rounded-full border border-green-500/40 bg-green-500/10 px-4 py-1 text-sm font-medium text-green-400 animate-pulse">
                🔥 Raising
              </span>
            )}
          </div>
          <div className="mt-4 flex items-center gap-4">
            <div className="rounded-full bg-[#6efcff]/20 px-6 py-3 text-xl font-bold text-[#c5fdff] backdrop-blur-sm border border-[#6efcff]/30">
              ${project.funding.toLocaleString()}
            </div>
            <div className="rounded-full border border-[#6efcff]/30 bg-[#6efcff]/10 px-4 py-3 text-sm font-medium text-[#c5fdff]">
              TRL {project.trl}
            </div>
          </div>
          
          {/* Raising Progress Bar */}
          {project.isRaising && (
            <div className="mt-6 w-full max-w-2xl">
              <div className="flex justify-between text-sm text-white/70 mb-2">
                <span>${(project.raisedAmount || 0).toLocaleString()} raised</span>
                <span>${project.targetAmount?.toLocaleString()} target</span>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#6efcff] to-[#a78bfa] transition-all duration-500"
                  style={{ width: `${((project.raisedAmount || 0) / (project.targetAmount || 1)) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-white/50 mt-1">
                <span>{project.investors} investors</span>
                <span>{project.daysRemaining} days remaining</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Client Component for Interactive Elements */}
      <ProjectDetailClient project={project} />

      {/* Content */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4">
          <div className="rounded-xl border border-border/60 bg-card p-8">
            {/* Description */}
            <div className="mb-10">
              <h2 className="mb-6 flex items-center gap-3 text-2xl font-bold text-foreground">
                <span className="h-8 w-1 rounded-full bg-primary" />
                Description
              </h2>
              <div className="flex flex-col gap-4">
                {project.description.map((paragraph, i) => (
                  <p
                    key={i}
                    className="text-sm leading-relaxed text-muted-foreground"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>

            {/* Material Advantage */}
            <div className="mb-10">
              <h2 className="mb-6 flex items-center gap-3 text-2xl font-bold text-foreground">
                <span className="h-8 w-1 rounded-full bg-primary" />
                Material Advantage
              </h2>
              <div className="flex flex-col gap-4">
                {project.advantages.map((advantage) => (
                  <div key={advantage.title}>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {advantage.title}:{" "}
                      </span>
                      {advantage.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Technical Specifications */}
            <div className="mb-10">
              <h2 className="mb-6 flex items-center gap-3 text-2xl font-bold text-foreground">
                <span className="h-8 w-1 rounded-full bg-primary" />
                Technical Specifications
              </h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {project.technicalSpecs.map((spec) => (
                  <div key={spec.label} className="rounded-lg border border-border/60 bg-secondary/20 p-4">
                    <p className="text-xs text-muted-foreground">{spec.label}</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{spec.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Market Applications */}
            <div className="mb-10">
              <h2 className="mb-6 flex items-center gap-3 text-2xl font-bold text-foreground">
                <span className="h-8 w-1 rounded-full bg-primary" />
                Market Applications
              </h2>
              <div className="flex flex-wrap gap-2">
                {project.marketApplications.map((app) => (
                  <span key={app} className="rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-primary">
                    {app}
                  </span>
                ))}
              </div>
            </div>

            {/* Development Timeline */}
            <div className="mb-10">
              <h2 className="mb-6 flex items-center gap-3 text-2xl font-bold text-foreground">
                <span className="h-8 w-1 rounded-full bg-primary" />
                Development Timeline
              </h2>
              <div className="space-y-3">
                {project.developmentTimeline.map((milestone) => (
                  <div key={milestone.phase} className="flex items-center gap-4 rounded-lg border border-border/60 bg-secondary/20 p-4">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{milestone.phase}</p>
                      <p className="text-xs text-muted-foreground">{milestone.timeline}</p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        milestone.status === "Completed"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : milestone.status === "In Progress"
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-blue-500/10 text-blue-400"
                      }`}
                    >
                      {milestone.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Team */}
            <div className="mb-10">
              <h2 className="mb-6 flex items-center gap-3 text-2xl font-bold text-foreground">
                <span className="h-8 w-1 rounded-full bg-primary" />
                Research Team
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {project.team.map((member) => (
                  <div key={member.name} className="rounded-lg border border-border/60 bg-secondary/20 p-4">
                    <p className="text-sm font-medium text-foreground">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.role}</p>
                    <p className="text-xs text-muted-foreground">{member.institution}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk Factors */}
            <div className="mb-10">
              <h2 className="mb-6 flex items-center gap-3 text-2xl font-bold text-foreground">
                <span className="h-8 w-1 rounded-full bg-primary" />
                Risk Factors
              </h2>
              <div className="space-y-2">
                {project.riskFactors.map((risk) => (
                  <div key={risk} className="flex items-start gap-2 rounded-lg border border-border/60 bg-secondary/20 p-3">
                    <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />
                    <p className="text-sm text-muted-foreground">{risk}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Competitive Advantage */}
            <div className="mb-10">
              <h2 className="mb-6 flex items-center gap-3 text-2xl font-bold text-foreground">
                <span className="h-8 w-1 rounded-full bg-primary" />
                Competitive Advantage
              </h2>
              <div className="space-y-2">
                {project.competitiveAdvantage.map((advantage) => (
                  <div key={advantage} className="flex items-start gap-2 rounded-lg border border-border/60 bg-secondary/20 p-3">
                    <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
                    <p className="text-sm text-muted-foreground">{advantage}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* IP Status */}
            <div>
              <h2 className="mb-6 flex items-center gap-3 text-2xl font-bold text-foreground">
                <span className="h-8 w-1 rounded-full bg-primary" />
                Intellectual Property Status
              </h2>
              <div className="rounded-lg border border-border/60 bg-secondary/20 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{project.ipStatus.type}</p>
                    <p className="text-xs text-muted-foreground">{project.ipStatus.details}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      project.ipStatus.status === "Filed" || project.ipStatus.status === "Pending"
                        ? "bg-blue-500/10 text-blue-400"
                        : "bg-amber-500/10 text-amber-400"
                    }`}
                  >
                    {project.ipStatus.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Funding & Milestones Panel */}
      {project.milestones && project.milestones.length > 0 && (
        <section className="py-8">
          <div className="mx-auto max-w-4xl px-4">
            <FundingPanel
              projectId={id}
              milestones={project.milestones}
              escrowAddress={project.escrowAddress}
              tokenAddress={project.tokenAddress}
            />
          </div>
        </section>
      )}

      {/* Virtual Data Room */}
      {project.iptAddress && (
        <section className="py-8">
          <div className="mx-auto max-w-4xl px-4">
            <ProjectDataRoom 
              projectId={id}
              iptAddress={project.iptAddress}
            />
          </div>
        </section>
      )}

      {/* Legal Registry */}
      {project.ipnftAddress && (
        <section className="py-8">
          <div className="mx-auto max-w-4xl px-4">
            <LegalRegistryPanel
              ipnftAddress={project.ipnftAddress}
              tokenId={project.ipnftTokenId ?? 0}
            />
          </div>
        </section>
      )}
    </div>
  )
}
