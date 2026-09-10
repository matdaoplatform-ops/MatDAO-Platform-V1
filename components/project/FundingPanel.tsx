"use client"

import { useMemo, useState } from "react"
import { useAccount, useReadContract } from "wagmi"
import { formatUnits } from "viem"
import { DollarSign, CheckCircle, Clock, AlertCircle, ExternalLink } from "lucide-react"
import { useFundProject, useFundingProgress } from "@/lib/web3/hooks/useFundProject"
import { useApproveMilestone } from "@/lib/web3/hooks/useApproveMilestone"
import { useClaimMilestone } from "@/lib/web3/hooks/useClaimMilestone"
import { ESCROW_ABI } from "@/lib/web3/abis"
import { CONTRACT_ADDRESSES, TARGET_CHAIN_ID, USDC_DECIMALS, explorerAddressUrl } from "@/lib/web3/config"
import { safeParseUnits } from "@/lib/web3/tx"

interface Milestone {
  id: number
  description: string
  /** Whole USDC. */
  amount: number
  isApproved: boolean
  isWithdrawn: boolean
}

interface FundingPanelProps {
  projectId: string
  /** Static fallback shown only when no escrow contract is configured. */
  milestones?: Milestone[]
  escrowAddress?: string
  /** Funding token; read from the escrow when omitted. */
  tokenAddress?: string
}

const isAddress = (a?: string): a is `0x${string}` => /^0x[0-9a-fA-F]{40}$/.test(a || "")

function formatUsdc(value: bigint): string {
  return Number(formatUnits(value, USDC_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export function FundingPanel({ projectId, milestones: staticMilestones = [], escrowAddress: escrowProp, tokenAddress }: FundingPanelProps) {
  const escrowAddress = isAddress(escrowProp) ? escrowProp : CONTRACT_ADDRESSES.ESCROW
  const hasEscrow = isAddress(escrowAddress)
  const { address } = useAccount()
  const [fundAmount, setFundAmount] = useState("1000")

  const { fundProject, isPending: isFunding } = useFundProject()
  const { approveMilestone, isPending: isApproving } = useApproveMilestone()
  const { claimMilestone, isPending: isClaiming } = useClaimMilestone()
  const { current, goal, percentage, refetch: refetchProgress } = useFundingProgress(escrowAddress)

  const readConfig = { address: escrowAddress, abi: ESCROW_ABI, chainId: TARGET_CHAIN_ID, query: { enabled: hasEscrow } } as const
  const { data: owner } = useReadContract({ ...readConfig, functionName: "owner" })
  const { data: researcher } = useReadContract({ ...readConfig, functionName: "researcher" })
  const { data: projectFunded } = useReadContract({ ...readConfig, functionName: "projectFunded" })
  const { data: projectFailed } = useReadContract({ ...readConfig, functionName: "isProjectFailed" })
  const { data: onChainMilestones, refetch: refetchMilestones } = useReadContract({ ...readConfig, functionName: "getAllMilestones" })

  const milestones: Milestone[] = useMemo(() => {
    if (!hasEscrow || !onChainMilestones) return staticMilestones
    const [descriptions, amounts, approved, withdrawn] = onChainMilestones
    return descriptions.map((description, i) => ({
      id: i,
      description,
      amount: Number(formatUnits(amounts[i], USDC_DECIMALS)),
      isApproved: approved[i],
      isWithdrawn: withdrawn[i],
    }))
  }, [hasEscrow, onChainMilestones, staticMilestones])

  const isOwner = Boolean(address && owner && address.toLowerCase() === owner.toLowerCase())
  const isResearcher = Boolean(address && researcher && address.toLowerCase() === researcher.toLowerCase())
  const remaining = goal > current ? goal - current : 0n
  const parsedAmount = safeParseUnits(fundAmount, USDC_DECIMALS)
  const amountTooLarge = parsedAmount !== null && parsedAmount > remaining
  const canFund = hasEscrow && Boolean(address) && parsedAmount !== null && !amountTooLarge && !projectFunded && !projectFailed

  const refresh = () => {
    void refetchProgress()
    void refetchMilestones()
  }

  const handleFund = async () => {
    if (!escrowAddress || !parsedAmount) return
    try {
      await fundProject({ amount: parsedAmount, escrowAddress, tokenAddress })
      refresh()
    } catch {
      // error already surfaced via toast by the hook
    }
  }

  const handleApprove = async (milestoneId: number) => {
    if (!escrowAddress) return
    try {
      await approveMilestone({ milestoneId, escrowAddress })
      refresh()
    } catch {
      // toast shown by hook
    }
  }

  const handleClaim = async (milestoneId: number) => {
    if (!escrowAddress) return
    try {
      await claimMilestone({ milestoneId, escrowAddress })
      refresh()
    } catch {
      // toast shown by hook
    }
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card p-6" data-project-id={projectId}>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <DollarSign className="h-5 w-5 text-primary" />
          Funding & Milestones
        </h2>
        {hasEscrow && (
          <a
            href={explorerAddressUrl(escrowAddress)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
          >
            Escrow <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {/* Funding Progress */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Funding Progress</span>
          <span className="text-sm font-semibold text-foreground">
            ${formatUsdc(current)} / ${formatUsdc(goal)} ({Number(percentage)}%)
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-border/40">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(Number(percentage), 100)}%` }}
          />
        </div>
        {projectFailed && (
          <p className="mt-2 text-xs text-red-500">This project has been declared failed. Refunds are open in the Risk Management panel.</p>
        )}
      </div>

      {/* Fund Project - any connected wallet that is neither admin nor researcher */}
      {hasEscrow && address && !isOwner && !isResearcher && !projectFunded && !projectFailed && (
        <div className="mb-6 rounded-lg border border-border/60 bg-secondary/20 p-4">
          <h3 className="mb-3 text-sm font-medium text-foreground">Fund This Project</h3>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              inputMode="decimal"
              value={fundAmount}
              onChange={(e) => setFundAmount(e.target.value)}
              className="w-32 rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground"
              placeholder="Amount"
            />
            <span className="text-sm text-muted-foreground">USDC</span>
            <button
              onClick={handleFund}
              disabled={isFunding || !canFund}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isFunding ? "Funding..." : "Fund"}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {amountTooLarge
              ? `Amount exceeds the remaining goal (${formatUsdc(remaining)} USDC).`
              : parsedAmount === null && fundAmount !== ""
                ? "Enter a valid USDC amount (up to 6 decimals)."
                : `Remaining to goal: ${formatUsdc(remaining)} USDC. Approval and funding are two wallet confirmations.`}
          </p>
        </div>
      )}

      {hasEscrow && !address && (
        <p className="mb-6 text-xs text-muted-foreground">Connect a wallet on Sepolia to fund this project or manage milestones.</p>
      )}

      {/* Milestones */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">Milestones</h3>
        {milestones.length === 0 && (
          <p className="text-xs text-muted-foreground">{hasEscrow ? "Loading milestones from the escrow contract..." : "No milestones defined."}</p>
        )}
        {milestones.map((milestone) => (
          <div key={milestone.id} className="rounded-lg border border-border/60 bg-secondary/20 p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{milestone.description}</span>
                  {milestone.isApproved && !milestone.isWithdrawn && <CheckCircle className="h-4 w-4 text-emerald-500" />}
                  {milestone.isWithdrawn && <CheckCircle className="h-4 w-4 text-primary" />}
                  {!milestone.isApproved && <Clock className="h-4 w-4 text-muted-foreground" />}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  ${milestone.amount.toLocaleString()} USDC
                  {milestone.isWithdrawn ? " - claimed" : milestone.isApproved ? " - approved, awaiting claim" : " - pending approval"}
                </p>
              </div>
              <div className="flex gap-2">
                {isOwner && !milestone.isApproved && (
                  <button
                    onClick={() => handleApprove(milestone.id)}
                    disabled={isApproving || !projectFunded || Boolean(projectFailed)}
                    title={!projectFunded ? "The funding goal must be reached before milestones can be approved" : undefined}
                    className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
                  >
                    {isApproving ? "Approving..." : "Approve"}
                  </button>
                )}
                {isResearcher && milestone.isApproved && !milestone.isWithdrawn && (
                  <button
                    onClick={() => handleClaim(milestone.id)}
                    disabled={isClaiming || Boolean(projectFailed)}
                    className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-500 hover:bg-emerald-500/20 disabled:opacity-50"
                  >
                    {isClaiming ? "Claiming..." : "Claim"}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {!hasEscrow && (
        <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 text-amber-500" />
            <p className="text-xs text-amber-400">
              Smart contract not deployed. Set NEXT_PUBLIC_MATDAO_ESCROW_ADDRESS (or pass escrowAddress) to enable funding and milestone actions.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
