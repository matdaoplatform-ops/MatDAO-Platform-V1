"use client"

import { useCallback } from "react"
import type { Hash } from "viem"
import { ESCROW_ABI } from "@/lib/web3/abis"
import { USDC_DECIMALS, requireAddress } from "@/lib/web3/config"
import { Web3UserError, ensureAllowance, safeParseUnits } from "@/lib/web3/tx"
import { useWeb3Tx } from "./useWeb3Tx"

interface DepositRoyaltiesParams {
  escrowAddress: string
  /** Whole USDC (e.g. 10000 or "10000.50") or base units as bigint. */
  amount: number | string | bigint
}

/**
 * Simulates an enterprise royalty payment: approve USDC (if needed, waits for
 * mining) then MatDAO_Escrow.depositRoyalties(amount).
 */
export function useRoyaltyDeposit() {
  const { run, isPending, isSuccess, hash, error } = useWeb3Tx()

  const depositRoyalties = useCallback(
    async ({ escrowAddress, amount }: DepositRoyaltiesParams): Promise<Hash> =>
      run({ toastId: "deposit-royalties", pending: "Preparing royalty deposit...", success: "Royalties deposited!" }, async (ctx) => {
        const escrow = requireAddress(escrowAddress, "Escrow")
        const value = typeof amount === "bigint" ? amount : safeParseUnits(amount, USDC_DECIMALS)
        if (!value || value <= 0n) throw new Web3UserError("Enter a valid USDC amount.")

        const token = await ctx.publicClient.readContract({ address: escrow, abi: ESCROW_ABI, functionName: "fundingToken" })

        ctx.status("Checking USDC allowance...")
        await ensureAllowance({
          publicClient: ctx.publicClient,
          writeContractAsync: ctx.writeContractAsync,
          token,
          owner: ctx.account,
          spender: escrow,
          amount: value,
          onStatus: ctx.status,
        })

        ctx.status("Confirm the royalty deposit in your wallet...")
        return ctx.writeAndWait({ address: escrow, abi: ESCROW_ABI, functionName: "depositRoyalties", args: [value] })
      }),
    [run],
  )

  return { depositRoyalties, isPending, isSuccess, hash, error }
}
