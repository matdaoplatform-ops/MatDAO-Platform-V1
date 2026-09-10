"use client"

import { useCallback } from "react"
import { useReadContract } from "wagmi"
import type { Hash } from "viem"
import { ESCROW_ABI } from "@/lib/web3/abis"
import { TARGET_CHAIN_ID, requireAddress } from "@/lib/web3/config"
import { Web3UserError, ensureAllowance } from "@/lib/web3/tx"
import { useWeb3Tx } from "./useWeb3Tx"

interface FundProjectParams {
  /** Amount in USDC base units (6 decimals) - use parseUnits / safeParseUnits. */
  amount: bigint
  escrowAddress: string
  /** Funding token (MockUSDC). Read from the escrow (`fundingToken()`) when omitted. */
  tokenAddress?: string
}

/**
 * Funds the escrow: (1) approve USDC if the allowance is insufficient and wait
 * for it to be mined, (2) MatDAO_Escrow.fundProject(amount) and wait.
 */
export function useFundProject() {
  const { run, isPending, isSuccess, hash, error } = useWeb3Tx()

  const fundProject = useCallback(
    async ({ amount, escrowAddress, tokenAddress }: FundProjectParams): Promise<Hash> =>
      run({ toastId: "fund-project", pending: "Preparing funding...", success: "Project funded successfully!" }, async (ctx) => {
        if (amount <= 0n) throw new Web3UserError("Enter an amount greater than zero.")
        const escrow = requireAddress(escrowAddress, "Escrow")
        const token = tokenAddress
          ? requireAddress(tokenAddress, "Funding token")
          : await ctx.publicClient.readContract({ address: escrow, abi: ESCROW_ABI, functionName: "fundingToken" })

        const [current, goal] = await ctx.publicClient.readContract({ address: escrow, abi: ESCROW_ABI, functionName: "getFundingProgress" })
        if (current + amount > goal) {
          throw new Web3UserError(`Amount exceeds the remaining funding goal (${((goal - current) / 10n ** 6n).toString()} USDC left).`)
        }

        ctx.status("Checking USDC allowance...")
        await ensureAllowance({
          publicClient: ctx.publicClient,
          writeContractAsync: ctx.writeContractAsync,
          token,
          owner: ctx.account,
          spender: escrow,
          amount,
          onStatus: ctx.status,
        })

        ctx.status("Confirm funding in your wallet...")
        return ctx.writeAndWait({ address: escrow, abi: ESCROW_ABI, functionName: "fundProject", args: [amount] })
      }),
    [run],
  )

  return { fundProject, isPending, isSuccess, hash, error }
}

/** Live funding progress from MatDAO_Escrow.getFundingProgress(). */
export function useFundingProgress(escrowAddress?: string) {
  const enabled = /^0x[0-9a-fA-F]{40}$/.test(escrowAddress || "")
  const { data, isLoading, error, refetch } = useReadContract({
    address: escrowAddress as `0x${string}`,
    abi: ESCROW_ABI,
    functionName: "getFundingProgress",
    chainId: TARGET_CHAIN_ID,
    query: { enabled },
  })

  return {
    current: data?.[0] ?? 0n,
    goal: data?.[1] ?? 0n,
    percentage: data?.[2] ?? 0n,
    isLoading,
    error,
    refetch,
  }
}
