"use client"

import { useCallback, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { FileUp, Loader2, FileText, X } from "lucide-react"
import { BackendStatus } from "@/components/ai-studio/BackendStatus"
import { runCombinedAssessment } from "@/lib/trl-services/combined-report"
import { useAuth } from "@/context/auth-context"
import { loadUserData } from "@/lib/trl-services/storage"
import type { CombinedAssessmentReport } from "@/lib/trl-services/types"

export default function ProjectAssessmentSubmitPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [title, setTitle] = useState("")
  const [author, setAuthor] = useState("")
  const [category, setCategory] = useState("Deep Tech")
  const [textContent, setTextContent] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [proposalFile, setProposalFile] = useState<File | null>(null)
  const [pitchdeckFile, setPitchdeckFile] = useState<File | null>(null)
  const [financialsFile, setFinancialsFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [userTrl, setUserTrl] = useState("")
  const [useUserTrl, setUseUserTrl] = useState(false)
  const [savedReports, setSavedReports] = useState<CombinedAssessmentReport[]>([])
  const [showSavedReports, setShowSavedReports] = useState(false)

  useEffect(() => {
    if (user) {
      const userData = loadUserData(user.id)
      setSavedReports(userData.assessments || [])
    }
  }, [user])

  const loadSavedReport = (report: CombinedAssessmentReport) => {
    setTitle(report.title)
    setAuthor(report.author || "")
    setCategory(report.category || "Deep Tech")
    // Note: textContent is not stored in the report, so we'll leave it empty
    setTextContent("")
    setShowSavedReports(false)
  }

  const runAssessment = useCallback(async () => {
    if (!title.trim() || (!textContent.trim() && !file)) {
      setError("Provide a title and abstract text or upload a file.")
      return
    }
    
    // Validate PDF file if uploaded
    if (file && file.type === "application/pdf") {
      const fileSizeMB = file.size / (1024 * 1024)
      if (fileSizeMB > 15) {
        setError("PDF file is too large (the IP Engine accepts up to 15 MB). Please use a smaller file or paste the text content directly.")
        return
      }
      
      // Check if PDF might be corrupted by trying to read first few bytes
      try {
        const header = await file.slice(0, 4).arrayBuffer()
        const headerView = new Uint8Array(header)
        // PDF files should start with %PDF
        if (String.fromCharCode(headerView[0], headerView[1], headerView[2], headerView[3]) !== '%PDF') {
          setError("The uploaded file doesn't appear to be a valid PDF. Please try a different file or paste the text content directly.")
          return
        }
      } catch (e) {
        // If we can't read the header, still try to proceed but warn user
        console.warn("Could not validate PDF header, proceeding anyway")
      }
    }
    
    const parsedTrl = useUserTrl ? parseInt(userTrl, 10) : NaN
    if (useUserTrl && !(parsedTrl >= 1 && parsedTrl <= 9)) {
      setError("Select your current TRL level (1–9) or untick the checkbox.")
      return
    }

    setLoading(true)
    setError(null)
    try {
      // The uploaded file is sent as-is; pasted text is only used as text.
      // (PDF bytes are never read as text on the client.)
      const report = await runCombinedAssessment({
        title,
        author,
        category,
        textContent,
        file,
        proposalFile,
        pitchdeckFile,
        financialsFile,
        userTrl: useUserTrl ? parsedTrl : undefined,
      })

      sessionStorage.setItem("matdao-combined-report", JSON.stringify(report))
      router.push("/ai-studio/project-assessment/results")
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Assessment failed"
      if (/extract|image-based|no extractable text|OCR/i.test(errorMessage)) {
        setError(`${errorMessage} — this PDF may be image-only or corrupted. Try pasting the text directly.`)
      } else {
        setError(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }, [title, author, category, textContent, file, proposalFile, pitchdeckFile, financialsFile, router, useUserTrl, userTrl])

  return (
    <div className="relative px-5 py-12 sm:px-6">
      <div className="relative z-10 mx-auto max-w-3xl">
        <h1 className="font-headline mb-2 text-2xl font-bold text-white/95">Submit for Assessment</h1>
        <p className="mb-6 text-sm text-white/60">
          One upload runs all three tools via a single matdao-ip-engine analysis.
        </p>

        <div className="mb-6">
          <BackendStatus />
        </div>

        <div className="workflow-panel space-y-4 rounded-2xl p-6">
          {/* Load Saved Reports Button */}
          {savedReports.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSavedReports(!showSavedReports)}
                className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white hover:border-[#6efcff]/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#6efcff]" />
                  <span>Load from saved reports ({savedReports.length})</span>
                </div>
                {showSavedReports ? <X className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
              </button>
              
              {showSavedReports && (
                <div className="absolute z-50 mt-2 w-full rounded-lg border border-white/10 bg-black/90 backdrop-blur-xl shadow-xl">
                  <div className="max-h-60 overflow-y-auto">
                    {savedReports.map((report) => (
                      <button
                        key={report.id}
                        type="button"
                        onClick={() => loadSavedReport(report)}
                        className="w-full border-b border-white/5 px-4 py-3 text-left hover:bg-white/5 transition-colors last:border-0"
                      >
                        <div className="text-sm font-medium text-white">{report.title}</div>
                        <div className="mt-1 text-xs text-white/50">
                          TRL {report.summary.trl} · {new Date(report.createdAt).toLocaleDateString()}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <input
            className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white placeholder:text-white/30"
            placeholder="Project title *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white placeholder:text-white/30"
            placeholder="Author / Institution"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />
          <select
            className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option>Deep Tech</option>
            <option>Energy Storage</option>
            <option>Carbon Capture</option>
            <option>AI Materials</option>
            <option>Biomaterials</option>
            <option>Advanced Materials</option>
          </select>

          <div
            className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              dragOver ? "border-[#6efcff]/50 bg-[#6efcff]/5" : "border-white/15 bg-black/20"
            }`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              const f = e.dataTransfer.files[0]
              if (f) setFile(f)
            }}
          >
            <FileUp className="mx-auto mb-2 h-8 w-8 text-white/40" />
            <p className="text-sm text-white/60">Drop PDF, DOCX, TXT or MD (optional if pasting below)</p>
            {file && <p className="mt-2 text-xs text-[#c5fdff]">{file.name}</p>}
            <input
              type="file"
              accept=".pdf,.docx,.txt,.md"
              className="mt-3 text-xs text-white/50"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>

          <textarea
            className="min-h-[200px] w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/30"
            placeholder="Paste abstract or scientific content *"
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
          />

          {/* Additional Document Uploads */}
          <div className="space-y-4 pt-4 border-t border-white/10">
            <p className="text-xs font-semibold text-white/70 uppercase tracking-wider">Additional Documents (Optional)</p>
            <p className="text-xs text-white/45">Sent to the engine as supporting files and read alongside the main document (PDF, DOCX, TXT, MD, PPTX, CSV, XLSX · max 10 MB each).</p>
            
            <div className="rounded-xl border border-white/15 bg-black/20 p-4">
              <label className="text-sm text-white/80 mb-2 block">Proposal Document</label>
              <input
                type="file"
                accept=".pdf,.docx,.txt,.md"
                className="text-xs text-white/50"
                onChange={(e) => setProposalFile(e.target.files?.[0] || null)}
              />
              {proposalFile && <p className="mt-1 text-xs text-[#c5fdff]">{proposalFile.name}</p>}
            </div>

            <div className="rounded-xl border border-white/15 bg-black/20 p-4">
              <label className="text-sm text-white/80 mb-2 block">Pitch Deck</label>
              <input
                type="file"
                accept=".pdf,.pptx"
                className="text-xs text-white/50"
                onChange={(e) => setPitchdeckFile(e.target.files?.[0] || null)}
              />
              {pitchdeckFile && <p className="mt-1 text-xs text-[#c5fdff]">{pitchdeckFile.name}</p>}
            </div>

            <div className="rounded-xl border border-white/15 bg-black/20 p-4">
              <label className="text-sm text-white/80 mb-2 block">Financials / Projections</label>
              <input
                type="file"
                accept=".pdf,.xlsx,.csv"
                className="text-xs text-white/50"
                onChange={(e) => setFinancialsFile(e.target.files?.[0] || null)}
              />
              {financialsFile && <p className="mt-1 text-xs text-[#c5fdff]">{financialsFile.name}</p>}
            </div>
          </div>

          {/* Optional User TRL Input */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="useUserTrl"
              checked={useUserTrl}
              onChange={(e) => setUseUserTrl(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-black/30 text-[#6efcff] focus:ring-[#6efcff]"
            />
            <label htmlFor="useUserTrl" className="text-sm text-white/70">
              I know my current TRL level <span className="text-white/40">(sent as self-reported; the engine reports the gap to its evidence-based estimate)</span>
            </label>
          </div>
          {useUserTrl && (
            <div className="flex items-center gap-3">
              <select
                className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white"
                value={userTrl}
                onChange={(e) => setUserTrl(e.target.value)}
              >
                <option value="">Select TRL Level</option>
                <option value="1">TRL 1 - Basic principles observed</option>
                <option value="2">TRL 2 - Technology concept formulated</option>
                <option value="3">TRL 3 - Experimental proof of concept</option>
                <option value="4">TRL 4 - Technology validated in lab</option>
                <option value="5">TRL 5 - Technology validated in relevant environment</option>
                <option value="6">TRL 6 - Technology demonstrated in relevant environment</option>
                <option value="7">TRL 7 - Technology demonstrated in operational environment</option>
                <option value="8">TRL 8 - System complete and qualified</option>
                <option value="9">TRL 9 - System proven in operational environment</option>
              </select>
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="button"
            onClick={runAssessment}
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#6efcff]/20 py-3 text-sm font-semibold text-[#c5fdff] hover:bg-[#6efcff]/30 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Running full assessment...
              </>
            ) : (
              "Generate Detailed Report"
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
