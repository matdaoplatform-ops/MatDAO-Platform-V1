"use client"

import { useState, useEffect, useRef } from "react"
import { Upload, FileText, Video, ChevronRight, ChevronLeft, Check, Sparkles, AlertCircle, X } from "lucide-react"

interface Step {
  id: number
  title: string
  description: string
}

const STEPS: Step[] = [
  { id: 1, title: "Innovation", description: "Project details & TRL" },
  { id: 2, title: "Market", description: "Target audience & pain points" },
  { id: 3, title: "Business", description: "Model & funding needs" },
  { id: 4, title: "Roadmap", description: "Milestones & timeline" },
  { id: 5, title: "Uploads", description: "Pitch deck & documents" },
]

export interface SubmissionFormData {
  // Step 1: Innovation
  title: string
  institution: string
  email: string
  workingField: string
  trl: number
  
  // Step 2: Market
  targetAudience: string
  painPoints: string
  marketSize: string
  
  // Step 3: Business
  businessModel: string
  fundingNeeded: string
  partnerNeeded: string
  license: string
  
  // Step 4: Roadmap
  milestones: string
  timeline: string
  
  // Step 5: Uploads
  pitchDeck: File | null
  prototype: File | null
  additionalDocs: File | null
}

/** Alias kept for readability inside this file. */
type FormData = SubmissionFormData

export type FileField = "pitchDeck" | "prototype" | "additionalDocs"

export const FILE_LIMITS: Record<FileField, { maxBytes: number; label: string; accept: string }> = {
  pitchDeck: { maxBytes: 25 * 1024 * 1024, label: "PDF, max 25MB", accept: ".pdf" },
  prototype: { maxBytes: 50 * 1024 * 1024, label: "Video, CAD files, max 50MB", accept: ".mp4,.mov,.avi,.stl,.step,.obj" },
  additionalDocs: { maxBytes: 25 * 1024 * 1024, label: "PDF, DOC, max 25MB", accept: ".pdf,.doc,.docx" },
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type FieldErrors = Partial<Record<keyof FormData, string>>

const REQUIRED_BY_STEP: Record<number, { field: keyof FormData; label: string }[]> = {
  1: [
    { field: "title", label: "Project title" },
    { field: "institution", label: "Institution" },
    { field: "email", label: "Email" },
    { field: "workingField", label: "Working field" },
  ],
  2: [
    { field: "targetAudience", label: "Target audience" },
    { field: "painPoints", label: "Pain points" },
  ],
  3: [
    { field: "businessModel", label: "Business model" },
    { field: "fundingNeeded", label: "Funding needed" },
  ],
  4: [
    { field: "milestones", label: "Milestones" },
    { field: "timeline", label: "Timeline" },
  ],
  5: [],
}

interface MultiStepFormProps {
  onSubmit: (data: FormData) => Promise<void>
  demoMode?: boolean
  demoData?: Partial<FormData>
  /** Pre-filled from the signed-in profile (institution / email). */
  initialData?: Partial<FormData>
  /** Progress text shown on the submit button while uploading. */
  progressLabel?: string | null
}

export function MultiStepForm({ onSubmit, demoMode = false, demoData, initialData, progressLabel }: MultiStepFormProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<FormData>(() => ({
    title: "",
    institution: "",
    email: "",
    workingField: "",
    trl: 3,
    targetAudience: "",
    painPoints: "",
    marketSize: "",
    businessModel: "",
    fundingNeeded: "",
    partnerNeeded: "",
    license: "",
    milestones: "",
    timeline: "",
    pitchDeck: null,
    prototype: null,
    additionalDocs: null,
    ...(initialData ?? {}),
  }))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  // Auto-fill demo data. `demoData` is usually a fresh object literal on every
  // parent render, so key the effect on its serialised content rather than
  // the reference — otherwise the fill re-ran on every keystroke.
  const demoKey = demoMode && demoData ? JSON.stringify(demoData) : null
  const appliedDemoKey = useRef<string | null>(null)
  useEffect(() => {
    if (!demoKey || appliedDemoKey.current === demoKey) return
    appliedDemoKey.current = demoKey
    setFormData(prev => ({ ...prev, ...(JSON.parse(demoKey) as Partial<FormData>) }))
    setFieldErrors({})
    setError(null)
  }, [demoKey])

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setFieldErrors(prev => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
    if (error) setError(null)
  }

  const handleFileUpload = (field: FileField, file: File | null) => {
    if (!file) return
    const limit = FILE_LIMITS[field]
    if (file.size > limit.maxBytes) {
      setFieldErrors(prev => ({
        ...prev,
        [field]: `${file.name} is ${formatBytes(file.size)} — the limit is ${formatBytes(limit.maxBytes)}.`,
      }))
      return
    }
    updateField(field, file)
  }

  const removeFile = (field: FileField) => updateField(field, null)

  const validateStep = (step: number): FieldErrors => {
    const errors: FieldErrors = {}
    for (const { field, label } of REQUIRED_BY_STEP[step] ?? []) {
      const value = formData[field]
      if (typeof value === "string" && !value.trim()) errors[field] = `${label} is required.`
    }
    if (step === 1 && formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = "Enter a valid email address."
    }
    return errors
  }

  const goToStep = (step: number) => {
    setCurrentStep(step)
    setError(null)
    setFieldErrors({})
  }

  const handleNext = () => {
    const errors = validateStep(currentStep)
    if (Object.keys(errors).length === 0) {
      goToStep(Math.min(currentStep + 1, STEPS.length))
    } else {
      setFieldErrors(errors)
      setError("Please complete the highlighted fields.")
    }
  }

  const handleBack = () => goToStep(Math.max(currentStep - 1, 1))

  const handleSubmit = async () => {
    // Re-validate every step so a stale field cannot slip through.
    for (const step of [1, 2, 3, 4]) {
      const errors = validateStep(step)
      if (Object.keys(errors).length > 0) {
        setCurrentStep(step)
        setFieldErrors(errors)
        setError("Please complete the highlighted fields.")
        return
      }
    }
    setLoading(true)
    setError(null)
    try {
      await onSubmit(formData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed")
    } finally {
      setLoading(false)
    }
  }

  const inputClass = (field: keyof FormData, extra = "") =>
    `w-full rounded-lg border bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 transition-all ${
      fieldErrors[field]
        ? "border-red-500/60 focus:border-red-400 focus:ring-red-400/40"
        : "border-white/10 focus:border-[#6efcff] focus:ring-[#6efcff]/40"
    } ${extra}`

  const FieldError = ({ field }: { field: keyof FormData }) =>
    fieldErrors[field] ? (
      <p className="mt-1.5 text-xs text-red-400" role="alert">
        {fieldErrors[field]}
      </p>
    ) : null

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">
                Project Title <span className="text-[#6efcff]">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => updateField("title", e.target.value)}
                placeholder="e.g. Graphene-Based Supercapacitor"
                className={inputClass("title")}
              />
            <FieldError field="title" />
            </div>
            
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Institution <span className="text-[#6efcff]">*</span>
                </label>
                <input
                  type="text"
                  value={formData.institution}
                  onChange={(e) => updateField("institution", e.target.value)}
                  placeholder="MIT, Stanford, etc."
                  className={inputClass("institution")}
                />
              <FieldError field="institution" />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Email <span className="text-[#6efcff]">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="you@university.edu"
                  className={inputClass("email")}
                />
              <FieldError field="email" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">
                Working Field <span className="text-[#6efcff]">*</span>
              </label>
              <select
                value={formData.workingField}
                onChange={(e) => updateField("workingField", e.target.value)}
                className={inputClass("workingField")}
              >
                <option value="">Select a field</option>
                <option value="Energy Storage">Energy Storage</option>
                <option value="Nanomaterials">Nanomaterials</option>
                <option value="Biomaterials">Biomaterials</option>
                <option value="Polymers">Polymers</option>
                <option value="Ceramics">Ceramics</option>
                <option value="Composites">Composites</option>
                <option value="Metals & Alloys">Metals & Alloys</option>
                <option value="Semiconductors">Semiconductors</option>
                <option value="Catalysis">Catalysis</option>
                <option value="Photovoltaics">Photovoltaics</option>
              </select>
              <FieldError field="workingField" />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">
                Current TRL <span className="text-[#6efcff]">*</span>
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => updateField("trl", n)}
                    className={`flex-1 rounded-lg py-3 text-sm font-medium transition-all ${
                      formData.trl === n
                        ? "bg-[#6efcff]/20 border border-[#6efcff] text-[#c5fdff]"
                        : "bg-white/5 border border-white/10 text-white/60 hover:border-white/30"
                    }`}
                  >
                    TRL {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">
                Target Audience <span className="text-[#6efcff]">*</span>
              </label>
              <textarea
                value={formData.targetAudience}
                onChange={(e) => updateField("targetAudience", e.target.value)}
                placeholder="Who will benefit from this innovation? (e.g. EV manufacturers, data centers, renewable energy providers)"
                rows={4}
                className={inputClass("targetAudience", "resize-none")}
              />
            <FieldError field="targetAudience" />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">
                Pain Points <span className="text-[#6efcff]">*</span>
              </label>
              <textarea
                value={formData.painPoints}
                onChange={(e) => updateField("painPoints", e.target.value)}
                placeholder="What specific problems does your innovation solve? (e.g. slow charging, energy loss, high costs)"
                rows={4}
                className={inputClass("painPoints", "resize-none")}
              />
            <FieldError field="painPoints" />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">
                Market Size
              </label>
              <input
                type="text"
                value={formData.marketSize}
                onChange={(e) => updateField("marketSize", e.target.value)}
                placeholder="e.g. $50B global market by 2030"
                className={inputClass("marketSize")}
              />
            <FieldError field="marketSize" />
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">
                Business Model <span className="text-[#6efcff]">*</span>
              </label>
              <textarea
                value={formData.businessModel}
                onChange={(e) => updateField("businessModel", e.target.value)}
                placeholder="How will this generate revenue? (e.g. licensing, direct sales, service contracts)"
                rows={4}
                className={inputClass("businessModel", "resize-none")}
              />
            <FieldError field="businessModel" />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">
                Funding Needed <span className="text-[#6efcff]">*</span>
              </label>
              <select
                value={formData.fundingNeeded}
                onChange={(e) => updateField("fundingNeeded", e.target.value)}
                className={inputClass("fundingNeeded")}
              >
                <option value="">Select funding range</option>
                <option value="< $10,000">&lt; $10,000</option>
                <option value="$10,000 - $50,000">$10,000 - $50,000</option>
                <option value="$50,000 - $100,000">$50,000 - $100,000</option>
                <option value="$100,000 - $250,000">$100,000 - $250,000</option>
                <option value="> $250,000">&gt; $250,000</option>
              </select>
              <FieldError field="fundingNeeded" />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Partner Needed
                </label>
                <select
                  value={formData.partnerNeeded}
                  onChange={(e) => updateField("partnerNeeded", e.target.value)}
                  className={inputClass("partnerNeeded")}
                >
                  <option value="">Select partner type</option>
                  <option value="Industry Partner">Industry Partner</option>
                  <option value="Academic Collaborator">Academic Collaborator</option>
                  <option value="Government Lab">Government Lab</option>
                  <option value="Not Needed">Not Needed</option>
                </select>
                <FieldError field="partnerNeeded" />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  License
                </label>
                <select
                  value={formData.license}
                  onChange={(e) => updateField("license", e.target.value)}
                  className={inputClass("license")}
                >
                  <option value="">Select license type</option>
                  <option value="Open Source">Open Source</option>
                  <option value="University License">University License</option>
                  <option value="Exclusive License">Exclusive License</option>
                  <option value="Pending">Pending</option>
                </select>
                <FieldError field="license" />
              </div>
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">
                Milestones <span className="text-[#6efcff]">*</span>
              </label>
              <textarea
                value={formData.milestones}
                onChange={(e) => updateField("milestones", e.target.value)}
                placeholder="List key milestones (e.g. Proof of Concept, Prototype, Pilot, Commercialization)"
                rows={4}
                className={inputClass("milestones", "resize-none")}
              />
            <FieldError field="milestones" />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">
                Timeline <span className="text-[#6efcff]">*</span>
              </label>
              <textarea
                value={formData.timeline}
                onChange={(e) => updateField("timeline", e.target.value)}
                placeholder="Estimated timeline for each milestone (e.g. 6 months for PoC, 12 months for Prototype)"
                rows={4}
                className={inputClass("timeline", "resize-none")}
              />
            <FieldError field="timeline" />
            </div>
          </div>
        )

      case 5:
        return (
          <div className="space-y-6">
            <div className="rounded-lg border border-white/10 bg-white/5 p-6">
              <label className="block text-sm font-medium text-white/90 mb-3">
                Pitch Deck (PDF)
              </label>
              {formData.pitchDeck ? (
                <div className="flex items-center justify-between rounded-lg bg-[#6efcff]/10 border border-[#6efcff]/30 px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-5 w-5 shrink-0 text-[#c5fdff]" />
                    <span className="truncate text-sm text-white">{formData.pitchDeck.name}</span>
                    <span className="shrink-0 text-xs text-white/40">{formatBytes(formData.pitchDeck.size)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-[#6efcff]" />
                    <button
                      type="button"
                      onClick={() => removeFile("pitchDeck")}
                      aria-label="Remove file"
                      className="rounded p-1 text-white/50 hover:bg-white/10 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-white/20 bg-white/5 py-8 cursor-pointer hover:border-[#6efcff]/50 hover:bg-white/10 transition-all">
                  <Upload className="h-8 w-8 text-white/40 mb-2" />
                  <span className="text-sm text-white/60">Click to upload pitch deck</span>
                  <span className="text-xs text-white/40 mt-1">{FILE_LIMITS.pitchDeck.label}</span>
                  <input
                    type="file"
                    accept={FILE_LIMITS.pitchDeck.accept}
                    onChange={(e) => {
                      handleFileUpload("pitchDeck", e.target.files?.[0] ?? null)
                      e.target.value = ""
                    }}
                    className="hidden"
                  />
                </label>
              )}
              <FieldError field="pitchDeck" />
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-6">
              <label className="block text-sm font-medium text-white/90 mb-3">
                Prototype/Video
              </label>
              {formData.prototype ? (
                <div className="flex items-center justify-between rounded-lg bg-[#6efcff]/10 border border-[#6efcff]/30 px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Video className="h-5 w-5 shrink-0 text-[#c5fdff]" />
                    <span className="truncate text-sm text-white">{formData.prototype.name}</span>
                    <span className="shrink-0 text-xs text-white/40">{formatBytes(formData.prototype.size)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-[#6efcff]" />
                    <button
                      type="button"
                      onClick={() => removeFile("prototype")}
                      aria-label="Remove file"
                      className="rounded p-1 text-white/50 hover:bg-white/10 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-white/20 bg-white/5 py-8 cursor-pointer hover:border-[#6efcff]/50 hover:bg-white/10 transition-all">
                  <Video className="h-8 w-8 text-white/40 mb-2" />
                  <span className="text-sm text-white/60">Click to upload prototype</span>
                  <span className="text-xs text-white/40 mt-1">{FILE_LIMITS.prototype.label}</span>
                  <input
                    type="file"
                    accept={FILE_LIMITS.prototype.accept}
                    onChange={(e) => {
                      handleFileUpload("prototype", e.target.files?.[0] ?? null)
                      e.target.value = ""
                    }}
                    className="hidden"
                  />
                </label>
              )}
              <FieldError field="prototype" />
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-6">
              <label className="block text-sm font-medium text-white/90 mb-3">
                Additional Documents
              </label>
              {formData.additionalDocs ? (
                <div className="flex items-center justify-between rounded-lg bg-[#6efcff]/10 border border-[#6efcff]/30 px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-5 w-5 shrink-0 text-[#c5fdff]" />
                    <span className="truncate text-sm text-white">{formData.additionalDocs.name}</span>
                    <span className="shrink-0 text-xs text-white/40">{formatBytes(formData.additionalDocs.size)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-[#6efcff]" />
                    <button
                      type="button"
                      onClick={() => removeFile("additionalDocs")}
                      aria-label="Remove file"
                      className="rounded p-1 text-white/50 hover:bg-white/10 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-white/20 bg-white/5 py-8 cursor-pointer hover:border-[#6efcff]/50 hover:bg-white/10 transition-all">
                  <FileText className="h-8 w-8 text-white/40 mb-2" />
                  <span className="text-sm text-white/60">Click to upload additional docs</span>
                  <span className="text-xs text-white/40 mt-1">{FILE_LIMITS.additionalDocs.label}</span>
                  <input
                    type="file"
                    accept={FILE_LIMITS.additionalDocs.accept}
                    onChange={(e) => {
                      handleFileUpload("additionalDocs", e.target.files?.[0] ?? null)
                      e.target.value = ""
                    }}
                    className="hidden"
                  />
                </label>
              )}
              <FieldError field="additionalDocs" />
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="w-full">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                    currentStep === step.id
                      ? "bg-[#6efcff] text-black"
                      : currentStep > step.id
                      ? "bg-[#6efcff]/20 text-[#c5fdff] border border-[#6efcff]"
                      : "bg-white/5 text-white/40 border border-white/10"
                  }`}
                >
                  {currentStep > step.id ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    step.id
                  )}
                </div>
                <span className={`text-xs mt-2 text-center ${
                  currentStep === step.id ? "text-[#c5fdff]" : "text-white/40"
                }`}>
                  {step.title}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${
                  currentStep > step.id ? "bg-[#6efcff]" : "bg-white/10"
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Demo Mode Indicator */}
      {demoMode && (
        <div className="mb-6 rounded-xl border border-[#6efcff]/30 bg-[#6efcff]/10 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#c5fdff]" />
            <span className="text-sm font-medium text-[#c5fdff]">Demo Mode: Form auto-filled with AI analysis data</span>
          </div>
        </div>
      )}

      {/* Form Content */}
      <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white/95 mb-1">{STEPS[currentStep - 1].title}</h2>
          <p className="text-sm text-white/50">{STEPS[currentStep - 1].description}</p>
        </div>

        {renderStep()}

        {error && (
          <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-center gap-3">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentStep === 1}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/60 hover:bg-white/10 hover:text-white/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          {currentStep === STEPS.length ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#6efcff] to-[#a78bfa] px-6 py-2.5 text-sm font-semibold text-black transition-all hover:opacity-90 disabled:opacity-50"
            >
              {loading ? progressLabel || "Submitting..." : "Submit Proposal"}
              {!loading && <Sparkles className="h-4 w-4" />}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#6efcff] to-[#a78bfa] px-6 py-2.5 text-sm font-semibold text-black transition-all hover:opacity-90"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
