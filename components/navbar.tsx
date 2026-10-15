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
  Wallet,
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

/** Shown directly in the desktop pill; every other link sits under "More". The logo is the Home link. */
const PRIMARY = new Set(["/why-us", "/project", "/ai-studio", "/mattoken", "/guide"])

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

/**
 * Wallet control in the navbar's own style (RainbowKit's documented custom
 * button): connect, wrong-network and connected states, same modals as before.
 */
function NavWallet() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openConnectModal, openAccountModal, openChainModal }) => {
        if (!mounted) return <div className="app-nav-wallet-btn opacity-0" aria-hidden="true" />
        if (!account || !chain) {
          return (
            <button type="button" onClick={openConnectModal} className="app-nav-wallet-btn">
              <Wallet aria-hidden="true" />
              <span>Connect wallet</span>
            </button>
          )
        }
        if (chain.unsupported) {
          return (
            <button type="button" onClick={openChainModal} className="app-nav-wallet-btn is-warning">
              Wrong network
            </button>
          )
        }
        return (
          <button type="button" onClick={openAccountModal} className="app-nav-wallet-btn is-connected">
            <span className="app-nav-wallet-dot" aria-hidden="true" />
            <span>{account.displayName}</span>
          </button>
        )
      }}
    </ConnectButton.Custom>
  )
}

/** Hides the bar while scrolling down and brings it back on any scroll up. */
function useHideOnScroll() {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    let last = window.scrollY
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const y = window.scrollY
        if (y > last + 4 && y > 160) setHidden(true)
        else if (y < last - 4 || y < 80) setHidden(false)
        if (Math.abs(y - last) > 4) last = y
      })
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(frame)
    }
  }, [])
  return hidden
}

export function Navbar() {
  const pathname = usePathname()
  const { user, signOut, isLoading } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const staffUnread = useStaffNotificationCount(user?.role === "staff")
  const scrolledAway = useHideOnScroll()
  const hidden = scrolledAway && !dropdownOpen && !mobileOpen
  const onLanding = pathname === "/"

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
  const primaryLinks = visibleLinks.filter((l) => PRIMARY.has(l.href))
  const moreLinks = visibleLinks.filter((l) => !PRIMARY.has(l.href) && l.href !== "/")
  const isActive = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(href))
  const moreActive = moreLinks.some((l) => isActive(l.href))
  const shortcuts = user ? roleLinks(user.role) : []

  return (
    <header
      className={`app-nav ${onLanding ? "app-nav--overlay" : ""} ${hidden ? "is-hidden" : ""}`}
      data-landing={onLanding ? "" : undefined}
    >
      <div className="app-nav-inner">
        <Link href="/" className="app-nav-logo" aria-label="MatDAO home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/marketing/matdao-logo.png" alt="MatDAO" width={140} height={37} />
        </Link>

        <nav className="app-nav-pill" aria-label="Main">
          {primaryLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={`app-nav-link ${isActive(link.href) ? "is-active" : ""}`}
            >
              {link.label}
            </Link>
          ))}
          {moreLinks.length > 0 && (
            <div className="app-nav-dd">
              <button type="button" className={`app-nav-link ${moreActive ? "is-active" : ""}`} aria-haspopup="true">
                More <ChevronDown aria-hidden="true" />
              </button>
              <div className="app-nav-menu">
                {moreLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={isActive(link.href) ? "page" : undefined}
                    className={isActive(link.href) ? "is-active" : ""}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </nav>

        <div className="app-nav-right">
          <div className="app-nav-wallet">
            <NavWallet />
          </div>

          {user?.role === "staff" && (
            <Link
              href="/tto-portal"
              aria-label={`Review queue, ${staffUnread} unread notifications`}
              className="app-nav-icon relative hidden sm:flex"
            >
              <Bell className="h-4 w-4" />
              {staffUnread > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#38e1ff] px-1 text-[10px] font-bold text-black">
                  {staffUnread > 99 ? "99+" : staffUnread}
                </span>
              )}
            </Link>
          )}

          {isLoading ? (
            <div className="hidden h-9 w-28 animate-pulse rounded-full bg-white/5 md:block" aria-hidden="true" />
          ) : user ? (
            <div className="relative hidden md:block" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                aria-haspopup="menu"
                aria-expanded={dropdownOpen}
                className="app-nav-account"
              >
                <span className="app-nav-avatar">{user.name.charAt(0).toUpperCase()}</span>
                <span className="max-w-[9rem] truncate">{user.name}</span>
                <ChevronDown className={`h-3.5 w-3.5 opacity-60 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {dropdownOpen && (
                <div role="menu" className="app-nav-panel absolute right-0 top-full mt-2 w-56">
                  <div className="px-3 py-2">
                    <p className="app-mono text-[10px] text-muted-foreground">Signed in as</p>
                    <p className="truncate text-xs font-medium text-foreground">{user.email}</p>
                    <span className="mt-1 inline-block rounded-full bg-[#38e1ff]/10 px-2 py-0.5 text-[10px] capitalize text-[#8ff0ff]">
                      {user.role}
                    </span>
                  </div>
                  <div className="my-1 h-px bg-white/10" />
                  {shortcuts.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      role="menuitem"
                      onClick={() => setDropdownOpen(false)}
                      className="app-nav-panel-item"
                    >
                      <item.icon className="h-3.5 w-3.5" />
                      <span>{item.label}</span>
                      {item.href === "/tto-portal" && staffUnread > 0 && (
                        <span className="ml-auto rounded-full bg-[#38e1ff]/20 px-1.5 text-[10px] font-semibold text-[#8ff0ff]">
                          {staffUnread}
                        </span>
                      )}
                    </Link>
                  ))}
                  <Link href="/profile" role="menuitem" onClick={() => setDropdownOpen(false)} className="app-nav-panel-item">
                    <User className="h-3.5 w-3.5" />
                    <span>Profile</span>
                  </Link>
                  <div className="my-1 h-px bg-white/10" />
                  <button
                    role="menuitem"
                    onClick={() => {
                      signOut()
                      setDropdownOpen(false)
                    }}
                    className="app-nav-panel-item w-full text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden items-center gap-4 md:flex">
              <Link href="/auth/sign-in" className="app-nav-signin">
                Sign In
              </Link>
              <Link href="/auth/sign-up" className="app-nav-cta">
                Launch App
              </Link>
            </div>
          )}

          {/* Mobile and tablet menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button aria-label="Open menu" className="app-nav-burger">
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="app-nav-sheet w-[85vw] max-w-sm overflow-y-auto p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex flex-col gap-1 p-5 pt-14">
                {user ? (
                  <div className="mb-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <span className="app-nav-avatar h-9 w-9 text-sm">{user.name.charAt(0).toUpperCase()}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
                      <p className="truncate text-xs capitalize text-muted-foreground">{user.role}</p>
                    </div>
                  </div>
                ) : (
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    <Link href="/auth/sign-in" className="app-nav-sheet-btn">
                      Sign In
                    </Link>
                    <Link href="/auth/sign-up" className="app-nav-sheet-btn app-nav-sheet-btn--primary">
                      Launch App
                    </Link>
                  </div>
                )}

                {shortcuts.length > 0 && (
                  <>
                    <p className="app-mono px-2 pt-2 text-[10px] text-muted-foreground">My workspace</p>
                    {shortcuts.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`app-nav-sheet-link ${isActive(item.href) ? "is-active" : ""}`}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                        {item.href === "/tto-portal" && staffUnread > 0 && (
                          <span className="ml-auto rounded-full bg-[#38e1ff]/20 px-2 text-[10px] font-semibold text-[#8ff0ff]">
                            {staffUnread}
                          </span>
                        )}
                      </Link>
                    ))}
                    <div className="my-2 h-px bg-white/10" />
                  </>
                )}

                <p className="app-mono px-2 pt-1 text-[10px] text-muted-foreground">Explore</p>
                {visibleLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`app-nav-sheet-link ${isActive(link.href) ? "is-active" : ""}`}
                  >
                    {link.label}
                  </Link>
                ))}

                <div className="my-2 h-px bg-white/10" />
                <div className="px-1 py-1 sm:hidden">
                  <NavWallet />
                </div>
                {user && (
                  <>
                    <Link href="/profile" className="app-nav-sheet-link">
                      <User className="h-4 w-4" />
                      Profile
                    </Link>
                    <button
                      onClick={() => {
                        signOut()
                        setMobileOpen(false)
                      }}
                      className="app-nav-sheet-link text-left text-destructive hover:bg-destructive/10"
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
