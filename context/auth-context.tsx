"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react"
import type { Session, User as SupabaseUser } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase/client"
import type { Database, ProfileRow, UserRole } from "@/lib/supabase/client"
import { isSelfServiceRole, type SelfServiceRole } from "@/lib/auth-routes"
import { useAccount, useConnect, useDisconnect } from "wagmi"
import { injected, walletConnect } from "wagmi/connectors"

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  walletAddress: string | null
  university: string | null
  avatarUrl: string | null
  /** OAuth provider that created the account (e.g. "google"), if any. */
  provider: string | null
  /** True when the account was created via OAuth and never completed onboarding. */
  needsOnboarding: boolean
}

export interface SignUpInput {
  email: string
  password: string
  name: string
  role: SelfServiceRole
  university?: string
}

export interface SignUpResult {
  user: User | null
  /** True when Supabase requires the user to confirm their email before a session exists. */
  needsEmailConfirmation: boolean
}

interface AuthContextType {
  user: User | null
  session: Session | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<User | undefined>
  signInWithGoogle: (next?: string) => Promise<void>
  signUp: (data: SignUpInput) => Promise<SignUpResult>
  signOut: () => Promise<void>
  /** Re-read the profile row for the current session. */
  refreshProfile: () => Promise<User | null>
  /** Create the profile row when the DB trigger is not installed (id = auth.uid()). */
  ensureProfile: (sessionUser: SupabaseUser) => Promise<User | null>
  /** Update editable profile fields (name / role / university). */
  updateProfile: (patch: { name?: string; role?: SelfServiceRole; university?: string | null }) => Promise<User>
  getAccessToken: () => Promise<string | null>
  connectWallet: () => Promise<void>
  disconnectWallet: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

const ONBOARDING_FLAG = "onboarding_pending"

function profileToUser(profile: ProfileRow, sessionUser?: SupabaseUser | null): User {
  const provider =
    (sessionUser?.app_metadata?.provider as string | undefined) ??
    (sessionUser?.identities?.[0]?.provider as string | undefined) ??
    null
  const metaFlag = sessionUser?.user_metadata?.[ONBOARDING_FLAG]
  const needsOnboarding =
    provider != null && provider !== "email" && (metaFlag === true || metaFlag === undefined) && !profile.university && profile.role === "researcher"
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role,
    walletAddress: profile.wallet_address,
    university: profile.university,
    avatarUrl: profile.avatar_url ?? null,
    provider,
    needsOnboarding,
  }
}

/** Turn a Supabase auth error into something a person can act on. */
export function describeAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "")
  const lower = message.toLowerCase()
  if (lower.includes("email not confirmed")) {
    return "Your email address has not been confirmed yet. Check your inbox for the confirmation link."
  }
  if (lower.includes("invalid login credentials") || lower.includes("invalid credentials")) {
    return "Incorrect email or password."
  }
  if (lower.includes("rate limit") || lower.includes("too many requests") || lower.includes("429")) {
    return "Too many attempts. Please wait a few minutes and try again."
  }
  if (lower.includes("user already registered") || lower.includes("already been registered")) {
    return "This email is already registered. Please sign in instead."
  }
  if (lower.includes("password should be")) {
    return message
  }
  if (lower.includes("signups not allowed")) {
    return "Sign-ups are currently disabled. Please contact the MatDAO team."
  }
  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return "Could not reach the authentication service. Check your connection and try again."
  }
  return message || "Something went wrong. Please try again."
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()
  const userRef = useRef<User | null>(null)
  userRef.current = user

  const loadUserProfile = useCallback(
    async (sessionUser: SupabaseUser): Promise<User | null> => {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", sessionUser.id)
        .maybeSingle()

      if (error) {
        console.error("Error loading profile:", error.message)
        return null
      }
      if (!profile) return null
      const loaded = profileToUser(profile, sessionUser)
      setUser(loaded)
      return loaded
    },
    [],
  )

  /**
   * Fallback for projects where the `handle_new_user` trigger is not (yet)
   * installed: create the profile row from the session's metadata. The
   * profiles INSERT policy allows `auth.uid() = id`.
   */
  const ensureProfile = useCallback(
    async (sessionUser: SupabaseUser): Promise<User | null> => {
      const existing = await loadUserProfile(sessionUser)
      if (existing) return existing

      const meta = (sessionUser.user_metadata ?? {}) as Record<string, unknown>
      const requestedRole = meta.role
      const role: SelfServiceRole = isSelfServiceRole(requestedRole) ? requestedRole : "researcher"
      const name =
        (typeof meta.name === "string" && meta.name.trim()) ||
        (typeof meta.full_name === "string" && meta.full_name.trim()) ||
        sessionUser.email?.split("@")[0] ||
        "New user"
      const avatar =
        (typeof meta.avatar_url === "string" && meta.avatar_url) ||
        (typeof meta.picture === "string" && meta.picture) ||
        null

      const { error } = await supabase.from("profiles").upsert(
        {
          id: sessionUser.id,
          email: sessionUser.email ?? `${sessionUser.id}@no-email.local`,
          name,
          role,
          university: typeof meta.university === "string" && meta.university ? meta.university : null,
          avatar_url: avatar,
        },
        { onConflict: "id", ignoreDuplicates: true },
      )
      if (error) {
        console.error("Could not create profile:", error.message)
        return null
      }
      return loadUserProfile(sessionUser)
    },
    [loadUserProfile],
  )

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      const {
        data: { session: current },
      } = await supabase.auth.getSession()
      if (cancelled) return
      setSession(current)
      if (current?.user) {
        await ensureProfile(current.user)
      }
      if (!cancelled) setIsLoading(false)
    }
    bootstrap()

    // IMPORTANT: never await Supabase calls inside the listener itself — the
    // client holds an internal lock while dispatching and awaiting inside it
    // can deadlock. Defer the work to the next macrotask instead.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === "SIGNED_OUT") {
        setUser(null)
        setIsLoading(false)
        return
      }
      if (
        (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED" || event === "INITIAL_SESSION") &&
        nextSession?.user
      ) {
        const sessionUser = nextSession.user
        setTimeout(() => {
          if (cancelled) return
          const shouldLoad =
            event !== "TOKEN_REFRESHED" || !userRef.current || userRef.current.id !== sessionUser.id
          const run = shouldLoad ? ensureProfile(sessionUser) : Promise.resolve(userRef.current)
          run.finally(() => {
            if (!cancelled) setIsLoading(false)
          })
        }, 0)
      } else if (!nextSession) {
        setIsLoading(false)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [ensureProfile])

  // Keep the linked wallet address in sync with the connected wallet.
  useEffect(() => {
    const sync = async () => {
      if (!user) return
      if (isConnected && address && user.walletAddress !== address) {
        const { error } = await supabase.from("profiles").update({ wallet_address: address }).eq("id", user.id)
        if (!error) setUser({ ...user, walletAddress: address })
        else console.error("Error updating wallet address:", error.message)
      }
    }
    sync()
  }, [isConnected, address, user])

  const refreshProfile = useCallback(async () => {
    const {
      data: { session: current },
    } = await supabase.auth.getSession()
    if (!current?.user) {
      setUser(null)
      return null
    }
    return loadUserProfile(current.user)
  }, [loadUserProfile])

  const getAccessToken = useCallback(async () => {
    const {
      data: { session: current },
    } = await supabase.auth.getSession()
    return current?.access_token ?? null
  }, [])

  const signIn = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true)
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw new Error(describeAuthError(error))
        if (data.user) {
          const loaded = await ensureProfile(data.user)
          return loaded ?? undefined
        }
        return undefined
      } finally {
        setIsLoading(false)
      }
    },
    [ensureProfile],
  )

  const signInWithGoogle = useCallback(async (next?: string) => {
    const callback = new URL("/auth/callback", window.location.origin)
    if (next) callback.searchParams.set("next", next)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callback.toString(),
        queryParams: { access_type: "offline", prompt: "select_account" },
      },
    })
    if (error) throw new Error(describeAuthError(error))
  }, [])

  const signUp = useCallback(
    async (data: SignUpInput): Promise<SignUpResult> => {
      setIsLoading(true)
      try {
        const role: SelfServiceRole = isSelfServiceRole(data.role) ? data.role : "researcher"
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              name: data.name,
              full_name: data.name,
              role,
              university: data.university || null,
            },
          },
        })

        if (authError) throw new Error(describeAuthError(authError))

        // Supabase returns a user with an empty identities array when the
        // email is already registered (and confirmation is enabled).
        if (authData.user && Array.isArray(authData.user.identities) && authData.user.identities.length === 0) {
          throw new Error("This email is already registered. Please sign in instead.")
        }

        if (!authData.session) {
          return { user: null, needsEmailConfirmation: true }
        }

        setSession(authData.session)
        const loaded = authData.user ? await ensureProfile(authData.user) : null
        return { user: loaded, needsEmailConfirmation: false }
      } finally {
        setIsLoading(false)
      }
    },
    [ensureProfile],
  )

  const updateProfile = useCallback(
    async (patch: { name?: string; role?: SelfServiceRole; university?: string | null }) => {
      const current = userRef.current
      if (!current) throw new Error("Not signed in")
      const update: Database["public"]["Tables"]["profiles"]["Update"] = {}
      if (patch.name !== undefined) update.name = patch.name
      if (patch.university !== undefined) update.university = patch.university
      // Role changes are only allowed between self-service roles (never staff).
      if (patch.role !== undefined && isSelfServiceRole(patch.role) && current.role !== "staff") {
        update.role = patch.role
      }
      const { data, error } = await supabase
        .from("profiles")
        .update(update)
        .eq("id", current.id)
        .select("*")
        .single()
      if (error) throw new Error(error.message)

      // Clear the onboarding flag in auth metadata (best effort).
      await supabase.auth.updateUser({ data: { [ONBOARDING_FLAG]: false } }).catch(() => undefined)

      const {
        data: { session: s },
      } = await supabase.auth.getSession()
      const next = { ...profileToUser(data, s?.user), needsOnboarding: false }
      setUser(next)
      return next
    },
    [],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
  }, [])

  const connectWallet = useCallback(async () => {
    setIsLoading(true)
    try {
      if (!user) {
        throw new Error("Please sign in with your email first before connecting your wallet.")
      }

      try {
        await connect({ connector: injected() })
      } catch {
        const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
        if (!projectId) {
          throw new Error("No browser wallet found and WalletConnect is not configured.")
        }
        try {
          await connect({ connector: walletConnect({ projectId }) })
        } catch (wcError) {
          if (wcError instanceof Error && /time(d)? ?out/i.test(wcError.message)) {
            throw new Error("Wallet connection timed out. Please check your wallet and try again.")
          }
          throw new Error("Failed to connect wallet. Please ensure you have a wallet installed or use a mobile wallet app.")
        }
      }

      const maxWaitTime = 10000
      const startTime = Date.now()
      while (!address && Date.now() - startTime < maxWaitTime) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      if (!address) {
        throw new Error("Wallet connection timeout. Please ensure your wallet is unlocked and try again.")
      }

      const { error } = await supabase.from("profiles").update({ wallet_address: address }).eq("id", user.id)
      if (error) throw new Error(describeAuthError(error))
      setUser({ ...user, walletAddress: address })
    } finally {
      setIsLoading(false)
    }
  }, [user, connect, address])

  const disconnectWallet = useCallback(async () => {
    await disconnect()
    if (user) {
      const { error } = await supabase.from("profiles").update({ wallet_address: null }).eq("id", user.id)
      if (error) throw new Error(error.message)
      setUser({ ...user, walletAddress: null })
    }
  }, [user, disconnect])

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        signIn,
        signInWithGoogle,
        signUp,
        signOut,
        refreshProfile,
        ensureProfile,
        updateProfile,
        getAccessToken,
        connectWallet,
        disconnectWallet,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
