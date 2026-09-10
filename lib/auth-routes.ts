import type { UserRole } from "@/lib/supabase/client"

export type { UserRole }

/** Where a user lands after sign-in, based on role. */
export function roleDestination(role: UserRole | null | undefined): string {
  switch (role) {
    case "investor":
      return "/investor-dashboard"
    case "researcher":
      return "/researcher-dashboard"
    case "staff":
      return "/tto-portal"
    default:
      return "/"
  }
}

/** Roles a user may pick for themselves. `staff` is only granted via SQL. */
export const SELF_SERVICE_ROLES = ["researcher", "investor"] as const
export type SelfServiceRole = (typeof SELF_SERVICE_ROLES)[number]

export function isSelfServiceRole(value: unknown): value is SelfServiceRole {
  return typeof value === "string" && (SELF_SERVICE_ROLES as readonly string[]).includes(value)
}

/** Client-side route guard table (also used by <RequireAuth /> defaults). */
export const PROTECTED_ROUTES: Record<string, readonly UserRole[] | "any"> = {
  "/tto-portal": ["staff"],
  "/ai-auditor": ["researcher", "staff"],
  "/researcher-dashboard": ["researcher"],
  "/investor-dashboard": ["investor", "staff"],
  "/submit": "any",
  "/submit/milestone": "any",
  "/profile": "any",
  "/onboarding": "any",
}

export function hasRole(role: UserRole | null | undefined, allowed: readonly UserRole[] | "any"): boolean {
  if (!role) return false
  if (allowed === "any") return true
  return allowed.includes(role)
}

export type RequireRoleResult =
  | { ok: true }
  | { ok: false; reason: "unauthenticated"; redirectTo: string }
  | { ok: false; reason: "forbidden"; redirectTo: string }

/**
 * Pure helper used by the client guard: decides whether a user (or lack of
 * one) may see a page and where to send them otherwise.
 */
export function requireRole(
  user: { role: UserRole } | null | undefined,
  allowed: readonly UserRole[] | "any",
  currentPath: string,
): RequireRoleResult {
  if (!user) {
    return {
      ok: false,
      reason: "unauthenticated",
      redirectTo: `/auth/sign-in?next=${encodeURIComponent(currentPath)}`,
    }
  }
  if (!hasRole(user.role, allowed)) {
    return { ok: false, reason: "forbidden", redirectTo: roleDestination(user.role) }
  }
  return { ok: true }
}

/** Only allow same-origin relative paths for post-login redirects. */
export function safeNextPath(next: string | null | undefined, fallback: string): string {
  if (!next) return fallback
  // Must be a same-origin absolute path: a single leading "/" (not "//" or
  // "/\\", which browsers treat as protocol-relative), no backslashes or
  // control characters anywhere, and never an auth page (redirect loops).
  if (!/^\/(?![\/\\])/.test(next)) return fallback
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return fallback
  if (next.startsWith("/auth/")) return fallback
  return next
}
