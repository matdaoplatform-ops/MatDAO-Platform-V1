import { NextRequest, NextResponse } from "next/server"
import { createPublicClient, http, parseAbi, verifyMessage } from "viem"
import { sepolia } from "viem/chains"
import { parseVdrMessage, VDR_MAX_AGE_SECONDS } from "@/lib/web3/vdrMessage"

// Minimal ERC-20 read surface. Built with parseAbi so viem gets a real ABI
// (a bare string array throws before the RPC call is even made).
const ERC20_READ_ABI = parseAbi(["function balanceOf(address account) view returns (uint256)"])

/**
 * Nonce replay guard. In-memory, so it is per server instance: on a
 * multi-instance / serverless deployment move this to Redis or a DB row.
 * Entries expire after the signature window so the map stays small.
 */
const seenNonces = new Map<string, number>()
function consumeNonce(nonce: string, now: number): boolean {
  for (const [n, exp] of seenNonces) if (exp < now) seenNonces.delete(n)
  if (seenNonces.has(nonce)) return false
  seenNonces.set(nonce, now + VDR_MAX_AGE_SECONDS * 2)
  return true
}

/**
 * The host the signed message must be bound to. Prefer the configured public
 * origin (NEXT_PUBLIC_APP_URL) and fall back to the request URL's host.
 * `x-forwarded-host` is deliberately NOT trusted: it is client-controlled on
 * many deployments and would let an attacker pick the domain to match.
 */
function expectedHost(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL
  if (configured) {
    try {
      return new URL(configured).host.toLowerCase()
    } catch {
      /* fall through */
    }
  }
  return request.nextUrl.host.toLowerCase()
}

/** Content-Disposition filenames: only [A-Za-z0-9._-], bounded length. */
function safeFilenamePart(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9._-]/g, "").slice(0, 64)
  return cleaned || "document"
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const { address, message, signature, projectId } = (body ?? {}) as Record<string, unknown>

    // Validate required fields
    if (typeof address !== "string" || typeof message !== "string" || typeof signature !== "string" || typeof projectId !== "string") {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 })
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(address) || !/^0x[0-9a-fA-F]+$/.test(signature)) {
      return NextResponse.json({ message: "Malformed address or signature" }, { status: 400 })
    }

    // Step 1: the message must have the exact structure the client builds
    const fields = parseVdrMessage(message)
    if (!fields) {
      return NextResponse.json({ message: "Invalid message format" }, { status: 400 })
    }

    // Step 2: binding checks - project, address and domain must match this request
    if (fields.projectId !== projectId) {
      return NextResponse.json({ message: "Access Denied: message is bound to a different project" }, { status: 403 })
    }
    if (fields.address.toLowerCase() !== address.toLowerCase()) {
      return NextResponse.json({ message: "Access Denied: message is bound to a different address" }, { status: 403 })
    }
    const host = expectedHost(request)
    if (fields.domain.toLowerCase() !== host) {
      return NextResponse.json({ message: "Access Denied: message is bound to a different domain" }, { status: 403 })
    }

    // Step 3: freshness (+/- VDR_MAX_AGE_SECONDS) and single-use nonce
    const now = Math.floor(Date.now() / 1000)
    if (Math.abs(now - fields.timestamp) > VDR_MAX_AGE_SECONDS) {
      return NextResponse.json({ message: "Access Denied: Request expired (replay attack prevention)" }, { status: 403 })
    }
    if (!consumeNonce(fields.nonce, now)) {
      return NextResponse.json({ message: "Access Denied: signature already used" }, { status: 403 })
    }

    // Step 4: verify the signature (EOA; EIP-1271 smart wallets are out of scope for the MVP)
    const valid = await verifyMessage({ address: address as `0x${string}`, message, signature: signature as `0x${string}` })
    if (!valid) {
      return NextResponse.json({ message: "Access Denied: Invalid Signature" }, { status: 403 })
    }

    // Step 5: on-chain IPT balance gate
    const iptAddress = process.env.NEXT_PUBLIC_MATDAO_IPT_ADDRESS
    if (!iptAddress || !/^0x[0-9a-fA-F]{40}$/.test(iptAddress)) {
      return NextResponse.json({ message: "Server configuration error: NEXT_PUBLIC_MATDAO_IPT_ADDRESS is not set" }, { status: 500 })
    }

    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(process.env.SEPOLIA_RPC_URL || undefined),
    })

    const balance = await publicClient.readContract({
      address: iptAddress as `0x${string}`,
      abi: ERC20_READ_ABI,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    })

    if (balance === 0n) {
      return NextResponse.json({ message: "Access Denied: Insufficient IPT Balance" }, { status: 403 })
    }

    // Step 6: file delivery.
    // MVP: a generated placeholder PDF. Production: stream the real document
    // from private storage (S3 / Supabase Storage with a signed URL).
    const pdf = buildPlaceholderPdf(projectId, address)

    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="secure-document-${safeFilenamePart(projectId)}.pdf"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
        "X-MatDAO-VDR-Mock": "true",
      },
    })
  } catch (error) {
    console.error("VDR API Error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}

/** A tiny valid single-page PDF that clearly states it is a placeholder. */
function buildPlaceholderPdf(projectId: string, address: string): Buffer {
  const safe = (s: string) => s.replace(/[^\x20-\x7e]/g, "").replace(/[()\\]/g, "")
  const lines = [
    "MatDAO Secure Data Room - PLACEHOLDER DOCUMENT",
    `Project: ${safe(projectId)}`,
    `Verified holder: ${safe(address)}`,
    "This is a mock file served by /api/vdr for the MVP.",
    "Real documents will be streamed from private storage.",
  ]
  const content = ["BT", "/F1 14 Tf", "50 740 Td", "18 TL", ...lines.map((l, i) => `${i ? "T* " : ""}(${l}) Tj`), "ET"].join("\n")
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ]
  let out = "%PDF-1.4\n"
  const offsets: number[] = []
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"))
    out += `${i + 1} 0 obj\n${obj}\nendobj\n`
  })
  const xref = Buffer.byteLength(out, "latin1")
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, "latin1")
}
