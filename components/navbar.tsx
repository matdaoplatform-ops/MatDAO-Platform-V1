"use client"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useRef, useEffect, useCallback } from "react"
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  User,
  Menu,
  Bell,
  ClipboardList,
  ShieldCheck,
  Beaker,
} from "lucide-react"
import { useAuth } from "@/context/auth-context"
import type { UserRole } from "@/lib/auth-routes"
import { supabase } from "@/lib/supabase/client"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

interface NavLink {
  label: string
  href: string
  roles?: readonly UserRole[]
}

const navLinks: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Why Us?", href: "/why-us" },
  { label: "Project", href: "/project" },
  { label: "AI Studio", href: "/ai-studio" },
  { label: "Our Ecosystem", href: "/our-ecosystem" },
  { label: "Co-Founder Match", href: "/co-founder-match" },
  { label: "AI Verification", href: "/ai-auditor", roles: ["researcher", "staff"] },
  { label: "MAT Token", href: "/mattoken" },
  { label: "Guide", href: "/guide" },
]

/** Role-specific shortcuts shown in the account menu and the mobile drawer. */
function roleLinks(role: UserRole): { label: string; href: string; icon: typeof LayoutDashboard }[] {
  switch (role) {
    case "staff":
      return [
        { label: "Review Queue", href: "/tto-portal", icon: ClipboardList },
        { label: "AI Verification", href: "/ai-auditor", icon: ShieldCheck },
      ]
    case "researcher":
      return [
        { label: "Dashboard", href: "/researcher-dashboard", icon: LayoutDashboard },
        { label: "Submit Project", href: "/submit", icon: Beaker },
        { label: "AI Verification", href: "/ai-auditor", icon: ShieldCheck },
      ]
    case "investor":
      return [{ label: "Dashboard", href: "/investor-dashboard", icon: LayoutDashboard }]
    default:
      return []
  }
}

const NOTIFICATION_POLL_MS = 60_000

/** Unread staff notifications (review queue). Polls while the tab is visible. */
function useStaffNotificationCount(enabled: boolean) {
  const [count, setCount] = useState(0)

  const load = useCallback(async () => {
    const { count: c, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_role", "staff")
      .eq("read", false)
    if (!error) setCount(c ?? 0)
  }, [])

  useEffect(() => {
    if (!enabled) {
      setCount(0)
      return
    }
    load()
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load()
    }, NOTIFICATION_POLL_MS)
    const onFocus = () => load()
    window.addEventListener("focus", onFocus)
    return () => {
      clearInterval(timer)
      window.removeEventListener("focus", onFocus)
    }
  }, [enabled, load])

  return count
}

export function Navbar() {
  const pathname = usePathname()
  const { user, signOut, isLoading } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const staffUnread = useStaffNotificationCount(user?.role === "staff")

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Close the drawer on navigation.
  useEffect(() => {
    setMobileOpen(false)
    setDropdownOpen(false)
  }, [pathname])

  const visibleLinks = navLinks.filter((link) => !link.roles || (user && link.roles.includes(user.role)))
  const isActive = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(href))
  const shortcuts = user ? roleLinks(user.role) : []

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur-xl">
      <div className="mx-auto flex h-[60px] max-w-7xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="relative">
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Add%20a%20subheading%284%29-8oEDuOtVsHXvDTX1gdv6hBkwYJak4N.png"
              alt="MatDAO Logo"
              className="h-8 transition-transform group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#6efcff]/20 to-transparent rounded-lg blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </Link>

        <nav className="hidden items-center gap-1 rounded-2xl border border-border/60 bg-secondary/40 px-2 py-1.5 lg:flex backdrop-blur-sm">
          {visibleLinks.map((link) => {
            const active = isActive(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative rounded-xl px-3.5 py-2 text-sm font-medium transition-all duration-200 ${
                  active
                    ? "bg-gradient-to-r from-[#6efcff]/20 to-[#6efcff]/5 text-[#c5fdff] shadow-lg shadow-[#6efcff]/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
              >
                {link.label}
                {active && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-transparent via-[#6efcff] to-transparent rounded-full" />
                )}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-2.5">
          <div className="hidden sm:block">
            <ConnectButton accountStatus="avatar" chainStatus="icon" showBalance={false} />
          </div>

          {user?.role === "staff" && (
            <Link
              href="/tto-portal"
              aria-label={`Review queue, ${staffUnread} unread notifications`}
              className="relative hidden rounded-xl border border-border/60 bg-secondary/40 p-2 text-muted-foreground transition-colors hover:text-foreground sm:flex"
            >
              <Bell className="h-4 w-4" />
              {staffUnread > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#6efcff] px-1 text-[10px] font-bold text-black">
                  {staffUnread > 99 ? "99+" : staffUnread}
                </span>
              )}
            </Link>
          )}

          {isLoading ? (
            <div className="h-8 w-24 animate-pulse rounded-xl bg-secondary/40" aria-hidden="true" />
          ) : user ? (
            <div className="relative hidden md:block" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                aria-haspopup="menu"
                aria-expanded={dropdownOpen}
                className="flex items-center gap-2 rounded-xl border border-border/60 bg-secondary/40 px-3 py-1.5 text-sm text-foreground transition-all duration-200 hover:bg-secondary/60 hover:border-border/80 backdrop-blur-sm"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-[#6efcff]/30 to-[#6efcff]/10 text-xs font-bold text-[#c5fdff] shadow-inner">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="font-medium text-xs">{user.name}</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {dropdownOpen && (
                <div role="menu" className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-border/60 bg-card/95 backdrop-blur-xl p-1.5 shadow-2xl shadow-black/20">
                  <div className="px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Signed in as</p>
                    <p className="truncate text-xs font-medium text-foreground">{user.email}</p>
                    <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] capitalize text-primary">
                      {user.role}
                    </span>
                  </div>
                  <div className="my-1 h-px bg-border/40" />
                  {shortcuts.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      role="menuitem"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-secondary/80 hover:text-foreground transition-colors"
                    >
                      <item.icon className="h-3.5 w-3.5" />
                      <span className="font-medium">{item.label}</span>
                      {item.href === "/tto-portal" && staffUnread > 0 && (
                        <span className="ml-auto rounded-full bg-[#6efcff]/20 px-1.5 text-[10px] font-semibold text-[#c5fdff]">
                          {staffUnread}
                        </span>
                      )}
                    </Link>
                  ))}
                  <Link
                    href="/profile"
                    role="menuitem"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-secondary/80 hover:text-foreground transition-colors"
                  >
                    <User className="h-3.5 w-3.5" />
                    <span className="font-medium">Profile</span>
                  </Link>
                  <div className="my-1 h-px bg-border/40" />
                  <button
                    role="menuitem"
                    onClick={() => {
                      signOut()
                      setDropdownOpen(false)
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span className="font-medium">Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/auth/sign-in"
                className="rounded-xl border border-border/60 bg-secondary/40 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-all duration-200"
              >
                Sign In
              </Link>
              <Link
                href="/auth/sign-up"
                className="rounded-xl bg-gradient-to-r from-[#6efcff] to-[#6efcff]/80 px-3 py-1.5 text-xs font-semibold text-black hover:from-[#6efcff]/90 hover:to-[#6efcff]/70 transition-all duration-200 shadow-lg shadow-[#6efcff]/20"
              >
                Launch App
              </Link>
            </div>
          )}

          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                aria-label="Open menu"
                className="flex items-center justify-center rounded-xl border border-border/60 bg-secondary/40 p-2 text-foreground lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85vw] max-w-sm overflow-y-auto border-border/60 bg-background p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex flex-col gap-1 p-5 pt-14">
                {user ? (
                  <div className="mb-3 flex items-center gap-3 rounded-xl border border-border/60 bg-secondary/40 p-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#6efcff]/30 to-[#6efcff]/10 text-sm font-bold text-[#c5fdff]">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
                      <p className="truncate text-xs capitalize text-muted-foreground">{user.role}</p>
                    </div>
                  </div>
                ) : (
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    <Link
                      href="/auth/sign-in"
                      className="rounded-xl border border-border/60 bg-secondary/40 px-3 py-2.5 text-center text-sm font-medium text-foreground"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/auth/sign-up"
                      className="rounded-xl bg-gradient-to-r from-[#6efcff] to-[#6efcff]/80 px-3 py-2.5 text-center text-sm font-semibold text-black"
                    >
                      Launch App
                    </Link>
                  </div>
                )}

                {shortcuts.length > 0 && (
                  <>
                    <p className="px-2 pt-2 text-[10px] uppercase tracking-wider text-muted-foreground">My workspace</p>
                    {shortcuts.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                          isActive(item.href) ? "bg-[#6efcff]/10 text-[#c5fdff]" : "text-foreground hover:bg-white/5"
                        }`}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                        {item.href === "/tto-portal" && staffUnread > 0 && (
                          <span className="ml-auto rounded-full bg-[#6efcff]/20 px-2 text-[10px] font-semibold text-[#c5fdff]">
                            {staffUnread}
                          </span>
                        )}
                      </Link>
                    ))}
                    <div className="my-2 h-px bg-border/40" />
                  </>
                )}

                <p className="px-2 pt-1 text-[10px] uppercase tracking-wider text-muted-foreground">Explore</p>
                {visibleLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive(link.href) ? "bg-[#6efcff]/10 text-[#c5fdff]" : "text-foreground hover:bg-white/5"
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}

                <div className="my-2 h-px bg-border/40" />
                <div className="px-1 py-1 sm:hidden">
                  <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false} />
                </div>
                {user && (
                  <>
                    <Link
                      href="/profile"
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground hover:bg-white/5"
                    >
                      <User className="h-4 w-4" />
                      Profile
                    </Link>
                    <button
                      onClick={() => {
                        signOut()
                        setMobileOpen(false)
                      }}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-destructive hover:bg-destructive/10"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
