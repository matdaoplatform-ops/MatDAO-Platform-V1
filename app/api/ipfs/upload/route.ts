import { NextRequest, NextResponse } from "next/server"
import { pinFile, pinJSON } from "@/lib/ipfs/pinata"
import { uploadMetadataToIPFSDetailed, type AIMetadata, type ProjectDetails } from "@/lib/ipfs/uploadMetadataToIPFS"
import { bearerToken, createServerClientWithToken } from "@/lib/supabase/server"

export const runtime = "nodejs"

const MAX_FILE_BYTES = 25 * 1024 * 1024
const MAX_JSON_BYTES = 256 * 1024

/**
 * Pinning is only for signed-in MatDAO users: the caller forwards its
 * Supabase access token as `Authorization: Bearer <token>` and we validate it
 * with `getUser()` (anon key + user JWT, no service key).
 */
async function authenticate(request: NextRequest): Promise<{ id: string } | NextResponse> {
  const token = bearerToken(request)
  if (!token) return NextResponse.json({ message: "Sign in to upload to IPFS (missing bearer token)" }, { status: 401 })
  const supabase = createServerClientWithToken(token)
  if (!supabase) return NextResponse.json({ message: "Supabase is not configured" }, { status: 500 })
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ message: "Invalid or expired session" }, { status: 401 })
  return { id: user.id }
}

/** Read a JSON body while enforcing a byte cap (Content-Length first, then the real size). */
async function readJsonCapped(request: NextRequest): Promise<unknown | NextResponse> {
  const declared = Number(request.headers.get("content-length") || 0)
  if (declared > MAX_JSON_BYTES) {
    return NextResponse.json({ message: `Body too large (max ${MAX_JSON_BYTES / 1024} KB)` }, { status: 413 })
  }
  const text = await request.text()
  if (Buffer.byteLength(text, "utf8") > MAX_JSON_BYTES) {
    return NextResponse.json({ message: `Body too large (max ${MAX_JSON_BYTES / 1024} KB)` }, { status: 413 })
  }
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

/**
 * POST /api/ipfs/upload
 *
 * JSON body:
 *   { kind: "metadata", aiScores: AIMetadata, projectDetails: ProjectDetails }
 *   { kind: "json", name?: string, content: any }
 * multipart/form-data:
 *   file=<File>
 *
 * Response: { uri, cid, mock, gatewayUrl }. `mock: true` means PINATA_JWT is
 * not configured and the CID is fake (a console.warn is logged server-side).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticate(request)
    if (auth instanceof NextResponse) return auth

    const contentType = request.headers.get("content-type") || ""

    if (contentType.includes("multipart/form-data")) {
      const declared = Number(request.headers.get("content-length") || 0)
      if (declared > MAX_FILE_BYTES + 64 * 1024) {
        return NextResponse.json({ message: `File too large (max ${MAX_FILE_BYTES / 1024 / 1024} MB)` }, { status: 413 })
      }
      const form = await request.formData()
      const file = form.get("file")
      if (!(file instanceof Blob)) {
        return NextResponse.json({ message: "Missing 'file' field" }, { status: 400 })
      }
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ message: `File too large (max ${MAX_FILE_BYTES / 1024 / 1024} MB)` }, { status: 413 })
      }
      const name = (file as File).name || "matdao-upload"
      return NextResponse.json(await pinFile(file, name))
    }

    const parsed = await readJsonCapped(request)
    if (parsed instanceof NextResponse) return parsed
    const body = parsed as
      | { kind: "metadata"; aiScores: AIMetadata; projectDetails: ProjectDetails }
      | { kind: "json"; name?: string; content: unknown }
      | null

    if (!body || typeof body !== "object" || !("kind" in body)) {
      return NextResponse.json({ message: "Invalid body" }, { status: 400 })
    }

    if (body.kind === "metadata") {
      if (!body.aiScores || !body.projectDetails?.title) {
        return NextResponse.json({ message: "aiScores and projectDetails.title are required" }, { status: 400 })
      }
      return NextResponse.json(await uploadMetadataToIPFSDetailed(body.aiScores, body.projectDetails))
    }

    if (body.kind === "json") {
      if (body.content === undefined) {
        return NextResponse.json({ message: "content is required" }, { status: 400 })
      }
      return NextResponse.json(await pinJSON(body.content, body.name || "matdao-document.json"))
    }

    return NextResponse.json({ message: "Unknown kind" }, { status: 400 })
  } catch (error) {
    console.error("IPFS upload error:", error)
    return NextResponse.json({ message: error instanceof Error ? error.message : "IPFS upload failed" }, { status: 502 })
  }
}
