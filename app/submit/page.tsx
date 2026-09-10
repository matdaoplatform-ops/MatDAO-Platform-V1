"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Beaker } from "lucide-react"
import toast from "react-hot-toast"
import { supabase } from "@/lib/supabase/client"
import type { ProjectDocument } from "@/lib/supabase/client"
import { notifySubmission } from "@/lib/supabase/notify"
import { DOCUMENTS_BUCKET } from "@/lib/supabase/storage"
import { useAuth } from "@/context/auth-context"
import { useDemoMode } from "@/components/demo-mode"
import { RequireAuth } from "@/components/auth/require-auth"
import { MultiStepForm, FILE_LIMITS, type SubmissionFormData, type FileField } from "@/components/submit/multi-step-form"

const FUNDING_GOALS: [string, number][] = [
  ["< $10,000", 10000],
  ["$10,000 - $50,000", 50000],
  ["$50,000 - $100,000", 100000],
  ["$100,000 - $250,000", 250000],
  ["> $250,000", 500000],
]

function fundingGoalFromRange(range: string): number {
  const match = FUNDING_GOALS.find(([label]) => range.includes(label))
  return match ? match[1] : 50000
}

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
  return `${base || "project"}-${Date.now().toString(36)}`
}

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-120)
}

const DEMO_DATA: Partial<SubmissionFormData> = {
  title: "Graphene-Based Supercapacitor for Grid Storage",
  institution: "MIT",
  email: "researcher@mit.edu",
  workingField: "Energy Storage",
  trl: 5,
  targetAudience: "Electric vehicle manufacturers, data centers, renewable energy providers",
  painPoints: "Slow charging times, energy loss during transmission, high costs of current battery technology",
  marketSize: "$50B global market by 2030",
  businessModel: "Licensing to manufacturers, direct sales for specialized applications, service contracts",
  fundingNeeded: "$100,000 - $250,000",
  partnerNeeded: "Industry Partner",
  license: "University License",
  milestones: "Proof of Concept (6 months), Prototype (12 months), Pilot (18 months), Commercialization (24 months)",
  timeline:
    "6 months for PoC validation, 12 months for prototype development, 18 months for pilot deployment, 24 months for commercial launch",
}

function SubmitProjectContent() {
  const { user } = useAuth()
  const router = useRouter()
  const { isEnabled: demoMode } = useDemoMode()
  const [progress, setProgress] = useState<string | null>(null)

  const initialData = useMemo<Partial<SubmissionFormData>>(
    () => ({
      institution: user?.university ?? "",
      email: user?.email ?? "",
    }),
    [user?.university, user?.email],
  )

  const handleSubmit = async (formData: SubmissionFormData) => {
    if (!user) throw new Error("Please sign in to submit a project")

    setProgress("Saving project…")
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        title: formData.title.trim(),
        slug: slugify(formData.title),
        researcher_id: user.id,
        trl: formData.trl,
        phase: "submitted",
        status: "pending_review",
        funding_goal: fundingGoalFromRange(formData.fundingNeeded),
        funding_raised: 0,
        institution: formData.institution.trim(),
        working_field: formData.workingField,
        submitter_email: formData.email.trim(),
        description: [
          { key: "institution", value: formData.institution },
          { key: "email", value: formData.email },
          { key: "workingField", value: formData.workingField },
          { key: "partnerNeeded", value: formData.partnerNeeded },
          { key: "license", value: formData.license },
          { key: "fundingNeeded", value: formData.fundingNeeded },
          { key: "targetAudience", value: formData.targetAudience },
          { key: "painPoints", value: formData.painPoints },
          { key: "marketSize", value: formData.marketSize },
        ],
        technical_specs: [
          { key: "businessModel", value: formData.businessModel },
          { key: "milestones", value: formData.milestones },
          { key: "timeline", value: formData.timeline },
        ],
        market_applications: [],
        development_timeline: [],
        team: [],
        risk_factors: [],
        competitive_advantage: [],
        ip_status: { type: "", status: "", details: "" },
        documents: [],
      })
      .select("id")
      .single()

    if (projectError || !project) {
      throw new Error(projectError?.message || "Could not save your project. Please try again.")
    }

    // Upload documents to the private bucket under <uid>/<projectId>/…
    const uploads: { kind: FileField; file: File }[] = (["pitchDeck", "prototype", "additionalDocs"] as const)
      .map((kind) => ({ kind, file: formData[kind] }))
      .filter((u): u is { kind: FileField; file: File } => u.file instanceof File)

    const documents: ProjectDocument[] = []
    const failed: string[] = []
    for (const [index, { kind, file }] of uploads.entries()) {
      if (file.size > FILE_LIMITS[kind].maxBytes) {
        failed.push(`${file.name} (too large)`)
        continue
      }
      setProgress(`Uploading ${index + 1}/${uploads.length}: ${file.name}`)
      const path = `${user.id}/${project.id}/${kind}-${safeFileName(file.name)}`
      const { error: uploadError } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      })
      if (uploadError) {
        console.error("Upload failed:", uploadError.message)
        failed.push(file.name)
        continue
      }
      documents.push({ name: file.name, path, size: file.size, type: file.type, kind })
    }

    if (documents.length > 0) {
      const { error: docError } = await supabase.from("projects").update({ documents }).eq("id", project.id)
      if (docError) console.error("Could not record documents:", docError.message)
    }
    if (failed.length > 0) {
      toast.error(`Project saved, but ${failed.length} file(s) could not be uploaded: ${failed.join(", ")}`, {
        duration: 8000,
      })
    }

    // Notify staff (row + email). Never blocks the submission.
    setProgress("Notifying reviewers…")
    const notify = await notifySubmission({ type: "project_submitted", projectId: project.id })
    if (notify.emailed === false && notify.reason && process.env.NODE_ENV !== "production") {
      console.info("[submit] email not sent:", notify.reason)
    }

    setProgress(null)
    toast.success("Project submitted for review")
    router.push(`/submit/success?projectId=${project.id}`)
  }

  return (
    <div className="flex flex-col">
      <section className="border-b border-white/10 bg-black/40 backdrop-blur-sm px-4 py-14">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#6efcff]/30 bg-[#6efcff]/10">
            <Beaker className="h-6 w-6 text-[#c5fdff]" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white/95 md:text-4xl">Submit Your Innovation</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
            Guide your research through the MatDAO protocol. Our multi-step process helps us match your project with
            the right funding and milestone structure. Submissions are reviewed by the TTO team before going live.
          </p>
        </div>
      </section>

      <section className="px-4 py-12">
        <div className="mx-auto w-full max-w-4xl">
          <MultiStepForm
            onSubmit={handleSubmit}
            demoMode={demoMode}
            demoData={DEMO_DATA}
            initialData={initialData}
            progressLabel={progress}
          />
        </div>
      </section>
    </div>
  )
}

export default function SubmitProjectPage() {
  return (
    <RequireAuth mode="prompt">
      <SubmitProjectContent />
    </RequireAuth>
  )
}
