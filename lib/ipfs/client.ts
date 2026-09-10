/**
 * Browser-safe helpers that call the /api/ipfs/upload route. Use these from
 * client components; the route holds the Pinata credentials.
 */
import type { AIMetadata, ProjectDetails, PinResult } from "./uploadMetadataToIPFS"

export type { PinResult }

async function postUpload(body: FormData | string): Promise<PinResult> {
  const res = await fetch("/api/ipfs/upload", {
    method: "POST",
    body,
    headers: typeof body === "string" ? { "Content-Type": "application/json" } : undefined,
  })
  const data = (await res.json().catch(() => ({}))) as Partial<PinResult> & { message?: string }
  if (!res.ok || !data.uri) {
    throw new Error(data.message || `IPFS upload failed (${res.status})`)
  }
  if (data.mock) {
    console.warn("[ipfs] server returned a MOCK CID - PINATA_JWT is not configured on the server.")
  }
  return data as PinResult
}

/** Pins IP-NFT metadata (built server-side from the scores/details). */
export function uploadMetadataViaApi(aiScores: AIMetadata, projectDetails: ProjectDetails): Promise<PinResult> {
  return postUpload(JSON.stringify({ kind: "metadata", aiScores, projectDetails }))
}

/** Pins an arbitrary JSON document. */
export function uploadJsonViaApi(content: unknown, name = "matdao-document.json"): Promise<PinResult> {
  return postUpload(JSON.stringify({ kind: "json", name, content }))
}

/** Pins a file (multipart). */
export function uploadFileViaApi(file: File): Promise<PinResult> {
  const form = new FormData()
  form.append("file", file, file.name)
  return postUpload(form)
}
