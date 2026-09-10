"use client"

import { useMemo, useState } from "react"
import { useAccount, useReadContract } from "wagmi"
import { formatUnits } from "viem"
import { ArrowUpDown, DollarSign, Coins, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ERC20_ABI, SWAP_ABI } from "@/lib/web3/abis"
import { CONTRACT_ADDRESSES, TARGET_CHAIN_ID, USDC_DECIMALS } from "@/lib/web3/config"
import { useIPTSwap } from "@/lib/web3/hooks/useIPTSwap"
import { safeParseUnits } from "@/lib/web3/tx"

interface LiquiditySwapDeckProps {
  swapAddress?: string
  usdcAddress?: string
  iptAddress?: string
}

const isAddress = (a?: string): a is `0x${string}` => /^0x[0-9a-fA-F]{40}$/.test(a || "")

function fmt(value: bigint | undefined, decimals: number, maxFrac = 4): string {
  if (value === undefined) return "0"
  return Number(formatUnits(value, decimals)).toLocaleString(undefined, { maximumFractionDigits: maxFrac })
}

export function LiquiditySwapDeck({ swapAddress: swapProp, usdcAddress: usdcProp, iptAddress: iptProp }: LiquiditySwapDeckProps) {
  const swapAddress = isAddress(swapProp) ? swapProp : CONTRACT_ADDRESSES.SWAP
  const hasSwap = isAddress(swapAddress)
  const { address } = useAccount()
  const [swapDirection, setSwapDirection] = useState<"USDC_TO_IPT" | "IPT_TO_USDC">("USDC_TO_IPT")
  const [inputAmount, setInputAmount] = useState("")

  const swapRead = { address: swapAddress, abi: SWAP_ABI, chainId: TARGET_CHAIN_ID, query: { enabled: hasSwap } } as const
  const { data: usdcFromContract } = useReadContract({ ...swapRead, functionName: "usdcToken" })
  const { data: iptFromContract } = useReadContract({ ...swapRead, functionName: "iptToken" })
  const { data: liquidityStatus, refetch: refetchLiquidity } = useReadContract({ ...swapRead, functionName: "getLiquidityStatus" })

  const usdcAddress = isAddress(usdcProp) ? usdcProp : usdcFromContract
  const iptAddress = isAddress(iptProp) ? iptProp : iptFromContract

  const { data: iptDecimalsRaw } = useReadContract({
    address: iptAddress,
    abi: ERC20_ABI,
    functionName: "decimals",
    chainId: TARGET_CHAIN_ID,
    query: { enabled: isAddress(iptAddress) },
  })
  const iptDecimals = iptDecimalsRaw ?? 18

  const { data: usdcBalance, refetch: refetchUsdc } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: TARGET_CHAIN_ID,
    query: { enabled: Boolean(address && isAddress(usdcAddress)) },
  })

  const { data: iptBalance, refetch: refetchIpt } = useReadContract({
    address: iptAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: TARGET_CHAIN_ID,
    query: { enabled: Boolean(address && isAddress(iptAddress)) },
  })

  const { swapUSDCForIPT, swapIPTForUSDC, isPending } = useIPTSwap()

  const inputDecimals = swapDirection === "USDC_TO_IPT" ? USDC_DECIMALS : iptDecimals
  const outputDecimals = swapDirection === "USDC_TO_IPT" ? iptDecimals : USDC_DECIMALS
  // Never throws: "" / "1e5" / "abc" simply yield null.
  const parsedInput = useMemo(() => safeParseUnits(inputAmount, inputDecimals), [inputAmount, inputDecimals])

  const { data: quote } = useReadContract({
    ...swapRead,
    functionName: swapDirection === "USDC_TO_IPT" ? "getQuoteUSDCForIPT" : "getQuoteIPTForUSDC",
    args: parsedInput ? [parsedInput] : undefined,
    query: { enabled: hasSwap && parsedInput !== null },
  })

  const outputAmount = quote !== undefined && parsedInput ? fmt(quote, outputDecimals, 6) : ""

  // exchangeRate = USDC base units per ONE whole IPT
  const rateUsdcPerIpt = liquidityStatus ? Number(formatUnits(liquidityStatus[2], USDC_DECIMALS)) : null
  const rateLabel =
    rateUsdcPerIpt === null
      ? "-"
      : swapDirection === "USDC_TO_IPT"
        ? `1 USDC = ${(rateUsdcPerIpt > 0 ? 1 / rateUsdcPerIpt : 0).toLocaleString(undefined, { maximumFractionDigits: 6 })} IPT`
        : `1 IPT = ${rateUsdcPerIpt.toLocaleString(undefined, { maximumFractionDigits: 6 })} USDC`

  const userBalance = swapDirection === "USDC_TO_IPT" ? usdcBalance : iptBalance
  const insufficientBalance = parsedInput !== null && userBalance !== undefined && parsedInput > userBalance
  const insufficientLiquidity =
    quote !== undefined && liquidityStatus !== undefined && (swapDirection === "USDC_TO_IPT" ? liquidityStatus[1] < quote : liquidityStatus[0] < quote)

  const refreshAll = () => {
    void refetchLiquidity()
    void refetchUsdc()
    void refetchIpt()
  }

  const handleSwap = async () => {
    if (!parsedInput || !hasSwap) return
    try {
      if (swapDirection === "USDC_TO_IPT") {
        await swapUSDCForIPT({ swapAddress, usdcAmount: parsedInput })
      } else {
        await swapIPTForUSDC({ swapAddress, iptAmount: parsedInput })
      }
      // Only mutate state after the await, never during render.
      setInputAmount("")
      refreshAll()
    } catch {
      // error toast already shown by the hook
    }
  }

  const disabledReason = !hasSwap
    ? "Swap contract not configured"
    : !address
      ? "Connect Wallet to Swap"
      : parsedInput === null
        ? "Enter an amount"
        : insufficientBalance
          ? "Insufficient balance"
          : insufficientLiquidity
            ? "Insufficient liquidity"
            : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5" />
          Secondary Market Swap
        </CardTitle>
        <CardDescription>Trade IPT tokens for USDC with instant liquidity</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Liquidity Status */}
        {liquidityStatus && (
          <div className="flex items-center justify-between rounded-lg bg-secondary/20 p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4" />
              <span>Available Liquidity</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">USDC</p>
                <p className="font-semibold">{fmt(liquidityStatus[0], USDC_DECIMALS, 2)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">IPT</p>
                <p className="font-semibold">{fmt(liquidityStatus[1], iptDecimals, 2)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Swap Interface */}
        <div className="space-y-4">
          {/* From Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>From</Label>
              <Badge variant="outline" className="text-xs">
                Balance: {fmt(userBalance, inputDecimals)}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Input
                type="text"
                inputMode="decimal"
                value={inputAmount}
                onChange={(e) => setInputAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1"
              />
              <div className="flex min-w-[100px] items-center gap-2 rounded-lg bg-secondary px-4">
                {swapDirection === "USDC_TO_IPT" ? (
                  <>
                    <DollarSign className="h-4 w-4" />
                    <span className="font-medium">USDC</span>
                  </>
                ) : (
                  <>
                    <Coins className="h-4 w-4" />
                    <span className="font-medium">IPT</span>
                  </>
                )}
              </div>
            </div>
            {inputAmount !== "" && parsedInput === null && (
              <p className="text-xs text-red-500">Enter a plain decimal amount (max {inputDecimals} decimals).</p>
            )}
          </div>

          {/* Swap Direction Button */}
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                setSwapDirection(swapDirection === "USDC_TO_IPT" ? "IPT_TO_USDC" : "USDC_TO_IPT")
                setInputAmount("")
              }}
              className="rounded-full"
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>

          {/* To Input */}
          <div className="space-y-2">
            <Label>To (Estimated)</Label>
            <div className="flex gap-2">
              <Input type="text" value={outputAmount} readOnly placeholder="0.00" className="flex-1 bg-muted" />
              <div className="flex min-w-[100px] items-center gap-2 rounded-lg bg-secondary px-4">
                {swapDirection === "USDC_TO_IPT" ? (
                  <>
                    <Coins className="h-4 w-4" />
                    <span className="font-medium">IPT</span>
                  </>
                ) : (
                  <>
                    <DollarSign className="h-4 w-4" />
                    <span className="font-medium">USDC</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Exchange Rate Info */}
          <div className="text-center text-sm text-muted-foreground">Rate: {rateLabel}</div>

          {/* Action Button */}
          <Button onClick={handleSwap} disabled={isPending || disabledReason !== null} className="w-full">
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Swapping...
              </>
            ) : (
              disabledReason ?? "Approve & Swap"
            )}
          </Button>
        </div>

        {/* Info Box */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950">
          <p className="text-xs text-blue-900 dark:text-blue-100">
            <strong>Instant Liquidity:</strong> This fixed-rate swap provides immediate liquidity for your IPT tokens. If the
            token allowance is too low you will be asked to approve first, then to confirm the swap.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
