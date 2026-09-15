"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react"
import type { AnalysisReport } from "@/lib/ai-studio/types"

type OverlapRow = AnalysisReport["fto"]["overlap_matrix"][number]

interface FtoOverlapTableProps {
  rows: OverlapRow[]
  limit?: number
  className?: string
}

const SOURCE_LABELS: Record<string, string> = {
  google_patents: "Google Patents",
  lens: "Lens",
  matdao_local_corpus: "MatDAO sample corpus",
  uspto: "USPTO",
}

/** Top patent matches with overlap ratio, flagged/missing claim elements, evidence quotes and design-around notes. */
export function FtoOverlapTable({ rows, limit = 5, className = "" }: FtoOverlapTableProps) {
  const [open, setOpen] = useState<string | null>(null)
  const list = (rows ?? []).slice(0, limit)
  if (list.length === 0) {
    return <p className={`text-xs text-white/45 ${className}`}>No patent overlap rows returned by the FTO pipeline.</p>
  }
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full min-w-[600px] text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-white/45">
            <th className="pb-3 pr-4">Patent</th>
            <th className="pb-3 pr-4">Source</th>
            <th className="pb-3 pr-4">Similarity</th>
            <th className="pb-3 pr-4">Overlap</th>
            <th className="pb-3">Flagged elements</th>
          </tr>
        </thead>
        <tbody>
          {list.map((row, i) => {
            const key = `${row.patent_id || "row"}-${i}`
            const hasDetail = (row.missing_elements?.length ?? 0) > 0 || (row.evidence_quotes?.length ?? 0) > 0 || !!row.design_around
            const isOpen = open === key
            return (
              <FragmentRow key={key}>
                <tr className="border-b border-white/5 align-top">
                  <td className="py-3 pr-4">
                    {row.url ? (
                      <a href={row.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-white/85 hover:text-[#c5fdff]">
                        {row.patent_id || "—"}
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      </a>
                    ) : (
                      <p className="font-mono text-xs text-white/80">{row.patent_id || "—"}</p>
                    )}
                    <p className="max-w-[240px] truncate text-xs text-white/45" title={row.title}>{row.title}</p>
                    {hasDetail && (
                      <button
                        type="button"
                        onClick={() => setOpen(isOpen ? null : key)}
                        className="mt-1 inline-flex items-center gap-1 text-[11px] text-[#c5fdff]/80 hover:text-[#c5fdff]"
                      >
                        {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {isOpen ? "Hide detail" : "Show detail"}
                      </button>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-xs text-white/55">{SOURCE_LABELS[row.source ?? ""] ?? (row.source ?? "—").replace(/_/g, " ")}</td>
                  <td className="py-3 pr-4 text-white/70">{(row.cosine_similarity * 100).toFixed(1)}%</td>
                  <td className="py-3 pr-4">
                    <span className={row.structural_overlap ? "text-amber-300" : "text-white/60"}>
                      {(row.overlap_ratio * 100).toFixed(1)}%{row.structural_overlap && " ⚠"}
                    </span>
                  </td>
                  <td className="py-3 text-xs text-white/50">{row.flagged_elements?.slice(0, 4).join(", ") || "—"}</td>
                </tr>
                {isOpen && (
                  <tr className="border-b border-white/5 bg-black/20">
                    <td colSpan={5} className="px-2 py-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        {(row.missing_elements?.length ?? 0) > 0 && (
                          <div>
                            <p className="mb-1 text-[11px] uppercase tracking-wider text-emerald-200/70">Elements the patent lacks (your differentiation)</p>
                            <ul className="space-y-0.5 text-xs text-white/70">
                              {row.missing_elements!.map((m, j) => <li key={j}>· {m}</li>)}
                            </ul>
                          </div>
                        )}
                        {row.design_around && (
                          <div>
                            <p className="mb-1 text-[11px] uppercase tracking-wider text-[#c5fdff]/70">Design-around</p>
                            <p className="text-xs leading-relaxed text-white/70">{row.design_around}</p>
                          </div>
                        )}
                        {(row.evidence_quotes?.length ?? 0) > 0 && (
                          <div className="md:col-span-2">
                            <p className="mb-1 text-[11px] uppercase tracking-wider text-white/50">Evidence quotes</p>
                            <ul className="space-y-1">
                              {row.evidence_quotes!.slice(0, 4).map((q, j) => (
                                <li key={j} className="border-l-2 border-[#6efcff]/40 pl-2 text-xs italic text-white/70">
                                  “{q.quote}”{q.location ? <span className="not-italic text-white/40"> — {q.location}</span> : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </FragmentRow>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
