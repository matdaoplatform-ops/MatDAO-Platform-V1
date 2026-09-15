"use client"

import { useCallback } from "react"
import type { Hash } from "viem"
import { ESCROW_ABI } from "@/lib/web3/abis"
import { requireAddress } from "@/lib/web3/config"
import { useWeb3Tx } from "./useWeb3Tx"

interface ClaimMilestoneParams {
  milestoneId: bigint | number
  escrowAddress: string
}

/** MatDAO_Escrow.claimMilestone (researcher only). */
export function useClaimMilestone() {
  const { run, isPending, isSuccess, hash, error } = useWeb3Tx()

  const claimMilestone = useCallback(
    async ({ milestoneId, escrowAddress }: ClaimMilestoneParams): Promise<Hash> =>
      run({ toastId: "claim-milestone", pending: "Claiming milestone funds...", success: "Milestone funds claimed!" }, (ctx) =>
        ctx.writeAndWait({
          address: requireAddress(escrowAddress, "Escrow"),
          abi: ESCROW_ABI,
          functionName: "claimMilestone",
          args: [BigInt(milestoneId)],
        }),
      ),
    [run],
  )

  return { claimMilestone, isPending, isSuccess, hash, error }
}
