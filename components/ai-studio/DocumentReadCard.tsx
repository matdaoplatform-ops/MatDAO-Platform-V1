"use client"

import { BookOpen, FileText, Layers, Users, Building2, Tag, Paperclip } from "lucide-react"
import type { AnalysisReport, DocumentProfile } from "@/lib/ai-studio/types"

interface DocumentReadCardProps {
  profile?: DocumentProfile | null
  stats?: AnalysisReport["document_stats"] | null
  className?: string
}

function qualityTone(q: number): { label: string; cls: string } {
  if (q >= 0.8) return { label: "Good", cls: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" }
  if (q >= 0.5) return { label: "Partial", cls: "text-amber-200 border-amber-500/30 bg-amber-500/10" }
  return { label: "Poor", cls: "text-red-200 border-red-500/30 bg-red-500/10" }
}

/**
 * "Document read" card — proves the engine actually parsed the upload:
 * pages, words, sections detected, extraction quality with reasons,
 * authors/institutions, keywords, and which supporting files were included.
 */
export function DocumentReadCard({ profile, stats, className = "" }: DocumentReadCardProps) {
  if (!profile) return null

  const quality = typeof profile.extraction_quality === "number" ? profile.extraction_quality : profile.parsing_confidence
  const tone = qualityTone(quality ?? 0)
  const sections = profile.sections_found ?? []
  const supporting = profile.submitted_metadata?.supporting_files ?? []

  return (
    <section className={`workflow-panel rounded-2xl border border-white/10 p-6 ${className}`}>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="rounded-xl bg-[#6efcff]/15 p-2.5">
          <BookOpen className="h-5 w-5 text-[#c5fdff]" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-headline text-lg font-bold text-white/95">Document read</h2>
          <p className="truncate text-xs text-white/50">
            {profile.title || "Untitled"} · {profile.document_type?.replace(/_/g, " ") || "document"}
            {profile.extraction_method ? ` · extracted with ${profile.extraction_method}` : ""}
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone.cls}`}>
          Extraction {tone.label} · {Math.round((quality ?? 0) * 100)}%
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={<FileText className="h-4 w-4" />} label="Pages" value={profile.page_count != null ? String(profile.page_count) : "—"} />
        <Stat icon={<FileText className="h-4 w-4" />} label="Words" value={profile.word_count?.toLocaleString() ?? "—"} />
        <Stat icon={<Layers className="h-4 w-4" />} label="Sections" value={String(sections.length)} />
        <Stat
          icon={<Tag className="h-4 w-4" />}
          label="Structure"
          value={[profile.has_abstract ? "abstract" : null, profile.has_claims ? `${profile.claims_count ?? 0} claims` : null].filter(Boolean).join(" · ") || "no abstract / claims"}
          small
        />
      </div>

      {sections.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[11px] uppercase tracking-wider text-white/45">Sections detected</p>
          <div className="flex flex-wrap gap-1.5">
            {sections.map((s) => (
              <span key={s} className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/70">{s}</span>
            ))}
          </div>
        </div>
      )}

      {(profile.extraction_quality_reasons?.length ?? 0) > 0 && (
        <div className={`mt-4 rounded-xl border p-3 ${tone.cls}`}>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider opacity-80">Extraction notes</p>
          <ul className="space-y-0.5 text-xs opacity-90">
            {profile.extraction_quality_reasons!.map((r, i) => (
              <li key={i}>· {r}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-white/45">
            <Users className="h-3.5 w-3.5" /> Authors
          </p>
          <p className="text-sm text-white/75">{profile.authors?.length ? profile.authors.join(", ") : "None extracted"}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-white/45">
            <Building2 className="h-3.5 w-3.5" /> Institutions
          </p>
          <p className="text-sm text-white/75">{profile.institutions?.length ? profile.institutions.join(", ") : "None extracted"}</p>
        </div>
      </div>

      {(profile.keywords?.length ?? 0) > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[11px] uppercase tracking-wider text-white/45">Keywords found in text</p>
          <div className="flex flex-wrap gap-1.5">
            {profile.keywords!.slice(0, 14).map((k) => (
              <span key={k} className="rounded-full border border-[#6efcff]/20 bg-[#6efcff]/5 px-2 py-0.5 text-xs text-[#c5fdff]/85">{k}</span>
            ))}
          </div>
        </div>
      )}

      {(supporting.length > 0 || (stats && (stats.supporting_context_chars ?? 0) > 0)) && (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-white/45">
            <Paperclip className="h-3.5 w-3.5" /> Supporting files read
          </p>
          <p className="text-sm text-white/75">
            {supporting.length ? supporting.join(", ") : "—"}
            {stats?.supporting_context_chars ? <span className="text-white/45"> · {stats.supporting_context_chars.toLocaleString()} chars added to the LLM context</span> : null}
          </p>
        </div>
      )}

      {stats && (
        <p className="mt-4 font-mono text-[11px] text-white/35">
          abstract {stats.abstract_chars.toLocaleString()} · methods {stats.methodology_chars.toLocaleString()} · outcomes {stats.claims_chars.toLocaleString()} chars
          {typeof stats.full_text_chars === "number" ? ` · full text ${stats.full_text_chars.toLocaleString()}` : ""}
          {typeof stats.llm_context_chars === "number" && stats.llm_context_chars > 0 ? ` · ${stats.llm_context_chars.toLocaleString()} chars sent to the LLM` : ""}
        </p>
      )}
    </section>
  )
}

function Stat({ icon, label, value, small }: { icon: React.ReactNode; label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-white/45">
        {icon} {label}
      </p>
      <p className={`${small ? "text-xs" : "font-headline text-xl"} font-semibold text-white/90`}>{value}</p>
    </div>
  )
}
