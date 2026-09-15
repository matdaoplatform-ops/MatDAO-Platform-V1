"use client"

import { useCallback, useState } from "react"
import { useAccount, usePublicClient, useWriteContract } from "wagmi"
import type { Hash, PublicClient } from "viem"
import toast from "react-hot-toast"
import { TARGET_CHAIN_ID, type Address } from "@/lib/web3/config"
import {
  assertWalletReady,
  simulateAndWrite,
  toReadableError,
  waitForReceipt,
  type WriteContractFn,
  type WriteRequest,
} from "@/lib/web3/tx"

export interface TxContext {
  account: Address
  publicClient: PublicClient
  writeContractAsync: WriteContractFn
  /** Update the toast / progress message. */
  status: (message: string) => void
  /** Simulate, send and record the hash of a contract write (does not wait). */
  write: (request: WriteRequest) => Promise<Hash>
  /** Simulate, send, record and wait for the receipt. */
  writeAndWait: (request: WriteRequest) => Promise<Hash>
}

export interface RunOptions {
  toastId: string
  pending: string
  success: string
}

export interface Web3TxState {
  isPending: boolean
  isSuccess: boolean
  hash?: Hash
  error: Error | null
}

/**
 * Base building block for every write hook: connected-wallet + network
 * checks, simulate-before-send, receipt waiting, readable errors and a single
 * toast that is updated through the steps. Errors are re-thrown so callers
 * can react, and also exposed via `error`.
 */
export function useWeb3Tx() {
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient({ chainId: TARGET_CHAIN_ID })
  const { address: account, chainId } = useAccount()
  const [state, setState] = useState<Web3TxState>({ isPending: false, isSuccess: false, hash: undefined, error: null })

  const run = useCallback(
    async <T,>(options: RunOptions, fn: (ctx: TxContext) => Promise<T>): Promise<T> => {
      setState({ isPending: true, isSuccess: false, hash: undefined, error: null })
      toast.loading(options.pending, { id: options.toastId })
      try {
        assertWalletReady(account, chainId, publicClient)
        const client = publicClient as PublicClient
        const write: WriteContractFn = writeContractAsync as unknown as WriteContractFn
        const ctx: TxContext = {
          account,
          publicClient: client,
          writeContractAsync: write,
          status: (message) => toast.loading(message, { id: options.toastId }),
          write: async (request) => {
            const hash = await simulateAndWrite(client, write, account, request)
            setState((s) => ({ ...s, hash }))
            return hash
          },
          writeAndWait: async (request) => {
            const hash = await simulateAndWrite(client, write, account, request)
            setState((s) => ({ ...s, hash }))
            toast.loading("Waiting for confirmation...", { id: options.toastId })
            await waitForReceipt(client, hash)
            return hash
          },
        }
        const result = await fn(ctx)
        toast.success(options.success, { id: options.toastId })
        setState((s) => ({ ...s, isPending: false, isSuccess: true }))
        return result
      } catch (e) {
        const error = toReadableError(e)
        console.error(`[web3:${options.toastId}]`, error)
        toast.error(error.message, { id: options.toastId })
        setState((s) => ({ ...s, isPending: false, isSuccess: false, error }))
        throw error
      }
    },
    [account, chainId, publicClient, writeContractAsync],
  )

  return { run, account, chainId, publicClient, ...state }
}
