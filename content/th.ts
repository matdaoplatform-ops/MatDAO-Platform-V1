// TODO: review — Thai copy drafted by Claude from en.ts; needs a native review
// before launch (tone, technical terms, line lengths).
import type { Accent, Dict, ProjectCard } from "./en"

export const th: Dict = {
  meta: {
    title: "MatDAO — ทุนวิจัยสำหรับวัสดุที่สร้างอนาคต",
    description:
      "MatDAO คือ DAO ระดมทุนวิจัยด้านวัสดุศาสตร์ นักวิจัยส่งผลงาน KALDERA AI ประเมินมูลค่า และผู้สนับสนุนร่วมลงทุนใน IP ที่ถูกโทเคไนซ์",
  },
  nav: {
    research: "งานวิจัย",
    researchItems: [
      { label: "สำรวจงานวิจัย", href: "/project" },
      { label: "ส่งงานวิจัยของคุณ", href: "/submit" },
      { label: "ประเมินมูลค่าด้วย KALDERA AI", href: "/ai-studio" },
    ],
    how: "วิธีการทำงาน",
    terra: "Terra",
    dao: "DAO",
    daoItems: [
      { label: "MAT token", href: "/mattoken" },
      { label: "Milestone escrow", href: "/milestone-escrow" },
      { label: "Ecosystem", href: "/our-ecosystem" },
    ],
    docs: "เอกสาร",
    login: "เข้าสู่ระบบ",
    launch: "เปิดแอป",
    menu: "เมนู",
    close: "ปิด",
  },
  preloader: {
    label: "MATDAO — INITIALISING LATTICE",
  },
  cta: {
    submit: "ส่งงานวิจัยของคุณ",
    explore: "สำรวจงานวิจัย",
    join: "เข้าร่วม DAO",
    connected: "เชื่อมต่อวอลเล็ตแล้ว",
  },
  hero: {
    headline: { pre: "ทุนวิจัยสำหรับวัสดุที่สร้าง", accent: "อนาคต", post: "" } as Accent,
    lede: "MatDAO คือ DAO ระดมทุนวิจัยด้านวัสดุศาสตร์ เราเปลี่ยนผลงานจากห้องแล็บให้เป็น IP ที่ระดมทุนได้และถูกโทเคไนซ์ แล้วพาออกสู่ตลาด",
    stats: [
      { value: "", label: "โครงการวิจัย" },
      { value: "", label: "ผู้สนับสนุน" },
      { value: "", label: "บาทที่ระดมได้" },
    ],
    locale: "BANGKOK, TH",
    scroll: "เลื่อนลงเพื่อเข้าสู่แล็บ",
  },
  problem: {
    label: "// 01 — THE GAP",
    headline: { pre: "งานวิจัยดี ๆ ส่วนใหญ่ไม่เคยออกจาก", accent: "แล็บ", post: "" } as Accent,
    columns: [
      { tag: "FUNDING", title: "ติดอยู่ตรงกลาง", body: "Deeptech ระยะแรกเร็วเกินไปสำหรับ VC และประยุกต์เกินไปสำหรับทุนวิจัย" },
      { tag: "IP", title: "มูลค่าที่อยู่แค่บนกระดาษ", body: "IP ที่มีค่าอยู่ในเปเปอร์ ยังไม่มีราคาและยังไม่ถูกนำไปใช้" },
      { tag: "ACCESS", title: "ไม่มีทางเข้า", body: "คนที่อยากสนับสนุนวิทยาศาสตร์ยังไม่มีช่องทางลงทุนโดยตรง" },
    ],
  },
  protocol: {
    label: "// 02 — THE PROTOCOL",
    headline: { pre: "สามขั้นตอนจากแล็บสู่", accent: "ตลาด", post: "" } as Accent,
    steps: [
      { n: "01", tag: "TECH TRANSFER", title: "วางเส้นทาง", body: "นักวิจัยส่งผลงาน เราวางเส้นทางจากแล็บสู่ตลาด" },
      {
        n: "02",
        tag: "KALDERA AI VALUATION",
        title: "อ่าน ตรวจ ประเมิน",
        body: "KALDERA อ่านงานวิจัย ตรวจความใหม่เทียบกับสิทธิบัตรและบทความ ให้คะแนนความพร้อม และประเมินมูลค่า",
      },
      { n: "03", tag: "TOKENIZATION", title: "ระดมทุนและแบ่งผล", body: "IP กลายเป็นสินทรัพย์บนบล็อกเชน ผู้สนับสนุนร่วมลงทุน นักวิจัยและผู้สนับสนุนแบ่งผลตอบแทนร่วมกัน" },
    ],
    readout: {
      label: "AI VALUATION LAYER",
      rows: [
        { k: "ORIGINALITY CHECK", v: "✓" },
        { k: "TRL", v: "" },
        { k: "PATENT MATCHES", v: "" },
        { k: "EST. VALUE", v: "" },
      ],
      note: "ตัวอย่างการแสดงผล",
    },
    fields: ["Biomaterials", "Batteries", "Catalysts", "Polymers", "Nanomaterials", "Agri-tech", "Carbon capture", "Semiconductors"],
  },
  terra: {
    label: "// 03 — PILOT PROJECT: TERRA",
    headline: { pre: "จากวัชพืชสู่ดินที่", accent: "อุดม", post: "" } as Accent,
    badge: "จุฬาลงกรณ์มหาวิทยาลัย · ห้องแล็บของ ผศ. นำพล อินสิน",
    pilot: "โครงการนำร่อง",
    states: [
      { n: "01", tag: "WASTE", body: "ผักตบชวา: วัชพืชรุกรานที่อุดตันแม่น้ำลำคลองของไทย" },
      { n: "02", tag: "BIOCHAR", body: "เผาเป็นไบโอชาร์ที่เสถียรและมีรูพรุน" },
      { n: "03", tag: "SUBSTRATE", body: "ผสานกับแบคทีเรียลเซลลูโลสจากการผลิตคอมบูชา กลายเป็นวัสดุปลูก" },
    ],
    cta: "อ่านกรณีศึกษา Terra",
    ctaHref: "/project",
  },
  gallery: {
    label: "// 04 — OPEN RESEARCH",
    headline: { pre: "งานวิจัยที่คุณ", accent: "สนับสนุน", post: "ได้" } as Accent,
    filterTitle: "คุณกำลังมองหาอะไร?",
    filters: ["ทั้งหมด", "Biomaterials", "Energy", "Agri-tech", "Nanomaterials"],
    view: "ดู",
    trl: "TRL",
    funded: "ระดมทุนแล้ว",
    sample: "รายการตัวอย่าง",
    projects: [
      { id: "terra", title: "TERRA", field: "Agri-tech", institution: "จุฬาลงกรณ์มหาวิทยาลัย", trl: "", funded: null, placeholder: false },
      { id: "p2", title: "[PROJECT NAME]", field: "Energy", institution: "[สถาบัน]", trl: "", funded: null, placeholder: true },
      { id: "p3", title: "[PROJECT NAME]", field: "Biomaterials", institution: "[สถาบัน]", trl: "", funded: null, placeholder: true },
      { id: "p4", title: "[PROJECT NAME]", field: "Nanomaterials", institution: "[สถาบัน]", trl: "", funded: null, placeholder: true },
      { id: "p5", title: "[PROJECT NAME]", field: "Energy", institution: "[สถาบัน]", trl: "", funded: null, placeholder: true },
      { id: "p6", title: "[PROJECT NAME]", field: "Biomaterials", institution: "[สถาบัน]", trl: "", funded: null, placeholder: true },
      { id: "p7", title: "[PROJECT NAME]", field: "Agri-tech", institution: "[สถาบัน]", trl: "", funded: null, placeholder: true },
    ] as ProjectCard[],
    all: "สำรวจงานวิจัยทั้งหมด",
  },
  paths: {
    label: "// 05 — JOIN",
    researchers: {
      kicker: "สำหรับนักวิจัย",
      title: { pre: "ให้งานวิจัยของคุณได้", accent: "ทุน", post: "และได้รับการประเมินมูลค่า" } as Accent,
      bullets: ["ประเมินมูลค่าด้วย AI ฟรี", "IP ที่ถูกโทเคไนซ์", "เข้าถึงผู้สนับสนุน"],
    },
    backers: {
      kicker: "สำหรับผู้สนับสนุน",
      title: { pre: "สนับสนุนวิทยาศาสตร์ที่คุณ", accent: "เชื่อ", post: "" } as Accent,
      bullets: ["Deeptech ที่คัดสรรแล้ว", "โปร่งใสบนบล็อกเชน", "แบ่งผลตอบแทนร่วมกัน"],
    },
  },
  signal: {
    label: "// 06 — SIGNAL",
    recognition: [
      "3RD RUNNER-UP · THAMMASAT STARTUP 2026",
      "STARTUP THAILAND LEAGUE 2026",
      "THAILAND REPRESENTATIVE · STARTUP PROTOCOL CAMP",
    ],
    teamTitle: "ทีม",
    team: [
      { name: "", role: "" },
      { name: "", role: "" },
      { name: "", role: "" },
      { name: "", role: "" },
    ],
    namePlaceholder: "[ชื่อ]",
    rolePlaceholder: "[ตำแหน่ง]",
  },
  finale: {
    manifesto: ["FROM ATOM", "TO ASSET"],
    manifestoNote: "MatDAO เชื่อมคนที่สร้างวัสดุใหม่ กับคนที่อยากสนับสนุนพวกเขา",
    headline: { pre: "ร่วมสร้างอนาคตของ", accent: "วัสดุ", post: "" } as Accent,
  },
  footer: {
    columns: [
      {
        title: "Product",
        links: [
          { label: "งานวิจัย", href: "/project" },
          { label: "KALDERA AI", href: "/ai-studio" },
          { label: "Tokenization", href: "/mattoken" },
        ],
      },
      {
        title: "Resources",
        links: [
          { label: "เอกสาร", href: "/guide" },
          { label: "Whitepaper", href: "" },
          { label: "บล็อก", href: "" },
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
          { label: "เกี่ยวกับเรา", href: "/why-us" },
          { label: "ติดต่อ", href: "" },
        ],
      },
    ],
    copyright: "© 2026 MatDAO",
    top: "กลับขึ้นด้านบน",
    soon: "เร็ว ๆ นี้",
  },
  a11y: {
    skip: "ข้ามไปยังเนื้อหา",
    language: "ภาษา",
    reducedMotion: "ลดการเคลื่อนไหวแล้ว",
  },
}
