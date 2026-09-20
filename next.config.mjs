/** @type {import('next').NextConfig} */
const nextConfig = {
  // This repository is nested beneath other workspaces. Pin Turbopack to this
  // application so production builds do not traverse an inaccessible parent.
  turbopack: {
    root: process.cwd(),
  },
  // Hosting fallback: the Vercel project stores NEXT_PUBLIC_* Supabase values
  // as write-only secrets that cannot be edited, so accept plain
  // SUPABASE_URL / SUPABASE_ANON_KEY / APP_URL and inline them at build time.
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "",
  },
}

export default nextConfig
