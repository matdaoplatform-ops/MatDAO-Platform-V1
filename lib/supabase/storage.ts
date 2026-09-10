import { supabase } from "./client"
import type { ProjectDocument } from "./client"

/** Private bucket for submission documents; keys are `<uid>/<projectId>/<kind>-<file>`. */
export const DOCUMENTS_BUCKET = "project-documents"

export const SIGNED_URL_TTL_SECONDS = 60 * 60

/**
 * Signed download URLs for a project's documents (owner or staff under RLS).
 * Documents whose URL cannot be produced are returned with `url: null`.
 */
export async function signProjectDocuments(
  documents: ProjectDocument[] | null | undefined,
): Promise<(ProjectDocument & { url: string | null })[]> {
  const docs = Array.isArray(documents) ? documents : []
  if (docs.length === 0) return []
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrls(
      docs.map((d) => d.path),
      SIGNED_URL_TTL_SECONDS,
    )
  if (error || !data) {
    if (error) console.warn("Could not sign document URLs:", error.message)
    return docs.map((d) => ({ ...d, url: null }))
  }
  return docs.map((d, i) => ({ ...d, url: data[i]?.signedUrl ?? null }))
}
