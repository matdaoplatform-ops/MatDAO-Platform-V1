"use client"

import { Quote } from "lucide-react"
import type { EvidenceQuote } from "@/lib/ai-studio/types"

interface EvidenceQuotesProps {
  quotes?: EvidenceQuote[] | null
  title?: string
  emptyText?: string
  limit?: number
  className?: string
}

/** Verbatim quotes the engine cited from the submitted document, with location and what they support. */
export function EvidenceQuotes({ quotes, title = "Evidence from the document", emptyText, limit = 8, className = "" }: EvidenceQuotesProps) {
  const list = (quotes ?? []).filter((q) => q && typeof q.quote === "string" && q.quote.trim()).slice(0, limit)
  if (list.length === 0) {
    if (!emptyText) return null
    return (
      <div className={`rounded-xl border border-white/10 bg-black/20 p-4 ${className}`}>
        <p className="text-xs text-white/45">{emptyText}</p>
      </div>
    )
  }
  return (
    <div className={`rounded-xl border border-white/10 bg-black/20 p-4 ${className}`}>
      <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/60">
        <Quote className="h-3.5 w-3.5 text-[#6efcff]" />
        {title}
      </p>
      <ul className="space-y-3">
        {list.map((q, i) => (
          <li key={i} className="border-l-2 border-[#6efcff]/40 pl-3">
            <p className="text-sm italic leading-relaxed text-white/80">“{q.quote.trim()}”</p>
            <p className="mt-1 text-[11px] text-white/45">
              {q.location ? <span className="font-mono">{q.location}</span> : null}
              {q.location && q.supports ? " · " : null}
              {q.supports ? <span>supports: {q.supports}</span> : null}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
