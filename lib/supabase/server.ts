import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './client'

function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  return { url, anonKey }
}

/**
 * Anonymous server-side client (no session). Only rows that RLS exposes to
 * `anon` are readable — e.g. projects with status = 'approved'.
 * Returns null when Supabase is not configured so server components can
 * degrade gracefully at build time.
 */
export function createAnonServerClient(): SupabaseClient<Database> | null {
  const cfg = env()
  if (!cfg) return null
  return createClient<Database>(cfg.url, cfg.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

/**
 * Server-side client acting AS the calling user: the user's access token is
 * forwarded in the Authorization header so every query runs under that
 * user's RLS policies (no service-role key involved).
 */
export function createServerClientWithToken(accessToken: string): SupabaseClient<Database> | null {
  const cfg = env()
  if (!cfg) return null
  return createClient<Database>(cfg.url, cfg.anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

/** Extract a bearer token from an incoming Request, if present. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match ? match[1] : null
}
