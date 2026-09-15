"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { FileUp, Loader2, Shield } from "lucide-react"
import { BackendStatus } from "@/components/ai-studio/BackendStatus"
import { analyzeDocument } from "@/lib/ai-studio/api"

const SAMPLE_PAPERS: Record<string, { label: string; text: string }> = {
  biotech: {
    label: "Biotech — CRISPR gene editing",
    text: `Abstract
We present a novel CRISPR-based gene editing approach for targeted therapeutic modification in mammalian cells. Our methodology combines optimized guide RNA design with a modified Cas9 nuclease variant to achieve precise genomic edits with significantly reduced off-target effects.

Methods
Cells were transfected with plasmids encoding the Cas9 variant and synthetic guide RNAs targeting the BRCA1 locus. Off-target analysis was performed using GUIDE-seq and deep sequencing.

Results
We achieved 78% on-target editing efficiency with off-target events below 0.3%.`,
  },
  materials: {
    label: "Materials — Perovskite solar cells",
    text: `Abstract
We report a mixed-dimensional perovskite heterostructure that passivates grain boundaries in photovoltaic devices, achieving power conversion efficiency exceeding 24% under AM1.5G illumination with improved ambient stability.

Methods
Perovskite films were deposited via two-step spin coating with a 2D passivation layer applied post-annealing. J-V characteristics and stability testing were performed under controlled humidity.

Results
Champion devices reached 24.2% PCE with negligible hysteresis. Encapsulated cells retained 92% efficiency after 1000 hours at 85°C.`,
  },
  ai: {
    label: "AI/ML — Protein structure prediction",
    text: `Abstract
We introduce a transformer-based deep learning model that predicts protein tertiary structure from amino acid sequences without homologous templates, achieving competitive accuracy on CASP benchmarks using self-attention over residue pairs.

Methods
The model was trained on PDB structures using end-to-end gradient descent with a composite loss combining distogram, torsion angle, and structural violation terms. Inference runs on sequences up to 400 residues.

Results
Our model achieves median GDT-TS of 82 on CASP14 targets, outperforming previous single-sequence methods.`,
  },
  battery: {
    label: "Energy — Solid-state lithium battery",
    text: `Abstract
An all-solid-state lithium metal battery using a sulfide ceramic electrolyte achieves energy density above 400 Wh/kg at room temperature with dendrite-suppressing interfacial engineering between lithium anode and electrolyte.

Methods
Li6PS5Cl argyrodite electrolyte pellets were cold-pressed with nickel-rich NMC cathodes. Cycling was performed at 0.5C between 2.5 and 4.3 V at 25°C.

Results
Cells delivered 410 Wh/kg at cell level and retained 85% capacity after 500 cycles.`,
  },
}

export default function ValuationSubmitPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [textInput, setTextInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const runAnalysis = useCallback(
    async (uploadFile: File) => {
      setLoading(true)
      setError(null)
      try {
        const report = await analyzeDocument(uploadFile)
        sessionStorage.setItem("matdao-ip-report", JSON.stringify(report))
        router.push("/ai-studio/valuation/results")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Analysis failed")
      } finally {
        setLoading(false)
      }
    },
    [router],
  )

  const handleSubmit = async () => {
    if (file) {
      await runAnalysis(file)
      return
    }
    if (textInput.trim()) {
      const blob = new Blob([textInput], { type: "text/plain" })
      const textFile = new File([blob], "research-paper.txt", { type: "text/plain" })
      await runAnalysis(textFile)
      return
    }
    setError("Please upload a file or paste your paper text.")
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFile(dropped)
  }

  return (
    <div className="relative min-h-[70vh] px-5 py-12 sm:px-6 md:py-16">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-10%] h-[700px] w-[700px] -translate-x-1/2 rounded-full bg-cyan-300/3 blur-[140px]" />
      </div>

      <div className="workflow-panel relative z-10 mx-auto max-w-3xl rounded-2xl p-6 sm:p-8">
        <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[#c5fdff]">IP Valuation Pipeline</p>
        <h1 className="font-headline mb-2 text-2xl font-bold text-white/95 md:text-3xl">
          Upload Any Scientific Paper
        </h1>
        <p className="mb-8 text-sm text-white/60">
          Peer-reviewed papers, preprints, arXiv exports, technical reports, or patent drafts — all run through
          the same IPC classification → live prior-art search → originality verdict → FTO pipeline. The USD valuation model is currently under revision. Processed entirely in volatile memory.
        </p>

        <BackendStatus required />

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`mb-6 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
            dragOver ? "border-[#6efcff]/60 bg-[#6efcff]/5" : "border-white/20 bg-white/2"
          }`}
        >
          <FileUp className="mx-auto mb-3 h-10 w-10 text-[#6efcff]/70" />
          <p className="mb-2 text-sm text-white/80">
            {file ? file.name : "Drag & drop PDF, DOCX, or TXT"}
          </p>
          <label className="inline-block cursor-pointer text-sm text-[#6efcff] hover:underline">
            Browse files
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm text-white/70">Or paste abstract / full text</label>
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            rows={8}
            placeholder="Paste your scientific paper text here..."
            className="w-full resize-y rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white/90 placeholder:text-white/30 focus:border-[#6efcff]/40 focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(SAMPLE_PAPERS).map(([key, sample]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTextInput(sample.text)}
                className="cursor-pointer rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/60 transition-colors hover:border-[#6efcff]/30 hover:text-[#6efcff]"
              >
                {sample.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6 flex items-start gap-2 rounded-lg border border-white/10 bg-white/3 px-4 py-3">
          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[#6efcff]" />
          <p className="text-xs text-white/55">
            Zero-persistence processing. Metadata stripped before any LLM FTO calls. Final report is
            cryptographically signed for Web3 oracle handoff.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-[#6efcff]/40 bg-[#6efcff]/15 text-sm font-semibold text-[#c5fdff] transition-colors hover:bg-[#6efcff]/25 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Running 4-layer analysis...
            </>
          ) : (
            "Run IP Valuation & FTO Analysis"
          )}
        </button>
      </div>
    </div>
  )
}
