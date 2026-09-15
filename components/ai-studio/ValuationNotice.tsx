"use client"

import { Construction } from "lucide-react"
import type { AnalysisReport } from "@/lib/ai-studio/types"

/** True when the backend explicitly says its valuation numbers should not be shown. */
export function isValuationUnavailable(valuation: AnalysisReport["valuation"] | undefined | null): boolean {
  return !!valuation && valuation.valuation_available === false
}

interface ValuationNoticeProps {
  valuation?: AnalysisReport["valuation"] | null
  className?: string
}

/** Shown in place of $0 tiles while the valuation methodology is being redone. */
export function ValuationNotice({ valuation, className = "" }: ValuationNoticeProps) {
  if (!isValuationUnavailable(valuation)) return null
  return (
    <div className={`flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 ${className}`}>
      <Construction className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
      <div>
        <p className="text-sm font-semibold text-amber-100">Valuation model under revision</p>
        <p className="mt-1 text-xs leading-relaxed text-amber-100/75">
          {valuation?.valuation_message?.trim() ||
            "The IP Engine is not returning a USD valuation while the methodology is being rebuilt. No dollar figure is shown rather than a placeholder."}
          {valuation?.valuation_status ? <span className="ml-1 font-mono text-[11px] text-amber-100/60">({valuation.valuation_status})</span> : null}
        </p>
      </div>
    </div>
  )
}
