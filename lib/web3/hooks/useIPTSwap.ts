"use client"

import { useCallback } from "react"
import type { Hash } from "viem"
import { ERC20_ABI, SWAP_ABI } from "@/lib/web3/abis"
import { CONTRACT_ADDRESSES, requireAddress } from "@/lib/web3/config"
import { Web3UserError, ensureAllowance } from "@/lib/web3/tx"
import { useWeb3Tx } from "./useWeb3Tx"

interface SwapUSDCForIPTParams {
  swapAddress?: string
  /** USDC amount in base units (6 decimals). */
  usdcAmount: bigint
}

interface SwapIPTForUSDCParams {
  swapAddress?: string
  /** IPT amount in base units (read `decimals()` - MockIPT uses 18). */
  iptAmount: bigint
}

interface ApproveTokenParams {
  tokenAddress: string
  spenderAddress: string
  /** Base units. */
  amount: bigint
}

/**
 * MatDAO_Swap fixed-rate secondary market. Each swap approves the input token
 * only when the allowance is insufficient, waits for the approval to be mined,
 * then executes the swap and waits for it.
 */
export function useIPTSwap() {
  const { run, isPending, isSuccess, hash, error } = useWeb3Tx()

  const approveToken = useCallback(
    async ({ tokenAddress, spenderAddress, amount }: ApproveTokenParams): Promise<Hash | null> =>
      run({ toastId: "approve-token", pending: "Checking allowance...", success: "Token spend approved!" }, (ctx) =>
        ensureAllowance({
          publicClient: ctx.publicClient,
          writeContractAsync: ctx.writeContractAsync,
          token: requireAddress(tokenAddress, "Token"),
          owner: ctx.account,
          spender: requireAddress(spenderAddress, "Spender"),
          amount,
          onStatus: ctx.status,
        }),
      ),
    [run],
  )

  const swapUSDCForIPT = useCallback(
    async ({ swapAddress, usdcAmount }: SwapUSDCForIPTParams): Promise<Hash> =>
      run({ toastId: "swap-usdc-ipt", pending: "Preparing swap...", success: "Swapped USDC for IPT!" }, async (ctx) => {
        if (usdcAmount <= 0n) throw new Web3UserError("Enter an amount greater than zero.")
        const swap = requireAddress(swapAddress ?? CONTRACT_ADDRESSES.SWAP, "Swap contract")
        const [usdc, quote, liquidity] = await Promise.all([
          ctx.publicClient.readContract({ address: swap, abi: SWAP_ABI, functionName: "usdcToken" }),
          ctx.publicClient.readContract({ address: swap, abi: SWAP_ABI, functionName: "getQuoteUSDCForIPT", args: [usdcAmount] }),
          ctx.publicClient.readContract({ address: swap, abi: SWAP_ABI, functionName: "getLiquidityStatus" }),
        ])
        if (quote <= 0n) throw new Web3UserError("Amount too small for the current exchange rate.")
        if (liquidity[1] < quote) throw new Web3UserError("Not enough IPT liquidity in the swap contract.")

        ctx.status("Checking USDC allowance...")
        await ensureAllowance({ publicClient: ctx.publicClient, writeContractAsync: ctx.writeContractAsync, token: usdc, owner: ctx.account, spender: swap, amount: usdcAmount, onStatus: ctx.status })

        ctx.status("Confirm the swap in your wallet...")
        return ctx.writeAndWait({ address: swap, abi: SWAP_ABI, functionName: "swapUSDCForIPT", args: [usdcAmount] })
      }),
    [run],
  )

  const swapIPTForUSDC = useCallback(
    async ({ swapAddress, iptAmount }: SwapIPTForUSDCParams): Promise<Hash> =>
      run({ toastId: "swap-ipt-usdc", pending: "Preparing swap...", success: "Swapped IPT for USDC!" }, async (ctx) => {
        if (iptAmount <= 0n) throw new Web3UserError("Enter an amount greater than zero.")
        const swap = requireAddress(swapAddress ?? CONTRACT_ADDRESSES.SWAP, "Swap contract")
        const [ipt, quote, liquidity] = await Promise.all([
          ctx.publicClient.readContract({ address: swap, abi: SWAP_ABI, functionName: "iptToken" }),
          ctx.publicClient.readContract({ address: swap, abi: SWAP_ABI, functionName: "getQuoteIPTForUSDC", args: [iptAmount] }),
          ctx.publicClient.readContract({ address: swap, abi: SWAP_ABI, functionName: "getLiquidityStatus" }),
        ])
        if (quote <= 0n) throw new Web3UserError("Amount too small for the current exchange rate.")
        if (liquidity[0] < quote) throw new Web3UserError("Not enough USDC liquidity in the swap contract.")

        ctx.status("Checking IPT allowance...")
        await ensureAllowance({ publicClient: ctx.publicClient, writeContractAsync: ctx.writeContractAsync, token: ipt, owner: ctx.account, spender: swap, amount: iptAmount, onStatus: ctx.status })

        ctx.status("Confirm the swap in your wallet...")
        return ctx.writeAndWait({ address: swap, abi: SWAP_ABI, functionName: "swapIPTForUSDC", args: [iptAmount] })
      }),
    [run],
  )

  return { approveToken, swapUSDCForIPT, swapIPTForUSDC, isPending, isSuccess, hash, error }
}

/** Re-exported for components that need the generic ERC-20 surface. */
export { ERC20_ABI }
