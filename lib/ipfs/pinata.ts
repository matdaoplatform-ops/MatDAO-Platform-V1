/**
 * Server-only Pinata client (uses PINATA_JWT). Never import from client
 * components - go through app/api/ipfs/upload (see lib/ipfs/client.ts).
 *
 * When PINATA_JWT is absent every call falls back to a deterministic-looking
 * mock CID, logs a console.warn and flags the result with `mock: true` so the
 * UI can label it honestly.
 */
// Runtime guard instead of the `server-only` package (not a dependency here).
if (typeof window !== "undefined") {
  throw new Error("lib/ipfs/pinata.ts is server-only. Use lib/ipfs/client.ts from client components.")
}

const PINATA_API = "https://api.pinata.cloud/pinning"

export interface PinResult {
  /** ipfs://<cid> */
  uri: string
  cid: string
  /** true when no PINATA_JWT was configured and a fake CID was returned */
  mock: boolean
  gatewayUrl: string
}

export function isPinataConfigured(): boolean {
  return Boolean(process.env.PINATA_JWT && process.env.PINATA_JWT.trim().length > 20)
}

export function getGatewayUrl(ipfsUriOrCid: string): string {
  const cid = ipfsUriOrCid.replace(/^ipfs:\/\//, "")
  const gateway = (process.env.PINATA_GATEWAY || process.env.NEXT_PUBLIC_PINATA_GATEWAY || "gateway.pinata.cloud").replace(/^https?:\/\//, "")
  return `https://${gateway}/ipfs/${cid}`
}

function mockResult(kind: "json" | "file"): PinResult {
  console.warn(`[ipfs] PINATA_JWT is not set - returning a MOCK ${kind} CID. Set PINATA_JWT in .env.local for real uploads.`)
  const cid = `QmMock${kind === "json" ? "Json" : "File"}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
  return { uri: `ipfs://${cid}`, cid, mock: true, gatewayUrl: getGatewayUrl(cid) }
}

async function pinataFetch(path: string, init: RequestInit): Promise<{ IpfsHash: string }> {
  const res = await fetch(`${PINATA_API}/${path}`, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${process.env.PINATA_JWT}` },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Pinata ${path} failed (${res.status}): ${text.slice(0, 300)}`)
  }
  const data = (await res.json()) as { IpfsHash?: string }
  if (!data.IpfsHash) throw new Error(`Pinata ${path} returned no IpfsHash`)
  return { IpfsHash: data.IpfsHash }
}

/** pinJSONToIPFS */
export async function pinJSON(content: unknown, name: string, keyvalues: Record<string, string | number> = {}): Promise<PinResult> {
  if (!isPinataConfigured()) return mockResult("json")
  const { IpfsHash } = await pinataFetch("pinJSONToIPFS", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pinataContent: content,
      pinataMetadata: { name, keyvalues },
      pinataOptions: { cidVersion: 1 },
    }),
  })
  return { uri: `ipfs://${IpfsHash}`, cid: IpfsHash, mock: false, gatewayUrl: getGatewayUrl(IpfsHash) }
}

/** pinFileToIPFS */
export async function pinFile(file: Blob, name: string, keyvalues: Record<string, string | number> = {}): Promise<PinResult> {
  if (!isPinataConfigured()) return mockResult("file")
  const form = new FormData()
  form.append("file", file, name)
  form.append("pinataMetadata", JSON.stringify({ name, keyvalues }))
  form.append("pinataOptions", JSON.stringify({ cidVersion: 1 }))
  const { IpfsHash } = await pinataFetch("pinFileToIPFS", { method: "POST", body: form })
  return { uri: `ipfs://${IpfsHash}`, cid: IpfsHash, mock: false, gatewayUrl: getGatewayUrl(IpfsHash) }
}
