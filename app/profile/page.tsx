"use client"

import { useAuth } from "@/context/auth-context"
import Link from "next/link"
import {
  Mail,
  User,
  Building2,
  Shield,
  Copy,
  Check,
  ExternalLink,
  FileSearch,
  Target,
  Users,
} from "lucide-react"
import { useEffect, useState } from "react"
import { loadUserData } from "@/lib/trl-services/storage"
import type { UserPlatformData } from "@/lib/trl-services/types"
import { formatUsd } from "@/lib/ai-studio/api"
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { RequireAuth } from "@/components/auth/require-auth"

export default function ProfilePage() {
  return (
    <RequireAuth mode="prompt">
      <ProfileContent />
    </RequireAuth>
  )
}

function ProfileContent() {
  const { user } = useAuth()
  const { address, isConnected: walletConnected } = useAccount()
  const [copied, setCopied] = useState(false)
  const [platformData, setPlatformData] = useState<UserPlatformData | null>(null)

  useEffect(() => {
    if (user) setPlatformData(loadUserData(user.id))
  }, [user])

  if (!user) return null

  function handleCopyWallet() {
    if (user?.walletAddress) {
      navigator.clipboard.writeText(user.walletAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="flex flex-col items-center px-4 py-16">
      <div className="w-full max-w-2xl">
        {/* Profile Header */}
        <div className="mb-8 flex flex-col items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/20 text-2xl font-bold text-primary">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">{user.name}</h1>
            <span className="mt-1 inline-block rounded-full bg-primary/10 px-3 py-0.5 text-xs capitalize text-primary">
              {user.role}
            </span>
          </div>
        </div>

        {/* Info Cards */}
        <div className="flex flex-col gap-4">
          {/* Account Info */}
          <div className="rounded-xl border border-border/60 bg-card p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
              <Shield className="h-5 w-5 text-primary" />
              Account Information
            </h2>
            <div className="flex flex-col gap-4">
              {user.email && (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm text-foreground">{user.email}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Role</p>
                  <p className="text-sm capitalize text-foreground">{user.role}</p>
                </div>
              </div>
              {user.university && (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Institution</p>
                    <p className="text-sm text-foreground">{user.university}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Wallet Section */}
          <div className="rounded-xl border border-border/60 bg-card p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
              <Shield className="h-5 w-5 text-primary" />
              Wallet
            </h2>

            {walletConnected && address ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-4 py-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Connected Address</p>
                    <p className="mt-0.5 font-mono text-sm text-foreground">
                      {address}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(address)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    aria-label="Copy wallet address"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-accent" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-accent" />
                  <span className="text-xs text-accent">Connected via {user.walletAddress === address ? 'Email-linked' : 'Wallet only'}</span>
                </div>
                <ConnectButton />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border bg-secondary/30 px-6 py-8">
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">
                    No wallet connected
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Connect your wallet to participate in governance and funding
                  </p>
                </div>
                <ConnectButton />
              </div>
            )}
          </div>

          {/* Assessment Reports */}
          {platformData && platformData.assessments.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-card p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                <FileSearch className="h-5 w-5 text-primary" />
                Project Assessments
              </h2>
              <div className="space-y-3">
                {platformData.assessments.map((a) => (
                  <Link
                    key={a.id}
                    href="/ai-studio/project-assessment/results"
                    onClick={() => {
                      sessionStorage.setItem("matdao-combined-report", JSON.stringify(a))
                    }}
                    className="block rounded-lg border border-border/60 bg-secondary/20 p-4 transition-colors hover:border-primary/50 hover:bg-secondary/30"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-foreground">{a.title}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          TRL {a.summary.trl} · Innovation Score {a.summary.ipScore}
                          {a.summary.valuationUsd ? ` · ${formatUsd(a.summary.valuationUsd)}` : ""}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {new Date(a.createdAt).toLocaleDateString()} at {new Date(a.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Submitted Milestones */}
          {platformData && platformData.submittedMilestones.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-card p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                <Target className="h-5 w-5 text-primary" />
                Submitted Milestones
              </h2>
              <div className="space-y-3">
                {platformData.submittedMilestones.map((m) => (
                  <div key={m.id} className="rounded-lg border border-border/60 bg-secondary/20 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{m.milestoneLabel}</span>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] capitalize text-primary">
                        {m.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{m.projectTitle}</p>
                    <p className="mt-2 text-xs text-foreground/80">{m.description}</p>
                  </div>
                ))}
              </div>
              <Link
                href="/submit/milestone"
                className="mt-3 inline-block text-xs text-primary hover:underline"
              >
                View milestone page →
              </Link>
            </div>
          )}

          {/* Co-founder Match Reports */}
          {platformData && platformData.matchReports.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-card p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                <Users className="h-5 w-5 text-primary" />
                Co-Founder Matches
              </h2>
              <div className="space-y-2">
                {platformData.matchReports.map((m) => (
                  <div key={m.id} className="rounded-lg border border-border/60 bg-secondary/20 px-4 py-3">
                    <p className="text-sm font-medium text-foreground">{m.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(m.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          {user.role === "researcher" && (
            <div className="rounded-xl border border-border/60 bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold text-foreground">
                Quick Actions
              </h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Link
                  href="/submit"
                  className="flex items-center gap-3 rounded-lg border border-border/60 bg-secondary/30 px-4 py-3 text-sm transition-colors hover:bg-secondary/60"
                >
                  <ExternalLink className="h-4 w-4 text-primary" />
                  <span className="text-foreground">Submit New Project</span>
                </Link>
                <Link
                  href="/ai-studio/project-assessment/submit"
                  className="flex items-center gap-3 rounded-lg border border-border/60 bg-secondary/30 px-4 py-3 text-sm transition-colors hover:bg-secondary/60"
                >
                  <FileSearch className="h-4 w-4 text-primary" />
                  <span className="text-foreground">Run Full Assessment</span>
                </Link>
                <Link
                  href="/submit/milestone"
                  className="flex items-center gap-3 rounded-lg border border-border/60 bg-secondary/30 px-4 py-3 text-sm transition-colors hover:bg-secondary/60"
                >
                  <Target className="h-4 w-4 text-primary" />
                  <span className="text-foreground">Milestone Builder</span>
                </Link>
                <Link
                  href="/project"
                  className="flex items-center gap-3 rounded-lg border border-border/60 bg-secondary/30 px-4 py-3 text-sm transition-colors hover:bg-secondary/60"
                >
                  <ExternalLink className="h-4 w-4 text-primary" />
                  <span className="text-foreground">Browse Marketplace</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
