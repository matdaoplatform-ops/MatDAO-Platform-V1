// Marketing site copy (English, default).
//
// Rules (see the build brief §7):
// - Every visible string on the landing page lives here (and in th.ts).
// - Never invent statistics, partners, amounts or testimonials. Unknown values
//   stay empty ("") and the UI renders "—".
// - One italic-serif accent word per headline at most: mark it as {accent}.

export type Accent = { pre: string; accent?: string; post?: string }

export interface ProjectCard {
  id: string
  title: string
  field: "Biomaterials" | "Energy" | "Agri-tech" | "Nanomaterials"
  institution: string
  trl: string
  /** 0..1, or null when unknown (renders "—"). */
  funded: number | null
  placeholder: boolean
}

export const en = {
  meta: {
    title: "MatDAO — Funding the materials that build the future",
    description:
      "MatDAO is a research-funding DAO for materials science. Researchers submit their work, KALDERA AI values it, and investors fund tokenized IP.",
  },
  preloader: {
    label: "MATDAO — INITIALISING LATTICE",
  },
  cta: {
    submit: "Submit your research",
    explore: "Explore research",
    join: "Join the DAO",
    connected: "Open investor dashboard",
  },
  hero: {
    headline: { pre: "Funding the materials that build the ", accent: "future", post: "." } as Accent,
    lede: "MatDAO is a research-funding DAO for materials science. We turn lab breakthroughs into fundable, tokenized IP and take them to market.",
    // Real figures only. Leave "" until the team confirms a number.
    stats: [
      { value: "", label: "Research projects" },
      { value: "", label: "Investors" },
      { value: "", label: "THB funded" },
    ],
    locale: "BANGKOK, TH",
    scroll: "Scroll to enter the lab",
  },
  problem: {
    label: "// 01 — THE GAP",
    headline: { pre: "Most breakthroughs never leave the ", accent: "lab", post: "." } as Accent,
    columns: [
      { tag: "FUNDING", title: "Caught between two worlds", body: "Early-stage deeptech is too early for VCs and too applied for grants." },
      { tag: "IP", title: "Value left on paper", body: "Valuable IP sits in papers, unpriced and unlicensed." },
      { tag: "ACCESS", title: "No way in", body: "Investors who want to fund science have no direct way in." },
    ],
  },
  protocol: {
    label: "// 02 — THE PROTOCOL",
    headline: { pre: "Three steps from lab to ", accent: "market", post: "." } as Accent,
    steps: [
      {
        n: "01",
        tag: "TECH TRANSFER",
        title: "Map the path",
        body: "Researchers submit their work. We map the path from lab to market.",
      },
      {
        n: "02",
        tag: "KALDERA AI VALUATION",
        title: "Read, check, value",
        body: "KALDERA reads the research, checks originality against patents and literature, scores readiness, and estimates value.",
      },
      {
        n: "03",
        tag: "TOKENIZATION",
        title: "Fund and share",
        body: "IP becomes an on-chain asset. Investors fund it. Researchers and investors share the upside.",
      },
    ],
    readout: {
      label: "AI VALUATION LAYER",
      rows: [
        { k: "ORIGINALITY CHECK", v: "✓" },
        { k: "TRL", v: "" },
        { k: "PATENT MATCHES", v: "" },
        { k: "EST. VALUE", v: "" },
      ],
      note: "Illustrative readout",
    },
    fields: ["Biomaterials", "Batteries", "Catalysts", "Polymers", "Nanomaterials", "Agri-tech", "Carbon capture", "Semiconductors"],
  },
  terra: {
    label: "// 03 — PILOT PROJECT: TERRA",
    headline: { pre: "From invasive weed to ", accent: "fertile", post: " ground." } as Accent,
    badge: "Chulalongkorn University · Lab of Asst. Prof. Numpon Insin",
    pilot: "Pilot project",
    states: [
      { n: "01", tag: "WASTE", body: "Water hyacinth: an invasive weed clogging Thai waterways." },
      { n: "02", tag: "BIOCHAR", body: "Carbonised into stable, porous biochar." },
      { n: "03", tag: "SUBSTRATE", body: "Bound with bacterial cellulose from kombucha production into a growing substrate." },
    ],
    cta: "Read the Terra case",
    ctaHref: "/project",
  },
  gallery: {
    label: "// 04 — OPEN RESEARCH",
    headline: { pre: "Research you can ", accent: "back", post: "." } as Accent,
    filterTitle: "WHAT ARE YOU LOOKING FOR?",
    filters: ["All", "Biomaterials", "Energy", "Agri-tech", "Nanomaterials"],
    view: "View",
    trl: "TRL",
    funded: "Funded",
    sample: "Sample listing",
    projects: [
      { id: "terra", title: "TERRA", field: "Agri-tech", institution: "Chulalongkorn University", trl: "", funded: null, placeholder: false },
      { id: "p2", title: "[PROJECT NAME]", field: "Energy", institution: "[Institution]", trl: "", funded: null, placeholder: true },
      { id: "p3", title: "[PROJECT NAME]", field: "Biomaterials", institution: "[Institution]", trl: "", funded: null, placeholder: true },
      { id: "p4", title: "[PROJECT NAME]", field: "Nanomaterials", institution: "[Institution]", trl: "", funded: null, placeholder: true },
      { id: "p5", title: "[PROJECT NAME]", field: "Energy", institution: "[Institution]", trl: "", funded: null, placeholder: true },
      { id: "p6", title: "[PROJECT NAME]", field: "Biomaterials", institution: "[Institution]", trl: "", funded: null, placeholder: true },
      { id: "p7", title: "[PROJECT NAME]", field: "Agri-tech", institution: "[Institution]", trl: "", funded: null, placeholder: true },
    ] as ProjectCard[],
    all: "Explore all research",
  },
  paths: {
    label: "// 05 — JOIN",
    researchers: {
      kicker: "FOR RESEARCHERS",
      title: { pre: "Get your research ", accent: "funded", post: " and valued." } as Accent,
      bullets: ["Free AI valuation", "Tokenized IP", "Access to investors"],
    },
    investors: {
      kicker: "FOR INVESTORS",
      title: { pre: "Fund the science you ", accent: "believe", post: " in." } as Accent,
      bullets: ["Curated deeptech", "On-chain transparency", "Shared upside"],
    },
  },
  signal: {
    label: "// 06 — SIGNAL",
    recognition: [
      "3RD RUNNER-UP · THAMMASAT STARTUP 2026",
      "STARTUP THAILAND LEAGUE 2026",
      "THAILAND REPRESENTATIVE · STARTUP PROTOCOL CAMP",
    ],
    teamTitle: "Team",
    // Fill in from the team page. Empty entries render as placeholders.
    team: [
      { name: "", role: "" },
      { name: "", role: "" },
      { name: "", role: "" },
      { name: "", role: "" },
    ],
    namePlaceholder: "[Name]",
    rolePlaceholder: "[Role]",
  },
  finale: {
    manifesto: ["FROM ATOM", "TO ASSET"],
    manifestoNote: "MatDAO connects the people who make new materials with the people who want to fund them.",
    headline: { pre: "Build the future of ", accent: "materials", post: "." } as Accent,
  },
  footer: {
    columns: [
      {
        title: "Product",
        links: [
          { label: "Research", href: "/project" },
          { label: "KALDERA AI", href: "/ai-studio" },
          { label: "Tokenization", href: "/mattoken" },
        ],
      },
      {
        title: "Resources",
        links: [
          { label: "Docs", href: "/guide" },
          { label: "Whitepaper", href: "" },
          { label: "Blog", href: "" },
        ],
      },
      {
        title: "Community",
        links: [
          { label: "X", href: "" },
          { label: "LinkedIn", href: "" },
          { label: "Discord", href: "" },
          { label: "Telegram", href: "" },
        ],
      },
      {
        title: "Company",
        links: [
          { label: "About", href: "/why-us" },
          { label: "Contact", href: "" },
        ],
      },
    ],
    copyright: "© 2026 MatDAO",
    top: "Back to top",
    soon: "Coming soon",
  },
  a11y: {
    skip: "Skip to content",
    language: "Language",
    reducedMotion: "Animations are reduced.",
  },
}

export type Dict = typeof en
