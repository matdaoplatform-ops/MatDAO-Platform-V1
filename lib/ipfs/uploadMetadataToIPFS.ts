/**
 * IP-NFT metadata helpers.
 *
 * - `buildNFTMetadata` is pure and safe everywhere.
 * - `uploadMetadataToIPFS` / `uploadFileToIPFS` are SERVER-ONLY (they use the
 *   Pinata JWT). Client components must use lib/ipfs/client.ts, which calls
 *   the /api/ipfs/upload route, or the server action in
 *   uploadMetadataToIPFSAction.ts.
 */
import { pinFile, pinJSON, type PinResult } from "./pinata"

export type { PinResult }
export { getGatewayUrl } from "./pinata"

export interface AIMetadata {
  commercialViability: number
  scientificIntegrity: number
  ipNovelty: number
  validationTier: string
}

export interface ProjectDetails {
  title: string
  description: string
  researchField: string
  imageIpfsHash?: string
  encryptedDataCid?: string
}

export interface NFTMetadata {
  name: string
  description: string
  image: string
  external_url?: string
  attributes: Array<{
    trait_type: string
    value: string | number
    display_type?: "number" | "boost_percentage" | "boost_number" | "date"
  }>
  properties?: Record<string, unknown>
}

/** ERC-721 / OpenSea-style metadata document for an IP-NFT. */
export function buildNFTMetadata(aiScores: AIMetadata, projectDetails: ProjectDetails): NFTMetadata {
  return {
    name: `MatDAO IP-NFT: ${projectDetails.title}`,
    description: projectDetails.description,
    image: projectDetails.imageIpfsHash ? `ipfs://${projectDetails.imageIpfsHash}` : "",
    external_url: process.env.NEXT_PUBLIC_APP_URL,
    attributes: [
      { trait_type: "Research Field", value: projectDetails.researchField },
      { trait_type: "Validation Tier", value: aiScores.validationTier },
      { trait_type: "Commercial Viability", value: aiScores.commercialViability, display_type: "number" },
      { trait_type: "Scientific Integrity", value: aiScores.scientificIntegrity, display_type: "number" },
      { trait_type: "IP Novelty", value: aiScores.ipNovelty, display_type: "number" },
      { trait_type: "Validated At", value: Math.floor(Date.now() / 1000), display_type: "date" },
    ],
    properties: {
      platform: "MatDAO",
      schema: "matdao-ipnft-v1",
      encryptedDataCid: projectDetails.encryptedDataCid ?? null,
    },
  }
}

/**
 * Upload AI analysis metadata to IPFS (Pinata pinJSONToIPFS). Server-only.
 * Returns the full pin result including the `mock` flag.
 */
export async function uploadMetadataToIPFSDetailed(aiScores: AIMetadata, projectDetails: ProjectDetails): Promise<PinResult> {
  const metadata = buildNFTMetadata(aiScores, projectDetails)
  return pinJSON(metadata, `matdao-ipnft-${slug(projectDetails.title)}.json`, {
    platform: "matdao",
    tier: aiScores.validationTier,
  })
}

/**
 * Upload AI analysis metadata to IPFS and return the `ipfs://` URI.
 * Kept for backwards compatibility with existing call sites.
 */
export async function uploadMetadataToIPFS(aiScores: AIMetadata, projectDetails: ProjectDetails): Promise<string> {
  return (await uploadMetadataToIPFSDetailed(aiScores, projectDetails)).uri
}

/**
 * Upload a file to IPFS (Pinata pinFileToIPFS). Server-only.
 */
export async function uploadFileToIPFS(file: Blob | Buffer, name = "matdao-upload"): Promise<string> {
  const blob = file instanceof Blob ? file : new Blob([new Uint8Array(file)])
  return (await pinFile(blob, name)).uri
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "untitled"
}
