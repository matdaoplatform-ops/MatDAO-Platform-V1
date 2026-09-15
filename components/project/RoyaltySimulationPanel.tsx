"use client"

import { useState } from "react"
import { useAccount, useReadContract } from "wagmi"
import { formatUnits } from "viem"
import { Building2, TrendingUp, DollarSign, Loader2, ArrowDownRight, ArrowUpRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ESCROW_ABI } from "@/lib/web3/abis"
import { TARGET_CHAIN_ID, USDC_DECIMALS } from "@/lib/web3/config"
import { useRoyaltyDeposit } from "@/lib/web3/hooks/useRoyaltyDeposit"
import { useClaimDividends } from "@/lib/web3/hooks/useClaimDividends"
import { safeParseUnits } from "@/lib/web3/tx"

interface RoyaltySimulationPanelProps {
  escrowAddress: string
}

const isAddress = (a?: string): a is `0x${string}` => /^0x[0-9a-fA-F]{40}$/.test(a || "")

export function RoyaltySimulationPanel({ escrowAddress }: RoyaltySimulationPanelProps) {
  const { address } = useAccount()
  const [royaltyInput, setRoyaltyInput] = useState("10000")
  const hasEscrow = isAddress(escrowAddress)
  const escrow = escrowAddress as `0x${string}`

  const { data: totalDividendPool, refetch: refetchPool } = useReadContract({
    address: escrow,
    abi: ESCROW_ABI,
    functionName: "totalDividendPool",
    chainId: TARGET_CHAIN_ID,
    query: { enabled: hasEscrow },
  })

  const { data: claimableDividends, refetch: refetchClaimable } = useReadContract({
    address: escrow,
    abi: ESCROW_ABI,
    functionName: "getClaimableDividends",
    args: address ? [address] : undefined,
    chainId: TARGET_CHAIN_ID,
    query: { enabled: hasEscrow && Boolean(address) },
  })

  const { depositRoyalties, isPending: isDepositing } = useRoyaltyDeposit()
  const { claimDividends, isPending: isClaiming } = useClaimDividends()
  const isPending = isDepositing || isClaiming

  const parsedRoyalty = safeParseUnits(royaltyInput, USDC_DECIMALS)
  const royaltyAmount = parsedRoyalty ? Number(formatUnits(parsedRoyalty, USDC_DECIMALS)) : 0

  const refresh = () => {
    void refetchPool()
    void refetchClaimable()
  }

  const handleDepositRoyalties = async () => {
    if (!parsedRoyalty) return
    try {
      // The hook approves USDC first (waiting for it to be mined) when needed.
      await depositRoyalties({ escrowAddress, amount: parsedRoyalty })
      refresh()
    } catch {
      // toast shown by hook
    }
  }

  const handleClaimDividends = async () => {
    try {
      await claimDividends({ escrowAddress })
      refresh()
    } catch {
      // toast shown by hook
    }
  }

  // Calculate royalty splits
  const daoFee = (royaltyAmount * 10) / 100
  const researcherFee = (royaltyAmount * 30) / 100
  const investorPool = royaltyAmount - daoFee - researcherFee

  const totalPool = totalDividendPool ? Number(formatUnits(totalDividendPool, USDC_DECIMALS)) : 0
  const claimable = claimableDividends ? Number(formatUnits(claimableDividends, USDC_DECIMALS)) : 0

  return (
    <div className="space-y-4">
      {/* Enterprise Portal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Enterprise Portal
          </CardTitle>
          <CardDescription>
            Simulate enterprise licensing royalty payments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="royalty-amount">Licensing Amount (USDC)</Label>
            <Input
              id="royalty-amount"
              type="text"
              inputMode="decimal"
              value={royaltyInput}
              onChange={(e) => setRoyaltyInput(e.target.value)}
              placeholder="Enter amount"
            />
            {royaltyInput !== "" && parsedRoyalty === null && (
              <p className="text-xs text-red-500">Enter a valid USDC amount.</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4 p-4 bg-secondary/20 rounded-lg">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">MatDAO (10%)</p>
              <p className="font-semibold text-primary">${daoFee.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Researcher (30%)</p>
              <p className="font-semibold text-emerald-600">${researcherFee.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">IPT Holders (60%)</p>
              <p className="font-semibold text-blue-600">${investorPool.toLocaleString()}</p>
            </div>
          </div>

          <Button
            onClick={handleDepositRoyalties}
            disabled={isPending || !hasEscrow || !address || parsedRoyalty === null}
            className="w-full"
          >
            {isDepositing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <ArrowDownRight className="mr-2 h-4 w-4" />
                Simulate Enterprise Payment
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Dividend Pool Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Dividend Pool
          </CardTitle>
          <CardDescription>
            Royalty dividends for IPT token holders
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div>
              <p className="text-sm text-blue-900 dark:text-blue-100">Total Dividend Pool</p>
              <p className="text-xs text-blue-700 dark:text-blue-300">Available for IPT holders</p>
            </div>
            <div className="flex items-center gap-1">
              <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {totalPool.toLocaleString()}
              </span>
              <span className="text-sm text-blue-600 dark:text-blue-400">USDC</span>
            </div>
          </div>

          {address && (
            <div className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-lg">
              <div>
                <p className="text-sm text-emerald-900 dark:text-emerald-100">Your Claimable Dividends</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300">Based on your IPT holdings</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                    {claimable.toLocaleString()}
                  </span>
                  <span className="text-sm text-emerald-600 dark:text-emerald-400">USDC</span>
                </div>
                {claimable > 0 && (
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                    Available
                  </Badge>
                )}
              </div>
            </div>
          )}

          {address && (
            <Button
              onClick={handleClaimDividends}
              disabled={isPending || !hasEscrow || claimable === 0}
              className="w-full"
              variant={claimable > 0 ? "default" : "outline"}
            >
              {isClaiming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ArrowUpRight className="mr-2 h-4 w-4" />
                  Claim Dividends
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
