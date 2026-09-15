"use client"

import { useCallback } from "react"
import { useReadContract } from "wagmi"
import type { Hash } from "viem"
import { SWAP_ROUTER_ABI } from "@/lib/web3/abis"
import { CONTRACT_ADDRESSES, TARGET_CHAIN_ID, requireAddress } from "@/lib/web3/config"
import { Web3UserError, ensureAllowance } from "@/lib/web3/tx"
import { useWeb3Tx } from "./useWeb3Tx"

interface SwapETHForUSDCParams {
  /** Defaults to NEXT_PUBLIC_MOCK_USDC_ADDRESS. */
  usdcAddress?: string
  /** Wei. */
  ethAmount: bigint
}

interface SwapUSDCForETHParams {
  usdcAddress?: string
  /** USDC base units (6 decimals). */
  usdcAmount: bigint
}

/** ETH <-> USDC through the demo SwapRouter (NEXT_PUBLIC_SWAP_ROUTER_ADDRESS). */
export function useSwap() {
  const { run, isPending, isSuccess, hash, error } = useWeb3Tx()

  const swapETHForUSDC = useCallback(
    async ({ usdcAddress, ethAmount }: SwapETHForUSDCParams): Promise<Hash> =>
      run({ toastId: "swap-eth", pending: "Swapping ETH for USDC...", success: "Swap completed!" }, async (ctx) => {
        if (ethAmount <= 0n) throw new Web3UserError("Enter an amount greater than zero.")
        const router = requireAddress(CONTRACT_ADDRESSES.SWAP_ROUTER, "Swap router")
        const usdc = requireAddress(usdcAddress ?? CONTRACT_ADDRESSES.MOCK_USDC, "USDC")
        ctx.status("Confirm the swap in your wallet...")
        return ctx.writeAndWait({ address: router, abi: SWAP_ROUTER_ABI, functionName: "swapETHForUSDC", args: [usdc], value: ethAmount })
      }),
    [run],
  )

  const swapUSDCForETH = useCallback(
    async ({ usdcAddress, usdcAmount }: SwapUSDCForETHParams): Promise<Hash> =>
      run({ toastId: "swap-usdc", pending: "Preparing swap...", success: "Swap completed!" }, async (ctx) => {
        if (usdcAmount <= 0n) throw new Web3UserError("Enter an amount greater than zero.")
        const router = requireAddress(CONTRACT_ADDRESSES.SWAP_ROUTER, "Swap router")
        const usdc = requireAddress(usdcAddress ?? CONTRACT_ADDRESSES.MOCK_USDC, "USDC")

        ctx.status("Checking USDC allowance...")
        await ensureAllowance({ publicClient: ctx.publicClient, writeContractAsync: ctx.writeContractAsync, token: usdc, owner: ctx.account, spender: router, amount: usdcAmount, onStatus: ctx.status })

        ctx.status("Confirm the swap in your wallet...")
        return ctx.writeAndWait({ address: router, abi: SWAP_ROUTER_ABI, functionName: "swapUSDCForETH", args: [usdc, usdcAmount] })
      }),
    [run],
  )

  return { swapETHForUSDC, swapUSDCForETH, isPending, isSuccess, hash, error }
}

const USDC_SCALE = 1_000_000n
const WEI_PER_ETH = 1_000_000_000_000_000_000n

/** Reads SwapRouter.getExchangeRate() and mirrors the contract's quote math. */
export function useSwapQuotes() {
  const router = CONTRACT_ADDRESSES.SWAP_ROUTER
  const { data: exchangeRate, isLoading: isLoadingRate } = useReadContract({
    address: router,
    abi: SWAP_ROUTER_ABI,
    functionName: "getExchangeRate",
    chainId: TARGET_CHAIN_ID,
    query: { enabled: Boolean(router) },
  })

  /** wei -> USDC base units */
  const getQuoteETHForUSDC = (ethAmount: bigint) => {
    if (!exchangeRate) return 0n
    return (ethAmount * exchangeRate[1] * USDC_SCALE) / WEI_PER_ETH
  }

  /** USDC base units -> wei */
  const getQuoteUSDCForETH = (usdcAmount: bigint) => {
    if (!exchangeRate) return 0n
    return (usdcAmount * exchangeRate[0]) / USDC_SCALE
  }

  return { getQuoteETHForUSDC, getQuoteUSDCForETH, isLoadingRate, exchangeRate }
}
