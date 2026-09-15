"use client"

import { useCallback } from "react"
import type { Hash } from "viem"
import { ESCROW_ABI } from "@/lib/web3/abis"
import { requireAddress } from "@/lib/web3/config"
import { useWeb3Tx } from "./useWeb3Tx"

interface ApproveMilestoneParams {
  milestoneId: bigint | number
  escrowAddress: string
}

/** MatDAO_Escrow.approveMilestone (owner only). */
export function useApproveMilestone() {
  const { run, isPending, isSuccess, hash, error } = useWeb3Tx()

  const approveMilestone = useCallback(
    async ({ milestoneId, escrowAddress }: ApproveMilestoneParams): Promise<Hash> =>
      run({ toastId: "approve-milestone", pending: "Approving milestone...", success: "Milestone approved!" }, (ctx) =>
        ctx.writeAndWait({
          address: requireAddress(escrowAddress, "Escrow"),
          abi: ESCROW_ABI,
          functionName: "approveMilestone",
          args: [BigInt(milestoneId)],
        }),
      ),
    [run],
  )

  return { approveMilestone, isPending, isSuccess, hash, error }
}
