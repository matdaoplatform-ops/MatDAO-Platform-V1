"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import {
  Search,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Beaker,
  User,
} from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { loadUserData } from "@/lib/trl-services/storage"
import { supabase } from "@/lib/supabase/client"
import { PartnersCarousel } from "@/components/partners-carousel"

/* ------------------------------------------------------------------ */
/*  Static data (would come from API in production)                    */
/* ------------------------------------------------------------------ */

const ecosystemStats = [
  { label: "Total Projects", value: "12" },
  { label: "Total Funding", value: "$1.28M" },
  { label: "Avg. TRL Level", value: "4.2" },
  { label: "Active Researchers", value: "34" },
]

const categories = ["All", "Equity", "Initiative"] as const
type Category = (typeof categories)[number]

interface Project {
  id: string
  slug: string
  name: string
  ticker: string
  category: Category
  trl: number
  phase: string
  fundingGoal: number
  fundingRaised: number
  researcher: string
  institution: string
  change24h: number
  image: string
  researcherId?: string
  /** True for rows loaded from Supabase (approved submissions). */
  live?: boolean
}

const FALLBACK_IMAGE = "https://6ibpna7m8edwyvzk.public.blob.vercel-storage.com/graphene-what-is-it-and-what-is-it-used-for-393831-640x360.jpg"

const showcaseProjects: Project[] = [
  {
    id: "000001",
    slug: "cnt-power-cable",
    name: "CNT Power Cable",
    ticker: "CNT",
    category: "Equity",
    trl: 5,
    phase: "Validation",
    fundingGoal: 150000,
    fundingRaised: 95000,
    researcher: "Dr. Sarah Chen",
    institution: "MIT",
    change24h: 12.5,
    image: "https://6ibpna7m8edwyvzk.public.blob.vercel-storage.com/24225-cinta-black.webp",
  },
  {
    id: "000002",
    slug: "mof-water-harvest",
    name: "MOF Water Harvesting",
    ticker: "MOF",
    category: "Initiative",
    trl: 4,
    phase: "Lab Testing",
    fundingGoal: 80000,
    fundingRaised: 45000,
    researcher: "Prof. James Okafor",
    institution: "Stanford",
    change24h: -3.2,
    image: "https://6ibpna7m8edwyvzk.public.blob.vercel-storage.com/0_5nmrfh2KtQ5KjByN.png",
  },
  {
    id: "000003",
    slug: "aluminum-air-battery",
    name: "Aluminum-Air Battery",
    ticker: "ALB",
    category: "Equity",
    trl: 3,
    phase: "Proof of Concept",
    fundingGoal: 25000,
    fundingRaised: 5000,
    researcher: "Dr. Mei Lin",
    institution: "Tsinghua",
    change24h: 0.8,
    image: "https://6ibpna7m8edwyvzk.public.blob.vercel-storage.com/Aluminum-Air-Experimental-Power-Cell.jpg",
  },
  {
    id: "000004",
    slug: "g-cap-500",
    name: "G-Cap 500",
    ticker: "GCAP",
    category: "Equity",
    trl: 6,
    phase: "Scale-Up",
    fundingGoal: 250000,
    fundingRaised: 180000,
    researcher: "Prof. Dr. Arnon Jenkins",
    institution: "MIT",
    change24h: 28.4,
    image: "https://6ibpna7m8edwyvzk.public.blob.vercel-storage.com/ImageForArticle_6053_16478598102957979.webp",
  },
  {
    id: "000005",
    slug: "cassava-bioplast",
    name: "Cassava-Bioplast",
    ticker: "CBIO",
    category: "Initiative",
    trl: 4,
    phase: "Lab Testing",
    fundingGoal: 120000,
    fundingRaised: 80000,
    researcher: "Dr. Amina Bello",
    institution: "U. Lagos",
    change24h: -1.1,
    image: "https://6ibpna7m8edwyvzk.public.blob.vercel-storage.com/bot_san_day_0_bc14fddbd3.jpg",
  },
  {
    id: "000006",
    slug: "perovskite-solar",
    name: "Perovskite Solar Film",
    ticker: "PSF",
    category: "Equity",
    trl: 5,
    phase: "Validation",
    fundingGoal: 200000,
    fundingRaised: 134000,
    researcher: "Dr. Ravi Patel",
    institution: "Oxford",
    change24h: 5.7,
    image: "https://6ibpna7m8edwyvzk.public.blob.vercel-storage.com/Solliance-perovskite-solar-cell.jpg",
  },
  {
    id: "000007",
    slug: "graphene-filter",
    name: "Graphene Nano-Filter",
    ticker: "GNF",
    category: "Initiative",
    trl: 3,
    phase: "Proof of Concept",
    fundingGoal: 60000,
    fundingRaised: 22000,
    researcher: "Dr. Lena Svenson",
    institution: "KTH Stockholm",
    change24h: 15.3,
    image: "https://6ibpna7m8edwyvzk.public.blob.vercel-storage.com/f0367148-800px-wm.jpg",
  },
  {
    id: "000008",
    slug: "mycelium-composite",
    name: "Mycelium Composite",
    ticker: "MYC",
    category: "Equity",
    trl: 4,
    phase: "Lab Testing",
    fundingGoal: 90000,
    fundingRaised: 41000,
    researcher: "Dr. Kai Tanaka",
    institution: "U. Tokyo",
    change24h: -6.2,
    image: "https://6ibpna7m8edwyvzk.public.blob.vercel-storage.com/image.imageformat.930.1580458024.jpg",
  },
]

type SortField = "name" | "trl" | "fundingRaised" | "change24h"
type SortDir = "asc" | "desc"

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ProjectMarketPage() {
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState<Category>("All")
  const [sortField, setSortField] = useState<SortField>("fundingRaised")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [platformData, setPlatformData] = useState<any>(null)
  const [liveProjects, setLiveProjects] = useState<Project[]>([])

  // Load user data for researchers
  useEffect(() => {
    if (user && user.role === "researcher") {
      setPlatformData(loadUserData(user.id))
    }
  }, [user])

  // Approved submissions come from the public `approved_projects` view (which
  // also exposes the researcher's display name); merge with the showcase set.
  useEffect(() => {
    let cancelled = false
    supabase
      .from("approved_projects")
      .select("id, slug, title, trl, phase, funding_goal, funding_raised, institution, working_field, created_at, researcher_name")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled || error || !data) return
        setLiveProjects(
          data.map((p) => ({
            id: p.id,
            slug: p.id,
            name: p.title,
            ticker: p.title
              .split(/\s+/)
              .map((w) => w[0])
              .join("")
              .toUpperCase()
              .slice(0, 4),
            category: "Initiative" as Category,
            trl: p.trl,
            phase: p.working_field || p.phase || "Submitted",
            fundingGoal: p.funding_goal,
            fundingRaised: p.funding_raised ?? 0,
            researcher: p.researcher_name || "MatDAO researcher",
            institution: p.institution || "—",
            change24h: 0,
            image: FALLBACK_IMAGE,
            live: true,
          })),
        )
      })
    return () => {
      cancelled = true
    }
  }, [])

  const projects = useMemo(() => [...liveProjects, ...showcaseProjects], [liveProjects])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDir("desc")
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    )
  }

  const filtered = useMemo(() => {
    let list = [...projects]
    if (activeCategory !== "All") {
      list = list.filter((p) => p.category === activeCategory)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.ticker.toLowerCase().includes(q) ||
          p.researcher.toLowerCase().includes(q) ||
          p.institution.toLowerCase().includes(q)
      )
    }
    list.sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }
      return sortDir === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number)
    })
    return list
  }, [projects, searchQuery, activeCategory, sortField, sortDir])

  // Researcher's own live projects, plus showcase entries matching their assessments
  const researcherProjects = useMemo(() => {
    if (!user || user.role !== "researcher") return []
    const assessmentTitles: string[] = platformData?.assessments?.map((a: any) => a.title) || []
    return projects.filter((p) => p.researcherId === user.id || assessmentTitles.includes(p.name))
  }, [user, platformData, projects])

  return (
    <div className="flex flex-col">
      {/* ---- Hero / Stats Banner ---- */}
      <section className="border-b border-border/40 bg-card/50 px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-col items-start gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                Material Science Markets
              </h1>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Explore the MatDAO ecosystem -- track funding, TRL progress, and
                researcher activity across all material-science projects.
              </p>
            </div>
            <Link
              href="/submit"
              className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Beaker className="h-4 w-4" />
              Submit Research
            </Link>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {ecosystemStats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-border/50 bg-background/60 px-5 py-4"
              >
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {stat.label}
                </p>
                <p className="mt-1 text-2xl font-bold text-foreground">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Filter Bar ---- */}
      <section className="sticky top-16 z-30 border-b border-border/40 bg-background/80 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
          {/* Category tabs */}
          <div className="flex items-center gap-1 rounded-full border border-border/60 bg-card/60 p-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${activeCategory === cat
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                {cat}
                <span className="ml-1.5 text-xs opacity-60">
                  {cat === "All"
                    ? projects.length
                    : projects.filter((p) => p.category === cat).length}
                </span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-full border border-border/60 bg-card/60 py-2 pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ---- My Projects Section (Researchers only) ---- */}
      {user?.role === "researcher" && researcherProjects.length > 0 && (
        <section className="border-b border-border/40 bg-primary/5 px-4 py-6">
          <div className="mx-auto max-w-6xl">
            <div className="mb-4 flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">My Ongoing Projects</h2>
              <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs text-primary">
                {researcherProjects.length}
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {researcherProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/project/${project.slug}`}
                  className="group rounded-xl border border-border/50 bg-card/60 p-4 transition-colors hover:bg-card/80"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg">
                      <img
                        src={project.image}
                        alt={project.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium text-foreground group-hover:text-primary">
                        {project.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">{project.ticker}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                          TRL {project.trl}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{project.phase}</span>
                      </div>
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>${project.fundingRaised.toLocaleString()} / ${project.fundingGoal.toLocaleString()}</span>
                          <span>{Math.round((project.fundingRaised / project.fundingGoal) * 100)}%</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border/40">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.min(Math.round((project.fundingRaised / project.fundingGoal) * 100), 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---- Table ---- */}
      <section className="px-4 pb-20 pt-6">
        <div className="mx-auto max-w-6xl">
          <div className="overflow-x-auto rounded-xl border border-border/50 bg-card/40">
            {/* Table header */}
            <div className="grid min-w-[820px] grid-cols-[2.5rem_1fr_5rem_7rem_7rem_8rem_6rem_2.5rem] items-center gap-3 border-b border-border/40 px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <span>#</span>
              <span>Project</span>
              <button
                onClick={() => handleSort("trl")}
                className="flex items-center gap-1 hover:text-foreground"
              >
                TRL <SortIcon field="trl" />
              </button>
              <span>Phase</span>
              <button
                onClick={() => handleSort("fundingRaised")}
                className="flex items-center gap-1 hover:text-foreground"
              >
                Funded <SortIcon field="fundingRaised" />
              </button>
              <span>Progress</span>
              <button
                onClick={() => handleSort("change24h")}
                className="flex items-center gap-1 hover:text-foreground"
              >
                24h <SortIcon field="change24h" />
              </button>
              <span />
            </div>

            {/* Rows */}
            {filtered.map((project, index) => {
              const progress = Math.round(
                (project.fundingRaised / project.fundingGoal) * 100
              )
              const isPositive = project.change24h >= 0
              return (
                <Link
                  key={project.id}
                  href={`/project/${project.slug}`}
                  className="group grid min-w-[820px] grid-cols-[2.5rem_1fr_5rem_7rem_7rem_8rem_6rem_2.5rem] items-center gap-3 border-b border-border/20 px-4 py-3.5 transition-colors last:border-b-0 hover:bg-secondary/30"
                >
                  {/* Index */}
                  <span className="text-xs text-muted-foreground">
                    {index + 1}
                  </span>

                  {/* Project info */}
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-lg">
                      <img
                        src={project.image}
                        alt={project.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {project.name}
                        {project.live && (
                          <span className="ml-2 rounded-full border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-accent">
                            Live
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {project.ticker} &middot; {project.researcher}
                      </p>
                    </div>
                  </div>

                  {/* TRL */}
                  <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-center text-xs font-medium text-accent">
                    TRL {project.trl}
                  </span>

                  {/* Phase */}
                  <span className="text-xs text-muted-foreground">
                    {project.phase}
                  </span>

                  {/* Funded */}
                  <span className="text-sm font-medium text-foreground">
                    ${project.fundingRaised.toLocaleString()}
                  </span>

                  {/* Progress bar */}
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border/40">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-xs text-muted-foreground">
                      {progress}%
                    </span>
                  </div>

                  {/* 24h change */}
                  <div
                    className={`flex items-center gap-1 text-xs font-medium ${isPositive ? "text-accent" : "text-destructive"
                      }`}
                  >
                    {isPositive ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {isPositive ? "+" : ""}
                    {project.change24h.toFixed(1)}%
                  </div>

                  {/* External arrow */}
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              )
            })}

            {filtered.length === 0 && (
              <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                No projects match your search or filter.
              </div>
            )}
          </div>

          {/* Bottom CTA */}
          <div className="mt-8 flex flex-col items-center gap-3 rounded-xl border border-border/50 bg-card/40 px-6 py-8 text-center">
            <h3 className="text-lg font-semibold text-foreground">
              Have groundbreaking material science research?
            </h3>
            <p className="max-w-md text-sm text-muted-foreground">
              Submit your project to get matched with the right milestone
              structure, unlock funding, and join the MatDAO ecosystem.
            </p>
            <Link
              href="/submit"
              className="mt-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Submit Your Research
            </Link>
          </div>
        </div>
      </section>

      {/* Partners Carousel */}
      <PartnersCarousel />
    </div>
  )
}
