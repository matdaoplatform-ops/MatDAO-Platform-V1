"use client"

import { useCallback } from "react"
import type { Hash } from "viem"
import { ESCROW_ABI } from "@/lib/web3/abis"
import { requireAddress } from "@/lib/web3/config"
import { useWeb3Tx } from "./useWeb3Tx"

interface ToggleProjectFailureParams {
  escrowAddress: string
}

/** MatDAO_Escrow.toggleProjectFailure (owner only, irreversible). */
export function useToggleProjectFailure() {
  const { run, isPending, isSuccess, hash, error } = useWeb3Tx()

  const toggleProjectFailure = useCallback(
    async ({ escrowAddress }: ToggleProjectFailureParams): Promise<Hash> =>
      run({ toastId: "toggle-failure", pending: "Declaring project failure...", success: "Project marked as failed. Refunds are open." }, (ctx) =>
        ctx.writeAndWait({
          address: requireAddress(escrowAddress, "Escrow"),
          abi: ESCROW_ABI,
          functionName: "toggleProjectFailure",
          args: [],
        }),
      ),
    [run],
  )

  return { toggleProjectFailure, isPending, isSuccess, hash, error }
}
