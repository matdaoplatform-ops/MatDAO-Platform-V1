"use server"

import { uploadMetadataToIPFSDetailed } from "./uploadMetadataToIPFS"
import type { AIMetadata, ProjectDetails, PinResult } from "./uploadMetadataToIPFS"
import { createServerClientWithToken } from "@/lib/supabase/server"

/** Max serialised size of the metadata payload accepted from the client. */
const MAX_METADATA_BYTES = 256 * 1024

class IpfsActionError extends Error {}

/**
 * Pinning costs money and the Pinata JWT lives on the server, so every call
 * must come from a signed-in MatDAO user. Sessions are held by the browser
 * (supabase-js localStorage), so the client passes its access token and we
 * validate it against Supabase (`getUser`) before touching Pinata.
 */
async function requireUser(accessToken: string | undefined): Promise<{ id: string; role: string | null }> {
  if (!accessToken) throw new IpfsActionError("Sign in to upload IP-NFT metadata.")
  const supabase = createServerClientWithToken(accessToken)
  if (!supabase) throw new IpfsActionError("Supabase is not configured on the server.")
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) throw new IpfsActionError("Your session has expired. Sign in again to continue.")
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  return { id: user.id, role: profile?.role ?? null }
}

function validatePayload(aiScores: AIMetadata, projectDetails: ProjectDetails) {
  if (!aiScores || typeof aiScores !== "object") throw new IpfsActionError("aiScores is required.")
  if (!projectDetails || typeof projectDetails.title !== "string" || !projectDetails.title.trim()) {
    throw new IpfsActionError("projectDetails.title is required.")
  }
  const size = Buffer.byteLength(JSON.stringify({ aiScores, projectDetails }), "utf8")
  if (size > MAX_METADATA_BYTES) {
    throw new IpfsActionError(`Metadata payload too large (${Math.round(size / 1024)} KB, max ${MAX_METADATA_BYTES / 1024} KB).`)
  }
}

/**
 * Server action wrapper for IPFS upload. Returns the `ipfs://` URI. When
 * PINATA_JWT is not configured the URI is a mock (`ipfs://QmMock...`) — use
 * the Detailed variant when you need to know (e.g. before minting).
 *
 * `accessToken` is the caller's Supabase access token
 * (`(await supabase.auth.getSession()).data.session?.access_token`).
 * It is typed optional for backwards compatibility but the call is rejected
 * without a valid one.
 */
export async function uploadMetadataToIPFSAction(
  aiScores: AIMetadata,
  projectDetails: ProjectDetails,
  accessToken?: string,
): Promise<string> {
  const result = await uploadMetadataToIPFSDetailedAction(aiScores, projectDetails, accessToken)
  return result.uri
}

/** Same as above but returns `{ uri, cid, mock, gatewayUrl }`. Requires a signed-in user. */
export async function uploadMetadataToIPFSDetailedAction(
  aiScores: AIMetadata,
  projectDetails: ProjectDetails,
  accessToken?: string,
): Promise<PinResult> {
  await requireUser(accessToken)
  validatePayload(aiScores, projectDetails)
  return await uploadMetadataToIPFSDetailed(aiScores, projectDetails)
}
