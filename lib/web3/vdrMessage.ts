/**
 * Shared (client + server) definition of the message a wallet signs to
 * access the Virtual Data Room. Binding the message to a domain, project,
 * address, nonce and timestamp prevents a captured signature from being
 * replayed for another project, on another host, or after it expires.
 */
export const VDR_STATEMENT = "MatDAO Secure Data Room access request"
export const VDR_MAX_AGE_SECONDS = 300 // +/- 5 minutes

export interface VdrMessageFields {
  domain: string
  projectId: string
  address: string
  nonce: string
  /** Unix seconds. */
  timestamp: number
}

export function buildVdrMessage(f: VdrMessageFields): string {
  return [
    VDR_STATEMENT,
    `Domain: ${f.domain}`,
    `Project: ${f.projectId}`,
    `Address: ${f.address}`,
    `Nonce: ${f.nonce}`,
    `Timestamp: ${f.timestamp}`,
  ].join("\n")
}

/** Returns null when the message does not have exactly the expected shape. */
export function parseVdrMessage(message: string): VdrMessageFields | null {
  if (typeof message !== "string") return null
  const lines = message.split("\n")
  if (lines.length !== 6 || lines[0] !== VDR_STATEMENT) return null
  const get = (i: number, key: string) => {
    const prefix = `${key}: `
    return lines[i].startsWith(prefix) ? lines[i].slice(prefix.length) : null
  }
  const domain = get(1, "Domain")
  const projectId = get(2, "Project")
  const address = get(3, "Address")
  const nonce = get(4, "Nonce")
  const ts = get(5, "Timestamp")
  if (!domain || !projectId || !address || !nonce || !ts || !/^\d+$/.test(ts)) return null
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return null
  if (!/^[0-9a-f]{32,64}$/i.test(nonce)) return null
  return { domain, projectId, address, nonce, timestamp: Number(ts) }
}

/** 32 hex chars from the Web Crypto API (available in browsers and Node 18+). */
export function generateVdrNonce(): string {
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}
