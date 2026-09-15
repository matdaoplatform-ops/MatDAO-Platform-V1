"use client"

import { useAccount, useReadContract } from "wagmi"
import { formatUnits } from "viem"
import { AlertTriangle, Shield, DollarSign, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ESCROW_ABI } from "@/lib/web3/abis"
import { TARGET_CHAIN_ID, USDC_DECIMALS } from "@/lib/web3/config"
import { useEmergencyRefund } from "@/lib/web3/hooks/useEmergencyRefund"
import { useToggleProjectFailure } from "@/lib/web3/hooks/useToggleProjectFailure"

interface RiskManagementPanelProps {
  escrowAddress: string
  /**
   * Force-show the admin controls. When omitted the panel checks the
   * connected wallet against the escrow's on-chain `owner()`.
   */
  isAdmin?: boolean
}

const isAddress = (a?: string): a is `0x${string}` => /^0x[0-9a-fA-F]{40}$/.test(a || "")

export function RiskManagementPanel({ escrowAddress, isAdmin: isAdminProp }: RiskManagementPanelProps) {
  const { address } = useAccount()
  const hasEscrow = isAddress(escrowAddress)
  const escrow = escrowAddress as `0x${string}`
  const readConfig = { address: escrow, abi: ESCROW_ABI, chainId: TARGET_CHAIN_ID, query: { enabled: hasEscrow } } as const

  const { data: isProjectFailed, refetch: refetchFailed } = useReadContract({ ...readConfig, functionName: "isProjectFailed" })
  const { data: projectFunded } = useReadContract({ ...readConfig, functionName: "projectFunded" })
  const { data: owner } = useReadContract({ ...readConfig, functionName: "owner" })

  const { data: refundEstimate, refetch: refetchEstimate } = useReadContract({
    ...readConfig,
    functionName: "getEmergencyRefundEstimate",
    args: address ? [address] : undefined,
    query: { enabled: hasEscrow && Boolean(address && isProjectFailed) },
  })

  const { toggleProjectFailure, isPending: isToggling } = useToggleProjectFailure()
  const { claimEmergencyRefund, isPending: isRefunding } = useEmergencyRefund()
  const isPending = isToggling || isRefunding

  const isOwner = Boolean(address && owner && address.toLowerCase() === owner.toLowerCase())
  const isAdmin = isAdminProp ?? isOwner

  const handleToggleFailure = async () => {
    try {
      await toggleProjectFailure({ escrowAddress })
      void refetchFailed()
    } catch {
      // toast shown by hook
    }
  }

  const handleClaimRefund = async () => {
    try {
      // The hook approves the caller's full IPT balance first (if needed) and waits for it.
      await claimEmergencyRefund({ escrowAddress })
      void refetchEstimate()
    } catch {
      // toast shown by hook
    }
  }

  const refundAmount = refundEstimate ? Number(formatUnits(refundEstimate, USDC_DECIMALS)) : 0

  const projectFailed = Boolean(isProjectFailed)
  const refund = refundEstimate

  if (!projectFailed && !isAdmin) {
    return null
  }

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Risk Management
        </CardTitle>
        <CardDescription>
          Emergency refund mechanism for failed projects
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {projectFailed ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              <div className="flex-1">
                <p className="font-semibold text-red-900 dark:text-red-100">Project Failed</p>
                <p className="text-sm text-red-700 dark:text-red-300">
                  Emergency refund mechanism is now active
                </p>
              </div>
              <Badge variant="destructive">Emergency Mode</Badge>
            </div>

            {address && refund !== undefined && refund > 0n && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-blue-900 dark:text-blue-100">Your Refund Estimate</span>
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="font-bold text-blue-900 dark:text-blue-100">
                      {refundAmount.toLocaleString()} USDC
                    </span>
                  </div>
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Proportional share of remaining escrow funds
                </p>
              </div>
            )}

            {address && (
              <Button
                onClick={handleClaimRefund}
                disabled={isPending || !refund || refund === 0n}
                className="w-full bg-red-600 hover:bg-red-700"
              >
                {isRefunding ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Claim Proportional Refund"
                )}
              </Button>
            )}
          </div>
        ) : (
          isAdmin && (
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                  <div>
                    <p className="font-semibold text-yellow-900 dark:text-yellow-100">
                      Emergency Refund Activation
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      This will activate the emergency refund mechanism, allowing investors to surrender their IPT tokens and claim a proportional share of remaining escrow funds. This action cannot be undone.
                    </p>
                    {!projectFunded && (
                      <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">Available once the funding goal has been reached.</p>
                    )}
                  </div>
                </div>
              </div>

              <Button
                onClick={handleToggleFailure}
                disabled={isPending || !projectFunded}
                title={!projectFunded ? "The project must be fully funded before it can be declared failed" : undefined}
                variant="destructive"
                className="w-full"
              >
                {isToggling ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Declare Project Failure"
                )}
              </Button>
            </div>
          )
        )}
      </CardContent>
    </Card>
  )
}
