"use client"

import { useCallback } from "react"
import type { Hash } from "viem"
import { ERC20_ABI, ESCROW_ABI } from "@/lib/web3/abis"
import { requireAddress } from "@/lib/web3/config"
import { Web3UserError, ensureAllowance } from "@/lib/web3/tx"
import { useWeb3Tx } from "./useWeb3Tx"

interface ClaimEmergencyRefundParams {
  escrowAddress: string
}

/**
 * Emergency refund: the escrow pulls the caller's FULL IPT balance, so we
 * approve exactly that amount (if needed, waiting for mining) and then call
 * MatDAO_Escrow.claimEmergencyRefund().
 */
export function useEmergencyRefund() {
  const { run, isPending, isSuccess, hash, error } = useWeb3Tx()

  const claimEmergencyRefund = useCallback(
    async ({ escrowAddress }: ClaimEmergencyRefundParams): Promise<Hash> =>
      run({ toastId: "emergency-refund", pending: "Preparing emergency refund...", success: "Emergency refund claimed!" }, async (ctx) => {
        const escrow = requireAddress(escrowAddress, "Escrow")
        const [failed, iptToken] = await Promise.all([
          ctx.publicClient.readContract({ address: escrow, abi: ESCROW_ABI, functionName: "isProjectFailed" }),
          ctx.publicClient.readContract({ address: escrow, abi: ESCROW_ABI, functionName: "iptToken" }),
        ])
        if (!failed) throw new Web3UserError("Refunds are only available after the project has been declared failed.")

        const iptBalance = await ctx.publicClient.readContract({ address: iptToken, abi: ERC20_ABI, functionName: "balanceOf", args: [ctx.account] })
        if (iptBalance <= 0n) throw new Web3UserError("You hold no IPT for this project, so there is nothing to refund.")

        ctx.status("Checking IPT allowance...")
        await ensureAllowance({
          publicClient: ctx.publicClient,
          writeContractAsync: ctx.writeContractAsync,
          token: iptToken,
          owner: ctx.account,
          spender: escrow,
          amount: iptBalance,
          onStatus: ctx.status,
        })

        ctx.status("Confirm the refund in your wallet...")
        return ctx.writeAndWait({ address: escrow, abi: ESCROW_ABI, functionName: "claimEmergencyRefund", args: [] })
      }),
    [run],
  )

  return { claimEmergencyRefund, isPending, isSuccess, hash, error }
}
