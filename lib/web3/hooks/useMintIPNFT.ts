"use client"

import { useCallback } from "react"
import { keccak256, parseEventLogs, toHex, type Hash } from "viem"
import { IPNFT_ABI } from "@/lib/web3/abis"
import { CONTRACT_ADDRESSES, requireAddress, type Address } from "@/lib/web3/config"
import { Web3UserError, isZeroAddress } from "@/lib/web3/tx"
import { useWeb3Tx } from "./useWeb3Tx"

export interface MintIPNFTParams {
  /** Wallet that receives the IP-NFT. */
  researcher: Address
  /** ipfs://... metadata URI. */
  tokenURI: string
  /** SHA-256/keccak of the legal agreement. Defaults to keccak256(tokenURI). */
  legalHash?: Address
  /** Defaults to NEXT_PUBLIC_MATDAO_IPNFT_ADDRESS. */
  contractAddress?: Address
}

export interface MintIPNFTResult {
  hash: Hash
  /** Parsed from the IPNFTMinted event; null if the log could not be decoded. */
  tokenId: bigint | null
}

/**
 * Mints an IP-NFT via MatDAO_IPNFT.mintIP(address,string,bytes32).
 * The connected wallet must be the contract owner (checked via simulation
 * before the wallet prompt, so the error is readable).
 */
export function useMintIPNFT(): {
  mintIPNFT: (p: MintIPNFTParams) => Promise<MintIPNFTResult>
  isPending: boolean
  isSuccess: boolean
  hash?: Hash
  error: Error | null
} {
  const { run, isPending, isSuccess, hash, error } = useWeb3Tx()

  const mintIPNFT = useCallback(
    async ({ researcher, tokenURI, legalHash, contractAddress }: MintIPNFTParams): Promise<MintIPNFTResult> => {
      return run({ toastId: "mint-ipnft", pending: "Preparing IP-NFT mint...", success: "IP-NFT minted successfully!" }, async (ctx) => {
        const contract = requireAddress(contractAddress ?? CONTRACT_ADDRESSES.IPNFT, "IP-NFT contract")
        if (isZeroAddress(researcher)) throw new Web3UserError("Researcher address is missing.")
        if (!tokenURI) throw new Web3UserError("Token URI is missing.")
        const hashArg = (legalHash ?? keccak256(toHex(tokenURI))) as `0x${string}`

        ctx.status("Confirm the mint in your wallet...")
        const txHash = await ctx.write({
          address: contract,
          abi: IPNFT_ABI,
          functionName: "mintIP",
          args: [researcher, tokenURI, hashArg],
        })

        ctx.status("Waiting for the mint to be mined...")
        const receipt = await ctx.publicClient.waitForTransactionReceipt({ hash: txHash })
        if (receipt.status !== "success") throw new Web3UserError(`Mint transaction ${txHash} reverted.`)

        let tokenId: bigint | null = null
        try {
          const logs = parseEventLogs({ abi: IPNFT_ABI, eventName: "IPNFTMinted", logs: receipt.logs })
          const minted = logs.find((l) => l.address.toLowerCase() === contract.toLowerCase()) ?? logs[0]
          tokenId = minted ? minted.args.tokenId : null
        } catch (e) {
          console.warn("[useMintIPNFT] could not parse IPNFTMinted log", e)
        }
        return { hash: txHash, tokenId }
      })
    },
    [run],
  )

  return { mintIPNFT, isPending, isSuccess, hash, error }
}
