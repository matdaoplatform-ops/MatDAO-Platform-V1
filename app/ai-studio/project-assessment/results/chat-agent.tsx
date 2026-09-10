"use client"

import { useEffect, useRef, useState } from "react"
import { AlertCircle, Loader2, Send, Sparkles } from "lucide-react"
import { askReportAssistant, type ChatTurn } from "@/lib/ai-studio/api"
import type { CombinedAssessmentReport } from "@/lib/trl-services/types"

interface ChatAgentProps {
  report: CombinedAssessmentReport
}

interface Message extends ChatTurn {
  timestamp: Date
  error?: boolean
}

const SUGGESTIONS = [
  "Why this TRL?",
  "What prior art overlaps most?",
  "What evidence is missing?",
  "Summarise the risks",
]

/**
 * Report-grounded assistant. Every reply comes from /api/ai-studio/chat,
 * which calls an LLM with the report JSON as context. If no server-side LLM
 * key is configured the panel says so — it never fakes an answer.
 */
export function ChatAgent({ report }: ChatAgentProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [unavailable, setUnavailable] = useState<string | null>(null)
  const [modelLabel, setModelLabel] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, isLoading])

  async function send(text: string) {
    const content = text.trim()
    if (!content || isLoading) return

    const userMessage: Message = { role: "user", content, timestamp: new Date() }
    const history: ChatTurn[] = [...messages.filter((m) => !m.error), userMessage].map(({ role, content }) => ({ role, content }))
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      // Send the engine report (the part with the evidence), not the whole session object.
      const context = {
        title: report.title,
        author: report.author,
        category: report.category,
        summary: report.summary,
        provenance: report.provenance,
        trl_project: report.trlProject,
        due_diligence: report.dueDiligenceReport,
        engine_report: report.ipReport,
      }
      const res = await askReportAssistant(context, history)
      if (!res.available) {
        setUnavailable(res.detail ?? "AI chat unavailable — no LLM key configured.")
        setMessages((prev) => prev.filter((m) => m !== userMessage))
        return
      }
      if (res.reply) {
        if (res.provider) setModelLabel([res.provider, res.model].filter(Boolean).join(" / "))
        setMessages((prev) => [...prev, { role: "assistant", content: res.reply!, timestamp: new Date() }])
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: res.detail ?? "The model returned no reply.", timestamp: new Date(), error: true }])
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: error instanceof Error ? error.message : "Chat request failed.", timestamp: new Date(), error: true },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void send(input)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl">
      <div className="border-b border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#6efcff]/30 bg-[#6efcff]/20">
            <Sparkles className="h-5 w-5 text-[#c5fdff]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white/90">Ask about this report</h3>
            <p className="truncate text-xs text-white/50">
              {modelLabel ? `Answers from ${modelLabel}, grounded in the report JSON` : "Answers are generated from the report JSON by an LLM"}
            </p>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {unavailable && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-xs text-amber-100">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <span>{unavailable}</span>
          </div>
        )}
        {!unavailable && messages.length === 0 && (
          <p className="text-xs leading-relaxed text-white/50">
            Ask why the engine assigned this TRL, which prior art it found closest, what evidence is missing, or what the warnings mean.
            Replies cite report fields; if something is not in the report the assistant will say so.
          </p>
        )}
        {messages.map((message, index) => (
          <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                message.role === "user"
                  ? "bg-gradient-to-r from-[#6efcff] to-[#a78bfa] text-black"
                  : message.error
                    ? "border border-red-500/40 bg-red-500/10 text-red-100"
                    : "bg-white/10 text-white/90"
              }`}
            >
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
              <p className="mt-1 text-[10px] opacity-60">
                {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-white/60" />
                <p className="text-sm text-white/60">Reading the report…</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-white/10 bg-white/5 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={unavailable ? "AI chat unavailable" : "Ask about the analysis…"}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition-all placeholder:text-white/30 focus:border-[#6efcff] focus:outline-none focus:ring-1 focus:ring-[#6efcff]/40 disabled:opacity-50"
            disabled={isLoading || !!unavailable}
          />
          <button
            type="button"
            onClick={() => void send(input)}
            disabled={isLoading || !input.trim() || !!unavailable}
            className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#6efcff] to-[#a78bfa] px-4 py-3 text-sm font-semibold text-black transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Send"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        {!unavailable && (
          <div className="mt-2 flex flex-wrap gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => void send(suggestion)}
                disabled={isLoading}
                className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/50 transition-colors hover:border-[#6efcff]/30 hover:text-[#c5fdff] disabled:opacity-40"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
