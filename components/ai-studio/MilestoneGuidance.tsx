"use client"

import type { Milestone } from "@/lib/trl-services/types"

interface MilestoneGuidanceProps {
  milestone: Milestone
  isCurrent: boolean
  trl: number
  /** `missing_for_next_trl` from the engine — only relevant for the current milestone. */
  missingForNextTrl?: string[]
}

/**
 * WHAT / WHY / HOW for a milestone. Derived from the engine's own
 * `specific_actions` / `missing_for_next_trl` / `resources_needed` when an
 * LLM produced them; otherwise clearly labelled as a generic template.
 */
export function MilestoneGuidance({ milestone, isCurrent, trl, missingForNextTrl }: MilestoneGuidanceProps) {
  const actions = milestone.specific_actions ?? []
  const resources = milestone.resources_needed ?? []
  const missing = missingForNextTrl ?? []
  const hasEngineDetail = actions.length > 0 || missing.length > 0 || resources.length > 0

  const what = actions.length > 0
    ? actions.slice(0, 3).join(" · ")
    : milestone.description
  const why = missing.length > 0
    ? `To reach TRL ${Math.min(9, trl + 1)} the engine flagged: ${missing.slice(0, 2).join("; ")}`
    : isCurrent
      ? `This is the gate between TRL ${trl} and TRL ${Math.min(9, trl + 1)}.`
      : "Builds on the preceding milestone; required before scale-up."
  const how = resources.length > 0
    ? `Needs: ${resources.slice(0, 4).join(", ")}${actions.length > 3 ? ` · then ${actions.slice(3, 5).join("; ")}` : ""}`
    : isCurrent
      ? "Run the experiments, record the data, and submit proof via the AI Auditor for verification."
      : "Plan requirements, secure resources and partners, set a timeline."

  return (
    <div className="mt-5 -mx-6 border-t border-white/10 px-6 pt-5">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wider text-white/45">What / why / how</p>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] ${hasEngineDetail ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-white/10 bg-white/5 text-white/45"}`}>
          {hasEngineDetail ? "from the engine's assessment" : "generic template — no engine detail for this milestone"}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-black/30 p-4 backdrop-blur-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#6efcff]">WHAT</p>
          <p className="text-sm leading-relaxed text-white/60">{what}</p>
        </div>
        <div className="rounded-xl bg-black/30 p-4 backdrop-blur-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#6efcff]">WHY</p>
          <p className="text-sm leading-relaxed text-white/60">{why}</p>
        </div>
        <div className="rounded-xl bg-black/30 p-4 backdrop-blur-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#6efcff]">HOW</p>
          <p className="text-sm leading-relaxed text-white/60">{how}</p>
        </div>
      </div>
    </div>
  )
}
