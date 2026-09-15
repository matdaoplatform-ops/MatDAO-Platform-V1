"use client"

import { useCallback } from "react"
import type { Hash } from "viem"
import { ESCROW_ABI } from "@/lib/web3/abis"
import { requireAddress } from "@/lib/web3/config"
import { useWeb3Tx } from "./useWeb3Tx"

interface ClaimDividendsParams {
  escrowAddress: string
}

/** MatDAO_Escrow.claimDividends (IPT holders). */
export function useClaimDividends() {
  const { run, isPending, isSuccess, hash, error } = useWeb3Tx()

  const claimDividends = useCallback(
    async ({ escrowAddress }: ClaimDividendsParams): Promise<Hash> =>
      run({ toastId: "claim-dividends", pending: "Claiming dividends...", success: "Dividends claimed!" }, (ctx) =>
        ctx.writeAndWait({
          address: requireAddress(escrowAddress, "Escrow"),
          abi: ESCROW_ABI,
          functionName: "claimDividends",
          args: [],
        }),
      ),
    [run],
  )

  return { claimDividends, isPending, isSuccess, hash, error }
}
